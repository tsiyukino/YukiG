/// Tauri commands for smart game path suggestions.
///
/// Scans a game folder recursively (up to a capped depth) and returns
/// ranked candidate lists for the executable, mod folder, and screenshot
/// folder. The frontend shows the top few immediately and lets the user
/// expand to see more.
use std::path::{Path, PathBuf};
use serde::Serialize;

/// A single ranked suggestion for one of the metadata fields.
#[derive(Debug, Serialize, Clone)]
pub struct PathSuggestion {
    /// Absolute path to the candidate.
    pub path: String,
    /// Display name (file name / folder name only).
    pub name: String,
    /// Depth relative to the game root (0 = root-level child).
    pub depth: u32,
    /// File size in bytes for exe candidates; 0 for folders.
    pub size_bytes: u64,
}

/// All suggestion lists returned for a game folder.
#[derive(Debug, Serialize)]
pub struct GameSuggestions {
    pub executables: Vec<PathSuggestion>,
    pub mod_folders: Vec<PathSuggestion>,
    pub screenshot_folders: Vec<PathSuggestion>,
}

/// Folder name patterns that suggest a mod directory (lower-cased match).
const MOD_FOLDER_PATTERNS: &[&str] = &[
    "mods", "mod", "plugins", "addons", "addon", "extensions",
    "workshop", "modsdata", "dlc",
];

/// Folder name patterns that suggest a screenshot directory (lower-cased match).
const SCREENSHOT_FOLDER_PATTERNS: &[&str] = &[
    "screenshots", "screenshot", "captures", "capture",
    "photos", "photos", "screens", "pictures", "images",
];

/// Hard cap on how deep the user can request to scan.
const MAX_DEPTH: u32 = 4;

/// Scans a game folder at exactly one depth layer and returns path suggestions.
///
/// `scan_depth` controls which layer to scan:
/// - 0 = root folder contents only (fastest, covers 99% of games)
/// - 1 = one level of subdirectories, and so on up to MAX_DEPTH
///
/// Only entries at exactly `scan_depth` are returned, so repeated calls with
/// increasing depth values progressively reveal deeper candidates without
/// re-scanning already-returned layers.
///
/// # Errors
/// Returns an error string if the folder does not exist or cannot be read.
#[tauri::command]
pub fn game_suggest_paths(
    folder_path: String,
    scan_depth: u32,
) -> Result<GameSuggestions, String> {
    let root = Path::new(&folder_path);
    if !root.exists() {
        return Err(format!("Path not found: {}", folder_path));
    }

    let depth = scan_depth.min(MAX_DEPTH);

    let mut executables: Vec<PathSuggestion> = Vec::new();
    let mut mod_folders: Vec<PathSuggestion> = Vec::new();
    let mut screenshot_folders: Vec<PathSuggestion> = Vec::new();

    walk_at_depth(root, 0, depth, &mut executables, &mut mod_folders, &mut screenshot_folders);

    // Within this layer: larger executables ranked first (more likely to be the game).
    executables.sort_by_key(|s| std::cmp::Reverse(s.size_bytes));

    Ok(GameSuggestions {
        executables,
        mod_folders,
        screenshot_folders,
    })
}

/// Walks the folder tree, collecting candidates only at exactly `target_depth`.
///
/// At each level above `target_depth` we descend into subdirectories without
/// collecting anything. At `target_depth` we collect and stop recursing.
/// This avoids touching any content deeper than needed.
fn walk_at_depth(
    dir: &Path,
    current_depth: u32,
    target_depth: u32,
    executables: &mut Vec<PathSuggestion>,
    mod_folders: &mut Vec<PathSuggestion>,
    screenshot_folders: &mut Vec<PathSuggestion>,
) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let mut subdirs: Vec<PathBuf> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        let raw_name = entry.file_name();
        let name_str = raw_name.to_string_lossy().into_owned();

        if current_depth == target_depth {
            // Collect candidates at exactly this depth.
            if path.is_file() {
                if name_str.to_lowercase().ends_with(".exe") {
                    let size_bytes = path.metadata().map(|m| m.len()).unwrap_or(0);
                    executables.push(PathSuggestion {
                        path: path.display().to_string(),
                        name: name_str,
                        depth: current_depth,
                        size_bytes,
                    });
                }
            } else if path.is_dir() {
                let lower = name_str.to_lowercase();
                if MOD_FOLDER_PATTERNS.contains(&lower.as_str()) {
                    mod_folders.push(PathSuggestion {
                        path: path.display().to_string(),
                        name: name_str.clone(),
                        depth: current_depth,
                        size_bytes: 0,
                    });
                }
                if SCREENSHOT_FOLDER_PATTERNS.contains(&lower.as_str()) {
                    screenshot_folders.push(PathSuggestion {
                        path: path.display().to_string(),
                        name: name_str.clone(),
                        depth: current_depth,
                        size_bytes: 0,
                    });
                }
            }
        } else if path.is_dir() {
            // Not yet at target depth — queue subdirectory for descent.
            subdirs.push(path);
        }
    }

    // Only recurse if we haven't reached the target depth yet.
    if current_depth < target_depth {
        for subdir in subdirs {
            walk_at_depth(
                &subdir,
                current_depth + 1,
                target_depth,
                executables,
                mod_folders,
                screenshot_folders,
            );
        }
    }
}
