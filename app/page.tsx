"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
const storageKey = "andeoske-sapice-reports";

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

const urgencies = ["Visoka", "Srednja", "Niska"];

type Report = {
  id: string;
  category: string;
  place: string;
  urgency: string;
  status: string;
  animal: string;
  description: string;
  flags: string[];
  anonymous: boolean;
};

const initialReports: Report[] = [
  {
    id: "AS-2026-014",
    category: "Pas na lancu",
    place: "Okolica Zagreba",
    urgency: "Visoka",
    status: "U provjeri",
    animal: "Pas",
    description: "Dugotrajno držanje na lancu bez vidljivog zaklona.",
    flags: ["Nema zaklona"],
    anonymous: false,
  },
  {
    id: "AS-2026-013",
    category: "Neliječena ozljeda",
    place: "Velika Gorica",
    urgency: "Srednja",
    status: "Dodijeljeno",
    animal: "Mačka",
    description: "Vidljiva ozljeda i otežano kretanje.",
    flags: ["Vidljive ozljede"],
    anonymous: false,
  },
  {
    id: "AS-2026-012",
    category: "Bez zaklona",
    place: "Samobor",
    urgency: "Niska",
    status: "Zaključeno",
    animal: "Pas",
    description: "Provjereno na terenu i zaključeno.",
    flags: [],
    anonymous: true,
  },
];

export default function Home() {
  const [reports, setReports] = useState<Report[]>(() => {
    if (typeof window === "undefined") {
      return initialReports;
    }

    const savedReports = window.localStorage.getItem(storageKey);
    if (!savedReports) {
      return initialReports;
    }

    try {
      const parsedReports = JSON.parse(savedReports) as Report[];
      return Array.isArray(parsedReports) ? parsedReports : initialReports;
    } catch {
      window.localStorage.removeItem(storageKey);
      return initialReports;
    }
  });
  const [savedReportId, setSavedReportId] = useState("");
  const [statusFilter, setStatusFilter] = useState("Svi statusi");
  const [urgencyFilter, setUrgencyFilter] = useState("Sve hitnosti");

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(reports));
    }
  }, [reports]);

  const nextReportNumber = useMemo(() => {
    return reports.reduce((highest, report) => {
      const number = Number(report.id.split("-").at(-1));
      return Number.isFinite(number) ? Math.max(highest, number) : highest;
    }, 0);
  }, [reports]);

  const visibleReports = useMemo(() => {
    return reports.filter((report) => {
      const matchesStatus = statusFilter === "Svi statusi" || report.status === statusFilter;
      const matchesUrgency = urgencyFilter === "Sve hitnosti" || report.urgency === urgencyFilter;
      return matchesStatus && matchesUrgency;
    });
  }, [reports, statusFilter, urgencyFilter]);

  const statusCounts = useMemo(() => {
    return statuses.map((status) => ({
      status,
      count: reports.filter((report) => report.status === status).length,
    }));
  }, [reports]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);
    const reportId = `AS-2026-${String(nextReportNumber + 1).padStart(3, "0")}`;
    const flags = data.getAll("flags").map(String);

    const newReport: Report = {
      id: reportId,
      category: String(data.get("category") || "Pas na lancu"),
      place: String(data.get("place") || "Nepoznata lokacija"),
      urgency: String(data.get("urgency") || "Srednja"),
      status: "Zaprimljeno",
      animal: String(data.get("animal") || "Nije navedeno"),
      description: String(data.get("description") || ""),
      flags,
      anonymous: data.get("anonymous") === "on",
    };

    setReports((currentReports) => [newReport, ...currentReports]);
    setSavedReportId(reportId);
    form.reset();
  }

  function updateReportStatus(reportId: string, status: string) {
    setReports((currentReports) =>
      currentReports.map((report) =>
        report.id === reportId ? { ...report, status } : report,
      ),
    );
  }

  function resetDemoData() {
    setReports(initialReports);
    setSavedReportId("");
    setStatusFilter("Svi statusi");
    setUrgencyFilter("Sve hitnosti");
  }

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
        <form className="report-form" onSubmit={handleSubmit}>
          <label>
            Kategorija
            <select defaultValue="Pas na lancu" name="category">
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            Lokacija ili približno područje
            <div className="field-with-icon">
              <MapPin size={18} />
              <input
                name="place"
                placeholder="Npr. naselje, ulica ili opis mjesta"
                required
              />
            </div>
          </label>
          <label>
            Opis nepravilnosti
            <textarea
              name="description"
              placeholder="Opis uvjeta, trajanje problema, vidljive ozljede..."
              required
            />
          </label>
          <div className="form-grid">
            <label>
              Vrsta životinje
              <input name="animal" placeholder="Pas, mačka, drugo..." required />
            </label>
            <label>
              Hitnost
              <select defaultValue="Visoka" name="urgency">
                {urgencies.map((urgency) => (
                  <option key={urgency}>{urgency}</option>
                ))}
              </select>
            </label>
          </div>
          <fieldset>
            <legend>Pas na lancu</legend>
            <div className="checks">
              <label>
                <input name="flags" type="checkbox" value="Nema vode" /> Nema vode
              </label>
              <label>
                <input name="flags" type="checkbox" value="Nema hrane" /> Nema hrane
              </label>
              <label>
                <input name="flags" type="checkbox" value="Nema zaklona" /> Nema zaklona
              </label>
              <label>
                <input name="flags" type="checkbox" value="Vidljive ozljede" /> Vidljive ozljede
              </label>
            </div>
          </fieldset>
          <div className="upload">
            <Camera />
            <div>
              <strong>Fotografije i video</strong>
              <p>Privitci će biti privatni i dostupni samo ovlaštenima.</p>
            </div>
            <input aria-label="Dodaj fotografije ili video" multiple type="file" />
          </div>
          <label className="checkbox-line">
            <input name="anonymous" type="checkbox" />
            Želim podnijeti anonimnu prijavu
          </label>
          {savedReportId ? (
            <p className="form-feedback" role="status">
              Prijava {savedReportId} je zaprimljena i spremljena u ovaj browser.
            </p>
          ) : null}
          <button className="button button--primary" type="submit">
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
          <div className="dashboard-tools">
            <label>
              Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option>Svi statusi</option>
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              Hitnost
              <select value={urgencyFilter} onChange={(event) => setUrgencyFilter(event.target.value)}>
                <option>Sve hitnosti</option>
                {urgencies.map((urgency) => (
                  <option key={urgency}>{urgency}</option>
                ))}
              </select>
            </label>
            <button className="button button--quiet" onClick={resetDemoData} type="button">
              Vrati demo podatke
            </button>
          </div>
          <div className="report-list">
            {visibleReports.map((report) => (
              <article className="report-card" key={report.id}>
                <div>
                  <strong>{report.id}</strong>
                  <p>{report.category}</p>
                  <small>
                    {report.animal}
                    {report.flags.length ? ` - ${report.flags.join(", ")}` : ""}
                    {report.anonymous ? " - anonimno" : ""}
                  </small>
                </div>
                <span>{report.place}</span>
                <span className={`urgency urgency--${report.urgency.toLowerCase()}`}>
                  {report.urgency}
                </span>
                <label className="status-control">
                  Status
                  <select
                    value={report.status}
                    onChange={(event) => updateReportStatus(report.id, event.target.value)}
                  >
                    {statuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
              </article>
            ))}
            {visibleReports.length === 0 ? (
              <p className="empty-state">Nema prijava za odabrane filtere.</p>
            ) : null}
          </div>
        </div>
        <aside className="side-panel">
          <h3>Status slučaja</h3>
          <ol className="status-list">
            {statusCounts.map(({ status, count }, index) => (
              <li key={status} className={count > 0 ? "is-active" : ""}>
                <span>{count}</span>
                {index + 1}. {status}
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
