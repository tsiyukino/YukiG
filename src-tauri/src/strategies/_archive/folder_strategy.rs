/// Strategy for a disk-backed folder item.
///
/// `strategy_type = "folder"`. The folder is navigable — its children are
/// managed as child items in the database, not as a flat `DisplayItem` list.
/// On scan, counts files by category at the top level for summary metadata.
/// The launch action opens the folder in Explorer.
use std::collections::HashMap;
use std::path::Path;

use super::{DisplayItem, FolderStrategy, LaunchAction, MetadataField, ScanResult, StrategyError};
use super::files_strategy::scan_folder;

/// Strategy for disk-backed folder items whose children are managed in the DB.
pub struct FolderItemStrategy;

impl FolderStrategy for FolderItemStrategy {
    fn strategy_type(&self) -> &'static str {
        "folder"
    }

    fn display_name(&self) -> &'static str {
        "Folder"
    }

    /// Scans the folder and returns per-category file counts as metadata.
    ///
    /// # Errors
    /// Returns `StrategyError::PathNotFound` if the folder does not exist.
    fn scan(&self, folder_path: &Path) -> Result<ScanResult, StrategyError> {
        scan_folder(folder_path)
    }

    /// Returns an empty list — folder contents are managed as child items in the DB.
    fn get_display_items(&self, _folder_path: &Path) -> Result<Vec<DisplayItem>, StrategyError> {
        Ok(vec![])
    }

    /// Returns a launch action that opens the folder in Explorer.
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

    /// Returns an empty schema — folder items require no user-configured metadata.
    fn metadata_schema(&self) -> Vec<MetadataField> {
        vec![]
    }
}
