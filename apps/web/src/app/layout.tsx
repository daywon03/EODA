import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EODA Conseil · Plateforme Qualité HAS",
  description: "Outil de préparation à l'évaluation qualité HAS pour les ESSMS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-ivoire-light">{children}</body>
    </html>
  );
}
