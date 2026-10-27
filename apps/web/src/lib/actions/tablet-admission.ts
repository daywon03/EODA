"use server";

import { prisma } from "@eoda/database";
import { resolveTabletSession } from "@/lib/auth/guards";
import { readTabletDipc } from "@/lib/db/read-tablet-dipc";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import type { TabletDipcSource } from "@/lib/services/tablet-dipc-service";

// ─────────────────────────────────────────────────────────────────────────────
// DIPEC À FAIRE SIGNER SUR LA TABLETTE (26/10/2026).
//
// La SEULE lecture serveur du parcours : le DIPEC validé de la structure, document
// institutionnel. Rien ne revient : identité de la personne, explications cochées,
// signatures et PDF restent dans le navigateur de la tablette (admission-service,
// verrou HDS). La structure vient de l'APPAREIL enregistré, jamais d'un identifiant
// reçu. Le Word d'origine, quand il existe, part par sa route
// (`/api/tablette/dipec/[versionId]`), même garde, même règle de sélection.
// ─────────────────────────────────────────────────────────────────────────────

// Adresse de la structure, pour la case « SAD 1 » du formulaire de désignation du
// Département : donnée institutionnelle, lue depuis l'APPAREIL enregistré.
export async function getTabletStructureAddress(): Promise<string | null> {
  const session = await resolveTabletSession();
  if (!session) return null;
  const establishment = await prisma.establishment.findUnique({ where: { id: session.establishmentId }, select: { address: true } });
  return establishment?.address ?? "";
}

export async function getTabletDipcSource(): Promise<TabletDipcSource | null> {
  const session = await resolveTabletSession();
  if (!session) return null;
  const { source } = await readTabletDipc(session.establishmentId);

  // Tout accès à un document se journalise (CLAUDE.md §5 bis) — sans personne : on
  // ne sait pas, ici, qui va signer, et on ne veut pas le savoir.
  if (source.status === "READY") {
    await recordAuditEvent({ action: "DOCUMENT_PREVIEWED", establishmentId: session.establishmentId, targetId: source.versionId, detail: "tablette · DIPEC à signer" });
  }
  return source;
}
