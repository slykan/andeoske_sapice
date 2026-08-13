import type { Metadata } from "next";
import { Cookie, Database, EyeOff, Lock, ShieldCheck, Users } from "lucide-react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Privatnost | Anđeoske šapice",
  description:
    "Kako Anđeoske šapice čuvaju podatke prijavitelja: sigurnost, anonimne prijave, kolačići i dijeljenje s trećim stranama.",
};

export default function PrivatnostPage() {
  return (
    <main className="privacy">
      <header className="privacy__top">
        <nav className="topbar" aria-label="Glavna navigacija">
          <a className="privacy__brand" href={`${basePath}/`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="Anđeoske šapice" className="topbar__logo" src={`${basePath}/logo.png`} />
          </a>
          <div>
            <a href={`${basePath}/#prijava`}>Prijava</a>
            <a href={`${basePath}/admin`}>Admin</a>
          </div>
        </nav>
      </header>

      <section className="privacy__hero">
        <span className="eyebrow">Privatnost i sigurnost</span>
        <h1>Tvoji podaci su zaštićeni na svakom koraku</h1>
        <p>
          Prijava zanemarivanja ili zlostavljanja životinje često znači i podijeliti osobne
          podatke - email, telefon, lokaciju. Ozbiljno shvaćamo odgovornost koja dolazi s tim
          povjerenjem. Ovdje objašnjavamo, jasno i bez sitnih slova, što se događa s tvojim
          podacima nakon što pošalješ prijavu.
        </p>
      </section>

      <section className="privacy-grid">
        <article>
          <ShieldCheck />
          <h3>Sigurna pohrana</h3>
          <p>
            Svi podaci prijave čuvaju se na zaštićenom serveru i nisu javno dostupni. Javna
            stranica i javna statistika ne prikazuju ničije ime, email, telefon ni točnu
            lokaciju - vidljivi su isključivo zbirni brojevi (broj prijava, riješenih
            slučajeva i slično).
          </p>
        </article>

        <article>
          <EyeOff />
          <h3>Anonimna prijava</h3>
          <p>
            Ako prijavu pošalješ kao anonimnu, tvoj email i telefon se maskiraju čak i u
            admin sučelju - ni administratori ni volonteri ih ne vide u punom obliku. Koriste
            se isključivo interno, u tehničke svrhe obrade prijave.
          </p>
        </article>

        <article>
          <Users />
          <h3>Tko vidi podatke</h3>
          <p>
            Punu prijavu (kad nije anonimna) vide samo ovlašteni admin i volonter ili udruga
            kojoj je slučaj dodijeljen - i to isključivo radi postupanja po prijavi. Nitko
            drugi nema pristup.
          </p>
        </article>

        <article>
          <Database />
          <h3>Bez trećih strana</h3>
          <p>
            Podatke iz prijave ne prodajemo, ne iznajmljujemo i ne prosljeđujemo trećim
            stranama niti u marketinške svrhe. Dijele se isključivo s nadležnim institucijama
            kada je to nužno za rješavanje konkretnog slučaja.
          </p>
        </article>

        <article>
          <Cookie />
          <h3>Kolačići</h3>
          <p>
            Prijavitelji se ne prijavljuju u sustav pa im se ne postavljaju kolačići za
            praćenje niti analitika. Jedini kolačić na stranici je tehnički, nužan kolačić za
            prijavu u admin sučelje - koriste ga samo administratori, volonteri i udruge.
          </p>
        </article>

        <article>
          <Lock />
          <h3>Koliko dugo čuvamo podatke</h3>
          <p>
            Podatke prijave čuvamo onoliko dugo koliko je potrebno za obradu i evidenciju
            slučaja, a pristup im imaju isključivo ovlašteni korisnici sustava opisani u
            prethodnim točkama.
          </p>
        </article>
      </section>

      <footer className="site-footer">
        <a href="https://on-click.hr" rel="noopener noreferrer" target="_blank">
          Powered by on-click.hr
        </a>
      </footer>
    </main>
  );
}
