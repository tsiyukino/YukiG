/// Thumbnail generation and caching service.
///
/// Scans an item's folder for the first image file and caches a copy in the
/// app data directory under `thumbnails/{item_id}.{ext}`. Returns the cached
/// path so the frontend can display it via `convertFileSrc`.
use std::fs;
use std::path::{Path, PathBuf};

use thiserror::Error;

/// Errors that can occur during thumbnail operations.
#[derive(Debug, Error)]
pub enum ThumbnailError {
    #[error("No image found in folder: {0}")]
    NoImageFound(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Image extensions recognised as thumbnails (lowercase, without leading dot).
const IMAGE_EXTS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp", "bmp"];

/// Returns the path of the cached thumbnail for an item, generating it if needed.
///
/// If the thumbnail already exists on disk, returns its path immediately without
/// rescanning the folder. Call `invalidate` first to force a refresh.
///
/// # Arguments
/// * `folder_path` - Absolute path to the item's folder
/// * `item_id`     - UUID of the item (used as the cache filename)
/// * `cache_dir`   - Directory to store cached thumbnails (app data / thumbnails)
///
/// # Errors
/// Returns `ThumbnailError::NoImageFound` if the folder contains no image files.
/// Returns `ThumbnailError::Io` on any filesystem failure.
pub fn get_or_generate(
    folder_path: &Path,
    item_id: &str,
    cache_dir: &Path,
) -> Result<PathBuf, ThumbnailError> {
    // Check each possible extension for a cached file before scanning.
    for ext in IMAGE_EXTS {
        let cached = cache_dir.join(format!("{}.{}", item_id, ext));
        if cached.exists() {
            return Ok(cached);
        }
    }

    // No cache hit — scan the folder for the first image.
    let source = find_first_image(folder_path)?;
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();

    fs::create_dir_all(cache_dir)?;
    let dest = cache_dir.join(format!("{}.{}", item_id, ext));
    fs::copy(&source, &dest)?;

    Ok(dest)
}

/// Copies an image from `source_path` into the thumbnail cache for the given item.
///
/// Invalidates any existing cached thumbnail first, then copies the source image
/// into the cache directory with the item's UUID as the filename. The source file
/// is not modified.
///
/// # Arguments
/// * `source_path` - Absolute path to the image file to use as the thumbnail
/// * `item_id`     - UUID of the item
/// * `cache_dir`   - Directory to store cached thumbnails (app data / thumbnails)
///
/// # Errors
/// Returns `ThumbnailError::Io` if the copy fails or the cache dir cannot be created.
pub fn set_from_path(
    source_path: &Path,
    item_id: &str,
    cache_dir: &Path,
) -> Result<PathBuf, ThumbnailError> {
    // Remove any existing cached thumbnail before writing the new one.
    invalidate(item_id, cache_dir)?;

    let ext = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();

    fs::create_dir_all(cache_dir)?;
    let dest = cache_dir.join(format!("{}.{}", item_id, ext));
    fs::copy(source_path, &dest)?;

    Ok(dest)
}

/// Removes the cached thumbnail for an item so it is regenerated on next access.
///
/// Silently succeeds if no cached file exists.
///
/// # Errors
/// Returns `ThumbnailError::Io` if the file exists but cannot be deleted.
pub fn invalidate(item_id: &str, cache_dir: &Path) -> Result<(), ThumbnailError> {
    for ext in IMAGE_EXTS {
        let cached = cache_dir.join(format!("{}.{}", item_id, ext));
        if cached.exists() {
            fs::remove_file(&cached)?;
        }
    }
    Ok(())
}

/// Walks `folder_path` (one level deep) and returns the first image file found.
///
/// Searches only the top-level directory to keep scanning fast. For game
/// folders this is sufficient because cover art is typically at the root.
fn find_first_image(folder_path: &Path) -> Result<PathBuf, ThumbnailError> {
    let entries = fs::read_dir(folder_path)
        .map_err(|_| ThumbnailError::NoImageFound(folder_path.display().to_string()))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if IMAGE_EXTS.contains(&ext.to_lowercase().as_str()) {
                    return Ok(path);
                }
            }
        }
    }

    Err(ThumbnailError::NoImageFound(
        folder_path.display().to_string(),
    ))
}
