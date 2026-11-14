// Хранилище данных прямо в GitHub-репозитории (без внешнего сервера).
//
// Чтение  : публичный raw-файл data/state.json (доступен с GitHub Pages сразу).
// Запись  : Contents API с personal access token, который админ вводит в админке.
// Публичный сайт после записи обновляется через GitHub Actions (Pages) либо
// следующей публикацией gh-pages — но само состояние читается всегда свежим.
import { StudioData, WatchProgressItem } from "../types";

const GH_OWNER = "KrsEntertainment";
const GH_REPO = "F304Lteamu";
const GH_BRANCH = "arena/f8b646d0-f304lteamu";
const STATE_PATH = "data/state.json";

const TOKEN_KEY = "f304lteam_gh_token_v1";
const API_KEY = "f304lteam_gh_backend_v1"; // "github" | "server"

// Публичный URL файла состояния: сначала Pages (там state.json публикуется),
// затем ветка репозитория — чтобы данные были доступны всегда.
const RAW_URLS = [
  `https://krsentertainment.github.io/${GH_REPO}/state.json`,
  `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${GH_BRANCH}/${STATE_PATH}`,
];

export interface GhState {
  version: number;
  updatedAt: number;
  reason?: string;
  studioData: StudioData | null;
  lists: Record<string, string[]>;
  progress: Record<string, Record<string, WatchProgressItem>>;
}

export const EMPTY_STATE: GhState = {
  version: 1,
  updatedAt: 0,
  studioData: null,
  lists: {},
  progress: {},
};

// ------------------------------------------------------------------ токен

export function getGhToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setGhToken(token: string) {
  if (token) localStorage.setItem(TOKEN_KEY, token.trim());
  else localStorage.removeItem(TOKEN_KEY);
}

export function getBackendMode(): "github" | "server" {
  return localStorage.getItem(API_KEY) === "server" ? "server" : "github";
}

export function setBackendMode(mode: "github" | "server") {
  localStorage.setItem(API_KEY, mode);
}

// ------------------------------------------------------------------ чтение

let cache: { state: GhState; fetchedAt: number } | null = null;
const CACHE_MS = 15_000;

/** Читает общее состояние. Кешируется на 15 секунд, чтобы не спамить GitHub. */
export async function readGhState(force = false): Promise<GhState> {
  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_MS) return cache.state;

  for (const url of RAW_URLS) {
    try {
      const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) continue;
      const parsed = (await res.json()) as GhState;
      if (parsed && typeof parsed === "object" && "updatedAt" in parsed) {
        const state: GhState = {
          ...EMPTY_STATE,
          ...parsed,
          lists: parsed.lists || {},
          progress: parsed.progress || {},
        };
        cache = { state, fetchedAt: Date.now() };
        return state;
      }
    } catch {
      /* пробуем следующий источник */
    }
  }
  return cache?.state || EMPTY_STATE;
}

// ------------------------------------------------------------------ запись

function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function ghApi(path: string, init: RequestInit = {}) {
  const token = getGhToken();
  if (!token) throw new Error("Нужен GitHub-токен (админка → Синхронизация)");
  const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const hint =
      res.status === 401
        ? "токен неверный или истёк"
        : res.status === 403
          ? "у токена нет прав Contents: Read and write"
          : body?.message || "ошибка GitHub API";
    throw new Error(`GitHub: ${hint}`);
  }
  return res;
}

/**
 * Записывает новое состояние в репозиторий.
 * mutate получает актуальную версию и возвращает изменённую.
 */
export async function writeGhState(
  mutate: (state: GhState) => GhState,
  reason: string
): Promise<GhState> {
  // Всегда берём свежую версию из API (в raw может быть кеш CDN)
  let current: GhState = EMPTY_STATE;
  let sha: string | undefined;

  const res = await ghApi(`/contents/${STATE_PATH}?ref=${GH_BRANCH}`);
  const file = (await res.json()) as { content: string; sha: string };
  sha = file.sha;
  try {
    current = { ...EMPTY_STATE, ...JSON.parse(decodeBase64Utf8(file.content)) };
  } catch {
    current = { ...EMPTY_STATE };
  }

  const next = mutate(current);
  next.version = (current.version || 1) + 1;
  next.updatedAt = Date.now();
  next.reason = reason;

  await ghApi(`/contents/${STATE_PATH}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `data: ${reason}`,
      content: encodeBase64Utf8(JSON.stringify(next, null, 2) + "\n"),
      sha,
      branch: GH_BRANCH,
    }),
  });

  cache = { state: next, fetchedAt: Date.now() };
  return next;
}

/** Проверка токена и прав на репозиторий */
export async function checkGhAccess(): Promise<{ login: string; canWrite: boolean }> {
  const token = getGhToken();
  if (!token) throw new Error("Токен не указан");

  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!userRes.ok) throw new Error("GitHub: токен не принят (401)");
  const user = (await userRes.json()) as { login: string };

  const repoRes = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!repoRes.ok) throw new Error("GitHub: нет доступа к репозиторию");
  const repo = (await repoRes.json()) as { permissions?: { push?: boolean } };

  return { login: user.login, canWrite: Boolean(repo.permissions?.push) };
}
