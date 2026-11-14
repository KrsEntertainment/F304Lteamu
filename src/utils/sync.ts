// Синхронизация состояния между устройствами.
//
// Два хранилища, между которыми не нужно выбирать:
//   1) общий сервер студии (main.ts, Deno KV) — если он запущен и отвечает;
//   2) GitHub-репозиторий — работает всегда, в том числе на GitHub Pages.
// Проверка одна и та же: жив ли /api/health на том адресе, что прописан в
// сборке. Никакого перебора адресов и никакого ввода с клавиатуры.
//
// Локальные данные (localStorage) — только кеш и страховка, пока правка не
// ушла в общую базу. Такую правку помечаем pending, и чужая копия её не
// перетирает.
import { api, getUserId, resolveServerUrl } from "./api";
import { getGhToken, hasGithubWrite, readGhState, writeGhState } from "./githubStore";
import { StudioData, WatchProgressItem } from "../types";

/** Синхронизация доступна всегда: есть сервер — работаем с ним, нет — с GitHub */
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

/** Куда пишем: живой сервер, иначе репозиторий */
type Store = "server" | "github";
let store: Store | null = null;

/**
 * Определяет хранилище один раз по факту ответа сервера. Ничего не перебираем:
 * адрес один, запрос один.
 */
export async function activeStore(force = false): Promise<Store> {
  if (!force && store) return store;
  try {
    const health = await api.health();
    store = health?.ok ? "server" : hasGithubWrite() ? "github" : "server";
  } catch {
    store = hasGithubWrite() ? "github" : "server";
  }
  return store;
}

/** Право записи: сервер пишем по своему домену, репозиторий — по сохранённому ключу */
export function canWriteRemote(): boolean {
  return store === "github" ? hasGithubWrite() : true;
}

// ------------------------------------------------------------------- чтение

/**
 * Первичная синхронизация при открытии страницы.
 * Сервер — главный источник. Если на сервере данных ещё нет, а локально они
 * есть — отправляем локальные наверх.
 */
export async function pullData(
  localFallback: StudioData,
  force = false
): Promise<SyncResult<StudioData>> {
  // Неотправленные правки важнее серверной копии
  if (hasPending()) {
    return { data: localFallback, updatedAt: 0, fromServer: false };
  }


  if ((await activeStore()) === "github") {
    try {
      const state = await readGhState(force);
      if (state.studioData) {
        const normalized = normalizeUrls(state.studioData);
        writeLocalData(normalized);
        localStorage.setItem(LOCAL_VERSION_KEY, String(state.updatedAt));
        return { data: normalized, updatedAt: state.updatedAt, fromServer: true };
      }
    } catch {
      /* локальные данные ниже */
    }
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

    // Сервер пуст: заливаем стартовые данные в общую базу
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
  if ((await activeStore()) === "github") {
    try {
      const state = await readGhState(true);
      const localVersion = Number(localStorage.getItem(LOCAL_VERSION_KEY) || 0);
      return state.updatedAt > localVersion ? state.updatedAt : null;
    } catch {
      return null;
    }
  }
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
  if ((await activeStore()) === "github") {
    try {
      const state = await readGhState(true);
      if (!state.studioData) return null;
      const normalized = normalizeUrls(state.studioData);
      writeLocalData(normalized);
      localStorage.setItem(LOCAL_VERSION_KEY, String(state.updatedAt));
      return normalized;
    } catch {
      return null;
    }
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

// ------------------------------------------------------------------- запись

/** Отправить контент студии на сервер (только админ) */
export async function pushData(data: StudioData): Promise<number | null> {
  markPending(true);

  if ((await activeStore()) === "server") {
    try {
      const { updatedAt } = await api.saveData(data);
      localStorage.setItem(LOCAL_VERSION_KEY, String(updatedAt));
      markPending(false);
      return updatedAt;
    } catch (err) {
      // Сервер пропал во время работы — если есть доступ к репозиторию,
      // уводим правку туда, чтобы она не осталась только в браузере.
      if (!hasGithubWrite()) throw err;
      store = "github";
    }
  }

  const saved = await writeGhState(
    (current) => ({ ...current, studioData: data }),
    "studio catalog update"
  );
  localStorage.setItem(LOCAL_VERSION_KEY, String(saved.updatedAt));
  markPending(false);
  return saved.updatedAt;
}

/** Проверка связи с сервером (для индикатора и панели админки) */
export async function pingServer(): Promise<{
  ok: boolean;
  updatedAt?: number;
  storage?: string;
  where?: "server" | "github";
}> {
  try {
    const health = await api.health();
    if (health?.ok) {
      store = "server";
      return { ok: true, updatedAt: health.updatedAt, storage: health.storage, where: "server" };
    }
  } catch {
    /* смотрим репозиторий */
  }
  if (hasGithubWrite()) {
    try {
      const state = await readGhState(true);
      store = "github";
      return { ok: true, updatedAt: state.updatedAt, storage: "github", where: "github" };
    } catch {
      /* совсем нет связи */
    }
  }
  return { ok: false, where: store ?? undefined };
}

// ------------------------- зрительские данные (список и прогресс)

export async function pullUserState(): Promise<{
  list: string[] | null;
  progress: Record<string, WatchProgressItem> | null;
}> {
  const userId = getUserId();
  if ((await activeStore()) === "github") {
    try {
      const state = await readGhState();
      const list = state.lists[userId] ?? null;
      const progress = state.progress[userId] ?? null;
      if (list) writeLocalList(list);
      return { list, progress };
    } catch {
      return { list: null, progress: null };
    }
  }
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
  if ((await activeStore()) === "github") {
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
  try {
    await api.saveList(getUserId(), list);
  } catch {
    /* офлайн — останется локально */
  }
}

export async function pushProgress(progress: WatchProgressItem) {
  if ((await activeStore()) === "github") {
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
  try {
    await api.saveProgress(getUserId(), progress);
  } catch {
    /* офлайн */
  }
}
