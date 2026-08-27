import { describe, expect, it } from "vitest";
import {
  appointmentRangeError,
  buildMonthGrid,
  CALENDAR_WEEKS,
  findOverlaps,
  groupByDay,
  isSameDay,
  selectUpcoming,
  startOfWeekMonday,
  type CalendarAppointment,
} from "./calendar-service";

function appointment(overrides: Partial<CalendarAppointment> = {}): CalendarAppointment {
  return {
    id: "a1",
    kind: "REUNION_SUIVI",
    mode: "VISIO",
    status: "PROPOSE",
    startsAt: new Date(2026, 8, 3, 9, 0),
    endsAt: new Date(2026, 8, 3, 10, 0),
    subject: "Point hebdomadaire",
    location: null,
    structureName: "ASSAD BENOIT",
    href: null,
    ...overrides,
  };
}

describe("startOfWeekMonday", () => {
  it("remonte au lundi de la semaine", () => {
    // 3 septembre 2026 est un jeudi.
    expect(startOfWeekMonday(new Date(2026, 8, 3))).toEqual(new Date(2026, 7, 31));
  });

  it("traite dimanche comme la fin de semaine, pas le début", () => {
    // getDay() rend 0 le dimanche : sans décalage, la semaine commencerait la veille.
    expect(startOfWeekMonday(new Date(2026, 8, 6))).toEqual(new Date(2026, 7, 31));
  });

  it("laisse un lundi en place", () => {
    expect(startOfWeekMonday(new Date(2026, 7, 31))).toEqual(new Date(2026, 7, 31));
  });
});

describe("buildMonthGrid", () => {
  const now = new Date(2026, 8, 3, 12, 0);

  it("rend toujours six semaines pleines", () => {
    // Une hauteur de grille qui varie d'un mois à l'autre est illisible pour qui
    // n'est pas à l'aise avec l'outil.
    const grid = buildMonthGrid(2026, 8, [], now);
    expect(grid).toHaveLength(CALENDAR_WEEKS);
    expect(grid.every((week) => week.length === 7)).toBe(true);
  });

  it("marque les jours hors du mois affiché", () => {
    const grid = buildMonthGrid(2026, 8, [], now);
    // Le 1er septembre 2026 est un mardi : le lundi précédent appartient à août.
    expect(grid[0]?.[0]?.inMonth).toBe(false);
    expect(grid[0]?.[1]?.inMonth).toBe(true);
  });

  it("marque aujourd'hui", () => {
    const today = buildMonthGrid(2026, 8, [], now)
      .flat()
      .filter((day) => day.isToday);
    expect(today).toHaveLength(1);
    expect(today[0]?.date.getDate()).toBe(3);
  });

  it("range chaque rendez-vous dans sa journée, dans l'ordre horaire", () => {
    const grid = buildMonthGrid(
      2026,
      8,
      [
        appointment({ id: "tard", startsAt: new Date(2026, 8, 3, 14, 0), endsAt: new Date(2026, 8, 3, 15, 0) }),
        appointment({ id: "tot", startsAt: new Date(2026, 8, 3, 9, 0), endsAt: new Date(2026, 8, 3, 10, 0) }),
      ],
      now
    );

    const day = grid.flat().find((d) => d.inMonth && d.date.getDate() === 3);
    expect(day?.appointments.map((a) => a.id)).toEqual(["tot", "tard"]);
  });
});

describe("selectUpcoming", () => {
  const now = new Date(2026, 8, 3, 12, 0);

  it("écarte ce qui est déjà terminé", () => {
    const past = appointment({ id: "hier", startsAt: new Date(2026, 8, 2, 9, 0), endsAt: new Date(2026, 8, 2, 10, 0) });
    expect(selectUpcoming([past], now)).toEqual([]);
  });

  it("garde un rendez-vous commencé mais pas fini", () => {
    // À 12 h, la réunion de 11 h 30 à 12 h 30 est toujours celle qui est en cours.
    const running = appointment({ startsAt: new Date(2026, 8, 3, 11, 30), endsAt: new Date(2026, 8, 3, 12, 30) });
    expect(selectUpcoming([running], now)).toHaveLength(1);
  });

  it("écarte les rendez-vous annulés sans les supprimer de la liste d'origine", () => {
    const cancelled = appointment({ status: "ANNULE", startsAt: new Date(2026, 8, 10, 9, 0), endsAt: new Date(2026, 8, 10, 10, 0) });
    const list = [cancelled];
    expect(selectUpcoming(list, now)).toEqual([]);
    expect(list).toHaveLength(1);
  });

  it("respecte la limite demandée", () => {
    const many = [1, 2, 3, 4].map((d) =>
      appointment({ id: `j${d}`, startsAt: new Date(2026, 8, 10 + d, 9, 0), endsAt: new Date(2026, 8, 10 + d, 10, 0) })
    );
    expect(selectUpcoming(many, now, 2).map((a) => a.id)).toEqual(["j1", "j2"]);
  });
});

describe("groupByDay", () => {
  it("regroupe les créneaux d'une même journée", () => {
    const groups = groupByDay([
      appointment({ id: "b", startsAt: new Date(2026, 8, 3, 14, 0), endsAt: new Date(2026, 8, 3, 15, 0) }),
      appointment({ id: "a", startsAt: new Date(2026, 8, 3, 9, 0), endsAt: new Date(2026, 8, 3, 10, 0) }),
      appointment({ id: "c", startsAt: new Date(2026, 8, 4, 9, 0), endsAt: new Date(2026, 8, 4, 10, 0) }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.appointments.map((a) => a.id)).toEqual(["a", "b"]);
    expect(isSameDay(groups[1]!.date, new Date(2026, 8, 4))).toBe(true);
  });
});

describe("appointmentRangeError", () => {
  const start = new Date(2026, 8, 3, 9, 0);

  it("refuse une fin avant le début", () => {
    expect(appointmentRangeError(start, new Date(2026, 8, 3, 8, 0))).toContain("au moins");
  });

  it("refuse un créneau trop court", () => {
    expect(appointmentRangeError(start, new Date(2026, 8, 3, 9, 5))).toContain("15 minutes");
  });

  it("refuse une date invalide plutôt que de la laisser filer en base", () => {
    expect(appointmentRangeError(new Date("zzz"), start)).toContain("invalides");
  });

  it("accepte une journée d'atelier", () => {
    expect(appointmentRangeError(start, new Date(2026, 8, 3, 17, 0))).toBeNull();
  });

  it("refuse au-delà de douze heures", () => {
    expect(appointmentRangeError(start, new Date(2026, 8, 3, 22, 0))).toContain("douze heures");
  });
});

describe("findOverlaps", () => {
  const existing = [
    appointment({ id: "matin", startsAt: new Date(2026, 8, 3, 9, 0), endsAt: new Date(2026, 8, 3, 11, 0) }),
  ];

  it("signale un chevauchement partiel", () => {
    const candidate = { startsAt: new Date(2026, 8, 3, 10, 0), endsAt: new Date(2026, 8, 3, 12, 0) };
    expect(findOverlaps(candidate, existing).map((a) => a.id)).toEqual(["matin"]);
  });

  it("ne signale rien pour deux créneaux qui se touchent bout à bout", () => {
    // 11 h – 12 h après 9 h – 11 h : c'est un enchaînement, pas un conflit.
    const candidate = { startsAt: new Date(2026, 8, 3, 11, 0), endsAt: new Date(2026, 8, 3, 12, 0) };
    expect(findOverlaps(candidate, existing)).toEqual([]);
  });

  it("ignore un rendez-vous annulé", () => {
    const cancelled = [appointment({ id: "annule", status: "ANNULE" })];
    const candidate = { startsAt: new Date(2026, 8, 3, 9, 30), endsAt: new Date(2026, 8, 3, 10, 0) };
    expect(findOverlaps(candidate, cancelled)).toEqual([]);
  });

  it("ne se signale pas lui-même lors d'une modification", () => {
    const candidate = { id: "matin", startsAt: new Date(2026, 8, 3, 9, 30), endsAt: new Date(2026, 8, 3, 10, 30) };
    expect(findOverlaps(candidate, existing)).toEqual([]);
  });
});
