// Публикация правок БЕЗ токена.
//
// Идея: админка готовит готовый файл данных и ссылку на страницу GitHub,
// где файл заменяется в два клика (GitHub сам коммитит от имени владельца
// репозитория — токен не нужен). Сайт читает обновлённый state.json
// автоматически, поэтому все устройства получают изменения.
import { StudioData, WatchProgressItem } from "../types";

export const REPO_OWNER = "KrsEntertainment";
export const REPO_NAME = "F304Lteamu";
// Ветка, из которой сайт берёт данные (её же читает ./state.json на gh-pages)
export const DATA_BRANCH = "arena/f8b646d0-f304lteamu";

export interface PublishState {
  version: number;
  updatedAt: number;
  reason?: string;
  studioData: StudioData | null;
  lists: Record<string, string[]>;
  progress: Record<string, Record<string, WatchProgressItem>>;
}

/** Собирает новое состояние из текущего контента и локальных списков */
export function buildState(data: StudioData, reason = "studio update"): PublishState {
  const lists: Record<string, string[]> = {};
  const progress: Record<string, Record<string, WatchProgressItem>> = {};
  try {
    const listRaw = localStorage.getItem("f304lteam_mylist_v1");
    const userId = localStorage.getItem("f304lteam_user_id_v1");
    if (listRaw && userId) lists[userId] = JSON.parse(listRaw);
    const progressRaw = localStorage.getItem("f304lteam_progress_v1");
    if (progressRaw && userId) progress[userId] = JSON.parse(progressRaw);
  } catch {
    /* нет локальных списков — не критично */
  }
  return {
    version: Date.now(),
    updatedAt: Date.now(),
    reason,
    studioData: data,
    lists,
    progress,
  };
}

/** Скачать готовый state.json (запасной вариант, если GitHub не открывается) */
export function downloadState(state: PublishState) {
  const blob = new Blob([JSON.stringify(state, null, 2) + "\n"], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "state.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Прямая ссылка на редактирование файла данных в GitHub */
export function githubEditUrl(): string {
  return `https://github.com/${REPO_OWNER}/${REPO_NAME}/edit/${DATA_BRANCH}/data/state.json`;
}

/** Сколько правок ещё не опубликовано */
export function pendingCount(data?: StudioData | null): number {
  try {
    const saved = localStorage.getItem("f304lteam_published_snapshot_v1");
    if (!data) return 0;
    if (!saved) return 1;
    return JSON.stringify(data) === saved ? 0 : 1;
  } catch {
    return 0;
  }
}

export function markPublished(data: StudioData) {
  try {
    localStorage.setItem("f304lteam_published_snapshot_v1", JSON.stringify(data));
  } catch {
    /* ignore */
  }
}
