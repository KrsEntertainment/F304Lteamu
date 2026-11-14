// Минимальный статический сервер для прод-сборки (dist/index.html — один файл).
// Без HMR/websocket, поэтому работает за любым HTTPS-прокси превью.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve("dist");
const HOST = "0.0.0.0";
// Можно слушать несколько портов сразу: PORTS=5173,8080
const PORTS = (process.env.PORTS || String(process.env.PORT || 4173))
  .split(",")
  .map((p) => Number(p.trim()))
  .filter((p) => Number.isFinite(p) && p > 0);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".txt": "text/plain; charset=utf-8",
};

const BASE_HEADERS = {
  // Ничего не блокируем: превью открывается внутри iframe на домене платформы.
  "Access-Control-Allow-Origin": "*",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "X-Content-Type-Options": "nosniff",
};

async function sendFile(req, res, filePath, status = 200) {
  const body = await readFile(filePath);
  const isHtml = extname(filePath).toLowerCase() === ".html";
  res.writeHead(status, {
    ...BASE_HEADERS,
    "Content-Type": MIME[extname(filePath).toLowerCase()] || "application/octet-stream",
    "Content-Length": body.length,
    "Cache-Control": isHtml ? "no-store" : "public, max-age=3600",
  });
  res.end(req.method === "HEAD" ? undefined : body);
}

async function handleRequest(req, res) {
  const started = Date.now();
  const host = req.headers.host || "-";
  const ua = (req.headers["user-agent"] || "-").slice(0, 60);
  res.on("finish", () => {
    console.log(
      `[req] ${new Date().toISOString()} ${req.method} ${req.url} host=${host} ua="${ua}" -> ${res.statusCode} ${Date.now() - started}ms`
    );
  });

  try {
    const url = new URL(req.url || "/", "http://localhost");

    if (url.pathname === "/healthz") {
      const body = Buffer.from(
        JSON.stringify({ ok: true, host, time: new Date().toISOString() }, null, 2)
      );
      res.writeHead(200, { ...BASE_HEADERS, "Content-Type": "application/json; charset=utf-8", "Content-Length": body.length });
      res.end(req.method === "HEAD" ? undefined : body);
      return;
    }

    let rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    let filePath = join(ROOT, rel);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403, { ...BASE_HEADERS, "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = join(filePath, "index.html");
    } catch {
      // SPA-фолбэк: любой неизвестный путь отдаёт index.html
      filePath = join(ROOT, "index.html");
    }

    await sendFile(req, res, filePath);
  } catch (err) {
    console.error("[err]", err && err.stack ? err.stack : err);
    res.writeHead(500, { ...BASE_HEADERS, "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal error: " + (err && err.message));
  }
}

// ВАЖНО: отдельный сервер на каждый порт. Повторный listen() на одном
// и том же объекте в Node молча слушает только первый порт.
function startServer(port) {
  const server = createServer(handleRequest);

  server.on("error", (err) => {
    console.error(`[fatal] порт ${port}: ${err && err.message}`);
  });

  // Держим соединения живыми для прокси превью
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;

  server.listen(port, HOST, () => {
    console.log(`F304Lteam site listening on http://${HOST}:${port} (root: ${ROOT})`);
  });

  return server;
}

const servers = PORTS.map(startServer);

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    for (const s of servers) s.close();
    process.exit(0);
  });
}
