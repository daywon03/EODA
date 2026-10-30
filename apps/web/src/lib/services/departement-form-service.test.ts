import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { DEPARTEMENT_FORM, departementFormFileName, departementFormGaps, departementFormSigner, planDepartementForm, type FormItem } from "./departement-form-service";
import { fillOfficialForm, OfficialFormMismatchError } from "./departement-form-pdf";
import { EMPTY_AID, EMPTY_CONTACT, EMPTY_IDENTITY, type AdmissionRecord } from "./admission-service";

// Personne FICTIVE.
const record: AdmissionRecord = {
  version: 1,
  id: "r1",
  personId: "p1",
  identity: { ...EMPTY_IDENTITY, civility: "MADAME", birthName: "Exemple", usedName: "Martin", firstName: "Paulette", birthDate: "1938-04-12", address: "1 rue Fictive", postalCode: "93150", city: "Ville-Fictive" },
  aid: { kinds: ["APA"], startDate: "2026-11-02", weekdayHours: "20", sundayHours: "2,5" },
  contact: { ...EMPTY_CONTACT, kind: "PROCHE_AIDANT", lastName: "Exemple", firstName: "Luc", postalCode: "93 150" },
  explanationsVersion: 1,
  explained: {},
  handed: {},
  signers: ["PERSONNE", "SERVICE"],
  signedAt: "2026-10-27T10:00:00.000Z",
  staffName: "Camille",
  dipc: { versionId: "v", versionNumber: 2, validatedOn: "2026-10-07", sha256: "0" },
  pdfFileName: "x.pdf",
  pdfSha256: "0",
  outcome: "SIGNE",
  refusal: null,
  trustedPerson: null,
  word: null,
  devis: null,
  recap: null,
};
const structure = { name: "SAD Fictif", address: "1 avenue Fictive – 93000 Ville" };
const base = { record, structure, certifies: true, acceptsTransmission: true, signedOn: new Date("2026-10-27T10:00:00Z"), withSignature: true, withStamp: false };
const PNG_1X1 = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));


const texts = (items: FormItem[], page: number) => items.filter((i): i is Extract<FormItem, { kind: "text" }> => i.kind === "text" && i.page === page).map((i) => i.text);
const checks = (items: FormItem[], page: number) => items.filter((i) => i.kind === "check" && i.page === page).length;

describe("planDepartementForm", () => {
  const items = planDepartementForm(base);

  it("la signature reprise du contrat est celle de la personne, ou du tuteur sous tutelle — jamais celle du service", () => {
    expect(departementFormSigner({ contact: null })).toBe("PERSONNE");
    expect(departementFormSigner({ contact: { ...EMPTY_CONTACT, kind: "CURATEUR" } })).toBe("PERSONNE");
    expect(departementFormSigner({ contact: { ...EMPTY_CONTACT, kind: "TUTEUR" } })).toBe("REPRESENTANT");
  });

  it("page 1 : identité, date de naissance et code postal chiffre par chiffre, aide cochée", () => {
    expect(texts(items, 0)).toEqual(expect.arrayContaining(["EXEMPLE", "Paulette", "MARTIN", "1 rue Fictive", "Ville-Fictive"]));
    expect(texts(items, 0).filter((t) => /^\d$/.test(t)).join("")).toBe("1204193893150");
    expect(checks(items, 0)).toBe(1);
  });

  it("page 2 : la structure en SAD 1, les heures (APA : semaine et dimanche), le proche", () => {
    expect(texts(items, 1)).toEqual(expect.arrayContaining(["SAD Fictif", "1 avenue Fictive – 93000 Ville", "02/11/2026", "22,5 h", "20 h", "2,5 h", "EXEMPLE", "Luc"]));
    expect(texts(items, 1).filter((t) => /^\d$/.test(t)).join("")).toBe("93150");
    expect(checks(items, 1)).toBe(1);
  });

  it("le tampon de la structure va dans la case « SAD 1 », sous l'adresse, centré — seulement s'il y en a un", () => {
    expect(items.some((i) => i.kind === "image" && i.source === "stamp")).toBe(false);
    const stamped = planDepartementForm({ ...base, withStamp: true }).filter((i) => i.kind === "image" && i.source === "stamp");
    expect(stamped).toEqual([{ page: 1, kind: "image", source: "stamp", x: 86, y: 565, maxWidth: 186, maxHeight: 48, center: true }]);
    // Dans la cellule mesurée (x 82 → 275, y 562,5 → 694,3), sous la troisième ligne
    // d'adresse (y 643,9 − 2 × 12 ≈ 620, jambages compris ≈ 617).
    const [s] = stamped as Extract<FormItem, { kind: "image" }>[];
    expect(s!.x).toBeGreaterThan(82);
    expect(s!.x + s!.maxWidth).toBeLessThan(275);
    expect(s!.y).toBeGreaterThan(562.5);
    expect(s!.y + s!.maxHeight).toBeLessThan(617);
  });

  it("hors APA, ni semaine ni dimanche (« Pour l'APA, préciser »)", () => {
    const pch = planDepartementForm({ ...base, record: { ...record, aid: { ...record.aid, kinds: ["PCH"] } } });
    expect(texts(pch, 1)).not.toContain("20 h");
    expect(texts(pch, 1)).toContain("22,5 h");
  });

  it("page 3 : la personne déclare en son nom ; les déclarations ne se cochent que si elle les a acceptées", () => {
    expect(texts(items, 2)).toEqual(["Paulette MARTIN", "27/10/2026"]);
    expect(checks(items, 2)).toBe(4); // Mme, en mon nom propre, certifie, accepte
    const refused = planDepartementForm({ ...base, certifies: false, acceptsTransmission: false, withSignature: false });
    expect(checks(refused, 2)).toBe(2);
    expect(refused.some((i) => i.kind === "image")).toBe(false);
  });

  it("sous tutelle, le tuteur déclare en qualité de représentant légal de la personne", () => {
    const tutor = planDepartementForm({ ...base, record: { ...record, contact: { ...EMPTY_CONTACT, kind: "TUTEUR", lastName: "Tutelle", firstName: "Anne" } } });
    expect(texts(tutor, 2)).toEqual(["Anne TUTELLE", "Paulette MARTIN", "27/10/2026"]);
  });

  it("ce qui manque est dit avant de fabriquer le formulaire", () => {
    expect(departementFormGaps(record)).toEqual([]);
    expect(departementFormGaps({ ...record, identity: EMPTY_IDENTITY, aid: EMPTY_AID, contact: null })).toEqual([
      "la date de naissance",
      "l'adresse complète",
      "l'aide (APA, PCH ou aide-ménagère)",
      "la date de début d'intervention",
      "le nombre d'heures",
      "le proche à contacter",
    ]);
    expect(departementFormFileName("SAD Fictif", record, new Date("2026-10-27T10:00:00Z"))).toBe("20261027_DESIGNATION-SAD_SAD-Fictif_Martin-Paulette_v01_Externe.pdf");
  });
});

describe("fillOfficialForm", () => {
  const official = new Uint8Array(readFileSync(path.resolve(__dirname, "../../../public/formulaires/93-designation-sad-declaration-initiale-2026.pdf")));
  const sha = createHash("sha256").update(official).digest("hex");

  it("le fichier livré est bien celui dont les positions ont été mesurées", () => {
    expect(sha).toBe(DEPARTEMENT_FORM.sha256);
  });

  it("remplit les trois pages du formulaire officiel", async () => {
    const bytes = await fillOfficialForm({ officialPdf: official, officialSha256: DEPARTEMENT_FORM.sha256, actualSha256: sha, items: planDepartementForm({ ...base, withSignature: false }), signaturePng: null });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
  });

  it("pose la signature et le tampon quand ils sont fournis", async () => {
    const bytes = await fillOfficialForm({
      officialPdf: official,
      officialSha256: DEPARTEMENT_FORM.sha256,
      actualSha256: sha,
      items: planDepartementForm({ ...base, withStamp: true }),
      signaturePng: PNG_1X1,
      stampPng: PNG_1X1,
    });
    const blank = await fillOfficialForm({ officialPdf: official, officialSha256: DEPARTEMENT_FORM.sha256, actualSha256: sha, items: planDepartementForm(base), signaturePng: null });
    expect(bytes.length).toBeGreaterThan(blank.length);
  });

  it("refuse un autre formulaire que celui mesuré : il écrirait à côté des cases", async () => {
    await expect(fillOfficialForm({ officialPdf: official, officialSha256: DEPARTEMENT_FORM.sha256, actualSha256: "autre", items: [], signaturePng: null })).rejects.toBeInstanceOf(OfficialFormMismatchError);
  });
});
