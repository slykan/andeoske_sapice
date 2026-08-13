"use client";

import { FormEvent, useState } from "react";
import { Gift, Mail, MapPin, Send, UserRoundPlus } from "lucide-react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const contactApiPath = `${basePath}/api/contact.php`;

export default function KontaktPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [formStartedAt, setFormStartedAt] = useState(0);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(
    null,
  );

  function markFormStarted() {
    if (formStartedAt === 0) {
      setFormStartedAt(Date.now());
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    setIsSaving(true);

    try {
      const response = await fetch(contactApiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") || ""),
          organization: String(data.get("organization") || ""),
          phone: String(data.get("phone") || ""),
          email: String(data.get("email") || ""),
          region: String(data.get("region") || ""),
          message: String(data.get("message") || ""),
          website: String(data.get("website") || ""),
          formStartedAt: Number(data.get("formStartedAt") || formStartedAt),
        }),
      });

      if (!response.ok) {
        throw new Error("Contact API failed");
      }

      form.reset();
      setFormStartedAt(Date.now());
      setFeedback({ message: "Poruka je poslana. Javit ćemo ti se uskoro.", type: "success" });
    } catch {
      setFeedback({
        message: "Poruka nije poslana. Provjeri podatke i pokušaj ponovno.",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

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
            <a href={`${basePath}/privatnost`}>Privatnost</a>
            <a href={`${basePath}/admin`}>Admin</a>
          </div>
        </nav>
      </header>

      <section className="privacy__hero">
        <span className="eyebrow">Kontakt</span>
        <h1>Javi nam se</h1>
        <p>
          Sustav je otvoren za nove udruge, organizacije i volontere iz svih dijelova
          Hrvatske. Ako želiš pridružiti se, predložiti suradnju ili imaš pitanje o
          prijavi, ispuni obrazac ispod i javit ćemo ti se u najkraćem mogućem roku.
        </p>
      </section>

      <section className="contact-layout">
        <form
          className="report-form contact-form"
          onFocusCapture={markFormStarted}
          onPointerDownCapture={markFormStarted}
          onSubmit={handleSubmit}
        >
          <label className="hp-field" aria-hidden="true">
            Web stranica
            <input autoComplete="off" name="website" tabIndex={-1} type="text" />
          </label>
          <input name="formStartedAt" type="hidden" value={formStartedAt} />

          <div className="form-grid">
            <label>
              Ime i prezime <span className="required-mark">*</span>
              <input name="name" placeholder="Ime i prezime" required type="text" />
            </label>
            <label>
              Organizacija
              <input name="organization" placeholder="Udruga ili organizacija (opcionalno)" type="text" />
            </label>
          </div>

          <div className="form-grid">
            <label>
              Mail adresa <span className="required-mark">*</span>
              <div className="field-with-icon">
                <Mail size={18} />
                <input name="email" placeholder="ime@email.hr" required type="email" />
              </div>
            </label>
            <label>
              Kontakt telefon <span className="required-mark">*</span>
              <input name="phone" placeholder="+385..." required type="tel" />
            </label>
          </div>

          <label>
            Regija/Grad
            <div className="field-with-icon">
              <MapPin size={18} />
              <input name="region" placeholder="Npr. Osijek (opcionalno)" type="text" />
            </div>
          </label>

          <label>
            Poruka <span className="required-mark">*</span>
            <textarea name="message" placeholder="Kako ti možemo pomoći ili kako se želiš uključiti?" required />
          </label>

          {feedback ? (
            <p className={`form-feedback form-feedback--${feedback.type}`} role="status">
              {feedback.message}
            </p>
          ) : null}

          <button className="button button--primary" disabled={isSaving} type="submit">
            <Send size={18} />
            {isSaving ? "Šaljem..." : "Pošalji"}
          </button>
        </form>

        <aside className="contact-side">
          <article>
            <UserRoundPlus />
            <h3>Otvoreni za suradnju</h3>
            <p>
              Cilj nam je izgraditi mrežu volontera i udruga u svakoj regiji Republike
              Hrvatske, kako nijedan kraj zemlje ne bi ostao bez brze i organizirane pomoći.
              Ako želiš biti dio te mreže, ovo je pravo mjesto za prvi korak.
            </p>
          </article>

          <article>
            <Gift />
            <h3>Donacije</h3>
            <p>
              Svaka donacija - u novcu, opremi ili uslugama - izravno pomaže da prijave brže
              stignu do životinje kojoj je pomoć potrebna. Javi nam se putem obrasca za
              dogovor oko načina doniranja, a tvrtkama i sponzorima rado uzvraćamo vidljivošću
              i promocijom na našoj stranici.
            </p>
          </article>
        </aside>
      </section>

      <footer className="site-footer">
        <a href="https://on-click.hr" rel="noopener noreferrer" target="_blank">
          Powered by on-click.hr
        </a>
      </footer>
    </main>
  );
}
