#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/andeoske/andeoske_sapice}"
PUBLIC_DIR="${PUBLIC_DIR:-/home/andeoske/public_html}"
BRANCH="${BRANCH:-main}"
NEXT_PUBLIC_BASE_PATH="${DEPLOY_BASE_PATH:-}"
export NEXT_PUBLIC_BASE_PATH

cd "$APP_DIR"

if [ -f ".env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

if [ -f ".env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

npm ci

if [ -f "prisma/schema.prisma" ]; then
  npx prisma generate
  npx prisma migrate deploy
fi

npm run build

if [ -d "out" ]; then
  echo "Deploying static export to $PUBLIC_DIR"
  mkdir -p "$PUBLIC_DIR"
  find "$PUBLIC_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a out/. "$PUBLIC_DIR"/
elif [ -d "dist" ]; then
  echo "Deploying dist build to $PUBLIC_DIR"
  mkdir -p "$PUBLIC_DIR"
  find "$PUBLIC_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a dist/. "$PUBLIC_DIR"/
else
  echo "Nije pronadjen staticki build folder: out/ ili dist/."
  echo "Ako aplikacija treba Node runtime, dodaj pm2/systemd restart umjesto kopiranja u public_html."
  exit 1
fi

echo "Deployed!"
