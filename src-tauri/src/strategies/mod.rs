/// Folder strategy system.
///
/// The strategy pattern drives how different folder types are scanned,
/// displayed, and interacted with. Each strategy implements `FolderStrategy`
/// and is registered in `StrategyRegistry`.
///
/// To add a new strategy:
/// 1. Create `new_strategy.rs` implementing `FolderStrategy`
/// 2. Register it in `StrategyRegistry::new()` below
/// 3. Create `src/components/strategies/NewItemView.tsx` in the frontend
/// 4. Update `docs/STRATEGIES.md`
use std::collections::HashMap;
use std::path::Path;
use thiserror::Error;

pub mod default_strategy;
pub mod game_strategy;
pub mod steam_strategy;

/// Errors that can occur during strategy operations.
#[derive(Debug, Error)]
pub enum StrategyError {
    #[error("Path not found: {0}")]
    PathNotFound(String),
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("Strategy not found: {0}")]
    NotFound(String),
}

/// Structured metadata returned by a strategy scan.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ScanResult {
    /// Key-value metadata discovered during the scan.
    pub metadata: HashMap<String, String>,
    /// Human-readable summary of what was found.
    pub summary: String,
}

/// A file or folder entry to display in the item view.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct DisplayItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size_bytes: Option<u64>,
    pub modified_at: Option<String>,
}

/// The primary action to perform when launching an item.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct LaunchAction {
    /// The type of launch action: "run_exe" or "open_with_default".
    pub action_type: String,
    /// The target path (exe path or file path).
    pub target_path: String,
}

/// A metadata field the strategy expects the user to configure.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct MetadataField {
    pub key: String,
    pub label: String,
    pub required: bool,
    pub field_type: String,
}

/// Defines how a folder type is scanned, displayed, and interacted with.
///
/// All strategies must implement this trait. Register new strategies
/// in `StrategyRegistry::new()`.
pub trait FolderStrategy: Send + Sync {
    /// Returns the unique string identifier for this strategy.
    /// Must match the `strategy_type` value stored in the database.
    fn strategy_type(&self) -> &'static str;

    /// Returns a human-readable name for display in the UI.
    fn display_name(&self) -> &'static str;

    /// Scans a folder and returns structured metadata.
    /// Called when an item is first added and during manual rescan.
    fn scan(&self, folder_path: &Path) -> Result<ScanResult, StrategyError>;

    /// Returns the list of files/entries to display in the UI.
    fn get_display_items(&self, folder_path: &Path) -> Result<Vec<DisplayItem>, StrategyError>;

    /// Returns the primary action for this item type, or None if not applicable.
    fn get_launch_action(
        &self,
        folder_path: &Path,
        metadata: &HashMap<String, String>,
    ) -> Option<LaunchAction>;

    /// Returns metadata keys this strategy expects the user to configure.
    fn metadata_schema(&self) -> Vec<MetadataField>;
}

/// Registry of all available folder strategies.
///
/// The registry owns a boxed instance of each strategy and looks them up
/// by their `strategy_type` string.
pub struct StrategyRegistry {
    strategies: HashMap<&'static str, Box<dyn FolderStrategy>>,
}

impl StrategyRegistry {
    /// Creates the registry and registers all built-in strategies.
    pub fn new() -> Self {
        let mut strategies: HashMap<&'static str, Box<dyn FolderStrategy>> = HashMap::new();

        let default = default_strategy::DefaultStrategy;
        strategies.insert(default.strategy_type(), Box::new(default));

        let game = game_strategy::GameStrategy;
        strategies.insert(game.strategy_type(), Box::new(game));

        let steam = steam_strategy::SteamGameStrategy;
        strategies.insert(steam.strategy_type(), Box::new(steam));

        Self { strategies }
    }

    /// Returns the strategy for the given type identifier, or an error.
    pub fn get(&self, strategy_type: &str) -> Result<&dyn FolderStrategy, StrategyError> {
        self.strategies
            .get(strategy_type)
            .map(|s| s.as_ref())
            .ok_or_else(|| StrategyError::NotFound(strategy_type.to_string()))
    }

    /// Returns all registered strategies as a list of (type, display_name) pairs.
    pub fn list(&self) -> Vec<(&str, &str)> {
        self.strategies
            .values()
            .map(|s| (s.strategy_type(), s.display_name()))
            .collect()
    }
}

impl Default for StrategyRegistry {
    fn default() -> Self {
        Self::new()
    }
}
