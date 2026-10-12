"use server";

import { prisma } from "@eoda/database";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import {
  requireClientEstablishment,
  requireEstablishmentAccess,
  requireEstablishmentInTenant,
} from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { canDepositDocuments } from "@/lib/services/mission-access-service";
import { buildDiagnosticSnapshot } from "@/lib/services/diagnostic-service";
import { decideClientAcceptance, decideEodaReview } from "@/lib/services/diagnostic-validation-service";
import { readDiagnostic, type DiagnosticData } from "@/lib/db/read-diagnostic";

// ─────────────────────────────────────────────────────────────────────────────
// « MON DIAGNOSTIC » — lectures et les deux gestes (tranche N6, D6).
//
// Chaque fonction résout l'établissement sous SA garde, puis délègue : la lecture à
// read-diagnostic, la décision à diagnostic-validation-service. Le geste du cabinet
// et celui de la structure sont deux actions distinctes, chacune refusant l'autre
// côté — jamais un « valider » partagé.
// ─────────────────────────────────────────────────────────────────────────────

const DIAGNOSTIC_PATHS = ["/dashboard/client", "/dashboard/client/diagnostic"];

// Structure de l'appelant (lien EstablishmentUser), jamais un identifiant reçu.
export async function getClientDiagnostic(): Promise<DiagnosticData | null> {
  const { establishment } = await requireClientEstablishment();
  if (!establishment) return null;
  return readDiagnostic(establishment.id);
}

// Vue d'ensemble d'une fiche, côté cabinet.
export async function getStructureDiagnostic(establishmentId: string): Promise<DiagnosticData> {
  const { establishmentId: id } = await requireEstablishmentInTenant(establishmentId);
  const data = await readDiagnostic(id);
  if (!data) notFound();
  return data;
}

// Le rapport imprimable, des deux côtés. Un rapport est un document : son accès se
// journalise (CLAUDE.md §5 bis), sans donnée personnelle dans `detail`.
export async function getDiagnosticForPrint(establishmentId: string): Promise<DiagnosticData> {
  const access = await requireEstablishmentAccess(establishmentId);
  const data = await readDiagnostic(access.establishmentId);
  if (!data) notFound();
  await recordAuditEvent({
    action: "DIAGNOSTIC_REPORT_PRINTED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: access.establishmentId,
    targetId: access.establishmentId,
    detail: access.isClient ? "structure" : "cabinet",
  });
  return data;
}

function revalidateDiagnostic(establishmentId: string): void {
  for (const path of DIAGNOSTIC_PATHS) revalidatePath(path);
  revalidatePath(`/dashboard/cabinet/etablissements/${establishmentId}`);
}

// Geste du CABINET : « Marquer le diagnostic relu ». Structure accompagnée seulement.
export async function markDiagnosticReviewed(establishmentId: string): Promise<{ error: string } | null> {
  if (typeof establishmentId !== "string") notFound();
  const context = await requireEstablishmentInTenant(establishmentId);
  const data = await readDiagnostic(context.establishmentId);
  if (!data) notFound();

  const decision = decideEodaReview(data.mode, data.latestValidation, data.fingerprint);
  if (decision.kind === "REFUSE") return { error: decision.message };
  if (decision.kind === "NOOP") return null;

  const now = new Date();
  const created = await prisma.diagnosticValidation.create({
    data: {
      establishmentId: data.establishmentId,
      snapshotJson: buildDiagnosticSnapshot(data.rows, now),
      reviewedByEodaAt: now,
      reviewedByEodaById: context.userId,
    },
    select: { id: true },
  });
  await recordAuditEvent({
    action: "DIAGNOSTIC_REVIEWED_BY_EODA",
    actorUserId: context.userId,
    actorRole: context.role,
    establishmentId: data.establishmentId,
    targetId: created.id,
    detail: `${data.summary.imperatives.proven}/${data.summary.imperatives.total} impératifs prouvés`,
  });
  revalidateDiagnostic(data.establishmentId);
  return null;
}

// Geste de la STRUCTURE : « J'accepte ce diagnostic ». Aucun identifiant reçu : la
// structure est celle du lien EstablishmentUser.
export async function acceptDiagnostic(): Promise<{ error: string } | null> {
  const { userId, session, establishment, missionAccess } = await requireClientEstablishment();
  if (!establishment) notFound();
  // Bibliothèque en lecture seule après la clôture : accepter est une écriture.
  if (!canDepositDocuments(missionAccess)) {
    return { error: "L'accompagnement est terminé : aucun nouveau geste n'est possible." };
  }
  const data = await readDiagnostic(establishment.id);
  if (!data) notFound();

  const decision = decideClientAcceptance(data.mode, data.latestValidation, data.fingerprint);
  if (decision.kind === "REFUSE") return { error: decision.message };
  if (decision.kind === "NOOP") return null;

  const now = new Date();
  const accepted = { acceptedByClientAt: now, acceptedByClientById: userId };
  const target =
    decision.kind === "UPDATE"
      ? await prisma.diagnosticValidation.update({ where: { id: decision.validationId }, data: accepted, select: { id: true } })
      : await prisma.diagnosticValidation.create({
          data: { establishmentId: data.establishmentId, snapshotJson: buildDiagnosticSnapshot(data.rows, now), ...accepted },
          select: { id: true },
        });

  await recordAuditEvent({
    action: "DIAGNOSTIC_ACCEPTED_BY_CLIENT",
    actorUserId: userId,
    actorRole: session.user.role,
    establishmentId: data.establishmentId,
    targetId: target.id,
    detail: data.mode === "AUTONOMIE" ? "autonomie, non relu par EODA" : "après relecture EODA",
  });
  revalidateDiagnostic(data.establishmentId);
  return null;
}
