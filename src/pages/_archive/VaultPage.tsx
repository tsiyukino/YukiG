/**
 * Vault page — placeholder for a future secure/private storage feature.
 *
 * This page is intentionally left as a placeholder. The Vault feature
 * is planned for a future phase and its scope is yet to be determined.
 */
import { Lock } from "lucide-react";

/** Placeholder page for the Vault feature. */
export default function VaultPage() {
  return (
    <div className="vp">
      <div className="vp-hero">
        <div className="vp-icon-wrap">
          <Lock size={32} color="var(--color-accent)" strokeWidth={1.5} />
        </div>
        <h1 className="vp-title">Vault</h1>
        <p className="vp-subtitle">This feature is coming in a future update.</p>
        <p className="vp-desc">
          The Vault will provide a secure space for organizing sensitive or private content,
          separate from the main collection view.
        </p>
        <span className="vp-badge">Planned</span>
      </div>

      <style>{`
        .vp {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
        }
        .vp-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-3);
          text-align: center;
          max-width: 380px;
        }
        .vp-icon-wrap {
          width: 72px; height: 72px;
          border-radius: var(--radius-lg);
          background: var(--color-accent-light);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: var(--space-2);
        }
        .vp-title { font-size: 24px; font-weight: 700; letter-spacing: -0.025em; }
        .vp-subtitle { font-size: 14px; color: var(--color-text-secondary); font-weight: 500; }
        .vp-desc {
          font-size: 13px; color: var(--color-text-muted);
          line-height: 1.6;
        }
        .vp-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: var(--radius-full);
          font-size: 11px; font-weight: 600;
          background: var(--color-bg-tertiary);
          color: var(--color-text-muted);
          border: 1px solid var(--color-border);
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}
