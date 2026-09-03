import type { TemplateDocumentKind, TemplateStage } from "@eoda/database";
import { toSafeFilenameSegment } from "@/lib/security/upload-validation-service";

// ─────────────────────────────────────────────────────────────────────────────
// BIBLIOTHÈQUE DE MODÈLES EODA — règles pures.
//
// Les gabarits du cabinet : versions vierges, versions reçues, versions produites.
// Rien ici n'appartient à un établissement (cf. schema.prisma, section Bibliothèque).
//
// Ce fichier ne fait que trois choses : nommer les stades, normaliser et contrôler un
// libellé de version, et construire une clé de stockage. Ni Prisma, ni React.
// ─────────────────────────────────────────────────────────────────────────────

export const TEMPLATE_STAGE_LABELS: Record<TemplateStage, string> = {
  VIERGE: "Version vierge",
  INITIALE: "Version initiale",
  FINALE: "Version finale",
};

// Ce que chaque stade veut dire, affiché à côté du choix. Trois mots qui se
// ressemblent et dont l'ordre n'est pas évident : sans explication, la bibliothèque
// se remplit de fichiers rangés au hasard, et c'est précisément la comparaison entre
// l'état reçu et le résultat produit qui donnera sa valeur à l'entraînement de l'IA.
export const TEMPLATE_STAGE_HINTS: Record<TemplateStage, string> = {
  VIERGE: "Le gabarit sans données, réutilisable pour une nouvelle structure.",
  INITIALE: "L'état reçu de la structure, avant intervention.",
  FINALE: "La version produite par EODA, celle qui est restituée.",
};

// Ordre d'affichage : celui du cycle de production, pas l'ordre alphabétique.
export const TEMPLATE_STAGES: readonly TemplateStage[] = ["VIERGE", "INITIALE", "FINALE"];

// ── Les dossiers ─────────────────────────────────────────────────────────────
//
// La catégorie n'est plus l'enum `DocumentCategory` mais un dossier créé à la main
// (`TemplateCategory`) : « il faudrait que tu puisses au moins rajouter toi-même à la
// main » (call du 03/09). Sandrine rangeait un gabarit dans « Phase 0 — prise de
// contact », qui est une étape de son mode opératoire et n'existe dans aucun
// référentiel. `DocumentCategory` classe les pièces ATTENDUES d'une structure au
// regard de la loi 2002-2 : elle ne s'invente pas, et elle n'a rien à faire ici.
//
// Les quatre libellés de l'ancien enum restent les dossiers de départ : c'est ce que
// la migration crée pour chaque cabinet, et rien d'autre ne s'y réfère.
export const DEFAULT_TEMPLATE_CATEGORIES: readonly string[] = [
  "Loi 2002-2",
  "Fonctionnement de la structure",
  "Qualité et gestion des risques",
  "Ressources humaines",
];

export const MAX_CATEGORY_NAME_LENGTH = 80;

// Un nom de dossier se normalise avant d'être comparé : « Phase 4 » et « phase 4  »
// sont le même dossier, et deux dossiers qui ne diffèrent que par une espace finale
// sont un rangement qui a déjà commencé à diverger.
export function normaliseCategoryName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function categoryNameError(value: string): string | null {
  if (value.length === 0) return "Le nom du dossier est obligatoire.";
  if (value.length > MAX_CATEGORY_NAME_LENGTH) {
    return `Le nom du dossier ne peut pas dépasser ${MAX_CATEGORY_NAME_LENGTH} caractères.`;
  }
  return null;
}

// Deux noms désignent le même dossier s'ils ne diffèrent que par la casse ou les
// accents. Comparer sans cette normalisation laisserait coexister « Qualité » et
// « qualite », c'est-à-dire deux dossiers pour une seule idée.
export function categoryNameKey(name: string): string {
  // Même repli que la détection de stade (`foldForSearch`, plus bas) : une seule
  // façon d'ignorer la casse et les accents dans ce fichier, sinon les deux
  // finissent par diverger sur un caractère.
  return foldForSearch(normaliseCategoryName(name));
}

// ── Nature d'une fiche ───────────────────────────────────────────────────────
//
// « Le manuel HAS y sera, et lui n'aura pas forcément plusieurs versions » (call du
// 03/09). Un document qu'EODA ne produit pas n'a pas de stade : lui demander s'il est
// « vierge, initial ou final » n'a pas de réponse, et une question sans réponse est
// ce qui fait qu'on ne dépose pas le fichier.
export const TEMPLATE_KIND_LABELS: Record<TemplateDocumentKind, string> = {
  GABARIT: "Gabarit EODA",
  REFERENCE: "Document de référence",
};

export const TEMPLATE_KIND_HINTS: Record<TemplateDocumentKind, string> = {
  GABARIT:
    "Un document que vous produisez : il a une version vierge, l'état reçu de la structure, et la version restituée.",
  REFERENCE:
    "Un document que vous ne produisez pas — manuel HAS, texte réglementaire, grille Synaé. Un ou plusieurs fichiers, sans stade ni numéro de version imposé.",
};

export const TEMPLATE_KINDS: readonly TemplateDocumentKind[] = ["GABARIT", "REFERENCE"];

// ── Libellé de version ───────────────────────────────────────────────────────
//
// C'est la consultante qui décide de la portée d'un changement — « une version 1.2,
// une version 1.3 ». Un compteur automatique ne saurait pas distinguer l'ajout d'un
// article de loi d'une refonte complète.
//
// On ne contrôle donc que la FORME : quelque chose qui ressemble à un numéro de
// version. Sans ce contrôle, la bibliothèque mélangerait « v1.2 », « version 1.2 »,
// « 1.2 » et « V1.2 » pour le même fichier, et le tri comme la contrainte d'unicité
// cesseraient de vouloir dire quelque chose.
const VERSION_PATTERN = /^v\d+(\.\d+)*$/;

export function normaliseVersionLabel(raw: string): string {
  const compact = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (compact.length === 0) return "";
  // « 1.2 » et « version1.2 » désignent la même chose que « v1.2 » : les accepter
  // évite un refus qui n'apprend rien.
  const withoutWord = compact.replace(/^version/, "");
  return withoutWord.startsWith("v") ? withoutWord : `v${withoutWord}`;
}

export function versionLabelError(value: string): string | null {
  if (value.length === 0) return "Le numéro de version est obligatoire.";
  if (value.length > 20) return "Le numéro de version est trop long.";
  if (!VERSION_PATTERN.test(value)) {
    return "Le numéro de version doit ressembler à « v1 », « v1.2 » ou « v1.2.3 ».";
  }
  return null;
}

// Tri des versions d'un même stade, de la plus récente à la plus ancienne. Comparaison
// SEGMENT PAR SEGMENT et non alphabétique : « v10 » vient après « v9 », alors que le
// tri de chaînes le placerait avant. C'est le genre d'erreur qui ne se voit qu'au
// dixième document, quand il est trop tard pour s'en apercevoir facilement.
export function compareVersionLabelsDesc(a: string, b: string): number {
  const parse = (label: string) => label.replace(/^v/, "").split(".").map((n) => Number(n) || 0);
  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const diff = (right[i] ?? 0) - (left[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// ── Clé de stockage ──────────────────────────────────────────────────────────
//
// Préfixe `modeles/`, distinct de celui des pièces d'un établissement — dont la clé
// commence par un identifiant de structure. Un cuid ne contenant que des lettres et
// des chiffres minuscules, aucune collision n'est possible entre les deux espaces.
//
// Le nom d'origine n'intervient qu'assaini, jamais concaténé tel quel : c'est la même
// règle que pour les documents clients, et pour la même raison — « ../../ » dans un
// nom de fichier échappe au préfixe.
export function buildTemplateStorageKey(params: {
  templateDocumentId: string;
  // `null` pour un document de référence : il n'a pas de stade (cf. `TemplateStage`).
  stage: TemplateStage | null;
  versionLabel: string | null;
  originalFilename: string;
  timestamp: number;
}): string {
  const { templateDocumentId, stage, versionLabel, originalFilename, timestamp } = params;
  const safeName = toSafeFilenameSegment(originalFilename);
  const safeLabel = toSafeFilenameSegment(versionLabel ?? "sans-version");
  return `modeles/${templateDocumentId}/${stage ?? "REFERENCE"}-${safeLabel}-${timestamp}-${safeName}`;
}

// ── Nom du fichier remis ─────────────────────────────────────────────────────
//
// Convention EODA : AAAAMMJJ_TYPE_CLIENT_OBJET_vXX_Interne|Externe.ext. Un modèle n'a
// pas de client — c'est ce qui le distingue d'un livrable — d'où `EODA` en lieu et
// place, et `Interne` : un gabarit de travail ne sort pas du cabinet.
export function templateDownloadFilename(params: {
  title: string;
  stage: TemplateStage | null;
  versionLabel: string | null;
  originalFilename: string;
  createdAt: Date;
}): string {
  const { title, stage, versionLabel, originalFilename, createdAt } = params;
  const yyyy = createdAt.getFullYear();
  const mm = String(createdAt.getMonth() + 1).padStart(2, "0");
  const dd = String(createdAt.getDate()).padStart(2, "0");
  const extension = originalFilename.includes(".")
    ? originalFilename.split(".").pop()
    : "bin";
  const object = toSafeFilenameSegment(title);
  // Un document de référence n'a ni stade ni version : le nom le dit plutôt que de
  // laisser deux « undefined » dans un fichier qui atterrira sur un disque.
  const qualifier = stage === null ? "REFERENCE" : `${stage}_${versionLabel ?? "sv"}`;
  return `${yyyy}${mm}${dd}_MODELE_EODA_${object}_${qualifier}_Interne.${extension}`;
}

// ═════════════════════════════════════════════════════════════════════════════
// IMPORT D'UN DOSSIER
//
// « Il faudrait que l'on puisse mettre des dossiers facilement, et que les fichiers à
// l'intérieur se mettent tout seuls, et que l'on puisse ensuite les réarranger »
// (call du 03/09). Sandrine a une arborescence sur son poste, constituée depuis des
// années. Lui demander de créer une fiche puis de publier une version, cinquante
// fois, revient à lui demander de ne pas s'en servir.
//
// Ce que fait ce module : LIRE une arborescence et PROPOSER un rangement. Il ne
// décide de rien — la proposition est affichée, corrigée à l'écran, et c'est la
// confirmation qui déclenche l'écriture. C'est délibéré : un rangement automatique
// silencieux se découvre trois semaines plus tard, quand la bibliothèque est déjà
// fausse et que plus personne ne sait ce qui a été deviné.
//
// Ces règles sont PURES, donc testées et partagées : la même fonction calcule
// l'aperçu dans le navigateur et n'a pas besoin d'un aller-retour serveur pour
// afficher cinquante lignes.
// ═════════════════════════════════════════════════════════════════════════════

// Au-delà, ce n'est plus un dossier de travail qu'on range, c'est une sauvegarde de
// disque qu'on déverse. La limite est là pour qu'on s'en aperçoive avant, pas après.
export const MAX_IMPORT_FILES = 60;

export type FolderImportEntry = {
  /** `webkitRelativePath` : « Phase 4/Livret d'accueil/livret v1.2 final.docx ». */
  relativePath: string;
  sizeBytes: number;
};

export type FolderImportLine = {
  relativePath: string;
  /** Dossier de destination — le premier segment du chemin. */
  categoryName: string;
  /** Fiche de destination — le dossier immédiat du fichier, sinon son nom. */
  title: string;
  /** `null` = document de référence : pas de stade, pas de numéro de version. */
  stage: TemplateStage | null;
  versionLabel: string | null;
  /**
   * `true` quand le stade vient d'un mot lu dans le chemin, `false` quand il est
   * simplement le choix par défaut. L'écran le dit : une proposition devinée et une
   * proposition par défaut n'appellent pas la même relecture.
   */
  stageDetected: boolean;
};

// Mots qui désignent un stade, cherchés dans le chemin entier — le stade est aussi
// souvent porté par un sous-dossier (« /vierges/ ») que par le nom du fichier.
//
// L'ORDRE compte, et il est celui de la spécificité décroissante : « livret vierge
// v1 final.docx » est d'abord une version vierge. Un fichier ne peut être qu'à un
// seul stade, il faut donc bien trancher quelque part, et trancher au mot le plus
// rare est ce qui se trompe le moins souvent.
const STAGE_KEYWORDS: readonly { stage: TemplateStage; words: readonly string[] }[] = [
  { stage: "VIERGE", words: ["vierge", "gabarit", "trame", "template", "modele", "matrice"] },
  { stage: "FINALE", words: ["final", "conforme", "corrige", "restitu", "livrable", "produit", "def"] },
  { stage: "INITIALE", words: ["initial", "recu", "avant", "brut", "source", "origine", "existant"] },
];

// Comparaison sans accents ni casse : « corrigé », « CORRIGE » et « corrige » sont le
// même mot, et un nom de fichier n'est jamais écrit deux fois pareil.
function foldForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function detectStage(path: string): TemplateStage | null {
  const haystack = foldForSearch(path);
  for (const { stage, words } of STAGE_KEYWORDS) {
    if (words.some((word) => haystack.includes(word))) return stage;
  }
  return null;
}

// Numéro de version lu dans le nom du fichier. Le préfixe `v` (ou « version ») est
// EXIGÉ : sans lui, « Livret d'accueil 2024.docx » deviendrait la version 2024, et le
// tri des versions n'aurait plus aucun sens.
// Le début de mot ne peut PAS s'écrire `\b` : dans « livret_v1_2.docx », le `_` est un
// caractère de mot, il n'y a donc aucune frontière avant le `v` et le numéro passait
// inaperçu — exactement la façon dont beaucoup de fichiers sont nommés.
const VERSION_IN_NAME = /(?:^|[\s._-])v(?:ersion)?[\s._-]*(\d+(?:[._]\d+)*)/i;

export function detectVersionLabel(filename: string): string | null {
  const match = VERSION_IN_NAME.exec(filename);
  if (!match) return null;
  const digits = (match[1] ?? "").replace(/[._]/g, ".");
  const label = normaliseVersionLabel(digits);
  return versionLabelError(label) === null ? label : null;
}

// Le titre de la fiche est le nom du DOSSIER IMMÉDIAT du fichier, et le dossier de
// destination le PREMIER segment. C'est la forme qu'a l'arborescence de Sandrine :
// un dossier par étape de mission, un sous-dossier par document, les versions
// dedans. Quand le fichier est posé directement à la racine, il n'y a pas de
// sous-dossier à lire : c'est son propre nom, privé de son extension, qui nomme la
// fiche — un fichier isolé est un document à lui tout seul.
function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

// Un nom de fichier porte son numéro de version et son stade ; le titre de la fiche,
// lui, doit rester le nom du DOCUMENT — sinon « livret v1 » et « livret v2 » créent
// deux fiches, et l'historique de versions qu'on cherchait à construire n'existe pas.
export function titleFromFilename(filename: string): string {
  const base = stripExtension(filename);
  const withoutVersion = base.replace(new RegExp(VERSION_IN_NAME.source, "gi"), " ");
  const withoutStage = STAGE_KEYWORDS.flatMap((entry) => entry.words).reduce(
    (acc, word) => acc.replace(new RegExp(`\\b${word}\\w*`, "gi"), " "),
    withoutVersion
  );
  const cleaned = withoutStage.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  // Si le nettoyage n'a rien laissé — un fichier nommé « v1 final.docx » — on garde le
  // nom d'origine : une fiche sans titre serait pire qu'une fiche mal titrée.
  return cleaned.length > 0 ? cleaned : base;
}

export function planFolderImport(entries: readonly FolderImportEntry[]): FolderImportLine[] {
  return entries.map((entry) => {
    const segments = entry.relativePath.split("/").filter((segment) => segment.length > 0);
    const filename = segments[segments.length - 1] ?? entry.relativePath;
    const folders = segments.slice(0, -1);

    // Un fichier choisi hors dossier (sélection de fichiers isolés) n'a pas de
    // premier segment : il lui faut quand même un dossier, sinon il n'y a nulle part
    // où le ranger et l'import échouerait à la dernière ligne.
    const rootFolder = folders[0];
    const parentFolder = folders[folders.length - 1];
    const categoryName = rootFolder ? normaliseCategoryName(rootFolder) : "Import sans dossier";
    const title =
      folders.length > 1 && parentFolder
        ? normaliseCategoryName(parentFolder)
        : titleFromFilename(filename);

    const detected = detectStage(entry.relativePath);
    return {
      relativePath: entry.relativePath,
      categoryName,
      title,
      // Par défaut VIERGE, et pas un stade « inconnu » : la bibliothèque a été
      // demandée d'abord pour « uploader les versions vierges » (call du 01/09).
      // Le défaut est donc celui du cas majoritaire, et il est signalé comme tel.
      stage: detected ?? "VIERGE",
      stageDetected: detected !== null,
      versionLabel: detectVersionLabel(filename) ?? "v1",
    };
  });
}

// Deux fichiers qui atterriraient sur la même fiche, au même stade, avec le même
// numéro : c'est le cas normal d'un dossier où « livret final.docx » et
// « livret final (copie).docx » cohabitent. Le second est écarté AVANT tout envoi
// plutôt que refusé par la base au milieu de l'import, quand la moitié est déjà passée.
export function markDuplicateLines(lines: readonly FolderImportLine[]): boolean[] {
  const seen = new Set<string>();
  return lines.map((line) => {
    const key = `${categoryNameKey(line.title)}|${line.stage ?? "REF"}|${line.versionLabel ?? ""}`;
    // Un document de référence peut porter plusieurs fichiers : rien à dédoublonner.
    if (line.stage === null) return false;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
}
