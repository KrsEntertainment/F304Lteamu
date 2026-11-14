// Клиент API F304Lteam: единый источник данных для всех устройств.
//
// Базовый URL:
//   - адрес общего сервера задан в одном месте (SERVER_URL) и одинаков для всех
//     устройств: менять в браузере ничего не нужно;
//   - если сборка сделана с VITE_API_URL — он имеет приоритет;
//   - если сайт открыт с того же сервера, что и API — относительный "/api";
//   - ручной адрес из настроек остаётся только как аварийный override.
const API_KEY = "f304lteam_api_base_v1";
const TOKEN_KEY = "f304lteam_admin_token_v1";
const USER_KEY = "f304lteam_user_id_v1";

const ENV_BASE = (import.meta.env.VITE_API_URL as string | undefined) || "";

/**
 * Адрес общего сервера студии (Deno Deploy + Deno KV).
 * Один на весь проект: правится здесь или через VITE_API_URL при сборке.
 * Пока значение пустое, сайт работает на одном домене с API (если сервер
 * отдаёт и сайт, и /api) — это основной режим.
 */
export const SERVER_URL: string = "";

export function getApiBase(): string {
  const stored = localStorage.getItem(API_KEY);
  if (stored) return stored.replace(/\/$/, "");
  if (ENV_BASE) return ENV_BASE.replace(/\/$/, "");
  if (SERVER_URL) return SERVER_URL.replace(/\/$/, "");
  // На том же origin, что и сайт (сервер отдаёт и статику, и API)
  if (typeof location !== "undefined" && location.protocol.startsWith("http")) {
    return "";
  }
  return "";
}

/** Явно задать адрес сервера (например, https://f304lteam-api.onrender.com) */
export function setApiBase(url: string) {
  const clean = url.trim().replace(/\/$/, "");
  if (clean) localStorage.setItem(API_KEY, clean);
  else localStorage.removeItem(API_KEY);
}

/** Явный адрес из env/настроек — нужен, чтобы понять, есть ли смысл стучаться */
export function hasApi(): boolean {
  return Boolean(getApiBase() || ENV_BASE || location.protocol.startsWith("http"));
}

// ------------------------------------------------------------- админ-токен

/** PIN админки (по умолчанию 9086) — используется как ключ записи на сервере */
export function getAdminToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setAdminToken(token: string) {
  if (token) localStorage.setItem(TOKEN_KEY, token.trim());
  else localStorage.removeItem(TOKEN_KEY);
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
  if (admin) {
    // PIN вводится в админке один раз; по умолчанию — стандартный код 9086
    headers.set("Authorization", `Bearer ${getAdminToken() || "9086"}`);
  }
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
      xhr.setRequestHeader("Authorization", `Bearer ${getAdminToken() || "9086"}`);
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
