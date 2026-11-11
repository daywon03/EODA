import type { InflateRaw } from "./zip-read";
import { isZip } from "./zip-read";
import { transplantIntoTemplate, type TransplantInput } from "./docx-template-transplant";

// ─────────────────────────────────────────────────────────────────────────────
// LE WORD FINAL DE LA MISE EN CONFORMITÉ GARDE LE DESIGN DU CLIENT (11/11/2026).
// Ordre : 1) le Word d'origine de la version corrigée ; 2) le modèle de mise en page
// déposé pour la structure ; 3) le rendu EODA (generateBrandedDocx), qui ne fait jamais
// échouer l'enregistrement. Un candidat illisible (PDF, archive abîmée, fichier absent)
// passe simplement au suivant.
// ─────────────────────────────────────────────────────────────────────────────

export type DesignSource = "SOURCE" | "STRUCTURE_MODEL";
export type FinalDocxDesign = DesignSource | "BRANDED";

export async function buildFinalDocx(input: {
  candidates: readonly { key: string; source: DesignSource }[];
  storage: { download(key: string): Promise<Buffer> };
  inflateRaw: InflateRaw;
  transplant: TransplantInput;
  branded: () => Promise<Buffer>;
}): Promise<{ docx: Buffer; design: FinalDocxDesign }> {
  for (const candidate of input.candidates) {
    try {
      const bytes = new Uint8Array(await input.storage.download(candidate.key));
      if (!isZip(bytes)) continue;
      const docx = await transplantIntoTemplate(bytes, input.inflateRaw, input.transplant);
      return { docx: Buffer.from(docx), design: candidate.source };
    } catch {
      // Candidat suivant : un modèle illisible ne bloque jamais la nouvelle version.
    }
  }
  return { docx: await input.branded(), design: "BRANDED" };
}
