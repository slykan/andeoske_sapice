"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const apiPath = `${basePath}/api/reports.php`;
const categoriesApiPath = `${basePath}/api/categories.php`;
const sessionApiPath = `${basePath}/api/session.php`;

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

export default function AdminPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginFeedback, setLoginFeedback] = useState("");
  const [categoryFeedback, setCategoryFeedback] = useState("");
  const [statusFilter, setStatusFilter] = useState("Svi statusi");
  const [urgencyFilter, setUrgencyFilter] = useState("Sve hitnosti");

  useEffect(() => {
    loadSession();
    loadReports();
    loadCategories();
  }, []);

  async function loadSession() {
    try {
      const response = await fetch(sessionApiPath, { cache: "no-store" });
      const data = (await response.json()) as { isAdmin: boolean };
      setIsAdmin(data.isAdmin);
    } catch {
      setIsAdmin(false);
    }
  }

  async function loadReports() {
    const response = await fetch(apiPath, { cache: "no-store" });
    const data = (await response.json()) as { reports: Report[] };
    setReports(Array.isArray(data.reports) ? data.reports : []);
  }

  async function loadCategories() {
    const response = await fetch(categoriesApiPath, { cache: "no-store" });
    const data = (await response.json()) as { categories: string[] };
    setCategories(Array.isArray(data.categories) ? data.categories : []);
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

    if (!name) {
      return;
    }

    const response = await fetch(categoriesApiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (response.ok) {
      setCategories((current) =>
        Array.from(new Set([...current, name])).sort((a, b) => a.localeCompare(b, "hr")),
      );
      setCategoryFeedback(`Kategorija "${name}" je dodana.`);
      form.reset();
    } else {
      setCategoryFeedback("Kategorija nije spremljena.");
    }
  }

  async function deleteCategory(name: string) {
    const response = await fetch(categoriesApiPath, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (response.ok) {
      setCategories((current) => current.filter((category) => category !== name));
      setCategoryFeedback(`Kategorija "${name}" je obrisana iz obrasca.`);
    } else {
      setCategoryFeedback("Kategorija nije obrisana.");
    }
  }

  async function updateReportStatus(reportId: string, status: string) {
    setReports((current) =>
      current.map((report) => (report.id === reportId ? { ...report, status } : report)),
    );

    const response = await fetch(apiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reportId, status }),
    });

    if (!response.ok) {
      await loadReports();
    }
  }

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

  if (!isAdmin) {
    return (
      <main className="admin-shell admin-shell--login">
        <section className="admin-login">
          <a href={`${basePath}/`}>Anđeoske šapice</a>
          <h1>Admin prijava</h1>
          <form className="login-form" onSubmit={login}>
            <label>
              Lozinka
              <input name="password" placeholder="Admin lozinka" type="password" />
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
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <span>Anđeoske šapice</span>
          <h1>Admin</h1>
        </div>
        <nav>
          <a className="button button--quiet" href={`${basePath}/`}>
            Javna stranica
          </a>
          <button className="button button--primary" onClick={logout} type="button">
            Odjava
          </button>
        </nav>
      </header>

      <section className="admin-grid">
        <div className="admin-main">
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

        <aside className="admin-side">
          <section className="side-panel">
            <h3>Statusi</h3>
            <ol className="status-list">
              {statusCounts.map(({ status, count }, index) => (
                <li key={status} className={count > 0 ? "is-active" : ""}>
                  <span>{count}</span>
                  {index + 1}. {status}
                </li>
              ))}
            </ol>
          </section>

          <section className="admin-panel">
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
          </section>
        </aside>
      </section>
    </main>
  );
}
