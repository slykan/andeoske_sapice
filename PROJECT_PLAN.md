# Andeoske sapice - projektni plan

## Smjer

Web aplikacija za sigurnu i strukturiranu prijavu sumnje na zanemarivanje ili zlostavljanje zivotinja, s posebnim tokom za nepravilno drzanje pasa na lancu.

Prva verzija ide kao responsive web aplikacija, dobra za mobitel i desktop, umjesto zasebne mobilne aplikacije. Time brze dolazimo do MVP-a koji se moze testirati s udrugama, volonterima i administratorima.

## Predlozeni stack

- Next.js za aplikaciju i admin sucelje
- PostgreSQL ili MySQL/MariaDB za bazu, ovisno o VPS/panel mogucnostima
- Prisma ili Drizzle za rad s bazom
- Privatna objektna pohrana za fotografije i video
- OpenStreetMap za lokaciju i mapu
- Email servis za obavijesti
- PDF generiranje za izvjestaje prema institucijama
- VPS deploy preko git repozitorija i `deploy.sh`

## Uloge

- Gradjanin/prijavitelj
- Volonter
- Administrator
- Organizacija/udruga

## MVP funkcionalnosti

- Registracija i prijava korisnika
- Role-based pristup
- Obrazac za novu prijavu
- Upload fotografija
- Rucni unos lokacije i opcionalno automatsko lociranje
- Posebna pitanja za psa na lancu
- Statusi prijave
- Admin pregled prijava
- Dodjela prijave volonteru
- Terenski zapisnik
- Povijest promjena
- PDF izvjestaj
- Email obavijesti za bitne promjene

## Statusi prijave

1. Zaprimljeno
2. U provjeri
3. Dodijeljeno volonteru
4. Proslijedjeno nadleznoj sluzbi
5. Postupanje u tijeku
6. Zakljuceno

## Kategorije prijava

- Dugotrajno ili nepravilno drzanje psa na lancu
- Nedostatak vode, hrane ili zaklona
- Fizicko zlostavljanje
- Napustanje zivotinje
- Nelijecene ozljede ili bolesti
- Drzanje u nehigijenskim uvjetima
- Zivotinja zatvorena u vozilu
- Sumnja na ilegalan uzgoj ili borbe zivotinja
- Ozlijedjena ili ugrozena zivotinja na javnoj povrsini

## Privatnost i sigurnost

- Identitet prijavitelja nije vidljiv prijavljenoj osobi
- Tocna lokacija nije javno vidljiva
- Fotografije i video nisu javni
- Osobne podatke vide samo ovlastene uloge
- Svaki pregled i promjena prijave se biljeze
- Uklanjaju se EXIF/geolokacijski podaci iz javno dostupnih slika
- Definira se rok cuvanja osobnih podataka i privitaka
- PDF izvjestaj ukljucuje samo podatke potrebne za postupanje

## Faze

### Faza 1 - temelji

- Inicijalizirati git repozitorij
- Postaviti Next.js projekt
- Dogovoriti VPS deploy tok
- Definirati bazni podatkovni model
- Napraviti osnovni UI kostur

### Faza 2 - MVP prijava

- Auth i uloge
- Nova prijava
- Upload privitaka
- Pregled vlastitih prijava
- Admin pregled i promjena statusa

### Faza 3 - volonterski workflow

- Dodjela slucaja volonteru
- Terenski zapisnik
- Dodavanje biljeski i slika
- Evidencija povijesti statusa

### Faza 4 - izvjestaji i operativa

- PDF izvjestaji
- Email obavijesti
- Filtri i osnovna statistika
- Postavke organizacija i volontera

### Faza 5 - napredno

- Javno neprecizna karta slucajeva
- Napredna analitika
- Push obavijesti
- Integracije s institucijama
- Zasebna mobilna aplikacija ako se pokaze potreba
