// Une cellule CSV sûre — UNE règle pour tous les exports (audit du 28/10/2026 : trois
// copies existaient, et l'export des cotations n'en avait aucune).
//   - Injection de formule : une cellule qui commence par = + - @ (ou tabulation,
//     retour chariot) serait exécutée par Excel comme une formule ; elle est préfixée
//     d'une apostrophe, qu'Excel n'affiche pas.
//   - RFC 4180 avec « ; » : guillemets doublés, et mise entre guillemets dès qu'il y a
//     un séparateur, un guillemet ou un saut de ligne.
export function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
