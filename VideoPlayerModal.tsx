import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  SkipForward,
  Film,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { Episode, PlaybackPayload, WatchProgressItem } from '../types';
import { useMediaUrl } from './MediaAssets';

interface VideoPlayerModalProps {
  payload: PlaybackPayload | null;
  onClose: () => void;
  onSelectEpisode: (seasonNumber: number, episode: Episode) => void;
  onSaveProgress: (progress: WatchProgressItem) => void;
  initialTime?: number;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  payload,
  onClose,
  onSelectEpisode,
  onSaveProgress,
  initialTime = 0,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const rawVideoRef = useMemo(() => {
    if (!payload) return '';
    if (payload.mode === 'trailer') return payload.item.trailerUrl || payload.item.videoUrl;
    if (payload.mode === 'episode' && payload.episode) {
      return payload.episode.videoUrl || payload.item.trailerUrl;
    }
    return payload.item.videoUrl || payload.item.trailerUrl;
  }, [payload]);

  const resolvedVideoUrl = useMediaUrl(rawVideoRef);
  const resolvedPosterUrl = useMediaUrl(
    payload?.mode === 'episode' && payload.episode?.thumbnail
      ? payload.episode.thumbnail
      : payload?.item.backdrop || payload?.item.poster
  );

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState(false);

  // Compute next episode for series
  const nextEpisodeInfo = useMemo(() => {
    if (!payload || payload.mode !== 'episode' || !payload.episode) return null;
    const seasons = payload.item.seasons || [];
    for (let sIdx = 0; sIdx < seasons.length; sIdx++) {
      const season = seasons[sIdx];
      if (season.number === payload.seasonNumber) {
        const epIdx = season.episodes.findIndex((e) => e.id === payload.episode?.id);
        if (epIdx >= 0 && epIdx + 1 < season.episodes.length) {
          return { seasonNumber: season.number, episode: season.episodes[epIdx + 1] };
        }
        if (sIdx + 1 < seasons.length && seasons[sIdx + 1].episodes.length > 0) {
          return {
            seasonNumber: seasons[sIdx + 1].number,
            episode: seasons[sIdx + 1].episodes[0],
          };
        }
      }
    }
    return null;
  }, [payload]);

  useEffect(() => {
    setVideoError(false);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
  }, [resolvedVideoUrl]);

  // Body scroll lock & keyboard controls
  useEffect(() => {
    if (!payload) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') {
        skipSeconds(10);
      } else if (e.key === 'ArrowLeft') {
        skipSeconds(-10);
      } else if (e.key.toLowerCase() === 'm') {
        toggleMute();
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  // Sync fullscreen status
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  if (!payload) return null;

  const pokeControls = () => {
    setShowControls(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 3000);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
    pokeControls();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const skipSeconds = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
    pokeControls();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const nextTime = Number(e.target.value);
    v.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const cycleRate = () => {
    const rates = [0.75, 1, 1.25, 1.5, 2];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore fullscreen denial
    }
  };

  const saveCurrentProgress = () => {
    if (payload.mode === 'trailer') return;
    const v = videoRef.current;
    if (!v || !v.duration || v.currentTime < 1) return;
    onSaveProgress({
      itemId: payload.item.id,
      episodeId: payload.episode?.id,
      seasonNumber: payload.seasonNumber,
      episodeNumber: payload.episode?.number,
      currentTime: v.currentTime,
      duration: v.duration,
      updatedAt: Date.now(),
    });
  };

  const handleClose = () => {
    saveCurrentProgress();
    onClose();
  };

  const subtitleLabel =
    payload.mode === 'trailer'
      ? 'Официальный трейлер'
      : payload.mode === 'episode' && payload.episode
        ? `Сезон ${payload.seasonNumber} • Серия ${payload.episode.number} — ${payload.episode.title}`
        : `${payload.item.year} • ${payload.item.quality} • ${payload.item.duration}`;

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={pokeControls}
      onClick={pokeControls}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/98 backdrop-blur-xl animate-modal-in select-none"
    >
      {/* Video Element */}
      {resolvedVideoUrl && !videoError ? (
        <video
          ref={videoRef}
          src={resolvedVideoUrl}
          poster={resolvedPosterUrl}
          autoPlay
          playsInline
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setDuration(v.duration || 0);
            v.volume = volume;
            v.playbackRate = playbackRate;
            if (initialTime > 2 && initialTime < (v.duration || 0) - 3) {
              v.currentTime = initialTime;
            }
          }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            setCurrentTime(v.currentTime);
            if (Math.floor(v.currentTime) % 5 === 0) {
              saveCurrentProgress();
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => {
            setIsPlaying(false);
            saveCurrentProgress();
          }}
          onEnded={() => {
            setIsPlaying(false);
            saveCurrentProgress();
            setShowControls(true);
          }}
          onError={() => setVideoError(true)}
          className="h-full w-full max-h-screen object-contain"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-center px-6 max-w-md space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-[#E50914]/15 border border-[#E50914]/30 flex items-center justify-center">
            {videoError ? (
              <AlertCircle className="h-8 w-8 text-[#E50914]" />
            ) : (
              <Film className="h-8 w-8 text-[#E50914]" />
            )}
          </div>
          <h3 className="font-display text-lg font-bold text-white">
            {videoError ? 'Не удалось воспроизвести видеофайл' : 'Видео ещё не загружено'}
          </h3>
          <p className="text-sm text-zinc-400">
            Добавьте видеофайл напрямую из галереи устройства в админ-панели F304Lteam, чтобы
            смотреть этот релиз в онлайн-плеере.
          </p>
          <button
            onClick={handleClose}
            className="rounded-xl bg-white/10 hover:bg-white/20 px-5 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            Вернуться в каталог
          </button>
        </div>
      )}

      {/* Top Gradient & Header */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/90 via-black/45 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 sm:p-6 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-[#E50914] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white">
              <Sparkles className="h-2.5 w-2.5" />
              {payload.mode === 'trailer' ? 'ТРЕЙЛЕР' : 'F304L CINEMA'}
            </span>
            <span className="rounded border border-white/15 bg-black/50 px-2 py-0.5 font-mono text-[10px] text-zinc-300">
              {payload.item.quality}
            </span>
          </div>
          <h2 className="font-display text-lg sm:text-2xl font-bold text-white tracking-tight">
            {payload.item.title}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300">{subtitleLabel}</p>
        </div>

        <button
          onClick={handleClose}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white hover:bg-[#E50914] hover:border-[#E50914] transition-all cursor-pointer"
          aria-label="Закрыть плеер"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Center Play Indicator when paused */}
      {!isPlaying && resolvedVideoUrl && !videoError && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="absolute z-20 flex h-20 w-20 items-center justify-center rounded-full bg-[#E50914]/90 text-white shadow-[0_0_50px_rgba(229,9,20,0.6)] hover:scale-105 transition-transform cursor-pointer"
          aria-label="Воспроизвести"
        >
          <Play className="h-9 w-9 fill-white ml-1" />
        </button>
      )}

      {/* Bottom Controls Bar */}
      {resolvedVideoUrl && !videoError && (
        <>
          <div
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}
          />

          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute inset-x-0 bottom-0 z-20 px-4 pb-5 pt-4 sm:px-8 sm:pb-7 space-y-3 transition-all duration-300 ${
              showControls
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            {/* Next episode quick pill */}
            {nextEpisodeInfo && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    saveCurrentProgress();
                    onSelectEpisode(nextEpisodeInfo.seasonNumber, nextEpisodeInfo.episode);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 hover:bg-[#E50914] hover:border-[#E50914] backdrop-blur-md px-4 py-2 text-xs font-semibold text-white transition-all cursor-pointer"
                >
                  <SkipForward className="h-4 w-4" />
                  Следующая серия: С{nextEpisodeInfo.seasonNumber} • Э
                  {nextEpisodeInfo.episode.number} «{nextEpisodeInfo.episode.title}»
                </button>
              </div>
            )}

            {/* Scrubber */}
            <div className="group relative flex items-center gap-3">
              <span className="font-mono text-xs text-zinc-300 w-12">
                {formatTime(currentTime)}
              </span>
              <div className="relative flex-1 h-2 flex items-center">
                <div className="h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full bg-[#E50914] rounded-full transition-all duration-100"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  aria-label="Перемотка видео"
                />
              </div>
              <span className="font-mono text-xs text-zinc-400 w-12 text-right">
                {formatTime(duration)}
              </span>
            </div>

            {/* Control Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={togglePlay}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black hover:bg-[#E50914] hover:text-white transition-colors cursor-pointer"
                  aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 fill-current" />
                  ) : (
                    <Play className="h-5 w-5 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => skipSeconds(-10)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  title="Назад 10 сек"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => skipSeconds(10)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  title="Вперёд 10 сек"
                >
                  <RotateCw className="h-4 w-4" />
                </button>

                {/* Volume */}
                <div className="hidden sm:flex items-center gap-2 pl-2">
                  <button
                    onClick={toggleMute}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                    aria-label="Звук"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-20 accent-[#E50914] cursor-pointer"
                    aria-label="Громкость"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={cycleRate}
                  className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 px-3 py-1.5 font-mono text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
                  title="Скорость воспроизведения"
                >
                  {playbackRate}x
                </button>

                <button
                  onClick={toggleFullscreen}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 text-zinc-200 transition-colors cursor-pointer"
                  aria-label="На весь экран"
                >
                  {isFullscreen ? (
                    <Minimize className="h-4 w-4" />
                  ) : (
                    <Maximize className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
