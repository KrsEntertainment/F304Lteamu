// Сквозная проверка главного требования:
//   правка из «админки» уходит на сервер, переживает перезапуск и видна
//   другому устройству (другому клиенту без локального кеша).
//
// Запуск: node scripts/e2e-server.mjs   (нужен установленный deno)
// Проверяется на локальном Deno KV сервере (main.ts), без внешней сети.
import { spawn } from "node:child_process";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DENO = process.env.DENO_BIN || "deno";
const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;
const PIN = "9086";

const kvDir = mkdtempSync(join(tmpdir(), "f304-kv-"));
const results = [];
let failures = 0;

function ok(name, condition, extra = "") {
  results.push(`${condition ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!condition) failures++;
}

function startServer() {
  const child = spawn(DENO, ["run", "-A", "--unstable-kv", "main.ts"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      // своя домашняя папка => своя локальная база KV, не трогаем рабочую
      HOME: kvDir,
      DENO_DIR: join(kvDir, "deno"),
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.stdout.on("data", (d) => process.env.DEBUG && process.stdout.write(d));
  child.stderr.on("data", (d) => process.env.DEBUG && process.stderr.write(d));
  return child;
}

async function waitReady(timeoutMs = 25_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {
      /* ещё не поднялся */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function putData(data, pin = PIN) {
  const res = await fetch(`${BASE}/api/data`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${pin}` },
    body: JSON.stringify(data),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function getData() {
  const res = await fetch(`${BASE}/api/data`);
  return res.json();
}

const payload = (titles) => ({
  catalog: titles.map((title, i) => ({ id: `p${i}`, title })),
  actors: [],
  news: [],
  settings: {},
});

// --------------------------------------------------------------------------

const server = startServer();
try {
  ok("сервер стартует", await waitReady());

  const first = await putData(payload(["Проект A", "Проект B"]));
  ok("запись с PIN принимается", first.status === 200, `HTTP ${first.status}`);

  ok("неверный PIN отклоняется", (await putData(payload([]), "0000")).status === 401);

  const afterWrite = await getData();
  ok(
    "правка видна другому устройству",
    afterWrite.data?.catalog?.length === 2,
    `в базе ${afterWrite.data?.catalog?.length} проектов`
  );

  // удаление проекта — главный сценарий жалобы
  await putData(payload(["Проект A"]));
  ok("удаление проекта сохраняется", (await getData()).data?.catalog?.length === 1);
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    /* уже остановлен */
  }
}

// перезапуск процесса сервера — данные должны остаться
await new Promise((r) => setTimeout(r, 800));
const server2 = startServer();
try {
  ok("сервер перезапускается", await waitReady());
  const afterRestart = await getData();
  ok(
    "данные переживают перезапуск",
    afterRestart.data?.catalog?.length === 1 && afterRestart.data?.catalog?.[0]?.title === "Проект A",
    `после перезапуска: ${afterRestart.data?.catalog?.map((c) => c.title).join(", ") || "пусто"}`
  );
} finally {
  try {
    process.kill(-server2.pid, "SIGTERM");
  } catch {
    /* уже остановлен */
  }
  if (!existsSync(kvDir)) console.log("tmp:", kvDir);
}

console.log("\n" + results.join("\n"));
console.log(failures ? `\nПРОВАЛЕНО: ${failures}` : "\nВсе проверки пройдены");
process.exit(failures ? 1 : 0);
