# Podatkovni model

Ovaj model pokriva MVP tok iz plana: prijavu građana, admin/volontersku obradu, privitke, posebne podatke za psa na lancu, povijest promjena i terenski zapisnik.

## Glavni entiteti

- `User`: prijavitelji, volonteri, administratori i korisnici organizacija.
- `Organization`: udruga ili organizacijska jedinica koja obrađuje prijave.
- `Report`: osnovna prijava sa statusom, hitnosti, lokacijom i prijaviteljem.
- `ChainDetails`: dodatna pitanja za nepravilno držanje psa na lancu.
- `ReportAttachment`: privatne fotografije, video i dokumenti.
- `ReportStatusHistory`: audit zapis svake promjene statusa ili bitne akcije.
- `FieldNote`: terenski zapisnik volontera ili administratora.

## Statusi

Statusi u bazi su engleski enum ključevi radi stabilnosti koda, a UI ih prikazuje na hrvatskom:

- `RECEIVED`: Zaprimljeno
- `IN_REVIEW`: U provjeri
- `ASSIGNED`: Dodijeljeno volonteru
- `FORWARDED`: Proslijeđeno nadležnoj službi
- `IN_PROGRESS`: Postupanje u tijeku
- `CLOSED`: Zaključeno

## Privatnost

Prijava može biti anonimna kroz `isAnonymous`, ali sustav i dalje podržava interne kontakt podatke prijavitelja kada su potrebni ovlaštenim korisnicima. Privitci se modeliraju preko privatnog `storageKey`, ne preko javnog URL-a.

## Deploy

`deploy.sh` automatski pokreće:

```bash
npx prisma generate
npx prisma migrate deploy
```

ako postoji `prisma/schema.prisma`.

Connection URL se čita kroz `prisma.config.ts` iz `DATABASE_URL`, u skladu s Prisma 7 konfiguracijom.
