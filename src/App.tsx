import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Film,
  Plus,
  Check,
  Info,
  Search,
  X,
  Menu,
  Star,
  Volume2,
  VolumeX,
  Sparkles,
  Bookmark,
  Newspaper,
  Users,
  Calendar,
  ArrowUpRight,
  SlidersHorizontal,
  Clapperboard,
  Tv,
  Radio,
} from 'lucide-react';
import {
  Actor,
  CatalogItem,
  Episode,
  NewsPost,
  PlaybackPayload,
  StudioData,
  WatchProgressItem,
} from './types';
import { INITIAL_STUDIO_DATA } from './data/initialData';
import { MediaImg, useMediaUrl } from './components/MediaAssets';
import { CinemaRail, TitleCard } from './components/CinemaRails';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import {
  ActorProfileModal,
  NewsDetailModal,
  TitleDetailModal,
} from './components/DetailModals';
import { AdminGateModal } from './components/AdminGateModal';
import { AdminPanel } from './components/AdminPanel';
import { LandingSections, RevealBlock } from './components/LandingSections';
import { ServerSyncBar } from './components/ServerSyncBar';
import {
  POLL_INTERVAL_MS,
  pullData,
  pullIfChanged,
  pullUserState,
  pushData,
  pushList,
  pushProgress,
  readLocalData,
  readLocalList,
  readLocalProgress,
  canWriteRemote,
  hasPending,
  markPending,
  syncAvailable,
  writeLocalData,
  writeLocalList,
} from './utils/sync';

const STORAGE_MYLIST_KEY = 'f304lteam_mylist_v1';

function loadInitialData(): StudioData {
  const parsed = readLocalData();
  if (parsed && Array.isArray(parsed.catalog) && Array.isArray(parsed.actors)) {
    return {
      catalog: parsed.catalog,
      actors: parsed.actors,
      news: Array.isArray(parsed.news) ? parsed.news : INITIAL_STUDIO_DATA.news,
      settings: parsed.settings || INITIAL_STUDIO_DATA.settings,
    };
  }
  return INITIAL_STUDIO_DATA;
}

function loadMyList(): string[] {
  const list = readLocalList();
  if (!list.length && !localStorage.getItem(STORAGE_MYLIST_KEY)) {
    return ['series-nochnoi-kod'];
  }
  return list;
}

function loadProgressMap(): Record<string, WatchProgressItem> {
  return readLocalProgress();
}

export default function App() {
  const [studioData, setStudioData] = useState<StudioData>(loadInitialData);
  const [myList, setMyList] = useState<string[]>(loadMyList);
  const [progressMap, setProgressMap] =
    useState<Record<string, WatchProgressItem>>(loadProgressMap);

  // Navigation & UI states
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  // Hero Spotlight states
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroVideoEnabled, setHeroVideoEnabled] = useState(false);
  const [heroMuted, setHeroMuted] = useState(true);

  // Catalog Filters
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<
    'all' | 'series' | 'movie' | 'new' | 'mylist'
  >('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('Все');
  const [catalogSort, setCatalogSort] = useState<'newest' | 'rating' | 'title'>('newest');

  // Active Modals
  const [activeTitle, setActiveTitle] = useState<CatalogItem | null>(null);
  const [activeActor, setActiveActor] = useState<Actor | null>(null);
  const [activeNews, setActiveNews] = useState<NewsPost | null>(null);
  const [playback, setPlayback] = useState<PlaybackPayload | null>(null);

  // Hidden Admin Gate (triple-click on textual "F304Lteam" logo)
  const [adminGateOpen, setAdminGateOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const secretClickCountRef = useRef(0);
  const secretClickTimerRef = useRef<number | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  // ---------------------------------------------------------------- синхронизация
  const [syncOnline, setSyncOnline] = useState(syncAvailable());
  const [syncing, setSyncing] = useState(false);
  // Состояние сохранения правок: отправлено / отправляется / только локально
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>(
    hasPending() ? 'unsaved' : 'saved'
  );

  // Данные с сервера имеют приоритет; локальные правки уходят на сервер
  const applyRemote = useCallback((next: StudioData) => {
    setStudioData(next);
  }, []);

  const handleManualRefresh = useCallback(async () => {
    setSyncing(true);
    const remote = await pullIfChanged();
    if (remote) {
      applyRemote(remote);
      notify('Данные обновлены с сервера');
    } else {
      notify('Изменений на сервере нет');
    }
    const userState = await pullUserState();
    if (userState.list) setMyList(userState.list);
    setSyncing(false);
  }, [applyRemote, notify]);

  // Первичная загрузка: сервер -> устройство (или выгрузка локальных данных)
  useEffect(() => {
    let alive = true;
    (async () => {
      setSyncing(true);
      const result = await pullData(loadInitialData());
      if (!alive) return;
      if (result.data) applyRemote(result.data);
      setSyncOnline(result.fromServer || syncAvailable());
      const userState = await pullUserState();
      if (!alive) return;
      if (userState.list) setMyList(userState.list);
      if (userState.progress) {
        setProgressMap((prev) => ({ ...userState.progress, ...prev }));
      }
      setSyncing(false);
    })();
    return () => {
      alive = false;
    };
  }, [applyRemote]);

  // Опрос сервера: изменения, сделанные с другого устройства
  useEffect(() => {
    if (!syncAvailable()) return;
    const tick = async () => {
      if (document.hidden) return;
      const remote = await pullIfChanged();
      if (remote) {
        applyRemote(remote);
        notify('Каталог обновлён с другого устройства');
      }
    };
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [applyRemote, notify]);

  // Отправка правок на сервер. Правка сохраняется локально сразу (страховка
  // от потери при перезагрузке) и уходит на сервер; пока не ушла — помечена
  // как неотправленная, и серверная копия её не перетирает.
  const pushTimerRef = useRef<number | null>(null);
  const lastPushedRef = useRef<string>('');
  const pushedOnceRef = useRef(false);

  useEffect(() => {
    writeLocalData(studioData);
    // Первый рендер — это данные, только что полученные с сервера
    if (!pushedOnceRef.current) {
      pushedOnceRef.current = true;
      lastPushedRef.current = JSON.stringify(studioData);
      return;
    }

    const serialized = JSON.stringify(studioData);
    if (serialized === lastPushedRef.current) return;

    // Сразу фиксируем локально и помечаем как «не отправлено» — даже если
    // вкладку закроют через секунду, правка не потеряется.
    markPending(true);
    setSaveState('saving');

    if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current);
    pushTimerRef.current = window.setTimeout(async () => {
      if (!canWriteRemote()) {
        setSaveState('unsaved');
        notify('Правки сохранены на устройстве и уйдут в общую базу, как только появится связь');
        return;
      }
      try {
        await pushData(studioData);
        lastPushedRef.current = serialized;
        markPending(false);
        setSaveState('saved');
        setSyncOnline(true);
        notify('Изменения сохранены в общей базе');
      } catch (err) {
        setSaveState('unsaved');
        setSyncOnline(false);
        notify(
          err instanceof Error
            ? `Не сохранено на сервер: ${err.message}`
            : 'Не сохранено на сервер — данные остались на устройстве'
        );
      }
    }, 700);
    return () => {
      if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current);
    };
  }, [studioData, notify]);

  // Фоновая досылка: если правка не ушла (пропала сеть), повторяем
  useEffect(() => {
    const id = window.setInterval(async () => {
      if (!hasPending() || !canWriteRemote() || document.hidden) return;
      try {
        await pushData(studioData);
        lastPushedRef.current = JSON.stringify(studioData);
        markPending(false);
        setSaveState('saved');
        setSyncOnline(true);
      } catch {
        /* попробуем снова позже */
      }
    }, 30_000);
    return () => window.clearInterval(id);
  }, [studioData]);

  // Не даём потерять неотправленную правку при закрытии вкладки
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPending()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // «Мой список» синхронизируется между устройствами
  const listPushSkippedRef = useRef(true);
  useEffect(() => {
    writeLocalList(myList);
    // Первый прогон — это значения, полученные с сервера
    if (listPushSkippedRef.current) {
      listPushSkippedRef.current = false;
      return;
    }
    pushList(myList);
  }, [myList]);

  // Прогресс просмотра отправляется точечно из handleSaveWatchProgress

  // Sticky navbar scroll effect
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Secret triple-click handler on textual brand title "F304Lteam"
  const handleSecretBrandClick = (e: React.MouseEvent) => {
    e.preventDefault();
    secretClickCountRef.current += 1;

    if (secretClickTimerRef.current) {
      window.clearTimeout(secretClickTimerRef.current);
    }

    if (secretClickCountRef.current >= 3) {
      secretClickCountRef.current = 0;
      setAdminGateOpen(true);
      return;
    }

    secretClickTimerRef.current = window.setTimeout(() => {
      // If user clicked once normally, scroll gently to top
      if (secretClickCountRef.current === 1) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      secretClickCountRef.current = 0;
    }, 550);
  };

  // Published items & derived slices
  const publishedCatalog = useMemo(
    () => studioData.catalog.filter((item) => item.published),
    [studioData.catalog]
  );

  const featuredItems = useMemo(() => {
    const featured = publishedCatalog.filter((item) => item.isFeatured);
    return featured.length > 0 ? featured : publishedCatalog.slice(0, 3);
  }, [publishedCatalog]);

  const safeHeroIndex = featuredItems.length > 0 ? heroIndex % featuredItems.length : 0;
  const heroItem = featuredItems[safeHeroIndex] || null;
  const resolvedHeroVideo = useMediaUrl(heroItem?.trailerUrl);

  // Auto-rotate hero every 12s when video preview is off
  useEffect(() => {
    if (heroVideoEnabled || featuredItems.length <= 1) return;
    const id = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % featuredItems.length);
    }, 12000);
    return () => window.clearInterval(id);
  }, [heroVideoEnabled, featuredItems.length]);

  const continueWatchingItems = useMemo(() => {
    const entries = Object.values(progressMap).sort((a, b) => b.updatedAt - a.updatedAt);
    return entries
      .map((p) => publishedCatalog.find((c) => c.id === p.itemId))
      .filter(Boolean) as CatalogItem[];
  }, [progressMap, publishedCatalog]);

  const myListItems = useMemo(
    () => publishedCatalog.filter((item) => myList.includes(item.id)),
    [publishedCatalog, myList]
  );

  const newItems = useMemo(
    () => publishedCatalog.filter((item) => item.isNew),
    [publishedCatalog]
  );

  const seriesItems = useMemo(
    () => publishedCatalog.filter((item) => item.type === 'series'),
    [publishedCatalog]
  );

  const movieItems = useMemo(
    () => publishedCatalog.filter((item) => item.type === 'movie'),
    [publishedCatalog]
  );

  const allGenresInCatalog = useMemo(() => {
    const set = new Set<string>();
    publishedCatalog.forEach((item) => item.genres.forEach((g) => set.add(g)));
    return ['Все', ...Array.from(set)];
  }, [publishedCatalog]);

  const filteredCatalogGrid = useMemo(() => {
    let list = [...publishedCatalog];

    if (catalogTypeFilter === 'series') list = list.filter((i) => i.type === 'series');
    else if (catalogTypeFilter === 'movie') list = list.filter((i) => i.type === 'movie');
    else if (catalogTypeFilter === 'new') list = list.filter((i) => i.isNew);
    else if (catalogTypeFilter === 'mylist') list = list.filter((i) => myList.includes(i.id));

    if (selectedGenre !== 'Все') {
      list = list.filter((i) => i.genres.includes(selectedGenre));
    }

    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase();
      list = list.filter((item) => {
        const actorNames = item.cast
          .map((c) => studioData.actors.find((a) => a.id === c.actorId)?.name || '')
          .join(' ')
          .toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.genres.some((g) => g.toLowerCase().includes(q)) ||
          actorNames.includes(q)
        );
      });
    }

    if (catalogSort === 'rating') {
      list.sort((a, b) => b.rating - a.rating);
    } else if (catalogSort === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    } else {
      list.sort((a, b) => b.year - a.year || b.createdAt.localeCompare(a.createdAt));
    }

    return list;
  }, [
    publishedCatalog,
    catalogTypeFilter,
    selectedGenre,
    globalSearch,
    catalogSort,
    myList,
    studioData.actors,
  ]);

  const sortedNews = useMemo(() => {
    return [...studioData.news].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.date.localeCompare(a.date);
    });
  }, [studioData.news]);

  const totalEpisodesCount = useMemo(
    () =>
      publishedCatalog.reduce(
        (acc, item) =>
          acc +
          (item.type === 'series'
            ? item.seasons.reduce((sAcc, s) => sAcc + s.episodes.length, 0)
            : 1),
        0
      ),
    [publishedCatalog]
  );

  // Actions
  const handleToggleMyList = (id: string) => {
    const exists = myList.includes(id);
    setMyList((prev) => (exists ? prev.filter((x) => x !== id) : [id, ...prev]));
    const item = studioData.catalog.find((c) => c.id === id);
    notify(
      exists
        ? `«${item?.title || 'Релиз'}» убран из Моего списка`
        : `«${item?.title || 'Релиз'}» добавлен в Мой список`
    );
  };

  const handleQuickPlay = (item: CatalogItem) => {
    if (item.type === 'series') {
      const saved = progressMap[item.id];
      if (saved?.episodeId) {
        for (const s of item.seasons) {
          const ep = s.episodes.find((e) => e.id === saved.episodeId);
          if (ep) {
            setPlayback({ item, mode: 'episode', seasonNumber: s.number, episode: ep });
            return;
          }
        }
      }
      const firstSeason = item.seasons[0];
      const firstEp = firstSeason?.episodes[0];
      if (firstSeason && firstEp) {
        setPlayback({ item, mode: 'episode', seasonNumber: firstSeason.number, episode: firstEp });
        return;
      }
    }
    setPlayback({ item, mode: item.type === 'movie' ? 'movie' : 'trailer' });
  };

  const handlePlayTrailer = (item: CatalogItem) => {
    setPlayback({ item, mode: 'trailer' });
  };

  const lastProgressPushRef = useRef<Record<string, number>>({});

  const handleSaveWatchProgress = (progress: WatchProgressItem) => {
    setProgressMap((prev) => ({
      ...prev,
      [progress.itemId]: progress,
    }));
    // Отправляем на сервер, чтобы продолжить просмотр на другом устройстве.
    // Троттлинг: не чаще раза в 20 секунд на релиз, чтобы не заваливать сервер.
    const last = lastProgressPushRef.current[progress.itemId] || 0;
    if (Date.now() - last > 20_000) {
      lastProgressPushRef.current[progress.itemId] = Date.now();
      void pushProgress(progress);
    }
  };

  const handleSelectEpisodeInPlayer = (seasonNumber: number, episode: Episode) => {
    if (!playback) return;
    setPlayback({
      item: playback.item,
      mode: 'episode',
      seasonNumber,
      episode,
    });
  };

  const scrollToSection = (id: string, filterType?: 'series' | 'movie') => {
    setMobileMenuOpen(false);
    if (filterType) {
      setCatalogTypeFilter(filterType);
      setSelectedGenre('Все');
    }
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Keep activeTitle fresh when updated from AdminPanel
  const syncedActiveTitle = useMemo(() => {
    if (!activeTitle) return null;
    return studioData.catalog.find((c) => c.id === activeTitle.id) || null;
  }, [activeTitle, studioData.catalog]);

  const syncedActiveActor = useMemo(() => {
    if (!activeActor) return null;
    return studioData.actors.find((a) => a.id === activeActor.id) || null;
  }, [activeActor, studioData.actors]);

  return (
    <div className="min-h-screen bg-[#08080A] text-[#F5F5F7] cinema-grain relative">
      {/* =================================================================== */}
      {/* TOP ANNOUNCEMENT TICKER (Toggleable from Admin Panel)               */}
      {/* =================================================================== */}
      {studioData.settings.announcementEnabled && studioData.settings.announcementText && (
        <div className="relative z-50 bg-gradient-to-r from-[#8E050C] via-[#E50914] to-[#8E050C] px-4 py-1.5 text-center text-[11px] sm:text-xs font-semibold text-white">
          <div className="mx-auto max-w-7xl flex items-center justify-center gap-2">
            <Radio className="h-3.5 w-3.5 shrink-0 animate-pulse" />
            <span className="truncate">{studioData.settings.announcementText}</span>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* STICKY GLASSMORPHIC NAVBAR                                          */}
      {/* =================================================================== */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'glass-nav border-b border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.65)]'
            : 'bg-gradient-to-b from-black/85 via-black/45 to-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 sm:h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* LEFT: Brand Wordmark (TRIPLE-CLICK ON TEXTUAL TITLE OPENS HIDDEN ADMIN GATE!) */}
          <div className="flex items-center gap-7">
            <div className="flex items-center gap-2.5 select-none">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E50914] shadow-[0_0_20px_rgba(229,9,20,0.5)]">
                <Play className="h-4 w-4 fill-white text-white ml-0.5" />
              </span>
              <button
                type="button"
                onClick={handleSecretBrandClick}
                className="font-display text-lg sm:text-xl font-black tracking-tight text-white hover:text-zinc-100 transition-colors cursor-pointer select-none focus:outline-none"
                aria-label="F304Lteam"
              >
                F304L<span className="text-[#E50914]">team</span>
              </button>
            </div>

            {/* Desktop Nav Links */}
            <nav className="hidden lg:flex items-center gap-1">
              {[
                { label: 'Главная', action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
                { label: 'Каталог', action: () => scrollToSection('catalog') },
                { label: 'Сериалы', action: () => scrollToSection('catalog', 'series') },
                { label: 'Фильмы', action: () => scrollToSection('catalog', 'movie') },
                { label: 'Актёры', action: () => scrollToSection('actors') },
                { label: 'Новости', action: () => scrollToSection('news') },
                { label: 'Подписка', action: () => scrollToSection('pricing') },
              ].map((nav) => (
                <button
                  key={nav.label}
                  onClick={nav.action}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-white/8 hover:text-white transition-colors cursor-pointer"
                >
                  {nav.label}
                </button>
              ))}
            </nav>
          </div>

          {/* RIGHT: Search, My List, Primary CTA, Mobile Menu */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Search Toggle */}
            <button
              onClick={() => setSearchOpen((s) => !s)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                searchOpen
                  ? 'border-[#E50914] bg-[#E50914]/15 text-white'
                  : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/12 hover:text-white'
              }`}
              aria-label="Поиск по каталогу"
            >
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>

            {/* My List quick jump */}
            <button
              onClick={() => {
                setCatalogTypeFilter('mylist');
                scrollToSection('catalog');
              }}
              className="relative hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/12 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
            >
              <Bookmark className="h-3.5 w-3.5 text-[#E50914]" />
              Мой список
              {myList.length > 0 && (
                <span className="rounded-full bg-[#E50914] px-1.5 py-0.2 font-mono text-[10px] font-bold text-white">
                  {myList.length}
                </span>
              )}
            </button>

            {/* Watch Premiere Button */}
            {heroItem && (
              <button
                onClick={() => handleQuickPlay(heroItem)}
                className="hidden md:inline-flex items-center gap-1.5 rounded-xl bg-[#E50914] hover:bg-[#ff1c28] px-4 py-2.5 text-xs font-bold text-white shadow-[0_6px_22px_rgba(229,9,20,0.45)] transition-all active:scale-95 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                Смотреть
              </button>
            )}

            {/* Mobile Drawer Trigger */}
            <button
              onClick={() => setMobileMenuOpen((m) => !m)}
              className="flex lg:hidden h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white cursor-pointer"
              aria-label="Меню навигации"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Expandable Live Search Bar */}
        {searchOpen && (
          <div className="border-t border-white/10 bg-[#0B0C11]/95 px-4 py-3 animate-fade-up">
            <div className="mx-auto max-w-3xl relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#E50914]" />
              <input
                type="text"
                autoFocus
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  if (e.target.value.trim()) {
                    const el = document.getElementById('catalog');
                    if (el && window.scrollY < 300) {
                      el.scrollIntoView({ behavior: 'smooth' });
                    }
                  }
                }}
                placeholder="Найти фильм, сериал, жанр или актёра F304Lteam..."
                className="w-full rounded-2xl border border-white/15 bg-[#14151F] pl-11 pr-10 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-[#E50914] focus:outline-none"
              />
              {globalSearch && (
                <button
                  onClick={() => setGlobalSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-white/10 bg-[#0C0D12]/98 backdrop-blur-xl px-4 py-4 space-y-1.5">
            {[
              { label: 'Главная', action: () => { setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); } },
              { label: 'Весь каталог', action: () => scrollToSection('catalog') },
              { label: 'Оригинальные сериалы', action: () => scrollToSection('catalog', 'series') },
              { label: 'Полнометражные фильмы', action: () => scrollToSection('catalog', 'movie') },
              { label: `Мой список (${myList.length})`, action: () => { setCatalogTypeFilter('mylist'); scrollToSection('catalog'); } },
              { label: 'Актёры студии', action: () => scrollToSection('actors') },
              { label: 'Новости и съёмки', action: () => scrollToSection('news') },
              { label: 'Подписка F304L+', action: () => scrollToSection('pricing') },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="block w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-zinc-200 hover:bg-white/8 hover:text-white cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* =================================================================== */}
      {/* FULL-BLEED CINEMATIC HERO BILLBOARD (NETFLIX STYLE)                 */}
      {/* =================================================================== */}
      {heroItem && (
        <section className="relative -mt-16 sm:-mt-20 min-h-[86vh] sm:min-h-[92vh] flex items-end overflow-hidden">
          {/* Background Backdrop Image or Live Ambient Video Preview */}
          <div className="absolute inset-0">
            {heroVideoEnabled && resolvedHeroVideo ? (
              <video
                key={resolvedHeroVideo}
                src={resolvedHeroVideo}
                autoPlay
                loop
                muted={heroMuted}
                playsInline
                className="h-full w-full object-cover scale-102"
              />
            ) : (
              <MediaImg
                key={heroItem.id}
                srcRef={heroItem.backdrop || heroItem.poster}
                alt={heroItem.title}
                className="h-full w-full object-cover object-center transition-all duration-1000"
              />
            )}

            {/* Layered Prestige Cinema Gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#08080A] via-[#08080A]/55 to-black/35" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#08080A] via-[#08080A]/65 to-transparent" />
            <div className="pointer-events-none absolute -bottom-24 left-1/4 h-72 w-96 rounded-full bg-[#E50914]/20 blur-[120px] animate-ambient" />
          </div>

          {/* Hero Content */}
          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-36 pb-16 sm:pb-24">
            <div className="max-w-2xl space-y-5 animate-fade-up">
              {/* Studio Original Badge */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E50914] px-3 py-1 font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-[0_0_24px_rgba(229,9,20,0.55)]">
                  <Sparkles className="h-3 w-3" />
                  F304Lteam Originals
                </span>
                <span className="rounded-full border border-white/15 bg-black/50 backdrop-blur-md px-3 py-1 font-mono text-[11px] text-zinc-200">
                  {heroItem.type === 'series' ? 'Оригинальный сериал' : 'Полнометражный фильм'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/15 px-2.5 py-1 font-mono text-[11px] font-bold text-amber-300">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {heroItem.rating.toFixed(1)}
                </span>
              </div>

              {/* Hero Display Title */}
              <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.08] drop-shadow-[0_12px_32px_rgba(0,0,0,0.8)]">
                {heroItem.title}
              </h1>

              {/* Metadata Pills */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-zinc-200">
                <span className="font-mono font-semibold text-white">{heroItem.year}</span>
                <span className="text-zinc-500">•</span>
                <span className="rounded border border-white/25 bg-black/40 px-1.5 py-0.5 font-mono text-[11px]">
                  {heroItem.ageRating}
                </span>
                <span className="rounded bg-white/12 px-2 py-0.5 font-mono text-[11px] font-semibold">
                  {heroItem.quality}
                </span>
                <span className="text-zinc-500">•</span>
                <span>{heroItem.duration}</span>
                <span className="hidden sm:inline text-zinc-500">•</span>
                <span className="hidden sm:inline text-zinc-300">
                  {heroItem.genres.slice(0, 3).join(', ')}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm sm:text-base lg:text-lg text-zinc-200/90 leading-relaxed line-clamp-3">
                {heroItem.description}
              </p>

              {/* Hero Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => handleQuickPlay(heroItem)}
                  className="inline-flex items-center gap-2.5 rounded-2xl bg-[#E50914] hover:bg-[#ff1c28] px-7 py-3.5 text-sm sm:text-base font-bold text-white shadow-[0_14px_38px_rgba(229,9,20,0.5)] transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                  <Play className="h-5 w-5 fill-white" />
                  Смотреть сейчас
                </button>

                {heroItem.trailerUrl && (
                  <button
                    onClick={() => handlePlayTrailer(heroItem)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur-md px-5 py-3.5 text-sm font-semibold text-white transition-all cursor-pointer"
                  >
                    <Film className="h-4 w-4 text-[#E50914]" />
                    Трейлер
                  </button>
                )}

                <button
                  onClick={() => setActiveTitle(heroItem)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-black/45 hover:bg-white/15 backdrop-blur-md px-5 py-3.5 text-sm font-semibold text-white transition-all cursor-pointer"
                >
                  <Info className="h-4 w-4" />
                  {heroItem.type === 'series' ? 'Серии и актёры' : 'Подробнее'}
                </button>

                <button
                  onClick={() => handleToggleMyList(heroItem.id)}
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border backdrop-blur-md transition-all cursor-pointer ${
                    myList.includes(heroItem.id)
                      ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
                      : 'border-white/15 bg-black/45 hover:bg-white/15 text-white'
                  }`}
                  title={
                    myList.includes(heroItem.id)
                      ? 'Убрать из Моего списка'
                      : 'Добавить в Мой список'
                  }
                  aria-label="Мой список"
                >
                  {myList.includes(heroItem.id) ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Bottom-Right Hero Controls: Live Video Preview + Featured Switcher */}
            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
              {/* Featured Releases Selector */}
              <div className="flex flex-wrap items-center gap-2">
                {featuredItems.map((feat, idx) => {
                  const isCurrent = idx === safeHeroIndex;
                  return (
                    <button
                      key={feat.id}
                      onClick={() => {
                        setHeroIndex(idx);
                        setHeroVideoEnabled(false);
                      }}
                      className={`group flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-[#E50914] bg-[#E50914]/20 text-white'
                          : 'border-white/10 bg-black/45 text-zinc-400 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isCurrent ? 'bg-[#E50914]' : 'bg-zinc-600'
                        }`}
                      />
                      <span className="max-w-[140px] truncate">{feat.title}</span>
                    </button>
                  );
                })}
              </div>

              {/* Ambient Trailer Background Toggle */}
              {resolvedHeroVideo && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHeroVideoEnabled((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold backdrop-blur-md transition-all cursor-pointer ${
                      heroVideoEnabled
                        ? 'border-[#E50914]/60 bg-[#E50914]/20 text-white'
                        : 'border-white/15 bg-black/50 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    <Film className="h-3.5 w-3.5 text-[#E50914]" />
                    {heroVideoEnabled ? 'Выкл. живой фон' : 'Живой трейлер на фоне'}
                  </button>

                  {heroVideoEnabled && (
                    <button
                      onClick={() => setHeroMuted((m) => !m)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-black/55 text-white hover:bg-white/15 cursor-pointer"
                      aria-label="Переключить звук фона"
                    >
                      {heroMuted ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* NETFLIX-STYLE HORIZONTAL CINEMA RAILS                               */}
      {/* =================================================================== */}
      <div className="relative z-10 space-y-12 pt-4 pb-16">
        {continueWatchingItems.length > 0 && (
          <CinemaRail
            title="Продолжить просмотр"
            subtitle="Возвращайтесь ровно к тому кадру, где остановились"
            badge="История"
            items={continueWatchingItems}
            myList={myList}
            progressMap={progressMap}
            onOpenDetail={setActiveTitle}
            onQuickPlay={handleQuickPlay}
            onPlayTrailer={handlePlayTrailer}
            onToggleMyList={handleToggleMyList}
          />
        )}

        <CinemaRail
          title="Новинки и премьеры F304Lteam"
          subtitle="Свежие фильмы и сериалы студии в максимальном качестве"
          badge="4K HDR"
          items={newItems.length > 0 ? newItems : publishedCatalog}
          myList={myList}
          progressMap={progressMap}
          onOpenDetail={setActiveTitle}
          onQuickPlay={handleQuickPlay}
          onPlayTrailer={handlePlayTrailer}
          onToggleMyList={handleToggleMyList}
        />

        {myListItems.length > 0 && (
          <CinemaRail
            title="Мой список"
            subtitle="Сохранённые вами фильмы и сериалы для вечернего просмотра"
            badge={`${myListItems.length}`}
            items={myListItems}
            myList={myList}
            progressMap={progressMap}
            onOpenDetail={setActiveTitle}
            onQuickPlay={handleQuickPlay}
            onPlayTrailer={handlePlayTrailer}
            onToggleMyList={handleToggleMyList}
          />
        )}

        <CinemaRail
          title="Оригинальные сериалы"
          subtitle="Многосерийные истории F304Lteam с сезонами и авторскими саундтреками"
          items={seriesItems}
          myList={myList}
          progressMap={progressMap}
          onOpenDetail={setActiveTitle}
          onQuickPlay={handleQuickPlay}
          onPlayTrailer={handlePlayTrailer}
          onToggleMyList={handleToggleMyList}
        />

        <CinemaRail
          title="Полнометражные фильмы"
          subtitle="Авторские триллеры, фантастика и драмы большого экрана"
          items={movieItems}
          myList={myList}
          progressMap={progressMap}
          onOpenDetail={setActiveTitle}
          onQuickPlay={handleQuickPlay}
          onPlayTrailer={handlePlayTrailer}
          onToggleMyList={handleToggleMyList}
        />
      </div>

      {/* =================================================================== */}
      {/* FULL INTERACTIVE CATALOG EXPLORER (SEARCH + FILTERS + GENRES)       */}
      {/* =================================================================== */}
      <section id="catalog" className="scroll-mt-24 py-14 border-t border-white/8 bg-[#0A0B0F]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-7">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-[#ff4d56]">
                <Clapperboard className="h-3.5 w-3.5" />
                Онлайн-кинотека
              </span>
              <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white">
                Полный каталог F304Lteam
              </h2>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/10 bg-[#12131B] p-1.5">
              {[
                { id: 'all' as const, label: 'Все', icon: Sparkles },
                { id: 'series' as const, label: 'Сериалы', icon: Tv },
                { id: 'movie' as const, label: 'Фильмы', icon: Film },
                { id: 'new' as const, label: 'Новинки', icon: Star },
                { id: 'mylist' as const, label: `Мой список (${myList.length})`, icon: Bookmark },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = catalogTypeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCatalogTypeFilter(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? 'bg-[#E50914] text-white shadow'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search, Genre Pills & Sort */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Поиск по названию, жанру или актёру..."
                  className="w-full rounded-xl border border-white/10 bg-[#12131B] pl-10 pr-9 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-[#E50914] focus:outline-none"
                />
                {globalSearch && (
                  <button
                    onClick={() => setGlobalSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-zinc-500 shrink-0" />
                <select
                  value={catalogSort}
                  onChange={(e) =>
                    setCatalogSort(e.target.value as 'newest' | 'rating' | 'title')
                  }
                  className="rounded-xl border border-white/10 bg-[#12131B] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-white focus:border-[#E50914] focus:outline-none cursor-pointer"
                >
                  <option value="newest">Сначала новые</option>
                  <option value="rating">По рейтингу ★</option>
                  <option value="title">По алфавиту А–Я</option>
                </select>
              </div>
            </div>

            {/* Genre Chips */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {allGenresInCatalog.map((genre) => (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    selectedGenre === genre
                      ? 'bg-white text-black'
                      : 'border border-white/10 bg-white/[0.04] text-zinc-400 hover:border-white/25 hover:text-white'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {/* Results Grid */}
          {filteredCatalogGrid.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/12 bg-[#11121A] py-16 px-6 text-center space-y-3">
              <Film className="h-10 w-10 text-zinc-600 mx-auto" />
              <h3 className="font-display text-lg font-bold text-white">
                По вашему запросу ничего не найдено
              </h3>
              <p className="text-sm text-zinc-400 max-w-md mx-auto">
                Попробуйте сбросить фильтры или выбрать другой жанр из каталога F304Lteam.
              </p>
              <button
                onClick={() => {
                  setCatalogTypeFilter('all');
                  setSelectedGenre('Все');
                  setGlobalSearch('');
                }}
                className="rounded-xl bg-[#E50914] px-5 py-2.5 text-xs font-bold text-white cursor-pointer"
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCatalogGrid.map((item) => (
                <TitleCard
                  key={item.id}
                  item={item}
                  variant="grid"
                  inMyList={myList.includes(item.id)}
                  progress={progressMap[item.id]}
                  onOpenDetail={setActiveTitle}
                  onQuickPlay={handleQuickPlay}
                  onPlayTrailer={handlePlayTrailer}
                  onToggleMyList={handleToggleMyList}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* =================================================================== */}
      {/* GENERAL STUDIO ACTORS SECTION (Актёры F304Lteam)                    */}
      {/* =================================================================== */}
      <RevealBlock className="py-20 border-t border-white/8">
        <section id="actors" className="scroll-mt-24 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-[#ff4d56]">
                <Users className="h-3.5 w-3.5" />
                Лица и авторы киностудии
              </span>
              <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white">
                Актёры F304Lteam
              </h2>
              <p className="text-sm text-zinc-400 max-w-xl">
                Нажмите на любого артиста, чтобы открыть его биографию и полную фильмографию в
                проектах студии.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {studioData.actors.map((actor) => {
              const projectsCount = publishedCatalog.filter((c) =>
                c.cast.some((m) => m.actorId === actor.id)
              ).length;
              return (
                <button
                  key={actor.id}
                  onClick={() => setActiveActor(actor)}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12131B] hover:border-[#E50914]/50 hover:-translate-y-1.5 text-left transition-all duration-300 cursor-pointer"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#0A0A0E]">
                    <MediaImg
                      srcRef={actor.photo}
                      alt={actor.name}
                      fallbackLabel={actor.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-106"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#12131B] via-transparent to-transparent" />
                    <span className="absolute top-2.5 right-2.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-200">
                      {projectsCount} {projectsCount === 1 ? 'проект' : 'проекта'}
                    </span>
                  </div>
                  <div className="p-3 space-y-0.5">
                    <h3 className="font-display text-xs sm:text-sm font-bold text-white group-hover:text-[#ff414b] transition-colors truncate">
                      {actor.name}
                    </h3>
                    <p className="text-[11px] text-zinc-400 truncate">{actor.role}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </RevealBlock>

      {/* =================================================================== */}
      {/* STUDIO NEWS & BACKSTAGE FEED (Новости студии)                       */}
      {/* =================================================================== */}
      <RevealBlock className="py-20 border-t border-white/8 bg-[#0A0B0F]">
        <section id="news" className="scroll-mt-24 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.2em] text-[#ff4d56]">
                <Newspaper className="h-3.5 w-3.5" />
                Хроника производства
              </span>
              <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white">
                Новости студии и бэкстейдж
              </h2>
            </div>
          </div>

          {sortedNews.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Featured / First News Card */}
              <article
                onClick={() => setActiveNews(sortedNews[0])}
                className="group lg:col-span-7 relative overflow-hidden rounded-3xl border border-white/10 bg-[#12131B] hover:border-[#E50914]/50 transition-all cursor-pointer flex flex-col justify-end min-h-[360px] sm:min-h-[420px]"
              >
                <div className="absolute inset-0">
                  <MediaImg
                    srcRef={sortedNews[0].image}
                    alt={sortedNews[0].title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C11] via-[#0B0C11]/60 to-black/25" />
                </div>

                <div className="relative z-10 p-6 sm:p-8 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#E50914] px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white">
                      {sortedNews[0].category}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-xs text-zinc-300">
                      <Calendar className="h-3.5 w-3.5" />
                      {sortedNews[0].date}
                    </span>
                    {sortedNews[0].videoUrl && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        <Play className="h-3 w-3 fill-white" />
                        Видео бэкстейдж
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-extrabold text-white group-hover:text-[#ff4d56] transition-colors leading-snug">
                    {sortedNews[0].title}
                  </h3>
                  <p className="text-sm text-zinc-300 line-clamp-2">{sortedNews[0].summary}</p>
                  <span className="inline-flex items-center gap-1 pt-1 text-xs font-bold text-white group-hover:text-[#ff4d56]">
                    Читать полностью
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
              </article>

              {/* Secondary News List */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                {sortedNews.slice(1, 4).map((post) => (
                  <article
                    key={post.id}
                    onClick={() => setActiveNews(post)}
                    className="group flex gap-4 rounded-2xl border border-white/10 bg-[#12131B] hover:border-[#E50914]/45 hover:bg-[#171925] p-3.5 transition-all cursor-pointer flex-1"
                  >
                    <div className="relative h-24 w-28 sm:w-32 shrink-0 overflow-hidden rounded-xl bg-[#0A0A0E]">
                      <MediaImg
                        srcRef={post.image}
                        alt={post.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-106"
                      />
                      {post.videoUrl && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E50914] text-white">
                            <Play className="h-3.5 w-3.5 fill-white ml-0.5" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold uppercase text-[#ff4d56]">
                            {post.category}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-500">{post.date}</span>
                        </div>
                        <h3 className="font-bold text-sm text-white group-hover:text-[#ff4d56] transition-colors line-clamp-2 leading-snug">
                          {post.title}
                        </h3>
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-1 mt-1">{post.summary}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </RevealBlock>

      {/* =================================================================== */}
      {/* CONVERSION LANDING SECTIONS (STATS, FEATURES, REVIEWS, PLANS, FAQ)  */}
      {/* =================================================================== */}
      <LandingSections
        totalReleases={publishedCatalog.length}
        totalActors={studioData.actors.length}
        totalEpisodes={totalEpisodesCount}
        onStartWatching={() => {
          if (heroItem) handleQuickPlay(heroItem);
          else scrollToSection('catalog');
        }}
        onNotify={notify}
      />

      {/* =================================================================== */}
      {/* PRESTIGE STUDIO FOOTER                                              */}
      {/* =================================================================== */}
      <footer className="border-t border-white/10 bg-[#060608] pt-16 pb-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            {/* Brand column (Textual F304Lteam also supports the secret 3-tap gate) */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-2.5 select-none">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E50914]">
                  <Play className="h-4 w-4 fill-white text-white ml-0.5" />
                </span>
                <button
                  type="button"
                  onClick={handleSecretBrandClick}
                  className="font-display text-xl font-black tracking-tight text-white cursor-pointer select-none focus:outline-none"
                >
                  F304L<span className="text-[#E50914]">team</span>
                </button>
              </div>
              <p className="text-sm text-zinc-400 max-w-md leading-relaxed">
                Официальный онлайн-кинотеатр независимой киностудии F304Lteam. Авторские сериалы,
                полнометражные фильмы, трейлеры, актёры и хроника производства в 4K HDR.
              </p>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {studioData.settings.onlineModeLabel}
              </div>
            </div>

            {/* Navigation */}
            <div className="space-y-3">
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-white">
                Разделы
              </h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li>
                  <button
                    onClick={() => scrollToSection('catalog', 'series')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Оригинальные сериалы
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection('catalog', 'movie')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Полнометражные фильмы
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection('actors')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Актёры студии
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection('news')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Новости и кастинги
                  </button>
                </li>
              </ul>
            </div>

            {/* Studio info */}
            <div className="space-y-3">
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-white">
                Студия
              </h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li>
                  <button
                    onClick={() => scrollToSection('pricing')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Подписка F304L+
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection('faq')}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Частые вопросы
                  </button>
                </li>
                <li className="font-mono text-xs text-zinc-500 pt-1">
                  {studioData.settings.studioEmail}
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/8 pt-6 text-xs text-zinc-500">
            <p>© {new Date().getFullYear()} F304Lteam Studio. Все права защищены.</p>
            <p className="font-mono text-[11px] text-zinc-600">
              4K HDR • 60FPS • Без рекламы • Онлайн-кинотеатр студии
            </p>
          </div>
        </div>
      </footer>

      {/* =================================================================== */}
      {/* CINEMA MODALS, VIDEO PLAYER, HIDDEN ADMIN GATE & STUDIO CMS         */}
      {/* =================================================================== */}
      <TitleDetailModal
        item={syncedActiveTitle}
        allCatalog={studioData.catalog}
        actors={studioData.actors}
        inMyList={syncedActiveTitle ? myList.includes(syncedActiveTitle.id) : false}
        progress={syncedActiveTitle ? progressMap[syncedActiveTitle.id] : undefined}
        onClose={() => setActiveTitle(null)}
        onToggleMyList={handleToggleMyList}
        onPlay={(payload) => setPlayback(payload)}
        onOpenTitle={(item) => setActiveTitle(item)}
        onOpenActor={(actor) => setActiveActor(actor)}
        onNotify={notify}
      />

      <ActorProfileModal
        actor={syncedActiveActor}
        catalog={studioData.catalog}
        onClose={() => setActiveActor(null)}
        onOpenTitle={(item) => setActiveTitle(item)}
      />

      <NewsDetailModal post={activeNews} onClose={() => setActiveNews(null)} />

      <VideoPlayerModal
        payload={playback}
        onClose={() => setPlayback(null)}
        onSelectEpisode={handleSelectEpisodeInPlayer}
        onSaveProgress={handleSaveWatchProgress}
        initialTime={
          playback &&
          playback.mode !== 'trailer' &&
          progressMap[playback.item.id]?.episodeId === playback.episode?.id
            ? progressMap[playback.item.id]?.currentTime || 0
            : 0
        }
      />

      <AdminGateModal
        open={adminGateOpen}
        onClose={() => setAdminGateOpen(false)}
        onSuccess={() => {
          setAdminGateOpen(false);
          setAdminPanelOpen(true);
          notify('Доступ открыт • Добро пожаловать в студийную админку F304Lteam');
        }}
      />

      <AdminPanel
        open={adminPanelOpen}
        data={studioData}
        onUpdateData={setStudioData}
        onResetDemo={() => {
          setStudioData(INITIAL_STUDIO_DATA);
          setProgressMap({});
        }}
        onClose={() => setAdminPanelOpen(false)}
        onNotify={notify}
      />

      <ServerSyncBar
        online={syncOnline}
        syncing={syncing || saveState === 'saving'}
        saveState={saveState}
        onRefresh={handleManualRefresh}
      />

      {/* =================================================================== */}
      {/* FLOATING TOAST MICROINTERACTION                                     */}
      {/* =================================================================== */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[130] max-w-sm rounded-2xl border border-white/15 bg-[#151621]/95 backdrop-blur-xl px-4 py-3 text-xs sm:text-sm font-semibold text-white shadow-[0_18px_50px_rgba(0,0,0,0.85)] flex items-center gap-2.5 animate-fade-up">
          <span className="h-2 w-2 rounded-full bg-[#E50914] shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
