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

/// Cap on direct children returned per directory, so one directory with
/// thousands of entries cannot flood the UI in a single expand.
const MAX_CHILDREN_PER_DIR: usize = 500;

/// An image file inside a screenshots folder.
#[derive(Debug, Clone, Serialize)]
pub struct ImageEntry {
    pub path: String,
    pub filename: String,
    pub size: u64,
    /// Unix timestamp of last modification, 0 if unavailable.
    pub timestamp: u64,
}

/// One entry in a directory listing (the Mods tree, loaded on demand).
#[derive(Debug, Clone, Serialize)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    /// File size in bytes; 0 for directories.
    pub size: u64,
}

/// One directory's direct children plus whether the listing was capped.
#[derive(Debug, Clone, Serialize)]
pub struct DirListing {
    pub entries: Vec<TreeNode>,
    /// True when the directory had more than `MAX_CHILDREN_PER_DIR` entries.
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

/// Lists one directory's direct children (files and folders), not recursive.
///
/// This is the unit the Mods tree loads on demand: the frontend fetches a
/// directory's children only when the user expands it, so a huge mod folder is
/// never walked several levels deep up front. `file_type()` from the directory
/// read supplies is-dir without a separate `stat` per entry — the repeated
/// `stat` calls in a recursive walk were what made large mod folders stall.
///
/// Directories sort before files, both case-insensitively by name. At most
/// `MAX_CHILDREN_PER_DIR` entries are returned; if more exist the last node is
/// dropped and the caller learns of it via `truncated` on the returned struct.
///
/// # Errors
/// Returns `FsBrowseError::NotFound` / `NotADirectory` for a bad path, or
/// `Io` if the directory cannot be read.
pub fn dir_children(dir: &Path) -> Result<DirListing, FsBrowseError> {
    check_dir(dir)?;
    let read = std::fs::read_dir(dir).map_err(|source| FsBrowseError::Io {
        path: dir.display().to_string(),
        source,
    })?;

    let mut nodes: Vec<TreeNode> = Vec::new();
    for entry in read.flatten() {
        // file_type() comes from the directory scan and avoids a per-entry stat.
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        // Size is only read for files, and only via the entry's own metadata.
        let size = if is_dir {
            0
        } else {
            entry.metadata().map(|m| m.len()).unwrap_or(0)
        };
        nodes.push(TreeNode {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().display().to_string(),
            is_dir,
            size,
        });
    }

    // Directories first, then case-insensitive by name.
    nodes.sort_by(|a, b| {
        (!a.is_dir, a.name.to_lowercase()).cmp(&(!b.is_dir, b.name.to_lowercase()))
    });

    let truncated = nodes.len() > MAX_CHILDREN_PER_DIR;
    nodes.truncate(MAX_CHILDREN_PER_DIR);
    Ok(DirListing { entries: nodes, truncated })
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
    fn dir_children_orders_dirs_first_and_is_shallow() {
        let dir = temp_dir("tree");
        fs::write(dir.join("z-file.txt"), b"ff").unwrap();
        fs::create_dir(dir.join("a-mods")).unwrap();
        fs::write(dir.join("a-mods").join("mod.esp"), b"m").unwrap();

        let listing = dir_children(&dir).unwrap();
        assert!(!listing.truncated);
        let names: Vec<&str> = listing.entries.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["a-mods", "z-file.txt"], "directories sort first, then by name");
        assert!(listing.entries[0].is_dir);
        assert_eq!(listing.entries[1].size, 2, "file size is reported");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn dir_children_reads_one_level_only() {
        // A nested tree: dir_children must return only the top level, never
        // descend — that shallow read is what keeps huge mod folders fast.
        let dir = temp_dir("tree2");
        fs::create_dir(dir.join("mods")).unwrap();
        fs::write(dir.join("mods").join("a.esp"), b"m").unwrap();

        let listing = dir_children(&dir).unwrap();
        assert_eq!(listing.entries.len(), 1);
        assert_eq!(listing.entries[0].name, "mods");
        assert!(listing.entries[0].is_dir);
        // The child's own children are fetched by a separate call, on expand.
        let sub = dir_children(std::path::Path::new(&listing.entries[0].path)).unwrap();
        assert_eq!(sub.entries.len(), 1);
        assert_eq!(sub.entries[0].name, "a.esp");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn dir_children_caps_large_directories() {
        let dir = temp_dir("big");
        for i in 0..(MAX_CHILDREN_PER_DIR + 25) {
            fs::write(dir.join(format!("f{i:04}.dat")), b"x").unwrap();
        }
        let listing = dir_children(&dir).unwrap();
        assert_eq!(listing.entries.len(), MAX_CHILDREN_PER_DIR);
        assert!(listing.truncated, "oversized directory reports truncation");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn dir_children_rejects_missing_path() {
        let missing = std::env::temp_dir().join("yukig-fsbrowse-no-such-dir");
        assert!(matches!(dir_children(&missing), Err(FsBrowseError::NotFound(_))));
    }
}
