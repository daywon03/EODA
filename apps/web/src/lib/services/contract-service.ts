import type { CommercialTier, PricingUnit } from "@eoda/database";
import { buildEodaFileName } from "./document-naming-service";
import { formatDate } from "./date-format-service";

// ─────────────────────────────────────────────────────────────────────────────
// CONTRAT D'ACCOMPAGNEMENT — « génération de contrat + avenant obligatoire »
// (§12.6, call du 16/08), étape finale du parcours de conversion.
//
// ⚠️ Ce que ce document est, et ce qu'il n'est pas.
//
// Le document contractuel du dépôt reste le DEVIS SIGNÉ (CLAUDE.md §7) : c'est lui
// qui porte les montants fermes, il ne se réécrit jamais, et le contrat ci-dessous
// le RÉCAPITULE sans jamais le contredire. Le contrat existe parce qu'un devis
// signé ne dit pas qui sont les parties, ce que chacune s'engage à faire, ni sous
// quelles réserves — et que Sandrine le réécrivait à la main.
//
// Il ne CRÉE aucune clause de droit nouvelle. Chaque engagement listé est la reprise
// d'une décision déjà écrite dans le dépôt (revue humaine avant restitution : CDC §7 ;
// hébergement UE : CDC §6.1 ; bibliothèque en lecture seule après clôture :
// mission-access-service ; paternité des livrables : document-ownership-service ;
// indépendance conseil/évaluateur : CLAUDE.md §1). Les CONDITIONS GÉNÉRALES DE
// PRESTATION d'EODA — délais de paiement, pénalités, résiliation, litiges — ne sont
// pas dans le dépôt : le contrat renvoie à leur annexe, il ne les invente pas. C'est
// la seule chose qui manque pour que ce document soit autoporteur.
//
// Règles PURES : ni Prisma, ni React.
// ─────────────────────────────────────────────────────────────────────────────

export type ContractOptionLine = {
  labelSnapshot: string;
  priceSnapshotEuros: number;
  pricingUnitSnapshot: PricingUnit;
  priceMaxSnapshotEuros: number | null;
  minQuantitySnapshot: number | null;
  priceIsFirm: boolean;
};

export type ContractFacts = {
  establishmentName: string;
  finessNumber: string | null;
  address: string | null;
  formule: CommercialTier;
  formuleLabel: string;
  modulesLabel: string | null;
  gratuit: boolean;
  options: ContractOptionLine[];
  // Devis signé qui fonde le contrat — absent pour les fiches antérieures à
  // l'entonnoir unique (bêta-test créé à la main).
  devisNumber: string | null;
  signedOn: Date | null;
  totalAmountEuros: number | null;
  depositPercent: number | null;
  depositAmountEuros: number | null;
  balanceAmountEuros: number | null;
  installmentCount: number | null;
  installmentAmountEuros: number | null;
  hasEvaluationTargetDate: Date | null;
};

// Un contrat suppose un accord. Sans devis signé, il n'y a rien à contractualiser :
// produire le document quand même ferait signer un engagement sans montant, ou avec
// des montants « à partir de » présentés comme fermes. Le bêta-test gratuit est le
// seul cas où l'absence de montant est normale, et il a donc son propre droit
// d'exister — sa contrepartie n'est pas financière.
export function canIssueContract(facts: {
  devisNumber: string | null;
  totalAmountEuros: number | null;
  gratuit: boolean;
}): boolean {
  if (facts.gratuit) return true;
  return facts.devisNumber !== null && facts.totalAmountEuros !== null;
}

// Phrase d'objet. Deux formulations : payante, ou bêta-test — annoncer un montant
// nul sur un accompagnement gratuit se lit comme un bug, pas comme une gratuité.
export function describeContractBasis(facts: {
  devisNumber: string | null;
  signedOn: Date | null;
  gratuit: boolean;
}): string {
  if (facts.gratuit && !facts.devisNumber) {
    return (
      "Le présent contrat formalise un accompagnement consenti à titre gracieux, " +
      "dans le cadre du test de la plateforme EODA Conseil."
    );
  }

  if (!facts.devisNumber) {
    return "Le présent contrat formalise l'accompagnement convenu entre les parties.";
  }

  const signature = facts.signedOn ? ` accepté le ${formatDate(facts.signedOn)}` : "";
  return (
    `Le présent contrat reprend et formalise le devis ${facts.devisNumber}${signature}, ` +
    `annexé, qui demeure le document de référence pour les montants et les prestations retenues.`
  );
}

// Les lignes de périmètre : la formule, puis les options FERMES uniquement.
//
// Une option rattachée à la main au périmètre (`priceIsFirm = false`) n'est couverte
// par aucun accord signé — c'est précisément ce que l'avenant régularise
// (avenant-service). La faire entrer au contrat initial reviendrait à faire signer
// un « à partir de » comme un engagement.
export function selectContractOptions<T extends { priceIsFirm: boolean }>(options: T[]): T[] {
  return options.filter((option) => option.priceIsFirm);
}

// Prestations hors contrat, à régulariser par avenant. Le contrat le DIT plutôt que
// de les taire : une option ouverte dans l'outil mais absente du contrat est
// exactement le trou que le §12.6 demande de fermer.
export function countOptionsPendingAvenant(options: { priceIsFirm: boolean }[]): number {
  return options.filter((option) => !option.priceIsFirm).length;
}

// La phrase qui le dit sur le document. Ici et non dans le composant : un accord
// singulier/pluriel écrit en JSX au milieu de balises est illisible, donc faux à la
// première relecture. Rend `null` quand il n'y a rien à signaler — le document ne
// porte alors aucune ligne, plutôt qu'une ligne à zéro.
export function describePendingAvenant(count: number): string | null {
  if (count <= 0) return null;
  if (count === 1) {
    return (
      "Une prestation rattachée au périmètre de la mission ne figure pas au présent " +
      "contrat : elle fait l'objet d'un avenant."
    );
  }
  return (
    `${count} prestations rattachées au périmètre de la mission ne figurent pas au ` +
    "présent contrat : elles font l'objet d'un avenant."
  );
}

// Engagements réciproques — REPRISE de décisions déjà écrites, jamais du droit
// nouveau (cf. en-tête). L'ordre est celui dans lequel Sandrine les explique en
// réunion : ce qu'EODA fait, ce que la structure fournit, puis les réserves.
export type ContractCommitment = { title: string; body: string };

export function buildEodaCommitments(): ContractCommitment[] {
  return [
    {
      title: "Prestation de conseil et de préparation",
      body:
        "EODA Conseil conduit le diagnostic, l'analyse documentaire et l'accompagnement " +
        "prévus au périmètre ci-dessus, en vue de la préparation de la structure à " +
        "l'évaluation qualité HAS.",
    },
    {
      title: "Validation humaine avant toute restitution",
      body:
        "Toute analyse produite automatiquement par la plateforme est relue et validée " +
        "par la consultante avant d'être restituée à la structure. Aucune analyse non " +
        "relue n'est communiquée.",
    },
    {
      title: "Confidentialité et protection des données",
      body:
        "Les documents transmis sont hébergés dans l'Union européenne, accessibles " +
        "uniquement à la structure et à EODA Conseil, et cloisonnés de ceux des autres " +
        "structures accompagnées.",
    },
    {
      title: "Accès à la plateforme après la mission",
      body:
        "À la clôture de l'accompagnement, la structure conserve l'accès en lecture à sa " +
        "bibliothèque de documents. Aucune donnée n'est supprimée du fait de la clôture.",
    },
  ];
}

export function buildStructureCommitments(): ContractCommitment[] {
  return [
    {
      title: "Transmission des pièces",
      body:
        "La structure met à disposition les documents demandés et désigne un " +
        "interlocuteur référent pour la durée de la mission.",
    },
    {
      title: "Responsabilité du contenu remis à la HAS",
      body:
        "Les livrables produits par EODA Conseil sont des documents de préparation. La " +
        "structure reste seule responsable des informations qu'elle déclare et des " +
        "documents qu'elle présente aux évaluateurs.",
    },
  ];
}

// Réserve déontologique. Elle n'est pas négociable et n'est pas une clause de style :
// un organisme évaluateur HAS ne peut pas être conseil du même ESSMS sur le même
// cycle (CLAUDE.md §1). L'écrire au contrat protège la structure autant qu'EODA.
export const CONTRACT_INDEPENDENCE_NOTICE =
  "EODA Conseil intervient en qualité de conseil et de préparation. La présente " +
  "prestation ne constitue pas une évaluation HAS officielle et EODA Conseil " +
  "n'intervient pas comme organisme évaluateur accrédité de la structure sur le cycle " +
  "d'évaluation concerné.";

// Renvoi aux conditions générales. Formulé comme un renvoi et non comme un contenu :
// tant que Sandrine n'a pas fourni ses CGP, le document ne doit pas laisser croire
// qu'il les porte.
export const CONTRACT_GENERAL_TERMS_NOTICE =
  "Les conditions générales de prestation d'EODA Conseil, annexées au présent " +
  "contrat, complètent les stipulations qui précèdent.";

export function buildContractFileName(input: {
  structureName: string;
  issuedOn: Date;
  devisNumber: string | null;
}): string {
  return buildEodaFileName({
    issuedOn: input.issuedOn,
    type: "CONTRAT",
    clientName: input.structureName,
    // L'objet nomme le devis d'origine quand il existe : c'est ce qui permet de
    // rapprocher le contrat de son devis dans un dossier client.
    objet: input.devisNumber ? `Accompagnement-${input.devisNumber}` : "Accompagnement",
    audience: "Externe",
    extension: "pdf",
  });
}

// Identité de la structure en une ligne, telle qu'elle doit figurer en tête de
// contrat. Les champs absents sont OMIS, jamais remplacés par un tiret : un contrat
// qui affiche « FINESS : — » a l'air d'un formulaire mal rempli.
export function describeStructureIdentity(facts: {
  establishmentName: string;
  finessNumber: string | null;
  address: string | null;
}): string {
  const parts = [facts.establishmentName.trim()];
  if (facts.address && facts.address.trim().length > 0) parts.push(facts.address.trim());
  if (facts.finessNumber && facts.finessNumber.trim().length > 0) {
    parts.push(`FINESS ${facts.finessNumber.trim()}`);
  }
  return parts.join(" · ");
}
