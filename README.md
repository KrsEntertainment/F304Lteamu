# F304Lteam — сайт киностудии

Стриминг-платформа студии: каталог, сериалы, актёры, новости, админка.
Данные хранятся **на сервере**, поэтому телефон, ноутбук и планшет видят одно и то же.

## Архитектура

```
┌──────────────┐   GET /api/data (раз в 30 сек)   ┌────────────────────────┐
│  Устройство  │ ───────────────────────────────► │  server/index.mjs      │
│  (браузер)   │ ◄── PUT /api/data (админ) ────── │  JSON-БД + uploads/    │
└──────────────┘   /uploads/<файл> (медиа)        └────────────────────────┘
```

- `server/index.mjs` — Node-сервер без зависимостей: REST API, отдача собранного
  сайта (`dist/`), файлы из `/uploads`, админ-токен, атомарная запись JSON.
- `src/utils/api.ts` — клиент API, адрес сервера и токен хранятся в `localStorage`.
- `src/utils/sync.ts` — стратегия синхронизации: сервер источник правды,
  опрос каждые 30 с + при возврате на вкладку, точечный пуш правок.
- `src/components/ServerSyncPanel.tsx` — вкладка админки «Сервер и синхронизация».

| Данные | Где живут |
| --- | --- |
| Каталог, актёры, новости, настройки | сервер (`server-data/db.json`) |
| Загруженные постеры и видео | сервер (`server-data/uploads/`) |
| «Мой список» и прогресс просмотра | сервер, отдельно для каждого устройства (ID в `localStorage`) |
| Локальный кэш | `localStorage` — работает офлайн, догоняет сервер |

## Деплой сервера (Render, бесплатно)

1. [render.com](https://render.com) → **New → Blueprint** → выберите этот репозиторий.
   В корне лежит `render.yaml`, Render сам прочитает настройки.
2. Render создаст сервис `f304lteam` по `Dockerfile`, диск на `/data` и
   сгенерирует `ADMIN_TOKEN`.
3. В дашборде: **Environment → ADMIN_TOKEN → Reval** — скопируйте значение,
   это токен для входа в админку.
4. Сайт будет на `https://f304lteam.onrender.com` — это ваш постоянный домен
   (API и сайт на одном адресе, настраивать ничего не нужно).

> Бесплатный тариф Render засыпает без трафика ~15 минут и поднимается ~30 секунд.
> Данные на диске сохраняются. Для «всегда онлайн» — тариф Starter или VPS.

### Любой другой хостинг / VPS

```bash
npm ci && npm run build
ADMIN_TOKEN=ваш-секрет DATA_DIR=/path/to/data PORT=8787 node server/index.mjs
```

Docker: `docker build -t f304lteam . && docker run -p 8787:8787 -v f304data:/data -e ADMIN_TOKEN=... f304lteam`

### GitHub Pages (только фронтенд)

Сайт можно держать на Pages, а API — на Render:
1. Опубликуйте сборку: `./scripts/publish-pages.sh`
2. Откройте сайт → тройной клик по логотипу `F304Lteam` → код `9086`
3. Вкладка **«Сервер и синхронизация»** → адрес API: `https://f304lteam.onrender.com`
   и токен админки → **Сохранить и проверить**

## Локальный запуск

```bash
npm install
npm run build
ADMIN_TOKEN=secret node server/index.mjs   # сайт+API на http://localhost:8787
```

Разработка с HMR: `npm run dev` (Vite на 5173, API — отдельно).

## Проверки

```bash
npm run test:sync    # 11 сценариев: два устройства, списки, прогресс, файлы, перезапуск
npm run test:smoke   # сборка рендерится без ошибок консоли
```

## Структура

```
server/index.mjs            API + отдача сайта и /uploads (без зависимостей)
src/
  App.tsx                   главный экран, синхронизация состояния
  components/               UI: панели, модалки, рейлы, плеер, админка
  components/ServerSyncPanel.tsx  настройка сервера и токена
  data/initialData.ts       стартовый контент студии
  utils/api.ts              клиент API, адрес сервера, ID устройства
  utils/sync.ts             pull/push данных, опрос изменений
  utils/mediaStore.ts       загрузка файлов на сервер (fallback — IndexedDB)
  utils/asset.ts            пути к статике (корень домена или подпапка)
public/images/              постеры и фото
scripts/serve.mjs           статический сервер только для статики (legacy)
scripts/publish-pages.sh    публикация фронтенда в ветку gh-pages
scripts/sync-test.mjs       интеграционный тест синхронизации
scripts/smoke.mjs           проверка рендера (jsdom)
Dockerfile, render.yaml     деплой сервера
```
