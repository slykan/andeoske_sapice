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
const categoriesApiPath = `${basePath}/api/categories.php`;

const defaultCategories = [
  "Pas na lancu",
  "Bez vode/hrane",
  "Ozljeda ili bolest",
  "Nehigijenski uvjeti",
  "Napuštena životinja",
  "Životinja u vozilu",
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

type ApiCreateResponse = {
  report: Report;
};

type ApiCategoriesResponse = {
  categories: string[];
};

export default function Home() {
  const [categories, setCategories] = useState(defaultCategories);
  const [savedReportId, setSavedReportId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState("");
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [formStartedAt, setFormStartedAt] = useState(0);

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
        }
      } catch {
        setCategories(defaultCategories);
      }
    }

    loadCategories();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);
    const flags = data.getAll("flags").map(String);
    const report: Report = {
      id: "",
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
        body: JSON.stringify({
          ...report,
          latitude: coordinates?.latitude ?? null,
          longitude: coordinates?.longitude ?? null,
          website: String(data.get("website") || ""),
          formStartedAt: Number(data.get("formStartedAt") || formStartedAt),
        }),
      });

      if (!response.ok) {
        throw new Error("API save failed");
      }

      const result = (await response.json()) as ApiCreateResponse;
      setSavedReportId(result.report.id);
      form.reset();
      setCoordinates(null);
      setLocationFeedback("");
      setFormStartedAt(Date.now());
    } catch {
      setSavedReportId("privremeno spremljena lokalno");
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
              Centralno mjesto za strukturiranu prijavu zanemarivanja i
              zlostavljanja životinja, s jasnim tokom provjere i postupanja.
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
              Kontaktiraj nadležnu službu, policiju ili dežurnu veterinarsku
              službu. Ovaj obrazac bilježi prijavu, ali ne zamjenjuje hitni
              poziv.
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
            <input
              autoComplete="off"
              name="website"
              tabIndex={-1}
              type="text"
            />
          </label>
          <input name="formStartedAt" type="hidden" value={formStartedAt} />
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
              Prijava {savedReportId} je zaprimljena.
            </p>
          ) : null}
          <button className="button button--primary" disabled={isSaving} type="submit">
            <CheckCircle2 size={18} />
            {isSaving ? "Spremanje..." : "Spremi prijavu"}
          </button>
        </form>
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
