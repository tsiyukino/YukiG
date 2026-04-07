/**
 * Home page — Dashboard overview.
 *
 * Sections:
 * 1. Greeting hero — time-of-day background + featured favorite
 * 2. Stats strip — collections / games / favorites / tags (local + Steam merged)
 * 3. Favorites — shuffled grid, 2 rows visible, "See more" loads next batch
 * 4. Collections panel — compact overview card linking to /games
 * 5. Steam panel — compact overview card linking to /steam
 */
import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Layers, FileText, Heart, Tag, FolderOpen, ArrowRight, Star, Gamepad2,
} from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useHomeData } from "@/hooks/useHomeData";
import { FavoriteItem } from "@/types/item";
import { Collection } from "@/types/collection";
import SteamIcon from "@/components/common/SteamIcon";
import { steamImageSrc } from "@/utils/pathUtils";

// ─── Time-of-day helpers ──────────────────────────────────────────────────────

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

const GREETINGS: Record<TimeOfDay, string> = {
  morning: "Good morning", afternoon: "Good afternoon",
  evening: "Good evening", night: "Good night",
};
const HERO_GRADIENTS: Record<TimeOfDay, string> = {
  morning:   "linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(249,115,22,0.12) 100%)",
  afternoon: "linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(59,130,246,0.10) 100%)",
  evening:   "linear-gradient(135deg, rgba(139,92,246,0.16) 0%, rgba(236,72,153,0.10) 100%)",
  night:     "linear-gradient(135deg, rgba(30,27,75,0.35)  0%, rgba(15,23,42,0.30)  100%)",
};
const HERO_ACCENT: Record<TimeOfDay, string> = {
  morning: "#f59e0b", afternoon: "#6366f1", evening: "#8b5cf6", night: "#818cf8",
};

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Featured favorite (hero right panel) ─────────────────────────────────────

function FeaturedFavorite({ item, collectionName, collectionColor, onOpen }: {
  item: FavoriteItem; collectionName: string; collectionColor: string; onOpen: () => void;
}) {
  const src = item.thumbnail_path ? convertFileSrc(item.thumbnail_path) : null;
  return (
    <div className="hp-featured">
      <div className="hp-featured-icon" style={{ background: `${collectionColor}25` }}>
        {src ? <img src={src} alt="" className="hp-featured-img" /> : <FolderOpen size={22} color={collectionColor} />}
      </div>
      <div className="hp-featured-body">
        <span className="hp-featured-eyebrow"><Heart size={10} style={{ display: "inline", marginRight: 4 }} />Favorite</span>
        <span className="hp-featured-name">{item.name}</span>
        <span className="hp-featured-coll" style={{ color: collectionColor }}>{collectionName}</span>
      </div>
      <button className="hp-featured-btn" onClick={onOpen} style={{ background: collectionColor }}>
        Open <ArrowRight size={11} />
      </button>
    </div>
  );
}

// ─── Favorites grid ───────────────────────────────────────────────────────────

/** Uniform favorite card for both local items and Steam games. */
function FavCard({ name, thumb, sub, eager, onClick }: {
  name: string; thumb: string | null; sub: string; eager?: boolean; onClick?: () => void;
}) {
  return (
    <button className="hp-fav-card" onClick={onClick}>
      <div className="hp-fav-card-art">
        {thumb
          ? <img
              src={thumb}
              alt=""
              className="hp-fav-card-img"
              loading={eager ? "eager" : "lazy"}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          : <Gamepad2 size={16} color="var(--color-text-muted)" strokeWidth={1.5} />
        }
      </div>
      <div className="hp-fav-card-info">
        <span className="hp-fav-card-name">{name}</span>
        <span className="hp-fav-card-sub">{sub}</span>
      </div>
    </button>
  );
}

const FAV_CARD_WIDTH = 160;
const FAV_CARD_GAP = 8; // var(--space-2) = 8px

/**
 * Shuffled favorites grid from DB — covers local items and Steam games uniformly.
 * Shows exactly 2 rows based on measured container width. "See more" adds 2 more rows.
 */
function FavoritesGrid({ favorites, collections, onItemClick }: {
  favorites: FavoriteItem[];
  collections: Collection[];
  onItemClick: (item: FavoriteItem) => void;
}) {
  const shuffled = useMemo(() => shuffle(favorites), [favorites]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(5);
  const [extraRows, setExtraRows] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const c = Math.max(1, Math.floor((w + FAV_CARD_GAP) / (FAV_CARD_WIDTH + FAV_CARD_GAP)));
      setCols(c);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (shuffled.length === 0) return null;

  const rowsToShow = 2 + extraRows;
  const visible = cols * rowsToShow;
  const shown = shuffled.slice(0, visible);
  const hasMore = visible < shuffled.length;

  return (
    <div className="hp-fav-grid-wrap">
      <div className="hp-fav-grid" ref={containerRef}>
        {shown.map((fav, i) => {
          const isSteam = fav.strategy_type === "steam_game";
          const thumb = isSteam
            ? (fav.header_image ? steamImageSrc(fav.header_image) : null)
            : (fav.thumbnail_path ? convertFileSrc(fav.thumbnail_path) : null);
          const sub = isSteam
            ? "Steam"
            : (collections.find((c) => c.id === fav.collection_id)?.name ?? "");
          return (
            <FavCard
              key={fav.id}
              name={fav.name}
              thumb={thumb}
              sub={sub}
              eager={i < 10}
              onClick={() => onItemClick(fav)}
            />
          );
        })}
      </div>
      {hasMore && (
        <button className="hp-fav-more" onClick={() => setExtraRows((r) => r + 2)}>
          See more · {shuffled.length - visible} remaining
        </button>
      )}
    </div>
  );
}

// ─── Overview panel (used for both Collections and Steam) ─────────────────────

/**
 * Compact overview navigation panel — icon, title, subtitle, mosaic art, arrow.
 */
function OverviewPanel({ icon, title, meta, mosaicUrls, emptyIcon, onClick }: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  mosaicUrls: string[];
  emptyIcon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="hp-overview-panel" onClick={onClick}>
      <div className="hp-overview-left">
        <div className="hp-overview-icon">{icon}</div>
        <div className="hp-overview-info">
          <span className="hp-overview-title">{title}</span>
          <span className="hp-overview-meta">{meta}</span>
        </div>
      </div>
      <div className="hp-overview-mosaic">
        {mosaicUrls.length > 0
          ? mosaicUrls.map((url, i) => (
              <img key={i} src={url} alt="" className="hp-overview-mosaic-img" loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ))
          : (emptyIcon ?? null)
        }
      </div>
      <ArrowRight size={13} className="hp-overview-arrow" />
    </button>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

/** Home dashboard: hero · stats · favorites · collections overview · Steam overview. */
export default function HomePage() {
  const navigate = useNavigate();
  const { data, loading, error } = useHomeData();
  const tod = getTimeOfDay();

  // Feature the first non-Steam favourite in the hero panel.
  const featuredFav = data?.allFavorites.find((f) => f.strategy_type !== "steam_game") ?? null;
  const featuredCollection = featuredFav
    ? data?.collections.find((c) => c.id === featuredFav.collection_id)
    : null;

  // Mosaic for the Collections panel: thumbnails from the first few items.
  const collectionsMosaic = useMemo(() => {
    if (!data) return [];
    return data.allItems
      .filter((i) => i.thumbnail_path)
      .slice(0, 5)
      .map((i) => convertFileSrc(i.thumbnail_path!));
  }, [data]);

  // Mosaic for the Steam panel: header images from Steam favorites already in DB.
  // No live scan needed — avoids re-parsing appinfo.vdf on every homepage visit.
  const steamMosaic = useMemo(() => {
    if (!data) return [];
    return data.allFavorites
      .filter((f) => f.strategy_type === "steam_game" && f.header_image)
      .slice(0, 5)
      .map((f) => steamImageSrc(f.header_image!));
  }, [data]);

  return (
    <div className="hp">

      {/* ── 1. Greeting Hero ─────────────────────────────────────── */}
      <div className="hp-hero" style={{ background: HERO_GRADIENTS[tod] }}>
        <div className="hp-hero-accent-bar" style={{ background: HERO_ACCENT[tod] }} />
        <div className="hp-hero-left">
          <p className="hp-hero-date">{formatDate()}</p>
          <h1 className="hp-hero-greeting">{GREETINGS[tod]}</h1>
          <p className="hp-hero-sub">Welcome back to your workspace.</p>
        </div>
        <div className="hp-hero-right">
          {featuredFav && featuredCollection ? (
            <FeaturedFavorite
              item={featuredFav}
              collectionName={featuredCollection.name}
              collectionColor={featuredCollection.color}
              onOpen={() => navigate(`/collections/${featuredFav.collection_id}/items/${featuredFav.id}`)}
            />
          ) : (
            <div className="hp-featured hp-featured--empty">
              <Star size={18} color="var(--color-text-muted)" />
              <span className="hp-featured-empty-text">Mark an item as a favorite<br />and it will appear here.</span>
            </div>
          )}
        </div>
      </div>

      {loading && <div className="hp-loading"><div className="hp-loading-bar" /></div>}
      {error && <div className="hp-error">Could not load dashboard data. {error}</div>}

      {data && (
        <>
          {/* ── 2. Stats strip ─────────────────────────────────────── */}
          <div className="hp-stats">
            <StatCard icon={<Layers size={15} />}   label="Collections" value={data.stats.collections} accent="#6366f1" />
            <StatCard icon={<FileText size={15} />} label="Games"       value={data.stats.games}       accent="#3b82f6" />
            <StatCard icon={<Heart size={15} />}    label="Favorites"   value={data.stats.favorites}   accent="#ec4899" />
            <StatCard icon={<Tag size={15} />}      label="Tags"        value={data.stats.tags}        accent="#10b981" />
          </div>

          {/* ── 3. Favorites ───────────────────────────────────────── */}
          {data.allFavorites.length > 0 && (
            <section className="hp-section">
              <div className="hp-section-header">
                <Heart size={13} />
                <h2 className="hp-section-title">Favorites</h2>
              </div>
              <FavoritesGrid
                favorites={data.allFavorites}
                collections={data.collections}
                onItemClick={(item) =>
                  item.strategy_type === "steam_game"
                    ? navigate("/steam", { state: { openItemId: item.id } })
                    : navigate(`/collections/${item.collection_id}/items/${item.id}`)
                }
              />
            </section>
          )}

          {/* ── 4. Collections overview ────────────────────────────── */}
          <section className="hp-section">
            <div className="hp-section-header">
              <Layers size={13} />
              <h2 className="hp-section-title">Collections</h2>
            </div>
            <OverviewPanel
              icon={<Layers size={14} color="#6366f1" />}
              title="My Collections"
              meta={`${data.collections.length} ${data.collections.length === 1 ? "collection" : "collections"} · ${data.allItems.length} ${data.allItems.length === 1 ? "item" : "items"}`}
              mosaicUrls={collectionsMosaic}
              emptyIcon={<Layers size={20} color="var(--color-text-muted)" strokeWidth={1.5} />}
              onClick={() => navigate("/games")}
            />
          </section>

          {/* ── 5. Steam overview ──────────────────────────────────── */}
          <section className="hp-section">
            <div className="hp-section-header">
              <SteamIcon size={13} />
              <h2 className="hp-section-title">Steam</h2>
            </div>
            <OverviewPanel
              icon={<SteamIcon size={14} />}
              title="Steam Library"
              meta={`${data.steamGameCount} games`}
              mosaicUrls={steamMosaic}
              emptyIcon={<Gamepad2 size={20} color="var(--color-text-muted)" strokeWidth={1.5} />}
              onClick={() => navigate("/steam")}
            />
          </section>
        </>
      )}

      <style>{`
        .hp { display: flex; flex-direction: column; gap: var(--space-6); width: 100%; padding-bottom: var(--space-8); }

        /* Hero */
        .hp-hero {
          position: relative; border-radius: var(--radius-lg);
          padding: var(--space-8); display: flex; align-items: center;
          justify-content: space-between; gap: var(--space-8);
          min-height: 160px; overflow: hidden; border: 1px solid var(--color-border-subtle);
        }
        .hp-hero-accent-bar { position: absolute; bottom: 0; left: 0; right: 0; height: 2px; opacity: 0.6; }
        .hp-hero-left { display: flex; flex-direction: column; gap: var(--space-1); }
        .hp-hero-date { font-size: 12px; font-weight: 500; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
        .hp-hero-greeting { font-size: 28px; font-weight: 700; letter-spacing: -0.03em; color: var(--color-text-primary); line-height: 1.2; }
        .hp-hero-sub { font-size: 13px; color: var(--color-text-secondary); margin-top: var(--space-1); }
        .hp-hero-right { flex-shrink: 0; }

        /* Featured favorite */
        .hp-featured {
          display: flex; align-items: center; gap: var(--space-3);
          background: rgba(255,255,255,0.55); backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px); border: 1px solid var(--color-border);
          border-radius: var(--radius-md); padding: var(--space-3) var(--space-4);
          min-width: 240px; max-width: 300px; box-shadow: var(--shadow-sm);
        }
        [data-theme="dark"] .hp-featured { background: rgba(26,26,31,0.65); }
        .hp-featured--empty { flex-direction: column; align-items: center; text-align: center; gap: var(--space-2); padding: var(--space-5) var(--space-6); opacity: 0.7; }
        .hp-featured-empty-text { font-size: 12px; color: var(--color-text-muted); line-height: 1.5; }
        .hp-featured-icon { flex-shrink: 0; width: 44px; height: 44px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .hp-featured-img { width: 44px; height: 44px; object-fit: cover; }
        .hp-featured-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .hp-featured-eyebrow { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); display: flex; align-items: center; }
        .hp-featured-name { font-size: 13px; font-weight: 600; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hp-featured-coll { font-size: 11px; font-weight: 500; }
        .hp-featured-btn { display: flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 600; color: white; transition: opacity var(--transition-fast); white-space: nowrap; flex-shrink: 0; }
        .hp-featured-btn:hover { opacity: 0.85; }

        /* Stats — 4 columns normally, 2×2 on narrow windows */
        .hp-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); }
        @media (max-width: 720px) { .hp-stats { grid-template-columns: repeat(2, 1fr); } }
        .hp-stat { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4) var(--space-5); background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
        .hp-stat-icon { flex-shrink: 0; width: 34px; height: 34px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; }
        .hp-stat-body { display: flex; flex-direction: column; gap: 1px; }
        .hp-stat-value { font-size: 20px; font-weight: 700; letter-spacing: -0.03em; color: var(--color-text-primary); line-height: 1; }
        .hp-stat-label { font-size: 11.5px; color: var(--color-text-muted); font-weight: 500; }

        /* Sections */
        .hp-section { display: flex; flex-direction: column; gap: var(--space-3); }
        .hp-section-header { display: flex; align-items: center; gap: var(--space-2); color: var(--color-text-secondary); }
        .hp-section-title { font-size: 13px; font-weight: 600; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }

        /* Favorites grid */
        .hp-fav-grid-wrap { display: flex; flex-direction: column; gap: var(--space-3); }
        .hp-fav-grid { display: flex; flex-wrap: wrap; gap: var(--space-2); }
        .hp-fav-card {
          width: 160px; flex-shrink: 0;
          display: flex; flex-direction: column; border-radius: var(--radius-md);
          overflow: hidden; background: var(--color-bg-secondary);
          border: 1px solid var(--color-border); text-align: left;
          transition: box-shadow var(--transition-fast), border-color var(--transition-fast);
        }
        .hp-fav-card:hover { box-shadow: var(--shadow-md); border-color: var(--color-border-hover); }
        .hp-fav-card-art {
          aspect-ratio: 920/430; background: var(--color-bg-tertiary);
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .hp-fav-card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .hp-fav-card-info { padding: 6px 8px; }
        .hp-fav-card-name { font-size: 11.5px; font-weight: 500; color: var(--color-text-primary); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hp-fav-card-sub { font-size: 10.5px; color: var(--color-text-muted); display: block; }
        .hp-fav-more {
          align-self: center;
          font-size: 12.5px; font-weight: 500; color: var(--color-accent);
          padding: var(--space-2) var(--space-4);
          border: 1px solid var(--color-accent-light);
          border-radius: var(--radius-full);
          transition: background var(--transition-fast);
        }
        .hp-fav-more:hover { background: var(--color-accent-light); }

        /* Overview panels (Collections + Steam) */
        .hp-overview-panel {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: var(--color-bg-secondary); border: 1px solid var(--color-border);
          border-radius: var(--radius-md); cursor: pointer; text-align: left; width: 100%;
          transition: background var(--transition-fast), box-shadow var(--transition-fast);
        }
        .hp-overview-panel:hover { background: var(--color-bg-tertiary); box-shadow: var(--shadow-sm); }
        .hp-overview-panel:hover .hp-overview-arrow { transform: translateX(3px); }
        .hp-overview-left { display: flex; align-items: center; gap: var(--space-3); flex-shrink: 0; }
        .hp-overview-icon { width: 30px; height: 30px; border-radius: var(--radius-sm); background: var(--color-bg-tertiary); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .hp-overview-info { display: flex; flex-direction: column; gap: 1px; }
        .hp-overview-title { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
        .hp-overview-meta { font-size: 11.5px; color: var(--color-text-muted); }
        .hp-overview-mosaic { flex: 1; display: flex; gap: 4px; overflow: hidden; justify-content: flex-end; align-items: center; }
        .hp-overview-mosaic-img { width: 72px; height: 34px; object-fit: cover; border-radius: 3px; opacity: 0.7; flex-shrink: 0; }
        .hp-overview-arrow { color: var(--color-text-muted); flex-shrink: 0; transition: transform var(--transition-fast); }

        /* Loading / Error */
        .hp-loading { height: 2px; background: var(--color-bg-tertiary); border-radius: var(--radius-full); overflow: hidden; }
        @keyframes hp-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
        .hp-loading-bar { height: 100%; width: 25%; background: var(--color-accent); border-radius: var(--radius-full); animation: hp-slide 1.2s ease-in-out infinite; }
        .hp-error { padding: var(--space-4); background: var(--color-danger-light); color: var(--color-danger); border-radius: var(--radius-md); font-size: 13px; }
      `}</style>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: number; accent: string;
}) {
  return (
    <div className="hp-stat">
      <div className="hp-stat-icon" style={{ background: `${accent}18`, color: accent }}>{icon}</div>
      <div className="hp-stat-body">
        <span className="hp-stat-value">{value}</span>
        <span className="hp-stat-label">{label}</span>
      </div>
    </div>
  );
}
