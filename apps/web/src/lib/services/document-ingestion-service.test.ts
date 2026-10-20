import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FileStoragePort } from "@/lib/storage";
import type { LLMAnalysisPort } from "@/lib/llm";

// Stockage des images extraites d'un document (.docx) — best-effort : le point
// central de la tâche D4. Une image dont l'upload, la description ou
// l'enregistrement échoue ne doit JAMAIS empêcher les autres images de se
// stocker, ni le dépôt du document lui-même de se terminer normalement. Seule
// la fonction réelle `ingestDocumentVersion` (pas un mock du câblage côté
// action serveur) peut vérifier cette propriété — cf. revue de la tâche D4.

const prismaMock = {
  // `findUnique` : relu au moment de l'analyse pour la consigne de la consultante
  // (`analysisDirective` / `directiveInAnalysis`, 20/10/2026).
  document: { upsert: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  documentVersion: { create: vi.fn(), update: vi.fn() },
  documentVersionImage: { create: vi.fn(), findMany: vi.fn() },
  // Lues par l'analyse (analyzeVersion) — cf. le second describe, qui porte sur la
  // matrice type de document ↔ critères.
  documentTypeCriterion: { findMany: vi.fn() },
  documentCriterionSuggestion: { findMany: vi.fn(), upsert: vi.fn() },
  criterion: { findMany: vi.fn() },
  criterionGuideline: { findMany: vi.fn() },
  establishment: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};

const describeImage = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("@/lib/services/image-vision-service", () => ({
  describeImage: (...args: unknown[]) => describeImage(...args),
}));

const { ingestDocumentVersion, MAX_IMAGES_DESCRIBED, MAX_IMAGE_SIZE_BYTES } = await import(
  "./document-ingestion-service"
);

const ESTABLISHMENT_ID = "etab-1";
const DOCUMENT_TYPE_ID = "dt-1";

function baseInput(overrides: Partial<Parameters<typeof ingestDocumentVersion>[0]> = {}) {
  return {
    establishmentId: ESTABLISHMENT_ID,
    documentTypeId: DOCUMENT_TYPE_ID,
    documentTypeLabel: "Livret d'accueil",
    content: Buffer.from("contenu"),
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    originalFilename: "livret.docx",
    uploadedByUserId: "user-1",
    documentOrigin: "CLIENT" as const,
    // Pas de texte à analyser : ce test porte sur le stockage des images, pas
    // sur l'analyse IA — la garder hors du chemin testé évite de mocker le port
    // LLM et la base de connaissances, non pertinents ici.
    extractedText: null,
    ...overrides,
  };
}

function fakeStorage(overrides: Partial<FileStoragePort> = {}): FileStoragePort {
  return {
    upload: vi.fn().mockResolvedValue(undefined),
    getSignedDownloadUrl: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  } as unknown as FileStoragePort;
}

const noopLlm = { analyze: vi.fn() } as unknown as LLMAnalysisPort;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.document.upsert.mockResolvedValue({ id: "doc-1", versions: [] });
  prismaMock.documentVersion.create.mockResolvedValue({ id: "dv-1" });
  prismaMock.document.update.mockResolvedValue({});
  // Aucune consigne par défaut : c'est le cas de la quasi-totalité des documents.
  prismaMock.document.findUnique.mockResolvedValue(null);
  prismaMock.documentVersionImage.create.mockResolvedValue({});
});

describe("ingestDocumentVersion — stockage best-effort des images extraites", () => {
  it("stocke une image extraite et sa description sans bloquer le dépôt si la description échoue", async () => {
    const storage = fakeStorage();
    describeImage.mockResolvedValue(null); // échec de la description, best-effort

    const image = { position: 1, contentType: "image/png", buffer: Buffer.from("x") };
    const result = await ingestDocumentVersion(
      baseInput({ extractedImages: [image] }),
      { storage, llm: noopLlm }
    );

    expect(result.documentVersionId).toBe("dv-1");
    // Un appel pour le fichier lui-même, un second pour l'image extraite.
    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(prismaMock.documentVersionImage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentVersionId: "dv-1",
        position: 1,
        contentType: "image/png",
        description: null,
      }),
    });
  });

  it("stocke les autres images et termine normalement même si l'upload d'une image échoue", async () => {
    const storage = fakeStorage({
      // 1er appel = l'upload du document lui-même (doit réussir) ; 2e = l'image en
      // échec ; 3e = l'image qui réussit.
      upload: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("panne de stockage"))
        .mockResolvedValueOnce(undefined),
    });
    describeImage.mockResolvedValue("Une description.");

    const images = [
      { position: 1, contentType: "image/png", buffer: Buffer.from("échec") },
      { position: 2, contentType: "image/png", buffer: Buffer.from("succès") },
    ];

    const result = await ingestDocumentVersion(baseInput({ extractedImages: images }), {
      storage,
      llm: noopLlm,
    });

    // Le dépôt du document se termine normalement — aucune promesse rejetée
    // n'a remonté jusqu'à l'appelant.
    expect(result.documentVersionId).toBe("dv-1");
    // Seule l'image qui a réussi son upload est enregistrée en base.
    expect(prismaMock.documentVersionImage.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.documentVersionImage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ position: 2, description: "Une description." }),
    });
  });

  it("termine normalement même si l'enregistrement en base d'une image échoue", async () => {
    const storage = fakeStorage();
    describeImage.mockResolvedValue("Une description.");
    prismaMock.documentVersionImage.create.mockRejectedValue(new Error("contrainte violée"));

    const image = { position: 1, contentType: "image/png", buffer: Buffer.from("x") };

    await expect(
      ingestDocumentVersion(baseInput({ extractedImages: [image] }), { storage, llm: noopLlm })
    ).resolves.toMatchObject({ documentVersionId: "dv-1" });
  });

  it("n'appelle ni le stockage ni la description quand aucune image n'a été extraite", async () => {
    const storage = fakeStorage();

    await ingestDocumentVersion(baseInput({ extractedImages: [] }), { storage, llm: noopLlm });

    expect(storage.upload).toHaveBeenCalledTimes(1); // seulement le fichier lui-même
    expect(describeImage).not.toHaveBeenCalled();
    expect(prismaMock.documentVersionImage.create).not.toHaveBeenCalled();
  });

  // Décision Damon (revue finale, 16/09/2026) : la description générée par le
  // modèle de vision échappait à l'anonymisation appliquée partout ailleurs dans
  // le dépôt avant tout envoi/stockage destiné à un prompt (D5).
  it("anonymise la description d'image avant de la stocker", async () => {
    const storage = fakeStorage();
    describeImage.mockResolvedValue("Contact visible sur l'affiche : sandrine@eoda-conseil.fr");

    const image = { position: 1, contentType: "image/png", buffer: Buffer.from("x") };
    await ingestDocumentVersion(baseInput({ extractedImages: [image] }), { storage, llm: noopLlm });

    expect(prismaMock.documentVersionImage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: "Contact visible sur l'affiche : [email masqué]",
      }),
    });
  });

  // Plafonds décidés par Damon : sans borne, un seul dépôt pouvait déclencher un
  // fan-out non borné d'appels payants à OpenRouter en parallèle.
  it("ignore silencieusement les images au-delà du plafond, par ordre de position", async () => {
    const storage = fakeStorage();
    describeImage.mockResolvedValue("description");

    const images = Array.from({ length: MAX_IMAGES_DESCRIBED + 1 }, (_, i) => ({
      position: i + 1,
      contentType: "image/png",
      buffer: Buffer.from("x"),
    }));

    await ingestDocumentVersion(baseInput({ extractedImages: images }), { storage, llm: noopLlm });

    // Un upload pour le fichier lui-même + un par image retenue (le plafond, pas
    // le plafond + 1).
    expect(storage.upload).toHaveBeenCalledTimes(1 + MAX_IMAGES_DESCRIBED);
    expect(prismaMock.documentVersionImage.create).toHaveBeenCalledTimes(MAX_IMAGES_DESCRIBED);
    // La dernière image (position MAX_IMAGES_DESCRIBED + 1) n'a jamais été traitée.
    expect(prismaMock.documentVersionImage.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ position: MAX_IMAGES_DESCRIBED + 1 }) })
    );
  });

  it("ignore silencieusement une image dépassant la taille maximale, sans l'uploader ni la décrire", async () => {
    const storage = fakeStorage();
    describeImage.mockResolvedValue("description");

    const tooLarge = {
      position: 1,
      contentType: "image/png",
      buffer: Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1),
    };
    const ok = { position: 2, contentType: "image/png", buffer: Buffer.from("x") };

    await ingestDocumentVersion(baseInput({ extractedImages: [tooLarge, ok] }), { storage, llm: noopLlm });

    // Un upload pour le fichier lui-même + un seul pour l'image de taille correcte.
    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(describeImage).toHaveBeenCalledTimes(1);
    expect(prismaMock.documentVersionImage.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.documentVersionImage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ position: 2 }),
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LA MATRICE TYPE DE DOCUMENT ↔ CRITÈRES ATTEINT L'ANALYSE (16/10/2026).
//
// `DocumentTypeCriterion` est le levier n°1 de la qualité des analyses (spec 04) :
// tout le reste du pipeline — jugement du document, critères suggérés en plus,
// guidelines rappelées — s'ordonne autour de ces rattachements. La chaîne complète
// fonctionnait, mais RIEN ne la verrouillait : les tests ci-dessus n'inspectent jamais
// les arguments reçus par `analyze` (leur `noopLlm` n'est qu'un `vi.fn()`), et le test
// du prompt ne voyait que son propre rendu. Supprimer le `findMany` de la matrice, ou
// remplacer le filtre par un `documentTypeId` quelconque, passait donc au vert.
//
// Ce qui est prouvé ici est le SEUL maillon qu'aucun autre test ne couvre : la matrice
// LUE EN BASE arrive dans le port d'analyse, filtrée sur le type du document.
describe("ingestDocumentVersion — matrice type de document ↔ critères", () => {
  const MATRIX_ROWS = [
    { criterion: { id: "crit-1", code: "3.12.1", label: "Traitement des plaintes" } },
    { criterion: { id: "crit-2", code: "1.2.1", label: "Exercice des droits" } },
  ];

  function armAnalysis(rowCount = 0) {
    prismaMock.documentTypeCriterion.findMany.mockResolvedValue(rowCount === 0 ? [] : MATRIX_ROWS);
    prismaMock.establishment.findUnique.mockResolvedValue({ tenantId: "tenant-1", type: "SAD_AIDE" });
    prismaMock.criterion.findMany.mockResolvedValue([]);
    prismaMock.criterionGuideline.findMany.mockResolvedValue([]);
    prismaMock.documentVersionImage.findMany.mockResolvedValue([]);
    prismaMock.documentCriterionSuggestion.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockResolvedValue([]);
    prismaMock.documentVersion.update.mockResolvedValue({});

    const analyze = vi.fn().mockResolvedValue({ criteresSupplementaires: [] });
    return { analyze, llm: { analyze } as unknown as LLMAnalysisPort };
  }

  it("lit la matrice du type de document analysé, et d'aucun autre", async () => {
    const { llm } = armAnalysis(2);

    await ingestDocumentVersion(baseInput({ extractedText: "Contenu." }), {
      storage: fakeStorage(),
      llm,
    });

    expect(prismaMock.documentTypeCriterion.findMany).toHaveBeenCalledWith({
      where: { documentTypeId: DOCUMENT_TYPE_ID },
      include: { criterion: { select: { id: true, code: true, label: true } } },
    });
  });

  it("remet à l'IA les critères rattachés, sous forme de code et d'intitulé", async () => {
    const { llm, analyze } = armAnalysis(2);

    await ingestDocumentVersion(baseInput({ extractedText: "Contenu." }), {
      storage: fakeStorage(),
      llm,
    });

    expect(analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        linkedCriteria: [
          { code: "3.12.1", label: "Traitement des plaintes" },
          { code: "1.2.1", label: "Exercice des droits" },
        ],
      })
    );
  });

  it("n'invente aucun critère quand la matrice est vide", async () => {
    // Le cas réel d'aujourd'hui, pour presque tous les types. La tentation serait de
    // combler par le catalogue : l'analyse jugerait alors un livret contre des
    // critères que personne n'a rattachés à un livret.
    const { llm, analyze } = armAnalysis(0);

    await ingestDocumentVersion(baseInput({ extractedText: "Contenu." }), {
      storage: fakeStorage(),
      llm,
    });

    expect(analyze).toHaveBeenCalledWith(expect.objectContaining({ linkedCriteria: [] }));
  });

  // ── LA CONSIGNE DE LA CONSULTANTE (20/10/2026) ──────────────────────────────
  // Elle est relue EN BASE au moment de l'analyse, pas reçue de l'appelant : c'est
  // ce qui fait que le dépôt, la ré-analyse et le reclassement voient tous la
  // consigne à jour, sans qu'aucun des trois ait à y penser.
  it("transmet la consigne active, et la recopie sur la version analysée", async () => {
    const { llm, analyze } = armAnalysis(2);
    prismaMock.document.findUnique.mockResolvedValue({
      analysisDirective: "  Il s'agit de la synthèse 2025.  ",
      directiveInAnalysis: true,
    });

    await ingestDocumentVersion(baseInput({ extractedText: "Contenu." }), {
      storage: fakeStorage(),
      llm,
    });

    expect(analyze).toHaveBeenCalledWith(
      expect.objectContaining({ analysisDirective: "Il s'agit de la synthèse 2025." })
    );
    // La copie sur la version est ce qui permet de dire, six mois plus tard, avec
    // quelle consigne cette analyse-là a été produite.
    expect(prismaMock.documentVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ analysisDirectiveUsed: "Il s'agit de la synthèse 2025." }),
      })
    );
  });

  it("n'envoie rien quand le bouton « prendre en compte » est éteint — le texte reste en base", async () => {
    const { llm, analyze } = armAnalysis(2);
    prismaMock.document.findUnique.mockResolvedValue({
      analysisDirective: "Note de travail, pas encore prête.",
      directiveInAnalysis: false,
    });

    await ingestDocumentVersion(baseInput({ extractedText: "Contenu." }), {
      storage: fakeStorage(),
      llm,
    });

    const payload = analyze.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(payload).toBeDefined();
    expect(payload).not.toHaveProperty("analysisDirective");
    expect(prismaMock.documentVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ analysisDirectiveUsed: null }) })
    );
  });
});
