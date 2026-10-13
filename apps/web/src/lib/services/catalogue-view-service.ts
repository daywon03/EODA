// Catalogue v2 (maquette « Catalogue », 13/10/2026) — règles d'affichage pures.

// Le contenu d'une offre, en lignes ✓ : la description saisie au catalogue, coupée
// aux retours à la ligne ou aux « · ». Aucun contenu n'est inventé : sans
// description, aucune ligne.
export function splitOfferItems(description: string | null): string[] {
  if (!description) return [];
  return description
    .split(/\r?\n|\s·\s/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function describeStructuresOnOffer(count: number): string {
  if (count === 0) return "Aucune structure sur cette offre";
  return `${count} structure${count > 1 ? "s" : ""} sur cette offre`;
}
