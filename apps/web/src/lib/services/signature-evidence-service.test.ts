import { describe, expect, it } from "vitest";
import { RECEPTION_DOCUMENTS } from "@/content/enquete/reception";
import type { ChecklistTick } from "@/lib/hds/beneficiary-data-port";
import {
  buildSignatureEvidence,
  isPngImage,
  MAX_SIGNATURE_IMAGE_BYTES,
  missingChecklistPoints,
  sha256Hex,
  signerProblems,
  type SignatureEvidenceInput,
} from "./signature-evidence-service";
import {
  describePresentedDocuments,
  placeholdersIn,
  renderReceptionSheet,
  type ReceptionFieldValues,
} from "./reception-sheet-service";

// Données SYNTHÉTIQUES, marquées fictives.
const SIGNED_AT = new Date("2026-10-14T10:00:00Z");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]);
const ALL_KINDS = RECEPTION_DOCUMENTS.map((d) => d.kind);
const ALL_TICKS: ChecklistTick[] = RECEPTION_DOCUMENTS.flatMap((doc, d) =>
  doc.points.map((point, p) => ({
    documentKind: doc.kind,
    pointId: point.id,
    label: point.label,
    tickedAt: new Date(SIGNED_AT.getTime() - (10 - d) * 60_000 + p * 1000),
  }))
);

const BASE: SignatureEvidenceInput = {
  beneficiaryFullName: "Germaine Rousseau (fictif)",
  representative: null,
  signerRole: "PERSONNE",
  signerName: "germaine  rousseau (fictif)",
  witnessStaffMemberId: "staff-1",
  deviceEnrollmentId: "device-1",
  renderedDocument: Buffer.from("Feuille de réception (fictive)"),
  signatureImage: PNG,
  presentedDocuments: ALL_KINDS,
  ticks: ALL_TICKS,
  signedAt: SIGNED_AT,
};

describe("buildSignatureEvidence", () => {
  it("produit l'empreinte du document et la liste horodatée quand tout est complet", () => {
    const result = buildSignatureEvidence({ ...BASE, ticks: [...ALL_TICKS].reverse() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.documentSha256).toBe(sha256Hex(BASE.renderedDocument));
    expect(result.documentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.checklist[0]!.tickedAt.getTime()).toBeLessThanOrEqual(result.checklist[1]!.tickedAt.getTime());
  });

  it("refuse un point non coché, nommé dans le message", () => {
    const result = buildSignatureEvidence({ ...BASE, ticks: ALL_TICKS.slice(1) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toContain("Présenter le service");
  });

  it("refuse un point coché après la signature, sans appareil, sans témoin, sans document", () => {
    const late = [...ALL_TICKS.slice(1), { ...ALL_TICKS[0]!, tickedAt: new Date(SIGNED_AT.getTime() + 1000) }];
    const result = buildSignatureEvidence({
      ...BASE,
      ticks: late,
      witnessStaffMemberId: null,
      deviceEnrollmentId: null,
      presentedDocuments: [],
      renderedDocument: Buffer.alloc(0),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toEqual(
        expect.arrayContaining([
          "Aucun document n'a été présenté.",
          "Un point a été coché après la signature.",
          "L'intervenant témoin n'est pas identifié.",
          "La signature doit être faite sur un appareil enregistré.",
          "Le document signé est vide.",
        ])
      );
    }
  });

  it("n'accepte qu'une image PNG finale, ni vide ni trop lourde", () => {
    expect(isPngImage(PNG)).toBe(true);
    expect(isPngImage(Buffer.from("{\"points\":[[1,2,0.5]]}"))).toBe(false);
    const notPng = buildSignatureEvidence({ ...BASE, signatureImage: Buffer.from("trace") });
    expect(notPng.ok || notPng.problems).toContain("La signature doit être une image PNG.");
    const tiny = buildSignatureEvidence({ ...BASE, signatureImage: PNG.subarray(0, 20) });
    expect(tiny.ok || tiny.problems).toContain("La signature est vide.");
    const heavy = buildSignatureEvidence({ ...BASE, signatureImage: Buffer.concat([PNG, Buffer.alloc(MAX_SIGNATURE_IMAGE_BYTES)]) });
    expect(heavy.ok || heavy.problems).toContain("L'image de la signature est trop lourde.");
  });
});

describe("signerProblems — cohérence signataire / représentant", () => {
  it("accepte la personne elle-même", () => {
    expect(signerProblems(BASE)).toEqual([]);
  });

  it("refuse la personne seule sous tutelle ou curatelle", () => {
    for (const kind of ["TUTEUR", "CURATEUR"] as const) {
      expect(signerProblems({ ...BASE, representative: { kind, fullName: "Tuteur (fictif)" } })[0]).toContain("représentant légal");
    }
    expect(signerProblems({ ...BASE, representative: { kind: "PROCHE", fullName: "Proche (fictif)" } })).toEqual([]);
  });

  it("exige un représentant enregistré et son nom quand il signe", () => {
    expect(signerProblems({ ...BASE, signerRole: "REPRESENTANT" })[0]).toContain("Aucun représentant");
    const rep = { kind: "TUTEUR" as const, fullName: "Tuteur (fictif)" };
    expect(signerProblems({ ...BASE, signerRole: "REPRESENTANT", representative: rep, signerName: "Tuteur (fictif)" })).toEqual([]);
    expect(signerProblems({ ...BASE, signerRole: "REPRESENTANT", representative: rep, signerName: "Autre" })[0]).toContain("représentant");
  });

  it("refuse un nom vide, un autre nom, ou le service comme signataire", () => {
    expect(signerProblems({ ...BASE, signerName: " " })[0]).toContain("manque");
    expect(signerProblems({ ...BASE, signerName: "Quelqu'un d'autre" })[0]).toContain("ne correspond pas");
    expect(signerProblems({ ...BASE, signerRole: "SERVICE" })[0]).toContain("pas par le service");
  });
});

describe("missingChecklistPoints", () => {
  it("ne réclame que les points des documents présentés", () => {
    expect(missingChecklistPoints(["REGLEMENT_REMIS"], [])).toHaveLength(3);
    expect(missingChecklistPoints(["REGLEMENT_REMIS"], ALL_TICKS)).toEqual([]);
  });
});

describe("renderReceptionSheet — fusion de champs, aucune clause inventée", () => {
  const VALUES: ReceptionFieldValues = {
    "structure.nom": "SAD Les Glycines (fictif)",
    "personne.civilite": "Madame",
    "personne.prenom": "Germaine",
    "personne.nom": "Rousseau (fictif)",
    "signataire.nom": "Germaine Rousseau (fictif)",
    "signataire.qualite": "la personne accompagnée",
    "intervenant.nom": "Intervenant (fictif)",
    "date.remise": "14/10/2026",
    "documents.remis": "Livret d'accueil, Règlement de fonctionnement et DIPC",
  };

  it("remplace les champs connus et ne touche pas au texte du gabarit", () => {
    const template = "Je soussignée {{ signataire.nom }}, {{signataire.qualite}}, atteste avoir reçu : {{documents.remis}}.";
    const result = renderReceptionSheet(template, VALUES);
    expect(result).toEqual({
      ok: true,
      text: "Je soussignée Germaine Rousseau (fictif), la personne accompagnée, atteste avoir reçu : Livret d'accueil, Règlement de fonctionnement et DIPC.",
    });
  });

  it("refuse un champ inconnu ou vide, et l'absence de gabarit", () => {
    expect(renderReceptionSheet("{{personne.adresse}} {{date.remise}}", { ...VALUES, "date.remise": " " })).toEqual({
      ok: false,
      unknownFields: ["personne.adresse"],
      emptyFields: ["date.remise"],
    });
    expect(renderReceptionSheet(null, VALUES).ok).toBe(false);
    expect(renderReceptionSheet("   ", VALUES).ok).toBe(false);
  });

  it("liste les champs du gabarit et décrit les documents présentés", () => {
    expect(placeholdersIn("{{a}} {{ a }} {{b.c}}")).toEqual(["a", "b.c"]);
    expect(describePresentedDocuments(ALL_KINDS)).toBe("Livret d'accueil, Règlement de fonctionnement et DIPC");
    expect(describePresentedDocuments(["DIPC"])).toBe("DIPC");
    expect(describePresentedDocuments([])).toBe("");
  });
});
