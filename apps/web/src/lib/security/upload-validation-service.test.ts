import { describe, expect, it } from "vitest";
import {
  buildStorageKey,
  detectFileType,
  toSafeFilenameSegment,
  validateUploadedFile,
  MAX_FILE_SIZE_BYTES,
  validateLogoUpload,
} from "./upload-validation-service";

// Fabrique un ZIP minimal ressemblant à un .docx (signature ZIP + entrée "word/").
function fakeDocx(withWordEntry = true): Buffer {
  const signature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  // Sans entrée « word/ » : une archive quelconque. `xl/` n'est plus un bon
  // contre-exemple depuis que les tableurs sont acceptés — un XLSX est un dépôt
  // légitime, pas un ZIP déguisé.
  const body = Buffer.from(withWordEntry ? "word/document.xml" : "photos/plage.jpg", "latin1");
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

  it("refuse une archive ZIP qui n'est ni un DOCX ni un XLSX", () => {
    // Une archive quelconque — ou piégée — sous un nom en .docx.
    expect(detectFileType(fakeDocx(false))).toBeNull();
  });

  it("reconnaît un XLSX par son entrée « xl/ »", () => {
    const xlsx = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("xl/workbook.xml", "latin1"),
    ]);
    expect(detectFileType(xlsx)).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  it("reconnaît un ancien .doc/.xls à son conteneur OLE2", () => {
    const ole2 = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(64),
    ]);
    expect(detectFileType(ole2)).toBe("application/x-ole-storage");
  });

  it("reconnaît une image PNG et une image JPEG", () => {
    expect(
      detectFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]))
    ).toBe("image/png");
    expect(detectFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))).toBe("image/jpeg");
  });

  it("reconnaît un CSV à sa forme : plusieurs lignes, même nombre de séparateurs", () => {
    const csv = Buffer.from("nom;prenom;fonction\nDupont;Marie;Direction\n", "utf8");
    expect(detectFileType(csv)).toBe("text/csv");
  });

  it("refuse un texte d'une seule ligne qui contient un séparateur", () => {
    // Sans signature à vérifier, c'est la FORME du CSV qui fait foi — une charge
    // utile d'une seule ligne n'en a pas.
    expect(detectFileType(Buffer.from("nom;prenom;fonction", "utf8"))).toBeNull();
  });

  it("refuse un binaire renommé en .csv", () => {
    expect(detectFileType(Buffer.from([0x01, 0x00, 0x02, 0x00, 0x03]))).toBeNull();
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

describe("validateLogoUpload", () => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(32, 1),
  ]);

  it("accepte un PNG et rend un data URI prêt à afficher", () => {
    const result = validateLogoUpload(png, png.length);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.dataUri.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("refuse un PDF, même valide — un logo est une image", () => {
    const pdf = Buffer.from("%PDF-1.7\nreste", "latin1");
    expect(validateLogoUpload(pdf, pdf.length)).toMatchObject({ ok: false });
  });

  it("refuse un SVG : c'est un document XML, il peut porter du script", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>', "utf8");
    expect(validateLogoUpload(svg, svg.length)).toMatchObject({ ok: false });
  });

  it("refuse au-delà de 300 Ko — la donnée est encodée en base64 et relue à chaque rendu", () => {
    const big = Buffer.concat([png, Buffer.alloc(300 * 1024)]);
    expect(validateLogoUpload(big, big.length)).toMatchObject({
      ok: false,
      error: expect.stringContaining("300 Ko"),
    });
  });
});
