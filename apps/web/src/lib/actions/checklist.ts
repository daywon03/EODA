"use server";

import { prisma } from "@eoda/database";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { DocumentCategory, DocumentStatus } from "@eoda/database";

export type ChecklistItem = {
  code: string;
  label: string;
  isConditional: boolean;
  expectedFrequency: string | null;
  status: DocumentStatus;
  documentId: string | null;
};

export type ChecklistByCategory = Record<DocumentCategory, ChecklistItem[]>;

export async function getClientChecklist(): Promise<{
  establishment: { id: string; name: string; type: string } | null;
  checklist: ChecklistByCategory;
}> {
  const session = await auth();
  if (!session || session.user.role !== "CLIENT_USER") redirect("/login");

  // Trouver l'établissement lié au client (premier si plusieurs)
  const establishmentUser = await prisma.establishmentUser.findFirst({
    where: { userId: session.user.id },
    include: { establishment: { select: { id: true, name: true, type: true } } },
  });

  if (!establishmentUser) {
    return { establishment: null, checklist: {} as ChecklistByCategory };
  }

  const { establishment } = establishmentUser;

  // Tous les types de documents
  const allTypes = await prisma.documentType.findMany({
    orderBy: [{ category: "asc" }, { code: "asc" }],
  });

  // Documents existants pour cet établissement
  const existingDocs = await prisma.document.findMany({
    where: { establishmentId: establishment.id },
    select: { id: true, documentTypeId: true, status: true },
  });

  const docByTypeId = new Map(existingDocs.map((d) => [d.documentTypeId, d]));

  // Construire la checklist par catégorie
  const checklist: Partial<ChecklistByCategory> = {};

  for (const dt of allTypes) {
    const doc = dt.id ? docByTypeId.get(dt.id) : undefined;

    let status: DocumentStatus;
    if (doc) {
      status = doc.status;
    } else if (dt.isConditional) {
      status = "NOT_APPLICABLE";
    } else {
      status = "MISSING";
    }

    const item: ChecklistItem = {
      code: dt.code,
      label: dt.label,
      isConditional: dt.isConditional,
      expectedFrequency: dt.expectedFrequency,
      status,
      documentId: doc?.id ?? null,
    };

    if (!checklist[dt.category]) checklist[dt.category] = [];
    checklist[dt.category]!.push(item);
  }

  return { establishment, checklist: checklist as ChecklistByCategory };
}
