/// In-memory registry of active play sessions.
///
/// Tracks which items are currently being played and since when, so the
/// frontend can show a "now playing" badge. Because the tray flow destroys the
/// webview on window close, active-session state must live in the backend and
/// be queryable on window recreation — the frontend cannot rely on holding it.
///
/// The registry is authoritative for *local* games only (started via
/// `strategy_execute_launch_tracked`). Steam games are launched by the Steam
/// client, so their running state is observed separately from the registry.
///
/// ## Events
/// On every start/end the registry emits a Tauri event to all windows:
/// - `play-session-started` with payload `{ item_id, started_at }`
/// - `play-session-ended` with payload `{ item_id, started_at, ended_at }`
///
/// `started_at` / `ended_at` are Unix timestamps in seconds.
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

/// Tauri event name emitted when a session starts.
const EVENT_STARTED: &str = "play-session-started";
/// Tauri event name emitted when a session ends.
const EVENT_ENDED: &str = "play-session-ended";

/// One active play session: an item and the Unix second it began.
#[derive(Debug, Clone, Serialize)]
pub struct ActiveSession {
    /// UUID of the item being played.
    pub item_id: String,
    /// Unix timestamp (seconds) when the session started.
    pub started_at: u64,
}

/// Payload emitted with the `play-session-ended` event.
#[derive(Debug, Clone, Serialize)]
struct SessionEndedPayload {
    item_id: String,
    started_at: u64,
    ended_at: u64,
}

/// Tauri managed state holding all active play sessions.
///
/// Keyed by item UUID so a second launch of the same item replaces the first
/// rather than double-counting it. The `Arc<Mutex<...>>` lets the blocking
/// tracker thread register/unregister sessions while commands read them.
#[derive(Clone)]
pub struct SessionRegistry {
    sessions: Arc<Mutex<HashMap<String, ActiveSession>>>,
}

impl SessionRegistry {
    /// Creates an empty registry.
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Registers a session for `item_id`, returning its start timestamp.
    ///
    /// Emits `play-session-started`. If a session for this item already exists
    /// it is replaced (the new start time wins); this keeps the registry keyed
    /// one-per-item and avoids stale entries if a prior end was missed.
    pub fn start(&self, app: &AppHandle, item_id: &str) -> u64 {
        let started_at = now_secs();
        let session = ActiveSession {
            item_id: item_id.to_string(),
            started_at,
        };
        if let Ok(mut map) = self.sessions.lock() {
            map.insert(item_id.to_string(), session.clone());
        }
        let _ = app.emit(EVENT_STARTED, &session);
        started_at
    }

    /// Removes the session for `item_id` and emits `play-session-ended`.
    ///
    /// No-op (and no event) if there was no active session for the item, so a
    /// duplicate end cannot emit a spurious event.
    pub fn end(&self, app: &AppHandle, item_id: &str) {
        let removed = self
            .sessions
            .lock()
            .ok()
            .and_then(|mut map| map.remove(item_id));
        if let Some(session) = removed {
            let _ = app.emit(
                EVENT_ENDED,
                SessionEndedPayload {
                    item_id: session.item_id,
                    started_at: session.started_at,
                    ended_at: now_secs(),
                },
            );
        }
    }

    /// Returns all currently active sessions.
    ///
    /// Used by the frontend on window (re)creation to rebuild "now playing"
    /// state, since the backend is the source of truth.
    pub fn active(&self) -> Vec<ActiveSession> {
        self.sessions
            .lock()
            .map(|map| map.values().cloned().collect())
            .unwrap_or_default()
    }
}

impl Default for SessionRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Current Unix time in whole seconds, or 0 if the clock is before the epoch.
fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn start_then_active_lists_session() {
        let reg = SessionRegistry::new();
        // Bypass the app-emit path by manipulating the map directly, since
        // AppHandle cannot be constructed in a unit test.
        reg.sessions.lock().unwrap().insert(
            "item-1".to_string(),
            ActiveSession { item_id: "item-1".to_string(), started_at: 100 },
        );
        let active = reg.active();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].item_id, "item-1");
        assert_eq!(active[0].started_at, 100);
    }

    #[test]
    fn end_removes_session() {
        let reg = SessionRegistry::new();
        reg.sessions.lock().unwrap().insert(
            "item-1".to_string(),
            ActiveSession { item_id: "item-1".to_string(), started_at: 100 },
        );
        reg.sessions.lock().unwrap().remove("item-1");
        assert!(reg.active().is_empty());
    }

    #[test]
    fn same_item_replaces_not_duplicates() {
        let reg = SessionRegistry::new();
        let mut map = reg.sessions.lock().unwrap();
        map.insert(
            "item-1".to_string(),
            ActiveSession { item_id: "item-1".to_string(), started_at: 100 },
        );
        map.insert(
            "item-1".to_string(),
            ActiveSession { item_id: "item-1".to_string(), started_at: 200 },
        );
        drop(map);
        let active = reg.active();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].started_at, 200);
    }
}
