import { describe, expect, it } from "vitest";
import {
  buildStorageKey,
  detectFileType,
  toSafeFilenameSegment,
  validateUploadedFile,
  MAX_FILE_SIZE_BYTES,
} from "./upload-validation-service";

// Fabrique un ZIP minimal ressemblant à un .docx (signature ZIP + entrée "word/").
function fakeDocx(withWordEntry = true): Buffer {
  const signature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const body = Buffer.from(withWordEntry ? "word/document.xml" : "xl/workbook.xml", "latin1");
  return Buffer.concat([signature, body]);
}

describe("detectFileType", () => {
  it("reconnaît un PDF par sa signature", () => {
    expect(detectFileType(Buffer.from("%PDF-1.7\nreste", "latin1"))).toBe("application/pdf");
  });

  it("reconnaît un DOCX (ZIP contenant word/)", () => {
    expect(detectFileType(fakeDocx())).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });

  it("refuse un ZIP qui n'est pas un DOCX (ex: xlsx renommé)", () => {
    expect(detectFileType(fakeDocx(false))).toBeNull();
  });

  it("refuse un contenu arbitraire, même nommé .pdf", () => {
    expect(detectFileType(Buffer.from("<?php system($_GET[0]); ?>", "latin1"))).toBeNull();
  });

  it("refuse un fichier vide", () => {
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
  });
});

describe("validateUploadedFile", () => {
  it("accepte un PDF valide", () => {
    const result = validateUploadedFile(Buffer.from("%PDF-1.4 contenu", "latin1"), 16);
    expect(result).toEqual({ ok: true, contentType: "application/pdf" });
  });

  it("rejette un fichier vide", () => {
    expect(validateUploadedFile(Buffer.alloc(0), 0)).toMatchObject({ ok: false });
  });

  it("rejette au-delà de la taille maximale, même si la taille annoncée est mentie", () => {
    const oversized = Buffer.concat([
      Buffer.from("%PDF-", "latin1"),
      Buffer.alloc(MAX_FILE_SIZE_BYTES),
    ]);
    // Taille annoncée volontairement petite : le contrôle doit porter sur le contenu lu.
    expect(validateUploadedFile(oversized, 10)).toMatchObject({ ok: false });
  });

  it("rejette un type non supporté sans faire confiance au nom", () => {
    expect(validateUploadedFile(Buffer.from("GIF89a", "latin1"), 6)).toMatchObject({ ok: false });
  });
});

describe("toSafeFilenameSegment", () => {
  it("neutralise une traversée de chemin", () => {
    const safe = toSafeFilenameSegment("../../../etc/passwd");
    expect(safe).not.toContain("..");
    expect(safe).not.toContain("/");
    expect(safe).toBe("passwd");
  });

  it("neutralise une traversée avec séparateurs Windows", () => {
    const safe = toSafeFilenameSegment("..\\..\\windows\\system32\\cmd.exe");
    expect(safe).not.toContain("\\");
    expect(safe).toBe("cmd.exe");
  });

  it("ne produit jamais un nom commençant par un point", () => {
    expect(toSafeFilenameSegment(".env")).toBe("env");
  });

  it("remplace les caractères non ASCII sans produire de nom vide", () => {
    expect(toSafeFilenameSegment("Livret d'accueil — ASSAD.pdf")).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(toSafeFilenameSegment("日本語")).toBe("document");
  });

  it("borne la longueur", () => {
    expect(toSafeFilenameSegment("a".repeat(500)).length).toBeLessThanOrEqual(80);
  });
});

describe("buildStorageKey", () => {
  it("confine la clé sous le préfixe établissement/type", () => {
    const key = buildStorageKey({
      establishmentId: "etab_1",
      documentTypeId: "type_1",
      versionNumber: 2,
      originalFilename: "../../evasion.pdf",
      timestamp: 1_700_000_000_000,
    });

    expect(key.startsWith("etab_1/type_1/")).toBe(true);
    expect(key).not.toContain("..");
    // Trois segments exactement : aucun séparateur supplémentaire injecté par le nom.
    expect(key.split("/")).toHaveLength(3);
  });

  it("intègre le numéro de version pour ne jamais écraser une version précédente", () => {
    const common = {
      establishmentId: "etab_1",
      documentTypeId: "type_1",
      originalFilename: "dipc.pdf",
      timestamp: 1_700_000_000_000,
    };
    const v1 = buildStorageKey({ ...common, versionNumber: 1 });
    const v2 = buildStorageKey({ ...common, versionNumber: 2 });
    expect(v1).not.toBe(v2);
  });
});
