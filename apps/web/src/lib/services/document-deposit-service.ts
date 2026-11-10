import { canDeleteVersion } from "./document-workflow-service";

// ─────────────────────────────────────────────────────────────────────────────
// DÉPÔT EN DEUX TEMPS, ET SON ANNULATION (retour de Sandrine, 09/11/2026 : « Il me
// faut la possibilité d'annuler un dépôt de doc en cours… Là je me suis trompée et
// je n'ai pas pu empêcher l'action. »).
//
// Règles pures, partagées par le cabinet (DocumentUploadButton) et la structure
// (ClientUploadDialog) — une seule logique, deux habillages :
//   1. choisir un fichier n'envoie RIEN : un récapitulatif dit ce que le dépôt va
//      faire (`describeDepositEffects`), PUIS on dépose ou on annule ;
//   2. une action serveur ne s'interrompt pas : « Annuler le dépôt » pendant l'envoi
//      demande l'annulation, et la version est retirée dès que le serveur a rendu
//      son identifiant (`cancelDocumentDeposit`). Ce qui est déjà parti (e-mail,
//      appel au modèle) ne se rattrape pas, et le message le dit.
// ─────────────────────────────────────────────────────────────────────────────

export type DepositSide = "CABINET" | "CLIENT";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

// Ce que `uploadDocument` fait RÉELLEMENT, dit avant l'envoi. Chaque phrase
// correspond à une branche de l'action — la changer sans changer l'action, c'est
// recommencer à mentir :
//   - cabinet + « Version finale d'EODA » : validation posée au dépôt, puis
//     `announceValidatedDocument` (la structure est prévenue) ;
//   - cabinet sans la case, document déjà validé : la nouvelle version d'EODA devient
//     le livrable sur-le-champ, la structure est prévenue de même ;
//   - cabinet sans la case, document non validé : « À relire », aucun envoi ;
//   - structure : `notifyStructureActivity` (DEPOSIT) prévient le cabinet ; jamais de
//     validation (le champ est ignoré côté serveur pour un client).
export function describeDepositEffects(input: {
  side: DepositSide;
  cabinetFinal: boolean;
  documentValidated: boolean;
}): string[] {
  const analysis = "Le document sera lu et analysé dès le dépôt (environ une minute).";
  if (input.side === "CLIENT") return [analysis, "L'équipe EODA sera prévenue par e-mail."];
  if (input.cabinetFinal) {
    return [analysis, "Le document sera validé tout de suite et la structure prévenue par e-mail."];
  }
  if (input.documentValidated) {
    return [
      analysis,
      "Ce document est déjà validé : la nouvelle version sera remise tout de suite à la structure, prévenue par e-mail.",
    ];
  }
  return [analysis, "Il passera par « À relire ». Personne n'est prévenu."];
}

export type CancellationFacts = {
  actorUserId: string;
  actorIsCabinet: boolean;
  uploaderUserId: string;
  versionProducedByCabinet: boolean;
  isLatest: boolean;
  // Faits posés au dépôt par `uploadDocument` (« Version finale d'EODA ») : ce dépôt
  // a-t-il validé le document, et quelle validation a-t-il remplacée ?
  validatedOnDeposit: boolean;
  priorValidatedAt: Date | null;
  priorValidatedByUserId: string | null;
};

export type ValidationRollback =
  | { kind: "UNCHANGED" }
  | { kind: "REMOVE" }
  | { kind: "RESTORE"; validatedAt: Date; validatedByUserId: string | null };

export type CancellationPlan =
  | { ok: false; reason: "NOT_OWN_DEPOSIT" | "NOT_LATEST" }
  | { ok: true; validation: ValidationRollback };

// Annuler, c'est retirer SON PROPRE dernier dépôt : la règle de la suppression
// (`canDeleteVersion` : même côté, dernière version) PLUS l'auteur exact — une
// consultante n'annule pas le dépôt d'une collègue, qui n'a rien demandé.
export function planDepositCancellation(facts: CancellationFacts): CancellationPlan {
  if (!facts.isLatest) return { ok: false, reason: "NOT_LATEST" };
  const sameSide = canDeleteVersion({
    actorIsCabinet: facts.actorIsCabinet,
    versionProducedByCabinet: facts.versionProducedByCabinet,
    isLatest: facts.isLatest,
  });
  if (!sameSide || facts.uploaderUserId !== facts.actorUserId) return { ok: false, reason: "NOT_OWN_DEPOSIT" };
  if (!facts.validatedOnDeposit) return { ok: true, validation: { kind: "UNCHANGED" } };
  if (facts.priorValidatedAt === null) return { ok: true, validation: { kind: "REMOVE" } };
  return {
    ok: true,
    validation: { kind: "RESTORE", validatedAt: facts.priorValidatedAt, validatedByUserId: facts.priorValidatedByUserId },
  };
}

export type ValidationOutcome = "UNCHANGED" | "REMOVED" | "RESTORED";

export function validationOutcome(rollback: ValidationRollback): ValidationOutcome {
  if (rollback.kind === "REMOVE") return "REMOVED";
  if (rollback.kind === "RESTORE") return "RESTORED";
  return "UNCHANGED";
}

export const CANCEL_PENDING_NOTICE =
  "Annulation demandée. Le serveur termine d'abord le dépôt en cours, puis la version sera retirée.";

export const CANCELLED_BEFORE_DEPOSIT = "Dépôt annulé : rien n'a été enregistré.";

// Le message final dit ce qui a été défait ET ce qui ne pouvait pas l'être : un
// e-mail parti ne se rappelle pas.
export function describeCancelledDeposit(input: {
  side: DepositSide;
  validation: ValidationOutcome;
  notifiedCount: number;
}): string {
  const parts = ["Dépôt annulé : la version a été retirée."];
  if (input.validation === "REMOVED") parts.push("La validation posée par ce dépôt a été retirée.");
  if (input.validation === "RESTORED") parts.push("Le document retrouve sa validation d'avant.");
  if (input.notifiedCount > 0) {
    parts.push(
      input.side === "CABINET"
        ? "La structure avait déjà été prévenue par e-mail."
        : "L'équipe EODA avait déjà été prévenue par e-mail."
    );
  }
  return parts.join(" ");
}
