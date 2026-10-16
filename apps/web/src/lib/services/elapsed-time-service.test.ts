import { describe, expect, it } from "vitest";
import { calendarDaysBetween, formatAgo, formatDaysUntil } from "./elapsed-time-service";

const NOW = new Date(2026, 9, 9, 9, 0); // 09/10/2026 09:00, heure locale

describe("calendarDaysBetween", () => {
  it("compte des jours calendaires, pas des tranches de 24 h", () => {
    expect(calendarDaysBetween(new Date(2026, 9, 8, 23, 0), NOW)).toBe(1);
    expect(calendarDaysBetween(NOW, new Date(2026, 9, 9, 23, 59))).toBe(0);
  });

  it("traverse un changement d'heure sans décalage", () => {
    expect(calendarDaysBetween(new Date(2026, 9, 20), new Date(2026, 10, 3))).toBe(14);
  });
});

describe("formatAgo", () => {
  it.each([
    [new Date(2026, 9, 9, 8, 0), "aujourd'hui"],
    [new Date(2026, 9, 8, 22, 0), "hier"],
    [new Date(2026, 9, 3), "il y a 6 jours"],
    [new Date(2026, 9, 12), "aujourd'hui"],
  ])("%s → %s", (date, expected) => {
    expect(formatAgo(date, NOW)).toBe(expected);
  });
});

describe("formatDaysUntil", () => {
  it.each([
    [new Date(2026, 9, 9, 18, 0), "aujourd'hui"],
    [new Date(2026, 9, 10), "demain"],
    [new Date(2027, 0, 3), "dans 86 jours"],
    [new Date(2026, 9, 8), "dépassée depuis 1 jour"],
    [new Date(2026, 9, 6), "dépassée depuis 3 jours"],
  ])("%s → %s", (date, expected) => {
    expect(formatDaysUntil(date, NOW)).toBe(expected);
  });
});
