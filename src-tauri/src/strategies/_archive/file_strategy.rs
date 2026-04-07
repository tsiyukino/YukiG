/// Strategy for a single file item.
///
/// `strategy_type = "file"`. The `folder_path` column in the DB stores the
/// absolute path to the file (not a folder). On scan, detects the file's
/// category from its extension and stores it as `category` metadata, along
/// with `size_bytes` and `modified_at`. The launch action opens the file
/// with the system default application.
use std::collections::HashMap;
use std::path::Path;

use super::{DisplayItem, FolderStrategy, LaunchAction, MetadataField, ScanResult, StrategyError};
use super::files_strategy::{categorize_extension, CATEGORY_DELIMITER};

/// Strategy for single-file items. The stored path is the file itself, not a folder.
pub struct FileStrategy;

impl FolderStrategy for FileStrategy {
    fn strategy_type(&self) -> &'static str {
        "file"
    }

    fn display_name(&self) -> &'static str {
        "File"
    }

    /// Scans the file, detecting its category and basic filesystem metadata.
    ///
    /// # Errors
    /// Returns `StrategyError::PathNotFound` if the file does not exist.
    fn scan(&self, file_path: &Path) -> Result<ScanResult, StrategyError> {
        if !file_path.exists() {
            return Err(StrategyError::PathNotFound(file_path.display().to_string()));
        }
        let ext = file_path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        let category = categorize_extension(&ext).as_str().to_string();

        let mut metadata = HashMap::new();
        metadata.insert("category".to_string(), category.clone());

        if let Ok(m) = file_path.metadata() {
            metadata.insert("size_bytes".to_string(), m.len().to_string());
            if let Ok(modified) = m.modified() {
                let dt: chrono::DateTime<chrono::Utc> = modified.into();
                metadata.insert("modified_at".to_string(), dt.to_rfc3339());
            }
        }

        let summary = format!("{} file", category);
        Ok(ScanResult { metadata, summary })
    }

    /// Returns a single `DisplayItem` representing this file.
    ///
    /// # Errors
    /// Returns `StrategyError::PathNotFound` if the file does not exist.
    fn get_display_items(&self, file_path: &Path) -> Result<Vec<DisplayItem>, StrategyError> {
        if !file_path.exists() {
            return Err(StrategyError::PathNotFound(file_path.display().to_string()));
        }
        let raw_name = file_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let ext = file_path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        let category = categorize_extension(&ext).as_str().to_string();
        let stem = file_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or(raw_name);

        let size_bytes = file_path.metadata().ok().map(|m| m.len());
        let modified_at = file_path
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .map(|t| {
                let dt: chrono::DateTime<chrono::Utc> = t.into();
                dt.to_rfc3339()
            });

        Ok(vec![DisplayItem {
            name: format!("{}{}{}", stem, CATEGORY_DELIMITER, category),
            path: file_path.display().to_string(),
            is_dir: false,
            size_bytes,
            modified_at,
        }])
    }

    /// Returns a launch action that opens the file with the system default application.
    fn get_launch_action(
        &self,
        file_path: &Path,
        _metadata: &HashMap<String, String>,
    ) -> Option<LaunchAction> {
        Some(LaunchAction {
            action_type: "open_with_default".to_string(),
            target_path: file_path.display().to_string(),
        })
    }

    /// Returns an empty schema — file items require no user-configured metadata.
    fn metadata_schema(&self) -> Vec<MetadataField> {
        vec![]
    }
}
