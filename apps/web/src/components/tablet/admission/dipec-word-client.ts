"use client";

import { buildFilledDocx, fillDipecWord, openDocx, planDipecWord, type DipecWordFill, type DipecWordPlan, type DocxPackage } from "@/lib/services/dipec-word-service";
import { tabletDipecWordUrl } from "@/lib/services/tablet-dipc-service";
import { browserInflateRaw } from "@/lib/services/zip-read";
import { sha256Hex } from "./use-admissions";

// Le Word d'origine du DIPEC, sur la tablette (27/10/2026) : lu une fois à l'ouverture
// de l'accueil, rempli et signé dans le navigateur. `null` : pas de Word, ou un
// navigateur qui ne sait pas l'ouvrir — la tablette retombe sur la copie en texte.

export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type TabletDipecWord = { pkg: DocxPackage; plan: DipecWordPlan; sha256: string };

export async function loadTabletDipecWord(versionId: string): Promise<TabletDipecWord | null> {
  const inflate = browserInflateRaw();
  if (!inflate) return null;
  try {
    const response = await fetch(tabletDipecWordUrl(versionId), { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const pkg = await openDocx(bytes, inflate);
    return { pkg, plan: planDipecWord(pkg.documentXml), sha256: await sha256Hex(bytes) };
  } catch {
    return null;
  }
}

export function buildContractWord(word: TabletDipecWord, input: Omit<DipecWordFill, "documentXml" | "plan">, at: Date) {
  const filled = fillDipecWord({ ...input, documentXml: word.pkg.documentXml, plan: word.plan });
  const blob = new Blob([buildFilledDocx(word.pkg, filled, at) as BlobPart], { type: DOCX_TYPE });
  return { blob, unknownFields: filled.unknownFields, emptyFields: filled.emptyFields };
}
