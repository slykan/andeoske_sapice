import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Andeoske sapice",
  description: "Sigurna prijava zanemarivanja i zlostavljanja zivotinja.",
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

