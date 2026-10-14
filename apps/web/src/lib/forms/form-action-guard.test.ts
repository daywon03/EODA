import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Règle zéro : « un formulaire ne s'efface pas après un refus du serveur » n'existe
// que si une machine la vérifie. React 19 réinitialise tout `<form action={fonction}>`
// après chaque réponse de l'action, erreur comprise — la saisie disparaît (recette du
// 13/10/2026). Tout envoi de formulaire passe donc par
// `onSubmit={submitWithoutReset(action)}` (lib/forms/submit-without-reset.ts), avec
// une remise à zéro EXPLICITE après succès quand le formulaire ajoute une ligne
// (useResetAfterSuccess).
//
// Exception figée, qui ne peut que décroître : les boutons de déconnexion — un
// formulaire sans aucun champ, il n'y a rien à perdre.
const ALLOWED_ACTIONS = new Set(["logoutAction"]);

const SRC = path.resolve(__dirname, "../..");

function listTsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return listTsxFiles(full);
    return entry.endsWith(".tsx") ? [full] : [];
  });
}

// Un `action={…}` sur une balise <form> : chaîne (URL d'un formulaire GET) acceptée,
// fonction refusée. Une valeur entre accolades qui n'est pas une chaîne littérale est
// traitée comme une fonction, sauf exception ci-dessus.
function findFunctionFormActions(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/<form\b([^>]*)>/g)) {
    const action = /\saction=\{([^}]+)\}/.exec(match[1] ?? "");
    if (!action) continue;
    const value = (action[1] ?? "").trim();
    if (/^["'`]/.test(value) || ALLOWED_ACTIONS.has(value)) continue;
    // Un formulaire GET (recherche) peut recevoir une URL calculée.
    if (/\smethod="get"/.test(match[1] ?? "")) continue;
    found.push(value);
  }
  return found;
}

describe("findFunctionFormActions", () => {
  it("repère un formulaire à action React", () => {
    expect(findFunctionFormActions(`<form action={formAction} className="x">`)).toEqual(["formAction"]);
    expect(findFunctionFormActions(`<form\n  ref={r}\n  action={submit}\n>`)).toEqual(["submit"]);
  });

  it("accepte l'envoi par onSubmit, un formulaire GET et la déconnexion", () => {
    expect(findFunctionFormActions(`<form method="post" onSubmit={submitWithoutReset(formAction)}>`)).toEqual([]);
    expect(findFunctionFormActions(`<form method="get" action={basePath} role="search">`)).toEqual([]);
    expect(findFunctionFormActions(`<form action={logoutAction}>`)).toEqual([]);
  });
});

describe("aucun formulaire du dépôt n'est un formulaire à action React", () => {
  it("chaque <form> passe par submitWithoutReset", () => {
    const offenders = listTsxFiles(SRC).flatMap((file) =>
      findFunctionFormActions(readFileSync(file, "utf8")).map((value) => `${path.relative(SRC, file)} — action={${value}}`)
    );
    expect(offenders).toEqual([]);
  });
});
