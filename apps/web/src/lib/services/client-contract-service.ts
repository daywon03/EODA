import type { DevisStatus, DocumentStatus, PricingUnit } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// CONTRAT VU DU CLIENT — « ce que j'ai payé » / « ce que je dois fournir »
//
// Service PUR : il ne connaît ni Prisma ni la session. Il reçoit des données déjà
// lues et cloisonnées par la couche d'autorisation, et n'en produit que des vues.
// C'est ce qui rend testables les cas de refus qui comptent ici : pas de devis
// signé, plusieurs devis signés, aucune mission.
//
// Exception de cloisonnement autorisée le 20/08/2026 (.claude/CLAUDE.md §7) : un
// client voit SON contrat (offre, options souscrites, montant signé, acompte,
// solde, échéances) et les options NON souscrites avec leur prix « à partir de »
// — jamais le catalogue interne comme surface de gestion, jamais les données d'un
// autre client, jamais le pipeline de prospection ni les KPI commerciaux.
//
// Deux natures de prix cohabitent sur cette page et ne doivent JAMAIS être rendues
// de la même façon (context/07-outil-pilotage-missions.md §12.3) :
//   - les montants du devis signé sont des montants FERMES : c'est un contrat ;
//   - les prix du catalogue sont des « à partir de » : c'est une estimation.
// Le typage encode cette distinction (`FirmAmounts` vs `StartingPricedOption`),
// pour qu'un composant ne puisse pas confondre les deux par inadvertance.
// ─────────────────────────────────────────────────────────────────────────────

// ── Options ──────────────────────────────────────────────────────────────────

// Snapshot d'une option effectivement souscrite, tel que figé sur le devis. Le
// libellé et le prix viennent du devis, jamais du catalogue courant : une
// évolution du catalogue ne doit pas réécrire un contrat déjà signé.
export type SubscribedOption = {
  catalogueOptionId: string;
  labelSnapshot: string;
  priceSnapshotEuros: number;
  pricingUnitSnapshot: PricingUnit;
  priceMaxSnapshotEuros: number | null;
  minQuantitySnapshot: number | null;
  // Le montant ci-dessus fait-il contrat ?
  //
  // true  — il vient d'un devis signé : montant FERME, rendu via formatPriceWithUnit.
  // false — l'option a été rattachée au périmètre par le cabinet sans devis ; le
  //         montant est recopié du catalogue, donc un « à partir de », et doit être
  //         rendu via formatStartingPrice.
  //
  // Porté par la donnée et non par le composant : c'est la seule façon d'empêcher
  // une vue de présenter une estimation comme un engagement (CLAUDE.md §7).
  priceIsFirm: boolean;
};

// Un devis signé est par construction un engagement ferme : les options lues sur le
// devis n'ont pas de drapeau en base, il est posé ici, à la frontière.
export function toFirmSubscribedOption(
  option: Omit<SubscribedOption, "priceIsFirm">
): SubscribedOption {
  return { ...option, priceIsFirm: true };
}

// Options réellement souscrites : la MISSION fait foi, le devis n'est qu'un repli.
//
// Pourquoi cet ordre. Le devis est le document COMMERCIAL — il fait contrat, ses
// snapshots ne se réécrivent jamais. Mais ce qui gouverne le périmètre ouvert au
// client, c'est la mission (CLAUDE.md §7 : la décision contractuelle vit sur
// Mission, jamais sur Establishment.commercialTier). Lire les options sur le devis
// obligeait à remonter Establishment → Prospect → Devis, un chemin qui n'existe pas
// pour un établissement sans prospect rattaché, et qui devient ambigu dès qu'un
// prospect a deux devis signés.
//
// Le repli n'est pas une commodité : une mission créée AVANT cette bascule ne porte
// aucune ligne d'option, et son client doit continuer de voir ce qu'il a acheté. Un
// tableau de mission vide signifie donc « pas encore migré », pas « rien souscrit ».
// La distinction est indécidable ici et c'est assumé : aucune mission convertie
// depuis un devis ne peut avoir zéro option si le devis en portait.
export function resolveSubscribedOptions(input: {
  missionOptions: readonly SubscribedOption[];
  devisOptions: readonly SubscribedOption[];
}): SubscribedOption[] {
  if (input.missionOptions.length > 0) return [...input.missionOptions];
  return [...input.devisOptions];
}

// Ligne de catalogue proposable au client. `priceEuros` est une BORNE BASSE, à
// rendre exclusivement via formatStartingPrice() du price-format-service.
export type CatalogueOptionRow = {
  id: string;
  code: string;
  label: string;
  priceEuros: number;
  pricingUnit: PricingUnit;
  priceMaxEuros: number | null;
  minQuantity: number | null;
};

// État de la demande du client sur une option non souscrite. Aucun de ces états
// n'ouvre un droit : le déblocage passe par un devis puis un avenant (§12.6).
export type OptionRequestState = "NONE" | "PENDING";

export type AvailableOption = CatalogueOptionRow & {
  requestState: OptionRequestState;
};

// ── Devis ────────────────────────────────────────────────────────────────────

// Projection étroite d'un devis, suffisante pour la vue client. Volontairement
// sans le prospect, sans les notes internes et sans rien du pipeline.
export type ClientDevis = {
  id: string;
  number: string;
  status: DevisStatus;
  formuleLabelSnapshot: string;
  formulePriceSnapshotEuros: number;
  depositPercent: number;
  installmentCount: number;
  totalAmountEuros: number;
  depositAmountEuros: number;
  balanceAmountEuros: number;
  installmentAmountEuros: number;
  // Sans `priceIsFirm` : une ligne de devis n'en porte pas en base, et n'en a pas
  // besoin — un devis signé est ferme par construction. Le drapeau est posé à la
  // lecture par toFirmSubscribedOption(). Le type dit donc la vérité de la table.
  options: readonly Omit<SubscribedOption, "priceIsFirm">[];
};

// Résultat de la résolution du contrat. Trois issues, toutes explicites — pas de
// `null` fourre-tout : « aucun devis » et « plusieurs devis signés » n'appellent
// pas le même message, et surtout pas le même degré de confiance.
export type ContractResolution =
  | { kind: "RESOLVED"; devis: ClientDevis }
  | { kind: "NO_DEVIS" }
  | { kind: "AMBIGUOUS"; signedCount: number };

// Un devis ANNULE conserve son numéro mais ne vaut plus contrat (cf. enum
// DevisStatus) : seul SIGNE est retenu ici. Un BROUILLON ou un ENVOYE n'est pas
// un engagement, et un client n'a de toute façon pas à voir un devis non signé.
//
// Plusieurs devis signés = on n'affiche AUCUN montant. Deviner lequel fait foi
// (le plus récent ? le plus cher ?) reviendrait à inventer un contrat.
export function resolveContractDevis(
  devisList: readonly ClientDevis[]
): ContractResolution {
  const signed = devisList.filter((devis) => devis.status === "SIGNE");
  if (signed.length === 0) return { kind: "NO_DEVIS" };
  if (signed.length > 1) return { kind: "AMBIGUOUS", signedCount: signed.length };
  return { kind: "RESOLVED", devis: signed[0]! };
}

// Options du catalogue que le client n'a PAS souscrites, marquées de l'état de sa
// demande éventuelle. Les options déjà au contrat en sont retirées : les proposer
// à la vente une seconde fois serait au mieux confus, au pire une double
// facturation suggérée.
export function listAvailableOptions(input: {
  catalogue: readonly CatalogueOptionRow[];
  subscribed: readonly SubscribedOption[];
  pendingRequestOptionIds: readonly string[];
}): AvailableOption[] {
  const subscribedIds = new Set(input.subscribed.map((option) => option.catalogueOptionId));
  const pendingIds = new Set(input.pendingRequestOptionIds);

  return input.catalogue
    .filter((option) => !subscribedIds.has(option.id))
    .map((option) => ({
      ...option,
      requestState: pendingIds.has(option.id) ? "PENDING" : "NONE",
    }));
}

// Une option déjà au contrat ne peut pas faire l'objet d'une demande de devis.
// Utilisé côté action AVANT écriture : la liste affichée n'est pas une preuve,
// l'action est appelable directement.
export function isOptionSubscribed(
  subscribed: readonly SubscribedOption[],
  catalogueOptionId: string
): boolean {
  return subscribed.some((option) => option.catalogueOptionId === catalogueOptionId);
}

// ── Obligations documentaires (« ce que je dois donner ») ────────────────────

export type DocumentObligation = {
  status: DocumentStatus;
  missingJustification: string | null;
};

export type DocumentObligationSummary = {
  total: number;
  // Attendu et non déposé, sans un mot d'explication : c'est la file d'attente
  // réelle du client.
  toDeposit: number;
  // Non déposé mais commenté (« nous n'avons pas de CVS, voici pourquoi ») — la
  // pièce reste due, mais la balle est côté cabinet pour arbitrer.
  justified: number;
  // Déposé, en cours d'analyse ou à corriger.
  inReview: number;
  compliant: number;
  notApplicable: number;
};

export function summariseDocumentObligations(
  items: readonly DocumentObligation[]
): DocumentObligationSummary {
  const missing = items.filter((item) => item.status === "MISSING");

  return {
    total: items.length,
    toDeposit: missing.filter((item) => item.missingJustification === null).length,
    justified: missing.filter((item) => item.missingJustification !== null).length,
    inReview: items.filter(
      (item) =>
        item.status === "UPLOADED" ||
        item.status === "ANALYZING" ||
        item.status === "INCOMPLETE" ||
        item.status === "EXPIRED"
    ).length,
    compliant: items.filter((item) => item.status === "COMPLIANT").length,
    notApplicable: items.filter((item) => item.status === "NOT_APPLICABLE").length,
  };
}

// Part de pièces conformes, sur le total attendu. Les pièces non applicables
// restent au dénominateur : c'est le total de la checklist affichée au client, et
// une progression qui bouge quand on répond « non concerné » serait trompeuse.
export function documentProgressPercent(summary: DocumentObligationSummary): number {
  if (summary.total === 0) return 0;
  return Math.round((summary.compliant / summary.total) * 100);
}
