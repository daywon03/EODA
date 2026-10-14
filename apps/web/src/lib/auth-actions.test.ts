import { beforeEach, describe, expect, it, vi } from "vitest";

// L'écran de connexion distingue UN SEUL cas du message générique : l'adresse pas
// encore confirmée (tranche 11), révélée seulement après un mot de passe juste.

class AuthError extends Error {}
class CredentialsSignin extends AuthError {
  code = "credentials";
}
class Unverified extends CredentialsSignin {
  code = "email_not_verified";
}

const signIn = vi.fn();

vi.mock("next-auth", () => ({ AuthError, CredentialsSignin }));
vi.mock("@/auth", () => ({ signIn: (...a: unknown[]) => signIn(...a), signOut: vi.fn() }));
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/security/login-throttle", () => ({
  clientIpFromHeaders: () => "203.0.113.9",
  peekLoginThrottle: () => Promise.resolve({ blocked: false, retryAfterSeconds: 0 }),
}));

const { loginAction } = await import("./auth-actions");
const { UNVERIFIED_LOGIN_MESSAGE } = await import("@/lib/services/email-verification-service");

function form(): FormData {
  const data = new FormData();
  data.set("email", " Direction@Glycines.example.org ");
  data.set("password", "une phrase de passe longue");
  return data;
}

beforeEach(() => vi.clearAllMocks());

describe("loginAction", () => {
  it("adresse non confirmée : message clair et adresse rendue pour « renvoyer le lien »", async () => {
    signIn.mockRejectedValue(new Unverified());
    await expect(loginAction(form())).resolves.toEqual({
      error: UNVERIFIED_LOGIN_MESSAGE,
      unverifiedEmail: "direction@glycines.example.org",
    });
  });

  it("identifiants faux : message générique, aucune adresse rendue", async () => {
    signIn.mockRejectedValue(new CredentialsSignin());
    await expect(loginAction(form())).resolves.toEqual({ error: "Email ou mot de passe incorrect." });
  });

  // Recette du 13/10/2026 : après une déconnexion forcée (mot de passe changé,
  // abonnement signé), la redirection d'action serveur vers /dashboard réutilisait
  // la page déjà en cache du routeur client pour cette adresse — écran blanc. Le
  // succès rend la main à l'écran, qui fait une navigation complète.
  it("succès : pas de redirection d'action serveur, une navigation complète vers /dashboard", async () => {
    signIn.mockResolvedValue(undefined);
    await expect(loginAction(form())).resolves.toEqual({ redirectTo: "/dashboard" });
  });

  it("succès : reprend la page demandée avant la connexion (chemin interne)", async () => {
    signIn.mockResolvedValue(undefined);
    const data = form();
    data.set("callbackUrl", "/dashboard/client/documents");
    await expect(loginAction(data)).resolves.toEqual({ redirectTo: "/dashboard/client/documents" });
  });

  it.each(["https://piege.example", "//piege.example", "/\\piege.example"])(
    "succès : un callbackUrl externe (%s) retombe sur /dashboard, jamais hors du site",
    async (callbackUrl) => {
      signIn.mockResolvedValue(undefined);
      const data = form();
      data.set("callbackUrl", callbackUrl);
      await expect(loginAction(data)).resolves.toEqual({ redirectTo: "/dashboard" });
    }
  );

  it("échec : le callbackUrl ne change rien au message", async () => {
    signIn.mockRejectedValue(new CredentialsSignin());
    const data = form();
    data.set("callbackUrl", "/dashboard/client");
    await expect(loginAction(data)).resolves.toEqual({ error: "Email ou mot de passe incorrect." });
  });
});
