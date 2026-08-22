import { beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Test de non-régression du BALAYAGE (« password spraying »).
//
// Le compteur (IP, email) seul — la version antérieure — ferme le bourrage de mots
// de passe sur un compte donné et laisse passer l'attaque inverse : un mot de passe
// probable essayé sur beaucoup de comptes. Changer d'email suffisait à repartir d'un
// compteur neuf, indéfiniment. Or nos adresses de connexion sont des adresses de
// contact publiques (annuaire FINESS), donc c'est le scénario réaliste.
//
// Ces tests décrivent le comportement attendu des DEUX compteurs et du fait,
// contre-intuitif mais délibéré, qu'une connexion réussie ne remet pas à zéro celui
// de l'IP.
// ─────────────────────────────────────────────────────────────────────────────

const recordAuditEvent = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const { consumeLoginAttempt, peekLoginThrottle, resetLoginThrottle } = await import(
  "./login-throttle"
);
const { LOGIN_RATE_LIMIT, LOGIN_IP_RATE_LIMIT } = await import("./index");

// Le compteur en mémoire vit sur globalThis (survie au rechargement à chaud), donc il
// est partagé entre les cas de test : chaque test travaille sur une IP qui lui est
// propre plutôt que de compter sur une remise à zéro.
let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

beforeEach(() => {
  recordAuditEvent.mockClear();
});

describe("balayage d'un mot de passe sur plusieurs comptes", () => {
  it("bloque une IP qui change d'email à chaque tentative", async () => {
    const ip = freshIp();

    // Chaque tentative vise un compte différent : le compteur du couple (IP, email)
    // ne dépasse jamais 1. Seul le compteur par IP peut arrêter ça.
    for (let attempt = 1; attempt <= LOGIN_IP_RATE_LIMIT.limit; attempt++) {
      const allowed = await consumeLoginAttempt({ ip, email: `contact${attempt}@sad.fr` });
      expect(allowed, `tentative ${attempt} sur un compte neuf`).toBe(true);
    }

    await expect(
      consumeLoginAttempt({ ip, email: "un-compte-encore-jamais-essaye@sad.fr" })
    ).resolves.toBe(false);
  });

  it("ne pénalise pas une autre IP", async () => {
    const attacker = freshIp();
    const legitimate = freshIp();

    for (let attempt = 0; attempt <= LOGIN_IP_RATE_LIMIT.limit; attempt++) {
      await consumeLoginAttempt({ ip: attacker, email: `cible${attempt}@sad.fr` });
    }

    await expect(
      consumeLoginAttempt({ ip: legitimate, email: "sandrine@exemple.fr" })
    ).resolves.toBe(true);
  });
});

describe("bourrage de mots de passe sur un compte unique", () => {
  it("bloque au plafond du couple, bien avant celui de l'IP", async () => {
    const ip = freshIp();
    const email = "sandrine@exemple.fr";

    for (let attempt = 1; attempt <= LOGIN_RATE_LIMIT.limit; attempt++) {
      expect(await consumeLoginAttempt({ ip, email }), `tentative ${attempt}`).toBe(true);
    }

    await expect(consumeLoginAttempt({ ip, email })).resolves.toBe(false);
    // Le plafond du couple est bien le plus contraignant des deux sur ce scénario.
    expect(LOGIN_RATE_LIMIT.limit).toBeLessThan(LOGIN_IP_RATE_LIMIT.limit);
  });

  it("laisse un collègue derrière le même NAT se connecter normalement", async () => {
    const ip = freshIp();

    for (let attempt = 0; attempt <= LOGIN_RATE_LIMIT.limit; attempt++) {
      await consumeLoginAttempt({ ip, email: "sandrine@exemple.fr" });
    }

    await expect(consumeLoginAttempt({ ip, email: "collegue@exemple.fr" })).resolves.toBe(true);
  });
});

describe("remise à zéro après une connexion réussie", () => {
  it("libère le compte concerné", async () => {
    const ip = freshIp();
    const identity = { ip, email: "sandrine@exemple.fr" };

    for (let attempt = 0; attempt <= LOGIN_RATE_LIMIT.limit; attempt++) {
      await consumeLoginAttempt(identity);
    }
    expect((await peekLoginThrottle(identity)).blocked).toBe(true);

    await resetLoginThrottle(identity);

    expect(await consumeLoginAttempt(identity)).toBe(true);
  });

  it("ne remet PAS à zéro le compteur de l'IP", async () => {
    // Invariant de sécurité : sinon un attaquant disposant d'un seul compte valide
    // (ancien salarié d'une structure cliente) s'en sert comme bouton de remise à
    // zéro entre deux séries de balayage, et le plafond par IP ne borne plus rien.
    const ip = freshIp();

    for (let attempt = 1; attempt <= LOGIN_IP_RATE_LIMIT.limit; attempt++) {
      await consumeLoginAttempt({ ip, email: `cible${attempt}@sad.fr` });
    }

    await resetLoginThrottle({ ip, email: "compte-valide@sad.fr" });

    await expect(consumeLoginAttempt({ ip, email: "cible-suivante@sad.fr" })).resolves.toBe(false);
  });
});

describe("lecture d'état sans consommation", () => {
  it("signale le blocage quel que soit le compteur qui l'a déclenché", async () => {
    const ip = freshIp();

    for (let attempt = 1; attempt <= LOGIN_IP_RATE_LIMIT.limit + 1; attempt++) {
      await consumeLoginAttempt({ ip, email: `cible${attempt}@sad.fr` });
    }

    // Le couple (IP, ce compte-là) est loin de son plafond ; c'est l'IP qui bloque.
    const state = await peekLoginThrottle({ ip, email: "jamais-essaye@sad.fr" });
    expect(state.blocked).toBe(true);
    expect(state.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("ne consomme aucune tentative", async () => {
    const ip = freshIp();
    const identity = { ip, email: "sandrine@exemple.fr" };

    for (let peek = 0; peek < LOGIN_RATE_LIMIT.limit * 2; peek++) {
      await peekLoginThrottle(identity);
    }

    await expect(consumeLoginAttempt(identity)).resolves.toBe(true);
  });
});

describe("journalisation du dépassement", () => {
  it("journalise sans jamais écrire l'email ni l'IP dans le détail", async () => {
    // CLAUDE.md §5 bis : jamais de donnée personnelle dans le champ `detail`.
    const ip = freshIp();
    const email = "sandrine@exemple.fr";

    for (let attempt = 0; attempt <= LOGIN_RATE_LIMIT.limit; attempt++) {
      await consumeLoginAttempt({ ip, email });
    }

    const details = recordAuditEvent.mock.calls.map(([event]) => JSON.stringify(event));
    expect(details.length).toBeGreaterThan(0);
    for (const detail of details) {
      expect(detail).toContain("LOGIN_RATE_LIMITED");
      expect(detail).not.toContain(email);
      expect(detail).not.toContain(ip);
    }
  });
});
