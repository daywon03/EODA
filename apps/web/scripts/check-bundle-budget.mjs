#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// BUDGET DE JAVASCRIPT PAR ROUTE (convention P9).
//
// Une régression de poids ne se voit jamais dans une revue : elle arrive par un
// import ajouté en haut d'un fichier, une ligne parmi trente. Elle se voit six mois
// plus tard, sur la tablette de quelqu'un, en 4G.
//
// Ce script lit le manifeste produit par `next build`, additionne le JavaScript de
// première charge de chaque route — en TAILLE COMPRESSÉE, la seule qui traverse le
// réseau — et SORT EN CODE 1 au-dessus du budget. Un budget qui avertit sans bloquer
// est un indicateur, pas un garde-fou (Règle zéro).
//
// Il ne mesure pas ce que Lighthouse mesure : ni le temps d'exécution, ni le rendu.
// Il mesure la seule chose qu'on peut vérifier sans navigateur ni réseau, donc la
// seule qui tiendra dans la CI sans devenir instable.
// ─────────────────────────────────────────────────────────────────────────────

import { gzipSync } from "node:zlib";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const NEXT_DIR = path.join(here, "..", ".next");

// Budgets en kilo-octets compressés. Volontairement peu nombreux : un budget par
// FAMILLE d'écran, pas par page — sinon la table devient une liste de dérogations que
// personne ne relit.
//
// Les valeurs sont posées un cran au-dessus du poids constaté au 03/09/2026, pas au
// doigt mouillé : assez serrées pour qu'un import lourd les fasse céder, assez lâches
// pour qu'une fonctionnalité normale passe. Elles se resserrent quand on optimise ;
// elles ne se desserrent qu'avec une justification écrite dans la PR.
const BUDGETS_KB = [
  { pattern: /^\/login/, budget: 130, label: "Connexion" },
  { pattern: /^\/dashboard\/cabinet\/etablissements\/\[id\]\/page$/, budget: 150, label: "Fiche client" },
  { pattern: /^\/dashboard\/cabinet\/etablissements\/\[id\]\/mission/, budget: 140, label: "Suivi de mission" },
  { pattern: /^\/dashboard\/cabinet\/commercial/, budget: 145, label: "Pipeline commercial" },
  { pattern: /^\/dashboard\/cabinet\/modeles/, budget: 140, label: "Bibliothèque de modèles" },
  { pattern: /^\/dashboard\/cabinet/, budget: 140, label: "Cabinet" },
  { pattern: /^\/dashboard\/client/, budget: 140, label: "Portail client" },
  { pattern: /^\/imprimer/, budget: 130, label: "Documents imprimables" },
  { pattern: /^\/dashboard/, budget: 135, label: "Tableau de bord" },
];

// Marge au-delà de laquelle on prévient sans échouer : le but est de voir arriver la
// régression, pas de bloquer une PR pour deux kilo-octets.
const WARN_RATIO = 0.92;

function budgetFor(route) {
  return BUDGETS_KB.find((entry) => entry.pattern.test(route)) ?? null;
}

function gzippedSize(file) {
  const full = path.join(NEXT_DIR, file);
  try {
    statSync(full);
  } catch {
    // Un fichier du manifeste absent du disque signifierait un manifeste périmé : on
    // le signale plutôt que de l'ignorer, sinon le budget se met à mesurer moins que
    // la réalité et cesse silencieusement de protéger.
    throw new Error(`Fichier absent de la construction : ${file}. Relancez « next build ».`);
  }
  return gzipSync(readFileSync(full)).length;
}

function main() {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path.join(NEXT_DIR, "app-build-manifest.json"), "utf8"));
  } catch {
    console.error("Manifeste introuvable. Lancez « next build » avant ce contrôle.");
    process.exit(1);
  }

  const pages = manifest.pages ?? {};
  const results = [];

  for (const [route, files] of Object.entries(pages)) {
    // Les routes d'API ne servent aucun JavaScript au navigateur : les budgéter
    // n'aurait aucun sens et ferait du bruit dans le rapport.
    if (route.includes("/route")) continue;

    const entry = budgetFor(route);
    if (!entry) continue;

    const bytes = files
      .filter((file) => file.endsWith(".js"))
      .reduce((sum, file) => sum + gzippedSize(file), 0);

    results.push({ route, label: entry.label, kb: bytes / 1024, budget: entry.budget });
  }

  if (results.length === 0) {
    console.error("Aucune route budgétée n'a été trouvée — la table de budgets ne correspond plus aux routes.");
    process.exit(1);
  }

  results.sort((a, b) => b.kb - a.kb);

  const over = results.filter((r) => r.kb > r.budget);
  const near = results.filter((r) => r.kb <= r.budget && r.kb >= r.budget * WARN_RATIO);

  console.log("Budget de JavaScript par route (première charge, compressée)\n");
  for (const r of results.slice(0, 12)) {
    const state = r.kb > r.budget ? "DÉPASSÉ" : r.kb >= r.budget * WARN_RATIO ? "proche " : "ok     ";
    console.log(`  ${state}  ${r.kb.toFixed(1).padStart(7)} / ${String(r.budget).padStart(3)} Ko   ${r.route}`);
  }

  if (near.length > 0) {
    console.log(`\n${near.length} route(s) à plus de ${Math.round(WARN_RATIO * 100)} % du budget.`);
  }

  if (over.length > 0) {
    console.error("\nBudget dépassé :");
    for (const r of over) {
      console.error(`  ${r.route} — ${r.kb.toFixed(1)} Ko pour ${r.budget} Ko (${r.label})`);
    }
    console.error(
      "\nChargez à la demande ce qui est lourd et rare, ou justifiez la hausse du budget dans la PR."
    );
    process.exit(1);
  }

  console.log("\nToutes les routes budgétées tiennent dans leur budget.");
}

main();
