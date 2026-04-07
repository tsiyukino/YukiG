/**
 * Skeleton placeholder components for loading states.
 *
 * Use these instead of a spinner when the page has a known layout so the
 * content area doesn't jump when data arrives.
 */

interface SkeletonProps {
  /** Width as a CSS value. Defaults to "100%". */
  width?: string;
  /** Height as a CSS value. Defaults to "16px". */
  height?: string;
  /** Border radius as a CSS value. Defaults to var(--radius-sm). */
  radius?: string;
  /** Additional inline style overrides. */
  style?: React.CSSProperties;
}

/**
 * Single rectangular skeleton block with a shimmer animation.
 */
export function Skeleton({ width = "100%", height = "16px", radius, style }: SkeletonProps) {
  return (
    <>
      <div
        className="skeleton"
        style={{ width, height, borderRadius: radius ?? "var(--radius-sm)", ...style }}
      />
      <style>{`
        .skeleton {
          background: linear-gradient(
            90deg,
            var(--color-bg-tertiary) 25%,
            var(--color-bg-secondary) 50%,
            var(--color-bg-tertiary) 75%
          );
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.4s ease infinite;
          flex-shrink: 0;
        }
        @keyframes skeleton-shimmer {
          from { background-position: 200% 0; }
          to   { background-position: -200% 0; }
        }
      `}</style>
    </>
  );
}

/**
 * Skeleton layout for a collection view item grid (3-column, N rows).
 */
export function ItemGridSkeleton({ rows = 2 }: { rows?: number }) {
  const cells = Array.from({ length: rows * 3 });
  return (
    <div className="sk-item-grid">
      {cells.map((_, i) => (
        <div key={i} className="sk-item-card">
          <Skeleton height="120px" radius="var(--radius-md)" />
          <Skeleton width="60%" height="14px" style={{ marginTop: 10 }} />
          <Skeleton width="40%" height="12px" style={{ marginTop: 6 }} />
        </div>
      ))}
      <style>{`
        .sk-item-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          width: 100%;
        }
        .sk-item-card {
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </div>
  );
}

/**
 * Skeleton layout for the item detail page.
 */
export function ItemDetailSkeleton() {
  return (
    <div className="sk-detail">
      <div className="sk-detail-header">
        <Skeleton width="48px" height="48px" radius="var(--radius-md)" />
        <div className="sk-detail-titles">
          <Skeleton width="200px" height="22px" />
          <Skeleton width="120px" height="13px" style={{ marginTop: 6 }} />
        </div>
      </div>
      <Skeleton height="80px" radius="var(--radius-sm)" style={{ marginTop: 16 }} />
      <Skeleton height="14px" width="80%" style={{ marginTop: 16 }} />
      <Skeleton height="14px" width="60%" style={{ marginTop: 8 }} />
      <Skeleton height="14px" width="70%" style={{ marginTop: 8 }} />
      <style>{`
        .sk-detail { width: 100%; }
        .sk-detail-header { display: flex; align-items: center; gap: 14px; }
        .sk-detail-titles { display: flex; flex-direction: column; flex: 1; }
      `}</style>
    </div>
  );
}
