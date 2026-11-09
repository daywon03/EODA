"use client";

import { DOCX_RENDER_OPTIONS } from "@/components/structure/docx-render-options";
import { neutralizeDocxLinks } from "@/lib/services/docx-preview-safety";
import { planPageSlices } from "@/lib/services/page-slicing";

// ─────────────────────────────────────────────────────────────────────────────
// LA COPIE PDF D'UN CONTRAT SIGNÉ, FABRIQUÉE SUR LA TABLETTE (demande de Damon,
// 08/11/2026 : « le contrat DIPEC je le voudrais en PDF aussi, pour voir s'il y a bien
// les signatures dessus »).
//
// Le contrat signé ne quitte jamais la tablette (verrou HDS) : aucune conversion
// serveur. Le Word signé est dessiné par docx-preview — le MÊME rendu que l'aperçu
// « Le contrat » (DOCX_RENDER_OPTIONS) —, chaque page dessinée devient une image (SVG
// foreignObject → canvas, sans aucune ressource réseau : tout est en `data:`),
// découpée en pages A4 entre deux blocs (planPageSlices), puis assemblée par pdf-lib.
// C'est une COPIE en images, pour lire, imprimer et envoyer ; le Word reste le
// contrat. Les deux bibliothèques ne se chargent qu'à la signature.
// ─────────────────────────────────────────────────────────────────────────────

const SCALE = 2; // netteté (signatures lisibles à l'impression)
const PX_TO_PT = 0.75;
const A4_RATIO = 297 / 210;

type Shot = { bytes: Uint8Array; width: number; height: number };

// La page dessinée, en image SVG autonome (styles de docx-preview compris).
async function sectionImage(section: HTMLElement, styles: string): Promise<HTMLImageElement> {
  const wrapper = document.createElement("div");
  wrapper.className = "docx-wrapper";
  wrapper.style.cssText = "padding:0;margin:0;background:#fff;display:block;";
  const clone = section.cloneNode(true) as HTMLElement;
  clone.style.margin = "0";
  clone.style.boxShadow = "none";
  wrapper.appendChild(clone);
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = styles;
  root.append(style, wrapper);
  // XMLSerializer échappe le CSS et le texte : le SVG reste bien formé.
  const xhtml = new XMLSerializer().serializeToString(root);
  const width = Math.ceil(section.offsetWidth);
  const height = Math.ceil(section.offsetHeight);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>`;
  const image = new Image(width, height);
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  return image;
}

// Bas de chaque bloc (paragraphe, tableau, ligne de tableau) : les coupures permises.
function blockBottoms(section: HTMLElement): number[] {
  const top = section.getBoundingClientRect().top;
  return Array.from(section.querySelectorAll<HTMLElement>("article > *, article tr"), (el) => Math.round(el.getBoundingClientRect().bottom - top));
}

async function sectionPages(section: HTMLElement, styles: string): Promise<Shot[]> {
  const width = Math.ceil(section.offsetWidth);
  const computed = getComputedStyle(section);
  const declared = parseFloat(computed.minHeight);
  const pageHeight = Math.round(declared > 0 ? declared : width * A4_RATIO);
  const slices = planPageSlices({
    total: Math.ceil(section.offsetHeight),
    pageHeight,
    marginTop: parseFloat(computed.paddingTop) || 0,
    marginBottom: parseFloat(computed.paddingBottom) || 0,
    boundaries: blockBottoms(section),
  });
  const image = await sectionImage(section, styles);
  const shots: Shot[] = [];
  for (const slice of slices) {
    const height = Math.max(pageHeight, slice.drawAt + slice.to - slice.from);
    const canvas = document.createElement("canvas");
    canvas.width = width * SCALE;
    canvas.height = height * SCALE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Dessin de page impossible.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(SCALE, SCALE);
    context.drawImage(image, 0, slice.from, width, slice.to - slice.from, 0, slice.drawAt, width, slice.to - slice.from);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob) throw new Error("Image de page impossible à fabriquer.");
    shots.push({ bytes: new Uint8Array(await blob.arrayBuffer()), width, height });
  }
  return shots;
}

export async function wordToPdf(word: Blob): Promise<Blob> {
  const [docx, { PDFDocument }] = await Promise.all([import("docx-preview"), import("pdf-lib")]);
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  // Hors de l'écran mais mis en page : les dimensions des pages en dépendent.
  host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;";
  document.body.appendChild(host);
  try {
    await docx.renderAsync(word, host, host, DOCX_RENDER_OPTIONS);
    neutralizeDocxLinks(host);
    await document.fonts?.ready;
    const styles = Array.from(host.querySelectorAll("style"), (s) => s.textContent ?? "").join("\n");
    const sections = Array.from(host.querySelectorAll<HTMLElement>("section.docx"));
    if (sections.length === 0) throw new Error("Aucune page dans le Word.");

    const pdf = await PDFDocument.create();
    for (const section of sections) {
      for (const shot of await sectionPages(section, styles)) {
        const image = await pdf.embedJpg(shot.bytes);
        const size: [number, number] = [shot.width * PX_TO_PT, shot.height * PX_TO_PT];
        pdf.addPage(size).drawImage(image, { x: 0, y: 0, width: size[0], height: size[1] });
      }
    }
    return new Blob([(await pdf.save()) as BlobPart], { type: "application/pdf" });
  } finally {
    host.remove();
  }
}
