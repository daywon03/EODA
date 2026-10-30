"use client";

import { buildFilledDocx, fillDipecWord, openDocx, planDipecWord, type DipecWordFill, type DipecWordPlan, type DocxPackage } from "@/lib/services/dipec-word-service";
import { tabletAwarenessSheetUrl } from "@/lib/services/awareness-sheet-links";
import { fillRecapContract, planRecapContract, type RecapContractFill, type RecapContractPlan } from "@/lib/services/recap-contract-word-service";
import { tabletDipecWordUrl } from "@/lib/services/tablet-dipc-service";
import { browserInflateRaw } from "@/lib/services/zip-read";
import { sha256Hex } from "./use-admissions";

// Le Word d'origine du DIPEC, sur la tablette (27/10/2026) : lu une fois à l'ouverture
// de l'accueil, rempli et signé dans le navigateur. `null` : pas de Word, ou un
// navigateur qui ne sait pas l'ouvrir — la tablette retombe sur la copie en texte.

export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type TabletDipecWord = { pkg: DocxPackage; plan: DipecWordPlan; sha256: string };

async function loadDocx(url: string): Promise<{ pkg: DocxPackage; sha256: string } | null> {
  const inflate = browserInflateRaw();
  if (!inflate) return null;
  try {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { pkg: await openDocx(bytes, inflate), sha256: await sha256Hex(bytes) };
  } catch {
    return null;
  }
}

export async function loadTabletDipecWord(versionId: string): Promise<TabletDipecWord | null> {
  const loaded = await loadDocx(tabletDipecWordUrl(versionId));
  return loaded && { ...loaded, plan: planDipecWord(loaded.pkg.documentXml) };
}

// Le contrat récapitulatif de la structure, pour le Département (30/10/2026) : même
// lecture, autre plan. `null` : pas un Word, ou un navigateur qui ne sait pas l'ouvrir.
export type TabletRecapWord = { pkg: DocxPackage; plan: RecapContractPlan; sha256: string };

export async function loadTabletRecapWord(versionId: string): Promise<TabletRecapWord | null> {
  const loaded = await loadDocx(tabletAwarenessSheetUrl(versionId));
  return loaded && { ...loaded, plan: planRecapContract(loaded.pkg.documentXml) };
}

export function buildRecapWord(recap: TabletRecapWord, input: Omit<RecapContractFill, "documentXml" | "plan">, at: Date): Blob {
  const filled = fillRecapContract({ ...input, documentXml: recap.pkg.documentXml, plan: recap.plan });
  return new Blob([buildFilledDocx(recap.pkg, { ...filled, unknownFields: [], emptyFields: [] }, at) as BlobPart], { type: DOCX_TYPE });
}

export function buildContractWord(word: TabletDipecWord, input: Omit<DipecWordFill, "documentXml" | "plan">, at: Date) {
  const filled = fillDipecWord({ ...input, documentXml: word.pkg.documentXml, plan: word.plan });
  const blob = new Blob([buildFilledDocx(word.pkg, filled, at) as BlobPart], { type: DOCX_TYPE });
  return { blob, unknownFields: filled.unknownFields, emptyFields: filled.emptyFields };
}
