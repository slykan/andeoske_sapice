# VPS deploy biljeske

## Cilj

Projekt se razvija lokalno, commita u git repozitorij, a VPS povlaci promjene i gradi aplikaciju preko `deploy.sh`.

## VPS

- Host: `vps.on-click.hr`
- SSH port: `22`
- SSH user: `andeoske`
- Privremeni URL: `https://vps.on-click.hr/~andeoske/`
- Source/backend putanja aplikacije: `/home/andeoske/andeoske_sapice`
- Web root za temp URL: `/home/andeoske/public_html`
- Repo: `https://github.com/slykan/andeoske_sapice.git`

Dogovoreni obrazac: source/backend folder zivi izvan web root-a, a `deploy.sh` povuce git promjene, napravi build i kopira javni output u `/home/andeoske/public_html`.

Napomena: privremeni `~andeoske` URL posluzuje sadrzaj iz `public_html`. Ako prva verzija ide kao staticki build, taj model je idealan. Ako aplikacija treba server-side API rute, auth sesije ili upload kroz Node proces, backend mora raditi odvojeno, a frontend u `public_html` komunicira s njim preko API URL-a.

## Predlozeni tok

1. Lokalno:
   - razvoj i testiranje
   - `git add`
   - `git commit`
   - `git push`

2. Na VPS-u:
   - `deploy.sh` udje u source/backend direktorij aplikacije
   - napravi `git pull`
   - instalira dependencyje
   - napravi production build
   - kopira build output u `/home/andeoske/public_html`

## Tipicni deploy koraci za Next.js

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/andeoske/andeoske_sapice"
PUBLIC_DIR="/home/andeoske/public_html"
BRANCH="main"

cd "$APP_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

npm ci
npm run build

mkdir -p "$PUBLIC_DIR"
find "$PUBLIC_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a out/. "$PUBLIC_DIR"/
```

## Sto treba dogovoriti za stvarni server

- Putanja aplikacije na VPS-u
- Hoce li MVP biti staticki frontend ili frontend + odvojeni backend
- Node verzija
- Domena i konacni web root
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
