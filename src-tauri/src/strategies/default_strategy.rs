/// Default strategy — the most general item type.
///
/// Represents any file or folder. Stores only name, path, tags, and notes.
/// No special scan logic or launch configuration required. This is the
/// fallback strategy used when no specific type is selected.
use std::collections::HashMap;
use std::path::Path;

use super::{
    DisplayItem, FolderStrategy, LaunchAction, MetadataField, ScanResult, StrategyError,
};

/// Strategy for generic files or folders with no special handling.
pub struct DefaultStrategy;

impl FolderStrategy for DefaultStrategy {
    fn strategy_type(&self) -> &'static str {
        "default"
    }

    fn display_name(&self) -> &'static str {
        "Default"
    }

    /// Returns a minimal scan result — just confirms the path exists.
    fn scan(&self, folder_path: &Path) -> Result<ScanResult, StrategyError> {
        if !folder_path.exists() {
            return Err(StrategyError::PathNotFound(
                folder_path.display().to_string(),
            ));
        }
        Ok(ScanResult {
            metadata: HashMap::new(),
            summary: "Default item".to_string(),
        })
    }

    /// Returns the immediate children of the path (one level, no recursion).
    fn get_display_items(&self, folder_path: &Path) -> Result<Vec<DisplayItem>, StrategyError> {
        if !folder_path.exists() {
            return Err(StrategyError::PathNotFound(
                folder_path.display().to_string(),
            ));
        }

        // If it's a file, return just itself.
        if folder_path.is_file() {
            let name = folder_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let size_bytes = folder_path.metadata().ok().map(|m| m.len());
            let modified_at = folder_path
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    let dt: chrono::DateTime<chrono::Utc> = t.into();
                    dt.to_rfc3339()
                });
            return Ok(vec![DisplayItem {
                name,
                path: folder_path.display().to_string(),
                is_dir: false,
                size_bytes,
                modified_at,
            }]);
        }

        // For directories, list immediate children only.
        let mut items = vec![];
        for entry in std::fs::read_dir(folder_path)?.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            let is_dir = path.is_dir();
            let size_bytes = if !is_dir { path.metadata().ok().map(|m| m.len()) } else { None };
            let modified_at = path
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    let dt: chrono::DateTime<chrono::Utc> = t.into();
                    dt.to_rfc3339()
                });
            items.push(DisplayItem { name, path: path.display().to_string(), is_dir, size_bytes, modified_at });
        }
        Ok(items)
    }

    /// Opens the path with the system default application.
    fn get_launch_action(
        &self,
        folder_path: &Path,
        _metadata: &HashMap<String, String>,
    ) -> Option<LaunchAction> {
        Some(LaunchAction {
            action_type: "open_with_default".to_string(),
            target_path: folder_path.display().to_string(),
        })
    }

    /// No metadata fields required for the default strategy.
    fn metadata_schema(&self) -> Vec<MetadataField> {
        vec![]
    }
}
