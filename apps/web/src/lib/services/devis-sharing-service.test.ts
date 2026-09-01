import { describe, expect, it } from "vitest";
import { formatEuros } from "./price-format-service";
import {
  buildDevisFileName,
  buildDevisMailDraft,
  buildMailtoUrl,
  type DevisShareInput,
} from "./devis-sharing-service";

function share(overrides: Partial<DevisShareInput> = {}): DevisShareInput {
  return {
    number: "DEV-2026-014",
    structureName: "Association d'aide à domicile",
    contactEmail: "contact@exemple.fr",
    totalAmountEuros: 6500,
    validUntil: new Date("2026-10-31T00:00:00Z"),
    senderName: "Sandrine Regina",
    ...overrides,
  };
}

describe("buildDevisFileName", () => {
  const issuedOn = new Date(2026, 7, 26); // 26 août 2026, heure locale

  it("suit la convention EODA AAAAMMJJ_TYPE_CLIENT_OBJET_vXX_Externe", () => {
    expect(
      buildDevisFileName({ number: "DEV-2026-014", structureName: "ASSAD Benoit", issuedOn })
    ).toBe("20260826_DEVIS_ASSAD-Benoit_DEV-2026-014_v01_Externe.pdf");
  });

  it("retire accents et ponctuation — le fichier traverse une messagerie", () => {
    expect(
      buildDevisFileName({ number: "DEV-2026-014", structureName: "Aide à domicile, Créteil", issuedOn })
    ).toContain("_DEVIS_Aide-a-domicile-Creteil_");
  });

  it("ne produit jamais un segment vide, même sans nom exploitable", () => {
    expect(buildDevisFileName({ number: "DEV-1", structureName: "«»", issuedOn })).toContain(
      "_DEVIS_Sans-nom_"
    );
  });
});

describe("buildDevisMailDraft", () => {
  it("annonce le devis, son montant et sa validité", () => {
    const draft = buildDevisMailDraft(share());
    expect(draft.subject).toBe("Devis DEV-2026-014 — Association d'aide à domicile");
    // Même rendu que partout ailleurs (fine insécable comprise) : c'est formatEuros
    // qui décide, pas ce service.
    expect(draft.body).toContain(formatEuros(6500));
    expect(draft.body).toContain("31 octobre 2026");
    expect(draft.body).toContain("Sandrine Regina");
  });

  it("n'écrit pas « HT » — la TVA n'est pas applicable (art. 293 B du CGI)", () => {
    expect(buildDevisMailDraft(share()).body).not.toContain("HT");
  });

  it("omet la ligne de validité quand le devis n'en porte pas", () => {
    expect(buildDevisMailDraft(share({ validUntil: null })).body).not.toContain("valable");
  });

  it("laisse le destinataire vide plutôt que d'inventer une adresse", () => {
    expect(buildDevisMailDraft(share({ contactEmail: null })).to).toBeNull();
  });
});

describe("buildMailtoUrl", () => {
  it("encode sujet et corps, et garde le destinataire", () => {
    const url = buildMailtoUrl({ to: "a@b.fr", subject: "Devis 1", body: "Bonjour,\nCi-joint." });
    expect(url.startsWith("mailto:a@b.fr?")).toBe(true);
    expect(url).toContain("subject=Devis%20..".slice(0, 15));
    expect(url).toContain("%0A");
  });

  it("n'encode pas les espaces en « + » — les messageries les affichent tels quels", () => {
    expect(buildMailtoUrl({ to: null, subject: "a b", body: "c d" })).not.toContain("+");
  });

  it("reste un lien ouvrable sans destinataire connu", () => {
    expect(buildMailtoUrl({ to: null, subject: "s", body: "b" }).startsWith("mailto:?")).toBe(true);
  });
});
