// F304Lteam API — общий источник данных для всех устройств.
// Без внешних зависимостей: http + fs. Хранилище — JSON-файл на диске + uploads/.
//
// Переменные окружения:
//   PORT        — порт (по умолчанию 8787)
//   DATA_DIR    — папка для данных (по умолчанию ./server-data)
//   ADMIN_TOKEN — токен админки. Если не задан, генерируется и печатается в лог
//   CORS_ORIGIN — разрешённый origin (по умолчанию *)
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, writeFile, stat, unlink } from "node:fs/promises";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { extname, join, resolve, basename } from "node:path";

const PORT = Number(process.env.PORT || 8787);
const HOST = "0.0.0.0";
const DATA_DIR = resolve(process.env.DATA_DIR || "server-data");
const UPLOAD_DIR = join(DATA_DIR, "uploads");
const DB_FILE = join(DATA_DIR, "db.json");
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// Токен админки: из окружения либо генерируем и сохраняем рядом с данными
const TOKEN_FILE = join(DATA_DIR, "admin-token.txt");
let ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const MAX_JSON_BYTES = 20 * 1024 * 1024; // 20 МБ на JSON (каталог/настройки)
const MAX_UPLOAD_BYTES = 512 * 1024 * 1024; // 512 МБ на файл (видео)

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

// ---------------------------------------------------------------- хранилище

let db = { data: null, lists: {}, progress: {}, updatedAt: 0 };
let saveQueue = Promise.resolve();

async function loadDb() {
  await mkdir(UPLOAD_DIR, { recursive: true });
  try {
    const raw = await readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);
    db = {
      data: parsed.data ?? null,
      lists: parsed.lists ?? {},
      progress: parsed.progress ?? {},
      updatedAt: parsed.updatedAt ?? 0,
    };
  } catch {
    db = { data: null, lists: {}, progress: {}, updatedAt: 0 };
  }
  if (!ADMIN_TOKEN) {
    try {
      ADMIN_TOKEN = (await readFile(TOKEN_FILE, "utf8")).trim();
    } catch {
      ADMIN_TOKEN = randomBytes(24).toString("base64url");
      await writeFile(TOKEN_FILE, ADMIN_TOKEN, { mode: 0o600 });
      console.log(`[init] Сгенерирован токен админки: ${ADMIN_TOKEN}`);
      console.log(`[init] Он сохранён в ${TOKEN_FILE} — введите его в админке на сайте.`);
    }
  }
}

// Атомарная запись: пишем temp-файл и переименовываем
function persist() {
  const snapshot = JSON.stringify(db);
  saveQueue = saveQueue.then(async () => {
    const tmp = `${DB_FILE}.${process.pid}.tmp`;
    await writeFile(tmp, snapshot);
    await rename(tmp, DB_FILE);
  });
  return saveQueue;
}

// ------------------------------------------------------------------ helpers

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
  "Access-Control-Max-Age": "86400",
};

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    ...CORS_HEADERS,
    ...extraHeaders,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function isAuthorized(req) {
  if (!ADMIN_TOKEN) return false;
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : req.headers["x-admin-token"] || "";
  const a = Buffer.from(String(token));
  const b = Buffer.from(ADMIN_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

function readBody(req, limit) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        rejectPromise(Object.assign(new Error("Слишком большой запрос"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolvePromise(Buffer.concat(chunks)));
    req.on("error", rejectPromise);
  });
}

async function readJson(req, limit = MAX_JSON_BYTES) {
  const buf = await readBody(req, limit);
  if (!buf.length) return null;
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    throw Object.assign(new Error("Некорректный JSON"), { status: 400 });
  }
}

function safeFileName(name) {
  const base = basename(String(name || "file"))
    .replace(/[^\w.\-]+/g, "_")
    .slice(-80);
  return `${Date.now()}-${randomBytes(4).toString("hex")}-${base}`;
}

function log(req, res, extra = "") {
  const host = req.headers.host || "-";
  const len = res.getHeader("Content-Length") || "-";
  console.log(
    `${new Date().toISOString()} ${req.method} ${req.url} host=${host} -> ${res.statusCode} ${len}b ${extra}`.trim()
  );
}

// --------------------------------------------------------------- API router

async function handleApi(req, res, url) {
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const parts = path.split("/").filter(Boolean);

  // GET /api/health — статус сервера и наличие опубликованных данных
  if (path === "/health" && req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      hasData: Boolean(db.data),
      updatedAt: db.updatedAt,
      lists: Object.keys(db.lists).length,
      progress: Object.keys(db.progress).length,
      uptimeSeconds: Math.round(process.uptime()),
    });
  }

  // ---------------- Контент студии (общий для всех устройств)
  // GET /api/data — отдать актуальный StudioData + ревизию
  if (path === "/data" && req.method === "GET") {
    return sendJson(res, 200, { data: db.data, updatedAt: db.updatedAt });
  }

  // GET /api/data/version — лёгкая проверка, изменилось ли что-то
  if (path === "/data/version" && req.method === "GET") {
    return sendJson(res, 200, { updatedAt: db.updatedAt });
  }

  // PUT /api/data — сохранить StudioData (только админ)
  if (path === "/data" && req.method === "PUT") {
    if (!isAuthorized(req)) return sendJson(res, 401, { error: "Нужен токен админки" });
    const body = await readJson(req);
    if (!body || !Array.isArray(body.catalog) || !Array.isArray(body.actors)) {
      return sendJson(res, 400, { error: "Ожидается объект с полями catalog и actors" });
    }
    db.data = body;
    db.updatedAt = Date.now();
    await persist();
    return sendJson(res, 200, { ok: true, updatedAt: db.updatedAt });
  }

  // ---------------- Зрительские списки: /api/users/:userId/list
  if (parts[0] === "users" && parts[2] === "list") {
    const userId = decodeURIComponent(parts[1] || "");
    if (!userId) return sendJson(res, 400, { error: "Нужен userId" });

    if (req.method === "GET") {
      return sendJson(res, 200, { list: db.lists[userId] || [] });
    }
    if (req.method === "PUT") {
      const body = await readJson(req, 1024 * 1024);
      if (!Array.isArray(body?.list)) return sendJson(res, 400, { error: "Ожидается { list: [...] }" });
      db.lists[userId] = body.list.filter((id) => typeof id === "string").slice(0, 500);
      await persist();
      return sendJson(res, 200, { ok: true, list: db.lists[userId] });
    }
  }

  // ---------------- Прогресс просмотра: /api/users/:userId/progress
  if (parts[0] === "users" && parts[2] === "progress") {
    const userId = decodeURIComponent(parts[1] || "");
    if (!userId) return sendJson(res, 400, { error: "Нужен userId" });

    if (req.method === "GET") {
      return sendJson(res, 200, { progress: db.progress[userId] || {} });
    }
    if (req.method === "PUT") {
      const body = await readJson(req, 1024 * 1024);
      const item = body?.progress;
      if (!item || typeof item.itemId !== "string") {
        return sendJson(res, 400, { error: "Ожидается { progress: {...} }" });
      }
      db.progress[userId] = { ...(db.progress[userId] || {}), [item.itemId]: item };
      await persist();
      return sendJson(res, 200, { ok: true });
    }
  }

  // ---------------- Загрузка файлов (только админ)
  // POST /api/upload?name=poster.jpg  (тело — сырые байты файла)
  if (path === "/upload" && req.method === "POST") {
    if (!isAuthorized(req)) return sendJson(res, 401, { error: "Нужен токен админки" });
    const originalName = url.searchParams.get("name") || "file";
    const fileName = safeFileName(originalName);
    const dest = join(UPLOAD_DIR, fileName);
    const buf = await readBody(req, MAX_UPLOAD_BYTES);
    await writeFile(dest, buf);
    const kind = extname(fileName).toLowerCase().match(/\.(mp4|webm|mp3)$/) ? "video" : "image";
    return sendJson(res, 200, {
      ok: true,
      url: `/uploads/${fileName}`,
      name: fileName,
      size: buf.length,
      kind,
    });
  }

  // GET /api/uploads — список загруженных файлов (админ)
  if (path === "/uploads" && req.method === "GET") {
    if (!isAuthorized(req)) return sendJson(res, 401, { error: "Нужен токен админки" });
    const entries = await listUploads();
    return sendJson(res, 200, { files: entries });
  }

  // DELETE /api/uploads/:name (админ)
  if (parts[0] === "uploads" && parts[1] && req.method === "DELETE") {
    if (!isAuthorized(req)) return sendJson(res, 401, { error: "Нужен токен админки" });
    const name = basename(decodeURIComponent(parts.slice(1).join("/")));
    try {
      await unlink(join(UPLOAD_DIR, name));
      return sendJson(res, 200, { ok: true });
    } catch {
      return sendJson(res, 404, { error: "Файл не найден" });
    }
  }

  // POST /api/auth/check — проверить токен
  if (path === "/auth/check" && req.method === "POST") {
    return sendJson(res, isAuthorized(req) ? 200 : 401, { ok: isAuthorized(req) });
  }

  return sendJson(res, 404, { error: `Неизвестный маршрут ${req.method} ${url.pathname}` });
}

async function listUploads() {
  const { readdir } = await import("node:fs/promises");
  try {
    const names = await readdir(UPLOAD_DIR);
    const out = [];
    for (const name of names) {
      try {
        const info = await stat(join(UPLOAD_DIR, name));
        if (!info.isFile()) continue;
        out.push({
          name,
          url: `/uploads/${name}`,
          size: info.size,
          kind: extname(name).toLowerCase().match(/\.(mp4|webm|mp3)$/) ? "video" : "image",
          createdAt: info.mtimeMs,
        });
      } catch {
        /* файл удалили между чтениями */
      }
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

// ------------------------------------------------------- отдача статики/SPA

const WEB_DIR = resolve(process.env.WEB_DIR || "dist");

async function serveStatic(req, res, url) {
  // /uploads/* — файлы, загруженные через админку
  if (url.pathname.startsWith("/uploads/")) {
    const name = basename(decodeURIComponent(url.pathname.slice("/uploads/".length)));
    const filePath = join(UPLOAD_DIR, name);
    try {
      const info = await stat(filePath);
      const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, {
        ...CORS_HEADERS,
        "Content-Type": type,
        "Content-Length": info.size,
        "Cache-Control": "public, max-age=86400",
      });
      if (req.method === "HEAD") return res.end();
      return createReadStream(filePath).pipe(res);
    } catch {
      return sendJson(res, 404, { error: "Файл не найден" });
    }
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const filePath = join(WEB_DIR, rel);
  if (!filePath.startsWith(WEB_DIR)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const info = await stat(filePath);
    const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      ...CORS_HEADERS,
      "Content-Type": type,
      "Content-Length": info.size,
      "Cache-Control": extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600",
    });
    if (req.method === "HEAD") return res.end();
    return createReadStream(filePath).pipe(res);
  } catch {
    // SPA-фолбэк
    try {
      const html = await readFile(join(WEB_DIR, "index.html"));
      res.writeHead(200, {
        ...CORS_HEADERS,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": html.length,
        "Cache-Control": "no-cache",
      });
      return res.end(html);
    } catch {
      res.writeHead(404, { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Сборка не найдена. Выполните npm run build.");
    }
  }
}

// ------------------------------------------------------------------- запуск

const server = createServer(async (req, res) => {
  const started = Date.now();
  res.on("finish", () => log(req, res, `${Date.now() - started}ms`));

  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS_HEADERS);
      return res.end();
    }

    if (url.pathname.startsWith("/api/")) {
      return await handleApi(req, res, url);
    }

    return await serveStatic(req, res, url);
  } catch (err) {
    const status = err?.status || 500;
    if (status >= 500) console.error("[err]", err);
    if (!res.headersSent) sendJson(res, status, { error: err?.message || "Внутренняя ошибка" });
    else res.end();
  }
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;

await loadDb();

server.listen(PORT, HOST, () => {
  console.log(`F304Lteam API + сайт на http://${HOST}:${PORT}`);
  console.log(`  данные:  ${DATA_DIR}`);
  console.log(`  статика: ${WEB_DIR}`);
  if (ADMIN_TOKEN) console.log(`  админ-токен: ${ADMIN_TOKEN}`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    try {
      await saveQueue;
    } catch {
      /* уже записано */
    }
    server.close();
    process.exit(0);
  });
}
