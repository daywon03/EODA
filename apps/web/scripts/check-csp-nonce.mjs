#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// AUCUNE PAGE PRÉ-RENDUE SOUS UNE CSP À NONCE.
//
// La politique de sécurité des pages porte un nonce tiré à chaque requête
// (src/lib/security/content-security-policy.ts, posé par le middleware). Une page
// pré-rendue à la construction produit un HTML figé, dont les balises <script>
// n'ont aucun nonce : le navigateur les refuse TOUTES, et la page ne s'hydrate
// jamais. C'est ce qui a cassé la connexion en production le 03/09/2026, alors que
// le développement — qui rend chaque page à la demande — ne montrait rien.
//
// Ce script lit le HTML réellement produit par `next build` et SORT EN CODE 1 dès
// qu'une balise <script> y est écrite sans nonce. Il ne fait confiance à aucun
// réglage déclaré : il regarde le résultat. Une règle que personne ne vérifie n'est
// pas une règle (Règle zéro).
// ─────────────────────────────────────────────────────────────────────────────

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(here, "..", ".next", "server", "app");

function collectHtmlFiles(dir) {
  let out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(collectHtmlFiles(full));
    else if (entry.endsWith(".html")) out.push(full);
  }
  return out;
}

let root;
try {
  root = statSync(APP_DIR).isDirectory() ? APP_DIR : null;
} catch {
  root = null;
}

if (!root) {
  console.error("✗ .next/server/app introuvable — lancez `next build` avant ce contrôle.");
  process.exit(1);
}

const offenders = [];
for (const file of collectHtmlFiles(root)) {
  const html = readFileSync(file, "utf8");
  const tags = html.match(/<script\b[^>]*>/g) ?? [];
  const withoutNonce = tags.filter((tag) => !/\bnonce=/.test(tag));
  if (withoutNonce.length > 0) {
    offenders.push({ route: path.relative(root, file), count: withoutNonce.length });
  }
}

if (offenders.length > 0) {
  console.error("✗ Pages PRÉ-RENDUES portant des <script> sans nonce :\n");
  for (const { route, count } of offenders) {
    console.error(`  ${route} — ${count} balise(s) <script> sans nonce`);
  }
  console.error(
    "\nCes pages seront servies telles quelles, et la CSP à nonce bloquera tous leurs" +
      "\nscripts : la page ne s'hydratera jamais. La cause est un pré-rendu statique —" +
      "\nvérifiez que `export const dynamic = \"force-dynamic\"` de src/app/layout.tsx" +
      "\nn'a pas été retiré ou surchargé par un segment."
  );
  process.exit(1);
}

console.log("✓ Aucune page pré-rendue sans nonce — la CSP à nonce reste applicable.");
