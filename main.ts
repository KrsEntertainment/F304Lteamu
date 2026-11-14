// F304Lteam — общий сервер студии (Deno Deploy + встроенный Deno KV).
//
// Зачем отдельный сервер: данные должны лежать НЕ в браузере, а в одном
// постоянном хранилище, чтобы правка с телефона была видна на компьютере и
// не откатывалась после перезагрузки.
//
// Хранилище: Deno KV (встроенная база Deno Deploy, 1 ГБ на бесплатном плане).
// Никакого входа, токенов и PIN: писать может только свой же сайт (тот же
// домен), поэтому правки из админки уходят в базу сами и сразу.
// Файлы (постеры, видео): хранятся в KV чанками; большие файлы лучше
// загружать ссылкой на внешнее хранилище.
const KV_CHUNK_BYTES = 48 * 1024; // запас под лимит значения KV (64 КиБ)
const MAX_UPLOAD_BYTES = 45 * 1024 * 1024; // без внешнего хранилища больше нет смысла
const MAX_JSON_BYTES = 8 * 1024 * 1024;

// Хранилище. Основной путь — Deno KV (постоянное, подключено к приложению).
// Если база ещё не подключена, работаем в памяти: сайт сразу живой, а в админке
// видно, что хранилище временное — данные не переживут перезапуск.
type KvLike = {
  get<T>(key: unknown[]): Promise<{ value: T | null }>;
  set(key: unknown[], value: unknown): Promise<unknown>;
  delete(key: unknown[]): Promise<unknown>;
  list<T>(options: { prefix: unknown[] }): AsyncIterable<{ value: T }>;
};

function memoryKv(): KvLike {
  const map = new Map<string, unknown>();
  const k = (key: unknown[]) => JSON.stringify(key);
  return {
    async get<T>(key: unknown[]) {
      return { value: (map.get(k(key)) as T) ?? null };
    },
    async set(key: unknown[], value: unknown) {
      map.set(k(key), value);
      return { ok: true };
    },
    async delete(key: unknown[]) {
      map.delete(k(key));
      return { ok: true };
    },
    async *list<T>({ prefix }: { prefix: unknown[] }) {
      const head = k(prefix).slice(0, -1);
      for (const [key, value] of map) {
        if (key.startsWith(head)) yield { value: value as T };
      }
    },
  };
}

let kv: KvLike = memoryKv();
let storage = "memory";
try {
  kv = (await Deno.openKv()) as unknown as KvLike;
  storage = "deno-kv";
} catch (err) {
  console.warn("Deno KV недоступен, работаем в памяти:", (err as Error)?.message);
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ------------------------------------------------------------------ helpers

/**
 * Разрешена ли запись этому запросу. Свой домен: браузер сам присылает
 * Origin для записи, и он должен совпадать с адресом сервера. Чужой сайт
 * так записать не сможет, а зрителю для чтения ничего не нужно.
 */
function authorized(req: Request): boolean {
  const self = new URL(req.url).origin;
  const origin = req.headers.get("origin");
  if (origin) return origin === self;
  // Без Origin (curl, скрипт): разрешаем только локальную отладку
  const host = req.headers.get("host") || "";
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host === self.replace(/^https?:\/\//, "")
  );
}

function json(payload: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type, Authorization, X-Admin-Pin, X-Admin-Token",
      "access-control-allow-methods": "GET, PUT, POST, DELETE, OPTIONS",
      ...extra,
    },
  });
}

async function readJson(req: Request): Promise<any> {
  const buf = new Uint8Array(await req.arrayBuffer());
  if (!buf.length) return null;
  if (buf.length > MAX_JSON_BYTES) throw new HttpError(413, "Слишком большой запрос");
  try {
    return JSON.parse(decoder.decode(buf));
  } catch {
    throw new HttpError(400, "Некорректный JSON");
  }
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------- хранилище
//
// data          — каталог/актёры/новости/настройки (общий StudioData)
// updatedAt     — ревизия контента
// lists / progress — зрительские данные по userId
// media         — метаданные загруженных файлов
// mediaChunk    — сами файлы чанками

interface Stored {
  data: unknown;
  updatedAt: number;
}

async function readMeta(): Promise<Stored> {
  const res = await kv.get<Stored>(["studio", "meta"]);
  return res.value ?? { data: null, updatedAt: 0 };
}

async function getList(userId: string): Promise<string[]> {
  const res = await kv.get<string[]>(["list", userId]);
  return res.value ?? [];
}

async function getProgress(userId: string): Promise<Record<string, unknown>> {
  const res = await kv.get<Record<string, unknown>>(["progress", userId]);
  return res.value ?? {};
}

interface MediaMeta {
  name: string;
  type: string;
  size: number;
  chunks: number;
  createdAt: number;
}

async function readMedia(name: string): Promise<MediaMeta | null> {
  const res = await kv.get<MediaMeta>(["media", name]);
  return res.value ?? null;
}

async function writeMedia(name: string, bytes: Uint8Array, type: string): Promise<MediaMeta> {
  const chunks = Math.ceil(bytes.length / KV_CHUNK_BYTES) || 1;
  for (let i = 0; i < chunks; i++) {
    const slice = bytes.subarray(i * KV_CHUNK_BYTES, (i + 1) * KV_CHUNK_BYTES);
    await kv.set(["mediaChunk", name, i], slice);
  }
  const meta: MediaMeta = { name, type, size: bytes.length, chunks, createdAt: Date.now() };
  await kv.set(["media", name], meta);
  return meta;
}

async function deleteMedia(name: string) {
  const meta = await readMedia(name);
  if (meta) {
    for (let i = 0; i < meta.chunks; i++) await kv.delete(["mediaChunk", name, i]);
  }
  await kv.delete(["media", name]);
}

async function sendMedia(name: string): Promise<Response> {
  const meta = await readMedia(name);
  if (!meta) return json({ error: "Файл не найден" }, 404);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < meta.chunks; i++) {
    const res = await kv.get<Uint8Array>(["mediaChunk", name, i]);
    if (res.value) parts.push(res.value);
  }
  const body = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.length;
  }
  return new Response(body, {
    headers: {
      "content-type": meta.type || "application/octet-stream",
      "content-length": String(body.length),
      "cache-control": "public, max-age=2592000",
      "access-control-allow-origin": "*",
    },
  });
}

// ------------------------------------------------------------- API / статика

function safeName(raw: string): string {
  const base = raw.split("/").pop() || "file";
  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${base.replace(/[^\w.\-]+/g, "_").slice(-70)}`;
}

async function handleApi(req: Request, url: URL): Promise<Response> {
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const parts = path.split("/").filter(Boolean);

  if (path === "/health" && req.method === "GET") {
    const meta = await readMeta();
    return json({
      ok: true,
      storage,
      hasKv: storage === "deno-kv",
      hasData: Boolean(meta.data),
      updatedAt: meta.updatedAt,
      uptimeSeconds: Math.round(performance.now() / 1000),
    });
  }

  if (path === "/data" && req.method === "GET") {
    const meta = await readMeta();
    return json({ data: meta.data, updatedAt: meta.updatedAt });
  }

  if (path === "/data/version" && req.method === "GET") {
    const meta = await readMeta();
    return json({ updatedAt: meta.updatedAt });
  }

  if (path === "/data" && req.method === "PUT") {
    if (!authorized(req)) return json({ error: "Запись разрешена только своему сайту" }, 403);
    const body = await readJson(req);
    if (!body || !Array.isArray(body.catalog) || !Array.isArray(body.actors)) {
      return json({ error: "Ожидается объект с полями catalog и actors" }, 400);
    }
    const updatedAt = Date.now();
    await kv.set(["studio", "meta"], { data: body, updatedAt });
    return json({ ok: true, updatedAt });
  }

  // ---- зрительские данные
  if (parts[0] === "users" && parts[2] === "list") {
    const userId = decodeURIComponent(parts[1] || "");
    if (!userId) return json({ error: "Нужен userId" }, 400);
    if (req.method === "GET") return json({ list: await getList(userId) });
    if (req.method === "PUT") {
      const body = await readJson(req);
      if (!Array.isArray(body?.list)) return json({ error: "Ожидается { list: [...] }" }, 400);
      const list = body.list.filter((id: unknown) => typeof id === "string").slice(0, 500);
      await kv.set(["list", userId], list);
      return json({ ok: true, list });
    }
  }

  if (parts[0] === "users" && parts[2] === "progress") {
    const userId = decodeURIComponent(parts[1] || "");
    if (!userId) return json({ error: "Нужен userId" }, 400);
    if (req.method === "GET") return json({ progress: await getProgress(userId) });
    if (req.method === "PUT") {
      const body = await readJson(req);
      const item = body?.progress;
      if (!item || typeof item.itemId !== "string") {
        return json({ error: "Ожидается { progress: {...} }" }, 400);
      }
      const current = await getProgress(userId);
      current[item.itemId] = item;
      await kv.set(["progress", userId], current);
      return json({ ok: true });
    }
  }

  // ---- файлы
  if (path === "/upload" && req.method === "POST") {
    if (!authorized(req)) return json({ error: "Запись разрешена только своему сайту" }, 403);
    const original = url.searchParams.get("name") || "file";
    const buf = new Uint8Array(await req.arrayBuffer());
    if (!buf.length) return json({ error: "Пустой файл" }, 400);
    if (buf.length > MAX_UPLOAD_BYTES) {
      return json(
        { error: `Файл больше ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} МБ — укажите прямую ссылку на видео` },
        413
      );
    }
    const name = safeName(original);
    const type = req.headers.get("content-type") || "application/octet-stream";
    await writeMedia(name, buf, type);
    return json({
      ok: true,
      url: `/uploads/${name}`,
      name,
      size: buf.length,
      kind: /^(video|audio)\//.test(type) ? "video" : "image",
    });
  }

  if (path === "/uploads" && req.method === "GET") {
    if (!authorized(req)) return json({ error: "Запись разрешена только своему сайту" }, 403);
    const files: unknown[] = [];
    for await (const entry of kv.list<MediaMeta>({ prefix: ["media"] })) {
      const { name, size, type, createdAt } = entry.value;
      files.push({
        name,
        url: `/uploads/${name}`,
        size,
        kind: /^(video|audio)\//.test(type) ? "video" : "image",
        createdAt,
      });
    }
    files.sort((a: any, b: any) => b.createdAt - a.createdAt);
    return json({ files });
  }

  if (parts[0] === "uploads" && parts[1] && req.method === "DELETE") {
    if (!authorized(req)) return json({ error: "Запись разрешена только своему сайту" }, 403);
    const name = decodeURIComponent(parts.slice(1).join("/")).split("/").pop() || "";
    await deleteMedia(name);
    return json({ ok: true });
  }

  if (path === "/auth/check" && req.method === "POST") {
    return json({ ok: authorized(req) }, authorized(req) ? 200 : 403);
  }

  return json({ error: `Неизвестный маршрут ${req.method} ${url.pathname}` }, 404);
}

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  txt: "text/plain; charset=utf-8",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
};

const WEB_DIR = new URL("./dist/", import.meta.url);

async function serveStatic(url: URL, method: string): Promise<Response> {
  if (url.pathname.startsWith("/uploads/")) {
    const name = decodeURIComponent(url.pathname.slice("/uploads/".length)).split("/").pop() || "";
    return await sendMedia(name);
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  if (rel === "" || rel === "/") rel = "index.html";

  try {
    // WEB_DIR оканчивается на "/", поэтому склейка строк надёжнее new URL(".")
    const fileUrl = new URL(`${WEB_DIR.pathname}${rel.replace(/^\//, "")}`, WEB_DIR);
    if (!fileUrl.pathname.startsWith(WEB_DIR.pathname)) {
      return new Response("Forbidden", { status: 403 });
    }
    const bytes = await Deno.readFile(fileUrl);
    const ext = rel.split(".").pop()?.toLowerCase() || "html";
    return new Response(method === "HEAD" ? null : bytes, {
      headers: {
        "content-type": MIME[ext] || "application/octet-stream",
        "cache-control": ext === "html" ? "no-cache" : "public, max-age=3600",
      },
    });
  } catch {
    try {
      const html = await Deno.readFile(new URL("index.html", WEB_DIR));
      return new Response(method === "HEAD" ? null : html, {
        headers: { "content-type": MIME.html, "cache-control": "no-cache" },
      });
    } catch {
      return new Response("Сборка сайта не найдена: выполните npm run build (deno: deno task build)", {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
  }
}

/**
 * Первый запуск: в базе ещё ничего нет — кладём каталог из сборки
 * (dist/state.json), чтобы сайт сразу открывался с настоящими проектами.
 */
async function seedIfEmpty() {
  const existing = await kv.get<Stored>(["studio", "meta"]);
  if (existing.value?.data) return;
  try {
    const raw = await Deno.readTextFile(new URL("./dist/state.json", import.meta.url));
    const parsed = JSON.parse(raw);
    const data = parsed.studioData ?? parsed.data ?? null;
    if (!data || !Array.isArray(data.catalog)) return;
    await kv.set(["studio", "meta"], { data, updatedAt: parsed.updatedAt || Date.now() });
    console.log("каталог инициализирован из dist/state.json");
  } catch {
    // файла нет — сайт стартует с данными по умолчанию
  }
}

await seedIfEmpty();

// ------------------------------------------------------------------- запуск

// Порт: Deno Deploy сам подставляет PORT; локально по умолчанию 8000.
const PORT = Number(Deno.env.get("PORT") || 8000);

Deno.serve({ port: PORT, hostname: "0.0.0.0" }, async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "Content-Type, Authorization, X-Admin-Pin, X-Admin-Token",
        "access-control-allow-methods": "GET, PUT, POST, DELETE, OPTIONS",
        "access-control-max-age": "86400",
      },
    });
  }

  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, url);
    return await serveStatic(url, req.method);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) console.error("[err]", err);
    return json({ error: (err as Error)?.message || "Внутренняя ошибка" }, status);
  }
});

console.log(`F304Lteam сервер на порту ${PORT}, хранилище ${storage}, запись — только своему домену`);
