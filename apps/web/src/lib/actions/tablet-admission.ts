"use server";

import { prisma } from "@eoda/database";
import { resolveTabletSession } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { DIPC_DOCUMENT_TYPE_CODE, selectTabletDipc, type TabletDipcSource } from "@/lib/services/tablet-dipc-service";

// ─────────────────────────────────────────────────────────────────────────────
// DIPC À FAIRE SIGNER SUR LA TABLETTE (26/10/2026).
//
// La SEULE lecture serveur du parcours : le DIPC validé de la structure, document
// institutionnel. Rien ne revient : identité de la personne, explications cochées,
// signatures et PDF restent dans le navigateur de la tablette (admission-service,
// verrou HDS). La structure vient de l'APPAREIL enregistré, jamais d'un identifiant
// reçu.
// ─────────────────────────────────────────────────────────────────────────────

export async function getTabletDipcSource(): Promise<TabletDipcSource | null> {
  const session = await resolveTabletSession();
  if (!session) return null;

  const document = await prisma.document.findFirst({
    where: { establishmentId: session.establishmentId, documentType: { code: DIPC_DOCUMENT_TYPE_CODE } },
    select: {
      validatedAt: true,
      versions: {
        select: { id: true, versionNumber: true, uploadedAt: true, extractedText: true, uploadedBy: { select: { role: true } } },
      },
    },
  });

  const source = selectTabletDipc(
    document && {
      validatedAt: document.validatedAt,
      versions: document.versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        uploadedAt: version.uploadedAt,
        extractedText: version.extractedText,
        producedByCabinet: version.uploadedBy.role !== "CLIENT_USER",
      })),
    }
  );

  // Tout accès à un document se journalise (CLAUDE.md §5 bis) — sans personne : on
  // ne sait pas, ici, qui va signer, et on ne veut pas le savoir.
  if (source.status === "READY") {
    await recordAuditEvent({ action: "DOCUMENT_PREVIEWED", establishmentId: session.establishmentId, targetId: source.versionId, detail: "tablette · DIPC à signer" });
  }
  return source;
}
