/// Watches Steam's registry for the currently-running game and mirrors it into
/// the play-session registry.
///
/// Steam writes the app id of the game it is running to
/// `HKCU\Software\Valve\Steam\RunningAppID` (0 when nothing is running). This
/// value flips the instant a Steam game starts or exits — Steam itself keeps a
/// pipe to the game, so its detection is immediate — which lets YukiG show a
/// "now playing" badge for Steam games it did not launch and cannot track as a
/// child process.
///
/// The watch is event-driven via `RegNotifyChangeKeyValue`, not polled: the
/// thread blocks until the key changes, then reconciles. On each transition it
/// resolves the app id back to a library item through the `steam_app_id`
/// metadata and emits the same `play-session-started` / `play-session-ended`
/// events the local-game tracker uses, so the frontend treats both uniformly.
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;

use tauri::{AppHandle, Emitter, Manager};

use crate::db::connection::DbConnection;
use crate::db::queries::strategy_metadata_queries;
use crate::services::session_registry::SessionRegistry;

/// Metadata key that stores a Steam item's app id.
const STEAM_APP_ID_KEY: &str = "steam_app_id";

/// Tauri event broadcast when Steam's running app id changes. Payload is the
/// running app id (0 when nothing is running).
const EVENT_RUNNING_CHANGED: &str = "steam-running-changed";

/// Managed state holding the app id Steam is currently running (0 = none).
///
/// The Steam page reads this by app id — independent of whether the game is
/// imported as a library item — so it can mark a running game whether it was
/// launched from Steam or from YukiG.
#[derive(Clone, Default)]
pub struct SteamRunningState(Arc<AtomicU32>);

impl SteamRunningState {
    /// Creates the state with no game running.
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns the currently-running Steam app id, or 0 if none.
    pub fn current(&self) -> u32 {
        self.0.load(Ordering::Relaxed)
    }

    fn set(&self, app_id: u32) {
        self.0.store(app_id, Ordering::Relaxed);
    }
}

/// Spawns the background thread that watches Steam's `RunningAppID`.
///
/// Returns immediately; the watch runs for the life of the process. If Steam's
/// registry key cannot be opened (Steam never installed), the thread logs once
/// and exits without error — a missing Steam is not a failure for YukiG.
pub fn spawn(app: AppHandle) {
    std::thread::spawn(move || {
        #[cfg(target_os = "windows")]
        if let Err(e) = watch_loop(&app) {
            eprintln!("[steam_running] watcher stopped: {e}");
        }
        #[cfg(not(target_os = "windows"))]
        let _ = &app;
    });
}

/// Blocks on registry-change notifications, reconciling each `RunningAppID`
/// transition into session start/end events.
#[cfg(target_os = "windows")]
fn watch_loop(app: &AppHandle) -> Result<(), String> {
    use windows::core::w;
    use windows::Win32::Foundation::{CloseHandle, ERROR_SUCCESS, HANDLE};
    use windows::Win32::System::Registry::{
        RegCloseKey, RegNotifyChangeKeyValue, RegOpenKeyExW, HKEY, HKEY_CURRENT_USER,
        KEY_NOTIFY, KEY_READ, REG_NOTIFY_CHANGE_LAST_SET,
    };
    use windows::Win32::System::Threading::{
        CreateEventW, ResetEvent, WaitForSingleObject, INFINITE,
    };

    let mut hkey = HKEY::default();
    let open = unsafe {
        RegOpenKeyExW(
            HKEY_CURRENT_USER,
            w!("Software\\Valve\\Steam"),
            Some(0),
            KEY_READ | KEY_NOTIFY,
            &mut hkey,
        )
    };
    if open != ERROR_SUCCESS {
        return Err(format!("Steam registry key not found (code {})", open.0));
    }

    // Manual-reset event that RegNotifyChangeKeyValue signals on change.
    let event: HANDLE =
        unsafe { CreateEventW(None, true, false, None) }.map_err(|e| e.to_string())?;

    let mut last_appid = read_running_appid(hkey);
    reconcile(app, None, last_appid);

    loop {
        // Re-arm the notification before each wait. RegNotifyChangeKeyValue is
        // one-shot, so it must be re-registered every iteration.
        let notify = unsafe {
            RegNotifyChangeKeyValue(hkey, false, REG_NOTIFY_CHANGE_LAST_SET, Some(event), true)
        };
        if notify != ERROR_SUCCESS {
            unsafe {
                CloseHandle(event).ok();
                let _ = RegCloseKey(hkey);
            }
            return Err(format!("RegNotifyChangeKeyValue failed (code {})", notify.0));
        }

        unsafe { WaitForSingleObject(event, INFINITE) };

        // The event is manual-reset, so it stays signaled after the wait
        // returns. Reset it now, or the next WaitForSingleObject would return
        // immediately in a tight busy-loop and miss real changes.
        unsafe { ResetEvent(event).ok() };

        let current = read_running_appid(hkey);
        if current != last_appid {
            reconcile(app, last_appid, current);
            last_appid = current;
        }
    }
}

/// Reads `RunningAppID` (a DWORD) from the open Steam key. Returns `None` if the
/// value is absent, unreadable, or 0 (Steam's "nothing running" sentinel).
#[cfg(target_os = "windows")]
fn read_running_appid(hkey: windows::Win32::System::Registry::HKEY) -> Option<u32> {
    use windows::core::w;
    use windows::Win32::Foundation::ERROR_SUCCESS;
    use windows::Win32::System::Registry::{RegQueryValueExW, REG_VALUE_TYPE};

    let mut data: u32 = 0;
    let mut size = std::mem::size_of::<u32>() as u32;
    let mut kind = REG_VALUE_TYPE::default();
    let status = unsafe {
        RegQueryValueExW(
            hkey,
            w!("RunningAppID"),
            None,
            Some(&mut kind),
            Some(&mut data as *mut u32 as *mut u8),
            Some(&mut size),
        )
    };
    if status == ERROR_SUCCESS && data != 0 {
        Some(data)
    } else {
        None
    }
}

/// Turns a `RunningAppID` transition into session events.
///
/// Ends the previous app's session (if any) and starts the new one (if any),
/// each resolved from app id to library item. Unknown app ids — games not in
/// the YukiG library — are silently ignored.
fn reconcile(app: &AppHandle, prev: Option<u32>, current: Option<u32>) {
    if prev == current {
        return;
    }

    // Publish the raw running app id (0 = none) for the Steam page, which keys
    // by app id rather than library item.
    let app_id = current.unwrap_or(0);
    app.state::<SteamRunningState>().set(app_id);
    let _ = app.emit(EVENT_RUNNING_CHANGED, app_id);

    // Drive per-item session state for games that are in the library.
    let registry = app.state::<SessionRegistry>();
    if let Some(old) = prev {
        if let Some(item_id) = resolve_item(app, old) {
            registry.end(app, &item_id);
        }
    }
    if let Some(new) = current {
        if let Some(item_id) = resolve_item(app, new) {
            registry.start(app, &item_id);
        }
    }
}

/// Resolves a Steam app id to a library item id via `steam_app_id` metadata.
fn resolve_item(app: &AppHandle, app_id: u32) -> Option<String> {
    let db = app.state::<DbConnection>();
    let conn = db.0.lock().ok()?;
    strategy_metadata_queries::find_item_by_metadata(&conn, STEAM_APP_ID_KEY, &app_id.to_string())
        .ok()
        .flatten()
}
