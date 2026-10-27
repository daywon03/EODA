import { describe, expect, it } from "vitest";
import { ADMISSION_HANDED_DOCUMENTS, allAdmissionPoints } from "@/content/admission/explications";
import {
  admissionArchiveFileName,
  admissionDatabaseName,
  admissionFieldValues,
  admissionPdfFileName,
  buildAdmissionsCsv,
  contactProblems,
  defaultDuration,
  dipcEntryValues,
  durationProblems,
  EMPTY_AID,
  EMPTY_CONTACT,
  EMPTY_FIELD_MARK,
  EMPTY_IDENTITY,
  fullName,
  identityProblems,
  isAdmissionDueForReview,
  latestAdmissionFor,
  mergeDipcText,
  parseStoredAdmission,
  requiredSigners,
  signingProblems,
  type AdmissionContact,
  type AdmissionIdentity,
  type AdmissionRecord,
  type SigningDraft,
} from "./admission-service";

// Personnes FICTIVES (CLAUDE.md : jamais de vraie personne dans un test).
const today = new Date("2026-10-26T10:00:00Z");
const identity: AdmissionIdentity = {
  ...EMPTY_IDENTITY,
  civility: "MADAME",
  birthName: "Durand",
  usedName: "Martin",
  firstName: "Paulette",
  birthDate: "1938-04-12",
  address: "1 rue Fictive",
  postalCode: "93000",
  city: "Ville-Fictive",
};
const tutor: AdmissionContact = { ...EMPTY_CONTACT, kind: "TUTEUR", lastName: "Leroy", firstName: "Marc" };

const allExplained = Object.fromEntries(allAdmissionPoints().map((p) => [p.id, "2026-10-26T09:00:00Z"]));
const allHanded = Object.fromEntries(ADMISSION_HANDED_DOCUMENTS.map((d) => [d.id, "2026-10-26T09:05:00Z"]));

function draft(overrides: Partial<SigningDraft> = {}): SigningDraft {
  return {
    identity,
    aid: EMPTY_AID,
    contact: null,
    explained: allExplained,
    handed: allHanded,
    signatures: { PERSONNE: "png", SERVICE: "png" },
    unknownDipcFields: [],
    ...overrides,
  };
}

function record(overrides: Partial<AdmissionRecord> = {}): AdmissionRecord {
  return {
    version: 1,
    id: "r1",
    personId: "p1",
    identity,
    aid: EMPTY_AID,
    contact: null,
    explanationsVersion: 1,
    explained: allExplained,
    handed: allHanded,
    signers: ["PERSONNE", "SERVICE"],
    signedAt: "2026-10-26T09:10:00.000Z",
    staffName: "Camille (fictif)",
    dipc: { versionId: "v1", versionNumber: 3, validatedOn: "2026-10-01", sha256: "a".repeat(64) },
    pdfFileName: "f.pdf",
    pdfSha256: "b".repeat(64),
    ...overrides,
  };
}

describe("identité", () => {
  it("exige nom de naissance et prénom, contrôle la forme du reste", () => {
    expect(identityProblems(EMPTY_IDENTITY, today)).toEqual(["Écrivez le nom de naissance.", "Écrivez le prénom."]);
    expect(identityProblems(identity, today)).toEqual([]);
    expect(identityProblems({ ...identity, birthDate: "2026-02-30" }, today)).toContain("La date de naissance n'est pas valide.");
    expect(identityProblems({ ...identity, birthDate: "2030-01-01" }, today)).toContain("La date de naissance est dans le futur.");
    expect(identityProblems({ ...identity, postalCode: "930" }, today)).toContain("Le code postal de la personne doit avoir 5 chiffres.");
    expect(identityProblems({ ...identity, email: "pas-un-mail" }, today)).toContain("L'adresse e-mail de la personne n'est pas valide.");
  });

  it("nom affiché = nom d'usage s'il existe, en capitales", () => {
    expect(fullName(identity)).toBe("MARTIN Paulette");
    expect(fullName({ ...identity, usedName: "" })).toBe("DURAND Paulette");
  });
});

describe("proche ou représentant", () => {
  it("« Autre » exige sa précision (règle partagée), un nom est exigé", () => {
    expect(contactProblems(null)).toEqual([]);
    expect(contactProblems({ ...EMPTY_CONTACT, kind: "AUTRE", lastName: "X" })).toEqual(["Précisez le lien avec la personne lorsque vous choisissez « Autre »."]);
    expect(contactProblems({ ...EMPTY_CONTACT, kind: "PROCHE_AIDANT" })).toEqual(["Écrivez le nom du proche ou du représentant."]);
  });
});

describe("qui signe", () => {
  it("tutelle : le tuteur signe à la place ; curatelle : la personne ET le curateur ; toujours le service", () => {
    expect(requiredSigners(null)).toEqual(["PERSONNE", "SERVICE"]);
    expect(requiredSigners({ ...EMPTY_CONTACT, kind: "PROCHE_AIDANT" })).toEqual(["PERSONNE", "SERVICE"]);
    expect(requiredSigners(tutor)).toEqual(["REPRESENTANT", "SERVICE"]);
    expect(requiredSigners({ ...tutor, kind: "CURATEUR" })).toEqual(["PERSONNE", "REPRESENTANT", "SERVICE"]);
  });
});

describe("signingProblems", () => {
  it("rien ne manque : on peut signer", () => {
    expect(signingProblems(draft(), today)).toEqual([]);
  });

  it("un point non expliqué, un document non remis, une signature manquante bloquent", () => {
    const explained = Object.fromEntries(Object.entries(allExplained).filter(([id]) => id !== "personne-confiance"));
    const handed = Object.fromEntries(Object.entries(allHanded).filter(([id]) => id !== "charte"));
    const problems = signingProblems(draft({ explained, handed, signatures: { PERSONNE: "png" } }), today);
    expect(problems).toContain("1 point à expliquer.");
    expect(problems).toContain("Documents pas encore remis : Charte des droits et libertés de la personne accueillie.");
    expect(problems).toContain("Signature manquante : pour le service.");
  });

  it("sous tutelle, la signature de la personne seule ne suffit pas", () => {
    expect(signingProblems(draft({ contact: tutor }), today)).toContain("Signature manquante : son représentant légal.");
  });

  it("un champ inconnu dans le DIPC bloque : c'est à EODA de le corriger", () => {
    expect(signingProblems(draft({ unknownDipcFields: ["personne.nmo"] }), today)[0]).toMatch(/champ inconnu \(personne\.nmo\)/);
  });
});

describe("champs du DIPC", () => {
  const values = admissionFieldValues({ structureName: "SAD Fictif", identity, aid: { ...EMPTY_AID, kinds: ["APA"], weekdayHours: "20" }, contact: tutor, staffName: "Camille", signedOn: today });

  it("la fiche saisie une fois remplit les champs", () => {
    expect(values["personne.nom"]).toBe("MARTIN");
    expect(values["personne.nom_naissance"]).toBe("DURAND");
    expect(values["personne.date_naissance"]).toBe("12/04/1938");
    expect(values["aide.types"]).toBe("Allocation personnalisée d'autonomie (APA)");
    expect(values["proche.lien"]).toBe("Tuteur");
    expect(values["date.signature"]).toBe("26/10/2026");
  });

  it("fusionne, laisse une ligne à compléter pour un champ vide, signale un champ inconnu", () => {
    const merged = mergeDipcText("Entre {{structure.nom}} et {{ personne.prenom }} {{personne.nom}}, tél. {{personne.telephone}} {{personne.inconnu}}", values);
    expect(merged.text).toBe(`Entre SAD Fictif et Paulette MARTIN, tél. ${EMPTY_FIELD_MARK} {{personne.inconnu}}`);
    expect(merged.unknownFields).toEqual(["personne.inconnu"]);
    expect(merged.emptyFields).toEqual(["personne.telephone"]);
  });
});

describe("fichiers et export", () => {
  it("noms de fichiers à la convention EODA", () => {
    expect(admissionPdfFileName("SAD Les Glycines", identity, today)).toBe("20261026_DIPC_SAD-Les-Glycines_Martin-Paulette_v01_Externe.pdf");
    expect(admissionArchiveFileName("SAD Les Glycines", today)).toBe("20261026_DIPC_SAD-Les-Glycines_Contrats-signes_v01_Interne.zip");
  });

  it("index CSV : une ligne par contrat, formules neutralisées, BOM pour Excel", () => {
    const csv = buildAdmissionsCsv([record({ identity: { ...identity, city: "=CMD()" } })]);
    expect(csv.startsWith("﻿Nom de naissance;")).toBe(true);
    expect(csv).toContain("DURAND;MARTIN;Paulette;12/04/1938;93000;'=CMD();;v3;26/10/2026;La personne accompagnée + Pour le service;f.pdf;" + "b".repeat(64));
  });

  it("la base de la tablette porte la structure", () => {
    expect(admissionDatabaseName("etab1")).toBe("eoda.tablette.dipc.v1.etab1");
  });
});

describe("liste et révision", () => {
  it("dernier contrat d'une personne, révision annuelle due", () => {
    const old = record({ id: "old", signedAt: "2025-09-01T09:00:00.000Z" });
    const recent = record({ id: "new", signedAt: "2026-10-01T09:00:00.000Z" });
    expect(latestAdmissionFor([old, recent], "p1")?.id).toBe("new");
    expect(latestAdmissionFor([old], "autre")).toBeNull();
    expect(isAdmissionDueForReview(old, today)).toBe(true);
    expect(isAdmissionDueForReview(recent, today)).toBe(false);
  });
});

describe("parseStoredAdmission (le stockage peut rendre n'importe quoi)", () => {
  it("relit un enregistrement valide à l'identique", () => {
    const r = record({ contact: tutor });
    expect(parseStoredAdmission(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });

  it("rejette ce qui n'est pas un contrat, borne les champs", () => {
    expect(parseStoredAdmission(null)).toBeNull();
    expect(parseStoredAdmission({ version: 2 })).toBeNull();
    expect(parseStoredAdmission({ ...record(), pdfSha256: 3 })).toBeNull();
    const parsed = parseStoredAdmission({ ...record(), identity: { ...identity, firstName: "x".repeat(500), civility: "ROI" }, signers: ["PERSONNE", "PIRATE"] });
    expect(parsed?.identity.firstName.length).toBe(120);
    expect(parsed?.identity.civility).toBe("");
    expect(parsed?.signers).toEqual(["PERSONNE"]);
  });
});

describe("durée du contrat", () => {
  const choice = {
    options: [
      { number: 1, label: "Le présent contrat est conclu pour une durée indéterminée", hasDates: false },
      { number: 2, label: "Le présent contrat est conclu pour une durée déterminée du JJ/MM/AAAA au JJ/MM/AAAA", hasDates: true },
    ],
  };
  const prepared = { freeFields: [], checkFields: [], durationChoice: choice };

  it("la durée indéterminée est proposée d'emblée (CASF L347-1) ; un choix est exigé", () => {
    expect(defaultDuration(choice)).toEqual({ choice: 1, start: "", end: "" });
    expect(defaultDuration(null)).toEqual({ choice: null, start: "", end: "" });
    expect(durationProblems(choice, { choice: null, start: "", end: "" })).toEqual(["Choisissez la durée du contrat."]);
    expect(durationProblems(null, { choice: null, start: "", end: "" })).toEqual([]);
  });

  it("à durée déterminée : deux dates valides, dans l'ordre", () => {
    expect(durationProblems(choice, { choice: 2, start: "", end: "" })).toEqual(["Écrivez les dates de début et de fin du contrat."]);
    expect(durationProblems(choice, { choice: 2, start: "2027-01-01", end: "2026-01-01" })).toEqual(["La date de fin du contrat est avant la date de début."]);
    expect(durationProblems(choice, { choice: 2, start: "2026-11-02", end: "2027-11-01" })).toEqual([]);
  });

  it("l'option choisie est cochée, l'autre non ; les dates ne s'écrivent que pour la durée déterminée", () => {
    expect(dipcEntryValues(prepared, {}, {}, { choice: 1, start: "2026-11-02", end: "2027-11-01" })).toEqual({
      "duree.option1": "☒",
      "duree.option2": "☐",
      "duree.debut": "",
      "duree.fin": "",
    });
    expect(dipcEntryValues(prepared, {}, {}, { choice: 2, start: "2026-11-02", end: "2027-11-01" })).toMatchObject({
      "duree.option1": "☐",
      "duree.option2": "☒",
      "duree.debut": "02/11/2026",
      "duree.fin": "01/11/2027",
    });
  });
});
