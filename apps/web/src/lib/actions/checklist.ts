"use server";

import { prisma } from "@eoda/database";
import { requireClientEstablishment, requireEstablishmentInTenant } from "@/lib/auth/guards";
import { getEstablishmentCoveredCategories } from "@/lib/services/establishment-offer-service";
import type { DocumentCategory, DocumentStatus } from "@eoda/database";
import {
  deriveDocumentStep,
  type DocumentStep,
} from "@/lib/services/document-workflow-service";
import type { DocumentAnalysisResult } from "@/lib/llm";
import {
  analysisVisibleTo,
  isAnalysisAwaitingReview,
  parseAnalysisResult,
  type AnalysisAudience,
} from "@/lib/services/analysis-view-service";
import {
  isLibraryUpdateAlertDue,
  type MissionAccessState,
} from "@/lib/services/mission-access-service";

export type ChecklistItem = {
  documentTypeId: string;
  code: string;
  label: string;
  isConditional: boolean;
  expectedFrequency: string | null;
  // Réclamé à la structure, ou produit par EODA (§ call du 26/08). Le portail client
  // n'affiche que les types réclamés — plus ceux dont un document existe déjà.
  requestedFromClient: boolean;
  status: DocumentStatus;
  documentId: string | null;
  missingJustification: string | null;
  // TOUTES les versions, de la plus récente à la plus ancienne — demande du 26/08 :
  // « il faut que je puisse les stocker […] la version originale, le rapport et la
  // version modifiée ». Elles étaient toutes conservées en base, l'écran n'en
  // montrait qu'une.
  versions: DocumentVersionItem[];
  // Étape atteinte dans le parcours documentaire (document-workflow-service).
  step: DocumentStep;
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
    // Date de revue par la consultante. Null = analyse non restituable au client
    // (CDC §5, §7). Côté cabinet, sert à distinguer « à relire » de « publiée ».
    analysisReviewedAt: Date | null;
    // Vrai quand une analyse existe mais attend la relecture. Côté client, permet de
    // dire « en cours de relecture » sans rien montrer du contenu.
    analysisAwaitingReview: boolean;
  } | null;
};

// Une version telle qu'elle s'affiche dans l'historique.
export type DocumentVersionItem = {
  id: string;
  versionNumber: number;
  originalFilename: string;
  uploadedAt: Date;
  // Qui l'a déposée. « EODA » ou le nom de la structure : c'est ce qui distingue la
  // version d'origine du client de celle que le cabinet a produite.
  uploadedByName: string;
  producedByCabinet: boolean;
  hasAnalysis: boolean;
};

export type ChecklistByCategory = Record<DocumentCategory, ChecklistItem[]>;

// Chemin de chargement PARTAGÉ par le portail client et la fiche établissement du
// cabinet : les deux rendent ChecklistCategory et doivent filtrer à l'identique.
// `audience` gouverne UNE chose : l'analyse automatique est-elle restituable ?
// Elle est passée en paramètre plutôt que déduite de la session, pour que les deux
// points d'entrée (portail client, fiche cabinet) la déclarent explicitement — une
// valeur par défaut finirait par publier au client le jour où un troisième appelant
// oublierait de la préciser.
async function buildChecklist(
  establishmentId: string,
  audience: AnalysisAudience
): Promise<ChecklistByCategory> {
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
      validatedAt: true,
      currentVersion: {
        select: {
          id: true,
          versionNumber: true,
          originalFilename: true,
          uploadedAt: true,
          analysisResultJson: true,
          analysisReviewedAt: true,
        },
      },
      // L'historique complet. Ordonné du plus récent au plus ancien : on cherche
      // presque toujours la dernière version, et le reste est de la trace.
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          originalFilename: true,
          uploadedAt: true,
          analysisResultJson: true,
          uploadedBy: { select: { name: true, role: true } },
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
      requestedFromClient: dt.requestedFromClient,
      status,
      documentId: doc?.id ?? null,
      missingJustification: doc?.missingJustification ?? null,
      // Le JSON brut ne sort jamais de cette couche : il est validé ici, une fois,
      // et le composant ne reçoit qu'une forme sûre (D2).
      currentVersion: doc?.currentVersion
        ? toChecklistVersion(doc.currentVersion, audience)
        : null,
      versions: (doc?.versions ?? []).map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        originalFilename: version.originalFilename,
        uploadedAt: version.uploadedAt,
        uploadedByName: version.uploadedBy.name,
        // Le rôle de l'auteur dit d'où vient la version. Recopié à la lecture plutôt
        // que stocké : un compte ne change pas de camp, et une colonne de plus serait
        // une vérité à maintenir.
        producedByCabinet: version.uploadedBy.role !== "CLIENT_USER",
        hasAnalysis: version.analysisResultJson !== null,
      })),
      step: deriveDocumentStep({
        hasVersion: !!doc?.currentVersion,
        hasAnalysis: doc?.currentVersion?.analysisResultJson != null,
        hasCabinetVersion: (doc?.versions ?? []).some(
          (version) => version.uploadedBy.role !== "CLIENT_USER"
        ),
        analysisRestituted: doc?.currentVersion?.analysisReviewedAt != null,
        validatedAt: doc?.validatedAt ?? null,
      }),
    };

    // Ce que le CLIENT voit : les documents qu'on lui réclame, et ceux dont une
    // version existe déjà — sa bibliothèque, qu'il ait déposé lui-même ou qu'EODA
    // ait produit pour lui. Les autres sont le plan de production du cabinet ; les
    // lui montrer, c'est lui réclamer ce qu'on s'est engagé à écrire à sa place.
    if (audience === "CLIENT" && !dt.requestedFromClient && !doc?.currentVersion) {
      continue;
    }

    if (!checklist[dt.category]) checklist[dt.category] = [];
    checklist[dt.category]!.push(item);
  }

  return checklist as ChecklistByCategory;
}

// Barrière de restitution, appliquée UNE fois, ici. Un composant qui la
// réimplémenterait finirait par l'oublier — et publierait au client une analyse que
// personne n'a relue.
function toChecklistVersion(
  version: {
    id: string;
    versionNumber: number;
    originalFilename: string;
    uploadedAt: Date;
    analysisResultJson: unknown;
    analysisReviewedAt: Date | null;
  },
  audience: AnalysisAudience
): NonNullable<ChecklistItem["currentVersion"]> {
  const reviewable = {
    analysis: parseAnalysisResult(version.analysisResultJson),
    reviewedAt: version.analysisReviewedAt,
  };

  return {
    id: version.id,
    versionNumber: version.versionNumber,
    originalFilename: version.originalFilename,
    uploadedAt: version.uploadedAt,
    analysis: analysisVisibleTo(audience, reviewable),
    analysisReviewedAt: version.analysisReviewedAt,
    analysisAwaitingReview: isAnalysisAwaitingReview(reviewable),
  };
}

export async function getClientChecklist(): Promise<{
  establishment: { id: string; name: string; type: string } | null;
  checklist: ChecklistByCategory;
  // Fin de mission (§12.5) : gouverne ce que le portail PROPOSE. Le refus réel est
  // dans les actions d'écriture — masquer un bouton n'a jamais protégé une route.
  missionAccess: MissionAccessState;
  // Vrai quand la bibliothèque date de 5 mois ou plus (§12.5) — le moment où des
  // documents figés commencent à vieillir, pas une expiration.
  libraryUpdateAlert: boolean;
}> {
  // L'établissement est résolu depuis le lien EstablishmentUser de la session, pas
  // depuis un identifiant fourni par la requête : non falsifiable par construction.
  const { establishment, missionAccess, missionClosure } = await requireClientEstablishment();
  // `now` lu ici, à la frontière : le service reste pur et testable sans horloge.
  const libraryUpdateAlert = isLibraryUpdateAlertDue(missionClosure, new Date());

  if (!establishment) {
    return {
      establishment: null,
      checklist: {} as ChecklistByCategory,
      missionAccess,
      libraryUpdateAlert,
    };
  }

  const checklist = await buildChecklist(establishment.id, "CLIENT");

  return { establishment, checklist, missionAccess, libraryUpdateAlert };
}

export async function getEstablishmentChecklist(
  establishmentId: string
): Promise<ChecklistByCategory> {
  // Vérifie l'appartenance de l'établissement au tenant de l'appelant — sans ce
  // contrôle, un utilisateur Cabinet lisait la checklist de n'importe quel
  // établissement, tous tenants confondus.
  await requireEstablishmentInTenant(establishmentId);

  return buildChecklist(establishmentId, "CABINET");
}
