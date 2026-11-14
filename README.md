# F304Lteam — сайт киностудии

Стриминг-платформа студии: каталог, сериалы, актёры, новости, админка.
Данные хранятся **в GitHub-репозитории**, поэтому телефон, ноутбук и планшет видят одно и то же.
Внешний хостинг не нужен.

## 🌐 Адреса

- Сайт: **https://krsentertainment.github.io/F304Lteamu/**
- Общая база: **https://raw.githubusercontent.com/KrsEntertainment/F304Lteamu/arena/f8b646d0-f304lteamu/data/state.json**
- Загруженные медиа: `https://krsentertainment.github.io/F304Lteamu/uploads/<файл>`

## Как устроена синхронизация (GitHub-режим, по умолчанию)

```
Устройство A ──запись──► GitHub Contents API (нужен токен) ──► data/state.json
Устройство B ──чтение──► raw.githubusercontent / Pages  ◄──────┘
```

| Что | Где |
| --- | --- |
| Каталог, актёры, новости, настройки | `data/state.json` в репозитории |
| «Мой список», прогресс просмотра | там же, по ID устройства (`lists`, `progress`) |
| Загруженные постеры и видео | ветка `gh-pages`, папка `uploads/` |
| Локальный кэш | `localStorage` — офлайн + мгновенный старт |

- **Чтение** — публичное, без токена: `raw.githubusercontent` (быстро и свежо), резерв — `state.json` на Pages и Contents API.
- **Запись** — через GitHub API вашим токеном, хранится только в браузере.
- **Опрос** — каждые 30 секунд и при возврате на вкладку; прогресс просмотра — не чаще раза в 20 с на релиз.
- **Конфликты** — при одновременной записи с двух устройств запрос повторяется (до 4 раз) с перечитыванием актуальной версии.

### Настройка на новом устройстве (1 минута)

1. Откройте сайт → тройной клик по логотипу `F304Lteam` → код `9086`
2. Вкладка **«Сервер и синхронизация»** → режим **GitHub-репозиторий**
3. Вставьте GitHub-токен: Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → репозиторий `KrsEntertainment/F304Lteamu`, право **Contents: Read and write**
4. **«Сохранить и проверить»** — статус станет «Онлайн», кнопка «Отправить каталог» зальёт текущие данные

Зрителям токен не нужен: они читают общую базу автоматически.

## Альтернатива: свой API-сервер

В репозитории есть полный бэкенд `server/index.mjs` (Node, без зависимостей) + `Dockerfile` и `render.yaml`.
Переключение — в той же вкладке админки: выберите «Свой API-сервер» и укажите адрес.

```bash
npm ci && npm run build
ADMIN_TOKEN=ваш-секрет DATA_DIR=/path/to/data PORT=8787 node server/index.mjs
```

## Локальный запуск и публикация

```bash
npm install
npm run dev              # Vite с HMR (API отдельно: node server/index.mjs)
npm run build            # сборка dist/ + state.json
./scripts/publish-pages.sh   # публикация сайта и состояния в gh-pages
```

## Проверки

```bash
npm run test:smoke       # рендер без ошибок консоли
node scripts/github-sync-test.mjs   # чтение/запись state.json в GitHub (нужен GITHUB_TOKEN)
npm run test:sync        # сценарии для режима своего API
```

## Структура

```
data/state.json             общая база контента и зрительских данных
src/
  App.tsx                   главный экран, синхронизация состояния
  components/ServerSyncPanel.tsx   выбор режима, токен, проверка связи
  utils/githubStore.ts      чтение/запись state.json, загрузка медиа в gh-pages
  utils/sync.ts             pull/push, опрос изменений, нормализация путей
  utils/api.ts              клиент для режима своего API
  utils/mediaStore.ts       медиа: GitHub -> API -> IndexedDB (офлайн)
  utils/asset.ts            пути к статике (корень домена или подпапка)
  data/initialData.ts       стартовый контент студии
server/index.mjs            альтернативный бэкенд (Docker/Render/VPS)
scripts/                    serve, publish, тесты
public/images/              постеры и фото
```
