/// System tray: icon, custom popup-menu window, and tray event handling.
///
/// The tray has no native menu. Right-clicking the icon shows a frameless,
/// transparent, always-on-top webview window (Steam-style) that renders the
/// menu with the app's own React UI. This module owns the window's
/// lifecycle plumbing: it pre-creates the window hidden at startup (so the
/// first open has no white flash), records where the user right-clicked,
/// notifies the window to refresh and present itself, and hides it again
/// when it loses focus. Geometry (row heights, content size) is entirely
/// the frontend's concern — see `commands/tray_commands.rs`.
use std::sync::Mutex;

use tauri::image::Image;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder};

/// Label of the popup-menu webview window.
pub const TRAY_MENU_WINDOW: &str = "tray-menu";

/// Event sent to the menu window when it should refresh and present itself.
pub const TRAY_MENU_OPEN_EVENT: &str = "tray-menu:open";

/// Stable id of the tray icon.
const TRAY_ID: &str = "yukig-tray";

/// Managed state: where the user last right-clicked the tray icon
/// (physical screen coordinates). `tray_menu_present` anchors the popup here.
pub struct TrayMenuState {
    pub last_click: Mutex<PhysicalPosition<f64>>,
}

/// Builds the tray icon, pre-creates the hidden menu window, and wires up
/// event handling.
///
/// # Errors
/// Returns a `tauri::Error` if tray or window construction fails.
pub fn init(app: &App) -> tauri::Result<()> {
    app.manage(TrayMenuState {
        last_click: Mutex::new(PhysicalPosition::new(0.0, 0.0)),
    });

    build_menu_window(app.handle())?;

    let icon = Image::from_path(app.path().resource_dir()?.join("icons/icon.png"))
        .unwrap_or_else(|_| app.default_window_icon().cloned().unwrap());

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip("YukiG")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button,
                button_state: MouseButtonState::Up,
                position,
                ..
            } = event
            {
                match button {
                    // Left-click opens / focuses the main window.
                    MouseButton::Left => crate::show_or_create_window(tray.app_handle()),
                    // Right-click opens the custom menu popup.
                    MouseButton::Right => open_menu(tray.app_handle(), position),
                    _ => {}
                }
            }
        })
        .build(app)?;

    Ok(())
}

/// Creates the hidden popup window that renders the tray menu.
///
/// The window stays alive (hidden) between opens so the webview is already
/// warm when the user right-clicks. `?window=tray` makes `main.tsx` render
/// the tray-menu entry instead of the full app.
fn build_menu_window(app: &AppHandle) -> tauri::Result<()> {
    let window = WebviewWindowBuilder::new(
        app,
        TRAY_MENU_WINDOW,
        WebviewUrl::App("index.html?window=tray".into()),
    )
    .visible(false)
    .focused(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    // The shadow is drawn in CSS around the transparent window content;
    // the system shadow would paint a square artifact behind rounded corners.
    .shadow(false)
    .inner_size(264.0, 320.0)
    .build()?;

    // A menu dismisses when the user clicks anywhere else: hide on focus loss.
    let win = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(false) = event {
            let _ = win.hide();
        }
    });

    Ok(())
}

/// Records the click position and asks the menu window to refresh + present.
fn open_menu(app: &AppHandle, position: PhysicalPosition<f64>) {
    let state = app.state::<TrayMenuState>();
    if let Ok(mut last) = state.last_click.lock() {
        *last = position;
    }
    if let Err(e) = app.emit_to(TRAY_MENU_WINDOW, TRAY_MENU_OPEN_EVENT, ()) {
        eprintln!("[tray] failed to notify menu window: {e}");
    }
}
