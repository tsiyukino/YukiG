/// Strategy for games imported from the Steam library.
///
/// Unlike `GameStrategy` which launches a local `.exe`, this strategy
/// launches via `steam://rungameid/<appid>` so Steam handles DRM, overlays,
/// and cloud saves transparently. The `folder_path` may be empty for
/// uninstalled games — the strategy degrades gracefully.
use std::collections::HashMap;
use std::path::Path;

use super::{DisplayItem, FolderStrategy, LaunchAction, MetadataField, ScanResult, StrategyError};

/// Strategy for games imported from a Steam library.
pub struct SteamGameStrategy;

impl FolderStrategy for SteamGameStrategy {
    fn strategy_type(&self) -> &'static str {
        "steam_game"
    }

    fn display_name(&self) -> &'static str {
        "Steam Game"
    }

    /// For installed games, scans the install directory for exe files and mod folders.
    /// For uninstalled games (empty folder_path), returns an empty scan result.
    fn scan(&self, folder_path: &Path) -> Result<ScanResult, StrategyError> {
        if folder_path.as_os_str().is_empty() || !folder_path.exists() {
            return Ok(ScanResult {
                metadata: HashMap::new(),
                summary: "Game is not installed.".to_string(),
            });
        }

        let mut metadata = HashMap::new();
        let entries = std::fs::read_dir(folder_path)?;

        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if path.is_file() && name.ends_with(".exe") {
                // Record the first exe found as a hint; actual launch always uses Steam URL.
                metadata.entry("hint_exe".to_string()).or_insert_with(|| path.display().to_string());
            }
        }

        Ok(ScanResult {
            metadata,
            summary: "Steam game — launched via Steam.".to_string(),
        })
    }

    /// Returns the install directory contents for installed games; empty for uninstalled.
    fn get_display_items(&self, folder_path: &Path) -> Result<Vec<DisplayItem>, StrategyError> {
        if folder_path.as_os_str().is_empty() || !folder_path.exists() {
            return Ok(Vec::new());
        }

        let entries = std::fs::read_dir(folder_path)?;
        let mut items = Vec::new();

        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            let size_bytes = if path.is_file() {
                path.metadata().ok().map(|m| m.len())
            } else {
                None
            };
            items.push(DisplayItem {
                name,
                path: path.display().to_string(),
                is_dir: path.is_dir(),
                size_bytes,
                modified_at: None,
            });
        }

        Ok(items)
    }

    /// Returns a launch action that opens the game through Steam.
    ///
    /// The `steam_launch_url` metadata key (e.g. `steam://rungameid/570`) is used
    /// as the target. The frontend's `strategy_execute_launch` handler opens this
    /// URL with the system default handler, which is Steam.
    fn get_launch_action(
        &self,
        _folder_path: &Path,
        metadata: &HashMap<String, String>,
    ) -> Option<LaunchAction> {
        metadata.get("steam_launch_url").map(|url| LaunchAction {
            action_type: "open_with_default".to_string(),
            target_path: url.clone(),
        })
    }

    fn metadata_schema(&self) -> Vec<MetadataField> {
        vec![
            MetadataField {
                key: "steam_app_id".to_string(),
                label: "Steam App ID".to_string(),
                required: true,
                field_type: "text".to_string(),
            },
            MetadataField {
                key: "steam_launch_url".to_string(),
                label: "Steam Launch URL".to_string(),
                required: true,
                field_type: "text".to_string(),
            },
            MetadataField {
                key: "install_path".to_string(),
                label: "Install Path".to_string(),
                required: false,
                field_type: "folder_path".to_string(),
            },
        ]
    }
}
