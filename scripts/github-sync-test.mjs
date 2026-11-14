// Тест GitHub-режима: чтение публичного state.json и запись через Contents API.
// Запуск:  GITHUB_TOKEN=ghp_... node scripts/github-sync-test.mjs
// Без токена проверяется только чтение.
import assert from "node:assert";

const OWNER = "KrsEntertainment";
const REPO = "F304Lteamu";
const BRANCHES = ["arena/f8b646d0-f304lteamu", "main"];
const PATH = "data/state.json";
const TOKEN = process.env.GITHUB_TOKEN || "";

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

const decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
const encode = (text) => Buffer.from(text, "utf8").toString("base64");

const GH_HEADERS = () => ({
  Accept: "application/vnd.github+json",
  "User-Agent": "f304lteam-sync-test",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
});

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    ...init,
    headers: { ...GH_HEADERS(), ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
};

// Чтение так, как это делает браузер: raw-домен, а если сеть его блокирует —
// публичный API (без токена).
const publicRead = async (branch) => {
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${OWNER}/${REPO}/${branch}/${PATH}`,
      { headers: { "User-Agent": "f304lteam-sync-test" } }
    );
    if (res.ok) return { status: res.status, body: await res.json(), via: "raw" };
    if (res.status !== 404) throw new Error(`raw: HTTP ${res.status}`);
  } catch {
    /* пробуем API */
  }
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${encodeURIComponent(branch)}`,
    { headers: { Accept: "application/vnd.github.raw", "User-Agent": "f304lteam-sync-test" } }
  );
  return { status: res.status, body: res.ok ? await res.json() : null, via: "api" };
};

console.log("\nGitHub как общая база данных");

let branch = null;

await check("state.json публично читается (устройство без токена)", async () => {
  for (const candidate of BRANCHES) {
    const { status, body } = await publicRead(candidate);
    if (status === 200 && body) {
      branch = candidate;
      console.log(`    (источник: ${body ? "ok" : "?"})`);
      assert.ok(Array.isArray(body.studioData?.catalog), "нет catalog");
      return;
    }
  }
  throw new Error("state.json не найден ни в одной ветке");
});

await check("в состоянии есть контент студии (общий для всех устройств)", async () => {
  const { body } = await publicRead(branch);
  assert.ok(body.studioData.catalog.length > 0, "каталог пуст");
  assert.ok(body.studioData.actors.length > 0, "нет актёров");
  assert.ok(body.updatedAt > 0, "нет метки времени");
});

if (!TOKEN) {
  console.log("\n  (запись пропущена: не задан GITHUB_TOKEN)");
} else {
  let sha = null;
  let original = null;

  await check("токен имеет доступ к репозиторию", async () => {
    const { status, body } = await api("");
    assert.equal(status, 200, `HTTP ${status}`);
    assert.ok(body.permissions?.push, "нет права push (Contents: Read and write)");
    const file = await api(`/contents/${PATH}?ref=${encodeURIComponent(branch)}`);
    assert.equal(file.status, 200);
    sha = file.body.sha;
    original = decode(file.body.content);
  });

  await check("запись состояния меняет updatedAt и version", async () => {
    const state = JSON.parse(original);
    const next = {
      ...state,
      version: (state.version || 1) + 1,
      updatedAt: Date.now(),
      reason: "sync-test",
      lists: { ...state.lists, dev_test: ["series-nochnoi-kod"] },
    };
    const put = await api(`/contents/${PATH}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "test: sync-check",
        content: encode(JSON.stringify(next, null, 2) + "\n"),
        sha,
        branch,
      }),
    });
    assert.equal(put.status, 200, `HTTP ${put.status} ${JSON.stringify(put.body).slice(0, 120)}`);
  });

  await check("другое устройство видит записанные данные", async () => {
    const { body } = await publicRead(branch);
    assert.deepEqual(body.lists.dev_test, ["series-nochnoi-kod"]);
  });

  await check("откат тестовых изменений", async () => {
    const file = await api(`/contents/${PATH}?ref=${encodeURIComponent(branch)}`);
    const put = await api(`/contents/${PATH}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "test: revert sync-check",
        content: encode(original),
        sha: file.body.sha,
        branch,
      }),
    });
    assert.equal(put.status, 200);
    const { body } = await publicRead(branch);
    assert.equal(body.lists.dev_test, undefined);
  });
}

console.log(failures === 0 ? "\nВсе проверки пройдены\n" : `\nПровалено: ${failures}\n`);
process.exit(failures === 0 ? 0 : 1);
