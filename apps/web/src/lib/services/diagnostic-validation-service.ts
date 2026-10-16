import type { SupportMode } from "@eoda/database";
import { AUTONOMY_RESERVE, describeReviewMention } from "./review-mention-service";
import { diagnosticFingerprint, parseDiagnosticSnapshot } from "./diagnostic-service";

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION DU DIAGNOSTIC EN DEUX GESTES — tranche N6 (D6, jamais fusionnés).
//
//   ACCOMPAGNÉ : EODA « relu » (cabinet seulement) → la structure « accepte » ce
//                qu'EODA a relu (client seulement). Une acceptation n'est possible
//                que sur une relecture encore À JOUR.
//   AUTONOMIE  : pas de relecture EODA. La structure accepte seule, sous la réserve
//                complète (review-mention-service) — jamais « validé », jamais
//                « relu ».
//
// « À jour » se DÉRIVE : la photo figée par le premier geste a la même empreinte que
// le diagnostic courant. Un document relu depuis change le diagnostic : la relecture
// porte alors sur un état qui n'existe plus, il faut un nouveau geste.
//
// Règles PURES : l'action lit la base, ce service décide.
// ─────────────────────────────────────────────────────────────────────────────

export type DiagnosticValidationFacts = {
  id: string;
  snapshotJson: unknown;
  reviewedByEodaAt: Date | null;
  acceptedByClientAt: Date | null;
};

export function isValidationCurrent(latest: DiagnosticValidationFacts | null, liveFingerprint: string): boolean {
  if (!latest) return false;
  const snapshot = parseDiagnosticSnapshot(latest.snapshotJson);
  return snapshot !== null && diagnosticFingerprint(snapshot.rows) === liveFingerprint;
}

export type GestureDecision =
  | { kind: "REFUSE"; message: string }
  | { kind: "NOOP" }
  | { kind: "CREATE" }
  | { kind: "UPDATE"; validationId: string };

export const AUTONOMY_NO_REVIEW_MESSAGE =
  "Cette structure est en autonomie : son diagnostic n'est pas relu par EODA, elle l'accepte elle-même.";
export const NOT_REVIEWED_YET_MESSAGE =
  "EODA n'a pas encore relu ce diagnostic. Vous pourrez l'accepter après sa relecture.";
export const CHANGED_SINCE_REVIEW_MESSAGE =
  "Le diagnostic a changé depuis la relecture d'EODA. Il doit être relu à nouveau avant d'être accepté.";

// Geste du CABINET. Une relecture déjà faite sur l'état courant ne se redate pas.
export function decideEodaReview(
  mode: SupportMode,
  latest: DiagnosticValidationFacts | null,
  liveFingerprint: string
): GestureDecision {
  if (mode === "AUTONOMIE") return { kind: "REFUSE", message: AUTONOMY_NO_REVIEW_MESSAGE };
  if (isValidationCurrent(latest, liveFingerprint) && latest?.reviewedByEodaAt) return { kind: "NOOP" };
  return { kind: "CREATE" };
}

// Geste de la STRUCTURE.
export function decideClientAcceptance(
  mode: SupportMode,
  latest: DiagnosticValidationFacts | null,
  liveFingerprint: string
): GestureDecision {
  const current = isValidationCurrent(latest, liveFingerprint);
  if (current && latest?.acceptedByClientAt) return { kind: "NOOP" };

  if (mode === "AUTONOMIE") {
    // Une ligne courante non encore acceptée (relue autrefois, avant un passage en
    // autonomie) reçoit l'acceptation ; sinon une nouvelle photo.
    return current && latest ? { kind: "UPDATE", validationId: latest.id } : { kind: "CREATE" };
  }

  if (!latest?.reviewedByEodaAt) return { kind: "REFUSE", message: NOT_REVIEWED_YET_MESSAGE };
  if (!current) return { kind: "REFUSE", message: CHANGED_SINCE_REVIEW_MESSAGE };
  return { kind: "UPDATE", validationId: latest.id };
}

// ── Ce que l'écran dit ───────────────────────────────────────────────────────

function dayMonth(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export type DiagnosticValidationView = {
  // La mention de relecture (une seule source : review-mention-service).
  mention: string;
  // La phrase sous la mention : ce qu'on attend de la structure.
  explanation: string;
  // « Accepté par vous le JJ/MM » quand l'acceptation est à jour.
  acceptedLabel: string | null;
  clientCanAccept: boolean;
  cabinetCanReview: boolean;
  // Le diagnostic a changé depuis le dernier geste (relu ou accepté).
  changedSinceLastGesture: boolean;
};

export function describeDiagnosticValidation(
  mode: SupportMode,
  latest: DiagnosticValidationFacts | null,
  liveFingerprint: string
): DiagnosticValidationView {
  const current = isValidationCurrent(latest, liveFingerprint);
  const reviewedAt = current ? (latest?.reviewedByEodaAt ?? null) : null;
  const acceptedAt = current ? (latest?.acceptedByClientAt ?? null) : null;
  const changedSinceLastGesture = latest !== null && !current;

  const acceptance = decideClientAcceptance(mode, latest, liveFingerprint);
  const review = decideEodaReview(mode, latest, liveFingerprint);

  if (mode === "AUTONOMIE") {
    return {
      mention: AUTONOMY_RESERVE,
      explanation:
        "La plateforme a préparé ce diagnostic à partir de vos documents. Relisez-le. Si c'est juste, acceptez-le.",
      acceptedLabel: acceptedAt ? `Accepté par vous le ${dayMonth(acceptedAt)} · non revérifié par un humain` : null,
      clientCanAccept: acceptance.kind === "CREATE" || acceptance.kind === "UPDATE",
      cabinetCanReview: false,
      changedSinceLastGesture,
    };
  }

  return {
    mention: reviewedAt ? describeReviewMention(reviewedAt) : "Pas encore relu par EODA",
    explanation: reviewedAt
      ? "EODA a relu ce diagnostic. Si vous êtes d'accord, acceptez-le."
      : "EODA relit ce diagnostic avant que vous puissiez l'accepter.",
    acceptedLabel: acceptedAt ? `Accepté par vous le ${dayMonth(acceptedAt)}` : null,
    clientCanAccept: acceptance.kind === "UPDATE",
    cabinetCanReview: review.kind === "CREATE",
    changedSinceLastGesture,
  };
}
