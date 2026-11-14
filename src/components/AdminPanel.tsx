import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Film,
  Tv,
  Users,
  Newspaper,
  Settings,
  Plus,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  Star,
  Save,
  Download,
  Upload,
  RotateCcw,
  Check,
  Sparkles,
  Server,
  HardDrive,
  Clapperboard,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import {
  Actor,
  CatalogItem,
  Episode,
  NewsCategory,
  NewsPost,
  Season,
  StudioData,
  TitleType,
} from '../types';
import { AVAILABLE_GENRES } from '../data/initialData';
import { GalleryFilePicker, MediaImg } from './MediaAssets';
import {
  clearAllGalleryMedia,
  formatBytes,
  generateMinimalServerJs,
  getMediaStorageStats,
} from '../utils/mediaStore';

interface AdminPanelProps {
  open: boolean;
  data: StudioData;
  onUpdateData: (next: StudioData) => void;
  onResetDemo: () => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

type AdminTab = 'catalog' | 'actors' | 'news' | 'system';

function createEmptyTitle(type: TitleType = 'series'): CatalogItem {
  return {
    id: `${type}-${Date.now()}`,
    type,
    title: '',
    tagline: '',
    description: '',
    year: new Date().getFullYear(),
    ageRating: '16+',
    rating: 8.8,
    duration: type === 'series' ? '1 сезон' : '1ч 45м',
    quality: '4K HDR',
    genres: ['Триллер'],
    poster: '',
    backdrop: '',
    trailerUrl: '',
    videoUrl: '',
    seasons:
      type === 'series'
        ? [
            {
              id: `s1-${Date.now()}`,
              number: 1,
              title: 'Сезон 1',
              episodes: [
                {
                  id: `ep-${Date.now()}-1`,
                  number: 1,
                  title: 'Пилотная серия',
                  description: '',
                  duration: '45 мин',
                  thumbnail: '',
                  videoUrl: '',
                },
              ],
            },
          ]
        : [],
    cast: [],
    director: 'F304Lteam',
    published: true,
    isFeatured: false,
    isNew: true,
    isTop: false,
    createdAt: new Date().toISOString().slice(0, 10),
  };
}

function createEmptyActor(): Actor {
  return {
    id: `actor-${Date.now()}`,
    name: '',
    role: 'Актёр F304Lteam',
    photo: '',
    bio: '',
    city: 'Москва',
    birthYear: 1998,
    socialHandle: '',
    awards: '',
  };
}

function createEmptyNews(): NewsPost {
  return {
    id: `news-${Date.now()}`,
    title: '',
    category: 'Премьера',
    date: new Date().toISOString().slice(0, 10),
    summary: '',
    content: '',
    image: '',
    videoUrl: '',
    pinned: false,
  };
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  open,
  data,
  onUpdateData,
  onResetDemo,
  onClose,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('catalog');
  const [searchQuery, setSearchQuery] = useState('');

  // Editors
  const [editingTitle, setEditingTitle] = useState<CatalogItem | null>(null);
  const [editingActor, setEditingActor] = useState<Actor | null>(null);
  const [editingNews, setEditingNews] = useState<NewsPost | null>(null);

  // Quick-add actor inline inside Title editor
  const [quickActorName, setQuickActorName] = useState('');
  const [quickActorChar, setQuickActorChar] = useState('');
  const [selectedExistingActorId, setSelectedExistingActorId] = useState('');
  const [selectedExistingChar, setSelectedExistingChar] = useState('');
  const [selectedExistingLead, setSelectedExistingLead] = useState(false);

  // Collapsible seasons in Title editor
  const [expandedSeasonId, setExpandedSeasonId] = useState<string | null>(null);

  // Storage stats
  const [storageStats, setStorageStats] = useState({ count: 0, totalBytes: 0 });
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    getMediaStorageStats().then(setStorageStats);
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, data]);

  if (!open) return null;

  /* ------------------------ CATALOG CRUD HANDLERS ------------------------ */

  const handleSaveTitle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTitle || !editingTitle.title.trim()) {
      onNotify('Введите название фильма или сериала');
      return;
    }

    const prepared: CatalogItem = {
      ...editingTitle,
      backdrop: editingTitle.backdrop || editingTitle.poster,
      poster: editingTitle.poster || editingTitle.backdrop,
      duration:
        editingTitle.type === 'series' && editingTitle.seasons.length > 0
          ? `${editingTitle.seasons.length} ${
              editingTitle.seasons.length === 1 ? 'сезон' : 'сезона'
            } • ${editingTitle.seasons.reduce((s, x) => s + x.episodes.length, 0)} серий`
          : editingTitle.duration || '1ч 45м',
    };

    const exists = data.catalog.some((c) => c.id === prepared.id);
    const nextCatalog = exists
      ? data.catalog.map((c) => (c.id === prepared.id ? prepared : c))
      : [prepared, ...data.catalog];

    onUpdateData({ ...data, catalog: nextCatalog });
    setEditingTitle(null);
    onNotify(
      exists
        ? `Изменения в «${prepared.title}» сохранены`
        : prepared.published
          ? `«${prepared.title}» опубликован в каталоге!`
          : `Черновик «${prepared.title}» сохранён`
    );
  };

  const handleDeleteTitle = (item: CatalogItem) => {
    if (!window.confirm(`Удалить «${item.title}» из каталога F304Lteam?`)) return;
    onUpdateData({
      ...data,
      catalog: data.catalog.filter((c) => c.id !== item.id),
    });
    onNotify(`«${item.title}» удалён из каталога`);
  };

  const toggleTitlePublished = (id: string) => {
    onUpdateData({
      ...data,
      catalog: data.catalog.map((c) =>
        c.id === id ? { ...c, published: !c.published } : c
      ),
    });
  };

  const toggleTitleFeatured = (id: string) => {
    onUpdateData({
      ...data,
      catalog: data.catalog.map((c) =>
        c.id === id ? { ...c, isFeatured: !c.isFeatured } : c
      ),
    });
    onNotify('Статус показа на главном экране обновлён');
  };

  const addSeasonToEditing = () => {
    if (!editingTitle) return;
    const nextNum = editingTitle.seasons.length + 1;
    const newSeason: Season = {
      id: `season-${Date.now()}`,
      number: nextNum,
      title: `Сезон ${nextNum}`,
      episodes: [],
    };
    setEditingTitle({
      ...editingTitle,
      seasons: [...editingTitle.seasons, newSeason],
    });
    setExpandedSeasonId(newSeason.id);
  };

  const deleteSeasonFromEditing = (seasonId: string) => {
    if (!editingTitle) return;
    const filtered = editingTitle.seasons
      .filter((s) => s.id !== seasonId)
      .map((s, idx) => ({ ...s, number: idx + 1 }));
    setEditingTitle({ ...editingTitle, seasons: filtered });
  };

  const addEpisodeToSeason = (seasonId: string) => {
    if (!editingTitle) return;
    setEditingTitle({
      ...editingTitle,
      seasons: editingTitle.seasons.map((s) => {
        if (s.id !== seasonId) return s;
        const epNum = s.episodes.length + 1;
        const newEp: Episode = {
          id: `ep-${Date.now()}-${epNum}`,
          number: epNum,
          title: `Серия ${epNum}`,
          description: '',
          duration: '45 мин',
          thumbnail: editingTitle.backdrop || editingTitle.poster || '',
          videoUrl: '',
        };
        return { ...s, episodes: [...s.episodes, newEp] };
      }),
    });
  };

  const updateEpisodeField = (
    seasonId: string,
    episodeId: string,
    patch: Partial<Episode>
  ) => {
    if (!editingTitle) return;
    setEditingTitle({
      ...editingTitle,
      seasons: editingTitle.seasons.map((s) =>
        s.id !== seasonId
          ? s
          : {
              ...s,
              episodes: s.episodes.map((ep) =>
                ep.id === episodeId ? { ...ep, ...patch } : ep
              ),
            }
      ),
    });
  };

  const deleteEpisodeFromSeason = (seasonId: string, episodeId: string) => {
    if (!editingTitle) return;
    setEditingTitle({
      ...editingTitle,
      seasons: editingTitle.seasons.map((s) =>
        s.id !== seasonId
          ? s
          : {
              ...s,
              episodes: s.episodes
                .filter((ep) => ep.id !== episodeId)
                .map((ep, idx) => ({ ...ep, number: idx + 1 })),
            }
      ),
    });
  };

  const attachExistingActor = () => {
    if (!editingTitle || !selectedExistingActorId) return;
    if (editingTitle.cast.some((c) => c.actorId === selectedExistingActorId)) {
      onNotify('Этот актёр уже добавлен в фильм');
      return;
    }
    setEditingTitle({
      ...editingTitle,
      cast: [
        ...editingTitle.cast,
        {
          actorId: selectedExistingActorId,
          characterName: selectedExistingChar.trim() || 'Роль в фильме',
          isLead: selectedExistingLead,
        },
      ],
    });
    setSelectedExistingActorId('');
    setSelectedExistingChar('');
    setSelectedExistingLead(false);
  };

  const quickCreateAndAttachActor = () => {
    if (!editingTitle || !quickActorName.trim()) return;
    const newActor: Actor = {
      ...createEmptyActor(),
      name: quickActorName.trim(),
    };
    onUpdateData({ ...data, actors: [newActor, ...data.actors] });
    setEditingTitle({
      ...editingTitle,
      cast: [
        ...editingTitle.cast,
        {
          actorId: newActor.id,
          characterName: quickActorChar.trim() || 'Главная роль',
          isLead: true,
        },
      ],
    });
    setQuickActorName('');
    setQuickActorChar('');
    onNotify(`Актёр ${newActor.name} добавлен в базу и привязан к фильму`);
  };

  /* ------------------------ ACTORS CRUD HANDLERS ------------------------- */

  const handleSaveActor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActor || !editingActor.name.trim()) {
      onNotify('Введите имя актёра');
      return;
    }
    const exists = data.actors.some((a) => a.id === editingActor.id);
    const nextActors = exists
      ? data.actors.map((a) => (a.id === editingActor.id ? editingActor : a))
      : [editingActor, ...data.actors];

    onUpdateData({ ...data, actors: nextActors });
    setEditingActor(null);
    onNotify(exists ? 'Профиль актёра обновлён' : `Актёр ${editingActor.name} добавлен`);
  };

  const handleDeleteActor = (actor: Actor) => {
    if (!window.confirm(`Удалить актёра «${actor.name}» из общей базы студии?`)) return;
    onUpdateData({
      ...data,
      actors: data.actors.filter((a) => a.id !== actor.id),
      catalog: data.catalog.map((c) => ({
        ...c,
        cast: c.cast.filter((m) => m.actorId !== actor.id),
      })),
    });
    onNotify(`Актёр «${actor.name}» удалён`);
  };

  /* ------------------------- NEWS CRUD HANDLERS -------------------------- */

  const handleSaveNews = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNews || !editingNews.title.trim()) {
      onNotify('Введите заголовок новости');
      return;
    }
    const exists = data.news.some((n) => n.id === editingNews.id);
    const nextNews = exists
      ? data.news.map((n) => (n.id === editingNews.id ? editingNews : n))
      : [editingNews, ...data.news];

    onUpdateData({ ...data, news: nextNews });
    setEditingNews(null);
    onNotify(exists ? 'Новость обновлена' : 'Новость опубликована на главной!');
  };

  const handleDeleteNews = (post: NewsPost) => {
    if (!window.confirm(`Удалить новость «${post.title}»?`)) return;
    onUpdateData({
      ...data,
      news: data.news.filter((n) => n.id !== post.id),
    });
    onNotify('Новость удалена');
  };

  /* --------------------- JSON / SERVER ONLINE EXPORT --------------------- */

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `f304lteam-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('Файл data.json успешно выгружен');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as StudioData;
        if (Array.isArray(parsed.catalog) && Array.isArray(parsed.actors)) {
          onUpdateData({
            catalog: parsed.catalog,
            actors: parsed.actors,
            news: Array.isArray(parsed.news) ? parsed.news : data.news,
            settings: parsed.settings || data.settings,
          });
          onNotify('Каталог успешно импортирован из JSON!');
        } else {
          onNotify('Ошибка: неверная структура JSON-файла');
        }
      } catch {
        onNotify('Не удалось прочитать JSON-файл');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadServerJs = () => {
    const blob = new Blob([generateMinimalServerJs()], {
      type: 'application/javascript;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'server.js';
    a.click();
    URL.revokeObjectURL(url);
    onNotify('Минимальный server.js (без БД) скачан');
  };

  const filteredCatalog = data.catalog.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.genres.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[105] flex flex-col bg-[#08080C] text-[#F5F5F7] animate-modal-in">
      {/* Top Admin Command Header */}
      <header className="shrink-0 border-b border-white/10 bg-[#0E0F15]/95 backdrop-blur-xl px-4 sm:px-6 py-3.5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E50914] font-mono text-xs font-black text-white shadow-[0_0_24px_rgba(229,9,20,0.45)]">
              304
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-sm sm:text-base font-bold text-white">
                  F304Lteam Studio CMS
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ОНЛАЙН • JSON
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Управление каталогом, сериалами, трейлерами, актёрами и новостями напрямую из
                галереи
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="hidden md:inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-semibold text-zinc-200 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[#E50914]" />
              Скачать JSON
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-[#E50914] px-3.5 py-2 text-xs font-bold text-white transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
              На сайт
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row mx-auto w-full max-w-7xl">
        {/* Sidebar / Top Tabs */}
        <aside className="shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#0B0C11] p-3 lg:w-64 lg:p-4 overflow-x-auto no-scrollbar">
          <nav className="flex lg:flex-col gap-1.5 min-w-max lg:min-w-0">
            {[
              {
                id: 'catalog' as AdminTab,
                label: 'Фильмы и Сериалы',
                count: data.catalog.length,
                icon: Clapperboard,
              },
              {
                id: 'actors' as AdminTab,
                label: 'Актёры студии',
                count: data.actors.length,
                icon: Users,
              },
              {
                id: 'news' as AdminTab,
                label: 'Новости студии',
                count: data.news.length,
                icon: Newspaper,
              },
              {
                id: 'system' as AdminTab,
                label: 'JSON / Онлайн-режим',
                count: null,
                icon: Settings,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setEditingTitle(null);
                    setEditingActor(null);
                    setEditingNews(null);
                  }}
                  className={`flex items-center justify-between gap-2.5 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#E50914] text-white shadow-[0_8px_24px_rgba(229,9,20,0.35)]'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0" />
                    {tab.label}
                  </span>
                  {tab.count !== null && (
                    <span
                      className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] ${
                        active ? 'bg-black/25 text-white' : 'bg-white/10 text-zinc-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Compact Media Status Box on Desktop */}
          <div className="hidden lg:block mt-6 rounded-2xl border border-white/8 bg-[#12131B] p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <HardDrive className="h-4 w-4 text-[#E50914]" />
              Галерея устройства
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Файлов из галереи: <strong className="text-white">{storageStats.count}</strong> (
              {formatBytes(storageStats.totalBytes)})
            </p>
            <p className="text-[10px] font-mono text-zinc-500">
              Код входа: 9086 • Без внешней БД
            </p>
          </div>
        </aside>

        {/* Scrollable Content Workspace */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* =============================================================== */}
          {/* TAB 1: CATALOG (MOVIES & SERIES)                                */}
          {/* =============================================================== */}
          {activeTab === 'catalog' && !editingTitle && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                    Каталог F304Lteam
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400">
                    Создавайте сериалы с сезонами и сериями, загружайте фильмы и трейлеры прямо из
                    галереи.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const next = createEmptyTitle('series');
                      setEditingTitle(next);
                      setExpandedSeasonId(next.seasons[0]?.id || null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#E50914] hover:bg-[#ff1c28] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg transition-all active:scale-95 cursor-pointer"
                  >
                    <Tv className="h-4 w-4" />+ Создать сериал
                  </button>
                  <button
                    onClick={() => setEditingTitle(createEmptyTitle('movie'))}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/8 hover:bg-white/15 px-4 py-2.5 text-xs sm:text-sm font-bold text-white transition-all cursor-pointer"
                  >
                    <Film className="h-4 w-4 text-[#E50914]" />+ Добавить фильм
                  </button>
                </div>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по названию или жанру..."
                  className="w-full rounded-xl border border-white/10 bg-[#12131B] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-[#E50914] focus:outline-none"
                />
              </div>

              {/* Catalog Items List */}
              <div className="grid grid-cols-1 gap-3">
                {filteredCatalog.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl border border-white/10 bg-[#12131B] p-3.5 hover:border-white/20 transition-colors"
                  >
                    <div className="relative h-24 w-full sm:w-40 shrink-0 overflow-hidden rounded-xl bg-[#09090D]">
                      <MediaImg
                        srcRef={item.poster || item.backdrop}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute top-2 left-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                        {item.type === 'series' ? 'Сериал' : 'Фильм'}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-base text-white truncate">{item.title}</h3>
                        {!item.published && (
                          <span className="rounded bg-zinc-700/70 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                            Черновик
                          </span>
                        )}
                        {item.isFeatured && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                            <Star className="h-2.5 w-2.5 fill-amber-400" />
                            Главный экран
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">
                        {item.year} • {item.duration} • ★ {item.rating.toFixed(1)} • Актёров:{' '}
                        {item.cast.length}
                      </p>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {item.genres.slice(0, 4).map((g) => (
                          <span
                            key={g}
                            className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-center">
                      <button
                        onClick={() => toggleTitleFeatured(item.id)}
                        title="Закрепить на главном экране (Hero)"
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                          item.isFeatured
                            ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                            : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Star
                          className={`h-4 w-4 ${item.isFeatured ? 'fill-amber-400' : ''}`}
                        />
                      </button>

                      <button
                        onClick={() => toggleTitlePublished(item.id)}
                        title={
                          item.published ? 'Скрыть из каталога' : 'Опубликовать в каталоге'
                        }
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                          item.published
                            ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                            : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {item.published ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setEditingTitle(JSON.parse(JSON.stringify(item)));
                          setExpandedSeasonId(item.seasons[0]?.id || null);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/15 px-3 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Изменить
                      </button>

                      <button
                        onClick={() => handleDeleteTitle(item)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-red-500/20 hover:border-red-500/40 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* -------------------- TITLE CREATE / EDIT FORM ----------------- */}
          {activeTab === 'catalog' && editingTitle && (
            <form onSubmit={handleSaveTitle} className="space-y-6 pb-10">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#E50914]">
                    {editingTitle.type === 'series' ? 'Редактор сериала' : 'Редактор фильма'}
                  </span>
                  <h2 className="font-display text-xl font-bold text-white">
                    {editingTitle.title || 'Новый проект F304Lteam'}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTitle(null)}
                    className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-semibold text-zinc-300 cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#E50914] hover:bg-[#ff1c28] px-5 py-2 text-xs font-bold text-white shadow-lg cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    Сохранить и опубликовать
                  </button>
                </div>
              </div>

              {/* Type Switcher + Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Формат релиза
                  </label>
                  <div className="flex gap-2">
                    {(['series', 'movie'] as TitleType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          setEditingTitle({
                            ...editingTitle,
                            type: t,
                            seasons:
                              t === 'series' && editingTitle.seasons.length === 0
                                ? [
                                    {
                                      id: `s1-${Date.now()}`,
                                      number: 1,
                                      title: 'Сезон 1',
                                      episodes: [],
                                    },
                                  ]
                                : editingTitle.seasons,
                          })
                        }
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                          editingTitle.type === t
                            ? 'bg-[#E50914] text-white'
                            : 'border border-white/10 bg-[#12131B] text-zinc-400 hover:text-white'
                        }`}
                      >
                        {t === 'series' ? <Tv className="h-4 w-4" /> : <Film className="h-4 w-4" />}
                        {t === 'series' ? 'Сериал (с сезонами и сериями)' : 'Полнометражный фильм'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Название *</label>
                  <input
                    type="text"
                    required
                    value={editingTitle.title}
                    onChange={(e) =>
                      setEditingTitle({ ...editingTitle, title: e.target.value })
                    }
                    placeholder="Например: Ночной код 304"
                    className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3.5 py-2.5 text-sm text-white focus:border-[#E50914] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Слоган (Tagline)</label>
                  <input
                    type="text"
                    value={editingTitle.tagline}
                    onChange={(e) =>
                      setEditingTitle({ ...editingTitle, tagline: e.target.value })
                    }
                    placeholder="Короткая атмосферная фраза для обложки"
                    className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3.5 py-2.5 text-sm text-white focus:border-[#E50914] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-semibold text-zinc-300">Описание сюжета</label>
                  <textarea
                    rows={3}
                    value={editingTitle.description}
                    onChange={(e) =>
                      setEditingTitle({ ...editingTitle, description: e.target.value })
                    }
                    placeholder="Полный синопсис фильма или сериала..."
                    className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3.5 py-2.5 text-sm text-white focus:border-[#E50914] focus:outline-none"
                  />
                </div>
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Год</label>
                  <input
                    type="number"
                    value={editingTitle.year}
                    onChange={(e) =>
                      setEditingTitle({ ...editingTitle, year: Number(e.target.value) || 2025 })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3 py-2 text-sm text-white focus:border-[#E50914] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Рейтинг (1–10)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    value={editingTitle.rating}
                    onChange={(e) =>
                      setEditingTitle({
                        ...editingTitle,
                        rating: Math.min(10, Math.max(1, Number(e.target.value) || 8.5)),
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3 py-2 text-sm text-white focus:border-[#E50914] focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Возраст</label>
                  <select
                    value={editingTitle.ageRating}
                    onChange={(e) =>
                      setEditingTitle({
                        ...editingTitle,
                        ageRating: e.target.value as CatalogItem['ageRating'],
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3 py-2 text-sm text-white focus:border-[#E50914] focus:outline-none"
                  >
                    {['0+', '6+', '12+', '16+', '18+'].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Качество</label>
                  <select
                    value={editingTitle.quality}
                    onChange={(e) =>
                      setEditingTitle({
                        ...editingTitle,
                        quality: e.target.value as CatalogItem['quality'],
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3 py-2 text-sm text-white focus:border-[#E50914] focus:outline-none"
                  >
                    {['4K HDR', '4K 60fps', 'IMAX', 'Full HD'].map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="text-xs text-zinc-400">Режиссёр</label>
                  <input
                    type="text"
                    value={editingTitle.director}
                    onChange={(e) =>
                      setEditingTitle({ ...editingTitle, director: e.target.value })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3 py-2 text-sm text-white focus:border-[#E50914] focus:outline-none"
                  />
                </div>
              </div>

              {editingTitle.type === 'movie' && (
                <div className="space-y-1.5 max-w-xs">
                  <label className="text-xs font-semibold text-zinc-300">Длительность фильма</label>
                  <input
                    type="text"
                    value={editingTitle.duration}
                    onChange={(e) =>
                      setEditingTitle({ ...editingTitle, duration: e.target.value })
                    }
                    placeholder="Например: 1ч 54м"
                    className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3.5 py-2 text-sm text-white focus:border-[#E50914] focus:outline-none"
                  />
                </div>
              )}

              {/* Genres & Flags */}
              <div className="space-y-3 rounded-2xl border border-white/10 bg-[#11121A] p-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300 block">
                  Жанры
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_GENRES.map((genre) => {
                    const selected = editingTitle.genres.includes(genre);
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => {
                          const next = selected
                            ? editingTitle.genres.filter((g) => g !== genre)
                            : [...editingTitle.genres, genre];
                          setEditingTitle({
                            ...editingTitle,
                            genres: next.length ? next : ['Драма'],
                          });
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                          selected
                            ? 'bg-[#E50914] text-white'
                            : 'border border-white/10 bg-white/5 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {genre}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-4 pt-3 border-t border-white/10">
                  {[
                    { key: 'published' as const, label: 'Опубликовать в каталоге' },
                    { key: 'isFeatured' as const, label: 'Показывать на главном экране (Hero)' },
                    { key: 'isNew' as const, label: 'Метка «Новинка»' },
                    { key: 'isTop' as const, label: 'Топ студии F304Lteam' },
                  ].map((flag) => (
                    <label
                      key={flag.key}
                      className="inline-flex items-center gap-2 text-xs font-medium text-zinc-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={editingTitle[flag.key]}
                        onChange={(e) =>
                          setEditingTitle({ ...editingTitle, [flag.key]: e.target.checked })
                        }
                        className="h-4 w-4 accent-[#E50914] rounded"
                      />
                      {flag.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Media Gallery Pickers (Poster, Backdrop, Trailer, Main Movie Video) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-[#11121A] p-4">
                <div className="md:col-span-2">
                  <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#E50914]" />
                    Картинки и видео (выбор прямо из галереи)
                  </h3>
                </div>

                <GalleryFilePicker
                  label="Постер (обложка в каталоге)"
                  accept="image"
                  value={editingTitle.poster}
                  onChange={(val) => setEditingTitle({ ...editingTitle, poster: val })}
                />

                <GalleryFilePicker
                  label="Широкий фон (Backdrop для Hero и карточки)"
                  accept="image"
                  value={editingTitle.backdrop}
                  onChange={(val) => setEditingTitle({ ...editingTitle, backdrop: val })}
                />

                <GalleryFilePicker
                  label="Официальный трейлер (видео)"
                  accept="video"
                  value={editingTitle.trailerUrl}
                  onChange={(val) => setEditingTitle({ ...editingTitle, trailerUrl: val })}
                />

                {editingTitle.type === 'movie' && (
                  <GalleryFilePicker
                    label="Основной видеофайл фильма"
                    accept="video"
                    value={editingTitle.videoUrl}
                    onChange={(val) => setEditingTitle({ ...editingTitle, videoUrl: val })}
                  />
                )}
              </div>

              {/* SEASONS & EPISODES MANAGER (Series Only) */}
              {editingTitle.type === 'series' && (
                <div className="space-y-4 rounded-2xl border border-white/10 bg-[#11121A] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                      <Tv className="h-4 w-4 text-[#E50914]" />
                      Сезоны и серии ({editingTitle.seasons.length} сезонов)
                    </h3>
                    <button
                      type="button"
                      onClick={addSeasonToEditing}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-[#E50914] px-3 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Добавить сезон
                    </button>
                  </div>

                  <div className="space-y-3">
                    {editingTitle.seasons.map((season) => {
                      const isExpanded = expandedSeasonId === season.id;
                      return (
                        <div
                          key={season.id}
                          className="rounded-xl border border-white/10 bg-[#0B0C11] overflow-hidden"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-white/[0.03]">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedSeasonId(isExpanded ? null : season.id)
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-zinc-200 cursor-pointer"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </button>
                              <input
                                type="text"
                                value={season.title}
                                onChange={(e) =>
                                  setEditingTitle({
                                    ...editingTitle,
                                    seasons: editingTitle.seasons.map((s) =>
                                      s.id === season.id ? { ...s, title: e.target.value } : s
                                    ),
                                  })
                                }
                                className="bg-transparent text-sm font-bold text-white focus:outline-none border-b border-transparent focus:border-[#E50914] px-1"
                              />
                              <span className="font-mono text-[11px] text-zinc-500">
                                ({season.episodes.length} серий)
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  addEpisodeToSeason(season.id);
                                  setExpandedSeasonId(season.id);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#E50914]/90 hover:bg-[#E50914] px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                              >
                                <Plus className="h-3 w-3" />
                                Серия
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteSeasonFromEditing(season.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-500/20 hover:text-red-400 cursor-pointer"
                                title="Удалить сезон"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-3 space-y-3 border-t border-white/10">
                              {season.episodes.length === 0 ? (
                                <p className="text-xs text-zinc-500 text-center py-3">
                                  Нажмите «+ Серия», чтобы добавить эпизод и выбрать видео из
                                  галереи.
                                </p>
                              ) : (
                                season.episodes.map((ep) => (
                                  <div
                                    key={ep.id}
                                    className="rounded-xl border border-white/8 bg-[#12131C] p-3 space-y-3"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="rounded bg-[#E50914]/20 px-2 py-0.5 font-mono text-[11px] font-bold text-[#ff4d56]">
                                        Серия {ep.number}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          deleteEpisodeFromSeason(season.id, ep.id)
                                        }
                                        className="text-xs text-zinc-400 hover:text-red-400 inline-flex items-center gap-1 cursor-pointer"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Удалить серию
                                      </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                      <input
                                        type="text"
                                        value={ep.title}
                                        onChange={(e) =>
                                          updateEpisodeField(season.id, ep.id, {
                                            title: e.target.value,
                                          })
                                        }
                                        placeholder="Название серии"
                                        className="sm:col-span-2 rounded-lg border border-white/10 bg-[#09090D] px-3 py-1.5 text-xs text-white focus:border-[#E50914] focus:outline-none"
                                      />
                                      <input
                                        type="text"
                                        value={ep.duration}
                                        onChange={(e) =>
                                          updateEpisodeField(season.id, ep.id, {
                                            duration: e.target.value,
                                          })
                                        }
                                        placeholder="Длительность (45 мин)"
                                        className="rounded-lg border border-white/10 bg-[#09090D] px-3 py-1.5 text-xs text-white focus:border-[#E50914] focus:outline-none"
                                      />
                                    </div>

                                    <input
                                      type="text"
                                      value={ep.description}
                                      onChange={(e) =>
                                        updateEpisodeField(season.id, ep.id, {
                                          description: e.target.value,
                                        })
                                      }
                                      placeholder="Краткое описание серии..."
                                      className="w-full rounded-lg border border-white/10 bg-[#09090D] px-3 py-1.5 text-xs text-white focus:border-[#E50914] focus:outline-none"
                                    />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <GalleryFilePicker
                                        compact
                                        label="Превью серии (кадр)"
                                        accept="image"
                                        value={ep.thumbnail}
                                        onChange={(val) =>
                                          updateEpisodeField(season.id, ep.id, { thumbnail: val })
                                        }
                                      />
                                      <GalleryFilePicker
                                        compact
                                        label="Видео серии"
                                        accept="video"
                                        value={ep.videoUrl}
                                        onChange={(val) =>
                                          updateEpisodeField(season.id, ep.id, { videoUrl: val })
                                        }
                                      />
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* FILM-SPECIFIC CAST MANAGER */}
              <div className="space-y-4 rounded-2xl border border-white/10 bg-[#11121A] p-4">
                <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#E50914]" />
                  Актёры этого фильма / сериала ({editingTitle.cast.length})
                </h3>

                {/* Current attached cast */}
                {editingTitle.cast.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {editingTitle.cast.map((member) => {
                      const actor = data.actors.find((a) => a.id === member.actorId);
                      return (
                        <div
                          key={member.actorId}
                          className="flex items-center justify-between gap-2.5 rounded-xl border border-white/10 bg-[#0B0C11] p-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                              <MediaImg
                                srcRef={actor?.photo}
                                alt={actor?.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                {actor?.name || 'Актёр'}
                              </p>
                              <p className="text-[11px] text-zinc-400 truncate">
                                {member.characterName}
                                {member.isLead ? ' • Главная роль' : ''}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingTitle({
                                ...editingTitle,
                                cast: editingTitle.cast.filter(
                                  (c) => c.actorId !== member.actorId
                                ),
                              })
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-500/20 hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Attach from general studio actors */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10">
                  <select
                    value={selectedExistingActorId}
                    onChange={(e) => setSelectedExistingActorId(e.target.value)}
                    className="rounded-xl border border-white/10 bg-[#0B0C11] px-3 py-2 text-xs text-white focus:border-[#E50914] focus:outline-none"
                  >
                    <option value="">Выбрать из общих актёров...</option>
                    {data.actors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={selectedExistingChar}
                    onChange={(e) => setSelectedExistingChar(e.target.value)}
                    placeholder="Имя персонажа в фильме"
                    className="rounded-xl border border-white/10 bg-[#0B0C11] px-3 py-2 text-xs text-white focus:border-[#E50914] focus:outline-none"
                  />
                  <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0B0C11] px-3 py-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedExistingLead}
                      onChange={(e) => setSelectedExistingLead(e.target.checked)}
                      className="accent-[#E50914]"
                    />
                    Главная роль
                  </label>
                  <button
                    type="button"
                    onClick={attachExistingActor}
                    className="rounded-xl bg-white/10 hover:bg-[#E50914] px-3 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                  >
                    + Добавить в состав
                  </button>
                </div>

                {/* Quick create new actor inline */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-white/5">
                  <input
                    type="text"
                    value={quickActorName}
                    onChange={(e) => setQuickActorName(e.target.value)}
                    placeholder="Или быстро создать нового актёра (ФИО)"
                    className="rounded-xl border border-white/10 bg-[#0B0C11] px-3 py-2 text-xs text-white focus:border-[#E50914] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={quickActorChar}
                    onChange={(e) => setQuickActorChar(e.target.value)}
                    placeholder="Его роль в этом фильме"
                    className="rounded-xl border border-white/10 bg-[#0B0C11] px-3 py-2 text-xs text-white focus:border-[#E50914] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={quickCreateAndAttachActor}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E50914]/40 bg-[#E50914]/15 hover:bg-[#E50914] px-3 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Создать и привязать
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* =============================================================== */}
          {/* TAB 2: GENERAL STUDIO ACTORS                                    */}
          {/* =============================================================== */}
          {activeTab === 'actors' && !editingActor && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                    Общие актёры F304Lteam
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400">
                    Все актёры, режиссёры и участники студии — их можно привязывать к любым
                    фильмам и сериалам.
                  </p>
                </div>
                <button
                  onClick={() => setEditingActor(createEmptyActor())}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#E50914] hover:bg-[#ff1c28] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />+ Добавить актёра
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.actors.map((actor) => {
                  const projectsCount = data.catalog.filter((c) =>
                    c.cast.some((m) => m.actorId === actor.id)
                  ).length;
                  return (
                    <div
                      key={actor.id}
                      className="rounded-2xl border border-white/10 bg-[#12131B] overflow-hidden flex flex-col"
                    >
                      <div className="flex items-center gap-3.5 p-4">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10">
                          <MediaImg
                            srcRef={actor.photo}
                            alt={actor.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm text-white truncate">{actor.name}</h3>
                          <p className="text-xs text-zinc-400 truncate">{actor.role}</p>
                          <p className="font-mono text-[10px] text-[#ff4d56] mt-1">
                            Проектов в каталоге: {projectsCount}
                          </p>
                        </div>
                      </div>
                      <div className="mt-auto flex items-center justify-end gap-2 border-t border-white/8 bg-white/[0.02] px-4 py-2.5">
                        <button
                          onClick={() => setEditingActor({ ...actor })}
                          className="inline-flex items-center gap-1 rounded-lg bg-white/8 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Изменить
                        </button>
                        <button
                          onClick={() => handleDeleteActor(actor)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-500/20 hover:text-red-400 cursor-pointer"
                          title="Удалить актёра"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'actors' && editingActor && (
            <form onSubmit={handleSaveActor} className="space-y-5 max-w-3xl pb-10">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <h2 className="font-display text-xl font-bold text-white">
                  {editingActor.name || 'Новый актёр F304Lteam'}
                </h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingActor(null)}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-300 cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#E50914] px-5 py-2 text-xs font-bold text-white cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    Сохранить
                  </button>
                </div>
              </div>

              <GalleryFilePicker
                label="Фото актёра (из галереи)"
                accept="image"
                value={editingActor.photo}
                onChange={(val) => setEditingActor({ ...editingActor, photo: val })}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300">Имя и фамилия *</label>
                  <input
                    type="text"
                    required
                    value={editingActor.name}
                    onChange={(e) => setEditingActor({ ...editingActor, name: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3.5 py-2.5 text-sm text-white focus:border-[#E50914] focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300">Роль в студии</label>
                  <input
                    type="text"
                    value={editingActor.role}
                    onChange={(e) => setEditingActor({ ...editingActor, role: e.target.value })}
                    placeholder="Например: Ведущий актёр / Режиссёр"
                    className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3.5 py-2.5 text-sm text-white focus:border-[#E50914] focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300">Город</label>
                  <input
                    type="text"
                    value={editingActor.city}
                    onChange={(e) => setEditingActor({ ...editingActor, city: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3.5 py-2.5 text-sm text-white focus:border-[#E50914] focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300">Год рождения</label>
                  <input
                    type="number"
                    value={editingActor.birthYear}
                    onChange={(e) =>
                      setEditingActor({
                        ...editingActor,
                        birthYear: Number(e.target.value) || 1998,
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3.5 py-2.5 text-sm text-white focus:border-[#E50914] focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300">Telegram / Instagram</label>
                  <input
                    type="text"
                    value={editingActor.socialHandle}
                    onChange={(e) =>
                      setEditingActor({ ...editingActor, socialHandle: e.target.value })
                    }
                    placeholder="@username"
                    className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3.5 py-2.5 text-sm text-white focus:border-[#E50914] focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300">Награды / достижения</label>
                  <input
                    type="text"
                    value={editingActor.awards || ''}
                    onChange={(e) =>
                      setEditingActor({ ...editingActor, awards: e.target.value })
                    }
                    placeholder="Опционально"
                    className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3.5 py-2.5 text-sm text-white focus:border-[#E50914] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-300">Биография</label>
                <textarea
                  rows={4}
                  value={editingActor.bio}
                  onChange={(e) => setEditingActor({ ...editingActor, bio: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3.5 py-2.5 text-sm text-white focus:border-[#E50914] focus:outline-none"
                />
              </div>
            </form>
          )}

          {/* =============================================================== */}
          {/* TAB 3: STUDIO NEWS                                              */}
          {/* =============================================================== */}
          {activeTab === 'news' && !editingNews && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                    Новости студии F304Lteam
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400">
                    Публикуйте анонсы премьер, бэкстейджи со съёмок, кастинги и видео-тизеры.
                  </p>
                </div>
                <button
                  onClick={() => setEditingNews(createEmptyNews())}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#E50914] hover:bg-[#ff1c28] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg cursor-pointer"
                >
                  <Plus className="h-4 w-4" />+ Новая публикация
                </button>
              </div>

              <div className="space-y-3">
                {data.news.map((post) => (
                  <div
                    key={post.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl border border-white/10 bg-[#12131B] p-3.5"
                  >
                    <div className="h-20 w-full sm:w-36 shrink-0 overflow-hidden rounded-xl">
                      <MediaImg
                        srcRef={post.image}
                        alt={post.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[#E50914]/20 px-2 py-0.5 font-mono text-[10px] font-bold text-[#ff4d56]">
                          {post.category}
                        </span>
                        <span className="font-mono text-[11px] text-zinc-500">{post.date}</span>
                        {post.videoUrl && (
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-300">
                            + Видео
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-sm sm:text-base text-white truncate">
                        {post.title}
                      </h3>
                      <p className="text-xs text-zinc-400 line-clamp-1">{post.summary}</p>
                    </div>
                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <button
                        onClick={() => setEditingNews({ ...post })}
                        className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/15 px-3 py-2 text-xs font-semibold text-white cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Изменить
                      </button>
                      <button
                        onClick={() => handleDeleteNews(post)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'news' && editingNews && (
            <form onSubmit={handleSaveNews} className="space-y-5 max-w-3xl pb-10">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <h2 className="font-display text-xl font-bold text-white">
                  {editingNews.title || 'Новая публикация'}
                </h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingNews(null)}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-300 cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#E50914] px-5 py-2 text-xs font-bold text-white cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    Опубликовать
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GalleryFilePicker
                  label="Обложка новости (из галереи)"
                  accept="image"
                  value={editingNews.image}
                  onChange={(val) => setEditingNews({ ...editingNews, image: val })}
                />
                <GalleryFilePicker
                  label="Тизер / Бэкстейдж видео (опционально)"
                  accept="video"
                  value={editingNews.videoUrl || ''}
                  onChange={(val) => setEditingNews({ ...editingNews, videoUrl: val })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-300">Заголовок новости *</label>
                <input
                  type="text"
                  required
                  value={editingNews.title}
                  onChange={(e) => setEditingNews({ ...editingNews, title: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3.5 py-2.5 text-sm text-white focus:border-[#E50914] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300">Рубрика</label>
                  <select
                    value={editingNews.category}
                    onChange={(e) =>
                      setEditingNews({
                        ...editingNews,
                        category: e.target.value as NewsCategory,
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3 py-2.5 text-sm text-white focus:border-[#E50914] focus:outline-none"
                  >
                    {(['Премьера', 'Съёмки', 'Анонс', 'Кастинг', 'Бэкстейдж'] as NewsCategory[]).map(
                      (cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-300">Дата</label>
                  <input
                    type="date"
                    value={editingNews.date}
                    onChange={(e) => setEditingNews({ ...editingNews, date: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3 py-2.5 text-sm text-white focus:border-[#E50914] focus:outline-none"
                  />
                </div>

                <label className="flex items-center gap-2 self-end rounded-xl border border-white/10 bg-[#12131B] px-3.5 py-2.5 text-xs font-semibold text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingNews.pinned)}
                    onChange={(e) =>
                      setEditingNews({ ...editingNews, pinned: e.target.checked })
                    }
                    className="accent-[#E50914]"
                  />
                  Закрепить новость
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-300">Короткий анонс (лид)</label>
                <textarea
                  rows={2}
                  value={editingNews.summary}
                  onChange={(e) => setEditingNews({ ...editingNews, summary: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3.5 py-2.5 text-sm text-white focus:border-[#E50914] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-300">Полный текст статьи</label>
                <textarea
                  rows={6}
                  value={editingNews.content}
                  onChange={(e) => setEditingNews({ ...editingNews, content: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#12131B] px-3.5 py-2.5 text-sm text-white focus:border-[#E50914] focus:outline-none"
                />
              </div>
            </form>
          )}

          {/* =============================================================== */}
          {/* TAB 4: JSON ONLINE MODE, SERVER.JS & SETTINGS                   */}
          {/* =============================================================== */}
          {activeTab === 'system' && (
            <div className="space-y-6 max-w-3xl pb-10">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                  Онлайн-режим, JSON и Сервер (без БД)
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400">
                  Все изменения сохраняются мгновенно в браузере и IndexedDB. Вы можете выгрузить
                  каталог в <code>data.json</code> или скачать готовый минимальный{' '}
                  <code>server.js</code>.
                </p>
              </div>

              {/* Top Banner Settings */}
              <div className="rounded-2xl border border-white/10 bg-[#12131B] p-5 space-y-4">
                <h3 className="font-display text-sm font-bold text-white">
                  Верхняя строка анонса на сайте
                </h3>
                <label className="inline-flex items-center gap-2 text-xs text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={data.settings.announcementEnabled}
                    onChange={(e) =>
                      onUpdateData({
                        ...data,
                        settings: {
                          ...data.settings,
                          announcementEnabled: e.target.checked,
                        },
                      })
                    }
                    className="accent-[#E50914]"
                  />
                  Показывать верхнюю полосу премьеры
                </label>
                <input
                  type="text"
                  value={data.settings.announcementText}
                  onChange={(e) =>
                    onUpdateData({
                      ...data,
                      settings: { ...data.settings, announcementText: e.target.value },
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#0B0C11] px-3.5 py-2.5 text-sm text-white focus:border-[#E50914] focus:outline-none"
                />
              </div>

              {/* JSON Backup & Minimal Server Bundle */}
              <div className="rounded-2xl border border-white/10 bg-[#12131B] p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-[#E50914]" />
                  <h3 className="font-display text-sm font-bold text-white">
                    Файловый режим: index + js + json + server.js
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Архитектура без сторонних СУБД: данные хранятся в чистом JSON, а видео и фото,
                  выбранные прямо из галереи устройства, кэшируются локально без ограничений по
                  размеру localStorage.
                </p>

                <input
                  ref={jsonInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportJson}
                  className="hidden"
                />

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#E50914] hover:bg-[#ff1c28] px-4 py-2.5 text-xs font-bold text-white cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    Экспорт data.json
                  </button>

                  <button
                    type="button"
                    onClick={() => jsonInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 hover:bg-white/15 px-4 py-2.5 text-xs font-bold text-white cursor-pointer"
                  >
                    <Upload className="h-4 w-4" />
                    Импорт data.json
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadServerJs}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 hover:bg-emerald-500/25 px-4 py-2.5 text-xs font-bold text-emerald-300 cursor-pointer"
                  >
                    <Server className="h-4 w-4" />
                    Скачать минимальный server.js
                  </button>
                </div>
              </div>

              {/* Storage & Reset */}
              <div className="rounded-2xl border border-white/10 bg-[#12131B] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-[#E50914]" />
                    <h3 className="font-display text-sm font-bold text-white">
                      Хранилище галереи и сброс
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                    {storageStats.count} файлов • {formatBytes(storageStats.totalBytes)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        !window.confirm(
                          'Сбросить каталог, актёров и новости F304Lteam к исходной демо-коллекции?'
                        )
                      )
                        return;
                      await clearAllGalleryMedia();
                      onResetDemo();
                      getMediaStorageStats().then(setStorageStats);
                      onNotify('Каталог восстановлен до стартовой версии F304Lteam');
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/10 hover:bg-red-500/20 px-4 py-2.5 text-xs font-bold text-red-300 cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Сбросить к демо-каталогу
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
