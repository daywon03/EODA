"use server";

import { prisma } from "@eoda/database";
import { requireClientEstablishment, requireEstablishmentInTenant } from "@/lib/auth/guards";
import type { DocumentCategory, DocumentStatus } from "@eoda/database";

export type ChecklistItem = {
  documentTypeId: string;
  code: string;
  label: string;
  isConditional: boolean;
  expectedFrequency: string | null;
  status: DocumentStatus;
  documentId: string | null;
  missingJustification: string | null;
  currentVersion: {
    id: string;
    versionNumber: number;
    originalFilename: string;
    uploadedAt: Date;
  } | null;
};

export type ChecklistByCategory = Record<DocumentCategory, ChecklistItem[]>;

async function buildChecklist(establishmentId: string): Promise<ChecklistByCategory> {
  // Tous les types de documents
  const allTypes = await prisma.documentType.findMany({
    orderBy: [{ category: "asc" }, { code: "asc" }],
  });

  // Documents existants pour cet établissement, avec la version courante
  const existingDocs = await prisma.document.findMany({
    where: { establishmentId },
    select: {
      id: true,
      documentTypeId: true,
      status: true,
      missingJustification: true,
      currentVersion: {
        select: { id: true, versionNumber: true, originalFilename: true, uploadedAt: true },
      },
    },
  });

  const docByTypeId = new Map(existingDocs.map((d) => [d.documentTypeId, d]));

  const checklist: Partial<ChecklistByCategory> = {};

  for (const dt of allTypes) {
    const doc = docByTypeId.get(dt.id);

    let status: DocumentStatus;
    if (doc) {
      status = doc.status;
    } else if (dt.isConditional) {
      status = "NOT_APPLICABLE";
    } else {
      status = "MISSING";
    }

    const item: ChecklistItem = {
      documentTypeId: dt.id,
      code: dt.code,
      label: dt.label,
      isConditional: dt.isConditional,
      expectedFrequency: dt.expectedFrequency,
      status,
      documentId: doc?.id ?? null,
      missingJustification: doc?.missingJustification ?? null,
      currentVersion: doc?.currentVersion ?? null,
    };

    if (!checklist[dt.category]) checklist[dt.category] = [];
    checklist[dt.category]!.push(item);
  }

  return checklist as ChecklistByCategory;
}

export async function getClientChecklist(): Promise<{
  establishment: { id: string; name: string; type: string } | null;
  checklist: ChecklistByCategory;
}> {
  // L'établissement est résolu depuis le lien EstablishmentUser de la session, pas
  // depuis un identifiant fourni par la requête : non falsifiable par construction.
  const { establishment } = await requireClientEstablishment();

  if (!establishment) {
    return { establishment: null, checklist: {} as ChecklistByCategory };
  }

  const checklist = await buildChecklist(establishment.id);

  return { establishment, checklist };
}

export async function getEstablishmentChecklist(
  establishmentId: string
): Promise<ChecklistByCategory> {
  // Vérifie l'appartenance de l'établissement au tenant de l'appelant — sans ce
  // contrôle, un utilisateur Cabinet lisait la checklist de n'importe quel
  // établissement, tous tenants confondus.
  await requireEstablishmentInTenant(establishmentId);

  return buildChecklist(establishmentId);
}
