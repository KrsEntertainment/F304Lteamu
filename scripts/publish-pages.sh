#!/usr/bin/env bash
# Публикует свежую сборку в ветку gh-pages (источник GitHub Pages).
# Использование: ./scripts/publish-pages.sh [remote]
set -euo pipefail

REMOTE="${1:-origin}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d)"

echo "==> Сборка"
cd "$REPO_DIR"
rm -rf dist
npm run build

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
git -c user.email="bot@arena.ai" -c user.name="Arena Agent" commit -qm "Publish site build $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push --quiet "$REMOTE" gh-pages
echo "==> Готово: https://<user>.github.io/<repo>/"
rm -rf "$TMP_DIR"
