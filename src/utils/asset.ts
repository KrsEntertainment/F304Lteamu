// Утилита путей к статике.
// Сайт может жить и в корне домена (http://localhost:5173/), и в подпапке
// (https://krsentertainment.github.io/F304Lteamu/), поэтому все пути
// к картинкам делаем относительными от HTML-документа.
// Роутинг клиентский, document URL не меняется — значит "./" достаточно.
export function assetUrl(path?: string): string {
  if (!path) return "";
  // Внешние и внутренние (blob:/idb:) ссылки не трогаем
  if (/^(https?:|blob:|data:|idb:|file:)/i.test(path)) return path;
  return `./${path.replace(/^\.?\//, "")}`;
}
