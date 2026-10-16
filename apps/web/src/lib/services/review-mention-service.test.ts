import { describe, expect, it } from "vitest";
import {
  AUTONOMY_RESERVE,
  AUTONOMY_RESERVE_SHORT,
  describeReviewMention,
  documentAnnouncementMention,
  documentMention,
} from "./review-mention-service";

describe("AUTONOMY_RESERVE — la réserve complète (CLAUDE.md §7, D8)", () => {
  it("dit les trois choses obligatoires, mot pour mot", () => {
    expect(AUTONOMY_RESERVE).toBe("Non revérifié par un humain : peut comporter des erreurs. À relire absolument.");
  });

  it("la version courte garde « non revérifié par un humain » et « à relire »", () => {
    expect(AUTONOMY_RESERVE_SHORT).toMatch(/revérifié par un humain/);
    expect(AUTONOMY_RESERVE_SHORT).toMatch(/relire/);
  });

  it("ne dit jamais « validé » ni « conforme »", () => {
    for (const text of [AUTONOMY_RESERVE, AUTONOMY_RESERVE_SHORT]) {
      expect(text).not.toMatch(/validé|conforme/i);
    }
  });
});

describe("describeReviewMention", () => {
  it("« Relu par EODA, le JJ/MM » en composantes locales", () => {
    expect(describeReviewMention(new Date(2026, 8, 30, 23, 30))).toBe("Relu par EODA, le 30/09");
    expect(describeReviewMention(new Date(2026, 0, 5))).toBe("Relu par EODA, le 05/01");
  });
});

describe("documentMention — une seule règle, deux modes", () => {
  const reviewedAt = new Date(2026, 9, 2);

  it("relu par EODA : la date, quel que soit le mode", () => {
    expect(documentMention({ mode: "ACCOMPAGNE", reviewedAt })).toBe("Relu par EODA, le 02/10");
    expect(documentMention({ mode: "AUTONOMIE", reviewedAt })).toBe("Relu par EODA, le 02/10");
  });

  it("autonomie, non relu : la réserve complète", () => {
    expect(documentMention({ mode: "AUTONOMIE", reviewedAt: null })).toBe(AUTONOMY_RESERVE);
  });

  it("accompagné, non relu : rien (rien ne parvient à la structure)", () => {
    expect(documentMention({ mode: "ACCOMPAGNE", reviewedAt: null })).toBeNull();
  });
});

describe("documentAnnouncementMention — pour un e-mail qui annonce un document", () => {
  it("une phrase terminée par un seul point", () => {
    expect(documentAnnouncementMention({ mode: "AUTONOMIE", reviewedAt: null })).toBe(AUTONOMY_RESERVE);
    expect(documentAnnouncementMention({ mode: "ACCOMPAGNE", reviewedAt: new Date(2026, 9, 2) })).toBe(
      "Relu par EODA, le 02/10."
    );
    expect(documentAnnouncementMention({ mode: "ACCOMPAGNE", reviewedAt: null })).toBeNull();
  });
});
