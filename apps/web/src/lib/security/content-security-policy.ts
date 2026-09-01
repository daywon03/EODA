// ─────────────────────────────────────────────────────────────────────────────
// CSP À NONCE — fermeture de la dernière porte laissée ouverte au Jalon 5.
//
// La politique précédente portait `script-src 'unsafe-inline'`, requis par le
// script d'amorçage inline de Next.js (App Router). Avec `'unsafe-inline'`, une
// injection réussie de balise <script> s'exécute : la CSP était active mais ne
// protégeait pas de ce qu'elle est censée arrêter en premier.
//
// Le remplacement : un nonce tiré à CHAQUE requête, posé par le middleware, que
// Next.js recopie sur ses propres scripts. Un script injecté n'a pas le nonce, donc
// ne s'exécute pas. `'strict-dynamic'` laisse le script d'amorçage nonce charger les
// chunks de l'application — sans lui, il faudrait revenir à une liste d'origines,
// que `'strict-dynamic'` rend de toute façon ignorée par les navigateurs CSP3.
//
// Ce qui reste, et pourquoi :
//  - `style-src 'unsafe-inline'` : Tailwind et styled-jsx produisent des styles
//    inline. Un nonce sur les styles demanderait de les faire tous passer par Next,
//    ce qui n'est pas le cas des styles calculés à l'exécution. Le risque est d'une
//    autre nature (exfiltration par sélecteur, pas exécution de code).
//  - `'unsafe-eval'` en développement seulement : le rechargement à chaud en dépend.
//    Jamais en production, et c'est le test qui le garantit.
//  - `frame-src https:` : aperçu PDF servi depuis une URL signée du bucket, dont le
//    domaine varie selon la région et le fournisseur.
//
// Fonction PURE : `nonce` et `isProduction` entrent, une chaîne sort. C'est ce qui
// permet de vérifier mécaniquement qu'aucune version future ne réintroduit
// `'unsafe-inline'` sur les scripts.
// ─────────────────────────────────────────────────────────────────────────────

export function buildContentSecurityPolicy(options: {
  nonce: string;
  isProduction: boolean;
}): string {
  const { nonce, isProduction } = options;

  return [
    "default-src 'self'",
    // `'self'` est conservé pour les navigateurs qui ignorent `'strict-dynamic'`.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-src 'self' blob: https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Interdit toute mise en cadre, y compris par la plateforme elle-même : aucun
    // écran n'en a besoin, et ça ferme le clickjacking.
    "frame-ancestors 'none'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

// Nonce : 128 bits d'aléa cryptographique, encodés en base64. Tiré une fois par
// requête — un nonce réutilisé entre deux réponses n'en est plus un, il devient une
// valeur devinable par quiconque a vu une page.
//
// `crypto` global (Web Crypto) et non `node:crypto` : ce code s'exécute dans le
// middleware, donc sur l'Edge Runtime, où les modules Node ne sont pas disponibles.
export function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
