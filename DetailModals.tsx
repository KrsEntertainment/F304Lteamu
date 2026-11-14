import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Play,
  Film,
  Plus,
  Check,
  Star,
  Share2,
  Clock,
  Calendar,
  Award,
  MapPin,
  AtSign,
  Users,
  Clapperboard,
  Volume2,
  VolumeX,
  Sparkles,
} from 'lucide-react';
import {
  Actor,
  CatalogItem,
  Episode,
  NewsPost,
  PlaybackPayload,
  WatchProgressItem,
} from '../types';
import { MediaImg, useMediaUrl } from './MediaAssets';

/* -------------------------------------------------------------------------- */
/* 1. TITLE DETAIL MODAL (Movie / Series, Seasons, Episodes, Film Cast)       */
/* -------------------------------------------------------------------------- */

interface TitleDetailModalProps {
  item: CatalogItem | null;
  allCatalog: CatalogItem[];
  actors: Actor[];
  inMyList: boolean;
  progress?: WatchProgressItem;
  onClose: () => void;
  onToggleMyList: (id: string) => void;
  onPlay: (payload: PlaybackPayload) => void;
  onOpenTitle: (item: CatalogItem) => void;
  onOpenActor: (actor: Actor) => void;
  onNotify: (msg: string) => void;
}

export const TitleDetailModal: React.FC<TitleDetailModalProps> = ({
  item,
  allCatalog,
  actors,
  inMyList,
  progress,
  onClose,
  onToggleMyList,
  onPlay,
  onOpenTitle,
  onOpenActor,
  onNotify,
}) => {
  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(1);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewMuted, setPreviewMuted] = useState(true);

  const resolvedTrailerUrl = useMediaUrl(item?.trailerUrl);

  useEffect(() => {
    if (item) {
      setSelectedSeasonNum(item.seasons?.[0]?.number ?? 1);
      setPreviewPlaying(false);
      setPreviewMuted(true);
    }
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [item, onClose]);

  const castList = useMemo(() => {
    if (!item) return [];
    return item.cast
      .map((assignment) => {
        const actor = actors.find((a) => a.id === assignment.actorId);
        return actor ? { actor, assignment } : null;
      })
      .filter(Boolean) as { actor: Actor; assignment: CatalogItem['cast'][number] }[];
  }, [item, actors]);

  const relatedItems = useMemo(() => {
    if (!item) return [];
    return allCatalog
      .filter(
        (other) =>
          other.published &&
          other.id !== item.id &&
          other.genres.some((g) => item.genres.includes(g))
      )
      .slice(0, 4);
  }, [item, allCatalog]);

  if (!item) return null;

  const activeSeason =
    item.seasons.find((s) => s.number === selectedSeasonNum) || item.seasons[0];

  const handlePrimaryPlay = () => {
    if (item.type === 'series') {
      // Resume saved episode if available, else season 1 episode 1
      if (progress?.episodeId) {
        for (const s of item.seasons) {
          const ep = s.episodes.find((e) => e.id === progress.episodeId);
          if (ep) {
            onPlay({ item, mode: 'episode', seasonNumber: s.number, episode: ep });
            return;
          }
        }
      }
      const firstSeason = item.seasons[0];
      const firstEp = firstSeason?.episodes[0];
      if (firstSeason && firstEp) {
        onPlay({ item, mode: 'episode', seasonNumber: firstSeason.number, episode: firstEp });
      } else {
        onPlay({ item, mode: 'trailer' });
      }
    } else {
      onPlay({ item, mode: 'movie' });
    }
  };

  const handleShare = () => {
    const shareText = `${item.title} — смотри эксклюзивно на F304Lteam!`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${shareText} ${window.location.href}`).catch(() => {});
    }
    onNotify('Ссылка на релиз скопирована в буфер обмена');
  };

  const handleEpisodeClick = (seasonNum: number, ep: Episode) => {
    onPlay({ item, mode: 'episode', seasonNumber: seasonNum, episode: ep });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/82 backdrop-blur-md p-2 sm:p-6 md:p-10"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative my-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-white/12 bg-[#111218] shadow-[0_32px_90px_rgba(0,0,0,0.9)] animate-modal-in"
      >
        {/* Top Hero Backdrop */}
        <div className="relative h-[320px] sm:h-[420px] w-full overflow-hidden bg-[#09090D]">
          {previewPlaying && resolvedTrailerUrl ? (
            <video
              src={resolvedTrailerUrl}
              autoPlay
              loop
              muted={previewMuted}
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <MediaImg
              srcRef={item.backdrop || item.poster}
              alt={item.title}
              fallbackLabel={item.title}
              className="h-full w-full object-cover"
            />
          )}

          {/* Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111218] via-[#111218]/45 to-black/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#111218]/90 via-transparent to-transparent" />

          {/* Top Bar inside Hero */}
          <div className="absolute top-4 right-4 left-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E50914] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-white shadow-lg">
                <Sparkles className="h-3 w-3" />
                {item.type === 'series' ? 'F304L СЕРИАЛ' : 'F304L ФИЛЬМ'}
              </span>
              {item.isNew && (
                <span className="rounded-full border border-white/15 bg-black/60 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                  Новинка
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {resolvedTrailerUrl && (
                <button
                  onClick={() => setPreviewPlaying((p) => !p)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 hover:bg-white/15 backdrop-blur-md px-3 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer"
                >
                  <Film className="h-3.5 w-3.5 text-[#E50914]" />
                  {previewPlaying ? 'Стоп превью' : 'Превью-фон'}
                </button>
              )}
              {previewPlaying && (
                <button
                  onClick={() => setPreviewMuted((m) => !m)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white hover:bg-white/15 cursor-pointer"
                  aria-label="Переключить звук превью"
                >
                  {previewMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
              )}
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white hover:bg-[#E50914] hover:border-[#E50914] transition-all cursor-pointer"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Title & Action CTA anchored at bottom */}
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 space-y-4">
            <div className="space-y-1.5 max-w-2xl">
              <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                {item.title}
              </h2>
              {item.tagline && (
                <p className="text-sm sm:text-base text-zinc-300 italic">{item.tagline}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handlePrimaryPlay}
                className="inline-flex items-center gap-2 rounded-xl bg-[#E50914] hover:bg-[#ff1c28] px-6 py-3 text-sm font-bold text-white shadow-[0_10px_30px_rgba(229,9,20,0.45)] transition-all active:scale-95 cursor-pointer"
              >
                <Play className="h-4 w-4 fill-white" />
                {progress && progress.currentTime > 5
                  ? item.type === 'series' && progress.seasonNumber && progress.episodeNumber
                    ? `Продолжить С${progress.seasonNumber}•Э${progress.episodeNumber}`
                    : 'Продолжить просмотр'
                  : item.type === 'series'
                    ? 'Смотреть 1 серию'
                    : 'Смотреть фильм'}
              </button>

              {item.trailerUrl && (
                <button
                  onClick={() => onPlay({ item, mode: 'trailer' })}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 hover:bg-white/20 backdrop-blur-md px-5 py-3 text-sm font-semibold text-white transition-all cursor-pointer"
                >
                  <Film className="h-4 w-4 text-[#E50914]" />
                  Трейлер
                </button>
              )}

              <button
                onClick={() => onToggleMyList(item.id)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all cursor-pointer ${
                  inMyList
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                    : 'border-white/15 bg-white/5 hover:bg-white/15 text-white'
                }`}
              >
                {inMyList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {inMyList ? 'В моём списке' : 'Мой список'}
              </button>

              <button
                onClick={handleShare}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 hover:bg-white/15 text-zinc-200 transition-colors cursor-pointer"
                title="Поделиться"
                aria-label="Поделиться"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Body Content */}
        <div className="p-5 sm:p-8 space-y-8">
          {/* Metadata + Synopsis */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm">
                <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-400">
                  <Star className="h-4 w-4 fill-amber-400" />
                  {item.rating.toFixed(1)}
                </span>
                <span className="text-zinc-500">•</span>
                <span className="font-mono text-zinc-200">{item.year}</span>
                <span className="text-zinc-500">•</span>
                <span className="rounded border border-white/20 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">
                  {item.ageRating}
                </span>
                <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] text-zinc-200">
                  {item.quality}
                </span>
                <span className="inline-flex items-center gap-1 text-zinc-300">
                  <Clock className="h-3.5 w-3.5 text-zinc-400" />
                  {item.duration}
                </span>
              </div>

              <p className="text-sm sm:text-base leading-relaxed text-zinc-300">
                {item.description}
              </p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-[#171822]/75 p-4 space-y-3 text-xs sm:text-sm h-fit">
              <div>
                <span className="text-zinc-500 block mb-0.5">Режиссёр</span>
                <span className="font-semibold text-white">{item.director || 'F304Lteam'}</span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-1">Жанры</span>
                <div className="flex flex-wrap gap-1.5">
                  {item.genres.map((g) => (
                    <span
                      key={g}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-200"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5">Студия</span>
                <span className="font-mono text-xs text-[#E50914] font-semibold">
                  F304Lteam Originals
                </span>
              </div>
            </div>
          </div>

          {/* SERIES EPISODES SECTION */}
          {item.type === 'series' && item.seasons.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                  <Clapperboard className="h-5 w-5 text-[#E50914]" />
                  Серии и сезоны
                </h3>

                {/* Season Pills */}
                <div className="flex flex-wrap gap-2">
                  {item.seasons.map((season) => (
                    <button
                      key={season.id}
                      onClick={() => setSelectedSeasonNum(season.number)}
                      className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                        activeSeason?.number === season.number
                          ? 'bg-[#E50914] text-white shadow-md'
                          : 'border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      Сезон {season.number}
                    </button>
                  ))}
                </div>
              </div>

              {activeSeason && (
                <div className="space-y-3">
                  {activeSeason.title && (
                    <p className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                      {activeSeason.title} • {activeSeason.episodes.length} серий
                    </p>
                  )}

                  {activeSeason.episodes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center text-sm text-zinc-400">
                      В этом сезоне пока нет загруженных серий.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {activeSeason.episodes.map((ep) => {
                        const isWatchedEp = progress?.episodeId === ep.id;
                        const pct =
                          isWatchedEp && progress && progress.duration > 0
                            ? Math.min(100, (progress.currentTime / progress.duration) * 100)
                            : 0;
                        return (
                          <button
                            key={ep.id}
                            onClick={() => handleEpisodeClick(activeSeason.number, ep)}
                            className="group flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl border border-white/8 bg-[#161721]/80 hover:bg-[#1E202E] hover:border-[#E50914]/45 p-3 text-left transition-all cursor-pointer"
                          >
                            {/* Episode Thumbnail */}
                            <div className="relative h-32 sm:h-24 w-full sm:w-44 shrink-0 overflow-hidden rounded-xl bg-[#09090D]">
                              <MediaImg
                                srcRef={ep.thumbnail || item.backdrop || item.poster}
                                alt={ep.title}
                                fallbackLabel={`Серия ${ep.number}`}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-black/35 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/65 border border-white/25 text-white group-hover:bg-[#E50914] group-hover:border-[#E50914] group-hover:scale-110 transition-all">
                                  <Play className="h-4 w-4 fill-white ml-0.5" />
                                </div>
                              </div>
                              <span className="absolute top-2 left-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                                Э{ep.number}
                              </span>
                              {pct > 2 && (
                                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
                                  <div
                                    className="h-full bg-[#E50914]"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Episode Info */}
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="font-semibold text-sm sm:text-base text-white group-hover:text-[#ff414b] transition-colors truncate">
                                  {ep.number}. {ep.title}
                                </h4>
                                <span className="shrink-0 font-mono text-xs text-zinc-400">
                                  {ep.duration}
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm text-zinc-400 line-clamp-2 leading-relaxed">
                                {ep.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* FILM-SPECIFIC ACTORS SECTION */}
          {castList.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-white/10">
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-[#E50914]" />
                Актёры фильма
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {castList.map(({ actor, assignment }) => (
                  <button
                    key={actor.id}
                    onClick={() => onOpenActor(actor)}
                    className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-[#161721]/80 hover:bg-[#1E202E] hover:border-white/20 p-2.5 text-left transition-all cursor-pointer"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10">
                      <MediaImg
                        srcRef={actor.photo}
                        alt={actor.name}
                        fallbackLabel={actor.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-white group-hover:text-[#ff414b] transition-colors truncate">
                        {actor.name}
                      </p>
                      <p className="text-xs text-zinc-400 truncate">{assignment.characterName}</p>
                      {assignment.isLead && (
                        <span className="mt-0.5 inline-block font-mono text-[10px] text-amber-400">
                          Главная роль
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* RELATED RELEASES */}
          {relatedItems.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-white/10">
              <h3 className="font-display text-lg font-bold text-white">
                Похожее в каталоге F304Lteam
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {relatedItems.map((rel) => (
                  <button
                    key={rel.id}
                    onClick={() => onOpenTitle(rel)}
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-[#161721] text-left hover:border-[#E50914]/50 transition-all cursor-pointer"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <MediaImg
                        srcRef={rel.poster}
                        alt={rel.title}
                        fallbackLabel={rel.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <span className="absolute top-2 right-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-400">
                        {rel.rating.toFixed(1)}
                      </span>
                    </div>
                    <div className="p-2.5 space-y-0.5">
                      <p className="text-xs font-bold text-white truncate">{rel.title}</p>
                      <p className="text-[11px] text-zinc-400">
                        {rel.year} • {rel.type === 'series' ? 'Сериал' : 'Фильм'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. ACTOR PROFILE MODAL (General Actor + Computed Filmography)              */
/* -------------------------------------------------------------------------- */

interface ActorProfileModalProps {
  actor: Actor | null;
  catalog: CatalogItem[];
  onClose: () => void;
  onOpenTitle: (item: CatalogItem) => void;
}

export const ActorProfileModal: React.FC<ActorProfileModalProps> = ({
  actor,
  catalog,
  onClose,
  onOpenTitle,
}) => {
  useEffect(() => {
    if (!actor) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [actor, onClose]);

  const filmography = useMemo(() => {
    if (!actor) return [];
    return catalog
      .filter((c) => c.published && c.cast.some((m) => m.actorId === actor.id))
      .map((item) => {
        const assignment = item.cast.find((m) => m.actorId === actor.id);
        return { item, characterName: assignment?.characterName || '' };
      });
  }, [actor, catalog]);

  if (!actor) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto bg-black/82 backdrop-blur-md p-3 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/12 bg-[#111218] shadow-[0_32px_90px_rgba(0,0,0,0.9)] animate-modal-in my-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white hover:bg-[#E50914] hover:border-[#E50914] transition-all cursor-pointer"
          aria-label="Закрыть профиль актёра"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-5">
          {/* Left Portrait */}
          <div className="md:col-span-2 relative min-h-[280px] md:min-h-[420px] bg-[#09090D]">
            <MediaImg
              srcRef={actor.photo}
              alt={actor.name}
              fallbackLabel={actor.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#111218] via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-[#111218]/40" />
          </div>

          {/* Right Bio & Filmography */}
          <div className="md:col-span-3 p-6 sm:p-8 space-y-5 max-h-[82vh] overflow-y-auto">
            <div className="space-y-1.5 pr-8">
              <span className="inline-block rounded-full border border-[#E50914]/35 bg-[#E50914]/15 px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#ff4d56]">
                Артист F304Lteam
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                {actor.name}
              </h2>
              <p className="text-sm text-zinc-400">{actor.role}</p>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-zinc-300">
              {actor.city && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 border border-white/10">
                  <MapPin className="h-3.5 w-3.5 text-[#E50914]" />
                  {actor.city}
                </span>
              )}
              {actor.birthYear > 0 && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 border border-white/10">
                  <Calendar className="h-3.5 w-3.5 text-[#E50914]" />
                  {actor.birthYear} г.р.
                </span>
              )}
              {actor.socialHandle && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 border border-white/10 font-mono">
                  <AtSign className="h-3.5 w-3.5 text-[#E50914]" />
                  {actor.socialHandle.replace(/^@/, '')}
                </span>
              )}
            </div>

            {actor.awards && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
                <Award className="h-4 w-4 text-amber-400 shrink-0" />
                <span>{actor.awards}</span>
              </div>
            )}

            <p className="text-sm leading-relaxed text-zinc-300">{actor.bio}</p>

            {/* Filmography */}
            <div className="space-y-3 pt-3 border-t border-white/10">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">
                Фильмография на F304Lteam ({filmography.length})
              </h3>
              {filmography.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Актёр скоро появится в новых релизах студии.
                </p>
              ) : (
                <div className="space-y-2">
                  {filmography.map(({ item, characterName }) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        onClose();
                        onOpenTitle(item);
                      }}
                      className="group flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.08] hover:border-[#E50914]/45 p-2 text-left transition-all cursor-pointer"
                    >
                      <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg">
                        <MediaImg
                          srcRef={item.poster}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white group-hover:text-[#ff414b] transition-colors truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-zinc-400 truncate">
                          Роль: {characterName || 'Участник проекта'} • {item.year}
                        </p>
                      </div>
                      <span className="shrink-0 rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-amber-400">
                        ★ {item.rating.toFixed(1)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. NEWS DETAIL MODAL (Full Studio Article + Optional Video Clip)           */
/* -------------------------------------------------------------------------- */

interface NewsDetailModalProps {
  post: NewsPost | null;
  onClose: () => void;
}

export const NewsDetailModal: React.FC<NewsDetailModalProps> = ({ post, onClose }) => {
  const resolvedVideo = useMediaUrl(post?.videoUrl);

  useEffect(() => {
    if (!post) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [post, onClose]);

  if (!post) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto bg-black/82 backdrop-blur-md p-3 sm:p-6 md:p-10"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative my-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-white/12 bg-[#111218] shadow-[0_32px_90px_rgba(0,0,0,0.9)] animate-modal-in"
      >
        <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-[#09090D]">
          <MediaImg
            srcRef={post.image}
            alt={post.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111218] via-[#111218]/35 to-black/30" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white hover:bg-[#E50914] hover:border-[#E50914] transition-all cursor-pointer"
            aria-label="Закрыть новость"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="absolute bottom-5 left-6 right-6 space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="rounded-full bg-[#E50914] px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white">
                {post.category}
              </span>
              <span className="font-mono text-xs text-zinc-300">{post.date}</span>
            </div>
            <h2 className="font-display text-xl sm:text-3xl font-extrabold text-white leading-tight">
              {post.title}
            </h2>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <p className="text-base font-medium text-zinc-200 leading-relaxed border-l-2 border-[#E50914] pl-4">
            {post.summary}
          </p>

          {resolvedVideo && (
            <div className="space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                <Film className="h-3.5 w-3.5 text-[#E50914]" />
                Видеоматериал студии
              </p>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                <video
                  src={resolvedVideo}
                  controls
                  playsInline
                  className="w-full max-h-[380px] object-contain"
                />
              </div>
            </div>
          )}

          <div className="space-y-4 text-sm sm:text-base leading-relaxed text-zinc-300">
            {post.content.split('\n').map((paragraph, idx) =>
              paragraph.trim() ? <p key={idx}>{paragraph}</p> : null
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
