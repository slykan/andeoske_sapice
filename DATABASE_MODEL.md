# Podatkovni model

Ovaj model pokriva MVP tok iz plana: prijavu gradana, admin/volontersku obradu, privitke, posebne podatke za psa na lancu, povijest promjena i terenski zapisnik.

## Glavni entiteti

- `User`: prijavitelji, volonteri, administratori i korisnici organizacija.
- `Organization`: udruga ili organizacijska jedinica koja obraduje prijave.
- `Report`: osnovna prijava sa statusom, hitnosti, lokacijom i prijaviteljem.
- `ChainDetails`: dodatna pitanja za nepravilno drzanje psa na lancu.
- `ReportAttachment`: privatne fotografije, video i dokumenti.
- `ReportStatusHistory`: audit zapis svake promjene statusa ili bitne akcije.
- `FieldNote`: terenski zapisnik volontera ili administratora.

## Statusi

Statusi u bazi su engleski enum kljucevi radi stabilnosti koda, a UI ih prikazuje na hrvatskom:

- `RECEIVED`: Zaprimljeno
- `IN_REVIEW`: U provjeri
- `ASSIGNED`: Dodijeljeno volonteru
- `FORWARDED`: Proslijedeno nadleznoj sluzbi
- `IN_PROGRESS`: Postupanje u tijeku
- `CLOSED`: Zakljuceno

## Privatnost

Prijava moze biti anonimna kroz `isAnonymous`, ali sustav i dalje podrzava interne kontakt podatke prijavitelja kada su potrebni ovlastenim korisnicima. Privitci se modeliraju preko privatnog `storageKey`, ne preko javnog URL-a.

## Deploy

`deploy.sh` automatski pokrece Prisma client generiranje ako postoji `prisma/schema.prisma`:

```bash
npx prisma generate
```

Migracije se pokrecu eksplicitno:

```bash
RUN_DB_MIGRATIONS=1 bash deploy.sh
```

Connection URL se cita kroz `prisma.config.ts` iz `DATABASE_URL`, u skladu s Prisma 7 konfiguracijom.
