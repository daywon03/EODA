import { describe, expect, it } from "vitest";
import { ChromiumLaunchError } from "./chromium-launch-error";
import {
  documentPdfErrorResponse,
  documentPdfFilename,
  documentPdfPreviewFailureMessage,
} from "./document-pdf-response";

// Ces deux fonctions sont partagées par les routes qui servent des pages en PDF. Ce
// qu'elles protègent tient en deux lignes d'en-tête HTTP, et c'est pourtant là que se
// logent les injections : le nom de fichier part dans `Content-Disposition`, et le
// message part dans un corps HTML.

describe("documentPdfFilename", () => {
  it("remplace l'extension d'origine par .pdf", () => {
    // Ce qui part est un PDF : un fichier enregistré en .docx s'ouvrirait dans Word
    // sur des octets PDF.
    expect(documentPdfFilename("projet-de-service.docx")).toBe("projet-de-service.pdf");
    expect(documentPdfFilename("registre.xlsx")).toBe("registre.pdf");
  });

  it("laisse un nom déjà en .pdf inchangé", () => {
    expect(documentPdfFilename("rapport.pdf")).toBe("rapport.pdf");
  });

  it("assainit le nom : rien qui puisse refermer l'en-tête", () => {
    const filename = documentPdfFilename('devis"; attachment; filename="x.docx');

    expect(filename.endsWith(".pdf")).toBe(true);
    expect(filename).not.toContain('"');
    expect(filename).not.toContain(";");
  });

  it("ne laisse pas un nom réduit à son extension produire « .pdf »", () => {
    // Un nom qui n'est QUE son extension ne doit pas donner un fichier sans nom.
    expect(documentPdfFilename(".docx")).not.toBe(".pdf");
  });
});

describe("documentPdfErrorResponse", () => {
  it("rend le message en HTML, lisible dans un iframe", async () => {
    const response = documentPdfErrorResponse(404, "Aperçu indisponible pour ce document.");
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(body).toContain("Aperçu indisponible pour ce document.");
  });

  it("n'est jamais mis en cache", async () => {
    const response = documentPdfErrorResponse(503, "Rendu impossible.");

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("échappe le message : il ne peut pas devenir du balisage", async () => {
    const body = await documentPdfErrorResponse(503, '<script>alert(1)</script>').text();

    expect(body).not.toContain("<script>");
    expect(body).toContain("&lt;script&gt;");
  });
});

describe("documentPdfPreviewFailureMessage", () => {
  it("ne propose pas de réessayer quand Chromium n'a pas démarré", () => {
    // Réessayer redonnerait exactement le même échec : proposer un geste qui ne peut
    // pas aboutir est ce que ce message existe pour éviter.
    const message = documentPdfPreviewFailureMessage(
      new ChromiumLaunchError(new Error("spawn ENOEXEC"), true)
    );

    expect(message).not.toContain("Réessayez");
    expect(message).toContain("format d'origine");
  });

  it("laisse réessayer sur un échec passager", () => {
    const message = documentPdfPreviewFailureMessage(new Error("Timeout 30000ms exceeded"));

    expect(message).toContain("Réessayez");
    expect(message).toContain("format d'origine");
  });

  it("ne montre jamais le détail technique, quel qu'il soit", () => {
    const message = documentPdfPreviewFailureMessage(
      new ChromiumLaunchError(new Error("spawn ENOEXEC"), true)
    );

    expect(message).not.toContain("ENOEXEC");
    expect(message).not.toContain("PUPPETEER_EXECUTABLE_PATH");
    expect(message).not.toContain("Chromium");
  });
});
