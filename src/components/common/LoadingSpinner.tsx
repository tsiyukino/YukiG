/**
 * Centered loading spinner for async content areas.
 */

interface LoadingSpinnerProps {
  /** Optional message to display below the spinner. */
  message?: string;
}

/**
 * Displays a spinning indicator with an optional status message.
 */
export default function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      {message && <p className="spinner-message">{message}</p>}
      <style>{`
        .spinner-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-3);
          padding: var(--space-12);
          color: var(--color-text-muted);
        }
        .spinner {
          width: 28px;
          height: 28px;
          border: 2px solid var(--color-border);
          border-top-color: var(--color-accent);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner-message {
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
