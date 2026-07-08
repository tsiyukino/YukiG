/// Business logic services that combine database access with filesystem operations.
///
/// Phase 2 and beyond: file_watcher, thumbnail generation, preview generation.
/// Currently a placeholder module to satisfy the project structure.
pub mod config;
pub mod file_watcher;
pub mod launcher;
pub mod preview;
pub mod process_tracker;
pub mod session_registry;
pub mod steam_running;
pub mod steam;
pub mod thumbnail;
