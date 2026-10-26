"use client";

import type { AdmissionBlock } from "@/lib/services/admission-document-service";

// Aperçu du contrat tel qu'il sera signé : le MÊME plan que le PDF
// (admission-document-service), rendu en HTML pour être lu sur la tablette.
export function AdmissionPreview({ blocks }: { blocks: readonly AdmissionBlock[] }) {
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-6 text-[18px] leading-relaxed text-ink">
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;
        switch (block.kind) {
          case "title":
            return <h2 key={key} className="text-[26px] font-bold leading-tight">{block.text}</h2>;
          case "subtitle":
            return <p key={key} className="text-[20px] text-ink2">{block.text}</p>;
          case "heading":
            return <h3 key={key} className="mt-4 border-b border-line pb-1 text-[21px] font-bold">{block.text}</h3>;
          case "field":
            return (
              <p key={key}>
                <span className="text-ink2">{block.label} : </span>
                {block.value}
              </p>
            );
          case "paragraph":
            return <p key={key}>{block.text}</p>;
          case "check":
            return (
              <p key={key}>
                • {block.text} <span className="text-[16px] text-ink2">({block.detail})</span>
              </p>
            );
          case "note":
            return <p key={key} className="text-[16px] text-ink2">{block.text}</p>;
          case "signature":
            return (
              <p key={key} className="rounded-xl border border-dashed border-muted px-4 py-3">
                <span className="font-bold">{block.label}</span> — {block.name}
              </p>
            );
        }
      })}
    </article>
  );
}
