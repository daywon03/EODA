// Lecture des variables CSS du thème DEPUIS globals.css — pure, sans dépendance.
//
// Le test de contraste lit le fichier réel plutôt qu'une table recopiée : une
// copie des couleurs dans un test finirait par diverger du CSS livré, et le test
// vérifierait alors des couleurs que personne ne voit.

export type TokenMap = Readonly<Record<string, string>>;

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Toutes les déclarations `--x: valeur;` des blocs dont le sélecteur est EXACTEMENT
// `selector`, fusionnées dans l'ordre du fichier (la dernière gagne, comme en CSS).
// Les blocs ciblés ne contiennent pas d'accolade imbriquée : un bloc de variables
// n'en a jamais besoin.
export function readCustomProperties(css: string, selector: string): TokenMap {
  const source = stripComments(css);
  const blockPattern = new RegExp(`(?:^|[\\s}])${escapeRegExp(selector)}\\s*\\{([^{}]*)\\}`, "g");
  const tokens: Record<string, string> = {};
  for (const [, body = ""] of source.matchAll(blockPattern)) {
    for (const [, name, value] of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      if (name && value) tokens[name] = value.trim();
    }
  }
  return tokens;
}

const VAR_REFERENCE = /^var\(--([\w-]+)\)$/;

// Résout `var(--x)` comme le navigateur le fait pour des variables posées sur le
// même élément : contre les valeurs FINALES du thème, après surcharge. C'est ce
// qui fait qu'un alias `--paper: var(--ivoire-light)` déclaré une seule fois
// suit le sombre sans être redéclaré.
export function resolveToken(tokens: TokenMap, name: string, seen: ReadonlySet<string> = new Set()): string {
  if (seen.has(name)) throw new Error(`Référence circulaire sur --${name}`);
  const raw = tokens[name];
  if (raw === undefined) throw new Error(`Variable --${name} introuvable`);
  const target = VAR_REFERENCE.exec(raw)?.[1];
  if (target === undefined) return raw;
  return resolveToken(tokens, target, new Set([...seen, name]));
}

export function mergeTokens(base: TokenMap, override: TokenMap): TokenMap {
  return { ...base, ...override };
}
