# Préserver et exploiter les images d'un document déposé — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un document `.docx` déposé qui contient des images (photo d'un panneau affiché, organigramme, logo…) ne doit plus polluer le texte envoyé à l'IA (base64 inline, cf. cause de la troncature 42→14 pages constatée le 15/09/2026), doit enrichir l'analyse d'une description de ce que l'image représente, et doit retrouver ses images d'origine, en annexe, dans le document corrigé généré.

**Architecture:** L'extraction sort les images du Markdown au lieu de les y intégrer en base64 ; chacune est stockée séparément et décrite par un modèle de vision (Gemini 3.8 Flash, via OpenRouter — fixe, pas un choix cabinet) ; la description rejoint le contexte d'analyse déjà transmis à l'IA (même mécanisme que `knowledgeExcerpts`/`criterionGuidelines`) ; la génération du brouillon corrigé rattache les images d'origine en annexe du `.docx` produit.

**Tech Stack:** Next.js 14, Prisma/PostgreSQL, mammoth (extraction), `docx` (génération), OpenRouter (vision), Vitest.

**Spec:** Décision prise en conversation (brainstorming architectural, session du 16/09/2026) — pas de fichier de spec séparé, ce plan fait office de référence.

## Global Constraints

- Migration écrite À LA MAIN (jamais `prisma migrate dev`/`diff` sur la base partagée), enregistrée dans `packages/database/src/migrations.ts`, appliquée via `prisma migrate deploy` **seulement après confirmation explicite de Damon**.
- La description d'image est un enrichissement BEST-EFFORT : un échec de l'appel Gemini ne doit jamais bloquer le dépôt du document (même discipline que `extractMarkdown`, qui avale déjà ses erreurs).
- Aucune image ne doit jamais réapparaître en base64 dans un champ texte envoyé à un LLM — c'est exactement le bug corrigé ici.
- Modèle de vision FIXE (`google/gemini-3.8-flash`, cf. `openrouter-models.ts` pour le patron d'appel OpenRouter), jamais exposé au sélecteur cabinet — ce n'est pas un choix éditorial comme les 4 modèles d'analyse, c'est un détail d'implémentation.
- `pnpm typecheck` et `pnpm lint` doivent passer sans avertissement après CHAQUE tâche.

---

### Task D1 : Schéma — `DocumentVersionImage`

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_document_version_images/migration.sql`
- Modify: `packages/database/src/migrations.ts`

**Interfaces:**
- Produces: `DocumentVersion.images: DocumentVersionImage[]`.

- [ ] **Step 1 : Ajouter le modèle**

Dans `schema.prisma`, après `model DocumentVersion { ... }` :
```prisma
// Une image extraite d'un document déposé (photo d'un panneau affiché,
// organigramme, logo…) — jamais réintégrée en base64 dans le texte envoyé à un
// LLM (cf. text-extraction-service.ts). `description` vient d'un modèle de
// vision, best-effort : nulle si l'appel a échoué, jamais bloquant.
model DocumentVersionImage {
  id                String   @id @default(cuid())
  documentVersionId String   @map("document_version_id")
  // Ordre d'apparition dans le document original — c'est cet ordre qui numérote
  // les repères `[Image N]` laissés dans le texte extrait.
  position          Int
  fileStorageKey    String   @map("file_storage_key")
  contentType       String   @map("content_type")
  description       String?
  createdAt         DateTime @default(now()) @map("created_at")

  documentVersion DocumentVersion @relation(fields: [documentVersionId], references: [id], onDelete: Cascade)

  @@index([documentVersionId])
  @@map("document_version_images")
}
```
Sur `model DocumentVersion`, ajouter la relation inverse à côté des champs existants :
```prisma
  images DocumentVersionImage[]
```

- [ ] **Step 2 : Migration écrite à la main**

Dossier nommé après la dernière migration existante (vérifier `ls packages/database/prisma/migrations | tail -1` avant de choisir l'horodatage) :
```sql
-- Images extraites d'un document déposé, stockées à part — jamais réintégrées en
-- base64 dans le texte envoyé à un LLM (cause de la troncature de documents longs
-- constatée le 15/09/2026 : le texte extrait contenait les images du document en
-- base64 inline, ce qui épuisait le budget de caractères envoyé au modèle avant
-- même d'atteindre le vrai contenu textuel).
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026). Application : `prisma migrate deploy`.

CREATE TABLE "document_version_images" (
    "id" TEXT NOT NULL,
    "document_version_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "file_storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_version_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_version_images_document_version_id_idx" ON "document_version_images"("document_version_id");

ALTER TABLE "document_version_images" ADD CONSTRAINT "document_version_images_document_version_id_fkey"
    FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3 : Manifeste + régénération**

Ajouter la ligne du dossier à `EXPECTED_MIGRATIONS` (`packages/database/src/migrations.ts`).

Run: `pnpm --filter @eoda/database generate`
Expected: `✔ Generated Prisma Client` sans erreur.

Run: `cd apps/web && npx vitest run src/lib/db/migration-manifest.test.ts`
Expected: `PASS`

- [ ] **Step 4 : Commit**

```bash
git add packages/database
git commit -m "feat(documents): schéma DocumentVersionImage — images extraites, jamais en base64"
```

**⚠️ Ne PAS exécuter `prisma migrate deploy` avant confirmation explicite de Damon.**

---

### Task D2 : Extraction — sortir les images du Markdown

**Files:**
- Modify: `apps/web/src/lib/services/text-extraction-service.ts`
- Modify: `apps/web/src/lib/services/text-extraction-service.test.ts`

**Interfaces:**
- Produces: `extractMarkdown` retourne désormais `{ markdown: string; images: ExtractedImage[] } | null` au lieu de `string | null`, avec `type ExtractedImage = { position: number; contentType: string; buffer: Buffer }`.
- Consumes: `mammoth.images.imgElement` (API confirmée dans `node_modules/mammoth/lib/index.d.ts`).

Ce changement de signature casse tous les appelants — traités en D4.

- [ ] **Step 1 : Écrire le test qui capture des images sans les inliner**

Dans `text-extraction-service.test.ts`, ajouter (construire un vrai petit .docx de test à la volée avec le paquet `docx`, déjà une dépendance du dépôt) :
```ts
it("sort les images du Markdown au lieu de les inliner en base64", async () => {
  const buffer = await buildDocxWithImage(); // helper à écrire : un .docx minimal avec un paragraphe et une image PNG 1x1
  const result = await extractMarkdown(buffer, DOCX_MIME_TYPE);

  expect(result).not.toBeNull();
  expect(result?.markdown).not.toMatch(/data:image/);
  expect(result?.markdown).toContain("[Image 1]");
  expect(result?.images).toHaveLength(1);
  expect(result?.images[0]?.contentType).toBe("image/png");
});
```

- [ ] **Step 2 : Run le test, vérifier qu'il échoue**

Run: `cd apps/web && npx vitest run src/lib/services/text-extraction-service.test.ts`
Expected: `FAIL`

- [ ] **Step 3 : Implémenter**

Dans `text-extraction-service.ts`, remplacer :
```ts
export type ExtractedImage = { position: number; contentType: string; buffer: Buffer };
export type ExtractionResult = { markdown: string; images: ExtractedImage[] };

export async function extractMarkdown(content: Buffer, mimeType: string): Promise<ExtractionResult | null> {
  try {
    if (mimeType === PDF_MIME_TYPE) {
      const markdown = await extractPdf(content);
      return markdown ? { markdown, images: [] } : null;
    }
    if (mimeType === DOCX_MIME_TYPE) {
      return await extractDocx(content);
    }
    if (mimeType === XLSX_MIME_TYPE) {
      const markdown = await extractXlsx(content);
      return markdown ? { markdown, images: [] } : null;
    }
    return null;
  } catch {
    return null;
  }
}
```
Remplacer `extractDocx` :
```ts
async function extractDocx(content: Buffer): Promise<ExtractionResult | null> {
  const mammoth = await import("mammoth");
  const images: ExtractedImage[] = [];
  let position = 0;

  // Repère `[Image N]` plutôt qu'un <img> en base64 : c'est ce qui évitait jusqu'ici
  // que le texte envoyé à l'IA gonfle d'images entières encodées en base64 — cause
  // constatée de la troncature d'un document long avant même d'atteindre son texte
  // (15/09/2026). L'image elle-même est capturée à part, jamais dans ce texte.
  const imageConverter = mammoth.images.imgElement(async (image) => {
    position += 1;
    const buffer = await image.readAsBuffer();
    images.push({ position, contentType: image.contentType, buffer });
    return { src: `image-placeholder-${position}` };
  });

  const { value: html } = await mammoth.convertToHtml({ buffer: content }, { convertImage: imageConverter });
  const rawMarkdown = turndown.turndown(html);
  // turndown a transformé le <img src="image-placeholder-N"> en `![](image-placeholder-N)` —
  // remplacé ici par un repère texte propre, sans URL ni base64.
  const markdown = rawMarkdown.replace(/!\[[^\]]*\]\(image-placeholder-(\d+)\)/g, "[Image $1]");
  return { markdown: markdown.trim(), images };
}
```

- [ ] **Step 4 : Run le test, vérifier qu'il passe**

Run: `cd apps/web && npx vitest run src/lib/services/text-extraction-service.test.ts`
Expected: `PASS`

- [ ] **Step 5 : Vérifier**

Run: `pnpm --filter @eoda/web typecheck`
Expected: des erreurs dans `document-ingestion-service.ts`, `document-generation-service.ts` et leurs tests (appelants de `extractMarkdown` avec l'ancienne signature `string | null`) — **attendu à ce stade**, traité en D4. Ne pas chercher à tout faire passer avant D4.

- [ ] **Step 6 : Commit**

```bash
git add apps/web/src/lib/services/text-extraction-service.ts apps/web/src/lib/services/text-extraction-service.test.ts
git commit -m "fix(extraction): les images d'un .docx ne polluent plus le texte envoyé à l'IA"
```

---

### Task D3 : Service de description d'image (Gemini 3.8 Flash)

**Files:**
- Create: `apps/web/src/lib/services/image-vision-service.ts`
- Create: `apps/web/src/lib/services/image-vision-service.test.ts`

**Interfaces:**
- Produces: `describeImage(input: { buffer: Buffer; contentType: string }): Promise<string | null>` — `null` sur tout échec (best-effort, jamais bloquant).

- [ ] **Step 1 : Écrire les tests (mock fetch)**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { describeImage } = await import("./image-vision-service");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENROUTER_API_KEY = "test-key";
});

describe("describeImage", () => {
  it("rend la description produite par le modèle", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Un organigramme montrant..." } }] }),
    });

    const result = await describeImage({ buffer: Buffer.from("fake-png"), contentType: "image/png" });

    expect(result).toBe("Un organigramme montrant...");
  });

  it("rend null sans lever d'exception si l'appel échoue", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    const result = await describeImage({ buffer: Buffer.from("fake-png"), contentType: "image/png" });

    expect(result).toBeNull();
  });

  it("rend null si la clé API est absente, sans appeler fetch", async () => {
    delete process.env.OPENROUTER_API_KEY;

    const result = await describeImage({ buffer: Buffer.from("fake-png"), contentType: "image/png" });

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 : Run, vérifier l'échec**

Run: `cd apps/web && npx vitest run src/lib/services/image-vision-service.test.ts`
Expected: `FAIL` — le fichier n'existe pas encore.

- [ ] **Step 3 : Implémenter**

```ts
// Décrit une image extraite d'un document déposé (photo d'un panneau affiché,
// organigramme…) — enrichit le contexte d'analyse documentaire (demande de Damon,
// 16/09/2026). Modèle FIXE, jamais exposé au sélecteur cabinet (contrairement aux
// 4 modèles d'analyse dans openrouter-models.ts) : ce n'est pas un choix éditorial,
// c'est un détail d'implémentation. google/gemini-3.8-flash : le moins cher des
// modèles Gemini récents avec entrée image, vérifié sur openrouter.ai/google le
// 16/09/2026.
//
// BEST-EFFORT : toute erreur (réseau, clé absente, réponse inattendue) rend `null`
// plutôt que de lever — décrire une image est un enrichissement, jamais un
// préalable au dépôt du document (même discipline que extractMarkdown).
const VISION_MODEL = "google/gemini-3.8-flash";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

type OpenRouterVisionResponse = {
  choices?: { message?: { content?: string } | null }[];
};

export async function describeImage(input: {
  buffer: Buffer;
  contentType: string;
}): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  try {
    const base64 = input.buffer.toString("base64");
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://eoda-conseil.com",
        "X-Title": "EODA Conseil - Description d'image",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Décris en 2-3 phrases ce que représente cette image (photo d'un panneau affiché, organigramme, logo...), pour donner du contexte à une analyse documentaire. Reste factuel, pas d'interprétation.",
              },
              {
                type: "image_url",
                image_url: { url: `data:${input.contentType};base64,${base64}` },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const body = (await response.json()) as OpenRouterVisionResponse;
    const content = body.choices?.[0]?.message?.content;
    return content && content.trim().length > 0 ? content.trim() : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4 : Run, vérifier le succès**

Run: `cd apps/web && npx vitest run src/lib/services/image-vision-service.test.ts`
Expected: `PASS`

- [ ] **Step 5 : Vérifier + commit**

Run: `pnpm --filter @eoda/web typecheck && pnpm --filter @eoda/web lint`
Expected: `PASS`

```bash
git add apps/web/src/lib/services/image-vision-service.ts apps/web/src/lib/services/image-vision-service.test.ts
git commit -m "feat(analyse-ia): décrit les images extraites d'un document via Gemini 3.8 Flash"
```

---

### Task D4 : Ingestion — stocker les images, lancer leur description

**Files:**
- Modify: `apps/web/src/lib/services/document-ingestion-service.ts`
- Modify: `apps/web/src/lib/services/document-generation-service.ts` (site d'appel de `extractMarkdown`, si présent — vérifier par grep avant d'éditer)
- Modify: `apps/web/src/lib/actions/document.ts` (site(s) d'appel de `extractMarkdown` — vérifier par grep)
- Test: fichiers de test existants de ces modules

**Interfaces:**
- Consumes: `extractMarkdown` (D2, nouvelle signature), `describeImage` (D3).

- [ ] **Step 1 : Recenser tous les appelants de `extractMarkdown`**

Run: `grep -rn "extractMarkdown(" apps/web/src --include="*.ts" | grep -v test`
Mettre à jour CHAQUE site trouvé pour déstructurer `{ markdown, images }` au lieu d'une chaîne — la plupart stockaient directement le retour dans `extractedText`, qui devient `markdown`.

- [ ] **Step 2 : Stocker les images après ingestion d'une version**

Dans `document-ingestion-service.ts`, après la création de `documentVersion` (avant le `if (!analysable)` existant), ajouter :
```ts
// Stockage best-effort : une image qui échoue à se décrire ou à s'uploader ne doit
// jamais faire échouer le dépôt du document lui-même — c'est un enrichissement.
if (extraction.images.length > 0) {
  await Promise.all(
    extraction.images.map(async (image) => {
      try {
        const key = buildDocumentImageStorageKey({
          establishmentId: input.establishmentId,
          documentTypeId: input.documentTypeId,
          versionNumber,
          timestamp: Date.now(),
          position: image.position,
        });
        await ports.storage.upload(key, image.buffer, image.contentType);
        const description = await describeImage({
          buffer: image.buffer,
          contentType: image.contentType,
        });
        await prisma.documentVersionImage.create({
          data: {
            documentVersionId: version.id,
            position: image.position,
            fileStorageKey: key,
            contentType: image.contentType,
            description,
          },
        });
      } catch {
        // Best-effort : une image perdue n'empêche pas les autres, ni le dépôt.
      }
    })
  );
}
```
Ajouter `buildDocumentImageStorageKey` dans `upload-validation-service.ts`, à côté de `buildStorageKey` :
```ts
export function buildDocumentImageStorageKey(params: {
  establishmentId: string;
  documentTypeId: string;
  versionNumber: number;
  timestamp: number;
  position: number;
}): string {
  const { establishmentId, documentTypeId, versionNumber, timestamp, position } = params;
  return `${establishmentId}/${documentTypeId}/v${versionNumber}-${timestamp}-images/image-${position}`;
}
```
Importer `describeImage` et `buildDocumentImageStorageKey` en tête de fichier ; adapter le type `IngestDocumentInput.extractedText` en gardant son nom actuel (rien ne change côté appelant de `ingestDocumentVersion`, seule l'extraction en amont change).

- [ ] **Step 3 : Adapter les tests existants**

Ces fichiers appellent probablement `extractMarkdown` dans leurs mocks avec l'ancienne forme `string` — les faire renvoyer `{ markdown: "...", images: [] }`. Ajouter un cas :
```ts
it("stocke une image extraite et sa description sans bloquer le dépôt si la description échoue", async () => {
  extractMarkdown.mockResolvedValue({
    markdown: "Texte [Image 1]",
    images: [{ position: 1, contentType: "image/png", buffer: Buffer.from("x") }],
  });
  describeImage.mockResolvedValue(null); // échec de la description, best-effort

  await ingestDocumentVersion(/* ... */);

  expect(prismaMock.documentVersionImage.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ description: null }),
  });
});
```

- [ ] **Step 4 : Vérifier**

Run: `pnpm --filter @eoda/web typecheck && pnpm --filter @eoda/web lint`
Expected: `PASS`

Run: `cd apps/web && npx vitest run`
Expected: `PASS`

- [ ] **Step 5 : Commit**

```bash
git add apps/web/src/lib/services apps/web/src/lib/security/upload-validation-service.ts apps/web/src/lib/actions/document.ts
git commit -m "feat(documents): stocke les images extraites et leur description à l'ingestion"
```

---

### Task D5 : Analyse — les descriptions d'image comme contexte

**Files:**
- Modify: `apps/web/src/lib/llm/llm-analysis-port.ts`
- Modify: `apps/web/src/lib/llm/analysis-prompt.ts`
- Modify: `apps/web/src/lib/services/document-ingestion-service.ts`

**Interfaces:**
- Produces: `DocumentAnalysisInput.imageDescriptions?: string[]` — même patron optionnel que `knowledgeExcerpts`.

- [ ] **Step 1 : Ajouter le champ**

Dans `llm-analysis-port.ts`, sur `DocumentAnalysisInput` :
```ts
  // Ce que les images extraites du document représentent (cf. image-vision-service.ts)
  // — un panneau affiché photographié, un organigramme… Toujours optionnel : sans
  // image, ou si leur description a échoué, l'analyse fonctionne comme avant.
  imageDescriptions?: string[];
```

- [ ] **Step 2 : Injecter dans le prompt**

Dans `analysis-prompt.ts`, `buildUserMessage`, ajouter à côté de `knowledge`/`guidelines` :
```ts
const images =
  input.imageDescriptions && input.imageDescriptions.length > 0
    ? `\nImages présentes dans le document, décrites automatiquement (repères [Image 1], [Image 2]... dans le texte) :\n<images_decrites>\n${input.imageDescriptions.map((d, i) => `Image ${i + 1} : ${d}`).join("\n")}\n</images_decrites>\n`
    : "";
```
Ajouter `${images}` dans le template de retour, au même endroit que `${knowledge}${guidelines}`.

- [ ] **Step 3 : Passer les descriptions depuis l'ingestion**

Dans `document-ingestion-service.ts`, `analyzeVersion`, après avoir stocké les images (D4), récupérer leurs descriptions non nulles et les passer à `llm.analyze({ ..., imageDescriptions })`.

- [ ] **Step 4 : Vérifier + commit**

Run: `pnpm --filter @eoda/web typecheck && pnpm --filter @eoda/web lint && cd apps/web && npx vitest run`
Expected: `PASS`

```bash
git add apps/web/src/lib/llm apps/web/src/lib/services/document-ingestion-service.ts
git commit -m "feat(analyse-ia): les descriptions d'image enrichissent le contexte d'analyse"
```

---

### Task D6 : Génération — images d'origine en annexe du .docx

**Files:**
- Modify: `apps/web/package.json` (ajouter `image-size`)
- Modify: `apps/web/src/lib/services/document-generation-service.ts`
- Modify: `apps/web/src/lib/services/markdown-to-docx-service.ts`
- Modify: `apps/web/src/lib/services/markdown-to-docx-service.test.ts`

**Interfaces:**
- Produces: la fonction exportée de génération de docx (vérifier son nom exact dans le fichier avant d'éditer) accepte un paramètre optionnel `images?: { buffer: Buffer; contentType: string; description: string | null }[]`, ajoutées en une section "Annexes" après le corps du document.

- [ ] **Step 1 : Ajouter la dépendance**

Run: `pnpm --filter @eoda/web add image-size`
Expected: `pnpm-lock.yaml` mis à jour, installation réussie.

- [ ] **Step 2 : Étendre `markdown-to-docx-service.ts`**

Lire le fichier en entier avant d'éditer (174 lignes, déjà lu une fois cette session) pour reprendre le nom exact de la fonction exportée et son option existante. Ajouter :
```ts
import { imageSize } from "image-size";
import { ImageRun } from "docx";

const MAX_IMAGE_WIDTH = 500;
const DOCX_IMAGE_TYPES: Record<string, "jpg" | "png" | "gif" | "bmp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/bmp": "bmp",
};

// Annexe des images d'origine, jamais réintégrées dans le flux du texte généré
// (repositionner une image à sa place exacte dans un document réécrit par l'IA
// serait fragile — V1 volontairement plus simple : toutes les images d'origine,
// groupées à la fin, chacune légendée par ce qu'elle représente).
function buildImageAnnexParagraphs(
  images: { buffer: Buffer; contentType: string; description: string | null }[]
): Paragraph[] {
  if (images.length === 0) return [];

  const paragraphs: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun("Annexes — images du document d'origine")],
    }),
  ];

  for (const [index, image] of images.entries()) {
    const type = DOCX_IMAGE_TYPES[image.contentType];
    if (!type) continue; // format non supporté par docx (svg, webp...) — ignoré, jamais bloquant.

    let width = MAX_IMAGE_WIDTH;
    let height = MAX_IMAGE_WIDTH;
    try {
      const dimensions = imageSize(image.buffer);
      if (dimensions.width && dimensions.height) {
        const scale = Math.min(1, MAX_IMAGE_WIDTH / dimensions.width);
        width = Math.round(dimensions.width * scale);
        height = Math.round(dimensions.height * scale);
      }
    } catch {
      // Dimensions illisibles : on garde le carré par défaut plutôt que d'échouer.
    }

    paragraphs.push(
      new Paragraph({
        children: [new ImageRun({ type, data: image.buffer, transformation: { width, height } })],
      })
    );
    if (image.description) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: `Image ${index + 1} — ${image.description}`, italics: true, size: 18 })],
        })
      );
    }
  }

  return paragraphs;
}
```
Brancher `buildImageAnnexParagraphs(images)` à la fin de la liste de `children` du corps du document, dans la fonction exportée principale (paramètre `images` ajouté à sa signature, défaut `[]`).

- [ ] **Step 3 : Test**

```ts
it("ajoute les images d'origine en annexe, légendées par leur description", async () => {
  const buffer = await buildEodaDocx({
    // ... arguments existants du test déjà en place, repris tels quels
    images: [
      { buffer: Buffer.from(PNG_1X1_BASE64, "base64"), contentType: "image/png", description: "Un logo." },
    ],
  });
  // Un .docx est un zip : vérifier au minimum que la génération ne lève pas et que
  // le buffer produit est non vide — un test de rendu pixel exact serait fragile.
  expect(buffer.length).toBeGreaterThan(0);
});

it("ignore silencieusement un format d'image non supporté par docx", async () => {
  const buffer = await buildEodaDocx({
    images: [{ buffer: Buffer.from("x"), contentType: "image/webp", description: null }],
  });
  expect(buffer.length).toBeGreaterThan(0);
});
```
(`PNG_1X1_BASE64` : une constante déjà utilisable — un PNG 1×1 transparent tient en une ligne de base64, à ajouter en tête du fichier de test si absente.)

- [ ] **Step 4 : Brancher depuis `document-generation-service.ts`**

Après génération du markdown par le LLM, charger les images de la version (`prisma.documentVersionImage.findMany({ where: { documentVersionId }, orderBy: { position: "asc" } })`), récupérer leur contenu via le storage port (vérifier si `FileStoragePort` expose une méthode de lecture directe du buffer, sinon en ajouter une `download(key): Promise<Buffer>` au port et aux deux adaptateurs, suivant le même patron que `upload`/`getSignedDownloadUrl`), et les passer à la fonction de génération du docx.

- [ ] **Step 5 : Vérifier**

Run: `pnpm --filter @eoda/web typecheck && pnpm --filter @eoda/web lint`
Expected: `PASS`

Run: `cd apps/web && npx vitest run`
Expected: `PASS`

- [ ] **Step 6 : Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/lib/services/markdown-to-docx-service.ts apps/web/src/lib/services/markdown-to-docx-service.test.ts apps/web/src/lib/services/document-generation-service.ts apps/web/src/lib/storage
git commit -m "feat(documents): le document corrigé généré conserve les images d'origine en annexe"
```

---

## Suivi (hors plan)

- Utiliser un GABARIT lié aux mêmes critères comme structure de base à la génération (au lieu de partir du texte brut) : dépend de vierges effectivement déposées et liées par Sandrine — techniquement débloqué par #7 (`TemplateDocumentCriterion`), pas construit ici.
- Repositionner une image à sa place exacte dans le texte généré plutôt qu'en annexe groupée : plus fragile, volontairement différé.
