# Critères HAS dans l'analyse et la bibliothèque de modèles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire apparaître, par critère HAS, ce qu'une analyse documentaire couvre ou non (analyse IA + rapport de conformité imprimé) ; permettre de rattacher une fiche de la bibliothèque de modèles à des critères HAS et de la retrouver par critère ; permettre de créer plusieurs fiches de modèle en un seul geste.

**Architecture:** Trois sous-projets indépendants, dans l'ordre où ils sont listés ci-dessous (chacun livrable et testable seul) :
- **A** étend le contrat `LLMAnalysisPort` (résultat d'analyse structuré par critère) et le fait apparaître dans le panneau cabinet + le rapport imprimé.
- **B** ajoute une table de liaison `TemplateDocumentCriterion` (même patron que `DocumentTypeCriterion`, déjà en place) et l'UI pour la gérer.
- **C** est une extension mineure du formulaire de création de fiche modèle.

**Tech Stack:** Next.js 14 App Router, Prisma/PostgreSQL, TypeScript strict, Vitest.

**Spec:** Décision prise en conversation (brainstorming bounded/architectural, cf. session du 16/09/2026) — pas de fichier de spec séparé, ce plan fait office de référence.

## Global Constraints

- Migrations écrites À LA MAIN (jamais `prisma migrate dev`/`diff` sur la base partagée) — `CREATE TABLE` ou `ALTER TYPE ... ADD VALUE IF NOT EXISTS`, appliquées via `prisma migrate deploy` uniquement, jamais lancées sans confirmation explicite de Damon.
- Toute migration ajoutée est enregistrée dans `packages/database/src/migrations.ts` (`EXPECTED_MIGRATIONS`), sinon `apps/web/src/lib/db/migration-manifest.test.ts` échoue.
- Pas d'`any`, pas d'échappatoire de typage (`no-explicit-any` en erreur).
- `pnpm typecheck` et `pnpm lint` doivent passer sans avertissement après CHAQUE tâche.
- Un champ optionnel nouveau sur une donnée déjà stockée (`analysisResultJson`) doit rester lisible sur les analyses existantes qui ne l'ont pas — jamais de plantage sur une valeur absente, toujours un repli défensif (`?? []`).
- Style du dépôt : commentaires en français, expliquant le POURQUOI jamais le QUOI ; noms de fichiers/dossiers en français dans l'UI existante.

---

## Partie A — Analyse IA → critère

### Task A1 : Renommer `linkedCriteriaLabels` en `linkedCriteria` (code + libellé)

**Files:**
- Modify: `apps/web/src/lib/llm/llm-analysis-port.ts`
- Modify: `apps/web/src/lib/llm/analysis-prompt.ts`
- Modify: `apps/web/src/lib/services/document-ingestion-service.ts:240-263`
- Modify: `apps/web/src/lib/services/document-generation-service.ts:65-86`

**Interfaces:**
- Produces: `DocumentAnalysisInput.linkedCriteria: { code: string; label: string }[]` (remplace `linkedCriteriaLabels: string[]`) ; même changement sur `DocumentGenerationInput`.
- Consumes (inchangé) : `prisma.documentTypeCriterion.findMany({ include: { criterion: { select: { id: true, code: true, label: true } } } })` — ajouter `code: true` à la sélection existante (elle sélectionne déjà `id`/`label`).

Pas de test unitaire dédié pour ce renommage mécanique — le filet de sécurité est `pnpm typecheck` (chaque site d'appel non mis à jour devient une erreur de compilation) et la suite de tests existante (aucun test ne référence `linkedCriteriaLabels` littéralement, vérifié par grep).

- [ ] **Step 1 : Renommer le champ dans le port**

Dans `llm-analysis-port.ts`, remplacer :
```ts
export type DocumentAnalysisInput = {
  documentTypeLabel: string;
  extractedText: string;
  linkedCriteriaLabels: string[];
  ...
```
par :
```ts
export type LinkedCriterion = { code: string; label: string };

export type DocumentAnalysisInput = {
  documentTypeLabel: string;
  extractedText: string;
  linkedCriteria: LinkedCriterion[];
  ...
```
Faire le même remplacement sur `DocumentGenerationInput` (`linkedCriteriaLabels: string[]` → `linkedCriteria: LinkedCriterion[]`).

- [ ] **Step 2 : Mettre à jour `analysis-prompt.ts`**

Dans `buildUserMessage`, remplacer :
```ts
const criteria =
  input.linkedCriteriaLabels.length > 0
    ? input.linkedCriteriaLabels.join(" ; ")
    : "aucun rattachement connu";
```
par :
```ts
const criteria =
  input.linkedCriteria.length > 0
    ? input.linkedCriteria.map((c) => `${c.code} — ${c.label}`).join(" ; ")
    : "aucun rattachement connu";
```
Faire le même remplacement dans `buildGenerationUserMessage` (même variable locale `criteria`, même transformation).

- [ ] **Step 3 : Mettre à jour `document-ingestion-service.ts`**

Autour de la ligne 240, la sélection existante :
```ts
prisma.documentTypeCriterion.findMany({
  where: { documentTypeId: params.documentTypeId },
  include: { criterion: { select: { id: true, label: true } } },
}),
```
devient :
```ts
prisma.documentTypeCriterion.findMany({
  where: { documentTypeId: params.documentTypeId },
  include: { criterion: { select: { id: true, code: true, label: true } } },
}),
```
Puis, à côté de `criteriaLabels`/`criterionIds` déjà calculés (ne pas les supprimer, `criteriaLabels` sert encore à `fetchKnowledgeExcerpts`), ajouter :
```ts
const linkedCriteriaOption = linkedCriteria.map((c) => ({
  code: c.criterion.code,
  label: c.criterion.label,
}));
```
Enfin, dans l'appel à `llm.analyze(...)`, remplacer `linkedCriteriaLabels: criteriaLabels,` par `linkedCriteria: linkedCriteriaOption,`.

- [ ] **Step 4 : Même changement dans `document-generation-service.ts`**

Autour de la ligne 66-72, la sélection existante :
```ts
prisma.documentTypeCriterion.findMany({
  where: { documentTypeId: version.document.documentTypeId },
  include: { criterion: { select: { label: true, id: true } } },
}),
```
devient :
```ts
prisma.documentTypeCriterion.findMany({
  where: { documentTypeId: version.document.documentTypeId },
  include: { criterion: { select: { label: true, id: true, code: true } } },
}),
```
Ajouter ensuite, à côté de `criteriaLabels`/`criterionIds` existants :
```ts
const linkedCriteriaOption = linkedCriteria.map((c) => ({
  code: c.criterion.code,
  label: c.criterion.label,
}));
```
Et dans l'appel à `llm.generateCorrectedDocument(...)`, remplacer `linkedCriteriaLabels: criteriaLabels,` par `linkedCriteria: linkedCriteriaOption,`.

- [ ] **Step 5 : Vérifier**

Run: `pnpm --filter @eoda/web typecheck`
Expected: `PASS` — tout site d'appel oublié apparaît comme erreur TS2353/TS2741 à cet endroit précis.

Run: `pnpm --filter @eoda/web lint`
Expected: `PASS`

- [ ] **Step 6 : Commit**

```bash
git add apps/web/src/lib/llm/llm-analysis-port.ts apps/web/src/lib/llm/analysis-prompt.ts apps/web/src/lib/services/document-ingestion-service.ts apps/web/src/lib/services/document-generation-service.ts
git commit -m "refactor(llm): linkedCriteriaLabels devient linkedCriteria (code + libellé)"
```

---

### Task A2 : Ajouter `criteriaCoverage` au résultat d'analyse

**Files:**
- Modify: `apps/web/src/lib/llm/llm-analysis-port.ts`
- Modify: `apps/web/src/lib/llm/analysis-prompt.ts`
- Modify: `apps/web/src/lib/llm/anthropic-analysis-adapter.ts`
- Modify: `apps/web/src/lib/llm/openrouter-analysis-adapter.ts`
- Modify: `apps/web/src/lib/llm/stub-analysis-adapter.ts`
- Test: chercher les fichiers de test existants avec `find apps/web/src/lib/llm -iname "*.test.ts"` avant d'écrire ; à défaut de fichier existant pour l'adaptateur ciblé, créer le test au même chemin que l'adaptateur avec le suffixe `.test.ts`

**Interfaces:**
- Consumes : `LinkedCriterion` (Task A1).
- Produces : `DocumentAnalysisResult.criteriaCoverage: CriterionCoverage[]`, avec
  `type CriterionCoverage = { criterionCode: string; criterionLabel: string; status: "couvert" | "partiel" | "absent"; note: string }`.

- [ ] **Step 1 : Ajouter le type et le champ**

Dans `llm-analysis-port.ts`, sous `AnalysisFinding` :
```ts
// Un statut de couverture PAR CRITÈRE rattaché au document (pas un jugement
// global) : « pour le critère 1.1, ça... » (Sandrine, façon dont elle travaille
// elle-même, call du 15/09/2026) — jusqu'ici l'analyse listait des manques sans
// dire à quel critère ils se rattachaient.
export type CriterionCoverage = {
  criterionCode: string;
  criterionLabel: string;
  status: "couvert" | "partiel" | "absent";
  note: string;
};
```
Puis étendre `DocumentAnalysisResult` :
```ts
export type DocumentAnalysisResult = {
  elementsPresents: AnalysisFinding[];
  elementsManquants: string[];
  suggestionsCorrection: string[];
  sembleConforme: boolean;
  // Absent sur les analyses stockées avant cette date (repli `?? []` partout où
  // c'est lu) — jamais un champ requis rétroactivement sur des données existantes.
  criteriaCoverage: CriterionCoverage[];
};
```

- [ ] **Step 2 : Ajouter une fonction défensive `normalizeCriteriaCoverage`**

À côté de `normalizeFindings` (même fichier) :
```ts
// Même défense que normalizeFindings : un modèle qui s'écarte du schéma (chaîne
// au lieu d'objet, statut hors énumération) ne doit jamais faire planter
// l'analyse entière — l'entrée malformée est simplement ignorée.
const VALID_STATUSES = ["couvert", "partiel", "absent"] as const;

export function normalizeCriteriaCoverage(value: unknown): CriterionCoverage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is CriterionCoverage => {
    if (typeof entry !== "object" || entry === null) return false;
    const e = entry as Record<string, unknown>;
    return (
      typeof e.criterionCode === "string" &&
      typeof e.criterionLabel === "string" &&
      typeof e.note === "string" &&
      typeof e.status === "string" &&
      (VALID_STATUSES as readonly string[]).includes(e.status)
    );
  });
}
```

- [ ] **Step 3 : Mettre à jour le prompt d'analyse**

Dans `analysis-prompt.ts`, `buildSystemPrompt()`, ajouter après la puce sur "suggestionsCorrection" :
```
- "criteriaCoverage" contient UNE entrée par critère listé dans "Critères HAS rattachés à
  ce type de document" (jamais plus, jamais moins) : {"criterionCode", "criterionLabel",
  "status", "note"}. "status" vaut "couvert" (le document répond clairement à ce
  critère), "partiel" (des éléments y répondent mais il en manque), ou "absent" (rien
  dans le document ne répond à ce critère). "note" est une phrase courte justifiant le
  statut, en te fondant sur ce que tu as déjà listé dans "elementsPresents"/
  "elementsManquants" — jamais une nouvelle déduction non reliée à ce que tu as
  constaté par ailleurs.
```

- [ ] **Step 4 : Adaptateur Anthropic — schéma + parsing**

Dans `ANALYSIS_SCHEMA` (`anthropic-analysis-adapter.ts`), ajouter à `properties` :
```ts
criteriaCoverage: {
  type: "array",
  items: {
    type: "object",
    properties: {
      criterionCode: { type: "string" },
      criterionLabel: { type: "string" },
      status: { type: "string", enum: ["couvert", "partiel", "absent"] },
      note: { type: "string" },
    },
    required: ["criterionCode", "criterionLabel", "status", "note"],
    additionalProperties: false,
  },
},
```
et ajouter `"criteriaCoverage"` à `required: [...]`.

Dans le `return` de `analyze()`, importer `normalizeCriteriaCoverage` depuis `./llm-analysis-port` et ajouter :
```ts
criteriaCoverage: normalizeCriteriaCoverage(parsed.criteriaCoverage),
```

- [ ] **Step 5 : Adaptateur OpenRouter — instruction + parsing**

Dans `JSON_SCHEMA_INSTRUCTION` (`openrouter-analysis-adapter.ts`), étendre l'exemple JSON avec :
```
  "criteriaCoverage": [
    { "criterionCode": "2.2.7", "criterionLabel": "Le projet de service formalise...", "status": "partiel", "note": "La trame existe mais les modalités de révision annuelle ne sont pas décrites." }
  ],
```
et ajouter une phrase après celle sur `elementsPresents` :
```
"criteriaCoverage" contient une entrée par critère rattaché listé plus haut, ni plus ni
moins — jamais un critère qui n'a pas été transmis, jamais un critère absent de la liste.
```
Dans `analyze()`, importer `normalizeCriteriaCoverage` et l'ajouter au `return` comme à l'étape 4.

- [ ] **Step 6 : Adaptateur Stub**

Dans `stub-analysis-adapter.ts`, ajouter `criteriaCoverage: []` à l'objet retourné par `analyze()`.

- [ ] **Step 7 : Écrire les tests de parsing défensif**

Pour CHAQUE adaptateur testé (Anthropic et OpenRouter — le stub n'a pas de branche à tester), ajouter au fichier de test existant (patron de mock déjà en place dans ce fichier, à reprendre tel quel) :
```ts
it("ignore une entrée de criteriaCoverage malformée sans faire planter l'analyse", async () => {
  // mock de la réponse HTTP/SDK avec criteriaCoverage: [{ criterionCode: "2.2.7" }] (statut manquant)
  const result = await adapter.analyze(input);
  expect(result.criteriaCoverage).toEqual([]);
});

it("retient une entrée de criteriaCoverage bien formée", async () => {
  // mock avec criteriaCoverage: [{ criterionCode: "2.2.7", criterionLabel: "...", status: "partiel", note: "..." }]
  const result = await adapter.analyze(input);
  expect(result.criteriaCoverage).toEqual([
    { criterionCode: "2.2.7", criterionLabel: "...", status: "partiel", note: "..." },
  ]);
});
```

- [ ] **Step 8 : Vérifier**

Run: `pnpm --filter @eoda/web typecheck && pnpm --filter @eoda/web lint`
Expected: `PASS`

Run: `cd apps/web && npx vitest run src/lib/llm`
Expected: `PASS`, y compris les nouveaux tests.

- [ ] **Step 9 : Commit**

```bash
git add apps/web/src/lib/llm
git commit -m "feat(analyse-ia): ajoute la couverture par critère (couvert/partiel/absent)"
```

---

### Task A3 : Faire remonter `criteriaCoverage` dans le rapport de conformité

**Files:**
- Modify: `apps/web/src/lib/services/conformity-report-service.ts`
- Test: `apps/web/src/lib/services/conformity-report-service.test.ts`
- Modify: `apps/web/src/components/documents/ConformityReportPrintable.tsx`
- Modify: `apps/web/src/lib/actions/checklist.ts` (seulement si `getConformityReportData` ne passe pas déjà `item.analysis` tel quel — voir Step 1)

**Interfaces:**
- Consumes : `DocumentAnalysisResult.criteriaCoverage` (Task A2).
- Produces : `ReportLine.criteriaCoverage: CriterionCoverage[]`.

- [ ] **Step 1 : Vérifier `getConformityReportData` dans `checklist.ts`**

Chercher (`grep -n "getConformityReportData" apps/web/src/lib/actions/checklist.ts`) et lire la fonction : si elle construit `ReportSourceItem.analysis` à partir de `item.currentVersion.analysis` directement (type `DocumentAnalysisResult | null`), aucune modification n'est nécessaire ici — le nouveau champ traverse déjà. Ne modifier ce fichier QUE si cette hypothèse est fausse (auquel cas, documenter pourquoi dans le commit).

- [ ] **Step 2 : Écrire le test de `buildReportLine`**

Dans `conformity-report-service.test.ts`, ajouter (reprendre la fonction de fixture déjà présente dans ce fichier pour construire un `ReportSourceItem`) :
```ts
it("porte la couverture par critère jusqu'à la ligne de rapport", () => {
  const item = sourceItem({
    step: "VALIDE",
    analysisReviewedAt: new Date("2026-09-16"),
    analysis: {
      elementsPresents: [],
      elementsManquants: [],
      suggestionsCorrection: [],
      sembleConforme: true,
      criteriaCoverage: [
        { criterionCode: "2.2.7", criterionLabel: "...", status: "partiel", note: "..." },
      ],
    },
  });

  const line = buildReportLine(item);

  expect(line.criteriaCoverage).toEqual([
    { criterionCode: "2.2.7", criterionLabel: "...", status: "partiel", note: "..." },
  ]);
});
```

- [ ] **Step 3 : Run le test, vérifier qu'il échoue**

Run: `cd apps/web && npx vitest run src/lib/services/conformity-report-service.test.ts`
Expected: `FAIL` — `line.criteriaCoverage` est `undefined`.

- [ ] **Step 4 : Implémenter**

Dans `conformity-report-service.ts`, ajouter `criteriaCoverage: CriterionCoverage[]` à `ReportLine` (importer `CriterionCoverage` depuis `@/lib/llm`), et dans `buildReportLine`, ajouter à l'objet retourné pour l'état `"ANALYSE"` :
```ts
criteriaCoverage: item.analysis.criteriaCoverage,
```
et dans le `base` commun (état MANQUANT/EN_RELECTURE) :
```ts
criteriaCoverage: [] as CriterionCoverage[],
```

- [ ] **Step 5 : Run le test, vérifier qu'il passe**

Run: `cd apps/web && npx vitest run src/lib/services/conformity-report-service.test.ts`
Expected: `PASS`

- [ ] **Step 6 : Rendre dans `ConformityReportPrintable.tsx`**

Remplacer le bloc actuel :
```tsx
{line.criteria.length > 0 && (
  <p className="text-xs text-gris-mid">
    Critères HAS rattachés :{" "}
    {line.criteria.map((criterion) => criterion.code).join(", ")}
  </p>
)}
```
par un rendu qui, quand `line.criteriaCoverage.length > 0`, affiche le statut par critère (et retombe sur l'ancien affichage codes-seuls sinon — un document non encore analysé n'a pas de couverture) :
```tsx
{line.criteriaCoverage.length > 0 ? (
  <div className="mt-1 space-y-1">
    <p className="text-xs font-medium uppercase tracking-wide text-gris-mid">
      Couverture par critère HAS
    </p>
    <ul className="space-y-0.5">
      {line.criteriaCoverage.map((c) => (
        <li key={c.criterionCode} className="text-xs">
          <span className="font-medium">{c.criterionCode}</span>
          {" — "}
          <span
            className={
              c.status === "couvert"
                ? "text-vert-ok"
                : c.status === "partiel"
                  ? "text-ambre"
                  : "text-rouge-imp"
            }
          >
            {c.status}
          </span>
          {" : "}
          <span className="text-gris-mid">{c.note}</span>
        </li>
      ))}
    </ul>
  </div>
) : (
  line.criteria.length > 0 && (
    <p className="text-xs text-gris-mid">
      Critères HAS rattachés :{" "}
      {line.criteria.map((criterion) => criterion.code).join(", ")}
    </p>
  )
)}
```

- [ ] **Step 7 : Vérifier**

Run: `pnpm --filter @eoda/web typecheck && pnpm --filter @eoda/web lint`
Expected: `PASS`

Run: `cd apps/web && npx vitest run`
Expected: `PASS` (aucune régression sur la suite complète)

- [ ] **Step 8 : Commit**

```bash
git add apps/web/src/lib/services/conformity-report-service.ts apps/web/src/lib/services/conformity-report-service.test.ts apps/web/src/components/documents/ConformityReportPrintable.tsx
git commit -m "feat(rapport): affiche la couverture par critère HAS, pas seulement les codes rattachés"
```

---

### Task A4 : Rendre `criteriaCoverage` dans le panneau cabinet in-app

**Files:**
- Modify: `apps/web/src/components/checklist/DocumentAnalysisPanel.tsx`

**Interfaces:**
- Consumes : `DocumentAnalysisResult.criteriaCoverage` (déjà dans la prop `analysis` existante — aucun changement de props).

- [ ] **Step 1 : Ajouter une section avant "Éléments attendus non retrouvés"**

Dans le rendu, avant le premier `{summary.missingCount > 0 && (...)}`, ajouter :
```tsx
{analysis.criteriaCoverage.length > 0 && (
  <div>
    <p className="flex items-center gap-1.5 text-xs font-medium text-brun-ancre mb-1">
      <CheckCircle2 className="w-3.5 h-3.5 text-terre" aria-hidden="true" />
      Couverture par critère HAS
    </p>
    <ul className="space-y-1 pl-5">
      {analysis.criteriaCoverage.map((c) => (
        <li key={c.criterionCode} className="text-xs list-disc marker:text-gris-light">
          <span className="font-medium text-brun-ancre">{c.criterionCode}</span>
          {" — "}
          <span
            className={
              c.status === "couvert"
                ? "text-vert-ok"
                : c.status === "partiel"
                  ? "text-ambre"
                  : "text-rouge-imp"
            }
          >
            {c.status}
          </span>
          {" : "}
          <span className="text-gris-mid">{c.note}</span>
        </li>
      ))}
    </ul>
  </div>
)}
```
`CheckCircle2` est déjà importé dans ce fichier (utilisé plus bas pour `saved`). Aucun nouvel import nécessaire.

- [ ] **Step 2 : Vérifier**

Run: `pnpm --filter @eoda/web typecheck && pnpm --filter @eoda/web lint`
Expected: `PASS`

- [ ] **Step 3 : Commit**

```bash
git add apps/web/src/components/checklist/DocumentAnalysisPanel.tsx
git commit -m "feat(analyse-ia): affiche la couverture par critère dans le panneau cabinet"
```

---

## Partie B — Bibliothèque de modèles ↔ critère

### Task B1 : Schéma — table `TemplateDocumentCriterion`

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_template_document_criteria/migration.sql`
- Modify: `packages/database/src/migrations.ts`

**Interfaces:**
- Produces : relation Prisma `TemplateDocument.criteria: TemplateDocumentCriterion[]`, `Criterion.templateDocuments: TemplateDocumentCriterion[]`.

- [ ] **Step 1 : Ajouter le modèle au schéma**

Dans `schema.prisma`, juste après le modèle `DocumentTypeCriterion` (même patron exact) :
```prisma
model TemplateDocumentCriterion {
  templateDocumentId String @map("template_document_id")
  criterionId        String @map("criterion_id")

  templateDocument TemplateDocument @relation(fields: [templateDocumentId], references: [id])
  criterion        Criterion        @relation(fields: [criterionId], references: [id])

  @@id([templateDocumentId, criterionId])
  @@index([criterionId])
  @@map("template_document_criteria")
}
```
Sur `model TemplateDocument`, ajouter la relation inverse à côté de `versions` :
```prisma
  criteria TemplateDocumentCriterion[]
```
Sur `model Criterion`, ajouter à côté de `documentTypes` :
```prisma
  templateDocuments TemplateDocumentCriterion[]
```

- [ ] **Step 2 : Écrire la migration à la main**

Nommer le dossier avec la convention horodatée du dépôt (`YYYYMMDDHHmmss_template_document_criteria` — utiliser l'heure réelle au moment de l'écriture, après la dernière migration existante dans `packages/database/prisma/migrations/`).
```sql
-- Rattache une fiche de la bibliothèque de modèles à des critères HAS — même
-- patron que document_type_criteria, pour la bibliothèque de modèles plutôt que
-- pour les documents attendus du client (demande du 16/09/2026).
--
-- Migration écrite à la main : `prisma migrate dev` / `migrate diff` sont interdits
-- sur ce dépôt (incident du 19/08/2026). Application : `prisma migrate deploy`.

CREATE TABLE "template_document_criteria" (
    "template_document_id" TEXT NOT NULL,
    "criterion_id" TEXT NOT NULL,

    CONSTRAINT "template_document_criteria_pkey" PRIMARY KEY ("template_document_id", "criterion_id")
);

CREATE INDEX "template_document_criteria_criterion_id_idx" ON "template_document_criteria"("criterion_id");

ALTER TABLE "template_document_criteria" ADD CONSTRAINT "template_document_criteria_template_document_id_fkey"
    FOREIGN KEY ("template_document_id") REFERENCES "template_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "template_document_criteria" ADD CONSTRAINT "template_document_criteria_criterion_id_fkey"
    FOREIGN KEY ("criterion_id") REFERENCES "criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```
`ON DELETE CASCADE` : supprimer une fiche modèle (`DeleteTemplateButton` existe déjà en production) ou un critère retire le rattachement plutôt que de bloquer la suppression sur une contrainte.

- [ ] **Step 3 : Enregistrer dans le manifeste**

Ajouter la ligne du nouveau dossier à la fin de `EXPECTED_MIGRATIONS` dans `packages/database/src/migrations.ts`.

- [ ] **Step 4 : Régénérer le client Prisma**

Run: `pnpm --filter @eoda/database generate`
Expected: `✔ Generated Prisma Client` sans erreur — confirme que le schéma est syntaxiquement valide.

- [ ] **Step 5 : Vérifier le manifeste**

Run: `cd apps/web && npx vitest run src/lib/db/migration-manifest.test.ts`
Expected: `PASS`

- [ ] **Step 6 : Commit**

```bash
git add packages/database
git commit -m "feat(modeles): schéma de liaison fiche de modèle <-> critère HAS"
```

**⚠️ Ne PAS exécuter `prisma migrate deploy` avant confirmation explicite de Damon** — même règle que la migration `RESPONSABLE_QUALITE` déjà en attente.

---

### Task B2 : Server actions — lire/écrire les critères d'une fiche

**Files:**
- Modify: `apps/web/src/lib/actions/template-library.ts`
- Test: `apps/web/src/lib/actions/template-library.test.ts` (chercher le fichier existant avec `find apps/web/src/lib/actions -iname "template-library.test.ts"` ; s'il n'existe pas, le créer au même dossier)

**Interfaces:**
- Consumes : `listCriteriaForPicker()` (déjà exporté par `apps/web/src/lib/actions/document.ts`, réutilisé tel quel — D1, ne pas dupliquer cette requête).
- Produces : `TemplateDetail.criteria: { id: string; code: string; label: string }[]` ; `setTemplateCriteria(templateDocumentId: string, criterionIds: string[]): Promise<{ error: string } | null>`.

- [ ] **Step 1 : Étendre `TemplateDetail` et `getTemplate`**

Ajouter à `TemplateDetail` :
```ts
  criteria: { id: string; code: string; label: string }[];
```
Dans `getTemplate`, ajouter `criteria: { include: { criterion: { select: { id: true, code: true, label: true } } } }` à l'`include` de la requête (lire la requête exacte dans le fichier avant d'éditer), et dans l'objet retourné :
```ts
    criteria: template.criteria.map((c) => ({
      id: c.criterion.id,
      code: c.criterion.code,
      label: c.criterion.label,
    })),
```

- [ ] **Step 2 : Écrire le test de refus de `setTemplateCriteria`**

Suivre le patron de mock déjà utilisé dans `apps/web/src/lib/actions/establishment-logo.test.ts` (écrit dans cette même session) pour le style de mock des guards :
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  templateDocument: { findFirst: vi.fn() },
  templateDocumentCriterion: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
};

const requireCabinetAdminSession = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetAdminSession: (...args: []) => requireCabinetAdminSession(...args),
}));

const { setTemplateCriteria } = await import("./template-library");

beforeEach(() => {
  vi.clearAllMocks();
  requireCabinetAdminSession.mockResolvedValue({ tenantId: "tenant-1" });
  prismaMock.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
});

describe("setTemplateCriteria", () => {
  it("refuse une fiche qui n'appartient pas au tenant", async () => {
    prismaMock.templateDocument.findFirst.mockResolvedValue(null);

    const result = await setTemplateCriteria("tpl-1", ["crit-1"]);

    expect(result).toEqual({ error: "Ce modèle n'existe pas." });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("remplace la liste des critères rattachés en une transaction", async () => {
    prismaMock.templateDocument.findFirst.mockResolvedValue({ id: "tpl-1" });

    const result = await setTemplateCriteria("tpl-1", ["crit-1", "crit-2"]);

    expect(result).toBeNull();
    expect(prismaMock.templateDocumentCriterion.deleteMany).toHaveBeenCalledWith({
      where: { templateDocumentId: "tpl-1" },
    });
    expect(prismaMock.templateDocumentCriterion.createMany).toHaveBeenCalledWith({
      data: [
        { templateDocumentId: "tpl-1", criterionId: "crit-1" },
        { templateDocumentId: "tpl-1", criterionId: "crit-2" },
      ],
    });
  });
});
```

- [ ] **Step 3 : Run le test, vérifier qu'il échoue**

Run: `cd apps/web && npx vitest run src/lib/actions/template-library.test.ts`
Expected: `FAIL` — `setTemplateCriteria` n'existe pas encore.

- [ ] **Step 4 : Implémenter `setTemplateCriteria`**

Ajouter à `template-library.ts` :
```ts
// Remplace la liste complète plutôt que d'attacher/détacher un par un : un seul
// appel depuis un sélecteur multiple, cohérent avec la façon dont le formulaire
// soumet "voici la liste actuelle" plutôt qu'une suite d'actions incrémentales.
export async function setTemplateCriteria(
  templateDocumentId: string,
  criterionIds: string[]
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCabinetAdminSession();

  const template = await prisma.templateDocument.findFirst({
    where: { id: templateDocumentId, tenantId },
    select: { id: true },
  });
  if (!template) return { error: "Ce modèle n'existe pas." };

  await prisma.$transaction([
    prisma.templateDocumentCriterion.deleteMany({
      where: { templateDocumentId: template.id },
    }),
    prisma.templateDocumentCriterion.createMany({
      data: criterionIds.map((criterionId) => ({
        templateDocumentId: template.id,
        criterionId,
      })),
    }),
  ]);

  revalidatePath(`${LIBRARY_PATH}/${template.id}`);
  return null;
}
```

- [ ] **Step 5 : Run le test, vérifier qu'il passe**

Run: `cd apps/web && npx vitest run src/lib/actions/template-library.test.ts`
Expected: `PASS`

- [ ] **Step 6 : Vérifier l'ensemble**

Run: `pnpm --filter @eoda/web typecheck && pnpm --filter @eoda/web lint`
Expected: `PASS`

- [ ] **Step 7 : Commit**

```bash
git add apps/web/src/lib/actions/template-library.ts apps/web/src/lib/actions/template-library.test.ts
git commit -m "feat(modeles): action setTemplateCriteria + critères dans TemplateDetail"
```

---

### Task B3 : UI — rattacher des critères sur la fiche modèle

**Files:**
- Create: `apps/web/src/components/modeles/TemplateCriteriaPicker.tsx`
- Modify: `apps/web/src/app/dashboard/cabinet/modeles/[id]/page.tsx`

**Interfaces:**
- Consumes : `listCriteriaForPicker()` (`@/lib/actions/document`, déjà existant), `setTemplateCriteria` (Task B2), `TemplateDetail.criteria` (Task B2).

- [ ] **Step 1 : Écrire le composant**

```tsx
"use client";

import { useState, useTransition } from "react";
import { setTemplateCriteria } from "@/lib/actions/template-library";
import type { CriterionOption } from "@/lib/actions/document";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

// Un <select multiple> natif est illisible au-delà d'une vingtaine d'options — la
// bibliothèque en a 157. Filtre texte + cases à cocher, même palette EODA que le
// reste des formulaires du dépôt.
export function TemplateCriteriaPicker({
  templateId,
  allCriteria,
  initialSelected,
}: {
  templateId: string;
  allCriteria: CriterionOption[];
  initialSelected: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [filter, setFilter] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const filtered = allCriteria.filter((c) =>
    `${c.code} ${c.label}`.toLowerCase().includes(filter.toLowerCase())
  );

  function toggle(id: string) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setTemplateCriteria(templateId, [...selected]);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="space-y-2">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrer par code ou intitulé…"
        aria-label="Filtrer les critères HAS"
      />
      <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-gris-light p-2">
        {filtered.map((c) => (
          <li key={c.id}>
            <label className="flex items-start gap-2 text-xs text-brun-ancre">
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">{c.code}</span> — {c.label}
              </span>
            </label>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="text-xs text-gris-mid">Aucun critère ne correspond au filtre.</li>
        )}
      </ul>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          Enregistrer les critères rattachés
        </Button>
        <span className="text-xs text-gris-mid">{selected.size} sélectionné(s)</span>
      </div>
      {saved && (
        <p role="status" className="flex items-center gap-1.5 text-xs text-vert-ok">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          Critères enregistrés.
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-rouge-imp">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Brancher sur la page de la fiche**

Ouvrir `apps/web/src/app/dashboard/cabinet/modeles/[id]/page.tsx`, repérer où `getTemplate` est appelé et où la page structure ses sections (`Card`/`CardHeader`/`CardContent`, cohérent avec le reste du dépôt — lire le fichier avant d'éditer pour reprendre le même style). Importer `listCriteriaForPicker` depuis `@/lib/actions/document` et `TemplateCriteriaPicker`, appeler `listCriteriaForPicker()` en parallèle de `getTemplate` (`Promise.all`, P2), et ajouter une section :
```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-base">Critères HAS rattachés</CardTitle>
    <CardDescription>
      Pour retrouver ce modèle en cherchant par critère, et pour que l&apos;analyse
      documentaire s&apos;appuie dessus.
    </CardDescription>
  </CardHeader>
  <CardContent>
    <TemplateCriteriaPicker
      templateId={template.id}
      allCriteria={allCriteria ?? []}
      initialSelected={template.criteria.map((c) => c.id)}
    />
  </CardContent>
</Card>
```

- [ ] **Step 3 : Vérifier**

Run: `pnpm --filter @eoda/web typecheck && pnpm --filter @eoda/web lint`
Expected: `PASS`

- [ ] **Step 4 : Commit**

```bash
git add apps/web/src/components/modeles/TemplateCriteriaPicker.tsx "apps/web/src/app/dashboard/cabinet/modeles/[id]/page.tsx"
git commit -m "feat(modeles): rattacher une fiche de modèle à des critères HAS"
```

---

### Task B4 : UI — filtrer la bibliothèque par critère

**Files:**
- Modify: `apps/web/src/lib/actions/template-library.ts` (fonction qui charge la liste des catégories/fiches — chercher son nom exact autour de la ligne 240-260)
- Modify: `apps/web/src/app/dashboard/cabinet/modeles/page.tsx`

**Interfaces:**
- Consumes : `listCriteriaForPicker()`.

- [ ] **Step 1 : Ajouter un paramètre de filtre optionnel à la requête de liste**

Lire la fonction qui construit la liste des catégories avec leurs fiches, et lui ajouter un paramètre optionnel `criterionId?: string`. Quand fourni, ajouter à la clause `where` de la requête des `templateDocument` :
```ts
...(criterionId ? { criteria: { some: { criterionId } } } : {}),
```

- [ ] **Step 2 : Ajouter un sélecteur de critère à la page liste**

Sur `apps/web/src/app/dashboard/cabinet/modeles/page.tsx`, lire `searchParams` (`?critere=<id>`), appeler `listCriteriaForPicker()` en plus des catégories, et ajouter un `<select>` simple (même patron que le `<select>` de `AnalysisGuidelines` dans `DocumentAnalysisPanel.tsx` — pas de composant dédié pour un simple filtre) qui navigue vers `?critere=<id>` au changement. Chercher un exemple existant de filtre par query param dans ce dépôt (`grep -rn "searchParams" apps/web/src/app/dashboard/cabinet/commercial`) avant d'inventer un patron.

- [ ] **Step 3 : Vérifier**

Run: `pnpm --filter @eoda/web typecheck && pnpm --filter @eoda/web lint`
Expected: `PASS`

- [ ] **Step 4 : Commit**

```bash
git add apps/web/src/lib/actions/template-library.ts apps/web/src/app/dashboard/cabinet/modeles/page.tsx
git commit -m "feat(modeles): filtrer la bibliothèque de modèles par critère HAS"
```

---

## Partie C — Créer plusieurs fiches modèle d'un coup

### Task C1 : `createTemplate` accepte plusieurs titres

**Files:**
- Modify: `apps/web/src/lib/actions/template-library.ts`
- Modify: `apps/web/src/components/modeles/TemplateForm.tsx`
- Test: `apps/web/src/lib/actions/template-library.test.ts` (créé en Task B2 — y ajouter les cas suivants)

**Interfaces:**
- Produces : `createTemplate` accepte un champ `titles` (un titre par ligne) à la place de `title`.

- [ ] **Step 1 : Écrire les tests**

```ts
describe("createTemplate — plusieurs titres", () => {
  it("crée une seule fiche et redirige vers sa page quand un seul titre est saisi", async () => {
    // reprendre le mock déjà en place dans ce fichier pour prisma.templateCategory.findFirst
    // et prisma.templateDocument.findFirst/create ; vérifier que redirect() est appelé
    // avec `${LIBRARY_PATH}/<id de la fiche créée>`
  });

  it("crée une fiche par ligne non vide quand plusieurs titres sont collés", async () => {
    // formData.set("titles", "Livret d'accueil\nRèglement de fonctionnement\n\n")
    // vérifier prisma.templateDocument.create appelé deux fois (lignes vides ignorées)
    // et que redirect() pointe vers LIBRARY_PATH (la liste), pas une fiche précise
  });

  it("refuse si un des titres est déjà pris, sans créer les autres", async () => {
    // prisma.templateDocument.findFirst renvoie un existant pour le 2e titre
    // vérifier le message d'erreur nomme le titre en cause, et qu'aucun create
    // n'a eu lieu pour les titres suivants (arrêt au premier conflit)
  });
});
```
(Suivre exactement le patron de mock déjà en place dans ce fichier de test pour `prisma.templateCategory`/`prisma.templateDocument`, établi en Task B2.)

- [ ] **Step 2 : Run les tests, vérifier qu'ils échouent**

Run: `cd apps/web && npx vitest run src/lib/actions/template-library.test.ts`
Expected: `FAIL`

- [ ] **Step 3 : Implémenter**

Remplacer la lecture de `title` dans `createTemplate` :
```ts
const titlesRaw = requiredString(formData, "titles", "Le(s) titre(s) du modèle", 4000);
```
Après validation de `titlesRaw`/`categoryId`/`kind`/`description` (même bloc `firstError` qu'aujourd'hui), découper :
```ts
const titles = titlesRaw.value
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

if (titles.length === 0) return { error: "Au moins un titre est requis." };
```
Remplacer le bloc de création unique par une boucle SÉQUENTIELLE (jamais `Promise.all` — un titre en double doit être détecté avant d'écrire le suivant) :
```ts
const createdIds: string[] = [];
for (const title of titles) {
  const existing = await prisma.templateDocument.findFirst({
    where: { tenantId, title },
    select: { id: true },
  });
  if (existing) {
    return { error: `Un modèle porte déjà le titre « ${title} ».` };
  }

  const template = await prisma.templateDocument.create({
    data: { tenantId, title, categoryId: category.id, kind: kind.value, description: description.value },
    select: { id: true },
  });
  createdIds.push(template.id);
}

revalidatePath(LIBRARY_PATH);
if (createdIds.length === 1) {
  redirect(`${LIBRARY_PATH}/${createdIds[0]}`);
}
redirect(LIBRARY_PATH);
```

- [ ] **Step 4 : Run les tests, vérifier qu'ils passent**

Run: `cd apps/web && npx vitest run src/lib/actions/template-library.test.ts`
Expected: `PASS`

- [ ] **Step 5 : Mettre à jour `TemplateForm.tsx`**

Remplacer le champ `<Input id="title" name="title" .../>` par :
```tsx
<div className="space-y-1.5 sm:col-span-2">
  <Label htmlFor="titles">
    Titre(s) du modèle <span className="text-rouge-imp">*</span>
  </Label>
  <Textarea
    id="titles"
    name="titles"
    rows={3}
    placeholder={"ex : Projet de service\nLivret d'accueil\nRèglement de fonctionnement"}
    required
  />
  <p className="text-xs text-gris-mid">
    Un titre par ligne pour créer plusieurs fiches d&apos;un coup — toutes dans le même
    dossier, de la même nature. Chaque fiche reste à remplir de fichiers ensuite.
  </p>
</div>
```
(`Textarea` déjà importé dans ce fichier. Ajuster la grille `sm:grid-cols-2` existante si le champ titre occupait une seule colonne.)

- [ ] **Step 6 : Vérifier**

Run: `pnpm --filter @eoda/web typecheck && pnpm --filter @eoda/web lint`
Expected: `PASS`

Run: `cd apps/web && npx vitest run`
Expected: `PASS` (suite complète, aucune régression)

- [ ] **Step 7 : Commit**

```bash
git add apps/web/src/lib/actions/template-library.ts apps/web/src/components/modeles/TemplateForm.tsx apps/web/src/lib/actions/template-library.test.ts
git commit -m "feat(modeles): créer plusieurs fiches de modèle en un seul geste"
```

---

## Suivi (hors plan)

- `/impeccable` sur `/dashboard/cabinet/modeles` : passe design séparée, à faire après ce plan, une fois les nouveaux éléments d'UI (sélecteur de critères, filtre, textarea multi-titres) en place à styliser.
- Migration `template_document_criteria` : à déployer via `prisma migrate deploy` seulement après confirmation explicite de Damon (comme la migration `RESPONSABLE_QUALITE` déjà en attente depuis la session précédente).
