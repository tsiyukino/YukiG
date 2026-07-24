/// Screenshot thumbnail cache.
///
/// The screenshots grid must never decode full-resolution images in the
/// webview — a folder of ~2-megapixel shots stalls the UI. This generates a
/// small JPEG thumbnail per source image, caches it on disk, and returns its
/// path so the frontend loads a few-KB file instead of the original.
///
/// Cache invalidation is by fingerprint: the cache filename encodes the
/// source path, its modification time, and its size. If the user replaces or
/// edits an image, the fingerprint changes and a fresh thumbnail is generated;
/// a matching fingerprint is a cache hit and skips decoding entirely.
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

use thiserror::Error;

/// Longest edge of a generated thumbnail, in pixels.
const THUMB_MAX_EDGE: u32 = 400;
/// JPEG quality for generated thumbnails (0–100).
const THUMB_QUALITY: u8 = 78;

/// Errors from thumbnail generation.
#[derive(Debug, Error)]
pub enum ImageThumbError {
    #[error("Source image not found: {0}")]
    NotFound(String),
    #[error("Could not read {path}: {source}")]
    Io {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("Could not decode image {path}: {source}")]
    Decode {
        path: String,
        #[source]
        source: image::ImageError,
    },
}

/// A source image's fingerprint: its size and modification time. Two files with
/// the same path but a different fingerprint get different cache entries, so an
/// edited image is never served from a stale thumbnail.
fn fingerprint(src: &Path) -> Result<(u64, u64), ImageThumbError> {
    let meta = std::fs::metadata(src).map_err(|source| {
        if source.kind() == std::io::ErrorKind::NotFound {
            ImageThumbError::NotFound(src.display().to_string())
        } else {
            ImageThumbError::Io { path: src.display().to_string(), source }
        }
    })?;
    let size = meta.len();
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    Ok((size, mtime))
}

/// The cache filename for a source image at a given fingerprint.
///
/// Hashes the absolute path together with the fingerprint so a moved, resized,
/// or re-saved image maps to a new file. Collisions across different images are
/// astronomically unlikely and would only ever show the wrong thumbnail, never
/// corrupt data.
fn cache_name(src: &Path, (size, mtime): (u64, u64)) -> String {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    src.to_string_lossy().hash(&mut hasher);
    size.hash(&mut hasher);
    mtime.hash(&mut hasher);
    format!("{:016x}.jpg", hasher.finish())
}

/// Returns the cached thumbnail path for `src`, generating it if absent or stale.
///
/// On a fingerprint match the cached file is returned without decoding the
/// source. Otherwise the source is decoded, scaled so its longest edge is at
/// most `THUMB_MAX_EDGE`, and written to the cache as JPEG.
///
/// # Errors
/// Returns `NotFound` if the source is gone, `Io` on a filesystem failure, or
/// `Decode` if the image cannot be decoded.
pub fn get_or_generate(src: &Path, cache_dir: &Path) -> Result<PathBuf, ImageThumbError> {
    let fp = fingerprint(src)?;
    let dest = cache_dir.join(cache_name(src, fp));
    if dest.exists() {
        return Ok(dest);
    }

    let img = image::open(src).map_err(|source| ImageThumbError::Decode {
        path: src.display().to_string(),
        source,
    })?;
    // `thumbnail` preserves aspect ratio, fitting within the box. Downscaling a
    // 1920×1080 shot to 400px wide drops decode cost in the webview ~20x.
    let thumb = img.thumbnail(THUMB_MAX_EDGE, THUMB_MAX_EDGE);

    std::fs::create_dir_all(cache_dir).map_err(|source| ImageThumbError::Io {
        path: cache_dir.display().to_string(),
        source,
    })?;

    // Write via a temp file then rename, so a concurrent reader never sees a
    // half-written JPEG (two grids can request the same thumbnail at once).
    let tmp = dest.with_extension("jpg.tmp");
    let mut buf = std::io::Cursor::new(Vec::new());
    thumb
        .to_rgb8()
        .write_with_encoder(image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, THUMB_QUALITY))
        .map_err(|source| ImageThumbError::Decode { path: src.display().to_string(), source })?;
    std::fs::write(&tmp, buf.into_inner()).map_err(|source| ImageThumbError::Io {
        path: tmp.display().to_string(),
        source,
    })?;
    std::fs::rename(&tmp, &dest).map_err(|source| ImageThumbError::Io {
        path: dest.display().to_string(),
        source,
    })?;

    Ok(dest)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("yukig-imgthumb-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// Writes a small solid-colour PNG and returns its path.
    fn write_png(dir: &Path, name: &str, w: u32, h: u32) -> PathBuf {
        let path = dir.join(name);
        let img = image::RgbImage::from_pixel(w, h, image::Rgb([120, 60, 200]));
        img.save(&path).unwrap();
        path
    }

    #[test]
    fn generates_and_caches_a_thumbnail() {
        let dir = temp_dir("gen");
        let cache = dir.join("cache");
        let src = write_png(&dir, "shot.png", 1600, 900);

        let t1 = get_or_generate(&src, &cache).unwrap();
        assert!(t1.exists(), "thumbnail written");
        // Longest edge is clamped to THUMB_MAX_EDGE.
        let decoded = image::open(&t1).unwrap();
        assert!(decoded.width() <= THUMB_MAX_EDGE && decoded.height() <= THUMB_MAX_EDGE);
        assert_eq!(decoded.width(), THUMB_MAX_EDGE, "wide image scaled to max width");

        // Second call is a cache hit — same path, no regeneration needed.
        let t2 = get_or_generate(&src, &cache).unwrap();
        assert_eq!(t1, t2);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn edited_source_gets_a_new_thumbnail() {
        let dir = temp_dir("edit");
        let cache = dir.join("cache");
        let src = write_png(&dir, "shot.png", 800, 600);
        let t1 = get_or_generate(&src, &cache).unwrap();

        // Change the file's size and mtime by rewriting it larger.
        std::thread::sleep(std::time::Duration::from_millis(1100));
        let mut f = std::fs::OpenOptions::new().write(true).open(&src).unwrap();
        let img = image::RgbImage::from_pixel(801, 600, image::Rgb([10, 10, 10]));
        let mut bytes = std::io::Cursor::new(Vec::new());
        img.write_to(&mut bytes, image::ImageFormat::Png).unwrap();
        f.write_all(&bytes.into_inner()).unwrap();
        drop(f);

        let t2 = get_or_generate(&src, &cache).unwrap();
        assert_ne!(t1, t2, "changed source maps to a new cache file");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn missing_source_errors() {
        let dir = temp_dir("missing");
        let cache = dir.join("cache");
        let src = dir.join("nope.png");
        assert!(matches!(get_or_generate(&src, &cache), Err(ImageThumbError::NotFound(_))));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
