"use server";

import { prisma, type DocumentCategory } from "@eoda/database";
import { requireCabinetAdminSession } from "@/lib/auth/guards";

export type DocumentTypeScope = {
  documentTypeId: string;
  label: string;
  category: DocumentCategory;
  requestedFromClient: boolean;
};

// Liste des types de document avec leur portée « réclamé au client » / « produit par
// EODA » — page de cabinet « Documents réclamés ». La liste vaut pour TOUTES les
// structures (DocumentType n'est pas rattaché à un établissement) : CABINET_ADMIN
// seul, refusé avant toute lecture. La bascule reste `setDocumentTypeRequested`
// (lib/actions/document.ts), qui revérifie le rôle et journalise.
export async function listDocumentTypeScopes(): Promise<DocumentTypeScope[]> {
  await requireCabinetAdminSession();

  const types = await prisma.documentType.findMany({
    select: { id: true, label: true, category: true, requestedFromClient: true },
    orderBy: [{ category: "asc" }, { label: "asc" }],
  });

  return types.map((t) => ({
    documentTypeId: t.id,
    label: t.label,
    category: t.category,
    requestedFromClient: t.requestedFromClient,
  }));
}
