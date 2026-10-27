import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  CHANGE_FORM,
  changeFormFileName,
  changeFormProblems,
  defaultActiveServices,
  planChangeForm,
  type ChangeFormInput,
} from "./departement-change-form-service";
import { fillOfficialForm } from "./departement-form-pdf";
import type { FormItem } from "./departement-form-service";
import { EMPTY_CONTACT, EMPTY_IDENTITY, type AdmissionRecord } from "./admission-service";

// Personne FICTIVE.
const record: AdmissionRecord = {
  version: 1,
  id: "r1",
  personId: "p1",
  identity: { ...EMPTY_IDENTITY, civility: "MONSIEUR", birthName: "Exemple", firstName: "Paul", birthDate: "1940-02-03", postalCode: "93150" },
  aid: { kinds: ["APA"], startDate: "2026-11-02", weekdayHours: "20", sundayHours: "2" },
  contact: { ...EMPTY_CONTACT, kind: "TUTEUR", lastName: "Tutelle", firstName: "Anne" },
  explanationsVersion: 1,
  explained: {},
  handed: {},
  signers: ["REPRESENTANT", "SERVICE"],
  signedAt: "2026-10-27T10:00:00.000Z",
  staffName: "Camille",
  dipc: { versionId: "v", versionNumber: 2, validatedOn: "2026-10-07", sha256: "0" },
  pdfFileName: "x.pdf",
  pdfSha256: "0",
  outcome: "SIGNE",
  refusal: null,
  trustedPerson: null,
  word: null,
};
const structure = { name: "SAD Fictif", address: "1 avenue Fictive" };
const today = new Date("2026-10-27T10:00:00Z");
const base: ChangeFormInput = {
  record,
  stopped: [{ name: "Ancien service", address: "2 rue X", endDate: "2026-10-31" }],
  newService: "EN_COMPLEMENT",
  hoursChange: true,
  services: defaultActiveServices(record, structure, today),
  certifies: true,
  replacesPrevious: true,
  acceptsTransmission: false,
  signedOn: today,
  withSignature: true,
};

const texts = (items: FormItem[], page: number) => items.filter((i): i is Extract<FormItem, { kind: "text" }> => i.kind === "text" && i.page === page).map((i) => i.text);
const checksAt = (items: FormItem[], page: number) => items.filter((i): i is Extract<FormItem, { kind: "check" }> => i.kind === "check" && i.page === page).map((i) => `${i.cx}@${i.y}`);

describe("planChangeForm", () => {
  const items = planChangeForm(base);

  it("page 1 : identité et aide aux positions de CE formulaire", () => {
    expect(texts(items, 0)).toEqual(expect.arrayContaining(["EXEMPLE", "Paul"]));
    expect(texts(items, 0).filter((t) => /^\d$/.test(t)).join("")).toBe("0302194093150");
    expect(checksAt(items, 0)).toEqual(["39.3@101.5"]);
  });

  it("page 2 : arrêt, nouveau service EN COMPLÉMENT, heures, et les tableaux", () => {
    expect(checksAt(items, 1)).toEqual(["39.3@708.2", "39.3@490.9", "81.9@451.9", "39.3@432.5"]);
    expect(texts(items, 1)).toEqual(["Ancien service", "2 rue X", "31/10/2026", "SAD Fictif", "1 avenue Fictive", "02/11/2026", "20", "2"]);
  });

  it("page 3 : sous tutelle, le tuteur déclare ; seules les déclarations acceptées sont cochées", () => {
    expect(texts(items, 2)).toEqual(["TUTELLE", "Anne", "Anne TUTELLE", "Paul EXEMPLE", "27/10/2026"]);
    // tuteur coché, « représentant légal de », M., certifie, annule et remplace — pas « accepte ».
    expect(checksAt(items, 2)).toEqual(["168.9@736.9", "74.7@512.9", "312.3@512.9", "39.3@493.4", "39.3@448.1"]);
    expect(items.filter((i) => i.kind === "image")).toHaveLength(1);
  });

  it("aucun service arrêté ni changement d'heures : ni case, ni tableau", () => {
    const only = planChangeForm({ ...base, stopped: [], hoursChange: false, newService: "A_LA_PLACE" });
    expect(checksAt(only, 1)).toEqual(["39.3@490.9", "81.9@471.5"]);
  });
});

describe("changeFormProblems", () => {
  it("exige au moins un changement, et qui / quand dans chaque tableau rempli", () => {
    expect(changeFormProblems(base)).toEqual([]);
    expect(changeFormProblems({ stopped: [], newService: "", hoursChange: false, services: [] })).toEqual([
      "Cochez au moins un changement : arrêt d'un service, nouveau service, ou nombre d'heures.",
    ]);
    expect(changeFormProblems({ ...base, stopped: [{ name: "X", address: "", endDate: "" }] })).toContain("Pour chaque service arrêté, écrivez son nom et la date de fin.");
    expect(changeFormProblems({ ...base, services: [] })).toContain("Écrivez les services qui interviennent au domicile, avec la date et les heures.");
    expect(changeFormProblems({ ...base, services: [{ name: "Y", address: "", date: "", weekdayHours: "3", sundayHours: "" }] })).toContain(
      "Pour chaque service qui intervient, écrivez son nom et la date de début ou d'effet."
    );
  });

  it("la structure est proposée en première ligne, avec les heures de la fiche", () => {
    expect(defaultActiveServices(record, structure, today)).toEqual([{ name: "SAD Fictif", address: "1 avenue Fictive", date: "2026-11-02", weekdayHours: "20", sundayHours: "2" }]);
    expect(changeFormFileName("SAD Fictif", record, today)).toBe("20261027_CHANGEMENT-SITUATION_SAD-Fictif_Exemple-Paul_v01_Externe.pdf");
  });
});

describe("formulaire officiel « changement de situation »", () => {
  const official = new Uint8Array(readFileSync(path.resolve(__dirname, "../../../public/formulaires/93-designation-saad-changement-situation-v1.pdf")));

  it("le fichier livré est celui dont les positions ont été mesurées, et se remplit", async () => {
    const sha = createHash("sha256").update(official).digest("hex");
    expect(sha).toBe(CHANGE_FORM.sha256);
    const bytes = await fillOfficialForm({ officialPdf: official, officialSha256: CHANGE_FORM.sha256, actualSha256: sha, items: planChangeForm({ ...base, withSignature: false }), signaturePng: null });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
  });
});
