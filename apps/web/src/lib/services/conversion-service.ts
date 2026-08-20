import type { CommercialTier, DevisStatus, EstablishmentType, PricingUnit } from "@eoda/database";
import { canTransitionDevis } from "@/lib/services/devis-transition-service";

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSION PROSPECT → CLIENT — décision pure, exécutée ailleurs
//
// « Le parcours à verrouiller en priorité » (context/07-outil-pilotage-missions.md
// §12.4) : prospection → devis → contrat → fiche client AVEC l'offre et les options
// → génération du profil client externe. Tout était en place sauf la charnière :
// `Prospect.establishmentId` se renseignait à la main, et la Mission — qui porte le
// périmètre réellement ouvert au client — se créait séparément. Ce service décide
// de ce que la signature doit produire ; `lib/actions/conversion.ts` l'exécute dans
// une transaction.
//
// Service PUR : ni Prisma, ni session, ni `notFound()`. C'est ce qui rend testables
// les quatre refus qui comptent — devis d'un autre tenant, double signature,
// prospect déjà converti, type d'établissement manquant — sans base de données.
//
// Ce qu'il ne décide PAS, volontairement :
//   - le périmètre ouvert au client : c'est `offer-scope-service`, qui le dérive
//     déjà de Mission.formule/gratuit. « Générer le profil » = créer la bonne
//     Mission, pas construire un second mécanisme ;
//   - le cloisonnement : c'est `lib/auth/guards.ts`, couche unique.
// ─────────────────────────────────────────────────────────────────────────────

// Motifs de refus. Un motif = un message ; on ne fusionne pas « déjà converti » et
// « statut non signable », qui n'appellent pas la même conduite à tenir.
export type ConversionRefusal =
  | "TENANT_MISMATCH"
  | "STATUS_NOT_SIGNABLE"
  | "ALREADY_CONVERTED"
  | "MISSING_ESTABLISHMENT_TYPE";

export type ConversionPlan =
  | { kind: "REFUSED"; reason: ConversionRefusal }
  | {
      kind: "PROCEED";
      // L'établissement n'existe pas encore : le prospect n'a jamais été converti.
      createsEstablishment: boolean;
      // Le prospect avait déjà un établissement mais pas de mission (fiche créée à
      // la main avant cette itération, ou conversion interrompue) : on complète, on
      // ne recrée rien.
      createsMission: boolean;
    };

export type ConversionInput = {
  devisStatus: DevisStatus;
  // Tenant porté par le devis et tenant porté par son prospect. Ils devraient
  // toujours coïncider ; vérifier plutôt que supposer coûte une comparaison, et une
  // divergence signifierait qu'on s'apprête à ouvrir un accès chez un autre cabinet.
  devisTenantId: string;
  prospectTenantId: string;
  // Établissement déjà rattaché au prospect (`Prospect.establishmentId`), s'il existe.
  existingEstablishmentId: string | null;
  // Mission déjà rattachée à cet établissement, s'il existe.
  existingMissionId: string | null;
  // Type de SAD saisi par Sandrine. Non dérivable : `ProspectType` est la forme
  // juridique (association / privé / public), `EstablishmentType` est SAD_AIDE ou
  // SAD_MIXTE. Deux dimensions orthogonales — deviner l'une depuis l'autre
  // produirait un périmètre de critères faux (le 17ᵉ impératif, cf. plus bas).
  establishmentType: EstablishmentType | null;
};

// Le seul chemin vers SIGNE part de ENVOYE (devis-transition-service). Rejouer une
// signature bute donc ici, avant toute écriture : SIGNE → SIGNE n'est pas autorisé.
export function isDevisSignable(status: DevisStatus): boolean {
  return canTransitionDevis(status, "SIGNE");
}

// La signature est la SEULE transition qui produit des effets hors du module
// commercial (un établissement, une mission, un accès client). Elle ne passe donc
// pas par l'action générique de changement de statut : celle-ci ne saurait pas quel
// type de SAD demander, et signerait un devis sans créer le profil qui va avec.
export function isConversionTransition(status: DevisStatus): boolean {
  return status === "SIGNE";
}

export function planConversion(input: ConversionInput): ConversionPlan {
  if (input.devisTenantId !== input.prospectTenantId) {
    return { kind: "REFUSED", reason: "TENANT_MISMATCH" };
  }

  if (!isDevisSignable(input.devisStatus)) {
    return { kind: "REFUSED", reason: "STATUS_NOT_SIGNABLE" };
  }

  // Déjà un établissement ET déjà une mission : le prospect est converti, il n'y a
  // rien à produire. Refus explicite plutôt que succès silencieux — Sandrine doit
  // savoir que son deuxième clic n'a rien fait.
  if (input.existingEstablishmentId !== null && input.existingMissionId !== null) {
    return { kind: "REFUSED", reason: "ALREADY_CONVERTED" };
  }

  const createsEstablishment = input.existingEstablishmentId === null;

  // Le type n'est exigé que quand on CRÉE l'établissement. Compléter une mission
  // manquante sur une fiche existante n'a pas à redemander une information déjà
  // saisie — et surtout pas à l'écraser.
  if (createsEstablishment && input.establishmentType === null) {
    return { kind: "REFUSED", reason: "MISSING_ESTABLISHMENT_TYPE" };
  }

  return { kind: "PROCEED", createsEstablishment, createsMission: true };
}

export const CONVERSION_REFUSAL_MESSAGES: Record<ConversionRefusal, string> = {
  TENANT_MISMATCH: "Ce devis et son prospect n'appartiennent pas au même cabinet.",
  STATUS_NOT_SIGNABLE:
    "Seul un devis au statut Envoyé peut être signé. Un devis déjà signé ne se signe pas deux fois.",
  ALREADY_CONVERTED:
    "Ce prospect est déjà converti : sa fiche établissement et sa mission existent.",
  MISSING_ESTABLISHMENT_TYPE: "Le type de SAD est obligatoire pour créer la fiche établissement.",
};

// ── Le 17ᵉ impératif ─────────────────────────────────────────────────────────
// Un SAD mixte (aide ET soins) se voit opposer le critère impératif 3.6.2 —
// circuit du médicament — que les grilles Synaé actuellement seedées ne contiennent
// pas (gap documenté au Jalon 4 de la roadmap). La plateforme couvrira donc 16
// impératifs sur 17 pour ce client. Ce n'est pas un défaut à masquer : Sandrine doit
// le savoir AU MOMENT où elle coche le type, pas en relisant un rapport.
export function impliesSeventeenthImperatif(type: EstablishmentType): boolean {
  return type === "SAD_MIXTE";
}

export const SEVENTEENTH_IMPERATIF_WARNING =
  "SAD mixte (aide et soins) : le 17ᵉ critère impératif 3.6.2 (circuit du médicament) " +
  "s'applique à cette structure, mais les grilles Synaé chargées dans la plateforme n'en " +
  "couvrent que 16. Ce critère est à traiter hors outil pour ce client.";

// ── Snapshots d'options ──────────────────────────────────────────────────────
// Recopiés du devis vers la mission à la signature. Le devis reste le document
// commercial et ne se réécrit jamais ; la mission porte le périmètre ouvert.

export type OptionSnapshot = {
  catalogueOptionId: string;
  labelSnapshot: string;
  priceSnapshotEuros: number;
  pricingUnitSnapshot: PricingUnit;
  priceMaxSnapshotEuros: number | null;
  minQuantitySnapshot: number | null;
};

export function toMissionOptionSnapshots(
  devisOptions: readonly OptionSnapshot[]
): OptionSnapshot[] {
  return devisOptions.map((option) => ({
    catalogueOptionId: option.catalogueOptionId,
    labelSnapshot: option.labelSnapshot,
    priceSnapshotEuros: option.priceSnapshotEuros,
    pricingUnitSnapshot: option.pricingUnitSnapshot,
    priceMaxSnapshotEuros: option.priceMaxSnapshotEuros,
    minQuantitySnapshot: option.minQuantitySnapshot,
  }));
}

// Résumé non nominatif de ce qu'une signature a produit, destiné au champ `detail`
// du journal d'audit : numéro de devis, formule ouverte, nombre d'options. Aucune
// donnée personnelle — pas le nom de la structure, pas celui du contact
// (CLAUDE.md §5 bis).
export function summariseConversionForAudit(input: {
  devisNumber: string;
  formule: CommercialTier;
  optionCount: number;
}): string {
  return `${input.devisNumber} · ${input.formule} · ${input.optionCount} option(s)`;
}
