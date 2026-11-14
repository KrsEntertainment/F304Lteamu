// Интеграционный тест синхронизации: два «устройства» -> один сервер.
// Проверяем, что данные, сохранённые с одного устройства, видны на другом.
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 8811;
const DATA_DIR = await mkdtemp(join(tmpdir(), "f304-sync-"));
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn(process.execPath, ["server/index.mjs"], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR, ADMIN_TOKEN: "test-token" },
  stdio: ["ignore", "pipe", "pipe"],
});

let logs = "";
server.stdout.on("data", (d) => (logs += d));
server.stderr.on("data", (d) => (logs += d));

const waitUp = async () => {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      /* ещё грузится */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Сервер не поднялся\n" + logs);
};

const api = async (path, init = {}) => {
  const res = await fetch(`${BASE}/api${path}`, init);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};

const json = (method, payload, token) => ({
  method,
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(payload),
});

let failures = 0;
const check = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures += 1;
    console.log(`  ✗ ${name}\n    ${err.message}`);
  }
};

try {
  await waitUp();
  console.log("\nСинхронизация между устройствами");

  const catalog = {
    catalog: [{ id: "film-1", title: "Тестовый фильм", published: true, seasons: [] }],
    actors: [{ id: "actor-1", name: "Актёр" }],
    news: [],
    settings: { announcementText: "Привет", announcementEnabled: true },
  };

  await check("админ сохраняет контент (устройство A)", async () => {
    const { status } = await api("/data", json("PUT", catalog, "test-token"));
    assert.equal(status, 200);
  });

  await check("без токена запись запрещена", async () => {
    const { status } = await api("/data", json("PUT", catalog));
    assert.equal(status, 401);
  });

  await check("устройство B получает тот же контент", async () => {
    const { body } = await api("/data");
    assert.equal(body.data.catalog[0].title, "Тестовый фильм");
    assert.ok(body.updatedAt > 0);
  });

  await check("версия данных растёт после правки (детект изменений)", async () => {
    const first = (await api("/data/version")).body.updatedAt;
    await new Promise((r) => setTimeout(r, 15));
    await api("/data", json("PUT", { ...catalog, settings: { ...catalog.settings, announcementText: "Новое" } }, "test-token"));
    const second = (await api("/data/version")).body.updatedAt;
    assert.ok(second > first, `${second} должно быть больше ${first}`);
  });

  await check("«Мой список» синхронизируется между устройствами", async () => {
    await api("/users/dev_A/list", json("PUT", { list: ["film-1", "film-2"] }));
    const phone = await api("/users/dev_A/list");
    assert.deepEqual(phone.body.list, ["film-1", "film-2"]);
  });

  await check("два устройства имеют независимые списки", async () => {
    await api("/users/dev_B/list", json("PUT", { list: ["film-3"] }));
    const a = (await api("/users/dev_A/list")).body.list;
    const b = (await api("/users/dev_B/list")).body.list;
    assert.deepEqual(a, ["film-1", "film-2"]);
    assert.deepEqual(b, ["film-3"]);
  });

  await check("прогресс просмотра переносится на другое устройство", async () => {
    await api(
      "/users/dev_A/progress",
      json("PUT", { progress: { itemId: "film-1", currentTime: 1240, duration: 6600, updatedAt: 1 } })
    );
    const { body } = await api("/users/dev_A/progress");
    assert.equal(body.progress["film-1"].currentTime, 1240);
  });

  await check("загрузка файла доступна всем устройствам по URL", async () => {
    const bytes = Buffer.from("test-image-bytes");
    const { status, body } = await api("/upload?name=poster.jpg", {
      method: "POST",
      headers: { Authorization: "Bearer test-token" },
      body: bytes,
    });
    assert.equal(status, 200);
    const file = await fetch(`${BASE}${body.url}`);
    assert.equal(file.status, 200);
    const got = Buffer.from(await file.arrayBuffer());
    assert.deepEqual(got, bytes);
  });

  await check("загрузка без токена отклоняется", async () => {
    const { status } = await api("/upload?name=x.jpg", { method: "POST", body: Buffer.from("x") });
    assert.equal(status, 401);
  });

  await check("данные переживают перезапуск сервера", async () => {
    server.kill("SIGTERM");
    await new Promise((r) => server.on("exit", r));
    const again = spawn(process.execPath, ["server/index.mjs"], {
      env: { ...process.env, PORT: String(PORT), DATA_DIR, ADMIN_TOKEN: "test-token" },
      stdio: "ignore",
    });
    await new Promise((r) => setTimeout(r, 800));
    await waitUp();
    const { body } = await api("/data");
    assert.equal(body.data.catalog[0].title, "Тестовый фильм");
    again.kill("SIGTERM");
  });

  await check("файл БД действительно на диске", async () => {
    const raw = JSON.parse(await readFile(join(DATA_DIR, "db.json"), "utf8"));
    assert.equal(raw.data.catalog[0].id, "film-1");
  });

  console.log(failures === 0 ? "\nВсе проверки пройдены\n" : `\nПровалено: ${failures}\n`);
} finally {
  server.kill("SIGTERM");
  await rm(DATA_DIR, { recursive: true, force: true }).catch(() => {});
  process.exit(failures === 0 ? 0 : 1);
}
