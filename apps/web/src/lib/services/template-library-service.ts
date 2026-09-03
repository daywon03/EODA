import type { DocumentCategory, TemplateStage } from "@eoda/database";
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

export const TEMPLATE_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  LOI_2002_2: "Loi 2002-2",
  FONCTIONNEMENT: "Fonctionnement de la structure",
  QUALITE_RISQUES: "Qualité et gestion des risques",
  RH: "Ressources humaines",
};

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
  stage: TemplateStage;
  versionLabel: string;
  originalFilename: string;
  timestamp: number;
}): string {
  const { templateDocumentId, stage, versionLabel, originalFilename, timestamp } = params;
  const safeName = toSafeFilenameSegment(originalFilename);
  const safeLabel = toSafeFilenameSegment(versionLabel);
  return `modeles/${templateDocumentId}/${stage}-${safeLabel}-${timestamp}-${safeName}`;
}

// ── Nom du fichier remis ─────────────────────────────────────────────────────
//
// Convention EODA : AAAAMMJJ_TYPE_CLIENT_OBJET_vXX_Interne|Externe.ext. Un modèle n'a
// pas de client — c'est ce qui le distingue d'un livrable — d'où `EODA` en lieu et
// place, et `Interne` : un gabarit de travail ne sort pas du cabinet.
export function templateDownloadFilename(params: {
  title: string;
  stage: TemplateStage;
  versionLabel: string;
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
  return `${yyyy}${mm}${dd}_MODELE_EODA_${object}_${stage}_${versionLabel}_Interne.${extension}`;
}
