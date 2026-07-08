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
import { useMemo, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Heart, Gamepad2 } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useHomeData } from "@/hooks/useHomeData";
import { FavoriteItem } from "@/types/item";
import SteamIcon from "@/components/common/SteamIcon";
import HeroSection from "@/components/home/HeroSection";
import NowPlayingBanner from "@/components/home/NowPlayingBanner";
import StatsStrip from "@/components/home/StatsStrip";
import FavoritesGrid from "@/components/home/FavoritesGrid";
import OverviewPanel from "@/components/home/OverviewPanel";
import { steamImageSrc } from "@/utils/pathUtils";
import styles from "./HomePage.module.css";

/** Home dashboard: hero · stats · favorites · collections overview · Steam overview. */
export default function HomePage() {
  const navigate = useNavigate();
  const { data, loading, error } = useHomeData();

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

  function openFavorite(item: FavoriteItem) {
    if (item.strategy_type === "steam_game") {
      navigate("/steam", { state: { openItemId: item.id } });
    } else {
      navigate(`/collections/${item.collection_id}/items/${item.id}`);
    }
  }

  return (
    <div className={styles.page}>
      <HeroSection
        featured={featuredFav}
        collectionName={featuredCollection?.name}
        collectionColor={featuredCollection?.color}
        onOpenFeatured={() =>
          featuredFav &&
          navigate(`/collections/${featuredFav.collection_id}/items/${featuredFav.id}`)
        }
      />

      {loading && <div className={styles.loading}><div className={styles.loadingBar} /></div>}
      {error && <div className={styles.error}>Could not load dashboard data. {error}</div>}

      {data && (
        <>
          <NowPlayingBanner allItems={data.allItems} onOpen={openFavorite} />

          <StatsStrip stats={data.stats} />

          {data.allFavorites.length > 0 && (
            <Section icon={<Heart size={13} />} title="Favorites">
              <FavoritesGrid
                favorites={data.allFavorites}
                collections={data.collections}
                onItemClick={openFavorite}
              />
            </Section>
          )}

          <Section icon={<Layers size={13} />} title="Collections">
            <OverviewPanel
              icon={<Layers size={14} color="var(--color-accent)" />}
              title="My Collections"
              meta={`${data.collections.length} ${data.collections.length === 1 ? "collection" : "collections"} · ${data.allItems.length} ${data.allItems.length === 1 ? "item" : "items"}`}
              mosaicUrls={collectionsMosaic}
              emptyIcon={<Layers size={20} color="var(--color-text-muted)" strokeWidth={1.5} />}
              onClick={() => navigate("/games")}
            />
          </Section>

          <Section icon={<SteamIcon size={13} />} title="Steam">
            <OverviewPanel
              icon={<SteamIcon size={14} />}
              title="Steam Library"
              meta={`${data.steamGameCount} games`}
              mosaicUrls={steamMosaic}
              emptyIcon={<Gamepad2 size={20} color="var(--color-text-muted)" strokeWidth={1.5} />}
              onClick={() => navigate("/steam")}
            />
          </Section>
        </>
      )}
    </div>
  );
}

/** Labelled home-page section with a small uppercase header. */
function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        {icon}
        <h2 className={styles.sectionTitle}>{title}</h2>
      </div>
      {children}
    </section>
  );
}
