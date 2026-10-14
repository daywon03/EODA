import { describe, expect, it } from "vitest";
import {
  ACTION_FILTER_LABELS,
  FUNCTION_LABELS,
  actionPill,
  assignmentError,
  canActorActOnItem,
  countActionFilters,
  describeActionForAudit,
  describeEmptyTaskList,
  describeOwner,
  isOverdue,
  isVisibleToClient,
  parseActionFilter,
  selectTodayTasks,
  sortActionItems,
  titleError,
  type ActionItemFacts,
} from "./action-item-service";
import { deriveNextActions } from "./structure-sheet-service";

const NOW = new Date(2026, 9, 12, 15, 0); // 12/10/2026, 15 h, heure locale
// `dueOn` est une colonne DATE : relue à minuit UTC.
const day = (d: number): Date => new Date(Date.UTC(2026, 9, d));

function item(overrides: Partial<ActionItemFacts> = {}): ActionItemFacts {
  return {
    id: "a",
    title: "Compléter le livret d'accueil",
    ownerKind: "STRUCTURE",
    ownerUserId: null,
    ownerFunction: null,
    dueOn: null,
    doneAt: null,
    source: "MANUEL",
    ...overrides,
  };
}

describe("« en retard » est dérivé, au jour", () => {
  it("échéance d'hier pas faite : en retard ; aujourd'hui : pas encore", () => {
    expect(isOverdue(item({ dueOn: day(11) }), NOW)).toBe(true);
    expect(isOverdue(item({ dueOn: day(12) }), NOW)).toBe(false);
    expect(isOverdue(item({ dueOn: day(11), doneAt: NOW }), NOW)).toBe(false);
    expect(isOverdue(item(), NOW)).toBe(false);
  });

  it("pastille glyphe + mot", () => {
    expect(actionPill(item({ dueOn: day(1) }), NOW).label).toBe("En retard");
    expect(actionPill(item({ doneAt: NOW }), NOW).label).toBe("Fait");
    expect(actionPill(item(), NOW).label).toBe("À faire");
  });
});

describe("filtres", () => {
  const items = [
    item({ id: "1", ownerUserId: "me", dueOn: day(1) }),
    item({ id: "2", ownerKind: "CABINET" }),
    item({ id: "3", doneAt: NOW }),
    item({ id: "4", ownerUserId: "other" }),
  ];

  it("compte chaque liste", () => {
    expect(countActionFilters(items, "me", NOW)).toEqual({ EN_COURS: 3, MIENNES: 1, EODA: 1, EN_RETARD: 1, TERMINEES: 1 });
  });

  it("une valeur inconnue revient à « En cours »", () => {
    expect(parseActionFilter("EN_RETARD")).toBe("EN_RETARD");
    expect(parseActionFilter("DROP TABLE")).toBe("EN_COURS");
    expect(parseActionFilter(["EODA"])).toBe("EN_COURS");
    expect(Object.keys(ACTION_FILTER_LABELS)).toHaveLength(5);
  });

  it("trie : en retard, puis par échéance, sans échéance à la fin", () => {
    const sorted = sortActionItems(
      [item({ id: "x", title: "B" }), item({ id: "y", dueOn: day(20) }), item({ id: "z", dueOn: day(2) }), item({ id: "w", title: "A" })],
      NOW
    );
    expect(sorted.map((i) => i.id)).toEqual(["z", "y", "w", "x"]);
  });
});

describe("droits", () => {
  const client = { side: "CLIENT", userId: "me" } as const;

  it("le cabinet agit sur tout ; le client sur la structure ou sur lui seul", () => {
    expect(canActorActOnItem({ side: "CABINET" }, item({ ownerKind: "CABINET" }))).toBe(true);
    expect(canActorActOnItem(client, item())).toBe(true);
    expect(canActorActOnItem(client, item({ ownerUserId: "me" }))).toBe(true);
    expect(canActorActOnItem(client, item({ ownerUserId: "collegue" }))).toBe(false);
    expect(canActorActOnItem(client, item({ ownerKind: "CABINET" }))).toBe(false);
  });

  it("le client ne voit pas les tâches internes d'EODA", () => {
    expect(isVisibleToClient(item({ ownerKind: "CABINET" }))).toBe(false);
    expect(isVisibleToClient(item())).toBe(true);
  });

  it("une personne désignée doit être du bon côté ; un client ne confie pas à EODA", () => {
    const eligible = { cabinetUserIds: new Set(["eoda-1"]), structureUserIds: new Set(["me", "collegue"]) };
    expect(assignmentError({ side: "CABINET" }, { ownerKind: "CABINET", ownerUserId: "eoda-1" }, eligible)).toBeNull();
    expect(assignmentError({ side: "CABINET" }, { ownerKind: "CABINET", ownerUserId: "collegue" }, eligible)).not.toBeNull();
    expect(assignmentError({ side: "CABINET" }, { ownerKind: "STRUCTURE", ownerUserId: "inconnu" }, eligible)).not.toBeNull();
    expect(assignmentError(client, { ownerKind: "STRUCTURE", ownerUserId: "collegue" }, eligible)).toBeNull();
    expect(assignmentError(client, { ownerKind: "CABINET", ownerUserId: null }, eligible)).not.toBeNull();
  });

  it("titre exigé et borné ; journal sans texte libre", () => {
    expect(titleError("  ")).not.toBeNull();
    expect(titleError("x".repeat(201))).not.toBeNull();
    expect(titleError("Afficher la charte")).toBeNull();
    expect(describeActionForAudit(item({ source: "PAC" }))).toBe("PAC · STRUCTURE");
  });
});

describe("responsable affiché et tâches du jour", () => {
  it("une personne, sinon la fonction, sinon le côté — « EODA », jamais un prénom", () => {
    expect(describeOwner({ ...item(), ownerName: "Direction Test" })).toBe("Direction Test");
    expect(describeOwner({ ...item({ ownerFunction: "RESPONSABLE_QUALITE" }), ownerName: null })).toBe(
      FUNCTION_LABELS.RESPONSABLE_QUALITE
    );
    expect(describeOwner({ ...item({ ownerKind: "CABINET" }), ownerName: null })).toBe("EODA");
    expect(describeOwner({ ...item(), ownerName: null })).toBe("La structure");
  });

  it("tâches du jour : les miennes, échues aujourd'hui ou en retard, pas faites", () => {
    const today = selectTodayTasks(
      [
        item({ id: "1", ownerUserId: "me", dueOn: day(12) }),
        item({ id: "2", ownerUserId: "me", dueOn: day(13) }),
        item({ id: "3", ownerUserId: "me", dueOn: day(3) }),
        item({ id: "4", ownerUserId: "other", dueOn: day(3) }),
        item({ id: "5", ownerUserId: "me", dueOn: day(3), doneAt: NOW }),
      ],
      "me",
      NOW
    );
    expect(today.map((t) => t.id)).toEqual(["3", "1"]);
  });

  it("les prochaines actions de la vue d'ensemble incluent les tâches ouvertes", () => {
    const actions = deriveNextActions({
      establishmentId: "e1",
      documents: [],
      appointments: [],
      now: NOW,
      tasks: [
        { ...item({ id: "t1", dueOn: day(1) }), ownerName: null },
        { ...item({ id: "t2", doneAt: NOW }), ownerName: null },
      ],
    });
    expect(actions.map((a) => a.id)).toEqual(["task-t1"]);
    expect(actions[0]?.href).toContain("plan-action");
    expect(actions[0]?.detail).toContain("La structure");
  });
});

describe("describeEmptyTaskList", () => {
  it("intervenant : dit que rien ne lui est encore confié, pas que tout est fait", () => {
    expect(describeEmptyTaskList("EN_COURS", { ownOnly: true })).toContain("ne vous est confiée");
    expect(describeEmptyTaskList("MIENNES", { ownOnly: true })).toContain("ne vous est confiée");
  });

  it("une phrase propre à chaque filtre, pour les autres rôles", () => {
    const phrases = (["EN_COURS", "MIENNES", "EODA", "EN_RETARD", "TERMINEES"] as const).map((f) =>
      describeEmptyTaskList(f, { ownOnly: false })
    );
    expect(new Set(phrases).size).toBe(5);
    expect(describeEmptyTaskList("EN_COURS", { ownOnly: false })).toContain("tout ce qui était prévu est fait");
    expect(describeEmptyTaskList("TERMINEES", { ownOnly: true })).toBe("Aucune tâche terminée pour l'instant.");
  });
});
