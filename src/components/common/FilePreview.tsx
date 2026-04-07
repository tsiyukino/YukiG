/**
 * Displays an inline preview for a single file.
 *
 * Supports images (shown as `<img>`), text (shown in a scrollable `<pre>`),
 * and PDFs (shown in an `<object>` embed). Unsupported file types render a
 * small "No preview available" notice.
 *
 * @param filePath - Absolute path to the file to preview
 */
import { useState, useEffect } from "react";
import { previewGet, FilePreview as FilePreviewData } from "@/services/tauriCommands";
import LoadingSpinner from "./LoadingSpinner";

interface FilePreviewProps {
  /** Absolute path to the file to render a preview for. */
  filePath: string;
}

/** Renders an inline preview for a file based on its type. */
export default function FilePreview({ filePath }: FilePreviewProps) {
  const [data, setData] = useState<FilePreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);

    previewGet(filePath)
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [filePath]);

  if (loading) return <LoadingSpinner message="Loading preview…" />;
  if (error) return <div className="fp-error">{error}</div>;
  if (!data || data.kind === "unsupported") {
    return <div className="fp-unsupported">No preview available for this file type.</div>;
  }

  return (
    <div className="fp">
      {data.kind === "image" && (
        <img
          src={`data:${data.mime_type};base64,${data.content}`}
          alt="File preview"
          className="fp-image"
        />
      )}
      {data.kind === "text" && (
        <div className="fp-text-wrapper">
          {data.truncated && (
            <div className="fp-truncated-notice">
              File is large — showing first 32 KB only.
            </div>
          )}
          <pre className="fp-text">{data.content}</pre>
        </div>
      )}
      {data.kind === "pdf" && (
        <object
          data={`data:application/pdf;base64,${data.content}`}
          type="application/pdf"
          className="fp-pdf"
        >
          <p className="fp-unsupported">PDF preview not supported in this environment.</p>
        </object>
      )}
      <style>{`
        .fp { width: 100%; }
        .fp-error {
          font-size: 12px;
          color: var(--color-danger);
          padding: var(--space-2);
        }
        .fp-unsupported {
          font-size: 12px;
          color: var(--color-text-muted);
          padding: var(--space-2) 0;
          font-style: italic;
        }
        .fp-image {
          max-width: 100%;
          max-height: 400px;
          object-fit: contain;
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-border);
        }
        .fp-text-wrapper {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .fp-truncated-notice {
          font-size: 11px;
          color: var(--color-text-muted);
          font-style: italic;
        }
        .fp-text {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: var(--space-3);
          font-family: var(--font-mono);
          font-size: 12px;
          line-height: 1.6;
          overflow-x: auto;
          overflow-y: auto;
          max-height: 400px;
          white-space: pre;
          color: var(--color-text-primary);
        }
        .fp-pdf {
          width: 100%;
          height: 500px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
        }
      `}</style>
    </div>
  );
}
