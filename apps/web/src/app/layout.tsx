import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EODA Conseil · Plateforme Qualité HAS",
  description: "Outil de préparation à l'évaluation qualité HAS pour les ESSMS",
};

// ─────────────────────────────────────────────────────────────────────────────
// RENDU À LA DEMANDE POUR TOUT L'ARBRE — condition de la CSP à nonce.
//
// Le nonce est tiré par le middleware À CHAQUE REQUÊTE. Une page PRÉ-RENDUE à la
// construction ne peut donc pas le porter : son HTML est figé, ses balises <script>
// n'ont aucun nonce, et la politique les refuse toutes. Constaté en exécution le
// 03/09/2026 : /login était la seule page statique du dépôt, et la connexion était
// cassée en production — « Executing inline script violates the following Content
// Security Policy directive » — alors que tout fonctionnait en développement, où
// Next.js rend chaque page à la demande.
//
// Le réglage est posé sur la racine, pas sur /login : la règle vaut pour toute page
// future, sinon la prochaine page sans lecture de données réintroduira la panne.
// `scripts/check-csp-nonce.mjs` le vérifie après chaque construction.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-ivoire-light">{children}</body>
    </html>
  );
}
