import { buildOwnershipMention } from "./document-ownership-service";
import { stampDocumentIdentity, type DocumentIdentityRule, type StampedIdentity } from "./document-identity-service";

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT FINAL D'UNE MISE EN CONFORMITÉ (E2, E3 — call du 09/11/2026) — règles pures.
//
// Sandrine : « le document final au client ne doit pas contenir les critères HAS. Les
// critères, c'est pour nous : une première page détachable, avec notre logo
// uniquement, qui explique ce que le document couvre et les critères qu'il couvre ;
// derrière, le document final avec l'effigie et les couleurs du client, sans les
// encarts. »
//
// Deux temps, à l'enregistrement de la version N+1 :
//   1. `stripCriteriaInserts` retire du CORPS les sections et lignes « critères HAS
//      couverts » (le cahier de style v04 interdit au modèle de les écrire ; ce
//      nettoyage déterministe rattrape une ancienne proposition, ou un original qui
//      en portait) ;
//   2. `stampDocumentIdentity` écrit la version suivante et la date du jour — sauf
//      pour une fiche de sensibilisation (date de dépôt, règle provisoire E4).
// La page de garde (`buildCoverPage`) se construit à part, depuis la MATRICE type de
// document ↔ critères : jamais depuis ce que le modèle a écrit.
// ─────────────────────────────────────────────────────────────────────────────

const PARTICIPLE = String.raw`(?:couverts?|concern[ée]s?|impact[ée]s?|associ[ée]s?|rattach[ée]s?|correspondants?|vis[ée]s?)`;
// Titre d'un encart de critères : « Critères HAS couverts », « Critères concernés »,
// « Critères HAS », « Ce document couvre aussi les critères… ».
const CRITERIA_HEADING = new RegExp(
  String.raw`^(?:(?:les\s+)?crit[èe]res?\s+(?:has\b|${PARTICIPLE})|ce\s+document\s+couvre\b)`,
  "i"
);
// Ligne d'encart : un libellé de critères suivi de deux-points, ou l'encadré EODA.
const CRITERIA_LINE = new RegExp(
  String.raw`^(?:crit[èe]res?\s+(?:has\b|${PARTICIPLE})[^:]*:|ce\s+document\s+couvre\s+(?:aussi\s+|[ée]galement\s+)?(?:les\s+)?crit[èe]res?)`,
  "i"
);

function headingOf(line: string): { level: number; text: string } | null {
  const match = /^(#{1,6})\s+(.*)$/.exec(line.trim());
  if (!match) return null;
  return { level: match[1]!.length, text: match[2]!.replace(/[*_]/g, "").trim() };
}

export function stripCriteriaInserts(markdown: string): string {
  const kept: string[] = [];
  let skippingBelowLevel: number | null = null;
  for (const line of markdown.split("\n")) {
    const heading = headingOf(line);
    if (skippingBelowLevel !== null) {
      if (!heading || heading.level > skippingBelowLevel) continue;
      skippingBelowLevel = null;
    }
    if (heading && CRITERIA_HEADING.test(heading.text)) {
      skippingBelowLevel = heading.level;
      continue;
    }
    if (!heading && CRITERIA_LINE.test(line.replace(/^[\s>*_-]*/, ""))) continue;
    kept.push(line);
  }
  return kept.join("\n");
}

export type FinalDocumentOptions = {
  identityRule: DocumentIdentityRule;
  previousVersionLabel: string;
  today: Date;
};

export type PreparedFinalDocument = { markdown: string; identity: StampedIdentity | null };

export function prepareFinalDocumentMarkdown(markdown: string, options: FinalDocumentOptions): PreparedFinalDocument {
  const stripped = stripCriteriaInserts(markdown);
  if (options.identityRule === "UPLOAD_DATE") return { markdown: stripped, identity: null };
  const identity = stampDocumentIdentity(stripped, {
    previousVersionLabel: options.previousVersionLabel,
    today: options.today,
  });
  return { markdown: identity.text, identity };
}

// ── Page de garde EODA ───────────────────────────────────────────────────────

export type CoverCriterion = { code: string; label: string };

export type CoverPage = {
  title: string;
  coverageHeading: string;
  coverageText: string;
  criteria: CoverCriterion[];
  detachNote: string;
  ownershipMention: string;
};

// « 1.10.2 » après « 1.2.5 » : tri par segments numériques, pas alphabétique.
function compareCodes(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return a.localeCompare(b);
}

export function buildCoverPage(input: {
  documentLabel: string;
  establishmentName: string;
  criteria: readonly CoverCriterion[];
}): CoverPage {
  const criteria = [...input.criteria].sort((a, b) => compareCodes(a.code, b.code));
  const count = criteria.length;
  return {
    title: input.documentLabel,
    coverageHeading: "Ce que couvre ce document",
    coverageText:
      count > 0
        ? `Ce document répond à ${count} critère${count > 1 ? "s" : ""} du référentiel HAS (manuel de juillet 2025), rattaché${count > 1 ? "s" : ""} à ce type de document :`
        : "Aucun critère du référentiel HAS n'est encore rattaché à ce type de document.",
    criteria,
    detachNote:
      "Page de suivi EODA : elle se détache avant de diffuser le document, qui commence à la page suivante. " +
      "Outil de préparation : ne vaut ni évaluation ni validation HAS.",
    ownershipMention: buildOwnershipMention(input.establishmentName),
  };
}
