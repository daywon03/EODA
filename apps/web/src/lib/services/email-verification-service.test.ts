import { describe, expect, it } from "vitest";
import {
  CONFIRMATION_MESSAGES,
  confirmationLinkDisclosure,
  confirmationPathFor,
  isEmailVerificationPending,
  parseResendEmail,
  resendThrottleKeys,
  shouldIssueVerificationLink,
} from "./email-verification-service";

// Confirmation d'adresse du libre-service (tranche 11). Ce qui est tenu ici : qui doit
// confirmer, quand un lien est réémis, et SURTOUT que le lien n'apparaît à l'écran
// qu'en développement — jamais en production.

describe("isEmailVerificationPending — qui doit confirmer", () => {
  it("un compte libre-service sans confirmation est bloqué", () => {
    expect(isEmailVerificationPending({ isSelfRegistered: true, emailVerifiedAt: null })).toBe(true);
  });

  it("un compte libre-service confirmé passe", () => {
    expect(isEmailVerificationPending({ isSelfRegistered: true, emailVerifiedAt: new Date() })).toBe(false);
  });

  it("un compte créé par le cabinet n'a rien à confirmer, même sans date", () => {
    expect(isEmailVerificationPending({ isSelfRegistered: false, emailVerifiedAt: null })).toBe(false);
  });
});

describe("shouldIssueVerificationLink — quand un nouveau lien part", () => {
  const pending = { isSelfRegistered: true, emailVerifiedAt: null, isActive: true };

  it("compte libre-service actif, non confirmé : oui", () => {
    expect(shouldIssueVerificationLink(pending)).toBe(true);
  });

  it.each([
    ["adresse inconnue", null],
    ["compte désactivé", { ...pending, isActive: false }],
    ["déjà confirmé", { ...pending, emailVerifiedAt: new Date() }],
    ["compte cabinet", { ...pending, isSelfRegistered: false }],
  ])("%s : non", (_label, account) => {
    expect(shouldIssueVerificationLink(account)).toBe(false);
  });
});

describe("confirmationLinkDisclosure — le lien à l'écran", () => {
  const path = confirmationPathFor("a".repeat(43));

  it("développement sans service d'e-mail : « non envoyé » et le lien", () => {
    expect(confirmationLinkDisclosure({ isDevelopment: true, isEmailConfigured: false, confirmationPath: path })).toEqual({
      emailNotSentLocally: true,
      devConfirmationPath: path,
    });
  });

  it("production (jamais de lien), même si l'e-mail n'est pas configuré", () => {
    expect(confirmationLinkDisclosure({ isDevelopment: false, isEmailConfigured: false, confirmationPath: path })).toEqual({
      emailNotSentLocally: true,
      devConfirmationPath: null,
    });
    expect(confirmationLinkDisclosure({ isDevelopment: false, isEmailConfigured: true, confirmationPath: path })).toEqual({
      emailNotSentLocally: false,
      devConfirmationPath: null,
    });
  });

  it("développement AVEC service d'e-mail : le lien part par e-mail, pas à l'écran", () => {
    expect(confirmationLinkDisclosure({ isDevelopment: true, isEmailConfigured: true, confirmationPath: path }).devConfirmationPath).toBeNull();
  });

  it("aucun lien émis (adresse déjà connue) : rien à montrer", () => {
    expect(confirmationLinkDisclosure({ isDevelopment: true, isEmailConfigured: false, confirmationPath: null }).devConfirmationPath).toBeNull();
  });
});

describe("entrées du renvoi", () => {
  it("normalise et valide l'adresse", () => {
    expect(parseResendEmail("  Direction@Glycines.Example.org ")).toBe("direction@glycines.example.org");
    expect(parseResendEmail("pas-une-adresse")).toBeNull();
    expect(parseResendEmail(42)).toBeNull();
    expect(parseResendEmail(`${"a".repeat(250)}@x.org`)).toBeNull();
  });

  it("deux compteurs distincts : l'IP et l'adresse", () => {
    expect(resendThrottleKeys("203.0.113.9", " A@B.org")).toEqual({
      ip: "verify-resend:ip:203.0.113.9",
      email: "verify-resend:email:a@b.org",
    });
  });

  it("chaque issue de confirmation a son message", () => {
    for (const message of Object.values(CONFIRMATION_MESSAGES)) expect(message.length).toBeGreaterThan(10);
    expect(confirmationPathFor("abc")).toBe("/confirmer-email/abc");
  });
});
