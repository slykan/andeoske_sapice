# Server setup

## SSH

```bash
ssh andeoske@vps.on-click.hr
```

## Prvi clone

```bash
cd /home/andeoske
git clone https://github.com/slykan/andeoske_sapice.git
cd /home/andeoske/andeoske_sapice
chmod +x deploy.sh
```

## Prvi deploy

```bash
cd /home/andeoske/andeoske_sapice
./deploy.sh
```

Deploy trenutno gradi staticki Next.js output i kopira ga u:

```bash
/home/andeoske/public_html
```

Privremeni URL:

```text
https://vps.on-click.hr/~andeoske/
```

## Baza

Ako panel nudi MySQL/MariaDB, za pocetak napravi:

- database name: `andeoske_app`
- database user: `andeoske_app`
- strong password
- host: najcesce `localhost`

Zbog prefiksa na cPanel serverima stvarni nazivi mogu ispasti npr:

```text
andeoske_andeoske_app
andeoske_andeoske_app
```

Kad bude spremno, za razvoj backend dijela trebaju nam ovi podaci:

```env
DATABASE_URL="mysql://DB_USER:DB_PASSWORD@localhost:3306/DB_NAME"
```

Nemoj slati lozinku u chat ako ne moras. Mozes je upisati direktno u `.env` na serveru kad dodjemo do backend faze.

## Node

Provjeri na serveru:

```bash
node -v
npm -v
```

Ako komande ne postoje, treba ukljuciti Node.js u panelu ili instalirati Node runtime.

## GitHub pristup na serveru

Ako `git pull` trazi GitHub login, najjednostavnije je koristiti public HTTPS clone za read-only deploy. Ako repo postane private, treba dodati deploy key.

