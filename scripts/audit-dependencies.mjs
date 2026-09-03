#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// AUDIT DES DÉPENDANCES — et la distinction que `pnpm audit` seul ne fait pas.
//
// Deux échecs se ressemblent en sortie de code 1, et ils n'ont rien à voir :
//
//   1. le registre npm a répondu, et il signale une vulnérabilité haute ou
//      critique — c'est le but de l'étape, elle doit échouer ;
//   2. le registre n'a pas répondu du tout (`ERR_SOCKET_TIMEOUT`, le 04/09/2026
//      en CI) — l'audit n'a pas eu lieu, et faire échouer la construction pour
//      ça revient à annoncer une vulnérabilité qui n'existe pas.
//
// Les confondre a un coût dans les deux sens : on finit soit par relancer la CI
// à l'aveugle, soit — bien pire — par ajouter le `|| true` que ce dépôt
// s'interdit explicitement. Une étape de qualité qui ne peut pas échouer est du
// théâtre ; une étape qui échoue au hasard apprend à ignorer ses échecs, ce qui
// revient au même en un peu plus long.
//
// `--json` donne le discriminateur : sur panne de registre, pnpm produit un JSON
// portant un objet `error` plutôt qu'un rapport. C'est vérifié en exécution, pas
// déduit d'une documentation.
//
// CE QUI N'EST PAS FAIT, ET POURQUOI : une panne de registre qui survit aux
// tentatives fait ÉCHOUER l'étape. Un contrôle de sécurité qui n'a pas pu
// s'exécuter n'est pas un contrôle réussi, et l'annoncer vert serait exactement
// le masquage que le tableau d'application de CLAUDE.md interdit. Le message le
// dit alors sans ambiguïté : relancer le job suffit.
// ─────────────────────────────────────────────────────────────────────────────

import { spawnSync } from "node:child_process";

const AUDIT_LEVEL = "high";
// Trois tentatives réparties sur environ une minute et demie. pnpm réessaie déjà
// deux fois dans sa propre fenêtre : les pauses ci-dessous visent une AUTRE
// fenêtre, sinon on ne fait que répéter la même seconde de panne.
const BACKOFF_SECONDS = [20, 60];

function runAudit() {
  const result = spawnSync(
    "pnpm",
    ["audit", `--audit-level=${AUDIT_LEVEL}`, "--json"],
    {
      encoding: "utf8",
      // Le délai par défaut du client npm est court pour un poste, pas pour un
      // exécuteur de CI partagé. L'allonger traite la cause plutôt que le symptôme.
      env: { ...process.env, npm_config_fetch_timeout: "60000" },
      maxBuffer: 32 * 1024 * 1024,
    }
  );

  let report = null;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    // Sortie illisible : traitée comme une panne, jamais comme un succès.
    report = null;
  }

  return { status: result.status, report, stderr: result.stderr ?? "" };
}

function isRegistryFailure({ report }) {
  return report === null || typeof report.error === "object";
}

function summarise(report) {
  const counts = report?.metadata?.vulnerabilities;
  if (!counts) return "";
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([level, count]) => `${count} ${level}`)
    .join(", ");
}

let attempt = 0;
let outcome = runAudit();

while (isRegistryFailure(outcome) && attempt < BACKOFF_SECONDS.length) {
  const wait = BACKOFF_SECONDS[attempt];
  const reason = outcome.report?.error?.code ?? "réponse illisible";
  console.warn(
    `⚠ Registre npm injoignable (${reason}) — nouvelle tentative dans ${wait} s.`
  );
  // Attente bloquante volontaire : ce script n'a rien d'autre à faire, et une
  // boucle asynchrone rendrait la sortie de code moins lisible pour rien.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait * 1000);
  attempt += 1;
  outcome = runAudit();
}

if (isRegistryFailure(outcome)) {
  const reason = outcome.report?.error?.message ?? outcome.stderr.trim();
  console.error(
    "✗ L'audit des dépendances N'A PAS PU S'EXÉCUTER : le registre npm est resté\n" +
      `  injoignable après ${BACKOFF_SECONDS.length + 1} tentatives.\n\n` +
      `  ${reason}\n\n` +
      "  Ce n'est PAS une vulnérabilité détectée — aucune conclusion de sécurité ne\n" +
      "  peut être tirée de cette exécution. Relancez le job : un contrôle qui n'a\n" +
      "  pas eu lieu ne s'annonce pas vert."
  );
  process.exit(1);
}

if (outcome.status !== 0) {
  const summary = summarise(outcome.report);
  console.error(
    `✗ Vulnérabilités de niveau ${AUDIT_LEVEL} ou supérieur dans les dépendances` +
      (summary ? ` : ${summary}.` : ".")
  );
  console.error(
    "\n  Corrigez la dépendance. Une exception ne se pose qu'avec une justification\n" +
      "  écrite, dans `pnpm.auditConfig.ignoreGhsas` — jamais en abaissant le seuil."
  );
  // Le rapport complet en sortie standard : c'est ce qu'on lit pour savoir quoi
  // corriger, et il ne doit pas se perdre parce que le script a résumé.
  console.log(JSON.stringify(outcome.report, null, 2));
  process.exit(1);
}

const summary = summarise(outcome.report);
console.log(
  `✓ Aucune vulnérabilité de niveau ${AUDIT_LEVEL} ou supérieur` +
    (summary ? ` (restent : ${summary}).` : ".")
);
