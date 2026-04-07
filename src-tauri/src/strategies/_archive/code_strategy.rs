/// Strategy for code project folders.
///
/// Placeholder implementation. Scans the folder, detects the primary programming
/// language(s) by extension, and lists all source files. Extended behavior
/// (project parsing, dependency graph, build integration) will be added later.
use std::collections::HashMap;
use std::path::Path;

use super::{
    DisplayItem, FolderStrategy, LaunchAction, MetadataField, ScanResult, StrategyError,
};

/// Maximum recursion depth for the code strategy scanner.
const MAX_SCAN_DEPTH: u32 = 8;

/// Directories that are typically generated/dependency caches — skipped during scan.
const IGNORED_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "dist",
    "build",
    ".next",
    ".nuxt",
    "__pycache__",
    ".venv",
    "venv",
    ".mypy_cache",
    ".pytest_cache",
    ".cargo",
    "vendor",
    "obj",
    "bin",
    ".idea",
    ".vscode",
    "coverage",
    ".cache",
];

/// Maps a file extension to a canonical language label.
fn language_for_extension(ext: &str) -> Option<&'static str> {
    match ext {
        // Web
        "ts" | "tsx" => Some("TypeScript"),
        "js" | "jsx" | "mjs" | "cjs" => Some("JavaScript"),
        "html" | "htm" => Some("HTML"),
        "css" | "scss" | "sass" | "less" => Some("CSS"),
        "vue" => Some("Vue"),
        "svelte" => Some("Svelte"),
        // Systems / compiled
        "rs" => Some("Rust"),
        "c" | "h" => Some("C"),
        "cpp" | "cc" | "cxx" | "hpp" | "hxx" => Some("C++"),
        "cs" => Some("C#"),
        "go" => Some("Go"),
        "zig" => Some("Zig"),
        "odin" => Some("Odin"),
        "swift" => Some("Swift"),
        "kt" | "kts" => Some("Kotlin"),
        "java" => Some("Java"),
        "scala" => Some("Scala"),
        "m" | "mm" => Some("Objective-C"),
        // Scripting
        "py" | "pyw" => Some("Python"),
        "rb" => Some("Ruby"),
        "php" => Some("PHP"),
        "lua" => Some("Lua"),
        "sh" | "bash" | "zsh" | "fish" => Some("Shell"),
        "ps1" | "psm1" => Some("PowerShell"),
        "bat" | "cmd" => Some("Batch"),
        "r" => Some("R"),
        "jl" => Some("Julia"),
        "pl" | "pm" => Some("Perl"),
        "ex" | "exs" => Some("Elixir"),
        "erl" | "hrl" => Some("Erlang"),
        "clj" | "cljs" | "cljc" => Some("Clojure"),
        "hs" | "lhs" => Some("Haskell"),
        "ml" | "mli" => Some("OCaml"),
        "fs" | "fsi" | "fsx" => Some("F#"),
        "nim" => Some("Nim"),
        "cr" => Some("Crystal"),
        "d" => Some("D"),
        "dart" => Some("Dart"),
        "elm" => Some("Elm"),
        "v" | "vh" | "sv" | "svh" => Some("Verilog/SystemVerilog"),
        // Data / config (treated as code in a project context)
        "sql" => Some("SQL"),
        "graphql" | "gql" => Some("GraphQL"),
        "proto" => Some("Protobuf"),
        "tf" | "tfvars" => Some("Terraform"),
        "nix" => Some("Nix"),
        "dhall" => Some("Dhall"),
        "yaml" | "yml" | "toml" | "json" | "jsonc" => Some("Config"),
        "dockerfile" => Some("Dockerfile"),
        "makefile" | "mk" => Some("Makefile"),
        _ => None,
    }
}

/// Placeholder strategy for code project folders.
///
/// Currently enumerates source files and detects the primary language(s).
/// Richer project-aware features (build integration, dependency graph, etc.)
/// will be added in a future iteration.
pub struct CodeStrategy;

impl FolderStrategy for CodeStrategy {
    fn strategy_type(&self) -> &'static str {
        "code"
    }

    fn display_name(&self) -> &'static str {
        "Code Project"
    }

    /// Scans the project folder and returns language breakdown as metadata.
    fn scan(&self, folder_path: &Path) -> Result<ScanResult, StrategyError> {
        if !folder_path.exists() {
            return Err(StrategyError::PathNotFound(
                folder_path.display().to_string(),
            ));
        }

        let items = collect_source_files(folder_path, 0)?;
        let mut lang_counts: HashMap<&str, usize> = HashMap::new();

        for item in &items {
            if !item.is_dir {
                let ext = Path::new(&item.name)
                    .extension()
                    .map(|e| e.to_string_lossy().to_lowercase())
                    .unwrap_or_default();
                if let Some(lang) = language_for_extension(&ext) {
                    *lang_counts.entry(lang).or_insert(0) += 1;
                }
            }
        }

        let file_total = items.iter().filter(|i| !i.is_dir).count();

        // Pick the primary language (highest file count).
        let primary_language = lang_counts
            .iter()
            .max_by_key(|(_, &v)| v)
            .map(|(&k, _)| k)
            .unwrap_or("Unknown");

        let summary = if file_total == 0 {
            "Empty project".to_string()
        } else {
            format!(
                "{} source file(s) — primary language: {}",
                file_total, primary_language
            )
        };

        let mut metadata: HashMap<String, String> = lang_counts
            .into_iter()
            .map(|(lang, count)| (format!("lang_{}", lang.to_lowercase().replace(' ', "_")), count.to_string()))
            .collect();

        metadata.insert("primary_language".to_string(), primary_language.to_string());
        metadata.insert("file_count".to_string(), file_total.to_string());

        Ok(ScanResult { metadata, summary })
    }

    /// Returns all source files, skipping generated/dependency directories.
    fn get_display_items(&self, folder_path: &Path) -> Result<Vec<DisplayItem>, StrategyError> {
        if !folder_path.exists() {
            return Err(StrategyError::PathNotFound(
                folder_path.display().to_string(),
            ));
        }
        collect_source_files(folder_path, 0)
    }

    /// Returns an action to open the project folder in the system default application.
    ///
    /// On Windows this typically opens Explorer. A future version may detect the
    /// user's preferred editor (VS Code, etc.) and open directly in it.
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
        // Placeholder: no user-configured metadata yet.
        // Future fields: preferred_editor, build_command, entry_point, etc.
        vec![]
    }
}

/// Recursively collects files, skipping known ignored directories.
fn collect_source_files(dir: &Path, depth: u32) -> Result<Vec<DisplayItem>, StrategyError> {
    if depth >= MAX_SCAN_DEPTH {
        return Ok(vec![]);
    }

    let mut items = vec![];
    let entries = std::fs::read_dir(dir)?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let is_dir = path.is_dir();

        // Skip ignored directories.
        if is_dir && IGNORED_DIRS.contains(&name.as_str()) {
            continue;
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

        items.push(DisplayItem {
            name,
            path: path.display().to_string(),
            is_dir,
            size_bytes,
            modified_at,
        });

        if is_dir {
            let mut sub = collect_source_files(&path, depth + 1)?;
            items.append(&mut sub);
        }
    }

    Ok(items)
}
