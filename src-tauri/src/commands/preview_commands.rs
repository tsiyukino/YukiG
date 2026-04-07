/// Tauri command handlers for file preview operations.
///
/// Exposes the preview service to the frontend. The frontend uses the returned
/// `FilePreview` to render images, text, or PDFs inline in the item detail view.
use crate::services::preview::{self, FilePreview};

/// Generates a preview for a single file.
///
/// Returns a `FilePreview` describing the kind of content, the content itself
/// (base64 for binary, raw UTF-8 for text), and the MIME type. When the file
/// type is not previewable, `kind` is `"unsupported"` and `content` is empty.
///
/// # Arguments
/// * `file_path` - Absolute path to the file to preview
///
/// # Errors
/// Returns an error string if the file cannot be read.
#[tauri::command]
pub fn preview_get(file_path: String) -> Result<FilePreview, String> {
    preview::generate(std::path::Path::new(&file_path)).map_err(|e| e.to_string())
}
