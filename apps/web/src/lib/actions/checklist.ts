"use server";

import { prisma } from "@eoda/database";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { DocumentCategory, DocumentStatus } from "@eoda/database";

export type ChecklistItem = {
  documentTypeId: string;
  code: string;
  label: string;
  isConditional: boolean;
  expectedFrequency: string | null;
  status: DocumentStatus;
  documentId: string | null;
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
  const checklist = await buildChecklist(establishment.id);

  return { establishment, checklist };
}

export async function getEstablishmentChecklist(
  establishmentId: string
): Promise<ChecklistByCategory> {
  const session = await auth();
  if (!session || session.user.role === "CLIENT_USER") redirect("/login");

  return buildChecklist(establishmentId);
}
