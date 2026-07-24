/// Strategy for game folders.
///
/// Scans for executable files and common mod folder patterns.
/// Displays only the game exe and mod folder. Launches the configured exe.
use std::collections::HashMap;
use std::path::Path;

use super::{
    DisplayItem, FolderStrategy, LaunchAction, MetadataField, ScanResult, StrategyError,
};

/// Common mod folder names recognized by the game strategy.
const MOD_FOLDER_NAMES: &[&str] = &["mods", "Mods", "MODS", "plugins", "Plugins", "addons"];

/// Strategy for folders that contain games.
pub struct GameStrategy;

impl FolderStrategy for GameStrategy {
    fn strategy_type(&self) -> &'static str {
        "game"
    }

    fn display_name(&self) -> &'static str {
        "Game"
    }

    /// Scans the game folder for executables and mod folders.
    ///
    /// Discovers `.exe` files at the top level and checks for known mod
    /// folder names. Returns the first exe found as the default exe_path.
    fn scan(&self, folder_path: &Path) -> Result<ScanResult, StrategyError> {
        if !folder_path.exists() {
            return Err(StrategyError::PathNotFound(
                folder_path.display().to_string(),
            ));
        }

        let mut metadata = HashMap::new();
        let mut exe_paths = vec![];
        let mut mod_folder: Option<String> = None;

        let entries = std::fs::read_dir(folder_path)?;
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = entry.file_name();
            let name = file_name.to_string_lossy();

            if path.is_file() && name.ends_with(".exe") {
                exe_paths.push(path.display().to_string());
            }

            if path.is_dir() && MOD_FOLDER_NAMES.contains(&name.as_ref()) {
                mod_folder = Some(path.display().to_string());
            }
        }

        if let Some(exe) = exe_paths.first() {
            metadata.insert("exe_path".to_string(), exe.clone());
        }
        if let Some(mods) = mod_folder {
            metadata.insert("mod_folder".to_string(), mods);
        }

        let summary = format!(
            "Found {} executable(s){}",
            exe_paths.len(),
            if metadata.contains_key("mod_folder") { ", mod folder detected" } else { "" }
        );

        Ok(ScanResult { metadata, summary })
    }

    /// Returns the game exe and mod folder as display items (if found).
    fn get_display_items(&self, folder_path: &Path) -> Result<Vec<DisplayItem>, StrategyError> {
        if !folder_path.exists() {
            return Err(StrategyError::PathNotFound(
                folder_path.display().to_string(),
            ));
        }

        let mut items = vec![];
        let entries = std::fs::read_dir(folder_path)?;

        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            let is_exe = path.is_file() && name.ends_with(".exe");
            let is_mod_dir = path.is_dir() && MOD_FOLDER_NAMES.contains(&name.as_str());

            if is_exe || is_mod_dir {
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
        }

        Ok(items)
    }

    /// Returns a launch action to run the configured exe, if one is set.
    fn get_launch_action(
        &self,
        _folder_path: &Path,
        metadata: &HashMap<String, String>,
    ) -> Option<LaunchAction> {
        metadata.get("exe_path").map(|exe| LaunchAction {
            action_type: "run_exe".to_string(),
            target_path: exe.clone(),
        })
    }

    fn metadata_schema(&self) -> Vec<MetadataField> {
        vec![
            MetadataField {
                key: "exe_path".to_string(),
                label: "Executable (.exe)".to_string(),
                required: true,
                field_type: "file_path".to_string(),
            },
            MetadataField {
                key: "mod_folder".to_string(),
                label: "Mod Folder".to_string(),
                required: false,
                field_type: "folder_path".to_string(),
            },
            MetadataField {
                key: "screenshot_folder".to_string(),
                label: "Screenshots Folder".to_string(),
                required: false,
                field_type: "folder_path".to_string(),
            },
            MetadataField {
                key: "save_folder".to_string(),
                label: "Saves Folder".to_string(),
                required: false,
                field_type: "folder_path".to_string(),
            },
        ]
    }
}
