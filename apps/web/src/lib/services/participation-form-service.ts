import type { ParticipationForm } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// FORME DE PARTICIPATION DES USAGERS (décisions de Damon du 21/10/2026).
//
// La loi 2002-2 exige « un conseil de la vie sociale OU une autre forme de
// participation ». Deux LIVRABLES distincts, jamais fusionnés :
//   - « Comptes-rendus CVS » (L2002_CR_CVS) — qu'une structure sans CVS déclare
//     « Non concerné » (missing-answer-service, seule exception de la loi 2002-2) ;
//   - « Autre forme de participation des usagers » (QUALITE_ENQUETE_QUESTIONNAIRE) —
//     la DÉMARCHE de la structure, dont la FORME est choisie ici : enquête de
//     satisfaction, groupe de parole, ou autre (libellé libre).
// Ce n'est pas une équivalence entre une enquête et un CVS : c'est un choix de démarche.
// Le CVS ne peut être déclaré « Non concerné » qu'une fois la forme choisie.
// Règles PURES.
// ─────────────────────────────────────────────────────────────────────────────

export const CVS_CODE = "L2002_CR_CVS";
export const PARTICIPATION_LINE_CODE = "QUALITE_ENQUETE_QUESTIONNAIRE";

export const PARTICIPATION_FORM_LABELS: Record<ParticipationForm, string> = {
  ENQUETE_SATISFACTION: "Enquête de satisfaction",
  GROUPE_PAROLE: "Groupe de parole",
  AUTRE: "Autre",
};

export const PARTICIPATION_FORMS = Object.keys(PARTICIPATION_FORM_LABELS) as ParticipationForm[];

const MAX_OTHER_LABEL_LENGTH = 80;

export type ParsedParticipationForm =
  | { ok: true; form: ParticipationForm; otherLabel: string | null }
  | { ok: false; error: string };

// Entrée HOSTILE (formulaire) : la forme est cherchée dans la liste, jamais castée ;
// « Autre » exige sa précision, qui est effacée pour les autres formes (même règle
// que les choix « Autre » du pipeline commercial).
export function parseParticipationForm(rawForm: unknown, rawOther: unknown): ParsedParticipationForm {
  const form = PARTICIPATION_FORMS.find((candidate) => candidate === rawForm);
  if (!form) return { ok: false, error: "Choisissez une forme de participation." };
  if (form !== "AUTRE") return { ok: true, form, otherLabel: null };
  const other = typeof rawOther === "string" ? rawOther.trim() : "";
  if (other.length === 0) return { ok: false, error: "Précisez la forme de participation." };
  if (other.length > MAX_OTHER_LABEL_LENGTH) {
    return { ok: false, error: `La précision ne dépasse pas ${MAX_OTHER_LABEL_LENGTH} caractères.` };
  }
  return { ok: true, form, otherLabel: other };
}

export function describeParticipationForm(form: ParticipationForm | null, otherLabel: string | null): string | null {
  if (!form) return null;
  return form === "AUTRE" ? (otherLabel?.trim() || PARTICIPATION_FORM_LABELS.AUTRE) : PARTICIPATION_FORM_LABELS[form];
}

// Libellé AFFICHÉ de la ligne : « Autre forme de participation des usagers — Enquête de
// satisfaction » une fois la forme choisie ; le libellé du type tel quel sinon, et pour
// toute autre ligne.
export function participationLineLabel(
  code: string,
  baseLabel: string,
  form: ParticipationForm | null,
  otherLabel: string | null
): string {
  if (code !== PARTICIPATION_LINE_CODE) return baseLabel;
  const chosen = describeParticipationForm(form, otherLabel);
  return chosen ? `${baseLabel} — ${chosen}` : baseLabel;
}

export const CVS_NOT_CONCERNED_NEEDS_FORM =
  "Avant de déclarer le CVS « non concerné », indiquez votre autre forme de participation des usagers (enquête de satisfaction, groupe de parole…) sur sa ligne.";

// Le CVS ne se déclare « Non concerné » qu'une fois la forme choisie (réponse de Damon :
// « CVS seulement, si l'autre forme existe »).
export function cvsNotConcernedError(code: string, participationForm: ParticipationForm | null): string | null {
  return code === CVS_CODE && participationForm === null ? CVS_NOT_CONCERNED_NEEDS_FORM : null;
}
