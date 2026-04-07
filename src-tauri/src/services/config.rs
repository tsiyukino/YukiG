/// Application configuration service.
///
/// Stores user-controlled settings that must persist independently of the
/// data directory (e.g., the data directory path itself). Config is kept in
/// `app_config_dir()/config.json`, which is separate from app data so it
/// survives data directory migrations.
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Errors from config operations.
#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

/// The on-disk config file structure.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    /// Override for the data directory. If absent, the default app data dir is used.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data_dir: Option<String>,

    /// When true, the app registers itself in the Windows startup registry so it
    /// launches automatically on login. Defaults to false.
    #[serde(default)]
    pub start_on_startup: bool,

    /// When true, the main window is hidden immediately on startup (tray-only mode).
    /// Only meaningful when `start_on_startup` is true. Defaults to false.
    #[serde(default)]
    pub minimize_on_start: bool,

    /// When true, closing the window hides it to the system tray instead of exiting.
    /// Defaults to true (this is the original behaviour).
    #[serde(default = "default_true")]
    pub minimize_to_tray: bool,

    /// Last known window width in logical pixels. None = use default.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_width: Option<u32>,

    /// Last known window height in logical pixels. None = use default.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_height: Option<u32>,

    /// Last known window X position in logical pixels. None = center on screen.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_x: Option<i32>,

    /// Last known window Y position in logical pixels. None = center on screen.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_y: Option<i32>,
}

fn default_true() -> bool {
    true
}

/// Reads the config file from `config_dir`. Returns a default config if the
/// file does not exist yet.
///
/// # Errors
/// Returns `ConfigError` if the file exists but cannot be read or parsed.
pub fn read(config_dir: &Path) -> Result<AppConfig, ConfigError> {
    let path = config_file_path(config_dir);
    if !path.exists() {
        return Ok(AppConfig::default());
    }
    let text = std::fs::read_to_string(&path)?;
    Ok(serde_json::from_str(&text)?)
}

/// Writes the config to `config_dir/config.json`, creating the directory if needed.
///
/// # Errors
/// Returns `ConfigError` if serialization or the write fails.
pub fn write(config_dir: &Path, config: &AppConfig) -> Result<(), ConfigError> {
    std::fs::create_dir_all(config_dir)?;
    let text = serde_json::to_string_pretty(config)?;
    std::fs::write(config_file_path(config_dir), text)?;
    Ok(())
}

/// Returns the resolved data directory: the user override if set, otherwise `default_data_dir`.
pub fn resolve_data_dir(config: &AppConfig, default_data_dir: &Path) -> PathBuf {
    match &config.data_dir {
        Some(p) if !p.is_empty() => PathBuf::from(p),
        _ => default_data_dir.to_path_buf(),
    }
}

fn config_file_path(config_dir: &Path) -> PathBuf {
    config_dir.join("config.json")
}
