#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// TOUTE FONCTION QUI EMBARQUE CHROMIUM EMBARQUE SON BINAIRE.
//
// `@sparticuz/chromium` situe son dossier `bin/` à l'exécution (`import.meta.url`) :
// le traçage de fichiers de Next ne le voit pas et n'embarque que le JavaScript du
// paquet. Le 21/10/2026, l'aperçu des documents répondait 503 en production pour
// cette seule raison — le développement, qui lance un Chrome de bureau
// (PUPPETEER_EXECUTABLE_PATH), ne montrait rien.
//
// Ce script lit les traces réellement produites par `next build` (`*.nft.json`) et
// SORT EN CODE 1 dès qu'une fonction contient le code du paquet sans ses archives
// (`chromium.br`, `al2023.tar.br`). Il ne dépend d'aucune liste de routes : une route
// future qui lancerait Chromium sans entrée dans `outputFileTracingIncludes`
// (next.config.ts) fait échouer la CI d'elle-même. Il échoue aussi s'il ne trouve
// AUCUNE fonction concernée — un contrôle qui ne contrôle rien ne doit pas être vert
// (Règle zéro).
// ─────────────────────────────────────────────────────────────────────────────

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(here, "..", ".next", "server", "app");

const PACKAGE_CODE = "@sparticuz/chromium/build/index.js";
const REQUIRED_BINARIES = ["@sparticuz/chromium/bin/chromium.br", "@sparticuz/chromium/bin/al2023.tar.br"];

function collectTraces(dir) {
  let out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(collectTraces(full));
    else if (entry.endsWith(".nft.json")) out.push(full);
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

const concerned = [];
const offenders = [];
for (const file of collectTraces(root)) {
  const { files = [] } = JSON.parse(readFileSync(file, "utf8"));
  const normalized = files.map((entry) => entry.split(path.sep).join("/"));
  if (!normalized.some((entry) => entry.endsWith(PACKAGE_CODE))) continue;

  const route = path.relative(root, file).replace(/\.nft\.json$/, "");
  concerned.push(route);
  const missing = REQUIRED_BINARIES.filter((binary) => !normalized.some((entry) => entry.endsWith(binary)));
  if (missing.length > 0) offenders.push({ route, missing });
}

if (concerned.length === 0) {
  console.error(
    "✗ Aucune fonction n'embarque @sparticuz/chromium : soit les routes PDF ont disparu," +
      "\n  soit le format des traces a changé. Le contrôle ne vérifie plus rien — à revoir."
  );
  process.exit(1);
}

if (offenders.length > 0) {
  console.error("✗ Fonctions qui lancent Chromium SANS embarquer son binaire :\n");
  for (const { route, missing } of offenders) {
    console.error(`  ${route} — manque ${missing.map((m) => path.basename(m)).join(", ")}`);
  }
  console.error(
    "\nSur Vercel, Chromium n'aura rien à décompresser : l'aperçu ou le PDF répondra 503." +
      "\nAjoutez la route à `outputFileTracingIncludes` dans next.config.ts."
  );
  process.exit(1);
}

console.log(`✓ ${concerned.length} fonction(s) lancent Chromium, toutes avec leur binaire embarqué.`);
