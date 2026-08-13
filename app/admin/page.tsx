"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Mail,
  MapPinned,
  Plus,
  Save,
  Trash2,
  UserRoundPlus,
  X,
  XCircle,
} from "lucide-react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const reportsApiPath = `${basePath}/api/reports.php`;
const categoriesApiPath = `${basePath}/api/categories.php`;
const sessionApiPath = `${basePath}/api/session.php`;
const adminApiPath = `${basePath}/api/admin.php`;

const statuses = [
  "Zaprimljeno",
  "U provjeri",
  "Dodijeljeno",
  "U tijeku",
  "Zaključeno",
];

const urgencies = ["Visoka", "Srednja", "Niska"];
const userRoles = ["VOLUNTEER", "ADMIN", "ORGANIZATION", "REPORTER"];
type AdminView = "reports" | "users";

type Report = {
  id: string;
  category: string;
  place: string;
  urgency: string;
  status: string;
  animal: string;
  description: string;
  reporterEmail: string | null;
  reporterPhone: string | null;
  wantsResolutionNotice: boolean;
  flags: string[];
  anonymous: boolean;
  latitude: number | null;
  longitude: number | null;
  regionId: string | null;
  regionName: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  attachments: ReportAttachment[];
  notifications: ReportNotification[];
  statusHistory: ReportStatusHistory[];
};

type ReportAttachment = {
  url: string;
  fileName: string;
  mimeType: string;
  kind: string;
};

type ReportNotification = {
  id: string;
  recipientName: string;
  recipientEmail: string;
  status: string;
  responseStatus: string | null;
  respondedAt: string | null;
  createdAt: string;
};

type ReportStatusHistory = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  action: string;
  note: string | null;
  changedByName: string | null;
  changedByEmail: string | null;
  createdAt: string;
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

type ReportDraft = {
  status: string;
  regionId: string;
  organizationId: string;
  assignedToId: string;
};

function mapUrl(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}

function mapEmbedUrl(latitude: number, longitude: number) {
  const delta = 0.004;
  const left = longitude - delta;
  const right = longitude + delta;
  const top = latitude + delta;
  const bottom = latitude - delta;

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

function normalizeReports(reports: Report[]): Report[] {
  return reports.map((report) => ({
    ...report,
    wantsResolutionNotice: Boolean(report.wantsResolutionNotice),
    attachments: Array.isArray(report.attachments)
      ? report.attachments.filter(
          (attachment) =>
            attachment &&
            typeof attachment.url === "string" &&
            typeof attachment.mimeType === "string" &&
            typeof attachment.fileName === "string",
        )
      : [],
    notifications: Array.isArray(report.notifications) ? report.notifications : [],
    statusHistory: Array.isArray(report.statusHistory) ? report.statusHistory : [],
  }));
}

function formatNotificationTime(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("hr-HR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function notificationStatusLabel(status: string) {
  return status === "SENT" ? "poslano" : "greška";
}

function notificationResponseLabel(status: string | null) {
  if (status === "ACCEPTED") {
    return "prihvaćeno";
  }

  if (status === "DECLINED") {
    return "odbijeno";
  }

  return "";
}

function statusHistoryActor(entry: ReportStatusHistory) {
  if (entry.changedByName || entry.changedByEmail) {
    return entry.changedByName || entry.changedByEmail;
  }

  const note = entry.note || "";
  const volunteerMatch = note.match(/^Volonter\s+(.+?)\s+(prihvatio|odbio)\s+je/i);
  if (volunteerMatch?.[1]) {
    return volunteerMatch[1];
  }

  const adminMatch = note.match(/^Status promijenio\/la\s+(.+?)\s+iz admin pregleda/i);
  if (adminMatch?.[1]) {
    return adminMatch[1];
  }

  if (entry.action === "CREATED") {
    return "Javni obrazac";
  }

  return "Sustav";
}

function statusHistoryText(entry: ReportStatusHistory) {
  if (entry.fromStatus) {
    return `${entry.fromStatus} -> ${entry.toStatus}`;
  }

  return entry.toStatus;
}

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
  const [reportDrafts, setReportDrafts] = useState<Record<string, ReportDraft>>({});
  const [reportFeedback, setReportFeedback] = useState<Record<string, string>>({});
  const [selectedSubcategoryCategory, setSelectedSubcategoryCategory] = useState("");
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [zoomedAttachment, setZoomedAttachment] = useState<ReportAttachment | null>(null);
  const [adminView, setAdminView] = useState<AdminView>("reports");
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
    setReports(Array.isArray(data.reports) ? normalizeReports(data.reports) : []);
    setReportDrafts({});
    setReportFeedback({});
  }

  async function loadCategories() {
    const response = await fetch(categoriesApiPath, { cache: "no-store" });
    const data = (await response.json()) as CategoriesData;
    applyCategoriesData(data);
  }

  function applyCategoriesData(data: CategoriesData) {
    const nextCategories = Array.isArray(data.categories) ? data.categories : [];
    setCategories(nextCategories);
    setSubcategories(data.subcategories || {});
    setSelectedSubcategoryCategory((current) =>
      current && nextCategories.includes(current) ? current : "",
    );
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
    const username = String(data.get("username") || "");
    const password = String(data.get("password") || "");

    try {
      const response = await fetch(sessionApiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
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
    const category = selectedSubcategoryCategory;
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

  async function saveAdminEntity(event: FormEvent<HTMLFormElement>, type: string, editingId?: string) {
    if (!editingId) {
      await createAdminEntity(event, type);
      return;
    }

    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    const response = await fetch(adminApiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id: editingId, ...data }),
    });

    if (response.ok) {
      setAdminData((await response.json()) as AdminData);
      setAdminFeedback("Izmjene su spremljene.");
      form.reset();
      cancelEntityEdit(type);
      await loadReports();
      return;
    }

    setAdminFeedback("Izmjene nisu spremljene.");
  }

  function cancelEntityEdit(type: string) {
    if (type === "region") {
      setEditingRegion(null);
    }

    if (type === "organization") {
      setEditingOrganization(null);
    }

    if (type === "user") {
      setEditingUser(null);
    }
  }

  async function deleteAdminEntity(type: string, id: string) {
    const response = await fetch(adminApiPath, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
    });

    if (response.ok) {
      setAdminData((await response.json()) as AdminData);
      setAdminFeedback("Zapis je obrisan iz aktivne liste.");
      await loadReports();
      return;
    }

    setAdminFeedback("Zapis nije obrisan.");
  }

  function draftForReport(report: Report): ReportDraft {
    return (
      reportDrafts[report.id] || {
        status: report.status,
        regionId: report.regionId || "",
        organizationId: report.organizationId || "",
        assignedToId: report.assignedToId || "",
      }
    );
  }

  function reportDraftChanged(report: Report, draft: ReportDraft) {
    return (
      draft.status !== report.status ||
      draft.regionId !== (report.regionId || "") ||
      draft.organizationId !== (report.organizationId || "") ||
      draft.assignedToId !== (report.assignedToId || "")
    );
  }

  function updateReportDraft(report: Report, field: keyof ReportDraft, value: string) {
    setReportFeedback((current) => ({ ...current, [report.id]: "" }));
    setReportDrafts((current) => {
      const nextDraft = {
        ...(current[report.id] || {
          status: report.status,
          regionId: report.regionId || "",
          organizationId: report.organizationId || "",
          assignedToId: report.assignedToId || "",
        }),
        [field]: value,
      };

      if (field === "regionId") {
      const nextRegionId = value || null;
      const organizationMatchesRegion = adminData.organizations.some(
        (organization) =>
          organization.id === nextDraft.organizationId && organization.regionId === nextRegionId,
      );
      const assigneeMatchesRegion = volunteers.some(
        (user) => user.id === nextDraft.assignedToId && user.regionId === nextRegionId,
      );

      if (!organizationMatchesRegion) {
          nextDraft.organizationId = "";
      }

      if (!assigneeMatchesRegion) {
          nextDraft.assignedToId = "";
        }
      }

      return { ...current, [report.id]: nextDraft };
    });
  }

  async function saveReportDraft(report: Report, draft: ReportDraft) {
    const response = await fetch(adminApiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "assignment",
        reportId: report.id,
        status: draft.status,
        regionId: draft.regionId,
        organizationId: draft.organizationId,
        assignedToId: draft.assignedToId,
      }),
    });

    if (!response.ok) {
      setReportFeedback((current) => ({ ...current, [report.id]: "Nije spremljeno." }));
      return;
    }

    await loadReports();
    setReportFeedback((current) => ({ ...current, [report.id]: "Spremljeno." }));
  }

  async function notifyVolunteer(report: Report) {
    setReportFeedback((current) => ({ ...current, [report.id]: "Šaljem obavijest..." }));

    const response = await fetch(adminApiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "notifyVolunteer",
        reportId: report.id,
      }),
    });

    if (!response.ok) {
      await loadReports();
      setReportFeedback((current) => ({
        ...current,
        [report.id]: "Obavijest nije poslana.",
      }));
      return;
    }

    await loadReports();
    setReportFeedback((current) => ({ ...current, [report.id]: "Obavijest poslana." }));
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

  const totalReportCount = reports.length;

  const visibleSubcategories = selectedSubcategoryCategory
    ? subcategories[selectedSubcategoryCategory] || []
    : [];

  function organizationsForRegion(regionId: string | null) {
    if (!regionId) {
      return [];
    }

    return adminData.organizations.filter((organization) => organization.regionId === regionId);
  }

  function volunteersForRegion(regionId: string | null) {
    if (!regionId) {
      return [];
    }

    return volunteers.filter((user) => user.regionId === regionId);
  }

  if (!isAdmin) {
    return (
      <main className="admin-shell admin-shell--login">
        <section className="admin-login">
          <a href={`${basePath}/`}>Anđeoske šapice</a>
          <h1>Admin prijava</h1>
          <form autoComplete="on" className="login-form" onSubmit={login}>
            <label>
              Email
              <input
                autoComplete="username"
                autoFocus
                name="username"
                placeholder="admin@email.hr"
                required
                type="email"
              />
            </label>
            <label>
              Lozinka
              <input
                autoComplete="current-password"
                name="password"
                placeholder="Admin lozinka"
                required
                type="password"
              />
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
          <button
            className={`button ${adminView === "reports" ? "button--primary" : "button--quiet"}`}
            onClick={() => setAdminView("reports")}
            type="button"
          >
            Prijave
          </button>
          <button
            className={`button ${adminView === "users" ? "button--primary" : "button--quiet"}`}
            onClick={() => setAdminView("users")}
            type="button"
          >
            Korisnici
          </button>
          <button className="button button--primary" onClick={logout} type="button">
            Odjava
          </button>
        </nav>
      </header>

      <section className={`admin-grid ${adminView === "users" ? "admin-grid--management" : ""}`}>
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
            {visibleReports.map((report) => {
              const draft = draftForReport(report);
              const hasReportChanges = reportDraftChanged(report, draft);
              const reportOrganizations = organizationsForRegion(draft.regionId || null);
              const reportVolunteers = volunteersForRegion(draft.regionId || null);
              const selectedOrganizationId = reportOrganizations.some(
                (organization) => organization.id === draft.organizationId,
              )
                ? draft.organizationId
                : "";
              const selectedAssigneeId = reportVolunteers.some((user) => user.id === draft.assignedToId)
                ? draft.assignedToId
                : "";

              return (
              <article className="report-card report-card--ops" key={report.id}>
                <div className="report-card__summary">
                  <span className={`urgency urgency--${report.urgency.toLowerCase()}`}>
                    {report.urgency}
                  </span>
                  <strong>{report.id}</strong>
                  <p>{report.category}</p>
                  <small>
                    {report.animal}
                    {report.flags.length ? ` - ${report.flags.join(", ")}` : ""}
                    {report.anonymous ? " - anonimno" : ""}
                  </small>
                  {report.attachments.length > 0 ? (
                    <div className="attachment-grid attachment-grid--summary">
                      {report.attachments.map((attachment) => (
                        attachment.mimeType.startsWith("image/") ? (
                          <button
                            className="attachment-thumb"
                            key={`${report.id}-${attachment.url}`}
                            onClick={() => setZoomedAttachment(attachment)}
                            title={attachment.fileName}
                            type="button"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img alt={attachment.fileName} src={attachment.url} />
                          </button>
                        ) : (
                          <a
                            className="attachment-thumb"
                            href={attachment.url}
                            key={`${report.id}-${attachment.url}`}
                            rel="noreferrer"
                            target="_blank"
                            title={attachment.fileName}
                          >
                            <span>{attachment.kind === "VIDEO" ? "Video" : "Privitak"}</span>
                          </a>
                        )
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="report-card__place">
                  <span>{report.place}</span>
                  <small>{report.description}</small>
                  {report.latitude !== null && report.longitude !== null ? (
                    <div className="map-preview">
                      <iframe
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        src={mapEmbedUrl(report.latitude, report.longitude)}
                        title={`Mapa lokacije za prijavu ${report.id}`}
                      />
                      <a
                        className="map-preview__link"
                        href={mapUrl(report.latitude, report.longitude)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Otvori mapu
                      </a>
                    </div>
                  ) : null}
                </div>
                <label className="status-control">
                  Status
                  <select
                    value={draft.status}
                    onChange={(event) => updateReportDraft(report, "status", event.target.value)}
                  >
                    {statuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                  <div className="report-contact">
                    <small>Email: {report.reporterEmail || "Nije upisano"}</small>
                    <small>Telefon: {report.reporterPhone || "Nije upisano"}</small>
                    <small
                      className={`notice-preference ${
                        report.wantsResolutionNotice
                          ? "notice-preference--yes"
                          : "notice-preference--no"
                      }`}
                    >
                      {report.wantsResolutionNotice ? (
                        <CheckCircle2 size={15} aria-hidden="true" />
                      ) : (
                        <XCircle size={15} aria-hidden="true" />
                      )}
                      Želi obavijest
                    </small>
                  </div>
                </label>
                <div className="assignment-grid">
                  <label>
                    Regija
                    <select
                      value={draft.regionId}
                      onChange={(event) => updateReportDraft(report, "regionId", event.target.value)}
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
                      disabled={!draft.regionId}
                      value={selectedOrganizationId}
                      onChange={(event) => updateReportDraft(report, "organizationId", event.target.value)}
                    >
                      <option value="">{draft.regionId ? "Bez grupe" : "Prvo odaberi regiju"}</option>
                      {reportOrganizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>
                          {organization.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Volonter
                    <select
                      disabled={!draft.regionId}
                      value={selectedAssigneeId}
                      onChange={(event) => updateReportDraft(report, "assignedToId", event.target.value)}
                    >
                      <option value="">{draft.regionId ? "Bez volontera" : "Prvo odaberi regiju"}</option>
                      {reportVolunteers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name || user.email}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="report-actions">
                  <button
                    className={`button ${report.assignedToId ? "button--success" : "button--quiet"}`}
                    disabled={hasReportChanges || !report.assignedToId}
                    onClick={() => notifyVolunteer(report)}
                    type="button"
                  >
                    <Mail size={16} />
                    Pošalji obavijest volonteru
                  </button>
                  <div className="report-actions__save">
                    {reportFeedback[report.id] ? (
                      <span className="admin-feedback">{reportFeedback[report.id]}</span>
                    ) : null}
                    <button
                      className="button button--primary"
                      disabled={!hasReportChanges}
                      onClick={() => saveReportDraft(report, draft)}
                      type="button"
                    >
                      Spremi
                    </button>
                  </div>
                </div>
                <div className="notification-log">
                  <strong>Obavijesti</strong>
                  {report.notifications.length > 0 ? (
                    <ol>
                      {report.notifications.flatMap((notification) => {
                        const rows = [
                          <li key={`${notification.id}-sent`}>
                            <span>{formatNotificationTime(notification.createdAt)}</span>
                            <small>
                              {notificationStatusLabel(notification.status)} - {notification.recipientName}
                            </small>
                          </li>,
                        ];

                        if (notification.responseStatus && notification.respondedAt) {
                          rows.push(
                            <li
                              className={`notification-response notification-response--${notification.responseStatus.toLowerCase()}`}
                              key={`${notification.id}-response`}
                            >
                              {notification.responseStatus === "ACCEPTED" ? (
                                <CheckCircle2 size={16} aria-hidden="true" />
                              ) : (
                                <XCircle size={16} aria-hidden="true" />
                              )}
                              <span>{formatNotificationTime(notification.respondedAt)}</span>
                              <small>
                                {notification.recipientName} -{" "}
                                {notificationResponseLabel(notification.responseStatus)}
                              </small>
                            </li>,
                          );
                        }

                        return rows;
                      })}
                    </ol>
                  ) : (
                    <small>Još nema poslanih obavijesti.</small>
                  )}
                </div>
                <div className="status-history-log">
                  <strong>Status log</strong>
                  {report.statusHistory.length > 0 ? (
                    <ol>
                      {report.statusHistory.map((entry) => (
                        <li key={entry.id}>
                          <ClipboardList size={15} aria-hidden="true" />
                          <span>{formatNotificationTime(entry.createdAt)}</span>
                          <small>{statusHistoryActor(entry)}</small>
                          <small>{statusHistoryText(entry)}</small>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <small>Još nema promjena statusa.</small>
                  )}
                </div>
              </article>
              );
            })}
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
            <div className="status-chart" aria-label="Graf statusa prijava">
              {statusCounts.map(({ status, count }) => {
                const percentage = totalReportCount > 0 ? Math.round((count / totalReportCount) * 100) : 0;
                const width = count > 0 ? Math.max(percentage, 6) : 0;

                return (
                  <div className="status-chart__row" key={`chart-${status}`}>
                    <div className="status-chart__label">
                      <span>{status}</span>
                      <strong>{percentage}%</strong>
                    </div>
                    <div className="status-chart__track">
                      <span style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <details className="admin-panel admin-panel--fold">
            <summary className="admin-panel__header">
              <h3>Regije</h3>
              <MapPinned size={18} />
            </summary>
            <form
              className="stack-form"
              key={editingRegion?.id || "new-region"}
              onSubmit={(event) => saveAdminEntity(event, "region", editingRegion?.id)}
            >
              <input
                aria-label="Naziv regije"
                name="name"
                defaultValue={editingRegion?.name || ""}
                placeholder="Npr. Zagreb i okolica"
              />
              <div className="form-actions">
                <button className="button button--primary" type="submit">
                  {editingRegion ? <Save size={18} /> : <Plus size={18} />}
                  {editingRegion ? "Spremi izmjene" : "Dodaj"}
                </button>
                {editingRegion ? (
                  <button
                    className="button button--quiet"
                    onClick={() => cancelEntityEdit("region")}
                    type="button"
                  >
                    <X size={18} />
                    Odustani
                  </button>
                ) : null}
              </div>
            </form>
            <div className="compact-list">
              {adminData.regions.map((region) => (
                <div className="list-row" key={region.id}>
                  <span>{region.name}</span>
                  <button
                    className="icon-button"
                    onClick={() => setEditingRegion(region)}
                    title="Uredi regiju"
                    type="button"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    className="icon-button icon-button--danger"
                    onClick={() => deleteAdminEntity("region", region.id)}
                    title="Obriši regiju"
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </details>

          <details className="admin-panel admin-panel--fold">
            <summary className="admin-panel__header">
              <h3>Grupe i udruge</h3>
              <Building2 size={18} />
            </summary>
            <form
              className="stack-form"
              key={editingOrganization?.id || "new-organization"}
              onSubmit={(event) => saveAdminEntity(event, "organization", editingOrganization?.id)}
            >
              <input
                aria-label="Naziv grupe"
                name="name"
                defaultValue={editingOrganization?.name || ""}
                placeholder="Naziv grupe ili udruge"
              />
              <select
                aria-label="Regija grupe"
                name="regionId"
                defaultValue={editingOrganization?.regionId || ""}
              >
                <option value="">Bez regije</option>
                {adminData.regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
              <div className="form-grid form-grid--compact">
                <input aria-label="Grad" name="city" defaultValue={editingOrganization?.city || ""} placeholder="Grad" />
                <input
                  aria-label="Telefon"
                  name="phone"
                  defaultValue={editingOrganization?.phone || ""}
                  placeholder="Telefon"
                />
              </div>
              <input
                aria-label="Email grupe"
                name="email"
                defaultValue={editingOrganization?.email || ""}
                placeholder="Email"
                type="email"
              />
              <div className="form-actions">
                <button className="button button--primary" type="submit">
                  {editingOrganization ? <Save size={18} /> : <Plus size={18} />}
                  {editingOrganization ? "Spremi izmjene" : "Dodaj"}
                </button>
                {editingOrganization ? (
                  <button
                    className="button button--quiet"
                    onClick={() => cancelEntityEdit("organization")}
                    type="button"
                  >
                    <X size={18} />
                    Odustani
                  </button>
                ) : null}
              </div>
            </form>
            <div className="compact-list">
              {adminData.organizations.map((organization) => (
                <div className="list-row" key={organization.id}>
                  <span>
                    {organization.name}
                    {organization.regionName ? ` - ${organization.regionName}` : ""}
                  </span>
                  <button
                    className="icon-button"
                    onClick={() => setEditingOrganization(organization)}
                    title="Uredi grupu"
                    type="button"
                  >
                    <Edit3 size={16} />
                  </button>
                    <button
                      className="icon-button icon-button--danger"
                      onClick={() => deleteAdminEntity("organization", organization.id)}
                      title="Obriši grupu"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                </div>
              ))}
            </div>
          </details>

          <details className="admin-panel admin-panel--fold">
            <summary className="admin-panel__header">
              <h3>Korisnici i volonteri</h3>
              <UserRoundPlus size={18} />
            </summary>
            <form
              className="stack-form"
              key={editingUser?.id || "new-user"}
              onSubmit={(event) => saveAdminEntity(event, "user", editingUser?.id)}
            >
              <input
                aria-label="Ime korisnika"
                name="name"
                defaultValue={editingUser?.name || ""}
                placeholder="Ime i prezime"
              />
              <input
                aria-label="Email korisnika"
                name="email"
                defaultValue={editingUser?.email || ""}
                placeholder="Email"
                type="email"
              />
              <input
                aria-label={editingUser ? "Nova lozinka korisnika" : "Lozinka korisnika"}
                name="password"
                placeholder={editingUser ? "Nova lozinka" : "Lozinka"}
                required={!editingUser}
                type="password"
              />
              <input
                aria-label="Telefon korisnika"
                name="phone"
                defaultValue={editingUser?.phone || ""}
                placeholder="Telefon"
              />
              <div className="form-grid form-grid--compact">
                <select aria-label="Uloga korisnika" name="role" defaultValue={editingUser?.role || "VOLUNTEER"}>
                  {userRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <select aria-label="Regija korisnika" name="regionId" defaultValue={editingUser?.regionId || ""}>
                  <option value="">Bez regije</option>
                  {adminData.regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>
              <select aria-label="Grupa korisnika" name="organizationId" defaultValue={editingUser?.organizationId || ""}>
                <option value="">Bez grupe</option>
                {adminData.organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
              <div className="form-actions">
                <button className="button button--primary" type="submit">
                  {editingUser ? <Save size={18} /> : <Plus size={18} />}
                  {editingUser ? "Spremi izmjene" : "Dodaj"}
                </button>
                {editingUser ? (
                  <button
                    className="button button--quiet"
                    onClick={() => cancelEntityEdit("user")}
                    type="button"
                  >
                    <X size={18} />
                    Odustani
                  </button>
                ) : null}
              </div>
            </form>
            <div className="compact-list">
              {adminData.users.map((user) => (
                <div className="list-row" key={user.id}>
                  <span>
                    {user.name || user.email} - {user.role}
                    {user.regionName ? ` - ${user.regionName}` : ""}
                  </span>
                  <button
                    className="icon-button"
                    onClick={() => setEditingUser(user)}
                    title="Uredi korisnika"
                    type="button"
                  >
                    <Edit3 size={16} />
                  </button>
                    <button
                      className="icon-button icon-button--danger"
                      onClick={() => deleteAdminEntity("user", user.id)}
                      title="Obriši korisnika"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                </div>
              ))}
            </div>
            {adminFeedback ? (
              <p className="admin-feedback" role="status">
                {adminFeedback}
              </p>
            ) : null}
          </details>

          <details className="admin-panel admin-panel--fold">
            <summary className="admin-panel__header">
              <h3>Kategorije i podkategorije</h3>
              <ClipboardList size={18} />
            </summary>
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
              <select
                aria-label="Kategorija za podkategoriju"
                name="subcategoryCategory"
                onChange={(event) => setSelectedSubcategoryCategory(event.target.value)}
                value={selectedSubcategoryCategory}
              >
                <option value="">Odaberi kategoriju</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input
                aria-label="Naziv nove podkategorije"
                disabled={!selectedSubcategoryCategory}
                name="subcategoryLabel"
                placeholder="Novi checkbox"
              />
              <button className="button button--primary" disabled={!selectedSubcategoryCategory} type="submit">
                <Plus size={18} />
                Dodaj
              </button>
            </form>
            {selectedSubcategoryCategory ? (
              <div className="subcategory-list">
                {visibleSubcategories.map((subcategory) => (
                  <span className="category-pill" key={`${selectedSubcategoryCategory}-${subcategory}`}>
                    {subcategory}
                    <button
                      aria-label={`Obriši podkategoriju ${subcategory}`}
                      onClick={() => deleteSubcategory(selectedSubcategoryCategory, subcategory)}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                ))}
                {visibleSubcategories.length === 0 ? (
                  <p className="empty-state">Nema checkboxova za odabranu kategoriju.</p>
                ) : null}
              </div>
            ) : null}
            {categoryFeedback ? (
              <p className="admin-feedback" role="status">
                {categoryFeedback}
              </p>
            ) : null}
          </details>
        </aside>
      </section>

      {zoomedAttachment ? (
        <div
          className="image-lightbox"
          onClick={() => setZoomedAttachment(null)}
          role="presentation"
        >
          <div className="image-lightbox__content" onClick={(event) => event.stopPropagation()}>
            <button
              className="image-lightbox__close"
              onClick={() => setZoomedAttachment(null)}
              type="button"
            >
              <X size={20} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={zoomedAttachment.fileName} src={zoomedAttachment.url} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
