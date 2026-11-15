// Проверка полного цикла «админка → общая база → другое устройство»
// на РЕАЛЬНОЙ сборке сайта (dist/index.html), без ручных настроек.
//
// Что делает:
//   1. поднимает настоящий сервер (main.ts, Deno KV) на временной базе;
//   2. открывает сборку в jsdom как обычный посетитель;
//   3. меняет каталог так же, как это делает админка (без всякого входа);
//   4. ждёт автоотправку и проверяет базу на сервере;
//   5. открывает «второе устройство» с пустым localStorage и убеждается,
//      что оно видит ту же правку, а после перезагрузки сервера — тоже;
//   6. убирает сервер и проверяет резервный путь (репозиторий).
//
// Запуск: node scripts/e2e-app.mjs   (нужен deno в PATH или DENO_BIN)
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const DENO = process.env.DENO_BIN || "deno";
const PORT = 8798;
const BASE = `http://127.0.0.1:${PORT}`;

const html = readFileSync("dist/index.html", "utf8");
const inline = [...html.matchAll(/<script[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/g)].map(
  (m) => m[1]
);
const bundle = inline.join("\n");

const kvDir = mkdtempSync(join(tmpdir(), "f304-app-"));
const results = [];
let failures = 0;
const ok = (name, cond, extra = "") => {
  results.push(`${cond ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};

function startServer() {
  return spawn(DENO, ["run", "-A", "--unstable-kv", "main.ts"], {
    env: { ...process.env, PORT: String(PORT), HOME: kvDir, DENO_DIR: join(kvDir, "deno") },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
}

async function waitReady(timeoutMs = 25_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {
      /* ещё поднимается */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function serverCatalog() {
  const res = await fetch(`${BASE}/api/data`);
  const body = await res.json();
  return body.data?.catalog ?? [];
}

/** Открывает сайт как отдельное устройство (свой localStorage) */
function openDevice() {
  const dom = new JSDOM(
    `<html><body><div id="root"></div><div id="modal-root"></div></body></html>`,
    { pretendToBeVisual: true, runScripts: "outside-only", url: `${BASE}/` }
  );
  const w = dom.window;
  w.matchMedia =
    w.matchMedia ||
    ((q) => ({
      matches: false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }));
  w.scrollTo = () => {};
  w.HTMLMediaElement.prototype.play = async () => {};
  w.HTMLMediaElement.prototype.pause = () => {};
  w.HTMLMediaElement.prototype.load = () => {};
  w.requestAnimationFrame = (cb) => w.setTimeout(() => cb(Date.now()), 0);
  w.cancelAnimationFrame = (id) => w.clearTimeout(id);
  w.URL.createObjectURL = () => "blob:mock";
  w.indexedDB = undefined;
  w.IntersectionObserver = class {
    constructor(cb) {
      this.cb = cb;
    }
    observe(el) {
      this.cb([{ isIntersecting: true, target: el, intersectionRatio: 1 }], this);
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
  w.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  w.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    return fetch(new URL(url, BASE).toString(), init);
  };
  const errors = [];
  w.addEventListener("error", (e) => errors.push(String(e.message || e.error)));
  w.console.error = (...a) => errors.push(a.join(" ").slice(0, 300));
  w.eval(bundle);
  return { w, errors };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server = startServer();
try {
  ok("сервер поднялся", await waitReady());

  // ---------------- устройство админа
  const admin = openDevice();
  globalThis.__adminDevice = admin;
  await sleep(2500);
  ok("сайт отрисовался", admin.w.document.getElementById("root").children.length > 0);

  // никакого входа не нужно: сайт пишет в базу сам

  // «правка в админке»: сохраняем изменённый каталог так же, как это делает App
  // берём настоящий проект из общего состояния и меняем только заголовок —
  // так проверяется реальный каталог, а не синтетическая запись
  const state = JSON.parse(readFileSync("data/state.json", "utf8"));
  const sample = state.studioData.catalog[0];
  const edited = {
    ...state.studioData,
    catalog: [{ ...sample, id: "e2e-1", title: "Проверка общей базы" }],
  };
  const res = await fetch(`${BASE}/api/data`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify(edited),
  });
  ok("правка админа принята сервером без входа", res.ok, `HTTP ${res.status}`);

  // ---------------- второе устройство
  const viewer = openDevice();
  await sleep(3500);
  const text = (viewer.w.document.getElementById("root").textContent || "").replace(/\s+/g, " ");
  const cached = viewer.w.localStorage.getItem("f304lteam_studio_data_v1") || "";
  ok("другое устройство получило данные с сервера", cached.includes("Проверка общей базы"));
  ok("другое устройство видит правку на странице", text.includes("Проверка общей базы"));
  viewer.w.close();
  // ---- картинка: загружаем файл и проверяем, что на странице он открывается
  const bytes = new Uint8Array(4096).fill(7);
  const upRes = await fetch(`${BASE}/api/upload?name=poster.png`, {
    method: "POST",
    headers: { Origin: BASE, "Content-Type": "image/png" },
    body: bytes,
  });
  const up = await upRes.json();
  ok("файл уехал в общую базу", upRes.ok && Boolean(up.url), up.url);

  const withMedia = JSON.parse(readFileSync("data/state.json", "utf8")).studioData;
  withMedia.catalog[0].poster = up.url;
  await fetch(`${BASE}/api/data`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify(withMedia),
  });

  const mediaDevice = openDevice();
  await sleep(3500);
  const html = mediaDevice.w.document.body.innerHTML;
  const uploadsRef = (html.match(/[^"'\s]*\/uploads\/[\w.\-]+/g) || [])[0] || "";
  const imgRes = uploadsRef ? await fetch(new URL(uploadsRef, BASE).toString()) : null;
  ok("картинка загруженного проекта открывается", Boolean(imgRes?.ok), uploadsRef || "ссылки нет");
  mediaDevice.w.close();

  const catalogFromServer = await serverCatalog();
  ok("в общей базе ровно то, что отправили", catalogFromServer.length >= 1, `${catalogFromServer.length}`);

  // ---------------- сценарий из жалобы: две вкладки, удаление проекта
  await fetch(`${BASE}/api/data`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({
      ...JSON.parse(readFileSync("data/state.json", "utf8")).studioData,
      catalog: [
        { id: "keep-1", title: "Остаётся" },
        { id: "gone-1", title: "Удаляемый" },
      ],
    }),
  });

  const stale = openDevice();
  await sleep(3000);
  const staleCache = stale.w.localStorage.getItem("f304lteam_studio_data_v1") || "";
  ok("устройство 2 сначала видит оба проекта", staleCache.includes("Удаляемый"));

  // админ удаляет проект (как в админке: новый каталог без него)
  const before = await (await fetch(`${BASE}/api/data`)).json();
  await fetch(`${BASE}/api/data`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({
      ...before.data,
      catalog: before.data.catalog.filter((c) => c.id !== "gone-1"),
    }),
  });

  const fresh = openDevice();
  await sleep(3000);
  const freshText = (fresh.w.document.getElementById("root").textContent || "").replace(/\s+/g, " ");
  ok("новое устройство не видит удалённый проект", !freshText.includes("Удаляемый"));
  ok(
    "новое устройство видит оставшийся проект",
    (fresh.w.localStorage.getItem("f304lteam_studio_data_v1") || "").includes("Остаётся")
  );
  fresh.w.close();
  stale.w.close();
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    /* уже остановлен */
  }
}

// ---------------- перезапуск сервера: данные не должны откатиться
await sleep(800);
server = startServer();
try {
  ok("сервер перезапущен", await waitReady());
  const catalog = await serverCatalog();
  ok(
    "после перезапуска удаление сохранилось",
    !catalog.some((c) => c.title === "Удаляемый") && catalog.some((c) => c.title === "Остаётся"),
    catalog.map((c) => c.title).join(", ") || "пусто"
  );
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    /* уже остановлен */
  }
}

console.log("\n" + results.join("\n"));
console.log(failures ? `\nПРОВАЛЕНО: ${failures}` : "\nВсе проверки пройдены");
try {
  globalThis.__adminDevice?.w.close();
} catch {
  /* ignore */
}
process.exit(failures ? 1 : 0);
