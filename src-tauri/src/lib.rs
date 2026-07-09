pub mod commands;
pub mod db;
pub mod errors;
pub mod services;
pub mod strategies;
pub mod tray;

use commands::collection_commands::*;
use commands::game_status_commands::*;
use commands::item_commands::*;
use commands::play_session_commands::*;
use commands::preview_commands::*;
use commands::search_commands::*;
use commands::settings_commands::*;
use commands::strategy_commands::*;
use commands::tag_commands::*;
use commands::thumbnail_commands::*;
use commands::tray_commands::*;
use commands::game_suggest_commands::*;
use commands::icon_commands::*;
use commands::steam_commands::*;
use commands::watcher_commands::*;
use strategies::StrategyRegistry;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder};

/// Builds and returns the Tauri application.
///
/// Registers all state, plugins, and command handlers. Called from `main.rs`.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let db = db::connection::initialize(app)
                .map_err(|e| Box::new(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
            app.manage(db);

            let registry = StrategyRegistry::new();
            app.manage(registry);

            let watcher_state = services::file_watcher::WatcherState::new();
            app.manage(watcher_state);

            let session_registry = services::session_registry::SessionRegistry::new();
            app.manage(session_registry);

            // Holds the app id Steam is currently running; must be managed
            // before the watcher spawns since the watcher writes to it.
            app.manage(services::steam_running::SteamRunningState::new());

            // Mirror Steam's running-game state into the session registry so
            // "now playing" badges cover Steam games YukiG did not launch.
            services::steam_running::spawn(app.handle().clone());

            // Tray icon with the dynamic recent-games menu. Must come after
            // the database is managed — the menu queries recently played games.
            tray::init(app)?;

            // Restore saved window size and position, then wire up persistence.
            if let Ok(config_dir) = app.path().app_config_dir() {
                let cfg = services::config::read(&config_dir).unwrap_or_default();

                if let Some(win) = app.get_webview_window("main") {
                    // Restore size if saved, otherwise the tauri.conf.json default applies.
                    if let (Some(w), Some(h)) = (cfg.window_width, cfg.window_height) {
                        let _ = win.set_size(LogicalSize::new(w, h));
                    }
                    // Restore position if saved, otherwise center (tauri.conf.json: center: true).
                    if let (Some(x), Some(y)) = (cfg.window_x, cfg.window_y) {
                        let _ = win.set_position(LogicalPosition::new(x, y));
                    }

                    // Persist size/position whenever the window is moved or resized.
                    let app_handle = app.handle().clone();
                    let _ = win.on_window_event(move |event| {
                        match event {
                            tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Moved(_) => {
                                save_window_state(&app_handle);
                            }
                            _ => {}
                        }
                    });

                    if cfg.minimize_on_start {
                        let _ = win.hide();
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Collection commands
            collection_get_all,
            collection_get_by_id,
            collection_create,
            collection_update,
            collection_delete,
            collection_reorder,
            // Item commands
            item_get_all_games,
            item_get_all_local,
            item_get_by_collection,
            item_get_by_parent,
            item_get_by_id,
            item_create,
            item_update,
            item_delete,
            item_reorder,
            item_reparent,
            item_set_favorite,
            item_get_favorites,
            item_get_all_favorites,
            item_get_all_games_full,
            folder_delete,
            // Tag commands
            tag_get_item_counts,
            tag_get_by_items_bulk,
            tag_get_all,
            tag_get_grouping,
            tag_get_games,
            tag_create,
            tag_create_mood,
            tag_upsert_mood,
            tag_create_in_group,
            tag_set_group,
            tag_delete,
            tag_get_by_item,
            tag_get_items,
            tag_assign,
            tag_remove,
            tag_get_by_collection,
            // Tag group commands
            tag_group_get_all,
            tag_group_create,
            tag_group_update,
            tag_group_delete,
            tag_group_reorder,
            tag_reorder,
            // Strategy commands
            strategy_list,
            strategy_scan,
            strategy_get_display_items,
            strategy_get_launch_action,
            strategy_get_metadata_schema,
            strategy_execute_launch_tracked,
            strategy_get_playtime_bulk,
            strategy_get_metadata,
            strategy_upsert_metadata,
            shell_open_path,
            // Thumbnail commands
            thumbnail_get,
            thumbnail_set,
            // Preview commands
            preview_get,
            // Watcher commands
            watcher_add,
            watcher_remove,
            // Settings commands
            settings_get_data_dir,
            settings_set_data_dir,
            settings_get_behaviour,
            settings_set_behaviour,
            // Game suggestion command
            game_suggest_paths,
            // Icon commands
            get_file_icon,
            // Search commands
            search_items,
            search_all,
            search_items_in_collection,
            // Steam commands
            steam_scan,
            steam_sync,
            steam_import,
            steam_get_imported_ids,
            steam_get_running_appid,
            steam_get_game_db_info,
            steam_get_users,
            steam_switch_account,
            steam_launch_game,
            steam_install_game,
            steam_open_in_app,
            steam_open_in_store,
            steam_get_achievements,
            steam_get_screenshots,
            steam_get_cloud_saves,
            steam_set_achievements,
            steam_debug_appinfo,
            steam_debug_db,
            // Play session commands
            session_start,
            session_end,
            session_get_by_item,
            session_get_active,
            // Game status commands
            game_status_get,
            game_status_set,
            game_status_get_all,
            game_status_get_bulk,
            game_status_bulk_init,
            // Tray menu commands
            tray_get_recent_games,
            tray_launch_item,
            tray_menu_present,
            tray_menu_hide,
            tray_open_main,
            tray_quit,
        ])
        .on_window_event(|window, event| {
            // When the user closes the window, check the minimize_to_tray setting.
            // If enabled (default), hide the window so the Rust backend and tray icon
            // keep running. If disabled, allow the window to close normally.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let minimize_to_tray = window
                    .app_handle()
                    .path()
                    .app_config_dir()
                    .ok()
                    .and_then(|dir| services::config::read(&dir).ok())
                    .map(|cfg| cfg.minimize_to_tray)
                    .unwrap_or(true);

                if minimize_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
                // If minimize_to_tray is false, the default close proceeds (exits the app).
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running YukiG");
}

/// Reads the current window size and position and writes them to config.json.
///
/// Called on every Resized/Moved event. Failures are silently ignored so a
/// transient I/O error never crashes the app.
fn save_window_state(app: &AppHandle) {
    let Ok(win) = app.get_webview_window("main").ok_or(()) else { return };

    // Use inner_size (the content area) expressed in logical pixels so it is
    // DPI-independent and matches what we pass back to set_size on next launch.
    let Ok(scale) = win.scale_factor() else { return };
    let (w, h) = match win.inner_size() {
        Ok(s) => (
            (s.width as f64 / scale).round() as u32,
            (s.height as f64 / scale).round() as u32,
        ),
        Err(_) => return,
    };
    let (x, y) = match win.outer_position() {
        Ok(p) => (
            (p.x as f64 / scale).round() as i32,
            (p.y as f64 / scale).round() as i32,
        ),
        Err(_) => return,
    };

    let Ok(config_dir) = app.path().app_config_dir() else { return };
    let mut cfg = services::config::read(&config_dir).unwrap_or_default();
    cfg.window_width  = Some(w);
    cfg.window_height = Some(h);
    cfg.window_x      = Some(x);
    cfg.window_y      = Some(y);
    let _ = services::config::write(&config_dir, &cfg);
}

/// Shows the main window, or recreates it if it was previously destroyed.
///
/// Tauri v2 hides the window on close (we intercept CloseRequested).
/// This function simply un-hides and focuses it. If for any reason the
/// window label is gone, it creates a new one.
pub(crate) fn show_or_create_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    } else {
        // Window was fully destroyed — recreate it.
        let _ = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
            .title("YukiG")
            .inner_size(1280.0, 800.0)
            .min_inner_size(800.0, 600.0)
            .center()
            .decorations(false)
            .drag_and_drop(false)
            .disable_drag_drop_handler()
            .build();
    }
}
