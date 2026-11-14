import React, { useRef } from 'react';
import {
  Play,
  Plus,
  Check,
  Film,
  Star,
  ChevronLeft,
  ChevronRight,
  Info,
  Clock,
} from 'lucide-react';
import { CatalogItem, WatchProgressItem } from '../types';
import { MediaImg } from './MediaAssets';

interface TitleCardProps {
  item: CatalogItem;
  inMyList: boolean;
  progress?: WatchProgressItem;
  onOpenDetail: (item: CatalogItem) => void;
  onQuickPlay: (item: CatalogItem) => void;
  onPlayTrailer: (item: CatalogItem) => void;
  onToggleMyList: (id: string) => void;
  variant?: 'rail' | 'grid';
}

export const TitleCard: React.FC<TitleCardProps> = ({
  item,
  inMyList,
  progress,
  onOpenDetail,
  onQuickPlay,
  onPlayTrailer,
  onToggleMyList,
  variant = 'grid',
}) => {
  const progressPct =
    progress && progress.duration > 0
      ? Math.min(100, Math.max(4, (progress.currentTime / progress.duration) * 100))
      : 0;

  return (
    <div
      onClick={() => onOpenDetail(item)}
      className={`poster-card group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12131B] cursor-pointer ${
        variant === 'rail' ? 'w-[265px] sm:w-[300px] shrink-0' : 'w-full'
      }`}
    >
      {/* Thumbnail / Backdrop */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#0A0A0E]">
        <MediaImg
          srcRef={item.poster || item.backdrop}
          alt={item.title}
          fallbackLabel={item.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108"
        />

        {/* Subtle cinematic gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#12131B] via-black/15 to-black/25" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="rounded-md bg-black/75 backdrop-blur-md border border-white/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
              {item.type === 'series' ? 'Сериал' : 'Фильм'}
            </span>
            {item.isNew && (
              <span className="rounded-md bg-[#E50914] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white shadow">
                NEW
              </span>
            )}
          </div>

          <span className="inline-flex items-center gap-1 rounded-md bg-black/75 backdrop-blur-md border border-white/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-400">
            <Star className="h-3 w-3 fill-amber-400" />
            {item.rating.toFixed(1)}
          </span>
        </div>

        {/* Center / Bottom Hover Action Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/35 backdrop-blur-[1px]">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickPlay(item);
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E50914] text-white shadow-[0_0_24px_rgba(229,9,20,0.75)] hover:scale-110 transition-transform cursor-pointer"
              title="Смотреть"
              aria-label={`Смотреть ${item.title}`}
            >
              <Play className="h-5 w-5 fill-white ml-0.5" />
            </button>

            {item.trailerUrl && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayTrailer(item);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white hover:bg-white hover:text-black transition-all cursor-pointer"
                title="Смотреть трейлер"
                aria-label={`Трейлер ${item.title}`}
              >
                <Film className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMyList(item.id);
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all cursor-pointer ${
                inMyList
                  ? 'border-emerald-400/50 bg-emerald-500/25 text-emerald-300'
                  : 'border-white/25 bg-black/70 text-white hover:bg-white hover:text-black'
              }`}
              title={inMyList ? 'Убрать из Моего списка' : 'Добавить в Мой список'}
              aria-label="Мой список"
            >
              {inMyList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Watch Progress Bar */}
        {progressPct > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
            <div
              className="h-full bg-[#E50914]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </div>

      {/* Card Footer Metadata */}
      <div className="flex flex-1 flex-col justify-between p-3.5 space-y-2">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-sm sm:text-[15px] font-bold text-white group-hover:text-[#ff414b] transition-colors line-clamp-1">
              {item.title}
            </h3>
            <span className="shrink-0 rounded border border-white/12 px-1.5 py-0.5 font-mono text-[9px] text-zinc-300">
              {item.ageRating}
            </span>
          </div>

          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
            {progress && progress.seasonNumber && progress.episodeNumber
              ? `Остановились на: Сезон ${progress.seasonNumber} • Серия ${progress.episodeNumber}`
              : item.tagline || item.description}
          </p>
        </div>

        <div className="flex items-center justify-between pt-1.5 border-t border-white/6 text-[11px] text-zinc-400">
          <span className="inline-flex items-center gap-1 font-mono">
            <Clock className="h-3 w-3 text-zinc-500" />
            {item.year} • {item.duration}
          </span>
          <span className="inline-flex items-center gap-1 text-zinc-300 group-hover:text-white">
            <Info className="h-3 w-3 text-[#E50914]" />
            Детали
          </span>
        </div>
      </div>
    </div>
  );
};

interface CinemaRailProps {
  title: string;
  subtitle?: string;
  badge?: string;
  items: CatalogItem[];
  myList: string[];
  progressMap: Record<string, WatchProgressItem>;
  onOpenDetail: (item: CatalogItem) => void;
  onQuickPlay: (item: CatalogItem) => void;
  onPlayTrailer: (item: CatalogItem) => void;
  onToggleMyList: (id: string) => void;
}

export const CinemaRail: React.FC<CinemaRailProps> = ({
  title,
  subtitle,
  badge,
  items,
  myList,
  progressMap,
  onOpenDetail,
  onQuickPlay,
  onPlayTrailer,
  onToggleMyList,
}) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  if (items.length === 0) return null;

  const scrollRail = (dir: -1 | 1) => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollBy({ left: dir * 640, behavior: 'smooth' });
  };

  return (
    <section className="space-y-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-lg sm:text-2xl font-extrabold text-white tracking-tight">
              {title}
            </h2>
            {badge && (
              <span className="rounded-full bg-[#E50914]/15 border border-[#E50914]/35 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#ff4d56]">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">{subtitle}</p>}
        </div>

        <div className="hidden sm:flex items-center gap-1.5">
          <button
            onClick={() => scrollRail(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 hover:bg-[#E50914] hover:border-[#E50914] text-zinc-200 hover:text-white transition-all cursor-pointer"
            aria-label="Листать влево"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollRail(1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 hover:bg-[#E50914] hover:border-[#E50914] text-zinc-200 hover:text-white transition-all cursor-pointer"
            aria-label="Листать вправо"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto no-scrollbar pb-4 pt-1 snap-x snap-mandatory"
        >
          {items.map((item) => (
            <div key={item.id} className="snap-start">
              <TitleCard
                item={item}
                variant="rail"
                inMyList={myList.includes(item.id)}
                progress={progressMap[item.id]}
                onOpenDetail={onOpenDetail}
                onQuickPlay={onQuickPlay}
                onPlayTrailer={onPlayTrailer}
                onToggleMyList={onToggleMyList}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
