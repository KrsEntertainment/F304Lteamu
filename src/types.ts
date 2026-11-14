export type TitleType = 'movie' | 'series';

export interface Episode {
  id: string;
  number: number;
  title: string;
  description: string;
  duration: string; // e.g. "46 мин"
  thumbnail: string; // URL or idb:// key
  videoUrl: string; // URL or idb:// key
}

export interface Season {
  id: string;
  number: number;
  title: string;
  episodes: Episode[];
}

export interface CastAssignment {
  actorId: string;
  characterName: string;
  isLead?: boolean;
}

export interface CatalogItem {
  id: string;
  type: TitleType;
  title: string;
  tagline: string;
  description: string;
  year: number;
  ageRating: '0+' | '6+' | '12+' | '16+' | '18+';
  rating: number; // e.g. 9.1
  duration: string; // e.g. "2ч 08м" or "2 сезона"
  quality: '4K HDR' | 'Full HD' | 'IMAX' | '4K 60fps';
  genres: string[];
  poster: string; // URL or idb:// key
  backdrop: string; // URL or idb:// key
  trailerUrl: string; // URL or idb:// key
  videoUrl: string; // Main video for movies
  seasons: Season[]; // Populated for series
  cast: CastAssignment[]; // Film-specific actors mapped to global Actors
  director: string;
  published: boolean;
  isFeatured: boolean; // Shown on Hero Spotlight
  isNew: boolean;
  isTop: boolean;
  createdAt: string;
}

export interface Actor {
  id: string;
  name: string;
  role: string; // e.g. "Ведущий актёр", "Актриса • Продюсер", "Режиссёр • Актёр"
  photo: string; // URL or idb:// key
  bio: string;
  city: string;
  birthYear: number;
  socialHandle: string;
  awards?: string;
}

export type NewsCategory = 'Премьера' | 'Съёмки' | 'Анонс' | 'Кастинг' | 'Бэкстейдж';

export interface NewsPost {
  id: string;
  title: string;
  category: NewsCategory;
  date: string; // YYYY-MM-DD or readable
  summary: string;
  content: string;
  image: string; // URL or idb:// key
  videoUrl?: string; // Optional trailer or backstage clip
  pinned?: boolean;
}

export interface WatchProgressItem {
  itemId: string;
  episodeId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  currentTime: number;
  duration: number;
  updatedAt: number;
}

export interface StudioSettings {
  announcementText: string;
  announcementEnabled: boolean;
  onlineModeLabel: string;
  studioEmail: string;
}

export interface StudioData {
  catalog: CatalogItem[];
  actors: Actor[];
  news: NewsPost[];
  settings: StudioSettings;
}

export interface PlaybackPayload {
  item: CatalogItem;
  mode: 'trailer' | 'movie' | 'episode';
  seasonNumber?: number;
  episode?: Episode;
}
