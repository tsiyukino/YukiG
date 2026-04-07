/// Tauri command handlers for application settings and meta-information.
///
/// Exposes app-level info (data directory, version) to the frontend settings page,
/// provides the ability to relocate the data directory with automatic migration,
/// and manages startup / tray behaviour preferences.
use std::path::Path;
use tauri::{AppHandle, Manager};

use crate::services::config;

// ─── Startup / tray settings ─────────────────────────────────────────────────

/// Registry key used to register apps for Windows startup.
#[cfg(target_os = "windows")]
const STARTUP_REG_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";

/// Registry value name under which YukiFileManager registers itself.
#[cfg(target_os = "windows")]
const STARTUP_REG_VALUE: &str = "YukiFileManager";

/// Returns the current behaviour settings (startup, tray) as a flat struct.
///
/// # Errors
/// Returns an error string if the config directory cannot be resolved.
#[tauri::command]
pub fn settings_get_behaviour(app: AppHandle) -> Result<BehaviourSettings, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let cfg = config::read(&config_dir).unwrap_or_default();
    Ok(BehaviourSettings {
        start_on_startup: cfg.start_on_startup,
        minimize_on_start: cfg.minimize_on_start,
        minimize_to_tray: cfg.minimize_to_tray,
    })
}

/// Flat settings struct returned to and received from the frontend.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BehaviourSettings {
    pub start_on_startup: bool,
    pub minimize_on_start: bool,
    pub minimize_to_tray: bool,
}

/// Saves behaviour settings and applies the startup registry change immediately.
///
/// # Arguments
/// * `settings` - The full set of behaviour preferences from the UI
///
/// # Errors
/// Returns an error string if the config write or registry operation fails.
#[tauri::command]
pub fn settings_set_behaviour(app: AppHandle, settings: BehaviourSettings) -> Result<(), String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let mut cfg = config::read(&config_dir).unwrap_or_default();

    cfg.start_on_startup = settings.start_on_startup;
    cfg.minimize_on_start = settings.minimize_on_start;
    cfg.minimize_to_tray = settings.minimize_to_tray;

    config::write(&config_dir, &cfg).map_err(|e| e.to_string())?;

    // Apply the Windows startup registry entry immediately.
    apply_startup_registry(settings.start_on_startup, &app)?;

    Ok(())
}

/// Adds or removes the Windows startup registry entry for YukiFileManager.
///
/// On non-Windows targets this is a no-op.
///
/// # Errors
/// Returns a string error if the registry operation fails on Windows.
#[allow(unused_variables)]
fn apply_startup_registry(enable: bool, app: &AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let run_key = hkcu
            .open_subkey_with_flags(STARTUP_REG_KEY, KEY_SET_VALUE)
            .map_err(|e| format!("Cannot open registry key: {}", e))?;

        if enable {
            // Get the path to the current executable.
            let exe_path = std::env::current_exe()
                .map_err(|e| format!("Cannot resolve exe path: {}", e))?;
            run_key
                .set_value(STARTUP_REG_VALUE, &exe_path.to_string_lossy().as_ref())
                .map_err(|e| format!("Cannot write registry value: {}", e))?;
        } else {
            // Ignore "not found" errors when removing a value that doesn't exist.
            let _ = run_key.delete_value(STARTUP_REG_VALUE);
        }
    }
    Ok(())
}

/// Returns the absolute path to the currently active data directory.
///
/// This is the directory where YukiFileManager stores its database and thumbnails.
/// May differ from the default app data dir if the user has set a custom path.
///
/// # Errors
/// Returns an error string if the path cannot be resolved.
#[tauri::command]
pub fn settings_get_data_dir(app: AppHandle) -> Result<String, String> {
    let default_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let cfg = config::read(&config_dir).unwrap_or_default();
    let data_dir = config::resolve_data_dir(&cfg, &default_data_dir);
    Ok(data_dir.to_string_lossy().into_owned())
}

/// Migrates all data to a new directory and saves the new path to config.
///
/// Copies the SQLite database and the `thumbnails/` subfolder to `new_dir`.
/// The config file is updated so the next app launch uses the new location.
/// **The app must be restarted for the new database path to take effect.**
///
/// # Arguments
/// * `new_dir` - Absolute path to the desired new data directory
///
/// # Errors
/// Returns an error string if the directory cannot be created, any file copy
/// fails, or the config cannot be written.
#[tauri::command]
pub fn settings_set_data_dir(app: AppHandle, new_dir: String) -> Result<(), String> {
    let default_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let cfg = config::read(&config_dir).unwrap_or_default();
    let current_data_dir = config::resolve_data_dir(&cfg, &default_data_dir);

    let new_path = std::path::PathBuf::from(&new_dir);

    // No-op if already pointing at the same directory.
    if current_data_dir == new_path {
        return Ok(());
    }

    std::fs::create_dir_all(&new_path)
        .map_err(|e| format!("Cannot create directory '{}': {}", new_dir, e))?;

    // Copy the database file.
    copy_if_exists(
        &current_data_dir.join("filevault.db"),
        &new_path.join("filevault.db"),
    )?;

    // Copy the thumbnails directory recursively.
    let src_thumbs = current_data_dir.join("thumbnails");
    if src_thumbs.exists() {
        copy_dir_all(&src_thumbs, &new_path.join("thumbnails"))?;
    }

    // Persist the new path while preserving all other settings.
    let mut new_cfg = cfg;
    new_cfg.data_dir = Some(new_dir);
    config::write(&config_dir, &new_cfg).map_err(|e| e.to_string())?;

    Ok(())
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/// Copies `src` to `dst` if `src` exists. Does nothing if `src` is absent.
fn copy_if_exists(src: &Path, dst: &Path) -> Result<(), String> {
    if src.exists() {
        std::fs::copy(src, dst)
            .map(|_| ())
            .map_err(|e| format!("Failed to copy '{}': {}", src.display(), e))?;
    }
    Ok(())
}

/// Recursively copies a directory from `src` to `dst`.
fn copy_dir_all(src: &Path, dst: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dst)
        .map_err(|e| format!("Cannot create dir '{}': {}", dst.display(), e))?;

    for entry in std::fs::read_dir(src)
        .map_err(|e| format!("Cannot read dir '{}': {}", src.display(), e))?
    {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("Failed to copy '{}': {}", src_path.display(), e))?;
        }
    }
    Ok(())
}
