import { describe, expect, it } from "vitest";
import { selectTabletDipc, TABLET_DIPC_MAX_CHARS, tabletDipecWordUrl, type TabletDipcVersionFacts } from "./tablet-dipc-service";

const day = (d: string) => new Date(`${d}T10:00:00Z`);
const client = (n: number, at: string, text = "texte du client"): TabletDipcVersionFacts => ({ id: `c${n}`, versionNumber: n, uploadedAt: day(at), producedByCabinet: false, extractedText: text });
const eoda = (n: number, at: string, text = "DIPEC d'EODA"): TabletDipcVersionFacts => ({ id: `e${n}`, versionNumber: n, uploadedAt: day(at), producedByCabinet: true, extractedText: text });

describe("selectTabletDipc", () => {
  it("sans document ni version : rien à signer", () => {
    expect(selectTabletDipc(null)).toEqual({ status: "ABSENT" });
    expect(selectTabletDipc({ validatedAt: day("2026-10-01"), versions: [] })).toEqual({ status: "ABSENT" });
  });

  it("non validé : jamais présenté à la signature", () => {
    expect(selectTabletDipc({ validatedAt: null, versions: [eoda(2, "2026-10-01")] })).toEqual({ status: "NOT_VALIDATED" });
  });

  it("validé : la version d'EODA, même si la structure a redéposé avant la validation", () => {
    const source = selectTabletDipc({ validatedAt: day("2026-10-05"), versions: [client(1, "2026-09-01"), eoda(2, "2026-10-01"), client(3, "2026-10-03")] });
    expect(source).toEqual({ status: "READY", versionId: "e2", versionNumber: 2, validatedOn: "2026-10-05", text: "DIPEC d'EODA", hasWord: false });
  });

  it("une pièce de la structure déposée APRÈS la validation la rend caduque (règle unique)", () => {
    expect(selectTabletDipc({ validatedAt: day("2026-10-05"), versions: [eoda(2, "2026-10-01"), client(3, "2026-10-09")] })).toEqual({ status: "NOT_VALIDATED" });
  });

  it("une version d'EODA déposée sur un document validé est remise sur-le-champ", () => {
    const source = selectTabletDipc({ validatedAt: day("2026-10-05"), versions: [eoda(2, "2026-10-01"), eoda(3, "2026-10-20", "v3")] });
    expect(source).toMatchObject({ status: "READY", versionId: "e3", text: "v3" });
  });

  it("pièce de la structure jugée conforme telle quelle : c'est elle qu'on présente", () => {
    expect(selectTabletDipc({ validatedAt: day("2026-10-05"), versions: [client(1, "2026-10-01")] })).toMatchObject({ status: "READY", versionId: "c1" });
  });

  it("texte illisible : on le dit, on ne présente pas une page blanche ; texte borné", () => {
    expect(selectTabletDipc({ validatedAt: day("2026-10-05"), versions: [eoda(1, "2026-10-01", "  ")] })).toEqual({ status: "NO_TEXT" });
    const long = selectTabletDipc({ validatedAt: day("2026-10-05"), versions: [eoda(1, "2026-10-01", "x".repeat(TABLET_DIPC_MAX_CHARS + 10))] });
    expect(long.status === "READY" && long.text.length).toBe(TABLET_DIPC_MAX_CHARS);
  });

  it("un DIPEC déposé en Word se remplit tel quel ; son adresse est celle de la route de la tablette", () => {
    const word = { ...eoda(2, "2026-10-01"), originalFilename: "DIPEC v2.DOCX" };
    expect(selectTabletDipc({ validatedAt: day("2026-10-05"), versions: [word] })).toMatchObject({ status: "READY", hasWord: true });
    expect(selectTabletDipc({ validatedAt: day("2026-10-05"), versions: [{ ...word, originalFilename: "DIPEC.pdf" }] })).toMatchObject({ hasWord: false });
    expect(tabletDipecWordUrl("v 2")).toBe("/api/tablette/dipec/v%202");
  });
});
