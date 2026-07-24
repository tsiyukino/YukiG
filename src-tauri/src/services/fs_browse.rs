/// Read-only folder browsing for game detail views.
///
/// Powers the Screenshots preview grid (listing the images in a user-set
/// folder) and the Mods file tree. Local and Steam games share these — both
/// read whatever folder the user configured, so one implementation serves
/// every platform.
use std::path::Path;

use serde::Serialize;

/// Errors from folder browsing.
#[derive(Debug, thiserror::Error)]
pub enum FsBrowseError {
    #[error("Path not found: {0}")]
    NotFound(String),
    #[error("Not a directory: {0}")]
    NotADirectory(String),
    #[error("Could not read {path}: {source}")]
    Io {
        path: String,
        #[source]
        source: std::io::Error,
    },
}

/// Image file extensions shown in the screenshots grid.
const IMAGE_EXTS: &[&str] = &["png", "jpg", "jpeg", "webp", "gif", "bmp"];

/// Hard cap on nodes returned by `dir_tree`, so a huge mod folder cannot
/// freeze the UI. Subtrees are cut off once the budget runs out and the
/// affected node is marked `truncated`.
const MAX_TREE_NODES: usize = 800;

/// Cap on direct children admitted per directory, so one directory with
/// thousands of files cannot eat the whole node budget by itself.
const MAX_CHILDREN_PER_DIR: usize = 200;

/// An image file inside a screenshots folder.
#[derive(Debug, Clone, Serialize)]
pub struct ImageEntry {
    pub path: String,
    pub filename: String,
    pub size: u64,
    /// Unix timestamp of last modification, 0 if unavailable.
    pub timestamp: u64,
}

/// A node in a folder tree (the Mods preview).
#[derive(Debug, Clone, Serialize)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    /// File size in bytes; 0 for directories.
    pub size: u64,
    pub children: Vec<TreeNode>,
    /// True when children were cut off by the node budget or depth limit.
    pub truncated: bool,
}

/// Ensures `dir` exists and is a directory.
fn check_dir(dir: &Path) -> Result<(), FsBrowseError> {
    if !dir.exists() {
        return Err(FsBrowseError::NotFound(dir.display().to_string()));
    }
    if !dir.is_dir() {
        return Err(FsBrowseError::NotADirectory(dir.display().to_string()));
    }
    Ok(())
}

/// Converts a file's modification time to a Unix timestamp, 0 on failure.
fn mtime_unix(meta: &std::fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Lists the image files directly inside `dir`, newest first.
///
/// Non-recursive — screenshots folders are flat in practice, and recursing
/// into a user-picked folder could walk far more than intended.
///
/// # Errors
/// Returns `FsBrowseError::NotFound` / `NotADirectory` for a bad path, or
/// `Io` if the directory cannot be read.
pub fn list_images(dir: &Path) -> Result<Vec<ImageEntry>, FsBrowseError> {
    check_dir(dir)?;
    let entries = std::fs::read_dir(dir).map_err(|source| FsBrowseError::Io {
        path: dir.display().to_string(),
        source,
    })?;

    let mut images: Vec<ImageEntry> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let is_image = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| IMAGE_EXTS.contains(&e.to_ascii_lowercase().as_str()))
            .unwrap_or(false);
        if !is_image {
            continue;
        }
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        images.push(ImageEntry {
            path: path.display().to_string(),
            filename: entry.file_name().to_string_lossy().to_string(),
            size: meta.len(),
            timestamp: mtime_unix(&meta),
        });
    }
    images.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(images)
}

/// Reads the folder tree under `dir`, up to `max_depth` levels of children.
///
/// Directories sort before files, both case-insensitively by name. The total
/// node count is capped (`MAX_TREE_NODES`); nodes whose children were cut off
/// by the budget or the depth limit are marked `truncated`.
///
/// # Errors
/// Returns `FsBrowseError::NotFound` / `NotADirectory` for a bad path, or
/// `Io` if a directory cannot be read.
pub fn dir_tree(dir: &Path, max_depth: u32) -> Result<TreeNode, FsBrowseError> {
    check_dir(dir)?;
    let mut budget = MAX_TREE_NODES;
    build_node(dir, max_depth, &mut budget)
}

/// Builds one tree node, recursing while depth and the node budget allow.
fn build_node(path: &Path, depth_left: u32, budget: &mut usize) -> Result<TreeNode, FsBrowseError> {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.display().to_string());
    let is_dir = path.is_dir();
    let size = if is_dir {
        0
    } else {
        std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)
    };

    let mut node = TreeNode {
        name,
        path: path.display().to_string(),
        is_dir,
        size,
        children: Vec::new(),
        truncated: false,
    };
    if !is_dir {
        return Ok(node);
    }
    if depth_left == 0 {
        node.truncated = true;
        return Ok(node);
    }

    let entries = std::fs::read_dir(path).map_err(|source| FsBrowseError::Io {
        path: path.display().to_string(),
        source,
    })?;
    let mut paths: Vec<std::path::PathBuf> = entries.flatten().map(|e| e.path()).collect();
    // Directories first, then case-insensitive by name.
    paths.sort_by_key(|p| {
        (
            !p.is_dir(),
            p.file_name()
                .map(|n| n.to_string_lossy().to_lowercase())
                .unwrap_or_default(),
        )
    });

    // Claim budget for ALL direct children up front (breadth before depth):
    // recursing first would let the first subdirectory swallow the whole node
    // budget and starve its siblings, hiding every mod folder after the first.
    let admitted = paths.len().min(*budget).min(MAX_CHILDREN_PER_DIR);
    if admitted < paths.len() {
        node.truncated = true;
    }
    *budget -= admitted;
    paths.truncate(admitted);

    for child in paths {
        node.children.push(build_node(&child, depth_left - 1, budget)?);
    }
    Ok(node)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Creates a unique temp dir for a test and returns its path.
    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "yukig-fsbrowse-{tag}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn list_images_filters_and_ignores_non_images() {
        let dir = temp_dir("img");
        fs::write(dir.join("a.PNG"), b"x").unwrap();
        fs::write(dir.join("b.jpg"), b"xy").unwrap();
        fs::write(dir.join("notes.txt"), b"nope").unwrap();
        fs::create_dir(dir.join("sub")).unwrap();
        fs::write(dir.join("sub").join("nested.png"), b"deep").unwrap();

        let images = list_images(&dir).unwrap();
        let mut names: Vec<&str> = images.iter().map(|i| i.filename.as_str()).collect();
        names.sort();
        assert_eq!(names, vec!["a.PNG", "b.jpg"], "extension filter is case-insensitive, non-recursive");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn list_images_rejects_missing_path() {
        let missing = std::env::temp_dir().join("yukig-fsbrowse-definitely-missing");
        assert!(matches!(list_images(&missing), Err(FsBrowseError::NotFound(_))));
    }

    #[test]
    fn dir_tree_orders_dirs_first_and_respects_depth() {
        let dir = temp_dir("tree");
        fs::write(dir.join("z-file.txt"), b"f").unwrap();
        fs::create_dir(dir.join("a-mods")).unwrap();
        fs::write(dir.join("a-mods").join("mod.esp"), b"m").unwrap();
        fs::create_dir(dir.join("a-mods").join("deep")).unwrap();
        fs::write(dir.join("a-mods").join("deep").join("x.dat"), b"d").unwrap();

        let tree = dir_tree(&dir, 1).unwrap();
        assert!(tree.is_dir);
        assert_eq!(tree.children.len(), 2);
        assert_eq!(tree.children[0].name, "a-mods", "directories sort first");
        assert_eq!(tree.children[1].name, "z-file.txt");
        // Depth 1: the subdirectory itself appears but its children are cut off.
        assert!(tree.children[0].children.is_empty());
        assert!(tree.children[0].truncated, "depth-limited dir is marked truncated");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn dir_tree_first_big_dir_does_not_starve_siblings() {
        let dir = temp_dir("fair");
        // First directory holds more files than the whole node budget…
        fs::create_dir(dir.join("a-huge")).unwrap();
        for i in 0..(MAX_TREE_NODES + 50) {
            fs::write(dir.join("a-huge").join(format!("f{i:04}.dat")), b"x").unwrap();
        }
        // …the later siblings must still be admitted.
        fs::create_dir(dir.join("b-mod")).unwrap();
        fs::create_dir(dir.join("c-mod")).unwrap();

        let tree = dir_tree(&dir, 3).unwrap();
        let names: Vec<&str> = tree.children.iter().map(|c| c.name.as_str()).collect();
        assert_eq!(names, vec!["a-huge", "b-mod", "c-mod"], "all top-level dirs visible");
        let huge = &tree.children[0];
        assert!(huge.truncated, "the oversized dir is marked truncated");
        assert!(huge.children.len() <= MAX_CHILDREN_PER_DIR, "per-dir child cap holds");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn dir_tree_deeper_depth_descends() {
        let dir = temp_dir("tree2");
        fs::create_dir(dir.join("mods")).unwrap();
        fs::write(dir.join("mods").join("a.esp"), b"m").unwrap();

        let tree = dir_tree(&dir, 3).unwrap();
        let mods = &tree.children[0];
        assert_eq!(mods.children.len(), 1);
        assert_eq!(mods.children[0].name, "a.esp");
        assert!(!mods.truncated);
        let _ = fs::remove_dir_all(&dir);
    }
}
