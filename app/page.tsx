"use client";

import { FormEvent, useEffect, useState } from "react";
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
const apiPath = `${basePath}/api/reports.php`;
const statsApiPath = `${basePath}/api/reports.php?stats=1`;
const categoriesApiPath = `${basePath}/api/categories.php`;

const defaultCategories = [
  "Pas na lancu",
  "Bez vode/hrane",
  "Ozljeda ili bolest",
  "Nehigijenski uvjeti",
  "Napuštena životinja",
  "Životinja u vozilu",
];

const defaultSubcategories: Record<string, string[]> = {
  "Pas na lancu": ["Nema vode", "Nema hrane", "Nema zaklona", "Vidljive ozljede"],
};

const urgencies = ["Visoka", "Srednja", "Niska"];
const maxImageEdge = 1920;
const imageQuality = 0.82;

type Report = {
  id: string;
  category: string;
  place: string;
  urgency: string;
  status: string;
  animal: string;
  description: string;
  reporterEmail: string;
  reporterPhone: string;
  flags: string[];
  anonymous: boolean;
};

type ReportUpload = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
};

type ApiCreateResponse = {
  report: Report;
};

type ApiCategoriesResponse = {
  categories: string[];
  subcategories?: Record<string, string[]>;
};

type PublicStats = {
  totalReports: number;
  resolvedReports: number;
  volunteers: number;
};

function extensionlessName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || "fotografija";
}

function dataUrlFromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function imageElementFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image could not be loaded."));
    };
    image.src = url;
  });
}

async function resizedImageUpload(file: File): Promise<ReportUpload> {
  const image = await imageElementFromFile(file);
  const ratio = Math.min(1, maxImageEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available.");
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("Image could not be resized."));
          return;
        }
        resolve(result);
      },
      "image/jpeg",
      imageQuality,
    );
  });

  return {
    dataUrl: await dataUrlFromBlob(blob),
    fileName: `${extensionlessName(file.name)}.jpg`,
    mimeType: "image/jpeg",
    byteSize: blob.size,
  };
}

async function fileUpload(file: File): Promise<ReportUpload> {
  if (file.type.startsWith("image/")) {
    return resizedImageUpload(file);
  }

  return {
    dataUrl: await dataUrlFromBlob(file),
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    byteSize: file.size,
  };
}

export default function Home() {
  const [categories, setCategories] = useState(defaultCategories);
  const [subcategories, setSubcategories] =
    useState<Record<string, string[]>>(defaultSubcategories);
  const [selectedCategory, setSelectedCategory] = useState("Pas na lancu");
  const [formFeedback, setFormFeedback] = useState<{ message: string; type: "success" | "error" } | null>(
    null,
  );
  const [thanksReportId, setThanksReportId] = useState("");
  const [publicStats, setPublicStats] = useState<PublicStats>({
    totalReports: 0,
    resolvedReports: 0,
    volunteers: 0,
  });
  const [selectedAttachments, setSelectedAttachments] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState("");
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [formStartedAt, setFormStartedAt] = useState(0);

  async function readUploads(files: File[]): Promise<ReportUpload[]> {
    return Promise.all(files.map(fileUpload));
  }

  function handleAttachmentChange(files: FileList | null) {
    const selectedFiles = Array.from(files || []).slice(0, 6);
    setSelectedAttachments(selectedFiles);
    setFormFeedback(null);
  }

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch(categoriesApiPath, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Categories API unavailable");
        }
        const data = (await response.json()) as ApiCategoriesResponse;
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
          setSubcategories(data.subcategories || {});
          setSelectedCategory((current) =>
            data.categories.includes(current) ? current : data.categories[0],
          );
        }
      } catch {
        setCategories(defaultCategories);
        setSubcategories(defaultSubcategories);
      }
    }

    loadCategories();
  }, []);

  useEffect(() => {
    async function loadStats() {
      try {
        const response = await fetch(statsApiPath, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Stats API unavailable");
        }

        const data = (await response.json()) as { stats?: Partial<PublicStats> };
        setPublicStats({
          totalReports: Number(data.stats?.totalReports || 0),
          resolvedReports: Number(data.stats?.resolvedReports || 0),
          volunteers: Number(data.stats?.volunteers || 0),
        });
      } catch {
        setPublicStats({ totalReports: 0, resolvedReports: 0, volunteers: 0 });
      }
    }

    loadStats();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);
    const flags = data.getAll("flags").map(String);
    const oversizedAttachment = selectedAttachments.find(
      (file) => !file.type.startsWith("image/") && file.size > 8 * 1024 * 1024,
    );

    if (oversizedAttachment) {
      setFormFeedback({
        message: `Privitak "${oversizedAttachment.name}" je veći od 8 MB.`,
        type: "error",
      });
      return;
    }

    const uploads = await readUploads(selectedAttachments);
    const oversizedUpload = uploads.find((upload) => upload.byteSize > 8 * 1024 * 1024);

    if (oversizedUpload) {
      setFormFeedback({
        message: `Privitak "${oversizedUpload.fileName}" je i nakon obrade veći od 8 MB.`,
        type: "error",
      });
      return;
    }
    const report: Report = {
      id: "",
      category: String(data.get("category") || "Pas na lancu"),
      place: String(data.get("place") || "Nepoznata lokacija"),
      urgency: String(data.get("urgency") || "Srednja"),
      status: "Zaprimljeno",
      animal: String(data.get("animal") || "Nije navedeno"),
      description: String(data.get("description") || ""),
      reporterEmail: String(data.get("reporterEmail") || ""),
      reporterPhone: String(data.get("reporterPhone") || ""),
      flags,
      anonymous: data.get("anonymous") === "on",
    };

    setIsSaving(true);

    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...report,
          latitude: coordinates?.latitude ?? null,
          longitude: coordinates?.longitude ?? null,
          attachments: uploads,
          website: String(data.get("website") || ""),
          formStartedAt: Number(data.get("formStartedAt") || formStartedAt),
        }),
      });

      if (!response.ok) {
        throw new Error("API save failed");
      }

      const result = (await response.json()) as ApiCreateResponse;
      setFormFeedback(null);
      setThanksReportId(result.report.id);
      setPublicStats((current) => ({
        ...current,
        totalReports: current.totalReports + 1,
      }));
      form.reset();
      setSelectedCategory(categories[0] || "Pas na lancu");
      setSelectedAttachments([]);
      setCoordinates(null);
      setLocationFeedback("");
      setFormStartedAt(Date.now());
    } catch {
      setFormFeedback({
        message: "Prijava nije spremljena. Provjeri podatke i pokušaj ponovno.",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function markFormStarted() {
    if (formStartedAt === 0) {
      setFormStartedAt(Date.now());
    }
  }

  function locateUser() {
    markFormStarted();

    if (!("geolocation" in navigator)) {
      setLocationFeedback("Preglednik ne podržava dohvat lokacije.");
      return;
    }

    setIsLocating(true);
    setLocationFeedback("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude.toFixed(7));
        const longitude = Number(position.coords.longitude.toFixed(7));
        const placeInput = document.querySelector<HTMLInputElement>('input[name="place"]');

        setCoordinates({ latitude, longitude });
        setLocationFeedback("Lokacija je dohvaćena.");

        if (placeInput && placeInput.value.trim() === "") {
          placeInput.value = `${latitude}, ${longitude}`;
        }

        setIsLocating(false);
      },
      () => {
        setLocationFeedback("Lokacija nije dohvaćena. Možeš je upisati ručno.");
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60000,
        timeout: 12000,
      },
    );
  }

  const selectedSubcategories = subcategories[selectedCategory] || [];

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
              <a href="#privatnost">Privatnost</a>
              <a href={`${basePath}/admin`}>Admin</a>
            </div>
          </nav>
          <div className="hero__copy">
            <span className="eyebrow">Sigurna prijava</span>
            <h1>Anđeoske šapice</h1>
            <p>
              Centralno mjesto za strukturiranu prijavu zanemarivanja i zlostavljanja
              životinja, s jasnim tokom provjere i postupanja.
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
              Ako je životinja upravo sada ugrožena, najprije kontaktiraj nadležnu
              službu, policiju ili dežurnu veterinarsku službu. Ovaj obrazac nam
              pomaže da prijavu zabilježimo, provjerimo i pratimo, ali ne zamjenjuje
              hitni poziv.
            </p>
            <p>
              Naš tim će u najkraćem mogućem roku pregledati prijavu, pokušati
              pomoći životinji i poduzeti potrebne korake kako bi se spriječilo
              zlostavljanje, zanemarivanje ili daljnja opasnost.
            </p>
          </div>
          <div>
            <strong>Životinja je u neposrednoj opasnosti?</strong>
            <p>
              Kontaktiraj nadležnu službu, policiju ili dežurnu veterinarsku službu.
              Ovaj obrazac bilježi prijavu, ali ne zamjenjuje hitni poziv.
            </p>
          </div>
        </div>
      </section>

      <section className="workspace" id="prijava">
        <div className="section-heading">
          <span>Građanin</span>
          <h2>Nova prijava</h2>
        </div>
        <form
          className="report-form"
          onFocusCapture={markFormStarted}
          onPointerDownCapture={markFormStarted}
          onSubmit={handleSubmit}
        >
          <label className="hp-field" aria-hidden="true">
            Web stranica
            <input autoComplete="off" name="website" tabIndex={-1} type="text" />
          </label>
          <input name="formStartedAt" type="hidden" value={formStartedAt} />
          <label>
            Kategorija
            <select
              name="category"
              onChange={(event) => setSelectedCategory(event.target.value)}
              required
              value={selectedCategory}
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          {selectedSubcategories.length > 0 ? (
            <fieldset>
              <legend>Podkategorije</legend>
              <div className="checks">
                {selectedSubcategories.map((subcategory) => (
                  <label key={subcategory}>
                    <input name="flags" type="checkbox" value={subcategory} /> {subcategory}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <label>
            Lokacija ili približno područje
            <div className="field-with-icon">
              <MapPin size={18} />
              <input
                name="place"
                placeholder="Npr. naselje, ulica ili opis mjesta"
                required
              />
              <button
                className="field-action"
                disabled={isLocating}
                onClick={locateUser}
                type="button"
              >
                {isLocating ? "Tražim..." : "Dohvati lokaciju"}
              </button>
            </div>
            {locationFeedback ? <small className="field-note">{locationFeedback}</small> : null}
          </label>
          <label>
            Opis nepravilnosti
            <textarea
              name="description"
              placeholder="Opis uvjeta, trajanje problema, vidljive ozljede..."
              required
            />
          </label>
          <div className="upload upload--left">
            <Camera />
            <div>
              <strong>Fotografije i video</strong>
              <p>Privitci će biti privatni i dostupni samo ovlaštenima.</p>
            </div>
            <input
              accept="image/*,video/*"
              aria-label="Dodaj fotografije ili video"
              multiple
              name="attachments"
              onChange={(event) => handleAttachmentChange(event.target.files)}
              type="file"
            />
          </div>
          {selectedAttachments.length > 0 ? (
            <div className="upload-list upload-list--left">
              <strong>Odabrani privitci</strong>
              <ol>
                {selectedAttachments.map((file) => (
                  <li key={`${file.name}-${file.size}`}>
                    <span>{file.name}</span>
                    <small>{(file.size / 1024 / 1024).toFixed(1)} MB</small>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          <div className="form-grid">
            <label>
              Vrsta životinje
              <input name="animal" placeholder="Pas, mačka, drugo..." required />
            </label>
            <label>
              Hitnost
              <select defaultValue="Visoka" name="urgency" required>
                {urgencies.map((urgency) => (
                  <option key={urgency}>{urgency}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label>
              Email
              <input name="reporterEmail" placeholder="ime@email.hr" required type="email" />
            </label>
            <label>
              Kontakt telefon
              <input name="reporterPhone" placeholder="+385..." required type="tel" />
            </label>
          </div>
          <div className="upload upload--legacy">
            <Camera />
            <div>
              <strong>Fotografije i video</strong>
              <p>Privitci će biti privatni i dostupni samo ovlaštenima.</p>
            </div>
            <input
              accept="image/*,video/*"
              aria-label="Dodaj fotografije ili video"
              multiple
              name="attachments"
              onChange={(event) => handleAttachmentChange(event.target.files)}
              type="file"
            />
          </div>
          {selectedAttachments.length > 0 ? (
            <div className="upload-list">
              <strong>Odabrani privitci</strong>
              <ol>
                {selectedAttachments.map((file) => (
                  <li key={`${file.name}-${file.size}`}>
                    <span>{file.name}</span>
                    <small>{(file.size / 1024 / 1024).toFixed(1)} MB</small>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          <label className="checkbox-line">
            <input name="anonymous" type="checkbox" />
            Želim podnijeti anonimnu prijavu
          </label>
          {formFeedback ? (
            <p className={`form-feedback form-feedback--${formFeedback.type}`} role="status">
              {formFeedback.message}
            </p>
          ) : null}
          <button className="button button--primary" disabled={isSaving} type="submit">
            <CheckCircle2 size={18} />
            {isSaving ? "Spremanje..." : "Spremi prijavu"}
          </button>
        </form>
        <div className="public-stats" aria-label="Pregled prijava">
          {[
            { label: "Broj prijava", value: publicStats.totalReports, fill: 100 },
            {
              label: "Broj riješenih slučajeva",
              value: publicStats.resolvedReports,
              fill:
                publicStats.totalReports > 0
                  ? Math.round((publicStats.resolvedReports / publicStats.totalReports) * 100)
                  : 0,
            },
            { label: "Broj volontera", value: publicStats.volunteers, fill: 72 },
            { label: "U pripremi", value: "—", fill: 0 },
          ].map((stat) => (
            <article className="public-stat" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <div className="public-stat__bar">
                <span style={{ width: `${Math.max(0, Math.min(Number(stat.fill) || 0, 100))}%` }} />
              </div>
            </article>
          ))}
        </div>
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

      {thanksReportId ? (
        <div className="thanks-modal" onClick={() => setThanksReportId("")} role="presentation">
          <div className="thanks-modal__card" onClick={(event) => event.stopPropagation()}>
            <div className="thanks-modal__heart" aria-hidden="true">
              <HeartHandshake size={34} />
            </div>
            <span>Prijava {thanksReportId} je zaprimljena</span>
            <h2>Hvala ti što si reagirao/la.</h2>
            <p>
              Svaka prijava može biti prvi korak prema sigurnijem životu za životinju
              koja ne može sama zatražiti pomoć. Životinje to možda ne mogu reći riječima,
              ali ovakva pažnja im zaista znači.
            </p>
            <p>
              Pregledat ćemo prijavu u najkraćem mogućem roku i poduzeti potrebne korake.
            </p>
            <button className="button button--primary" onClick={() => setThanksReportId("")} type="button">
              Zatvori
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
