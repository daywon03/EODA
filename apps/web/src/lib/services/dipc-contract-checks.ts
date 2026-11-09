import { PAYMENT_FIELD_PREFIX, type DipcCheckField, type DipcFreeField } from "./dipc-tablet-preparation";
import type { AdmissionSigner } from "./admission-service";

// Les cases du DIPEC cochées sur la tablette (étape « Le projet »), et ce qu'on en
// dit à l'intervenant (retours de Damon du 08/11/2026) :
// - le mode de paiement est UN choix : la personne règle ses factures d'une seule
//   façon ; toucher un autre mode remplace le premier ;
// - « Non accompagné(e) » contredirait un accompagnant déjà connu (noté dans
//   « Le bénéficiaire était accompagné de », ou présent pour signer : représentant,
//   personne de confiance) : la case disparaît et n'est jamais cochée dans le contrat ;
// - les autres cases sont indépendantes : chacune se coche si elle est vraie.

const COMPANION_QUESTION = /^Le bénéficiaire était accompagné de\b/i;
const NOT_ACCOMPANIED = /^Non accompagn/i;

export type ContractCheckGroupKind = "PAYMENT" | "COMPANION" | "OTHER";
export type ContractCheckGroup = { kind: ContractCheckGroupKind; title: string; hint: string; fields: DipcCheckField[] };

export const CONTRACT_CHECK_HINTS: Record<ContractCheckGroupKind, { title: string; hint: string }> = {
  PAYMENT: {
    title: "Mode de paiement",
    hint: "Un seul mode : celui par lequel la personne réglera ses factures. Toucher un autre mode remplace le premier.",
  },
  COMPANION: {
    title: "La personne est-elle accompagnée ?",
    hint: "À cocher seulement si personne n'accompagne la personne aujourd'hui. Si quelqu'un l'accompagne, écrivez son nom plus haut : la case disparaît.",
  },
  OTHER: {
    title: "Autres cases du contrat",
    hint: "Chaque case est indépendante : cochez toutes celles qui sont vraies pour cette personne — une, plusieurs ou toutes. Une case laissée vide reste ☐ dans le contrat.",
  },
};

function kindOf(field: DipcCheckField): ContractCheckGroupKind {
  if (field.id.startsWith(PAYMENT_FIELD_PREFIX)) return "PAYMENT";
  if (NOT_ACCOMPANIED.test(field.label)) return "COMPANION";
  return "OTHER";
}

export function isPaymentField(field: Pick<DipcCheckField, "id">): boolean {
  return field.id.startsWith(PAYMENT_FIELD_PREFIX);
}

// Les cases d'un groupe, dans l'ordre du contrat ; un groupe vide n'est pas rendu.
export function contractCheckGroups(fields: readonly DipcCheckField[]): ContractCheckGroup[] {
  const order: ContractCheckGroupKind[] = ["PAYMENT", "COMPANION", "OTHER"];
  return order
    .map((kind) => ({ kind, ...CONTRACT_CHECK_HINTS[kind], fields: fields.filter((f) => kindOf(f) === kind) }))
    .filter((group) => group.fields.length > 0);
}

// Cocher une case. Un mode de paiement coché décoche les autres modes.
export function toggleContractCheck(
  checks: Readonly<Record<string, boolean>>,
  fields: readonly DipcCheckField[],
  id: string,
  value: boolean
): Record<string, boolean> {
  const next = { ...checks, [id]: value };
  if (value && id.startsWith(PAYMENT_FIELD_PREFIX)) {
    for (const field of fields) if (isPaymentField(field) && field.id !== id) next[field.id] = false;
  }
  return next;
}

// La personne est accompagnée : quelqu'un est noté dans « accompagné de », ou un
// représentant / une personne de confiance est là pour signer.
export function isAccompanied(
  freeFields: readonly DipcFreeField[],
  texts: Readonly<Record<string, string>>,
  signers: readonly AdmissionSigner[]
): boolean {
  if (signers.includes("REPRESENTANT") || signers.includes("CONFIANCE")) return true;
  return freeFields.some((field) => COMPANION_QUESTION.test(field.label) && (texts[field.id] ?? "").trim() !== "");
}

// Les cases à montrer : « Non accompagné(e) » disparaît quand la personne est accompagnée.
export function visibleContractChecks(fields: readonly DipcCheckField[], accompanied: boolean): DipcCheckField[] {
  return accompanied ? fields.filter((f) => kindOf(f) !== "COMPANION") : [...fields];
}

// Ce qui part dans le contrat : une case cachée n'est jamais cochée, et un seul
// mode de paiement au plus (le premier coché, si un état ancien en portait deux).
export function effectiveContractChecks(
  checks: Readonly<Record<string, boolean>>,
  fields: readonly DipcCheckField[],
  accompanied: boolean
): Record<string, boolean> {
  const next = { ...checks };
  let paymentKept = false;
  for (const field of fields) {
    const kind = kindOf(field);
    if (kind === "COMPANION" && accompanied) next[field.id] = false;
    if (kind === "PAYMENT" && next[field.id]) {
      if (paymentKept) next[field.id] = false;
      paymentKept = true;
    }
  }
  return next;
}
