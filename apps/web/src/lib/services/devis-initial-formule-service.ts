import type { CommercialTier } from "@eoda/database";

// Formule PRÉSÉLECTIONNÉE à l'ouverture du formulaire de devis — pure, testée.
//
// Ordre de priorité :
//   1. un brouillon garde sa formule (y compris « sans offre », valeur `null`) ;
//   2. un nouveau devis reprend la formule envisagée sur la fiche prospect ;
//   3. sinon, la première formule vendue au catalogue.
// Une formule qui n'est plus au catalogue n'est jamais proposée : le devis ne
// pourrait pas être enregistré avec elle.
//
// Ce n'est qu'une valeur proposée : le sélecteur reste libre, et c'est l'admin
// qui choisit l'offre (§12.3) — la formule envisagée documente une conversation.
export function pickInitialFormule(input: {
  formules: ReadonlyArray<{ formule: CommercialTier }>;
  envisagedFormule?: CommercialTier | null;
  // `undefined` = pas de brouillon ; `null` = brouillon enregistré sans offre.
  draftFormule?: CommercialTier | null | undefined;
}): CommercialTier | "" {
  const isSellable = (formule: CommercialTier | null | undefined): formule is CommercialTier =>
    formule !== null && formule !== undefined && input.formules.some((f) => f.formule === formule);
  const firstSellable = input.formules[0]?.formule ?? "";

  if (input.draftFormule !== undefined) {
    if (input.draftFormule === null) return "";
    return isSellable(input.draftFormule) ? input.draftFormule : firstSellable;
  }
  return isSellable(input.envisagedFormule) ? input.envisagedFormule : firstSellable;
}
