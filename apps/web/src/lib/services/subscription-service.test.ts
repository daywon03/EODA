import { describe, expect, it } from "vitest";
import {
  describeSubscriptionDiscount,
  isSubscriptionOption,
  optionUnitPriceForFormule,
  SUBSCRIPTION_OPTION_CODE,
  subscriptionDiscountPercent,
  subscriptionMonthlyPriceEuros,
} from "./subscription-service";

describe("subscriptionDiscountPercent", () => {
  it("applique les taux décidés au call : 0 / -10 / -30", () => {
    expect(subscriptionDiscountPercent("ESSENTIEL")).toBe(0);
    expect(subscriptionDiscountPercent("PERFORMANCE")).toBe(10);
    expect(subscriptionDiscountPercent("EXCELLENCE")).toBe(30);
  });

  it("traite le bêta-test comme Excellence, cohérent avec son périmètre", () => {
    expect(subscriptionDiscountPercent("BETA")).toBe(30);
  });
});

describe("subscriptionMonthlyPriceEuros", () => {
  it("laisse le tarif intact en Essentiel", () => {
    expect(subscriptionMonthlyPriceEuros(400, "ESSENTIEL")).toBe(400);
  });

  it("chiffre la dégressivité que la plaquette n'écrit pas", () => {
    expect(subscriptionMonthlyPriceEuros(400, "PERFORMANCE")).toBe(360);
    expect(subscriptionMonthlyPriceEuros(400, "EXCELLENCE")).toBe(280);
  });

  it("arrondit à l'euro — le dépôt ne manipule que des entiers", () => {
    expect(subscriptionMonthlyPriceEuros(455, "PERFORMANCE")).toBe(410); // 409,5
  });
});

describe("optionUnitPriceForFormule", () => {
  const subscription = { code: SUBSCRIPTION_OPTION_CODE, priceEuros: 400 };
  const other = { code: "DIAGNOSTIC_RGPD", priceEuros: 1000 };

  it("ne dégresse que l'abonnement", () => {
    expect(optionUnitPriceForFormule(subscription, "EXCELLENCE")).toBe(280);
    expect(optionUnitPriceForFormule(other, "EXCELLENCE")).toBe(1000);
  });

  it("laisse le prix intact sans offre connue — une remise suppose une offre", () => {
    expect(optionUnitPriceForFormule(subscription, null)).toBe(400);
  });
});

describe("isSubscriptionOption", () => {
  it("apparie par code, pas par libellé — un libellé se réécrit à l'écran", () => {
    expect(isSubscriptionOption(SUBSCRIPTION_OPTION_CODE)).toBe(true);
    expect(isSubscriptionOption("Veille réglementaire HAS + accès portail EODA")).toBe(false);
  });
});

describe("describeSubscriptionDiscount", () => {
  it("ne dit rien quand il n'y a rien à annoncer", () => {
    expect(describeSubscriptionDiscount("ESSENTIEL")).toBeNull();
    expect(describeSubscriptionDiscount(null)).toBeNull();
  });

  it("annonce le taux appliqué", () => {
    expect(describeSubscriptionDiscount("PERFORMANCE")).toContain("-10 %");
    expect(describeSubscriptionDiscount("EXCELLENCE")).toContain("-30 %");
  });
});
