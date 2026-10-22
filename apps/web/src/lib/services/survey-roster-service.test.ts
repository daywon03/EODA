import { describe, expect, it } from "vitest";
import {
  EMPTY_ROSTER,
  ROSTER_MAX_PEOPLE,
  addPeople,
  addPersonError,
  buildRosterCsv,
  csvCell,
  dayOf,
  describeRosterImport,
  detectRosterColumns,
  detectSeparator,
  displayName,
  markSurveyDone,
  nextToSurvey,
  parseDelimitedText,
  parseStoredRoster,
  planRosterImport,
  removePerson,
  rosterExportFileName,
  rosterProgress,
  rosterStorageKey,
  searchRoster,
  splitCsvLine,
  splitFullName,
  type Roster,
} from "./survey-roster-service";

// Noms fictifs uniquement (CLAUDE.md §7 : aucune donnée réelle en fixture).
let counter = 0;
const newId = () => `p${(counter += 1)}`;

function rosterOf(...names: [string, string][]): Roster {
  return addPeople(EMPTY_ROSTER, names.map(([lastName, firstName]) => ({ lastName, firstName })), newId);
}

describe("lecture d'un tableau", () => {
  it("détecte le séparateur : tabulation (collage Excel), point-virgule, virgule", () => {
    expect(detectSeparator("Nom\tPrénom\nA\tB")).toBe("\t");
    expect(detectSeparator("Nom;Prénom")).toBe(";");
    expect(detectSeparator("Nom,Prénom")).toBe(",");
    expect(detectSeparator("Seul")).toBe(";");
  });

  it("respecte les guillemets et les guillemets doublés", () => {
    expect(splitCsvLine('"Dupont; fils";"Jean ""Jo"""', ";")).toEqual(["Dupont; fils", 'Jean "Jo"']);
  });

  it("retire le BOM d'un export Excel", () => {
    expect(parseDelimitedText("﻿Nom;Prénom\r\nA;B")).toEqual([["Nom", "Prénom"], ["A", "B"]]);
  });
});

describe("colonnes", () => {
  it("trouve Nom et Prénom au milieu d'un export de logiciel métier", () => {
    expect(detectRosterColumns(["Code", "Civilité", "NOM", "Prénom", "Adresse", "GIR"])).toEqual({ kind: "SPLIT", lastName: 2, firstName: 3, headerRow: true });
    expect(detectRosterColumns(["nom_beneficiaire", "prenom_beneficiaire"])).toEqual({ kind: "SPLIT", lastName: 0, firstName: 1, headerRow: true });
  });

  it("reconnaît une colonne « Nom Prénom » d'un bloc", () => {
    expect(detectRosterColumns(["Matricule", "Nom et prénom"])).toEqual({ kind: "FULL", fullName: 1, headerRow: true });
  });

  it("sans en-tête : deux colonnes = nom puis prénom ; une colonne = bloc", () => {
    expect(detectRosterColumns(["DURAND", "Paul"])).toEqual({ kind: "SPLIT", lastName: 0, firstName: 1, headerRow: false });
    expect(detectRosterColumns(["DURAND Paul"])).toEqual({ kind: "FULL", fullName: 0, headerRow: false });
  });

  it("coupe « NOM Prénom » sur les capitales, sans deviner autrement", () => {
    expect(splitFullName("DE LA FONTAINE Anne-Marie")).toEqual({ lastName: "DE LA FONTAINE", firstName: "Anne-Marie" });
    expect(splitFullName("Paul Durand")).toEqual({ lastName: "Paul Durand", firstName: "" });
    expect(splitFullName("DURAND")).toEqual({ lastName: "DURAND", firstName: "" });
  });
});

describe("planRosterImport", () => {
  it("n'emporte que nom et prénom, jamais les autres colonnes", () => {
    const plan = planRosterImport([
      ["Code", "Nom", "Prénom", "Adresse", "GIR"],
      ["001", "Durand", "Paul", "1 rue X", "3"],
      ["002", "Petit", "Léa", "2 rue Y", "4"],
    ]);
    expect(plan.people).toEqual([
      { lastName: "Durand", firstName: "Paul" },
      { lastName: "Petit", firstName: "Léa" },
    ]);
    expect(JSON.stringify(plan)).not.toContain("rue");
    expect(plan.issues).toEqual([]);
  });

  it("ignore les lignes vides, signale manques et doublons avec le numéro de ligne", () => {
    const existing = rosterOf(["Durand", "Paul"]).people;
    const plan = planRosterImport(
      [["Nom", "Prénom"], ["DURAND", "paul"], [], ["", ""], ["Petit", "Léa"], ["petit", "LEA"], ["x".repeat(81), "A"]],
      existing
    );
    expect(plan.people).toEqual([{ lastName: "Petit", firstName: "Léa" }]);
    expect(plan.issues).toEqual([
      { line: 2, reason: "déjà dans la liste" },
      { line: 6, reason: "déjà dans la liste" },
      { line: 7, reason: "nom trop long" },
    ]);
  });

  it("signale une ligne où le nom manque", () => {
    const plan = planRosterImport([["Nom", "Prénom", "Ville"], ["", "", "Paris"]]);
    expect(plan.issues).toEqual([{ line: 2, reason: "nom manquant" }]);
  });

  it("un prénom seul devient le nom (rien n'est perdu)", () => {
    expect(planRosterImport([["Nom", "Prénom"], ["", "Paul"]]).people).toEqual([{ lastName: "Paul", firstName: "" }]);
  });

  it("borne la liste", () => {
    const rows = Array.from({ length: ROSTER_MAX_PEOPLE + 5 }, (_, i) => [`Nom${i}`, "A"]);
    const plan = planRosterImport(rows);
    expect(plan.people).toHaveLength(ROSTER_MAX_PEOPLE);
    expect(plan.issues.at(-1)?.reason).toBe("liste pleine");
  });

  it("tableau vide : rien à faire", () => {
    expect(planRosterImport([])).toEqual({ people: [], issues: [] });
    expect(planRosterImport([[""], [" "]])).toEqual({ people: [], issues: [] });
  });

  it("décrit le résultat en mots simples", () => {
    expect(describeRosterImport({ people: [{ lastName: "A", firstName: "" }], issues: [] })).toBe("1 personne ajoutée.");
    expect(describeRosterImport({ people: [], issues: [{ line: 3, reason: "nom manquant" }] })).toBe(
      "Aucune personne ajoutée. 1 ligne non prise (ligne 3 : nom manquant)."
    );
    const many = Array.from({ length: 6 }, (_, i) => ({ line: i + 2, reason: "x" }));
    expect(describeRosterImport({ people: [{ lastName: "A", firstName: "" }, { lastName: "B", firstName: "" }], issues: many })).toMatch(/^2 personnes ajoutées\. 6 lignes non prises \(.*…\)\.$/);
  });
});

describe("liste", () => {
  it("trie par nom, sans tenir compte des accents ni de la casse", () => {
    const roster = rosterOf(["Émile", "Z"], ["durand", "B"], ["Durand", "A"]);
    expect(roster.people.map(displayName)).toEqual(["DURAND A", "DURAND B", "ÉMILE Z"]);
  });

  it("refuse un ajout à la main vide, trop long ou en double", () => {
    const roster = rosterOf(["Durand", "Paul"]);
    expect(addPersonError(roster, " ", "Paul")).toBe("Écrivez le nom.");
    expect(addPersonError(roster, "x".repeat(81), "")).toBe("Le nom est trop long.");
    expect(addPersonError(roster, "DURAND", "paul")).toBe("Cette personne est déjà dans la liste.");
    expect(addPersonError(roster, "Durand", "Pauline")).toBeNull();
    const full: Roster = { version: 1, people: Array.from({ length: ROSTER_MAX_PEOPLE }, (_, i) => ({ id: `${i}`, lastName: `N${i}`, firstName: "", done: {} })) };
    expect(addPersonError(full, "Nouveau", "")).toBe("La liste est pleine.");
  });

  it("cherche sans accents, mot par mot", () => {
    const roster = rosterOf(["Lefèvre", "Hélène"], ["Durand", "Paul"]);
    expect(searchRoster(roster, "lefevre hel").map((p) => p.lastName)).toEqual(["Lefèvre"]);
    expect(searchRoster(roster, "  ")).toHaveLength(2);
  });

  it("note la date, jamais les réponses, et propose la personne suivante", () => {
    let roster = rosterOf(["Alpha", "A"], ["Beta", "B"]);
    const [a, b] = roster.people;
    expect(nextToSurvey(roster)?.id).toBe(a!.id);
    roster = markSurveyDone(roster, a!.id, "PERSONNE", "2026-10-22");
    expect(roster.people[0]!.done).toEqual({ PERSONNE: "2026-10-22" });
    expect(nextToSurvey(roster)?.id).toBe(b!.id);
    roster = markSurveyDone(roster, b!.id, "FAMILLE", "2026-10-22");
    expect(rosterProgress(roster)).toEqual({ total: 2, done: 1, families: 1 });
    roster = markSurveyDone(roster, b!.id, "PERSONNE", "2026-10-23");
    expect(nextToSurvey(roster)).toBeNull();
    expect(removePerson(roster, a!.id).people.map((p) => p.id)).toEqual([b!.id]);
  });
});

describe("stockage", () => {
  it("relit ce qu'il a écrit", () => {
    const roster = markSurveyDone(rosterOf(["Durand", "Paul"]), "p-inconnu", "PERSONNE", "2026-10-22");
    expect(parseStoredRoster(JSON.stringify(roster))).toEqual(roster);
  });

  it("rend une liste vide sur toute donnée illisible", () => {
    for (const raw of [null, "", "{", "[]", '{"version":2,"people":[]}', '{"version":1}', '{"version":1,"people":{}}']) {
      expect(parseStoredRoster(raw)).toEqual(EMPTY_ROSTER);
    }
  });

  it("écarte les entrées et les dates invalides", () => {
    const raw = JSON.stringify({
      version: 1,
      people: [null, { id: 1 }, { id: "a", lastName: "Durand\t", firstName: "Paul", done: { PERSONNE: "hier", FAMILLE: "2026-10-01", AUTRE: "2026-10-01" } }],
    });
    expect(parseStoredRoster(raw).people).toEqual([{ id: "a", lastName: "Durand", firstName: "Paul", done: { FAMILLE: "2026-10-01" } }]);
  });

  it("une clé par structure", () => {
    expect(rosterStorageKey("e1")).not.toBe(rosterStorageKey("e2"));
  });

  it("le jour est local, sans heure", () => {
    expect(dayOf(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("export pour le logiciel métier", () => {
  it("CSV « ; » avec BOM, dates en JJ/MM/AAAA", () => {
    let roster = rosterOf(["Durand", "Paul"], ["Petit", "Léa"]);
    roster = markSurveyDone(roster, roster.people[0]!.id, "PERSONNE", "2026-10-22");
    const csv = buildRosterCsv(roster);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      "Nom;Prénom;Enquête personne faite le;Enquête proche faite le",
      "Durand;Paul;22/10/2026;",
      "Petit;Léa;;",
      "",
    ]);
  });

  it("neutralise une formule et protège les séparateurs", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("Dupont; fils")).toBe('"Dupont; fils"');
    expect(csvCell("Durand")).toBe("Durand");
  });

  it("nomme le fichier selon la convention EODA", () => {
    expect(rosterExportFileName("SAD Les Tilleuls", new Date(2026, 9, 22))).toBe("20261022_ENQUETE_SAD-Les-Tilleuls_Suivi-participation_v01_Interne.csv");
    expect(rosterExportFileName("***", new Date(2026, 9, 22))).toBe("20261022_ENQUETE_Structure_Suivi-participation_v01_Interne.csv");
  });
});
