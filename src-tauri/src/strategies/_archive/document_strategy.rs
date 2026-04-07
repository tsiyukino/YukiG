/// Strategy for document/file collection folders.
///
/// Recursively lists all files under the folder. Opens files with the
/// system default application. No special metadata required.
use std::collections::HashMap;
use std::path::Path;

use super::{
    DisplayItem, FolderStrategy, LaunchAction, MetadataField, ScanResult, StrategyError,
};

/// Maximum recursion depth for document folder scanning.
const MAX_SCAN_DEPTH: u32 = 5;

/// Strategy for folders that contain documents or files.
pub struct DocumentStrategy;

impl FolderStrategy for DocumentStrategy {
    fn strategy_type(&self) -> &'static str {
        "document"
    }

    fn display_name(&self) -> &'static str {
        "Document Collection"
    }

    /// Scans the folder recursively and returns a count summary.
    fn scan(&self, folder_path: &Path) -> Result<ScanResult, StrategyError> {
        if !folder_path.exists() {
            return Err(StrategyError::PathNotFound(
                folder_path.display().to_string(),
            ));
        }

        let items = collect_files(folder_path, 0)?;
        let file_count = items.iter().filter(|i| !i.is_dir).count();
        let summary = format!("Found {} file(s)", file_count);

        Ok(ScanResult {
            metadata: HashMap::new(),
            summary,
        })
    }

    /// Returns all files and folders recursively up to `MAX_SCAN_DEPTH`.
    fn get_display_items(&self, folder_path: &Path) -> Result<Vec<DisplayItem>, StrategyError> {
        if !folder_path.exists() {
            return Err(StrategyError::PathNotFound(
                folder_path.display().to_string(),
            ));
        }
        collect_files(folder_path, 0)
    }

    /// Returns an action to open the folder path with the system default app.
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

    fn metadata_schema(&self) -> Vec<MetadataField> {
        vec![]
    }
}

/// Recursively collects all files and directories up to the given depth.
fn collect_files(dir: &Path, depth: u32) -> Result<Vec<DisplayItem>, StrategyError> {
    if depth >= MAX_SCAN_DEPTH {
        return Ok(vec![]);
    }

    let mut items = vec![];
    let entries = std::fs::read_dir(dir)?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let is_dir = path.is_dir();

        let size_bytes = if !is_dir {
            path.metadata().ok().map(|m| m.len())
        } else {
            None
        };

        let modified_at = path
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .map(|t| {
                let dt: chrono::DateTime<chrono::Utc> = t.into();
                dt.to_rfc3339()
            });

        items.push(DisplayItem {
            name,
            path: path.display().to_string(),
            is_dir,
            size_bytes,
            modified_at,
        });

        if is_dir {
            let mut sub = collect_files(&path, depth + 1)?;
            items.append(&mut sub);
        }
    }

    Ok(items)
}
