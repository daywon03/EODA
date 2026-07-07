// Extraction de texte brut — sert de base au texte stocké dans DocumentVersion
// et à la catégorisation. L'analyse LLM du contenu est hors périmètre (Jalon 3).
export async function extractText(content: Buffer, mimeType: string): Promise<string | null> {
  try {
    if (mimeType === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: content });
      const result = await parser.getText();
      await parser.destroy();
      return result.text.trim() || null;
    }

    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: content });
      return result.value.trim() || null;
    }

    return null;
  } catch {
    // Extraction best-effort : un échec ne doit jamais bloquer le dépôt du
    // document, seulement priver la catégorisation/l'analyse de contexte texte.
    return null;
  }
}
