/// File preview generation service.
///
/// Generates in-app previews for images, text files, and PDFs so the user can
/// inspect a file without opening it in an external application.
///
/// - **Images** (jpg, png, gif, webp, bmp, svg): returned as base64-encoded data URIs.
/// - **Text** (txt, md, rs, ts, js, json, toml, yaml, yml, xml, html, css, csv, log):
///   returned as raw UTF-8, truncated to `MAX_TEXT_BYTES` to keep IPC payloads small.
/// - **PDF**: returned as base64 so the frontend can embed it in an `<object>` tag.
/// - Everything else: returns `PreviewKind::Unsupported`.
use std::fs;
use std::io::Read;
use std::path::Path;

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Maximum bytes of text content returned to the frontend.
const MAX_TEXT_BYTES: usize = 32_768; // 32 KiB

/// Errors that can occur during preview generation.
#[derive(Debug, Error)]
pub enum PreviewError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("File is not valid UTF-8")]
    NotUtf8,
}

/// Describes what kind of preview content is available.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PreviewKind {
    /// Base64-encoded image data with MIME type (e.g. `image/png`).
    Image,
    /// Raw UTF-8 text content (may be truncated).
    Text,
    /// Base64-encoded PDF data.
    Pdf,
    /// File type is not previewable.
    Unsupported,
}

/// The preview payload returned to the frontend.
#[derive(Debug, Serialize, Deserialize)]
pub struct FilePreview {
    /// What type of content this preview contains.
    pub kind: PreviewKind,
    /// For images/PDFs: base64-encoded bytes. For text: raw UTF-8.
    /// Empty string when `kind` is `Unsupported`.
    pub content: String,
    /// MIME type string (e.g. `"image/png"`, `"text/plain"`, `"application/pdf"`).
    /// Empty string when `kind` is `Unsupported`.
    pub mime_type: String,
    /// True if text content was truncated to fit `MAX_TEXT_BYTES`.
    pub truncated: bool,
}

/// Generates a preview for the file at `path`.
///
/// Determines the preview kind from the file extension. For unsupported types
/// returns a `FilePreview` with `kind: Unsupported` rather than an error.
///
/// # Errors
/// Returns `PreviewError::Io` if the file cannot be read.
/// Returns `PreviewError::NotUtf8` if a text file contains invalid UTF-8.
pub fn generate(path: &Path) -> Result<FilePreview, PreviewError> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "jpg" | "jpeg" => encode_image(path, "image/jpeg"),
        "png" => encode_image(path, "image/png"),
        "gif" => encode_image(path, "image/gif"),
        "webp" => encode_image(path, "image/webp"),
        "bmp" => encode_image(path, "image/bmp"),
        "svg" => encode_image(path, "image/svg+xml"),
        "pdf" => encode_binary(path, "application/pdf"),
        "txt" | "md" | "rs" | "ts" | "tsx" | "js" | "jsx" | "json" | "toml" | "yaml" | "yml"
        | "xml" | "html" | "htm" | "css" | "csv" | "log" | "ini" | "cfg" => read_text(path),
        _ => Ok(FilePreview {
            kind: PreviewKind::Unsupported,
            content: String::new(),
            mime_type: String::new(),
            truncated: false,
        }),
    }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

fn encode_image(path: &Path, mime: &str) -> Result<FilePreview, PreviewError> {
    let bytes = fs::read(path)?;
    Ok(FilePreview {
        kind: PreviewKind::Image,
        content: base64_encode(&bytes),
        mime_type: mime.to_string(),
        truncated: false,
    })
}

fn encode_binary(path: &Path, mime: &str) -> Result<FilePreview, PreviewError> {
    let bytes = fs::read(path)?;
    Ok(FilePreview {
        kind: PreviewKind::Pdf,
        content: base64_encode(&bytes),
        mime_type: mime.to_string(),
        truncated: false,
    })
}

fn read_text(path: &Path) -> Result<FilePreview, PreviewError> {
    let mut file = fs::File::open(path)?;
    let mut buf = vec![0u8; MAX_TEXT_BYTES + 1];
    let n = file.read(&mut buf)?;
    let truncated = n > MAX_TEXT_BYTES;
    let slice = &buf[..n.min(MAX_TEXT_BYTES)];

    let text = std::str::from_utf8(slice)
        .map_err(|_| PreviewError::NotUtf8)?
        .to_string();

    Ok(FilePreview {
        kind: PreviewKind::Text,
        content: text,
        mime_type: "text/plain".to_string(),
        truncated,
    })
}

/// Encodes `bytes` to a standard base64 string without padding stripped.
///
/// Uses the alphabet `A-Z a-z 0-9 + /` with `=` padding. The frontend wraps
/// this in a data URI for images: `data:{mime};base64,{content}`.
fn base64_encode(bytes: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(CHARS[((n >> 18) & 63) as usize] as char);
        out.push(CHARS[((n >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 { CHARS[((n >> 6) & 63) as usize] as char } else { '=' });
        out.push(if chunk.len() > 2 { CHARS[(n & 63) as usize] as char } else { '=' });
    }
    out
}
