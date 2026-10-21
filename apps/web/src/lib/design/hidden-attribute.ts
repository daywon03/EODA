// L'attribut HTML `hidden` masque-t-il réellement ? — lecture du CSS, pure, sans dépendance.
//
// Le préflight de Tailwind écrit `[hidden]:where(:not([hidden=until-found])){display:none}`.
// Le `:where()` ramène la spécificité de l'attribut à celle d'un simple `[hidden]`, soit
// (0,1,0) — EXACTEMENT celle de `.flex` — et cette règle vient plus tôt dans la feuille.
// À spécificité égale, c'est la dernière qui gagne : `<ul className="flex" hidden>` restait
// donc `display:flex`, affiché et tabulable. Mesuré sur le CSS construit le 16/10/2026 :
// la règle de préflight à l'offset 4638, `.flex` à 28046.
//
// Symptôme observé : le groupe « Réglages » de la barre latérale cabinet tournait son
// chevron, annonçait « 4 entrées masquées », et ne repliait rien.
//
// Le remède est un `!important` sur la règle de base de globals.css — c'est ce que Tailwind
// a fini par faire en amont (v4). Ce module existe pour que le remède ne puisse pas être
// retiré : ce symptôme ne désigne jamais sa cause, donc la prochaine régression se
// chercherait longtemps.

import { stripComments } from "./css-tokens";

export type CssRule = {
  readonly selector: string;
  readonly declarations: string;
};

// Une règle `sélecteur { déclarations }`, sans accolade imbriquée : suffisant pour du CSS
// de feuille de style, où l'imbrication n'est qu'un at-rule (`@layer`, `@media`) autour de
// règles plates — le balayage les traverse sans les confondre avec un sélecteur.
const RULE_PATTERN = /([^{}]+)\{([^{}]*)\}/g;

// Ciblage de l'ATTRIBUT présent, pas de la valeur. `[hidden=until-found]` ne contient pas
// `[hidden]` : la forme à valeur est donc écartée d'elle-même.
const TARGETS_ATTRIBUTE = "[hidden]";

// L'exception `until-found` est VISÉE quand elle est écartée par un `:not(...)` — le motif
// du préflight. La mentionner sans l'exclure (`[hidden] { display:none }` sec) casserait la
// recherche dans la page, qui repose sur cet état intermédiaire.
const UNTIL_FOUND_CARVE_OUT = /:not\([^)]*\[hidden\s*=\s*["']?until-found["']?\s*\][^)]*\)/;

function excludesUntilFound(selector: string): boolean {
  return UNTIL_FOUND_CARVE_OUT.test(selector);
}

// `display: none !important`, la seule écriture qui gagne sur une classe utilitaire de
// même spécificité. L'espace avant `!important` est facultatif en CSS : normalisé ici.
function declaresDisplayNoneImportant(declarations: string): boolean {
  return declarations.split(";").some((declaration) => {
    const [property, ...rest] = declaration.split(":");
    if (property?.trim().toLowerCase() !== "display") return false;
    return rest.join(":").toLowerCase().replace(/\s+/g, "") === "none!important";
  });
}

/** Les règles qui ciblent l'attribut `hidden`, dans l'ordre du fichier. */
export function findHiddenAttributeRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  for (const [, selector = "", declarations = ""] of stripComments(css).matchAll(RULE_PATTERN)) {
    if (selector.trimStart().startsWith("@")) continue;
    if (!selector.includes(TARGETS_ATTRIBUTE)) continue;
    rules.push({ selector: selector.trim(), declarations });
  }
  return rules;
}

/**
 * Vrai si l'attribut `hidden` gagne réellement sur une classe d'affichage : au moins une
 * règle cible `[hidden]`, écarte `until-found`, et force `display: none !important`.
 */
export function hiddenAttributeWins(css: string): boolean {
  return findHiddenAttributeRules(css).some(
    (rule) => excludesUntilFound(rule.selector) && declaresDisplayNoneImportant(rule.declarations)
  );
}
