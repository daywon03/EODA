import { describe, expect, it } from "vitest";
import type { AppEnv } from "./env";
import { productionConfigProblems, productionConfigWarnings } from "./production-profile";

// Cas de REFUS de la configuration de production (D7). Le défaut corrigé ici est un
// déploiement qui démarre vert sans stockage S3 et n'explose qu'au premier dépôt de
// document, devant le client.

const COMPLETE: AppEnv = {
  isProduction: true,
  isDevelopment: false,
  databaseUrl: "postgresql://localhost:5432/eoda",
  directUrl: "postgresql://localhost:5433/eoda",
  authSecret: "x".repeat(32),
  nextAuthUrl: "https://plateforme.exemple.fr",
  s3: {
    endpoint: "https://s3.fr-par.exemple",
    region: "fr-par",
    bucket: "eoda-documents",
    accessKeyId: "cle",
    secretAccessKey: "secret",
  },
  anthropic: { apiKey: "cle-anthropic", model: null },
  resend: { apiKey: "cle-resend", from: "contact@exemple.fr" },
};

describe("productionConfigProblems", () => {
  it("n'a rien à redire sur une configuration complète", () => {
    expect(productionConfigProblems(COMPLETE)).toEqual([]);
  });

  it("refuse l'absence de stockage S3 — le repli disque local est réservé au développement", () => {
    const problems = productionConfigProblems({ ...COMPLETE, s3: null });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("S3_ENDPOINT");
  });

  // Décision du 21/08/2026 : l'absence de clé Anthropic n'est PLUS un refus. Ce test
  // ne disparaît pas, il change de camp — sinon rien n'empêcherait de la remettre
  // bloquante par inadvertance, ni de constater que le déploiement redevient
  // impossible sans que personne n'ait décidé quoi que ce soit.
  it("n'empêche PLUS le déploiement quand la clé Anthropic est absente", () => {
    expect(productionConfigProblems({ ...COMPLETE, anthropic: null })).toEqual([]);
  });

  it("refuse l'absence de NEXTAUTH_URL", () => {
    const problems = productionConfigProblems({ ...COMPLETE, nextAuthUrl: null });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("NEXTAUTH_URL");
  });

  it("refuse une NEXTAUTH_URL non https — le cookie de session porte l'attribut Secure", () => {
    const problems = productionConfigProblems({
      ...COMPLETE,
      nextAuthUrl: "http://plateforme.exemple.fr",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("https://");
  });

  it("refuse un AUTH_SECRET trop court", () => {
    const problems = productionConfigProblems({ ...COMPLETE, authSecret: "trop-court" });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("AUTH_SECRET");
  });

  it("rapporte TOUS les problèmes d'un coup, pas seulement le premier", () => {
    const problems = productionConfigProblems({
      ...COMPLETE,
      s3: null,
      anthropic: null,
      nextAuthUrl: null,
      authSecret: "court",
    });
    // 3 et non 4 : la clé Anthropic manquante est désormais un avertissement.
    expect(problems).toHaveLength(3);
  });
});

describe("productionConfigWarnings", () => {
  it("ne signale rien quand l'envoi d'email est configuré", () => {
    expect(productionConfigWarnings(COMPLETE)).toEqual([]);
  });

  it("avertit sans bloquer quand l'envoi d'email n'est pas configuré", () => {
    const warnings = productionConfigWarnings({ ...COMPLETE, resend: null });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("RESEND_API_KEY");
    // L'avertissement doit dire que l'envoi ÉCHOUE, pas qu'il est journalisé :
    // `getEmailPort()` lève en production, il n'y a pas de repli console.
    expect(warnings[0]).toContain("ÉCHOUERA");
  });

  it("avertit sans bloquer quand la clé Anthropic est absente, en nommant la conséquence", () => {
    const warnings = productionConfigWarnings({ ...COMPLETE, anthropic: null });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("ANTHROPIC_API_KEY");
    expect(warnings[0]).toContain("AUCUNE analyse");
  });

  it("cumule les avertissements sans en perdre", () => {
    const warnings = productionConfigWarnings({ ...COMPLETE, anthropic: null, resend: null });
    expect(warnings).toHaveLength(2);
  });
});
