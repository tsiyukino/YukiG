/// Tauri command handlers for the custom tray-menu popup window.
///
/// The frontend owns the menu's content and measures its own size; these
/// commands supply the data and do the platform work the webview cannot:
/// positioning the popup at the recorded tray-click point, showing/hiding
/// it, and dispatching menu actions (launch, open main window, quit).
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, State};

use crate::db::connection::DbConnection;
use crate::db::queries::recent_queries::{self, RecentGame};
use crate::services::launcher;
use crate::tray::{TrayMenuState, TRAY_MENU_WINDOW};

/// How many recently played games the tray menu shows.
const MAX_TRAY_RECENT_GAMES: u32 = 5;

/// Logical-pixel margin kept between the popup and monitor edges, and the
/// vertical gap between the popup and the cursor.
const EDGE_MARGIN: f64 = 8.0;

/// Returns the games for the tray menu, most recently played first.
///
/// # Errors
/// Returns an error string if the database query fails.
#[tauri::command]
pub fn tray_get_recent_games(db: State<DbConnection>) -> Result<Vec<RecentGame>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    recent_queries::get_recently_played(&conn, MAX_TRAY_RECENT_GAMES).map_err(|e| e.to_string())
}

/// Launches an item from the tray menu, fire-and-forget.
///
/// `launch_tracked` blocks until the game exits, so it runs detached on the
/// async runtime — the menu can hide immediately while playtime tracking
/// continues in the background. Launch failures are logged, not surfaced:
/// the menu window is already gone by the time they could be shown.
#[tauri::command]
pub fn tray_launch_item(app: AppHandle, item_id: String) {
    tauri::async_runtime::spawn(async move {
        if let Err(e) = launcher::launch_tracked(app, item_id).await {
            eprintln!("[tray] launch failed: {e}");
        }
    });
}

/// Sizes, positions, shows, and focuses the tray-menu popup.
///
/// `width`/`height` are the frontend's measured content size in logical
/// pixels. The popup is anchored with its bottom-right corner at the
/// recorded tray-click point (menus open upward from the taskbar) and
/// clamped to the monitor under the cursor.
///
/// # Errors
/// Returns an error string if the menu window is missing or a window
/// operation fails.
#[tauri::command]
pub fn tray_menu_present(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    let win = app
        .get_webview_window(TRAY_MENU_WINDOW)
        .ok_or("tray menu window missing")?;
    let state = app.state::<TrayMenuState>();
    let click = *state.last_click.lock().map_err(|e| e.to_string())?;

    // Work in the coordinate space of the monitor under the cursor.
    let monitor = app
        .monitor_from_point(click.x, click.y)
        .map_err(|e| e.to_string())?;

    let (x, y) = match monitor {
        Some(m) => {
            let scale = m.scale_factor();
            let (mx, my) = (m.position().x as f64 / scale, m.position().y as f64 / scale);
            let (mw, mh) = (m.size().width as f64 / scale, m.size().height as f64 / scale);
            let (cx, cy) = (click.x / scale, click.y / scale);

            // Bottom-right anchored at the cursor, clamped inside the monitor.
            let x = (cx - width).clamp(mx + EDGE_MARGIN, mx + mw - width - EDGE_MARGIN);
            let y = (cy - height - EDGE_MARGIN).clamp(my + EDGE_MARGIN, my + mh - height - EDGE_MARGIN);
            (x, y)
        }
        // No monitor info (shouldn't happen): fall back to the raw click point.
        None => (click.x - width, click.y - height - EDGE_MARGIN),
    };

    win.set_size(LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
    win.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
    win.show().map_err(|e| e.to_string())?;
    win.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

/// Hides the tray-menu popup (Escape key, or after a menu action).
///
/// # Errors
/// Returns an error string if the menu window is missing or hiding fails.
#[tauri::command]
pub fn tray_menu_hide(app: AppHandle) -> Result<(), String> {
    let win = app
        .get_webview_window(TRAY_MENU_WINDOW)
        .ok_or("tray menu window missing")?;
    win.hide().map_err(|e| e.to_string())
}

/// Opens (or recreates) the main window from the tray menu.
#[tauri::command]
pub fn tray_open_main(app: AppHandle) {
    crate::show_or_create_window(&app);
}

/// Quits the application from the tray menu.
#[tauri::command]
pub fn tray_quit(app: AppHandle) {
    app.exit(0);
}
