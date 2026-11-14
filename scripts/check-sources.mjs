// Проверяет, какие адреса сайта и данных реально доступны из вашей сети.
// Запуск:  node scripts/check-sources.mjs
// Хорошо запускать на проблемном устройстве/сети (например, с мобильного интернета).
const timeoutMs = Number(process.env.TIMEOUT_MS || 12000);

const targets = [
  { name: "GitHub Pages — сайт", url: "https://krsentertainment.github.io/F304Lteamu/" },
  { name: "GitHub Pages — данные", url: "https://krsentertainment.github.io/F304Lteamu/state.json" },
  { name: "jsDelivr — сайт", url: "https://cdn.jsdelivr.net/gh/KrsEntertainment/F304Lteamu@gh-pages/" },
  { name: "jsDelivr — данные", url: "https://cdn.jsdelivr.net/gh/KrsEntertainment/F304Lteamu@gh-pages/state.json" },
  { name: "raw.githubusercontent — данные", url: "https://raw.githubusercontent.com/KrsEntertainment/F304Lteamu/main/data/state.json" },
  { name: "GitHub API", url: "https://api.github.com/repos/KrsEntertainment/F304Lteamu" },
  { name: "Google Fonts (шрифты)", url: "https://fonts.googleapis.com/css2?family=Manrope&display=swap" },
];

const check = async ({ name, url }) => {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "f304-check" } });
    const body = await res.arrayBuffer();
    clearTimeout(timer);
    return {
      name,
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      kb: Math.round(body.byteLength / 1024),
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      name,
      ok: false,
      status: "нет ответа",
      ms: Date.now() - started,
      error: err.name === "AbortError" ? "таймаут" : err.message,
    };
  }
};

const results = await Promise.all(targets.map(check));

console.log("\nДоступность источников из вашей сети\n");
for (const r of results) {
  const mark = r.ok ? "OK  " : "FAIL";
  console.log(
    `  ${mark} ${r.name.padEnd(34)} ${String(r.status).padEnd(10)} ${r.ok ? `${r.kb} КБ, ${r.ms} мс` : r.error || ""}`
  );
}

const working = results.filter((r) => r.ok);
const site = results.find((r) => r.name.includes("сайт") && r.ok);
const data = results.find((r) => r.name.includes("данные") && r.ok);

console.log("\nИтого:");
console.log(`  Работает источников: ${working.length} из ${results.length}`);
if (site && data) {
  console.log(`  ✅ Открывайте сайт: ${data.name.includes("jsDelivr") ? "https://cdn.jsdelivr.net/gh/KrsEntertainment/F304Lteamu@gh-pages/" : "https://krsentertainment.github.io/F304Lteamu/"}`);
} else if (site) {
  console.log("  ⚠️ Сайт открывается, но данные недоступны — проверьте state.json на gh-pages.");
} else {
  console.log("  ❌ Ни один адрес не ответил: похоже, блокируются все домены GitHub.");
}
console.log("");
