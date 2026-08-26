"use server";

import { prisma } from "@eoda/database";
import { requireClientEstablishment, requireEstablishmentInTenant } from "@/lib/auth/guards";
import { getEstablishmentCoveredCategories } from "@/lib/services/establishment-offer-service";
import type { DocumentCategory, DocumentStatus } from "@eoda/database";
import type { DocumentAnalysisResult } from "@/lib/llm";
import { parseAnalysisResult } from "@/lib/services/analysis-view-service";

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
    // Résultat de l'analyse IA de CETTE version, déjà validé (analysis-view-service).
    // Produit à chaque dépôt depuis le Jalon 3, il n'était affiché nulle part : le
    // module le plus rentable de la plateforme s'arrêtait avant de rendre son
    // résultat.
    analysis: DocumentAnalysisResult | null;
  } | null;
};

export type ChecklistByCategory = Record<DocumentCategory, ChecklistItem[]>;

// Chemin de chargement PARTAGÉ par le portail client et la fiche établissement du
// cabinet : les deux rendent ChecklistCategory et doivent filtrer à l'identique.
async function buildChecklist(establishmentId: string): Promise<ChecklistByCategory> {
  // Périmètre de l'offre contractée (null = pas de mission ⇒ avant-vente, checklist
  // complète). Résolu par establishment-offer-service, la MÊME couche que celle qui
  // arbitre les dépôts dans document.ts — affichage et mutations ne peuvent pas diverger.
  const covered = await getEstablishmentCoveredCategories(establishmentId);

  // Types de documents attendus, restreints au périmètre de l'offre.
  const allTypes = await prisma.documentType.findMany({
    where: covered ? { category: { in: [...covered] } } : {},
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
        select: {
          id: true,
          versionNumber: true,
          originalFilename: true,
          uploadedAt: true,
          analysisResultJson: true,
        },
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
      // Le JSON brut ne sort jamais de cette couche : il est validé ici, une fois,
      // et le composant ne reçoit qu'une forme sûre (D2).
      currentVersion: doc?.currentVersion
        ? {
            id: doc.currentVersion.id,
            versionNumber: doc.currentVersion.versionNumber,
            originalFilename: doc.currentVersion.originalFilename,
            uploadedAt: doc.currentVersion.uploadedAt,
            analysis: parseAnalysisResult(doc.currentVersion.analysisResultJson),
          }
        : null,
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
