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
// Notes sur la CSP :
//  - `'unsafe-inline'` sur script-src est requis par le script d'amorçage inline de
//    Next.js (App Router). L'éliminer demande une CSP à nonce par requête via le
//    middleware — à faire, mais c'est un chantier distinct : mieux vaut une CSP
//    imparfaite mais active qu'aucune CSP.
//  - `'unsafe-eval'` est nécessaire au rechargement à chaud en développement
//    uniquement, jamais en production.
//  - `frame-src https:` autorise l'aperçu PDF servi depuis une URL signée du bucket
//    S3-compatible (domaine variable selon la région/le fournisseur), ainsi que
//    /api/local-storage en développement.
//  - `frame-ancestors 'none'` interdit toute mise en cadre de la plateforme, y
//    compris par elle-même : aucun écran n'en a besoin, et ça ferme le clickjacking.
// ─────────────────────────────────────────────────────────────────────────────
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  // Tailwind et styled-jsx produisent des styles inline.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-src 'self' blob: https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Ne pas divulguer la version du framework aux scanners automatisés.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
