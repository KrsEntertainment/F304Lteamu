// Хранилище данных прямо в GitHub-репозитории (без внешнего сервера).
//
// Чтение  : публичный raw-файл data/state.json (доступен с GitHub Pages сразу).
// Запись  : Contents API с personal access token, который админ вводит в админке.
// Публичный сайт после записи обновляется через GitHub Actions (Pages) либо
// следующей публикацией gh-pages — но само состояние читается всегда свежим.
import { StudioData, WatchProgressItem } from "../types";

const GH_OWNER = "KrsEntertainment";
const GH_REPO = "F304Lteamu";
// Ветка с данными: сначала рабочая, затем main (после мержа PR).
// Реальная ветка определяется при первом обращении к API и кешируется.
const BRANCH_CANDIDATES = ["arena/f8b646d0-f304lteamu", "main"];
let resolvedBranch: string | null = null;
const STATE_PATH = "data/state.json";

const TOKEN_KEY = "f304lteam_gh_token_v1";
const API_KEY = "f304lteam_gh_backend_v1"; // "github" | "server"

// Источники состояния, по порядку. Важно: почти во всех случаях первый —
// свой же домен (./state.json рядом с index.html). Никаких внешних CDN:
// в России raw.githubusercontent.com и api.github.com бывают недоступны,
// а собственный домен сайта работает всегда, если открылся сам сайт.
function sameOriginUrl(): string | null {
  if (typeof location === "undefined" || !location.protocol.startsWith("http")) return null;
  return "./state.json";
}

function stateUrls(): string[] {
  const urls: string[] = [];
  const local = sameOriginUrl();
  if (local) urls.push(local);
  urls.push(
    `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${BRANCH_CANDIDATES[0]}/${STATE_PATH}`,
    `https://krsentertainment.github.io/${GH_REPO}/state.json`
  );
  return urls;
}


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

  for (const url of stateUrls()) {
    const label = url === "./state.json"
      ? "свой домен"
      : url.includes("raw.githubusercontent")
        ? "raw.githubusercontent"
        : "GitHub Pages";
    try {
      const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, { cache: "no-store" });
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
        try {
          localStorage.setItem("f304lteam_state_source", label);
        } catch {
          /* приватный режим */
        }
        return state;
      }
    } catch {
      /* пробуем следующий источник */
    }
  }
  // Последний резерв: содержимое через API (если raw-домен блокируется сетью)
  for (const branch of BRANCH_CANDIDATES) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${STATE_PATH}?ref=${encodeURIComponent(branch)}`,
        { headers: { Accept: "application/vnd.github.raw" }, cache: "no-store" }
      );
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
      /* нет сети */
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
/** Ветка, в которой реально лежит data/state.json */
async function resolveBranch(): Promise<string> {
  if (resolvedBranch) return resolvedBranch;
  for (const branch of BRANCH_CANDIDATES) {
    try {
      const res = await ghApi(`/contents/${STATE_PATH}?ref=${encodeURIComponent(branch)}`);
      if (res.ok) {
        resolvedBranch = branch;
        return branch;
      }
    } catch {
      /* следующая ветка */
    }
  }
  resolvedBranch = BRANCH_CANDIDATES[0];
  return resolvedBranch;
}

export async function writeGhState(
  mutate: (state: GhState) => GhState,
  reason: string,
  attempt = 1
): Promise<GhState> {
  // Всегда берём свежую версию из API (в raw может быть кеш CDN)
  let current: GhState = EMPTY_STATE;
  let sha: string | undefined;

  const branch = await resolveBranch();
  const res = await ghApi(`/contents/${STATE_PATH}?ref=${encodeURIComponent(branch)}`);
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

  const putRes = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${STATE_PATH}`,
    {
      method: "PUT",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${getGhToken()}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `data: ${reason}`,
        content: encodeBase64Utf8(JSON.stringify(next, null, 2) + "\n"),
        sha,
        branch,
      }),
    }
  );

  if (!putRes.ok) {
    // 409/422 — файл изменился между чтением и записью (второе устройство).
    // Перечитываем актуальную версию и применяем правку ещё раз.
    if ((putRes.status === 409 || putRes.status === 422) && attempt < 4) {
      cache = null;
      await new Promise((r) => setTimeout(r, 250 * attempt));
      return writeGhState(mutate, reason, attempt + 1);
    }
    const body = await putRes.json().catch(() => null);
    throw new Error(`GitHub: ${body?.message || `HTTP ${putRes.status}`}`);
  }

  cache = { state: next, fetchedAt: Date.now() };
  // Дублируем в публичную копию на сайте, чтобы другие устройства увидели
  // изменения сразу, без ожидания пересборки Pages.
  await writePublicCopy(next);
  return next;
}

/**
 * Публичная копия состояния на ветке gh-pages.
 * Именно её читают браузеры с домена сайта (./state.json), поэтому она
 * обновляется без пересборки сайта — достаточно одного коммита в gh-pages.
 */
async function writePublicCopy(state: GhState): Promise<void> {
  const body = JSON.stringify(state, null, 2) + "\n";
  const api = (path = "") =>
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/state.json${path}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${getGhToken()}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
  try {
    const head = await fetch(`${api(`?ref=${MEDIA_BRANCH}`)}`, { headers });
    const sha = head.ok ? ((await head.json()) as { sha?: string }).sha : undefined;
    await fetch(api(), {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `data: ${state.reason || "update"}`,
        content: encodeBase64Utf8(body),
        branch: MEDIA_BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });
  } catch {
    // Не критично: авторитетная копия всё равно записана, публичная обновится
    // при следующей публикации сайта (./scripts/publish-pages.sh).
  }
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

// ------------------------------------------------------------------ медиа
//
// Файлы кладём прямо в ветку gh-pages (папка uploads/). GitHub Pages отдаёт их
// сразу по публичному URL, поэтому постеры и видео видны на всех устройствах
// без пересборки сайта. Ограничение Contents API — 100 МБ на файл,
// поэтому для больших видео показываем понятную ошибку.

const MEDIA_BRANCH = "gh-pages";
const MEDIA_DIR = "uploads";
const MAX_GITHUB_FILE_BYTES = 40 * 1024 * 1024; // с base64-оверхедом ~53 МБ

export interface GhUploadResult {
  /** Относительный путь для каталога: ./uploads/<файл> */
  ref: string;
  /** Публичный абсолютный URL на GitHub Pages */
  url: string;
}

export async function uploadMediaToGithub(
  file: File,
  onProgress?: (percent: number) => void
): Promise<GhUploadResult> {
  const token = getGhToken();
  if (!token) throw new Error("Нужен GitHub-токен (админка → Синхронизация)");
  if (file.size > MAX_GITHUB_FILE_BYTES) {
    throw new Error(
      `Файл ${(file.size / 1024 / 1024).toFixed(1)} МБ слишком большой для GitHub-режима ` +
        `(лимит ${MAX_GITHUB_FILE_BYTES / 1024 / 1024} МБ). Укажите прямую ссылку на видео.`
    );
  }

  const safe = (file.name || "file").replace(/[^\w.\-]+/g, "_").slice(-70);
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const path = `${MEDIA_DIR}/${name}`;

  // base64 в память (с проверкой прогресса чтения файла)
  const buffer = await file.arrayBuffer();
  onProgress?.(15);
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  const content = btoa(binary);
  onProgress?.(35);

  const res = await new Promise<{ ok: boolean; status: number; text: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "PUT",
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`
    );
    xhr.setRequestHeader("Accept", "application/vnd.github+json");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        // 35% — подготовка base64, остальные 65% — собственно загрузка
        onProgress?.(35 + Math.round((e.loaded / e.total) * 60));
      }
    };
    xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => reject(new Error("Сеть недоступна при загрузке файла"));
    xhr.send(
      JSON.stringify({
        message: `media: ${name}`,
        content,
        branch: MEDIA_BRANCH,
      })
    );
  });

  if (!res.ok) {
    let msg = `GitHub: HTTP ${res.status}`;
    try {
      msg = `GitHub: ${JSON.parse(res.text)?.message || msg}`;
    } catch {
      /* не JSON */
    }
    throw new Error(msg);
  }

  onProgress?.(100);
  const base = `https://krsentertainment.github.io/${GH_REPO}`;
  return { ref: `./${path}`, url: `${base}/${path}` };
}
