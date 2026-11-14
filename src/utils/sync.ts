// Синхронизация состояния между устройствами.
//
// Единственный источник правды — общий сервер студии (main.ts на Deno Deploy,
// хранилище Deno KV). Никаких токенов в браузере: доступ к записи даёт PIN
// админки, который вводится один раз для входа в админку.
//
// Локальные данные (localStorage) — только кеш и страховка на время, пока
// сервер недоступен. Пока правка не ушла на сервер, она помечена флагом
// pending и серверная копия её не перетирает.
import { api, getAdminToken, getUserId, resolveServerUrl } from "./api";
import { StudioData, WatchProgressItem } from "../types";

/** Синхронизация доступна, если задан адрес сервера (по умолчанию — свой же домен) */
export function syncAvailable(): boolean {
  return true;
}

const DATA_KEY = "f304lteam_studio_data_v1";
const MYLIST_KEY = "f304lteam_mylist_v1";
const PROGRESS_KEY = "f304lteam_progress_v1";
const LOCAL_VERSION_KEY = "f304lteam_data_version_v1";
const PENDING_KEY = "f304lteam_pending_push_v1";

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
    catalog: (data.catalog || []).map((item) => ({
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
    actors: (data.actors || []).map((a) => ({ ...a, photo: fix(a.photo) })),
    news: (data.news || []).map((n) => ({
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

// ------------------------------------------------------------- pending flag

/** Пометить правку как ещё не отправленную на сервер */
export function markPending(flag: boolean) {
  try {
    if (flag) localStorage.setItem(PENDING_KEY, "1");
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function hasPending(): boolean {
  try {
    return localStorage.getItem(PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

/** Есть ли право записи: PIN админки (введён при входе в админку) */
export function canWriteRemote(): boolean {
  return Boolean(getAdminToken());
}

// ------------------------------------------------------------------- чтение

/**
 * Первичная синхронизация при открытии страницы.
 * Сервер — главный источник. Если на сервере данных ещё нет, а локально они
 * есть, и это устройство админа (введён PIN) — отправляем локальные наверх.
 */
export async function pullData(localFallback: StudioData): Promise<SyncResult<StudioData>> {
  // Неотправленные правки важнее серверной копии
  if (hasPending()) {
    return { data: localFallback, updatedAt: 0, fromServer: false };
  }

  try {
    const remote = await api.getData<StudioData>();
    if (remote.data) {
      const normalized = normalizeUrls(remote.data);
      writeLocalData(normalized);
      localStorage.setItem(LOCAL_VERSION_KEY, String(remote.updatedAt));
      return { data: normalized, updatedAt: remote.updatedAt, fromServer: true };
    }

    // Сервер пуст: заливаем стартовые данные, только если есть права записи
    if (canWriteRemote()) {
      const saved = await api.saveData(localFallback);
      localStorage.setItem(LOCAL_VERSION_KEY, String(saved.updatedAt));
      return { data: localFallback, updatedAt: saved.updatedAt, fromServer: true };
    }
    return { data: localFallback, updatedAt: 0, fromServer: false };
  } catch {
    // Сервер недоступен — показываем локальные данные
    return { data: localFallback, updatedAt: 0, fromServer: false };
  }
}

/** Проверить, изменилось ли что-то на сервере (лёгкий запрос) */
export async function checkVersion(): Promise<number | null> {
  try {
    const { updatedAt } = await api.getVersion();
    const localVersion = Number(localStorage.getItem(LOCAL_VERSION_KEY) || 0);
    return updatedAt > localVersion ? updatedAt : null;
  } catch {
    return null;
  }
}

export async function pullIfChanged(): Promise<StudioData | null> {
  if (hasPending()) return null; // сначала нужно отправить свои правки
  if ((await checkVersion()) === null) return null;
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

// ------------------------------------------------------------------- запись

/** Отправить контент студии на сервер (только админ) */
export async function pushData(data: StudioData): Promise<number | null> {
  if (!canWriteRemote()) {
    throw new Error("Войдите в админку — правки сохранятся в общей базе");
  }
  markPending(true);
  try {
    const { updatedAt } = await api.saveData(data);
    localStorage.setItem(LOCAL_VERSION_KEY, String(updatedAt));
    markPending(false);
    return updatedAt;
  } catch (err) {
    // правка остаётся в локальном кеше и будет отправлена повторно
    throw err;
  }
}

/** Проверка связи с сервером (для индикатора и панели админки) */
export async function pingServer(): Promise<{ ok: boolean; updatedAt?: number; storage?: string }> {
  try {
    const health = await api.health();
    return { ok: Boolean(health?.ok), updatedAt: health?.updatedAt, storage: health?.storage };
  } catch {
    return { ok: false };
  }
}

// ------------------------- зрительские данные (список и прогресс)

export async function pullUserState(): Promise<{
  list: string[] | null;
  progress: Record<string, WatchProgressItem> | null;
}> {
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
  try {
    await api.saveList(getUserId(), list);
  } catch {
    /* офлайн — останется локально */
  }
}

export async function pushProgress(progress: WatchProgressItem) {
  try {
    await api.saveProgress(getUserId(), progress);
  } catch {
    /* офлайн */
  }
}
