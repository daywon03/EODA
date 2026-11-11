import { prisma } from "@eoda/database";
import { structureScopeWhere, type CabinetContext } from "@/lib/auth/guards";
import { getEstablishmentChecklist } from "@/lib/actions/checklist";
import { isRestrictedDocumentType } from "@/content/documents/acces-restreint";
import { getKnowledgeRetrievalPort } from "@/lib/knowledge";
import { getFileStoragePort } from "@/lib/storage";
import { anonymizeText } from "@/lib/services/anonymization-service";
import { parseAnalysisResult } from "@/lib/services/analysis-view-service";
import { summarizeAnalysis } from "@/lib/services/assistant-service";
import { commentsForAnalysis } from "@/lib/services/document-comment-thread-service";
import { describeDocxDesign, summarizeDocxDesign } from "@/lib/services/docx-template-transplant";
import { DOCUMENT_BUCKET_LABELS, documentBucket, flattenChecklist } from "@/lib/services/structure-documents-service";
import { formatDate } from "@/lib/services/date-format-service";
import { nodeInflateRaw } from "@/lib/services/node-inflate";
import { isZip, readZip } from "@/lib/services/zip-read";
import type { AgentDeps } from "@/lib/services/cabinet-assistant-agent";

// ─────────────────────────────────────────────────────────────────────────────
// LES OUTILS RÉELS DE L'ASSISTANT DU MENU (11/11/2026), bornés au périmètre de
// l'appelant : chaque identifiant reçu du modèle est une entrée non fiable, revérifié
// contre `structureScopeWhere` (tenant + affectations de la consultante). Hors
// périmètre, inexistant, restreint (ADR 20261110), archivé ou masqué → null, que l'agent
// rend « introuvable ». Textes anonymisés avant de partir au modèle.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_TEXT = 8000;
const KNOWLEDGE_LIMIT = 5;

export function cabinetAssistantDeps(context: CabinetContext): AgentDeps {
  const scope = structureScopeWhere(context);

  async function inScope(structureId: string): Promise<{ id: string; name: string } | null> {
    if (!structureId) return null;
    return prisma.establishment.findFirst({ where: { ...scope, id: structureId }, select: { id: true, name: true } });
  }

  async function openLine(structureId: string, documentTypeId: string) {
    const structure = await inScope(structureId);
    if (!structure || !documentTypeId) return null;
    const line = await prisma.documentType.findUnique({
      where: { id: documentTypeId },
      select: { id: true, code: true, label: true, archivedAt: true, hiddenFor: { where: { establishmentId: structure.id }, select: { establishmentId: true } } },
    });
    if (!line || line.archivedAt || line.hiddenFor.length > 0 || isRestrictedDocumentType(line.code)) return null;
    return { structure, line };
  }

  return {
    async listStructures() {
      const structures = await prisma.establishment.findMany({
        where: scope,
        orderBy: { name: "asc" },
        take: 50,
        select: { id: true, name: true, type: true, hasEvaluationTargetDate: true, mission: { select: { formule: true, closedAt: true } } },
      });
      const documents = await prisma.document.findMany({
        where: { establishmentId: { in: structures.map((s) => s.id) } },
        select: { establishmentId: true, currentVersionId: true, validatedAt: true },
      });
      return structures.map((s) => {
        const own = documents.filter((d) => d.establishmentId === s.id);
        return {
          id: s.id,
          nom: s.name,
          type: s.type,
          offre: s.mission?.formule ?? null,
          accompagnementClos: s.mission?.closedAt != null,
          evaluationHas: s.hasEvaluationTargetDate ? formatDate(s.hasEvaluationTargetDate) : null,
          documentsDeposes: own.filter((d) => d.currentVersionId).length,
          documentsValides: own.filter((d) => d.validatedAt).length,
        };
      });
    },

    async getStructureDocuments(structureId, state) {
      const structure = await inScope(structureId);
      if (!structure) return null;
      // La checklist de la fiche, avec SA garde (lecture cabinet) : même liste que l'écran.
      const rows = flattenChecklist(await getEstablishmentChecklist(structure.id));
      return rows
        .map((row) => ({
          documentTypeId: row.documentTypeId,
          intitule: row.label,
          etat: DOCUMENT_BUCKET_LABELS[documentBucket(row)],
          version: row.currentVersion ? row.currentVersion.versionNumber : null,
          deposeLe: row.currentVersion ? formatDate(row.currentVersion.uploadedAt) : null,
        }))
        .filter((row) => !state || row.etat.toLowerCase() === state.toLowerCase());
    },

    async getDocument(structureId, documentTypeId) {
      const open = await openLine(structureId, documentTypeId);
      if (!open) return null;
      const document = await prisma.document.findUnique({
        where: { establishmentId_documentTypeId: { establishmentId: open.structure.id, documentTypeId: open.line.id } },
        select: {
          status: true,
          validatedAt: true,
          missingJustification: true,
          commentUsedByAi: true,
          comments: { select: { text: true, aiEnabled: true, createdAt: true } },
          currentVersion: {
            select: {
              versionNumber: true,
              originalFilename: true,
              extractedText: true,
              analysisResultJson: true,
              images: { where: { description: { not: null } }, orderBy: { position: "asc" }, select: { description: true } },
            },
          },
        },
      });
      const criteria = await prisma.documentTypeCriterion.findMany({
        where: { documentTypeId: open.line.id },
        select: { criterion: { select: { code: true, label: true } } },
      });
      const version = document?.currentVersion;
      const text = version?.extractedText ? anonymizeText(version.extractedText) : null;
      return {
        structure: open.structure.name,
        intitule: open.line.label,
        depose: Boolean(version),
        version: version?.versionNumber ?? null,
        fichier: version?.originalFilename ?? null,
        valideParEoda: document?.validatedAt ? formatDate(document.validatedAt) : null,
        criteres: criteria.map((c) => `${c.criterion.code} — ${c.criterion.label}`),
        analyse: summarizeAnalysis(parseAnalysisResult(version?.analysisResultJson ?? null)),
        commentaires:
          commentsForAnalysis(document?.comments ?? [], {
            text: document?.missingJustification ?? null,
            usedByAi: document?.commentUsedByAi === true,
          }) ?? null,
        imagesDecrites: (version?.images ?? []).map((i) => i.description),
        texte: text ? (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)} […texte coupé]` : text) : null,
      };
    },

    async describeDocumentDesign(structureId, documentTypeId) {
      const open = await openLine(structureId, documentTypeId);
      if (!open) return null;
      const document = await prisma.document.findUnique({
        where: { establishmentId_documentTypeId: { establishmentId: open.structure.id, documentTypeId: open.line.id } },
        select: { currentVersion: { select: { fileStorageKey: true } } },
      });
      const key = document?.currentVersion?.fileStorageKey;
      if (!key) return "Aucun fichier déposé pour ce document.";
      return describeWordFile(key);
    },

    async getStructureDesign(structureId) {
      const structure = await inScope(structureId);
      if (!structure) return null;
      const design = await prisma.establishmentDocumentDesign.findUnique({
        where: { establishmentId: structure.id },
        select: { notes: true, modelFilename: true, modelFileKey: true },
      });
      return {
        structure: structure.name,
        consignes: design?.notes ?? null,
        modele: design?.modelFilename ?? null,
        miseEnPageDuModele: design?.modelFileKey ? await describeWordFile(design.modelFileKey) : null,
      };
    },

    async searchKnowledge(query) {
      const port = getKnowledgeRetrievalPort();
      if (!port || !query) return { extraits: [], note: "Base de connaissances indisponible." };
      const excerpts = await port.search(context.tenantId, query, KNOWLEDGE_LIMIT);
      return { extraits: excerpts.map((e) => e.content.slice(0, 1500)) };
    },

    async resolveTarget(structureId, documentTypeId) {
      if (documentTypeId === null) {
        const structure = await inScope(structureId);
        return structure ? { establishmentName: structure.name, documentLabel: null } : null;
      }
      const open = await openLine(structureId, documentTypeId);
      return open ? { establishmentName: open.structure.name, documentLabel: open.line.label } : null;
    },
  };
}

async function describeWordFile(key: string): Promise<string> {
  try {
    const bytes = new Uint8Array(await getFileStoragePort().download(key));
    if (!isZip(bytes)) return "Ce fichier n'est pas un document Word : sa mise en page ne se lit pas.";
    return summarizeDocxDesign(describeDocxDesign(await readZip(bytes, nodeInflateRaw)));
  } catch {
    return "Le fichier n'a pas pu être lu.";
  }
}
