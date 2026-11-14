// Клиент API F304Lteam: единый источник данных для всех устройств.
//
// Адрес один и тот же для всех и задан ниже одной строкой (SERVER_URL).
// Ничего не перебирается и не запрашивается у пользователя: либо сервер
// известен сборке, либо сайт работает на том же домене, что и API.
const USER_KEY = "f304lteam_user_id_v1";

const ENV_BASE = (import.meta.env.VITE_API_URL as string | undefined) || "";

/**
 * Адрес общего сервера студии (Deno Deploy + Deno KV) — одна строка на весь
 * проект. Если пусто, используется тот же домен, что и у сайта (сервер отдаёт
 * и статику, и /api).
 */
export const SERVER_URL: string = "";

export function getApiBase(): string {
  if (ENV_BASE) return ENV_BASE.replace(/\/$/, "");
  if (SERVER_URL) return SERVER_URL.replace(/\/$/, "");
  // На том же origin, что и сайт (сервер отдаёт и статику, и API)
  if (typeof location !== "undefined" && location.protocol.startsWith("http")) {
    return "";
  }
  return "";
}

/** Явный адрес из env/настроек — нужен, чтобы понять, есть ли смысл стучаться */
export function hasApi(): boolean {
  return Boolean(getApiBase() || ENV_BASE || location.protocol.startsWith("http"));
}

// -------------------------------------------------- идентификатор устройства

/** Стабильный id этого браузера (для «Моего списка» и прогресса) */
export function getUserId(): string {
  let id = localStorage.getItem(USER_KEY);
  if (!id) {
    const rand =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    id = `dev_${rand}`;
    localStorage.setItem(USER_KEY, id);
  }
  return id;
}

// ------------------------------------------------------------------ запросы

async function request<T>(
  path: string,
  init: RequestInit = {},
  { admin = false }: { admin?: boolean } = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  void admin; // права записи проверяет сервер по самому домену
  const res = await fetch(`${getApiBase()}/api${path}`, { ...init, headers });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* тело не JSON */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface RemoteData<T> {
  data: T | null;
  updatedAt: number;
}

export const api = {
  health: () =>
    request<{
      ok: boolean;
      hasData: boolean;
      updatedAt: number;
      uptimeSeconds: number;
      storage?: string;
      hasKv?: boolean;
    }>("/health"),

  getData: <T>() => request<RemoteData<T>>("/data"),
  getVersion: () => request<{ updatedAt: number }>("/data/version"),
  saveData: <T>(data: T) =>
    request<{ ok: boolean; updatedAt: number }>(
      "/data",
      { method: "PUT", body: JSON.stringify(data) },
      { admin: true }
    ),

  getList: (userId: string) =>
    request<{ list: string[] }>(`/users/${encodeURIComponent(userId)}/list`),
  saveList: (userId: string, list: string[]) =>
    request<{ ok: boolean; list: string[] }>(`/users/${encodeURIComponent(userId)}/list`, {
      method: "PUT",
      body: JSON.stringify({ list }),
    }),

  getProgress: <T>(userId: string) =>
    request<{ progress: Record<string, T> }>(`/users/${encodeURIComponent(userId)}/progress`),
  saveProgress: <T>(userId: string, progress: T) =>
    request<{ ok: boolean }>(`/users/${encodeURIComponent(userId)}/progress`, {
      method: "PUT",
      body: JSON.stringify({ progress }),
    }),

  checkAdmin: () =>
    request<{ ok: boolean }>("/auth/check", { method: "POST" }, { admin: true }),

  listUploads: () =>
    request<{
      files: { name: string; url: string; size: number; kind: "image" | "video"; createdAt: number }[];
    }>("/uploads", {}, { admin: true }),

  deleteUpload: (name: string) =>
    request<{ ok: boolean }>(`/uploads/${encodeURIComponent(name)}`, { method: "DELETE" }, { admin: true }),

  /** Загрузка файла сырыми байтами с прогрессом (XHR даёт событие upload) */
  uploadFile: (
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<{ url: string; name: string; size: number }> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(
        "POST",
        `${getApiBase()}/api/upload?name=${encodeURIComponent(file.name || "file")}`
      );
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("Некорректный ответ сервера"));
          }
        } else {
          let msg = `HTTP ${xhr.status}`;
          try {
            msg = JSON.parse(xhr.responseText)?.error || msg;
          } catch {
            /* not json */
          }
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => reject(new Error("Сеть недоступна: проверьте адрес сервера"));
      xhr.send(file);
    }),
};

/** Абсолютный URL к загруженному файлу (/uploads/...) */
export function resolveServerUrl(url?: string): string {
  if (!url) return "";
  if (/^(https?:|blob:|data:)/i.test(url)) return url;
  if (url.startsWith("/uploads/")) return `${getApiBase()}${url}`;
  return url;
}
