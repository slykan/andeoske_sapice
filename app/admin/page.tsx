"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, MapPinned, Plus, Trash2, UserRoundPlus } from "lucide-react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const reportsApiPath = `${basePath}/api/reports.php`;
const categoriesApiPath = `${basePath}/api/categories.php`;
const sessionApiPath = `${basePath}/api/session.php`;
const adminApiPath = `${basePath}/api/admin.php`;

const statuses = [
  "Zaprimljeno",
  "U provjeri",
  "Dodijeljeno",
  "Proslijeđeno",
  "U tijeku",
  "Zaključeno",
];

const urgencies = ["Visoka", "Srednja", "Niska"];
const userRoles = ["VOLUNTEER", "ADMIN", "ORGANIZATION", "REPORTER"];

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
  regionId: string | null;
  regionName: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  organizationId: string | null;
  organizationName: string | null;
};

type Region = {
  id: string;
  name: string;
};

type Organization = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  regionId: string | null;
  regionName: string | null;
};

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  regionId: string | null;
  regionName: string | null;
  organizationId: string | null;
  organizationName: string | null;
};

type AdminData = {
  regions: Region[];
  organizations: Organization[];
  users: AdminUser[];
};

type CategoriesData = {
  categories: string[];
  subcategories?: Record<string, string[]>;
};

export default function AdminPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<Record<string, string[]>>({});
  const [adminData, setAdminData] = useState<AdminData>({
    regions: [],
    organizations: [],
    users: [],
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginFeedback, setLoginFeedback] = useState("");
  const [categoryFeedback, setCategoryFeedback] = useState("");
  const [adminFeedback, setAdminFeedback] = useState("");
  const [statusFilter, setStatusFilter] = useState("Svi statusi");
  const [urgencyFilter, setUrgencyFilter] = useState("Sve hitnosti");
  const [regionFilter, setRegionFilter] = useState("Sve regije");

  useEffect(() => {
    loadSession();
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadReports();
      loadAdminData();
    }
  }, [isAdmin]);

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
    const response = await fetch(reportsApiPath, { cache: "no-store" });
    if (!response.ok) {
      setReports([]);
      return;
    }

    const data = (await response.json()) as { reports: Report[] };
    setReports(Array.isArray(data.reports) ? data.reports : []);
  }

  async function loadCategories() {
    const response = await fetch(categoriesApiPath, { cache: "no-store" });
    const data = (await response.json()) as CategoriesData;
    applyCategoriesData(data);
  }

  function applyCategoriesData(data: CategoriesData) {
    setCategories(Array.isArray(data.categories) ? data.categories : []);
    setSubcategories(data.subcategories || {});
  }

  async function loadAdminData() {
    const response = await fetch(adminApiPath, { cache: "no-store" });
    if (!response.ok) {
      setAdminData({ regions: [], organizations: [], users: [] });
      return;
    }

    const data = (await response.json()) as AdminData;
    setAdminData({
      regions: Array.isArray(data.regions) ? data.regions : [],
      organizations: Array.isArray(data.organizations) ? data.organizations : [],
      users: Array.isArray(data.users) ? data.users : [],
    });
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
    setReports([]);
    setAdminData({ regions: [], organizations: [], users: [] });
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
      body: JSON.stringify({ type: "category", name }),
    });

    if (response.ok) {
      applyCategoriesData((await response.json()) as CategoriesData);
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
      body: JSON.stringify({ type: "category", name }),
    });

    if (response.ok) {
      applyCategoriesData((await response.json()) as CategoriesData);
      setCategoryFeedback(`Kategorija "${name}" je obrisana iz obrasca.`);
    } else {
      setCategoryFeedback("Kategorija nije obrisana.");
    }
  }

  async function addSubcategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const category = String(data.get("subcategoryCategory") || "").trim();
    const label = String(data.get("subcategoryLabel") || "").trim();

    if (!category || !label) {
      return;
    }

    const response = await fetch(categoriesApiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "subcategory", category, label }),
    });

    if (response.ok) {
      applyCategoriesData((await response.json()) as CategoriesData);
      setCategoryFeedback(`Podkategorija "${label}" je dodana.`);
      form.reset();
    } else {
      setCategoryFeedback("Podkategorija nije spremljena.");
    }
  }

  async function deleteSubcategory(category: string, label: string) {
    const response = await fetch(categoriesApiPath, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "subcategory", category, label }),
    });

    if (response.ok) {
      applyCategoriesData((await response.json()) as CategoriesData);
      setCategoryFeedback(`Podkategorija "${label}" je obrisana iz obrasca.`);
    } else {
      setCategoryFeedback("Podkategorija nije obrisana.");
    }
  }

  async function createAdminEntity(event: FormEvent<HTMLFormElement>, type: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    const response = await fetch(adminApiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...data }),
    });

    if (response.ok) {
      const nextData = (await response.json()) as AdminData;
      setAdminData(nextData);
      setAdminFeedback("Spremljeno.");
      form.reset();
      return;
    }

    setAdminFeedback("Nije spremljeno. Provjeri obavezna polja.");
  }

  async function updateReportStatus(reportId: string, status: string) {
    setReports((current) =>
      current.map((report) => (report.id === reportId ? { ...report, status } : report)),
    );

    const response = await fetch(reportsApiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reportId, status }),
    });

    if (!response.ok) {
      await loadReports();
    }
  }

  async function assignReport(report: Report, field: keyof Report, value: string) {
    const nextReport = { ...report, [field]: value || null };

    setReports((current) =>
      current.map((item) =>
        item.id === report.id ? { ...item, [field]: value || null, status: "Dodijeljeno" } : item,
      ),
    );

    const response = await fetch(adminApiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "assignment",
        reportId: report.id,
        regionId: nextReport.regionId || "",
        organizationId: nextReport.organizationId || "",
        assignedToId: nextReport.assignedToId || "",
      }),
    });

    if (!response.ok) {
      await loadReports();
      return;
    }

    await loadReports();
  }

  const volunteers = useMemo(
    () => adminData.users.filter((user) => user.role === "VOLUNTEER" || user.role === "ADMIN"),
    [adminData.users],
  );

  const visibleReports = useMemo(() => {
    return reports.filter((report) => {
      const matchesStatus = statusFilter === "Svi statusi" || report.status === statusFilter;
      const matchesUrgency = urgencyFilter === "Sve hitnosti" || report.urgency === urgencyFilter;
      const matchesRegion =
        regionFilter === "Sve regije" ||
        (regionFilter === "Bez regije" && !report.regionId) ||
        report.regionId === regionFilter;
      return matchesStatus && matchesUrgency && matchesRegion;
    });
  }, [reports, statusFilter, urgencyFilter, regionFilter]);

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
          <h1>Admin operativa</h1>
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
          <div className="dashboard-tools dashboard-tools--wide">
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
            <label>
              Regija
              <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}>
                <option>Sve regije</option>
                <option>Bez regije</option>
                {adminData.regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="report-list">
            {visibleReports.map((report) => (
              <article className="report-card report-card--ops" key={report.id}>
                <div className="report-card__summary">
                  <strong>{report.id}</strong>
                  <p>{report.category}</p>
                  <small>
                    {report.animal}
                    {report.flags.length ? ` - ${report.flags.join(", ")}` : ""}
                    {report.anonymous ? " - anonimno" : ""}
                  </small>
                </div>
                <div className="report-card__place">
                  <span>{report.place}</span>
                  <small>{report.description}</small>
                </div>
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
                <div className="assignment-grid">
                  <label>
                    Regija
                    <select
                      value={report.regionId || ""}
                      onChange={(event) => assignReport(report, "regionId", event.target.value)}
                    >
                      <option value="">Bez regije</option>
                      {adminData.regions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Grupa
                    <select
                      value={report.organizationId || ""}
                      onChange={(event) => assignReport(report, "organizationId", event.target.value)}
                    >
                      <option value="">Bez grupe</option>
                      {adminData.organizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>
                          {organization.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Volonter
                    <select
                      value={report.assignedToId || ""}
                      onChange={(event) => assignReport(report, "assignedToId", event.target.value)}
                    >
                      <option value="">Bez volontera</option>
                      {volunteers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name || user.email}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
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
            <div className="admin-panel__header">
              <h3>Regije</h3>
              <MapPinned size={18} />
            </div>
            <form className="stack-form" onSubmit={(event) => createAdminEntity(event, "region")}>
              <input aria-label="Naziv regije" name="name" placeholder="Npr. Zagreb i okolica" />
              <button className="button button--primary" type="submit">
                <Plus size={18} />
                Dodaj
              </button>
            </form>
            <div className="compact-list">
              {adminData.regions.map((region) => (
                <span key={region.id}>{region.name}</span>
              ))}
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel__header">
              <h3>Grupe i udruge</h3>
              <Building2 size={18} />
            </div>
            <form className="stack-form" onSubmit={(event) => createAdminEntity(event, "organization")}>
              <input aria-label="Naziv grupe" name="name" placeholder="Naziv grupe ili udruge" />
              <select aria-label="Regija grupe" name="regionId" defaultValue="">
                <option value="">Bez regije</option>
                {adminData.regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
              <div className="form-grid form-grid--compact">
                <input aria-label="Grad" name="city" placeholder="Grad" />
                <input aria-label="Telefon" name="phone" placeholder="Telefon" />
              </div>
              <input aria-label="Email grupe" name="email" placeholder="Email" type="email" />
              <button className="button button--primary" type="submit">
                <Plus size={18} />
                Dodaj
              </button>
            </form>
            <div className="compact-list">
              {adminData.organizations.map((organization) => (
                <span key={organization.id}>
                  {organization.name}
                  {organization.regionName ? ` - ${organization.regionName}` : ""}
                </span>
              ))}
            </div>
          </section>

          <section className="admin-panel">
            <div className="admin-panel__header">
              <h3>Korisnici i volonteri</h3>
              <UserRoundPlus size={18} />
            </div>
            <form className="stack-form" onSubmit={(event) => createAdminEntity(event, "user")}>
              <input aria-label="Ime korisnika" name="name" placeholder="Ime i prezime" />
              <input aria-label="Email korisnika" name="email" placeholder="Email" type="email" />
              <input aria-label="Telefon korisnika" name="phone" placeholder="Telefon" />
              <div className="form-grid form-grid--compact">
                <select aria-label="Uloga korisnika" name="role" defaultValue="VOLUNTEER">
                  {userRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <select aria-label="Regija korisnika" name="regionId" defaultValue="">
                  <option value="">Bez regije</option>
                  {adminData.regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>
              <select aria-label="Grupa korisnika" name="organizationId" defaultValue="">
                <option value="">Bez grupe</option>
                {adminData.organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
              <button className="button button--primary" type="submit">
                <Plus size={18} />
                Dodaj
              </button>
            </form>
            <div className="compact-list">
              {adminData.users.map((user) => (
                <span key={user.id}>
                  {user.name || user.email} - {user.role}
                </span>
              ))}
            </div>
            {adminFeedback ? (
              <p className="admin-feedback" role="status">
                {adminFeedback}
              </p>
            ) : null}
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

            <h3>Podkategorije</h3>
            <form className="subcategory-form" onSubmit={addSubcategory}>
              <select aria-label="Kategorija za podkategoriju" name="subcategoryCategory">
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
              <input
                aria-label="Naziv nove podkategorije"
                name="subcategoryLabel"
                placeholder="Novi checkbox"
              />
              <button className="button button--primary" type="submit">
                <Plus size={18} />
                Dodaj
              </button>
            </form>
            <div className="subcategory-list">
              {categories.map((category) =>
                (subcategories[category] || []).map((subcategory) => (
                  <span className="category-pill" key={`${category}-${subcategory}`}>
                    {category}: {subcategory}
                    <button
                      aria-label={`Obriši podkategoriju ${subcategory}`}
                      onClick={() => deleteSubcategory(category, subcategory)}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                )),
              )}
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
