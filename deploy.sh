#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/andeoske/andeoske_sapice}"
BRANCH="${BRANCH:-main}"
APP_NAME="${APP_NAME:-andeoske-sapice}"

cd "$APP_DIR"

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

npm ci

if [ -f "prisma/schema.prisma" ]; then
  npx prisma generate
  npx prisma migrate deploy
fi

npm run build

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" || pm2 start npm --name "$APP_NAME" -- start
  pm2 save
else
  echo "pm2 nije pronadjen. Dodaj restart komandu za systemd/Docker ili instaliraj pm2."
fi
