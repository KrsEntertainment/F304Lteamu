// Быстрая проверка: рендерится ли приложение без ошибок в браузерном окружении
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync("dist/index.html", "utf8");
const inline = [...html.matchAll(/<script[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

const dom = new JSDOM(
  `<html><body><div id="root"></div><div id="modal-root"></div></body></html>`,
  { pretendToBeVisual: true, runScripts: "outside-only", url: "https://5173-io6rkqpuulews01zywugf.e2b.app/" }
);

const w = dom.window;
w.matchMedia = w.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
w.scrollTo = () => {};
w.HTMLMediaElement.prototype.play = async () => {};
w.HTMLMediaElement.prototype.pause = () => {};
w.HTMLMediaElement.prototype.load = () => {};
w.requestAnimationFrame = (cb) => w.setTimeout(() => cb(Date.now()), 0);
w.cancelAnimationFrame = (id) => w.clearTimeout(id);
w.URL.createObjectURL = () => "blob:mock";
w.indexedDB = undefined;
w.IntersectionObserver = class { constructor(cb){ this.cb = cb; } observe(el){ this.cb([{ isIntersecting: true, target: el, intersectionRatio: 1 }], this); } unobserve(){} disconnect(){} takeRecords(){ return []; } };
w.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };

const errors = [];
w.addEventListener("error", (e) => errors.push("window.error: " + (e.message || e.error)));
const origError = w.console.error;
w.console.error = (...a) => { errors.push("console.error: " + a.join(" ").slice(0, 400)); origError(...a); };

const script = inline.join("\n");
try {
  w.eval(script);
} catch (e) {
  errors.push("eval threw: " + (e && e.stack ? e.stack.split("\n").slice(0, 4).join(" | ") : e));
}

await new Promise((r) => setTimeout(r, 1500));

const root = w.document.getElementById("root");
const text = (root.textContent || "").replace(/\s+/g, " ").trim();

console.log("=== ROOT CHILDREN:", root.children.length);
console.log("=== TEXT LENGTH:", text.length);
console.log("=== TEXT SAMPLE:", text.slice(0, 300));
console.log("=== ERROR COUNT:", errors.length);
for (const e of errors.slice(0, 10)) console.log("!!!", e);
process.exit(errors.length > 0 || root.children.length === 0 ? 1 : 0);
