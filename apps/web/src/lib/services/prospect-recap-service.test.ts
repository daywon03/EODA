import { describe, expect, it } from "vitest";
import {
  buildProspectRecap,
  isRecapClosed,
  type ProspectRecapFacts,
} from "./prospect-recap-service";

const JANVIER = new Date("2026-01-12T10:00:00Z");
const FEVRIER = new Date("2026-02-03T10:00:00Z");

function facts(overrides: Partial<ProspectRecapFacts> = {}): ProspectRecapFacts {
  return {
    firstContactDate: JANVIER,
    discoveryUpdatedAt: null,
    devis: [],
    status: "NOUVEAU",
    establishmentId: null,
    ...overrides,
  };
}

function step(steps: ReturnType<typeof buildProspectRecap>, id: string) {
  const found = steps.find((s) => s.id === id);
  if (!found) throw new Error(`étape absente du récapitulatif : ${id}`);
  return found;
}

describe("buildProspectRecap", () => {
  it("tient le premier contact pour acquis — il a forcément eu lieu", () => {
    const steps = buildProspectRecap(facts());
    expect(step(steps, "PREMIER_CONTACT")).toMatchObject({ done: true, at: JANVIER });
  });

  it("ne coche la découverte que si la grille a été renseignée", () => {
    // Un rendez-vous programmé ne prouve rien : il peut avoir été annulé. La grille
    // enregistrée est le seul dépôt que la réunion laisse.
    expect(step(buildProspectRecap(facts()), "DECOUVERTE").done).toBe(false);
    expect(
      step(buildProspectRecap(facts({ discoveryUpdatedAt: FEVRIER })), "DECOUVERTE")
    ).toMatchObject({ done: true, at: FEVRIER });
  });

  it("distingue « devis établi » de « devis envoyé »", () => {
    const brouillon = buildProspectRecap(
      facts({ devis: [{ number: "D-2026-004", status: "BROUILLON", createdAt: FEVRIER }] })
    );
    expect(step(brouillon, "DEVIS_EMIS")).toMatchObject({ done: true, detail: "D-2026-004" });
    // C'est LE fait que Sandrine veut voir sans chercher : la balle est-elle chez le
    // client ? Un brouillon n'est jamais parti.
    expect(step(brouillon, "DEVIS_ENVOYE").done).toBe(false);

    const envoye = buildProspectRecap(
      facts({ devis: [{ number: "D-2026-004", status: "ENVOYE", createdAt: FEVRIER }] })
    );
    expect(step(envoye, "DEVIS_ENVOYE")).toMatchObject({ done: true, detail: "D-2026-004" });
  });

  it("compte un devis refusé comme envoyé — la balle est bien passée chez le client", () => {
    const steps = buildProspectRecap(
      facts({ devis: [{ number: "D-2026-004", status: "REFUSE", createdAt: FEVRIER }] })
    );
    expect(step(steps, "DEVIS_ENVOYE").done).toBe(true);
    expect(step(steps, "SIGNATURE").done).toBe(false);
  });

  it("ignore entièrement un devis annulé", () => {
    // Un devis annulé est sorti du dossier commercial. L'afficher comme étape
    // franchie ferait croire qu'on attend une réponse qui ne viendra pas.
    const steps = buildProspectRecap(
      facts({ devis: [{ number: "D-2026-004", status: "ANNULE", createdAt: FEVRIER }] })
    );
    expect(step(steps, "DEVIS_EMIS").done).toBe(false);
    expect(step(steps, "DEVIS_ENVOYE").done).toBe(false);
  });

  it("n'affiche pas la date de création à la place de la date d'envoi", () => {
    // Rien n'horodate l'envoi. Reprendre la date de création laisserait croire que le
    // devis est parti le jour où il a été rédigé.
    const steps = buildProspectRecap(
      facts({ devis: [{ number: "D-2026-004", status: "ENVOYE", createdAt: FEVRIER }] })
    );
    expect(step(steps, "DEVIS_ENVOYE").at).toBeNull();
  });

  it("tient la signature pour acquise dès qu'une fiche client existe", () => {
    // Cas réel des fiches antérieures à l'entonnoir unique : la fiche existe sans
    // qu'un devis du dossier ne porte SIGNE.
    const steps = buildProspectRecap(facts({ establishmentId: "etab_1" }));
    expect(step(steps, "SIGNATURE").done).toBe(true);
  });

  it("garde l'ordre du parcours de vente", () => {
    expect(buildProspectRecap(facts()).map((s) => s.id)).toEqual([
      "PREMIER_CONTACT",
      "DECOUVERTE",
      "DEVIS_EMIS",
      "DEVIS_ENVOYE",
      "SIGNATURE",
    ]);
  });
});

describe("isRecapClosed", () => {
  it("ne reconnaît close qu'une affaire perdue", () => {
    expect(isRecapClosed("PERDU")).toBe(true);
    expect(isRecapClosed("SIGNE")).toBe(false);
    expect(isRecapClosed("NOUVEAU")).toBe(false);
  });
});
