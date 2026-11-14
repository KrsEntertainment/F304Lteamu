// Зеркала сайта. GitHub Pages в ряде сетей (например, в РФ) может быть
// недоступен, поэтому публикуем тот же билд в ветку gh-pages —
// её отдаёт jsDelivr, который доступен стабильно.
export const GH_PAGES_URL = "https://krsentertainment.github.io/F304Lteamu/";

export const JSDELIVR_VERSION_URL =
  "https://cdn.jsdelivr.net/gh/KrsEntertainment/F304Lteamu@gh-pages/index.html";

/** Список адресов для доступа к сайту (первый — основной) */
export const SITE_MIRRORS = [
  { label: "GitHub Pages", url: GH_PAGES_URL },
  { label: "jsDelivr (зеркало)", url: JSDELIVR_VERSION_URL },
];

export function isOnMirror(): boolean {
  return typeof location !== "undefined" && location.hostname.includes("jsdelivr");
}

/** Куда вести пользователя, если текущий домен не грузит данные */
export function alternateMirrorUrl(): string {
  return isOnMirror() ? GH_PAGES_URL : JSDELIVR_VERSION_URL;
}
