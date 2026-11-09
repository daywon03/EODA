import { ESTABLISHMENT_ONLY_CRITERIA } from "@/content/criteres/hors-perimetre-sad";

// Message unique pour un code de critère absent de la base, partagé par la création
// d'une ligne, l'import d'un tableur et le rattachement à la main (retour du
// 09/11/2026 : « Critère inconnu du référentiel : 2.4.1 » faisait chercher une faute de
// frappe là où le critère existe, mais pas pour un SAD).
//
// Deux familles, jamais confondues :
//  - hors périmètre SAD : code du manuel HAS dont le champ est « Établissement »
//    (content/criteres/hors-perimetre-sad.ts) ;
//  - absent des grilles SAD : tout le reste. Faute de catalogue des 157 critères dans
//    le dépôt, on ne prétend pas qu'il est « inconnu » : on donne les deux pistes.
const OUT_OF_SCOPE_REASON_ONE =
  "critère du manuel HAS réservé aux établissements, qui ne s'applique pas à un service à domicile";
const OUT_OF_SCOPE_REASON_MANY =
  "critères du manuel HAS réservés aux établissements, qui ne s'appliquent pas à un service à domicile";
const ABSENT_HINT = "Vérifiez le code ou son périmètre (un critère « Établissement » ne s'applique pas à un SAD).";

export function unknownCriteriaMessage(codes: readonly string[]): string {
  const outOfScope = codes.filter((code) => ESTABLISHMENT_ONLY_CRITERIA.has(code));
  const absent = codes.filter((code) => !ESTABLISHMENT_ONLY_CRITERIA.has(code));
  const sentences: string[] = [];
  if (outOfScope.length > 0) {
    const many = outOfScope.length > 1;
    sentences.push(
      `${many ? "Critères" : "Critère"} hors périmètre SAD : ${outOfScope.join(", ")} (${
        many ? OUT_OF_SCOPE_REASON_MANY : OUT_OF_SCOPE_REASON_ONE
      }).`
    );
  }
  if (absent.length > 0) {
    sentences.push(`${absent.length > 1 ? "Critères absents" : "Critère absent"} des grilles SAD : ${absent.join(", ")}. ${ABSENT_HINT}`);
  }
  return sentences.join(" ");
}
