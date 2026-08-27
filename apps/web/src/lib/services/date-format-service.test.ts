import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatDayHeading,
  formatTime,
  formatTimeRange,
  toDateInputValue,
  toTimeInputValue,
} from "./date-format-service";

// 3 septembre 2026, 9 h 05 — heure locale.
const MOMENT = new Date(2026, 8, 3, 9, 5);

describe("formatDate", () => {
  it("rend JJ/MM/AAAA, le format demandé partout", () => {
    expect(formatDate(MOMENT)).toBe("03/09/2026");
  });

  it("garde les deux chiffres du jour et du mois", () => {
    expect(formatDate(new Date(2027, 0, 7))).toBe("07/01/2027");
  });
});

describe("formatDateTime", () => {
  it("colle l'heure à la date avec « à »", () => {
    expect(formatDateTime(MOMENT)).toBe("03/09/2026 à 09:05");
  });
});

describe("formatTime / formatTimeRange", () => {
  it("rend l'heure sur deux chiffres", () => {
    expect(formatTime(MOMENT)).toBe("09:05");
  });

  it("rend une plage lisible, tiret entouré d'espaces fines insécables", () => {
    // La plage ne doit jamais se couper en fin de ligne entre l'heure et le tiret.
    const NARROW = "\u202f";
    expect(formatTimeRange(MOMENT, new Date(2026, 8, 3, 12, 30))).toBe(
      `09:05${NARROW}–${NARROW}12:30`
    );
  });
});

describe("formatDayHeading", () => {
  it("nomme le jour pour les en-têtes d'agenda", () => {
    expect(formatDayHeading(MOMENT)).toBe("jeudi 3 septembre 2026");
  });
});

describe("toDateInputValue", () => {
  it("rend la valeur attendue par un champ date", () => {
    expect(toDateInputValue(MOMENT)).toBe("2026-09-03");
  });

  it("ne recule pas d'un jour sur une date de soirée", () => {
    // `toISOString()` convertit en UTC : le 3 septembre à 23 h devient le 4 à 21 h
    // UTC en heure d'été, et le champ afficherait la veille.
    expect(toDateInputValue(new Date(2026, 8, 3, 23, 30))).toBe("2026-09-03");
  });
});

describe("toTimeInputValue", () => {
  it("rend HH:MM sur deux chiffres", () => {
    expect(toTimeInputValue(new Date(2026, 8, 3, 8, 0))).toBe("08:00");
  });
});
