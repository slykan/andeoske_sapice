# VPS deploy biljeske

## Cilj

Projekt se razvija lokalno, commita u git repozitorij, a VPS povlaci promjene i gradi aplikaciju preko `deploy.sh`.

## Predlozeni tok

1. Lokalno:
   - razvoj i testiranje
   - `git add`
   - `git commit`
   - `git push`

2. Na VPS-u:
   - `deploy.sh` udje u direktorij aplikacije
   - napravi `git pull`
   - instalira dependencyje
   - generira Prisma/DB klijent ako ga koristimo
   - pokrene migracije
   - napravi production build
   - restarta servis preko `pm2` ili `systemd`

## Tipicni deploy koraci za Next.js

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/andeoske-sapice"
BRANCH="main"

cd "$APP_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

npm ci
npm run build

pm2 restart andeoske-sapice || pm2 start npm --name andeoske-sapice -- start
pm2 save
```

## Sto treba dogovoriti za stvarni server

- Putanja aplikacije na VPS-u
- Koristi li se `pm2`, `systemd`, Docker ili nesto cetvrto
- Node verzija
- Domena i reverse proxy, najcesce Nginx
- SSL certifikat, najcesce Let's Encrypt
- Baza na istom VPS-u ili odvojeno
- Gdje idu uploadani privitci
- Backup baze i privitaka

## Environment varijable

Za MVP ce vjerojatno trebati:

```env
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
EMAIL_FROM=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
UPLOAD_STORAGE=
```

Konkretni nazivi ovise o biblioteci koju izaberemo.

