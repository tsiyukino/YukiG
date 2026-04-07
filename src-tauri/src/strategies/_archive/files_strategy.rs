/// Auto-detect file strategy and all file-type sub-strategies.
///
/// The `"files"` strategy_type is the "Auto Detect" entry — it scans all files
/// in the folder regardless of format and categorizes them. Each sub-strategy
/// (`"files/image"`, `"files/pdf"`, `"files/audio"`, etc.) is a full, independent
/// strategy that only shows files of its own category. All sub-strategies share
/// the same scan, categorization, and display-item logic from this module.
///
/// Sub-strategies are registered in the `StrategyRegistry` alongside top-level
/// strategies but are grouped under "Files" in the frontend dropdown via the
/// `group` convention: strategy types containing `/` belong to the group named
/// by the prefix before `/`.
use std::collections::HashMap;
use std::path::Path;

use super::{
    DisplayItem, FolderStrategy, LaunchAction, MetadataField, ScanResult, StrategyError,
};

/// Maximum recursion depth for all file strategies.
pub const MAX_SCAN_DEPTH: u32 = 5;

/// Delimiter embedded in `DisplayItem.name` to carry the category hint.
///
/// `\x00` never appears in a valid Windows filename, so it is safe as a separator.
pub const CATEGORY_DELIMITER: char = '\x00';

// ─── Category ────────────────────────────────────────────────────────────────

/// Broad category for a detected file type.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FileCategory {
    Image,
    Pdf,
    Document,
    Spreadsheet,
    Presentation,
    Archive,
    Text,
    Markdown,
    Audio,
    Video,
    Ebook,
    Font,
    Data,
    Unknown,
}

impl FileCategory {
    /// Returns the canonical string identifier for this category.
    pub fn as_str(&self) -> &'static str {
        match self {
            FileCategory::Image => "image",
            FileCategory::Pdf => "pdf",
            FileCategory::Document => "document",
            FileCategory::Spreadsheet => "spreadsheet",
            FileCategory::Presentation => "presentation",
            FileCategory::Archive => "archive",
            FileCategory::Text => "text",
            FileCategory::Markdown => "markdown",
            FileCategory::Audio => "audio",
            FileCategory::Video => "video",
            FileCategory::Ebook => "ebook",
            FileCategory::Font => "font",
            FileCategory::Data => "data",
            FileCategory::Unknown => "unknown",
        }
    }

    /// Parses a category string back into a `FileCategory`.
    pub fn from_str(s: &str) -> Self {
        match s {
            "image" => FileCategory::Image,
            "pdf" => FileCategory::Pdf,
            "document" => FileCategory::Document,
            "spreadsheet" => FileCategory::Spreadsheet,
            "presentation" => FileCategory::Presentation,
            "archive" => FileCategory::Archive,
            "text" => FileCategory::Text,
            "markdown" => FileCategory::Markdown,
            "audio" => FileCategory::Audio,
            "video" => FileCategory::Video,
            "ebook" => FileCategory::Ebook,
            "font" => FileCategory::Font,
            "data" => FileCategory::Data,
            _ => FileCategory::Unknown,
        }
    }
}

/// Classifies a lower-case file extension into a `FileCategory`.
pub fn categorize_extension(ext: &str) -> FileCategory {
    match ext {
        // Images
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" | "tiff" | "tif" | "svg" | "ico"
        | "avif" | "heic" | "heif" | "jxl" | "raw" | "cr2" | "nef" | "arw" | "dng" => {
            FileCategory::Image
        }

        // PDFs
        "pdf" => FileCategory::Pdf,

        // Word-processor documents
        "doc" | "docx" | "odt" | "rtf" | "wps" | "wpd" => FileCategory::Document,

        // Spreadsheets
        "xls" | "xlsx" | "ods" | "csv" | "tsv" | "numbers" => FileCategory::Spreadsheet,

        // Presentations
        "ppt" | "pptx" | "odp" | "key" => FileCategory::Presentation,

        // Archives
        "zip" | "7z" | "rar" | "tar" | "gz" | "bz2" | "xz" | "zst" | "lz4" | "lzma"
        | "cab" | "iso" | "dmg" | "tgz" | "tbz2" | "txz" => FileCategory::Archive,

        // Plain text
        "txt" | "log" | "ini" | "cfg" | "conf" | "env" | "properties" | "toml" | "yaml"
        | "yml" | "xml" | "json" | "jsonc" | "jsonl" | "ndjson" => FileCategory::Text,

        // Markdown / lightweight markup
        "md" | "markdown" | "mdx" | "rst" | "adoc" | "asciidoc" | "org" => FileCategory::Markdown,

        // Audio
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "opus" | "m4a" | "wma" | "aiff" | "ape"
        | "mid" | "midi" => FileCategory::Audio,

        // Video
        "mp4" | "mkv" | "avi" | "mov" | "wmv" | "flv" | "webm" | "m4v" | "mpeg" | "mpg"
        | "3gp" | "ts" | "mts" | "m2ts" => FileCategory::Video,

        // Ebooks
        "epub" | "mobi" | "azw" | "azw3" | "lit" | "fb2" | "djvu" | "cbz" | "cbr" => {
            FileCategory::Ebook
        }

        // Fonts
        "ttf" | "otf" | "woff" | "woff2" | "eot" => FileCategory::Font,

        // Data / databases
        "db" | "sqlite" | "sqlite3" | "mdb" | "accdb" | "parquet" | "feather" | "hdf5"
        | "h5" => FileCategory::Data,

        _ => FileCategory::Unknown,
    }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/// Builds a `DisplayItem` whose `name` encodes `stem\x00category`.
///
/// The file extension is stripped from the display name — it is always
/// recoverable from `path`. Directories keep their full name.
fn make_display_item(
    raw_name: &str,
    path: &Path,
    is_dir: bool,
    size_bytes: Option<u64>,
    modified_at: Option<String>,
) -> DisplayItem {
    let category = if is_dir {
        "dir".to_string()
    } else {
        let ext = path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        categorize_extension(&ext).as_str().to_string()
    };

    // Strip extension for files; keep full name for directories.
    let display_name = if is_dir {
        raw_name.to_string()
    } else {
        Path::new(raw_name)
            .file_stem()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| raw_name.to_string())
    };

    DisplayItem {
        name: format!("{}{}{}", display_name, CATEGORY_DELIMITER, category),
        path: path.display().to_string(),
        is_dir,
        size_bytes,
        modified_at,
    }
}

/// Recursively collects all files up to `MAX_SCAN_DEPTH`.
///
/// Optionally filters to a single `FileCategory` — pass `None` to collect all.
pub fn collect_files(
    dir: &Path,
    depth: u32,
    filter: Option<&FileCategory>,
) -> Result<Vec<DisplayItem>, StrategyError> {
    if depth >= MAX_SCAN_DEPTH {
        return Ok(vec![]);
    }

    let mut items = vec![];
    let entries = std::fs::read_dir(dir)?;

    for entry in entries.flatten() {
        let path = entry.path();
        let raw_name = entry.file_name().to_string_lossy().to_string();
        let is_dir = path.is_dir();

        if !is_dir {
            let ext = path
                .extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            let cat = categorize_extension(&ext);

            // Apply category filter when set.
            if let Some(f) = filter {
                if &cat != f {
                    continue;
                }
            }
        }

        let size_bytes = if !is_dir {
            path.metadata().ok().map(|m| m.len())
        } else {
            None
        };

        let modified_at = path
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .map(|t| {
                let dt: chrono::DateTime<chrono::Utc> = t.into();
                dt.to_rfc3339()
            });

        items.push(make_display_item(
            &raw_name,
            &path,
            is_dir,
            size_bytes,
            modified_at,
        ));

        if is_dir {
            let mut sub = collect_files(&path, depth + 1, filter)?;
            items.append(&mut sub);
        }
    }

    Ok(items)
}

/// Scans a folder and returns per-category file counts as metadata.
pub fn scan_folder(folder_path: &Path) -> Result<ScanResult, StrategyError> {
    if !folder_path.exists() {
        return Err(StrategyError::PathNotFound(
            folder_path.display().to_string(),
        ));
    }

    let items = collect_files(folder_path, 0, None)?;
    let mut counts: HashMap<String, usize> = HashMap::new();

    for item in &items {
        if !item.is_dir {
            // Category is embedded after the delimiter in the name.
            let cat_str = item
                .name
                .split(CATEGORY_DELIMITER)
                .nth(1)
                .unwrap_or("unknown")
                .to_string();
            *counts.entry(cat_str).or_insert(0) += 1;
        }
    }

    let file_total = items.iter().filter(|i| !i.is_dir).count();
    let summary = if file_total == 0 {
        "Empty folder".to_string()
    } else {
        let mut parts: Vec<String> = counts
            .iter()
            .filter(|(_, &v)| v > 0)
            .map(|(k, v)| format!("{} {}", v, k))
            .collect();
        parts.sort();
        format!("{} file(s): {}", file_total, parts.join(", "))
    };

    let metadata: HashMap<String, String> = counts
        .into_iter()
        .map(|(k, v)| (format!("count_{}", k), v.to_string()))
        .collect();

    Ok(ScanResult { metadata, summary })
}

// ─── FilesStrategy ("files" — Auto Detect, shows all) ────────────────────────

/// Auto-detect strategy: scans all files in the folder and displays every format.
pub struct FilesStrategy;

impl FolderStrategy for FilesStrategy {
    fn strategy_type(&self) -> &'static str {
        "files"
    }

    fn display_name(&self) -> &'static str {
        "Auto Detect"
    }

    fn scan(&self, folder_path: &Path) -> Result<ScanResult, StrategyError> {
        scan_folder(folder_path)
    }

    fn get_display_items(&self, folder_path: &Path) -> Result<Vec<DisplayItem>, StrategyError> {
        if !folder_path.exists() {
            return Err(StrategyError::PathNotFound(folder_path.display().to_string()));
        }
        collect_files(folder_path, 0, None)
    }

    fn get_launch_action(
        &self,
        folder_path: &Path,
        _metadata: &HashMap<String, String>,
    ) -> Option<LaunchAction> {
        Some(LaunchAction {
            action_type: "open_with_default".to_string(),
            target_path: folder_path.display().to_string(),
        })
    }

    fn metadata_schema(&self) -> Vec<MetadataField> {
        vec![]
    }
}

// Sub-strategies are in their own files: files_image_strategy.rs,
// files_pdf_strategy.rs, files_document_strategy.rs, etc.
// Each imports `FileCategory`, `collect_files`, and `scan_folder` from this module.
