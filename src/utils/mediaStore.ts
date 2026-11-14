// Хранилище медиа.
//
// Файл уезжает на общий сервер (POST /api/upload) и возвращается как
// /uploads/<имя> — такую ссылку видят все устройства.
// Если сервер недоступен, файл временно кладётся в IndexedDB этого браузера
// (idb://...): правка не теряется, но другие устройства увидят её только
// после успешной загрузки на сервер.
import { api, getAdminToken, resolveServerUrl } from "./api";
import { getGhToken, hasGithubWrite, uploadMediaToGithub } from "./githubStore";

const DB_NAME = "f304lteam_media_db";
const STORE_NAME = "media_blobs";
const DB_VERSION = 1;

const objectUrlCache = new Map<string, string>();

export type UploadProgress = (percent: number) => void;

function openMediaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB недоступен в этом браузере"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function isIdbRef(url?: string): boolean {
  return Boolean(url && url.startsWith("idb://"));
}

/** Есть ли куда загружать файлы (общий сервер + вход в админку) */
export function canUploadToServer(): boolean {
  return Boolean(getAdminToken()) || hasGithubWrite();
}

/**
 * Загружает файл из галереи устройства.
 * Сначала пробует общий сервер; при неудаче сохраняет локально в IndexedDB.
 */
export async function saveGalleryFile(
  file: File,
  onProgress?: UploadProgress
): Promise<string> {
  if (getAdminToken()) {
    try {
      const result = await api.uploadFile(file, onProgress);
      return result.url; // /uploads/<файл> — общий для всех устройств
    } catch (err) {
      console.warn("Загрузка на сервер не удалась, пробую резервный путь:", err);
    }
  }

  // Резервный путь: файл уходит в репозиторий (если доступ уже настроен)
  if (getGhToken()) {
    try {
      const result = await uploadMediaToGithub(file, onProgress);
      return result.ref;
    } catch (err) {
      console.warn("Резервная загрузка не удалась, сохраняю локально:", err);
    }
  }

  const id = `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const key = `idb://${id}`;
  try {
    const db = await openMediaDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const objUrl = URL.createObjectURL(file);
    objectUrlCache.set(key, objUrl);
    return key;
  } catch {
    // Fallback: временный ObjectURL (живёт до перезагрузки страницы)
    const objUrl = URL.createObjectURL(file);
    objectUrlCache.set(key, objUrl);
    return objUrl;
  }
}

/**
 * Превращает ссылку в URL для <img>/<video>:
 * idb:// -> ObjectURL, /uploads/... -> абсолютный адрес сервера,
 * остальные (http, /images/...) — как есть.
 */
export async function resolveMediaUrl(ref?: string): Promise<string> {
  if (!ref) return "";
  if (!isIdbRef(ref)) return resolveServerUrl(ref);

  const cached = objectUrlCache.get(ref);
  if (cached) return cached;

  const id = ref.replace("idb://", "");
  try {
    const db = await openMediaDB();
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!blob) return "";
    const url = URL.createObjectURL(blob);
    objectUrlCache.set(ref, url);
    return url;
  } catch {
    return "";
  }
}

export async function deleteGalleryFile(ref?: string): Promise<void> {
  if (!ref) return;
  // Файл на сервере
  if (ref.startsWith("/uploads/")) {
    try {
      await api.deleteUpload(ref.replace("/uploads/", ""));
    } catch {
      /* уже удалён или нет прав */
    }
    return;
  }
  if (!isIdbRef(ref)) return;
  const cached = objectUrlCache.get(ref);
  if (cached) {
    URL.revokeObjectURL(cached);
    objectUrlCache.delete(ref);
  }
  const id = ref.replace("idb://", "");
  try {
    const db = await openMediaDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

/** Статистика по медиа: сервер + локальный кеш */
export async function getMediaStorageStats(): Promise<{
  count: number;
  totalBytes: number;
  source: "server" | "local";
}> {
  if (canUploadToServer()) {
    try {
      const { files } = await api.listUploads();
      return {
        count: files.length,
        totalBytes: files.reduce((sum, f) => sum + f.size, 0),
        source: "server",
      };
    } catch {
      /* падаем в локальную статистику */
    }
  }
  try {
    const db = await openMediaDB();
    const stats = await new Promise<{ count: number; totalBytes: number }>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const countReq = store.count();
        let count = 0;
        let totalBytes = 0;
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            const blob = cursor.value as Blob;
            totalBytes += blob?.size || 0;
            cursor.continue();
          }
        };
        countReq.onsuccess = () => {
          count = countReq.result;
        };
        tx.oncomplete = () => resolve({ count, totalBytes });
        tx.onerror = () => reject(tx.error);
      }
    );
    return { ...stats, source: "local" };
  } catch {
    return { count: 0, totalBytes: 0, source: "local" };
  }
}

export async function clearAllGalleryMedia(): Promise<void> {
  if (canUploadToServer()) {
    try {
      const { files } = await api.listUploads();
      await Promise.all(files.map((f) => api.deleteUpload(f.name).catch(() => undefined)));
    } catch {
      /* ignore */
    }
  }
  try {
    const db = await openMediaDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    objectUrlCache.forEach((url) => URL.revokeObjectURL(url));
    objectUrlCache.clear();
  } catch {
    /* ignore */
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 Б";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Шаблон минимального сервера (для справки в админке) */
export function generateMinimalServerJs(): string {
  return `// F304Lteam: сервер студии — ./main.ts (Deno Deploy + Deno KV).
// Он отдаёт сайт (dist), API (/api) и загруженные файлы (/uploads).
// Локальный запуск: deno run -A --unstable-kv main.ts
`;
}
