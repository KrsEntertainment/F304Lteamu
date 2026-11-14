// Синхронизация состояния между устройствами.
// Стратегия: сервер — источник правды; клиент опрашивает версию данных
// и подтягивает изменения (polling), плюс мгновенно пушит свои правки.
import { api, getAdminToken, getUserId, hasApi, resolveServerUrl } from "./api";
import {
  getBackendMode,
  getGhToken,
  readGhState,
  writeGhState,
} from "./githubStore";
import { StudioData, WatchProgressItem } from "../types";

/** Режим синхронизации: через репозиторий GitHub (по умолчанию) или свой API */
export function isGithubMode(): boolean {
  return getBackendMode() === "github";
}
export function syncAvailable(): boolean {
  return isGithubMode() || hasApi();
}

const DATA_KEY = "f304lteam_studio_data_v1";
const MYLIST_KEY = "f304lteam_mylist_v1";
const PROGRESS_KEY = "f304lteam_progress_v1";
const LOCAL_VERSION_KEY = "f304lteam_data_version_v1";

export const POLL_INTERVAL_MS = 30_000;

export function readLocalData(): StudioData | null {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    return raw ? (JSON.parse(raw) as StudioData) : null;
  } catch {
    return null;
  }
}

export function writeLocalData(data: StudioData) {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch {
    /* квота — не критично */
  }
}

export function readLocalList(): string[] {
  try {
    const raw = localStorage.getItem(MYLIST_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLocalList(list: string[]) {
  try {
    localStorage.setItem(MYLIST_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function readLocalProgress(): Record<string, WatchProgressItem> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Нормализация путей к файлам, загруженным на сервер */
export function normalizeUrls(data: StudioData): StudioData {
  const fix = (url: string) => (url?.startsWith("/uploads/") ? resolveServerUrl(url) : url);
  return {
    ...data,
    catalog: data.catalog.map((item) => ({
      ...item,
      poster: fix(item.poster),
      backdrop: fix(item.backdrop),
      trailerUrl: fix(item.trailerUrl),
      videoUrl: fix(item.videoUrl),
      seasons: (item.seasons || []).map((season) => ({
        ...season,
        episodes: (season.episodes || []).map((ep) => ({
          ...ep,
          thumbnail: fix(ep.thumbnail),
          videoUrl: fix(ep.videoUrl),
        })),
      })),
    })),
    actors: data.actors.map((a) => ({ ...a, photo: fix(a.photo) })),
    news: data.news.map((n) => ({
      ...n,
      image: fix(n.image),
      videoUrl: n.videoUrl ? fix(n.videoUrl) : n.videoUrl,
    })),
  };
}

export interface SyncResult<T> {
  data: T | null;
  updatedAt: number;
  fromServer: boolean;
}

/**
 * Первичная синхронизация при открытии страницы.
 * Если на сервере данных ещё нет, а локально они есть — загружаем локальные
 * (только при наличии админ-токена, чтобы зритель не перезаписал каталог).
 */
export async function pullData(localFallback: StudioData): Promise<SyncResult<StudioData>> {
  if (isGithubMode()) {
    try {
      const state = await readGhState();
      if (state.studioData) {
        const normalized = normalizeUrls(state.studioData);
        writeLocalData(normalized);
        localStorage.setItem(LOCAL_VERSION_KEY, String(state.updatedAt));
        return { data: normalized, updatedAt: state.updatedAt, fromServer: true };
      }
      // В репозитории данных ещё нет — публикуем локальные, если есть токен
      if (getGhToken()) {
        const saved = await writeGhState(
          (current) => ({ ...current, studioData: localFallback }),
          "initial catalog upload"
        );
        localStorage.setItem(LOCAL_VERSION_KEY, String(saved.updatedAt));
        return { data: localFallback, updatedAt: saved.updatedAt, fromServer: true };
      }
      return { data: localFallback, updatedAt: 0, fromServer: false };
    } catch {
      return { data: localFallback, updatedAt: 0, fromServer: false };
    }
  }

  if (!hasApi()) return { data: localFallback, updatedAt: 0, fromServer: false };

  try {
    const remote = await api.getData<StudioData>();
    if (remote.data) {
      const normalized = normalizeUrls(remote.data);
      writeLocalData(normalized);
      localStorage.setItem(LOCAL_VERSION_KEY, String(remote.updatedAt));
      return { data: normalized, updatedAt: remote.updatedAt, fromServer: true };
    }

    // Сервер пуст: отправляем локальную версию, если есть права админа
    if (getAdminToken()) {
      const saved = await api.saveData(localFallback);
      localStorage.setItem(LOCAL_VERSION_KEY, String(saved.updatedAt));
      return { data: localFallback, updatedAt: saved.updatedAt, fromServer: true };
    }
    return { data: localFallback, updatedAt: 0, fromServer: false };
  } catch {
    // Сеть недоступна — работаем на локальных данных
    return { data: localFallback, updatedAt: 0, fromServer: false };
  }
}

/** Проверить, изменилось ли что-то на сервере (лёгкий запрос) */
export async function checkVersion(): Promise<number | null> {
  if (isGithubMode()) {
    try {
      const state = await readGhState(true);
      const localVersion = Number(localStorage.getItem(LOCAL_VERSION_KEY) || 0);
      return state.updatedAt > localVersion ? state.updatedAt : null;
    } catch {
      return null;
    }
  }
  if (!hasApi()) return null;
  try {
    const { updatedAt } = await api.getVersion();
    const localVersion = Number(localStorage.getItem(LOCAL_VERSION_KEY) || 0);
    return updatedAt > localVersion ? updatedAt : null;
  } catch {
    return null;
  }
}

export async function pullIfChanged(): Promise<StudioData | null> {
  const newVersion = await checkVersion();
  if (newVersion === null) return null;

  if (isGithubMode()) {
    const state = await readGhState(true);
    if (!state.studioData) return null;
    const normalized = normalizeUrls(state.studioData);
    writeLocalData(normalized);
    localStorage.setItem(LOCAL_VERSION_KEY, String(state.updatedAt));
    return normalized;
  }

  try {
    const remote = await api.getData<StudioData>();
    if (!remote.data) return null;
    const normalized = normalizeUrls(remote.data);
    writeLocalData(normalized);
    localStorage.setItem(LOCAL_VERSION_KEY, String(remote.updatedAt));
    return normalized;
  } catch {
    return null;
  }
}

/** Отправить контент студии на сервер (только админ) */
export async function pushData(data: StudioData): Promise<number | null> {
  if (isGithubMode()) {
    if (!getGhToken()) return null;
    const saved = await writeGhState(
      (current) => ({ ...current, studioData: data }),
      "studio catalog update"
    );
    localStorage.setItem(LOCAL_VERSION_KEY, String(saved.updatedAt));
    return saved.updatedAt;
  }
  if (!hasApi() || !getAdminToken()) return null;
  const { updatedAt } = await api.saveData(data);
  localStorage.setItem(LOCAL_VERSION_KEY, String(updatedAt));
  return updatedAt;
}

// ------------------------- зрительские данные (список и прогресс)

export async function pullUserState(): Promise<{
  list: string[] | null;
  progress: Record<string, WatchProgressItem> | null;
}> {
  if (isGithubMode()) {
    try {
      const state = await readGhState();
      const userId = getUserId();
      const list = state.lists[userId] ?? null;
      const progress = state.progress[userId] ?? null;
      if (list) writeLocalList(list);
      return { list, progress };
    } catch {
      return { list: null, progress: null };
    }
  }
  if (!hasApi()) return { list: null, progress: null };
  const userId = getUserId();
  const [listRes, progressRes] = await Promise.allSettled([
    api.getList(userId),
    api.getProgress<WatchProgressItem>(userId),
  ]);
  const list = listRes.status === "fulfilled" ? listRes.value.list : null;
  const progress = progressRes.status === "fulfilled" ? progressRes.value.progress : null;
  if (list) writeLocalList(list);
  return { list, progress };
}

export async function pushList(list: string[]) {
  if (isGithubMode()) {
    if (!getGhToken()) return;
    try {
      await writeGhState((current) => {
        const userId = getUserId();
        return { ...current, lists: { ...current.lists, [userId]: list } };
      }, "my list update");
    } catch {
      /* останется локально */
    }
    return;
  }
  if (!hasApi()) return;
  try {
    await api.saveList(getUserId(), list);
  } catch {
    /* офлайн — останется локально */
  }
}

export async function pushProgress(progress: WatchProgressItem) {
  if (isGithubMode()) {
    if (!getGhToken()) return;
    try {
      await writeGhState((current) => {
        const userId = getUserId();
        const userProgress = { ...(current.progress[userId] || {}) };
        userProgress[progress.itemId] = progress;
        return { ...current, progress: { ...current.progress, [userId]: userProgress } };
      }, "watch progress");
    } catch {
      /* останется локально */
    }
    return;
  }
  if (!hasApi()) return;
  try {
    await api.saveProgress(getUserId(), progress);
  } catch {
    /* офлайн */
  }
}
