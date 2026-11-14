#!/usr/bin/env bash
# Публикует свежую сборку в ветку gh-pages (источник GitHub Pages)
# вместе с текущим state.json — так данные и сайт всегда синхронны.
set -euo pipefail

REMOTE="${1:-origin}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d)"

echo "==> Сборка"
cd "$REPO_DIR"
rm -rf dist
npm run build
cp data/state.json dist/state.json

echo "==> Готовим ветку gh-pages во временной папке"
git clone --quiet --depth 1 --branch gh-pages "$(git remote get-url "$REMOTE")" "$TMP_DIR/site"
find "$TMP_DIR/site" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r dist/. "$TMP_DIR/site/"
: > "$TMP_DIR/site/.nojekyll"

cd "$TMP_DIR/site"
git add -A
if git diff --cached --quiet; then
  echo "==> Изменений нет, публикация не нужна"
  exit 0
fi
git -c user.email="bot@arena.ai" -c user.name="Arena Agent" commit -qm "Publish site + state $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push --quiet "$REMOTE" gh-pages
echo "==> Готово: https://krsentertainment.github.io/F304Lteamu/"
rm -rf "$TMP_DIR"
