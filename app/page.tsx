import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const categories = [
  "Pas na lancu",
  "Bez vode/hrane",
  "Ozljeda ili bolest",
  "Nehigijenski uvjeti",
  "Napuštena životinja",
  "Životinja u vozilu",
];

const statuses = [
  "Zaprimljeno",
  "U provjeri",
  "Dodijeljeno",
  "Proslijeđeno",
  "U tijeku",
  "Zaključeno",
];

const reports = [
  {
    id: "AS-2026-014",
    category: "Pas na lancu",
    place: "Okolica Zagreba",
    urgency: "Visoka",
    status: "U provjeri",
  },
  {
    id: "AS-2026-013",
    category: "Neliječena ozljeda",
    place: "Velika Gorica",
    urgency: "Srednja",
    status: "Dodijeljeno",
  },
  {
    id: "AS-2026-012",
    category: "Bez zaklona",
    place: "Samobor",
    urgency: "Niska",
    status: "Zaključeno",
  },
];

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="hero__media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${basePath}/brand.png`} alt="" />
        </div>
        <div className="hero__content">
          <nav className="topbar" aria-label="Glavna navigacija">
            <strong>Anđeoske šapice</strong>
            <div>
              <a href="#prijava">Prijava</a>
              <a href="#dashboard">Pregled</a>
              <a href="#privatnost">Privatnost</a>
            </div>
          </nav>
          <div className="hero__copy">
            <span className="eyebrow">MVP prototip</span>
            <h1>Anđeoske šapice</h1>
            <p>
              Centralno mjesto za strukturiranu prijavu zanemarivanja i
              zlostavljanja životinja, s jasnim tokom provjere, dodjele i
              izvještavanja.
            </p>
            <div className="hero__actions">
              <a className="button button--primary" href="#prijava">
                <ClipboardList size={18} />
                Nova prijava
              </a>
              <a className="button button--ghost" href="#hitno">
                <AlertTriangle size={18} />
                Hitno postupanje
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="band" id="hitno">
        <div className="notice">
          <AlertTriangle />
          <div>
            <strong>Životinja je u neposrednoj opasnosti?</strong>
            <p>
              Prikaži jasnu uputu za kontaktiranje nadležne službe, policije
              ili dežurne veterinarske službe. App bilježi prijavu, ali ne
              zamjenjuje hitni poziv.
            </p>
          </div>
        </div>
      </section>

      <section className="workspace" id="prijava">
        <div className="section-heading">
          <span>Građanin</span>
          <h2>Nova prijava</h2>
        </div>
        <form className="report-form">
          <label>
            Kategorija
            <select defaultValue="Pas na lancu">
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            Lokacija ili približno područje
            <div className="field-with-icon">
              <MapPin size={18} />
              <input placeholder="Npr. naselje, ulica ili opis mjesta" />
            </div>
          </label>
          <label>
            Opis nepravilnosti
            <textarea placeholder="Opis uvjeta, trajanje problema, vidljive ozljede..." />
          </label>
          <div className="form-grid">
            <label>
              Vrsta životinje
              <input placeholder="Pas, mačka, drugo..." />
            </label>
            <label>
              Hitnost
              <select defaultValue="Visoka">
                <option>Visoka</option>
                <option>Srednja</option>
                <option>Niska</option>
              </select>
            </label>
          </div>
          <fieldset>
            <legend>Pas na lancu</legend>
            <div className="checks">
              <label>
                <input type="checkbox" /> Nema vode
              </label>
              <label>
                <input type="checkbox" /> Nema hrane
              </label>
              <label>
                <input type="checkbox" /> Nema zaklona
              </label>
              <label>
                <input type="checkbox" /> Vidljive ozljede
              </label>
            </div>
          </fieldset>
          <div className="upload">
            <Camera />
            <div>
              <strong>Fotografije i video</strong>
              <p>Privitci će biti privatni i dostupni samo ovlaštenima.</p>
            </div>
          </div>
          <label className="checkbox-line">
            <input type="checkbox" />
            Želim podnijeti anonimnu prijavu
          </label>
          <button className="button button--primary" type="button">
            <CheckCircle2 size={18} />
            Spremi prijavu
          </button>
        </form>
      </section>

      <section className="workspace workspace--split" id="dashboard">
        <div>
          <div className="section-heading">
            <span>Volonteri i admin</span>
            <h2>Operativni pregled</h2>
          </div>
          <div className="report-list">
            {reports.map((report) => (
              <article className="report-card" key={report.id}>
                <div>
                  <strong>{report.id}</strong>
                  <p>{report.category}</p>
                </div>
                <span>{report.place}</span>
                <span className={`urgency urgency--${report.urgency.toLowerCase()}`}>
                  {report.urgency}
                </span>
                <span>{report.status}</span>
              </article>
            ))}
          </div>
        </div>
        <aside className="side-panel">
          <h3>Status slučaja</h3>
          <ol className="status-list">
            {statuses.map((status, index) => (
              <li key={status} className={index < 3 ? "is-active" : ""}>
                <span>{index + 1}</span>
                {status}
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="features" id="privatnost">
        <article>
          <ShieldCheck />
          <h3>Privatnost</h3>
          <p>Identitet prijavitelja, točna lokacija i privitci nisu javni.</p>
        </article>
        <article>
          <UserRoundCheck />
          <h3>Provjera</h3>
          <p>Admin validira prijave prije dodjele volonterima ili instituciji.</p>
        </article>
        <article>
          <HeartHandshake />
          <h3>Volonteri</h3>
          <p>Slučajevi se filtriraju prema području, hitnosti i statusu.</p>
        </article>
        <article>
          <FileText />
          <h3>Izvještaji</h3>
          <p>Standardizirani PDF priprema podatke za nadležna tijela.</p>
        </article>
      </section>
    </main>
  );
}
