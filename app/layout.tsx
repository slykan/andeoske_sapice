import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anđeoske šapice",
  description:
    "Sigurna i anonimna prijava zanemarivanja, zlostavljanja i napuštanja životinja. Prijavite slučaj, a volonteri i nadležne institucije brzo reagiraju.",
  keywords: [
    "prijava zlostavljanja životinja",
    "zanemarivanje životinja",
    "napuštene životinje",
    "zaštita životinja",
    "anonimna prijava",
    "udruga za zaštitu životinja",
    "Anđeoske šapice",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hr">
      <body>{children}</body>
    </html>
  );
}
