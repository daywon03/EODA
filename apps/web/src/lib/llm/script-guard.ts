import type { LLMAnalysisPort } from "./llm-analysis-port";

// ─────────────────────────────────────────────────────────────────────────────
// AUCUN MOT D'UNE AUTRE ÉCRITURE DANS CE QUE L'IA ÉCRIT (29/10/2026).
//
// Constaté en base (Sandrine, capture du 29/10) : « ce qui规范ise la coordination »,
// « ，表明 », « существование », « запрос » — des modèles servis par OpenRouter
// (MiniMax en tête) glissent un mot chinois ou russe au milieu d'une phrase française.
// 4 justifications de critères (3 déjà acceptées), 7 analyses, une proposition de
// mise en conformité et un brouillon en contenaient. Un document présenté à la HAS ne
// peut pas porter ça.
//
// Défense en deux temps, sur TOUTES les sorties du modèle (analyse, essais du
// laboratoire, détection de critères, mise en conformité) :
//   1. la consigne de sortie le dit au modèle (openrouter-analysis-adapter,
//      generation-prompt) ;
//   2. `withScriptGuard` contrôle la réponse AVANT qu'elle soit rendue : contaminée, elle
//      est redemandée une fois ; encore contaminée, elle est REFUSÉE — mieux vaut une
//      analyse à relancer qu'un texte abîmé enregistré.
// Les caractères qui figurent DÉJÀ dans le document analysé sont permis (une citation
// mot pour mot d'un document qui contiendrait un nom écrit dans une autre écriture).
// ─────────────────────────────────────────────────────────────────────────────

// Cyrillique, hébreu, arabe, thaï, hangul, ponctuation et idéogrammes CJK, kana,
// formes pleine chasse (« ， »). Le latin accentué, le grec et les symboles de mise en
// forme (★, ☐, ☒, « ») restent permis.
const FOREIGN_SCRIPT_RUN =
  /[Ѐ-ԯ֐-׿؀-ۿ฀-๿ᄀ-ᇿ　-〿぀-ヿ㐀-䶿一-鿿가-힯豈-﫿＀-￯]+/g;

export const UNREADABLE_WORD_MARK = "[mot illisible]";

// Les caractères étrangers d'un texte, moins ceux que le document contient déjà.
export function foreignCharacters(text: string, allowed: ReadonlySet<string> = new Set()): string[] {
  const found = text.match(FOREIGN_SCRIPT_RUN) ?? [];
  return [...new Set(found.flatMap((run) => [...run]))].filter((char) => !allowed.has(char));
}

export function allowedForeignCharacters(sourceText: string | undefined): ReadonlySet<string> {
  return new Set(foreignCharacters(sourceText ?? ""));
}

// Parcourt toute la réponse (objets, tableaux, chaînes) : un seul mot suffit.
export function responseHasForeignScript(value: unknown, allowed: ReadonlySet<string>): boolean {
  if (typeof value === "string") return foreignCharacters(value, allowed).length > 0;
  if (Array.isArray(value)) return value.some((item) => responseHasForeignScript(item, allowed));
  if (value && typeof value === "object") return Object.values(value).some((item) => responseHasForeignScript(item, allowed));
  return false;
}

// À l'AFFICHAGE d'un texte déjà enregistré avant ce garde : le mot étranger devient
// « [mot illisible] » (avec la ponctuation pleine chasse qui l'entoure), pour que la
// consultante le voie et le corrige au lieu de le valider sans le remarquer.
export function markForeignScript(text: string): string {
  return text.replace(FOREIGN_SCRIPT_RUN, ` ${UNREADABLE_WORD_MARK} `).replace(/ {2,}/g, " ").replace(/ ([,.;:])/g, "$1").trim();
}

// Même marquage sur toute une structure (analyse enregistrée) : seules les chaînes
// changent, la forme reste.
export function markForeignScriptDeep<T>(value: T): T {
  if (typeof value === "string") return (FOREIGN_SCRIPT_RUN.test(value) ? markForeignScript(value) : value) as T;
  if (Array.isArray(value)) return value.map((item) => markForeignScriptDeep(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, markForeignScriptDeep(item)])) as T;
  }
  return value;
}

export class ForeignScriptResponseError extends Error {
  constructor() {
    super(
      "Le modèle a répondu en mêlant une autre écriture (chinois, cyrillique…) au français, deux fois de suite. Rien n'a été enregistré : relancez, ou choisissez un autre modèle."
    );
    this.name = "ForeignScriptResponseError";
  }
}

async function cleanOrRetry<T>(run: () => Promise<T>, allowed: ReadonlySet<string>): Promise<T> {
  const first = await run();
  if (!responseHasForeignScript(first, allowed)) return first;
  // Jamais le texte au journal : il cite le document.
  console.warn("Réponse du modèle contenant une autre écriture — redemandée une fois.");
  const second = await run();
  if (!responseHasForeignScript(second, allowed)) return second;
  throw new ForeignScriptResponseError();
}

export function withScriptGuard(port: LLMAnalysisPort): LLMAnalysisPort {
  return {
    describeAnalysisCall: (input) => port.describeAnalysisCall(input),
    analyze: (input) => cleanOrRetry(() => port.analyze(input), allowedForeignCharacters(input.extractedText)),
    generateCorrectedDocument: (input) =>
      cleanOrRetry(() => port.generateCorrectedDocument(input), allowedForeignCharacters(input.extractedText)),
  };
}
