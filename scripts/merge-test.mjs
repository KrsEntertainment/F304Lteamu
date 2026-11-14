// Проверка слияния правок: удаления не откатываются, чужие правки не теряются.
// Запуск: node scripts/merge-test.mjs  (или npm run test:merge)
import { readFileSync } from "node:fs";
import ts from "typescript";

let src = readFileSync("src/utils/merge.ts", "utf8")
  .replace(/import type \{[^}]*\} from "[^"]*";\n/, "")
  .replace(/<T extends \{ id: string \}>/g, "<T>")
  .replace(/\(item\)/g, "(item)");
// типы выкидываем простой регуляркой по аннотациям параметров
src = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const mod = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
const merge = mod.mergeIntoRemote;

const item = (id, title, extra = {}) => ({ id, title, ...extra });
const data = (catalog, actors = [], news = []) => ({ catalog, actors, news, settings: {} });

let fails = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
  if (!cond) fails++;
};

// Сценарий из жалобы: в базе 2 проекта, вкладка A удаляет первый,
// вкладка B (старые данные) сохраняет второй.
const base = data([item("a", "Первый"), item("b", "Второй")]);
const afterUserDelete = data([item("b", "Второй")]);
const remoteStillHasBoth = data([item("a", "Первый"), item("b", "Второй")]);

const r1 = merge(base, afterUserDelete, remoteStillHasBoth, ["a"]);
ok("удалённый проект не воскресает", r1.catalog.map((c) => c.id).join(",") === "b", r1.catalog.map((c) => c.title).join(", "));

// Старая вкладка сохраняет ВЕСЬ старый каталог (как было раньше) — могила спасает
const staleTab = data([item("a", "Первый"), item("b", "Второй")]);
const r2 = merge(base, staleTab, data([item("b", "Второй")]), ["a"]);
ok("старая вкладка не возвращает удалённое", !r2.catalog.some((c) => c.id === "a"), r2.catalog.map((c) => c.id).join(","));

// Правка второго устройства не теряется
const remoteWithNew = data([item("a", "Первый"), item("b", "Второй"), item("c", "Новый с телефона")]);
const r3 = merge(base, data([item("b", "Второй")]), remoteWithNew, ["a"]);
ok("правки с другого устройства сохраняются", r3.catalog.some((c) => c.id === "c"), r3.catalog.map((c) => c.id).join(","));
ok("и удаление при этом применяется", !r3.catalog.some((c) => c.id === "a"));

// Изменение проекта (переименование) переносится на свежие данные
const renamed = data([item("a", "Первый (ред. 2)"), item("b", "Второй")]);
const r4 = merge(base, renamed, data([item("a", "Первый"), item("b", "Второй")]), []);
ok("переименование применяется", r4.catalog.find((c) => c.id === "a")?.title === "Первый (ред. 2)");

// Новый проект добавляется
const added = data([item("a", "Первый"), item("b", "Второй"), item("d", "Свежий")]);
const r5 = merge(base, added, data([item("a", "Первый"), item("b", "Второй")]), []);
ok("новый проект добавляется", r5.catalog.some((c) => c.id === "d"));

// Без базы — берём локальную версию
const r6 = merge(null, data([item("x", "Один")]), data([item("y", "Другой")]), []);
ok("без базы берётся локальная версия", r6.catalog.map((c) => c.id).join(",") === "x");

process.exit(fails ? 1 : 0);
