// Утилита путей к статике.
// Сайт может жить и в корне домена, и в подпапке
// (например, https://krsentertainment.github.io/F304Lteamu/),
// поэтому пути к картинкам считаем относительно HTML-документа,
// а не от корня домена.
const BASE = ".";
// Сколько уровней вложенности у текущего URL (для SPA-роутов)
const depth = Math.max(
  0,
  (window.location.pathname.replace(/\/[^/]*$/, "").match(/\//g) || []).length
);

export function assetUrl(path?: string): string {
  if (!path) return "";
  // Внешние и внутренние (blob:/idb:) ссылки не трогаем
  if (/^(https?:|blob:|data:|idb:|file:)/i.test(path)) return path;
  const clean = path.replace(/^\.?\//, "");
  // "./" + путь: работает и в корне, и в подпапке
  return `${BASE}/${"../".repeat(depth)}${clean}`;
}
