import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// RÈGLE ZÉRO : CHAQUE POINT D'ENTRÉE PASSE PAR UNE GARDE (audit du 28/10/2026).
//
// Toute fonction exportée d'un fichier « use server » est appelable directement par
// une requête HTTP, et tout handler de route.ts aussi. Ce test lit le code et ÉCHOUE
// si l'un d'eux n'appelle aucune garde de `guards.ts` — directement, ou par une
// fonction (locale ou importée) qui en appelle une, à n'importe quelle profondeur.
//
// Les seules exceptions sont les portes publiques, listées ci-dessous avec leur raison :
// elles se gardent par un jeton à usage unique, une limite de débit, ou n'ont rien à
// protéger. Ajouter une exception, c'est écrire pourquoi.
// ─────────────────────────────────────────────────────────────────────────────

const SRC = path.resolve(__dirname, "../..");

const PUBLIC_ENTRY_POINTS: Record<string, string> = {
  "lib/auth-actions.ts#loginAction": "connexion : bcrypt, compteurs IP et IP+e-mail dans authorize()",
  "lib/auth-actions.ts#logoutAction": "déconnexion : ne fait que fermer la session courante",
  "app/deconnexion/route.ts#GET": "déconnexion forcée : ne fait que fermer la session courante",
  "lib/actions/self-service.ts#signUpSelfService": "inscription publique : débit IP + adresse, réponse identique",
  "lib/actions/email-verification.ts#confirmEmailAddress": "jeton à usage unique, empreinte en base, débit",
  "lib/actions/email-verification.ts#resendVerificationLink": "réponse identique que l'adresse existe ou non, débit",
  "lib/actions/quiz-public.ts#openPublicQuiz": "jeton de quiz à usage unique (QR code)",
  "lib/actions/quiz-public.ts#submitPublicQuiz": "jeton de quiz à usage unique, consommé atomiquement",
  "lib/actions/anonymous-survey.ts#openAnonymousSurveyLink": "lien d'enquête à usage unique",
  "lib/actions/anonymous-survey.ts#submitAnonymousSurveyLink": "lien d'enquête à usage unique, consommé atomiquement",
  "lib/actions/tablet.ts#tabletSignOut": "efface le cookie de session de la tablette, rien d'autre",
  "lib/actions/password-setup.ts#openPasswordSetupLink": "lien de création de mot de passe à usage unique",
  "lib/actions/password-setup.ts#setPasswordFromLink": "lien de création de mot de passe à usage unique, consommé atomiquement",
};

type Fn = { name: string; exported: boolean; body: string };

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry) ? [full] : [];
  });
}

function topFunctions(source: string): Fn[] {
  const re = /^(export )?(?:async )?function (\w+)|^(export )?const (\w+)\s*=\s*(?:async\s*)?\(/gm;
  const starts = [...source.matchAll(re)].map((m) => ({ index: m.index, exported: Boolean(m[1] || m[3]), name: (m[2] ?? m[4])! }));
  return starts.map((s, i) => ({ name: s.name, exported: s.exported, body: source.slice(s.index, starts[i + 1]?.index ?? source.length) }));
}

// Noms importés d'un fichier du projet → fichier source qui les définit.
function importsOf(file: string, source: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) {
    const spec = m[2]!;
    const base = spec.startsWith("@/") ? path.join(SRC, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(file), spec) : null;
    if (!base) continue;
    const target = [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find((candidate) => {
      try {
        return statSync(candidate).isFile();
      } catch {
        return false;
      }
    });
    if (!target) continue;
    for (const part of m[1]!.split(",")) {
      const [original, alias] = part.replace(/\btype\b/, "").trim().split(/\s+as\s+/);
      if (original) out.set((alias ?? original).trim(), `${target}#${original.trim()}`);
    }
  }
  return out;
}

const guardsFile = path.join(SRC, "lib/auth/guards.ts");
const GUARDS = [...readFileSync(guardsFile, "utf8").matchAll(/export async function (\w+)/g)].map((m) => m[1]!);

const files = listSourceFiles(SRC);
const parsed = new Map(files.map((file) => {
  const source = readFileSync(file, "utf8");
  return [file, { source, fns: topFunctions(source), imports: importsOf(file, source) }] as const;
}));

// Point fixe : « fichier#fonction » gardé si son corps appelle une garde, une fonction
// locale gardée, ou une fonction importée gardée.
const guarded = new Set<string>(GUARDS.map((g) => `${guardsFile}#${g}`));
for (let changed = true; changed; ) {
  changed = false;
  for (const [file, { fns, imports }] of parsed) {
    for (const fn of fns) {
      const key = `${file}#${fn.name}`;
      if (guarded.has(key)) continue;
      const body = fn.body.replace(/^[^\n]*\n/, "");
      const calls = [...body.matchAll(/\b(\w+)\s*\(/g)].map((m) => m[1]!);
      const isGuarded = calls.some((callee) => guarded.has(`${file}#${callee}`) || (imports.has(callee) && guarded.has(imports.get(callee)!)));
      if (isGuarded) {
        guarded.add(key);
        changed = true;
      }
    }
  }
}

function entryPoints(): string[] {
  const out: string[] = [];
  for (const [file, { source, fns }] of parsed) {
    const relative = path.relative(SRC, file);
    const isAction = /^\s*["']use server["']/.test(source);
    const isRoute = /(^|\/)route\.ts$/.test(relative);
    if (!isAction && !isRoute) continue;
    for (const fn of fns.filter((f) => f.exported)) {
      if (isRoute && !/^(GET|POST|PUT|PATCH|DELETE)$/.test(fn.name)) continue;
      out.push(`${relative}#${fn.name}`);
    }
  }
  return out;
}

describe("chaque point d'entrée passe par une garde", () => {
  const all = entryPoints();

  it("trouve les points d'entrée (le test lit réellement le code)", () => {
    expect(all.length).toBeGreaterThan(200);
    expect(GUARDS).toContain("requireEstablishmentInTenant");
  });

  it("aucune action serveur ni route sans garde, hors portes publiques justifiées", () => {
    const unguarded = all.filter((entry) => {
      const [relative, name] = entry.split("#") as [string, string];
      return !guarded.has(`${path.join(SRC, relative)}#${name}`) && !(entry in PUBLIC_ENTRY_POINTS);
    });
    expect(unguarded).toEqual([]);
  });

  it("chaque exception désigne un point d'entrée qui existe encore", () => {
    const stale = Object.keys(PUBLIC_ENTRY_POINTS).filter((entry) => !all.includes(entry));
    expect(stale).toEqual([]);
  });
});
