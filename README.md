# F304Lteam — сайт киностудии

Streaming-платформа студии: каталог, сериалы, актёры, новости, админка.

## Постоянный домен (GitHub Pages) — 1 минута

Готовая ветка `gh-pages` уже в репозитории. Осталось включить хостинг:

1. Откройте **https://github.com/KrsEntertainment/F304Lteamu/settings/pages**
2. **Source** → `Deploy from a branch`
3. **Branch** → `gh-pages` , папка **`/ (root)`** → **Save**
4. Через 1–2 минуты сайт будет здесь:

   **https://krsentertainment.github.io/F304Lteamu/**

> Токен, под которым я работаю в песочнице, — это GitHub App без прав
> на `Actions` и `Pages` (API отвечает `403 Resource not accessible by integration`),
> поэтому включить Pages за вас я не могу. Все остальные шаги сделаны:
> сборка лежит в `gh-pages`, `.nojekyll` на месте, пути относительные.

## Локальный запуск

```bash
npm install
npm start          # прод-сборка на портах 5173, 8080, 3000
npm run dev        # dev-режим Vite с HMR
npm run build      # сборка в dist/ (один HTML-файл + images/)
```

## Обновление сайта на Pages

```bash
./scripts/publish-pages.sh
```

Скрипт собирает проект и пушит результат в `gh-pages` — Pages обновится сам.

## Структура

```
src/
  App.tsx                 главный экран, роутинг по разделам
  components/             UI: панели, модалки, рейлы, плеер, админка
  data/initialData.ts     контент студии (фильмы, сериалы, актёры, новости)
  utils/mediaStore.ts     IndexedDB-хранилище загруженных медиа
  utils/asset.ts          пути к статике (работают в корне и в подпапке)
public/images/            постеры и фото
scripts/serve.mjs         статический сервер прод-сборки (+ /healthz)
scripts/publish-pages.sh  публикация в ветку gh-pages
scripts/smoke.mjs         проверка рендера без падений (jsdom)
```

## Проверка после правок

```bash
npm run build
node scripts/smoke.mjs   # 0 ошибок консоли = приложение монтируется
```
