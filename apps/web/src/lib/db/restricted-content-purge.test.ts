import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { purgeRestrictedDocumentContent, type RestrictedContentPurgeClient } from "@eoda/database/restricted-content-purge";
import { RESTRICTED_DOCUMENT_TYPE_CODES } from "@/content/documents/acces-restreint";

// Relecture de sécurité du 10/11/2026 : un tampon déposé AVANT la restriction garde en base
// texte extrait, analyse, brouillon, essais, suggestions. Le script
// `packages/database/scripts/purge-restricted-document-content.ts` les efface ; sa logique
// est ici, et c'est elle qu'on teste. Essai à blanc par défaut (base partagée avec la
// production) : il compte, il n'écrit rien.

const VERSIONS = [
  { id: "v-1", document: { establishmentId: "etab-1", documentType: { code: "DEPARTEMENT_TAMPON" } } },
  { id: "v-2", document: { establishmentId: "etab-2", documentType: { code: "DEPARTEMENT_TAMPON" } } },
];

function fakeClient() {
  const client = {
    documentVersion: {
      findMany: vi.fn().mockResolvedValue(VERSIONS),
      count: vi.fn().mockResolvedValue(1),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    analysisTrial: { count: vi.fn().mockResolvedValue(3), deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
    documentCriterionSuggestion: { count: vi.fn().mockResolvedValue(4), deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
    documentVersionImage: { count: vi.fn().mockResolvedValue(0), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    correctionProposal: { count: vi.fn().mockResolvedValue(1), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditLogEntry: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(),
  };
  client.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(client));
  return client;
}

let client: ReturnType<typeof fakeClient>;
const asClient = (): RestrictedContentPurgeClient => client as unknown as RestrictedContentPurgeClient;

beforeEach(() => {
  client = fakeClient();
});

describe("purgeRestrictedDocumentContent — essai à blanc (défaut)", () => {
  it("ne lit que les versions des types restreints, compte, et n'écrit RIEN", async () => {
    const report = await purgeRestrictedDocumentContent(asClient(), { codes: RESTRICTED_DOCUMENT_TYPE_CODES, apply: false });

    expect(client.documentVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { document: { documentType: { code: { in: ["DEPARTEMENT_TAMPON"] } } } } })
    );
    // Jamais le contenu lui-même : seulement de quoi le compter.
    const select = client.documentVersion.findMany.mock.calls[0]?.[0]?.select ?? {};
    expect(select).not.toHaveProperty("extractedText");
    expect(select).not.toHaveProperty("analysisResultJson");
    expect(select).not.toHaveProperty("correctedDraftMarkdown");

    expect(report).toEqual({
      applied: false,
      counts: {
        versions: 2,
        extractedTexts: 1,
        analyses: 1,
        correctedDrafts: 1,
        analysisTrials: 3,
        criterionSuggestions: 4,
        versionImages: 0,
        correctionProposals: 1,
      },
    });
    expect(client.$transaction).not.toHaveBeenCalled();
    expect(client.documentVersion.updateMany).not.toHaveBeenCalled();
    expect(client.analysisTrial.deleteMany).not.toHaveBeenCalled();
    expect(client.auditLogEntry.create).not.toHaveBeenCalled();
  });

  it("compte chaque contenu sur les seules versions trouvées", async () => {
    await purgeRestrictedDocumentContent(asClient(), { codes: RESTRICTED_DOCUMENT_TYPE_CODES, apply: false });
    const ids = { in: ["v-1", "v-2"] };
    expect(client.documentVersion.count).toHaveBeenCalledWith({ where: { id: ids, extractedText: { not: null } } });
    expect(client.documentVersion.count).toHaveBeenCalledWith({ where: { id: ids, analysisResultJson: { not: Prisma.AnyNull } } });
    expect(client.documentVersion.count).toHaveBeenCalledWith({ where: { id: ids, correctedDraftMarkdown: { not: null } } });
    expect(client.analysisTrial.count).toHaveBeenCalledWith({ where: { documentVersionId: ids } });
    expect(client.documentCriterionSuggestion.count).toHaveBeenCalledWith({ where: { documentVersionId: ids } });
    expect(client.correctionProposal.count).toHaveBeenCalledWith({ where: { sourceVersionId: ids } });
  });

  it("aucune liste restreinte, aucune version : rien n'est lu au-delà, rien n'est écrit", async () => {
    const empty = await purgeRestrictedDocumentContent(asClient(), { codes: [], apply: true });
    expect(empty.counts.versions).toBe(0);
    expect(client.documentVersion.findMany).not.toHaveBeenCalled();

    client.documentVersion.findMany.mockResolvedValue([]);
    const none = await purgeRestrictedDocumentContent(asClient(), { codes: RESTRICTED_DOCUMENT_TYPE_CODES, apply: true });
    expect(none).toEqual(expect.objectContaining({ applied: false }));
    expect(client.$transaction).not.toHaveBeenCalled();
  });
});

describe("purgeRestrictedDocumentContent — --apply", () => {
  it("efface texte, analyse, brouillon (et sa revue) et supprime essais, suggestions, images, propositions, dans UNE transaction", async () => {
    const report = await purgeRestrictedDocumentContent(asClient(), { codes: RESTRICTED_DOCUMENT_TYPE_CODES, apply: true });
    const ids = { in: ["v-1", "v-2"] };

    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(client.documentVersion.updateMany).toHaveBeenCalledWith({
      where: { id: ids },
      data: {
        extractedText: null,
        analysisResultJson: Prisma.DbNull,
        correctedDraftMarkdown: null,
        correctedDraftGeneratedAt: null,
        analysisReviewedAt: null,
        analysisReviewedByUserId: null,
      },
    });
    expect(client.analysisTrial.deleteMany).toHaveBeenCalledWith({ where: { documentVersionId: ids } });
    expect(client.documentCriterionSuggestion.deleteMany).toHaveBeenCalledWith({ where: { documentVersionId: ids } });
    expect(client.documentVersionImage.deleteMany).toHaveBeenCalledWith({ where: { documentVersionId: ids } });
    expect(client.correctionProposal.deleteMany).toHaveBeenCalledWith({ where: { sourceVersionId: ids } });
    expect(report.applied).toBe(true);
  });

  it("journalise une ligne par version, sans aucune donnée de personne ni contenu", async () => {
    await purgeRestrictedDocumentContent(asClient(), { codes: RESTRICTED_DOCUMENT_TYPE_CODES, apply: true });
    expect(client.auditLogEntry.create).toHaveBeenCalledTimes(2);
    expect(client.auditLogEntry.create).toHaveBeenCalledWith({
      data: {
        action: "ANALYSIS_UNPUBLISHED",
        actorUserId: null,
        actorRole: "SCRIPT purge-restricted-document-content",
        establishmentId: "etab-1",
        targetId: "v-1",
        detail: "DEPARTEMENT_TAMPON · contenu dérivé effacé (accès restreint)",
      },
    });
  });
});
