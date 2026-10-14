import { prisma, type Prisma } from "@eoda/database";
import type {
  BeneficiaryDataPort,
  BeneficiaryDocumentSummary,
  BeneficiaryScope,
  BeneficiarySummary,
  JournalEntry,
  NewBeneficiary,
  NewJournalEntry,
  NewSignedDocument,
  NewSurveyResponse,
  SurveyResponseRecord,
} from "./beneficiary-data-port";

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTATEUR PRISMA RÉEL — le SEUL fichier autorisé à toucher les tables usager
// (beneficiary-tables-guard.test.ts). NON SÉLECTIONNABLE tant que le verrou HDS est
// fermé (lib/hds/index.ts) : il n'est construit que chez un hébergeur certifié.
//
// Chaque requête porte le périmètre (tenant + structure) : un identifiant de personne
// reçu d'ailleurs ne sort jamais de sa structure. Les écritures liées (document +
// preuve + remise, réponse + réponses) sont faites dans UNE transaction.
// ─────────────────────────────────────────────────────────────────────────────
export class PrismaBeneficiaryDataAdapter implements BeneficiaryDataPort {
  readonly isAvailable = true;

  async listBeneficiaries(scope: BeneficiaryScope): Promise<BeneficiarySummary[]> {
    const rows = await prisma.beneficiary.findMany({
      where: { tenantId: scope.tenantId, establishmentId: scope.establishmentId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    return rows.map((row) => ({
      id: row.id,
      civility: row.civility === "MADAME" || row.civility === "MONSIEUR" ? row.civility : null,
      firstName: row.firstName,
      lastName: row.lastName,
      address: row.address,
      girLevel: row.girLevel,
      monthlyHours: row.monthlyHours,
      startedOn: row.startedOn,
      endedOn: row.endedOn,
      referentStaffMemberId: row.referentStaffMemberId,
    }));
  }

  async createBeneficiary(scope: BeneficiaryScope, input: NewBeneficiary): Promise<{ id: string }> {
    const { representative, ...fields } = input;
    return prisma.beneficiary.create({
      data: {
        ...fields,
        tenantId: scope.tenantId,
        establishmentId: scope.establishmentId,
        ...(representative ? { representatives: { create: representative } } : {}),
      },
      select: { id: true },
    });
  }

  async recordSignedDocument(scope: BeneficiaryScope, input: NewSignedDocument): Promise<{ documentId: string }> {
    return prisma.$transaction(async (tx) => {
      await tx.beneficiary.findFirstOrThrow({
        where: { id: input.beneficiaryId, tenantId: scope.tenantId, establishmentId: scope.establishmentId },
        select: { id: true },
      });
      const document = await tx.beneficiaryDocument.create({
        data: {
          tenantId: scope.tenantId,
          establishmentId: scope.establishmentId,
          beneficiaryId: input.beneficiaryId,
          kind: input.kind,
          sourceTemplateVersionId: input.sourceTemplateVersionId,
          renderedFileKey: input.renderedFileKey,
          sha256: input.sha256,
          issuedAt: input.issuedAt,
          renewDueOn: input.renewDueOn,
        },
        select: { id: true },
      });
      const { checklist, ...evidence } = input.evidence;
      await tx.signatureEvidence.create({
        data: {
          ...evidence,
          documentId: document.id,
          checklistJson: checklist.map((tick) => ({ ...tick, tickedAt: tick.tickedAt.toISOString() })) as Prisma.InputJsonValue,
        },
      });
      if (input.delivery) {
        await tx.deliveryRecord.create({
          data: {
            documentId: document.id,
            channel: input.delivery.channel,
            deliveredAt: input.delivery.deliveredAt,
            recordedByStaffMemberId: input.evidence.witnessStaffMemberId,
          },
        });
      }
      return { documentId: document.id };
    });
  }

  async listBeneficiaryDocuments(scope: BeneficiaryScope): Promise<BeneficiaryDocumentSummary[]> {
    const rows = await prisma.beneficiaryDocument.findMany({
      where: { tenantId: scope.tenantId, establishmentId: scope.establishmentId },
      select: {
        id: true,
        beneficiaryId: true,
        kind: true,
        issuedAt: true,
        renewDueOn: true,
        signatures: { select: { signedAt: true }, orderBy: { signedAt: "desc" }, take: 1 },
      },
      orderBy: { issuedAt: "desc" },
    });
    return rows.map(({ signatures, ...row }) => ({ ...row, signedAt: signatures[0]?.signedAt ?? null }));
  }

  async appendJournalEntry(scope: BeneficiaryScope, input: NewJournalEntry): Promise<{ id: string }> {
    await prisma.beneficiary.findFirstOrThrow({
      where: { id: input.beneficiaryId, tenantId: scope.tenantId, establishmentId: scope.establishmentId },
      select: { id: true },
    });
    return prisma.beneficiaryJournalEntry.create({ data: { ...input, tenantId: scope.tenantId }, select: { id: true } });
  }

  async listJournal(scope: BeneficiaryScope, beneficiaryId: string): Promise<JournalEntry[]> {
    return prisma.beneficiaryJournalEntry.findMany({
      where: { tenantId: scope.tenantId, beneficiaryId, beneficiary: { establishmentId: scope.establishmentId } },
      select: {
        id: true,
        beneficiaryId: true,
        authorStaffMemberId: true,
        authorUserId: true,
        text: true,
        possibleAdverseEvent: true,
        occurredAt: true,
      },
      orderBy: { occurredAt: "desc" },
    });
  }

  async recordSurveyResponse(scope: BeneficiaryScope, input: NewSurveyResponse): Promise<{ id: string }> {
    const { answers, ...fields } = input;
    return prisma.surveyResponse.create({
      data: {
        ...fields,
        tenantId: scope.tenantId,
        establishmentId: scope.establishmentId,
        answers: { create: answers.map((answer) => ({ ...answer })) },
      },
      select: { id: true },
    });
  }

  async listSurveyResponses(scope: BeneficiaryScope, since: Date | null): Promise<SurveyResponseRecord[]> {
    const rows = await prisma.surveyResponse.findMany({
      where: {
        tenantId: scope.tenantId,
        establishmentId: scope.establishmentId,
        ...(since ? { completedAt: { gte: since } } : {}),
      },
      select: {
        id: true,
        beneficiaryId: true,
        templateCode: true,
        templateVersion: true,
        respondentKind: true,
        mode: true,
        completedAt: true,
        answers: { select: { questionId: true, choice: true, freeText: true } },
      },
    });
    return rows;
  }
}
