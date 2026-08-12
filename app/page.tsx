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
  Plus,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
} from "lucide-react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const storageKey = "andeoske-sapice-reports";
const apiPath = `${basePath}/api/reports.php`;
const categoriesApiPath = `${basePath}/api/categories.php`;
const sessionApiPath = `${basePath}/api/session.php`;

const defaultCategories = [
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

type ApiListResponse = {
  reports: Report[];
};

type ApiCreateResponse = {
  report: Report;
};

type ApiCategoriesResponse = {
  categories: string[];
};

type ApiSessionResponse = {
  isAdmin: boolean;
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

function readStoredReports() {
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
}

export default function Home() {
  const [reports, setReports] = useState<Report[]>(readStoredReports);
  const [savedReportId, setSavedReportId] = useState("");
  const [statusFilter, setStatusFilter] = useState("Svi statusi");
  const [urgencyFilter, setUrgencyFilter] = useState("Sve hitnosti");
  const [dataSource, setDataSource] = useState<"database" | "browser">("browser");
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState(defaultCategories);
  const [categoryFeedback, setCategoryFeedback] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginFeedback, setLoginFeedback] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadReports() {
      try {
        const response = await fetch(apiPath, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("API unavailable");
        }

        const data = (await response.json()) as ApiListResponse;
        if (isMounted && Array.isArray(data.reports)) {
          setReports(data.reports.length ? data.reports : initialReports);
          setDataSource("database");
        }
      } catch {
        if (isMounted) {
          setReports(readStoredReports());
          setDataSource("browser");
        }
      }
    }

    loadReports();
    loadCategories();

    return () => {
      isMounted = false;
    };

    async function loadCategories() {
      try {
        const response = await fetch(categoriesApiPath, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Categories API unavailable");
        }

        const data = (await response.json()) as ApiCategoriesResponse;
        if (isMounted && Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
        }
      } catch {
        if (isMounted) {
          setCategories(defaultCategories);
        }
      }
    }

    async function loadSession() {
      try {
        const response = await fetch(sessionApiPath, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Session API unavailable");
        }
        const data = (await response.json()) as ApiSessionResponse;
        if (isMounted) {
          setIsAdmin(data.isAdmin);
        }
      } catch {
        if (isMounted) {
          setIsAdmin(false);
        }
      }
    }

    loadSession();
  }, []);

  useEffect(() => {
    if (dataSource === "browser") {
      window.localStorage.setItem(storageKey, JSON.stringify(reports));
    }
  }, [dataSource, reports]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);
    const flags = data.getAll("flags").map(String);
    const draftReport: Report = {
      id: `AS-2026-${String(nextReportNumber + 1).padStart(3, "0")}`,
      category: String(data.get("category") || "Pas na lancu"),
      place: String(data.get("place") || "Nepoznata lokacija"),
      urgency: String(data.get("urgency") || "Srednja"),
      status: "Zaprimljeno",
      animal: String(data.get("animal") || "Nije navedeno"),
      description: String(data.get("description") || ""),
      flags,
      anonymous: data.get("anonymous") === "on",
    };

    setIsSaving(true);

    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftReport),
      });

      if (!response.ok) {
        throw new Error("API save failed");
      }

      const data = (await response.json()) as ApiCreateResponse;
      setReports((currentReports) => [data.report, ...currentReports]);
      setSavedReportId(data.report.id);
      setDataSource("database");
    } catch {
      setReports((currentReports) => [draftReport, ...currentReports]);
      setSavedReportId(draftReport.id);
      setDataSource("browser");
    } finally {
      setIsSaving(false);
      form.reset();
    }
  }

  async function updateReportStatus(reportId: string, status: string) {
    setReports((currentReports) =>
      currentReports.map((report) =>
        report.id === reportId ? { ...report, status } : report,
      ),
    );

    if (dataSource !== "database") {
      return;
    }

    if (!isAdmin) {
      return;
    }

    try {
      const response = await fetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reportId, status }),
      });

      if (!response.ok) {
        throw new Error("API status update failed");
      }
    } catch {
      setDataSource("browser");
    }
  }

  function resetDemoData() {
    setReports(initialReports);
    setSavedReportId("");
    setStatusFilter("Svi statusi");
    setUrgencyFilter("Sve hitnosti");
    setDataSource("browser");
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") || "");

    try {
      const response = await fetch(sessionApiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      setIsAdmin(true);
      setLoginFeedback("");
      form.reset();
    } catch {
      setIsAdmin(false);
      setLoginFeedback("Prijava nije uspjela.");
    }
  }

  async function logout() {
    await fetch(sessionApiPath, { method: "DELETE" });
    setIsAdmin(false);
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("categoryName") || "").trim();

    if (!name || !isAdmin) {
      return;
    }

    try {
      const response = await fetch(categoriesApiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error("Category save failed");
      }

      setCategories((currentCategories) =>
        Array.from(new Set([...currentCategories, name])).sort((a, b) => a.localeCompare(b, "hr")),
      );
      setCategoryFeedback(`Kategorija "${name}" je dodana.`);
      form.reset();
    } catch {
      setCategoryFeedback("Kategorija nije spremljena. Provjeri API ili bazu.");
    }
  }

  async function deleteCategory(name: string) {
    if (!isAdmin) {
      return;
    }

    try {
      const response = await fetch(categoriesApiPath, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error("Category delete failed");
      }

      setCategories((currentCategories) =>
        currentCategories.filter((category) => category !== name),
      );
      setCategoryFeedback(`Kategorija "${name}" je obrisana iz obrasca.`);
    } catch {
      setCategoryFeedback("Kategorija nije obrisana. Provjeri API ili bazu.");
    }
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
              Prijava {savedReportId} je zaprimljena
              {dataSource === "database" ? " i spremljena u bazu." : " i spremljena u ovaj browser."}
            </p>
          ) : null}
          <button className="button button--primary" disabled={isSaving} type="submit">
            <CheckCircle2 size={18} />
            {isSaving ? "Spremanje..." : "Spremi prijavu"}
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
          <div className="data-source">
            {dataSource === "database" ? "Podaci se čitaju iz baze." : "Demo način: podaci su spremljeni samo u ovom browseru."}
          </div>
          <section className="admin-panel" aria-labelledby="admin-title">
            <div className="admin-panel__header">
              <h3 id="admin-title">Admin</h3>
              {isAdmin ? (
                <button className="button button--quiet" onClick={logout} type="button">
                  Odjava
                </button>
              ) : null}
            </div>
            {isAdmin ? (
              <>
                <div>
                  <h3>Kategorije prijava</h3>
                  <form className="category-form" onSubmit={addCategory}>
                    <input
                      aria-label="Naziv nove kategorije"
                      name="categoryName"
                      placeholder="Nova kategorija"
                    />
                    <button className="button button--primary" type="submit">
                      <Plus size={18} />
                      Dodaj
                    </button>
                  </form>
                </div>
                <div className="category-list">
                  {categories.map((category) => (
                    <span className="category-pill" key={category}>
                      {category}
                      <button
                        aria-label={`Obriši kategoriju ${category}`}
                        onClick={() => deleteCategory(category)}
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                {categoryFeedback ? (
                  <p className="admin-feedback" role="status">
                    {categoryFeedback}
                  </p>
                ) : null}
              </>
            ) : (
              <form className="login-form" onSubmit={login}>
                <label>
                  Admin lozinka
                  <input name="password" placeholder="Lozinka" type="password" />
                </label>
                <button className="button button--primary" type="submit">
                  Prijava
                </button>
                {loginFeedback ? (
                  <p className="admin-feedback admin-feedback--error" role="status">
                    {loginFeedback}
                  </p>
                ) : null}
              </form>
            )}
          </section>
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
                {isAdmin ? (
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
                ) : (
                  <span>{report.status}</span>
                )}
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
