import type { NextConfig } from "next";
import path from "node:path";

const isProduction = process.env.NODE_ENV === "production";

// ─────────────────────────────────────────────────────────────────────────────
// EN-TÊTES DE SÉCURITÉ
//
// Appliqués à toutes les routes. Sans eux, le navigateur n'applique aucune des
// protections dont l'application a besoin : un document client s'affiche dans un
// cadre sur un site tiers, une injection de balise <script> s'exécute librement,
// et l'URL signée d'un document part dans l'en-tête Referer vers un domaine externe.
//
// ⚠️ La CSP des PAGES n'est plus ici : elle contient un nonce tiré à chaque requête
// et vit donc dans src/middleware.ts (lib/security/content-security-policy.ts). Ne
// pas la réintroduire ici — deux politiques sur la même réponse s'appliquent toutes
// les deux, et celle qui porterait `'unsafe-inline'` annulerait le bénéfice du nonce.
//
// Ce qui suit ne concerne donc que les routes /api, que le `matcher` du middleware
// exclut : elles ne rendent aucun document HTML, leur politique peut être bien plus
// serrée que celle des pages.
// ─────────────────────────────────────────────────────────────────────────────
const apiContentSecurityPolicy = [
  "default-src 'none'",
  // /api/local-storage sert un PDF affiché dans une <iframe> de l'application, en
  // développement uniquement : la mise en cadre par la plateforme elle-même doit
  // rester possible, par personne d'autre.
  "frame-ancestors 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const securityHeaders = [
  // Redondant avec frame-ancestors, conservé pour les navigateurs anciens.
  { key: "X-Frame-Options", value: "DENY" },
  // Empêche un navigateur de deviner un type MIME et d'exécuter un document déposé
  // comme du HTML.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Ne jamais transmettre l'URL courante (qui peut contenir un identifiant de
  // document ou une URL signée) vers un domaine externe.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Aucune de ces API n'est utilisée par la plateforme.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  transpilePackages: ["@eoda/database"],
  // ───────────────────────────────────────────────────────────────────────────
  // TAILLE DES DÉPÔTS DE FICHIERS
  //
  // Les actions serveur de Next.js refusent par défaut tout corps de requête au-delà
  // d'UN mégaoctet. Or la validation des fichiers déposés accepte jusqu'à 20 Mo
  // (`MAX_FILE_SIZE_BYTES`) : sans ce réglage, un PDF de 3 Mo est refusé par le
  // framework AVANT d'atteindre le moindre contrôle, sous une erreur qui ne dit pas
  // que le fichier était trop gros. La limite qui fait foi doit être celle qu'on a
  // écrite et testée, pas un défaut de plateforme.
  //
  // Le plafond est posé un cran au-dessus des 20 Mo : un envoi multipart transporte
  // aussi les autres champs du formulaire et son propre encadrement.
  experimental: {
    serverActions: { bodySizeLimit: "24mb" },
  },
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Ne pas divulguer la version du framework aux scanners automatisés.
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/api/:path*",
        headers: [{ key: "Content-Security-Policy", value: apiContentSecurityPolicy }],
      },
    ];
  },
};

export default nextConfig;
