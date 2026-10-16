import { cn } from "@/lib/utils";
import { PILL_TONE_CLASSES, type PillSpec } from "@/lib/design/status-vocabulary";

// Pastille de statut UNIQUE (maquettes v2) : glyphe + mot, jamais la couleur seule.
// Le vocabulaire (libellé, glyphe, ton) vit dans lib/design/status-vocabulary.ts ;
// ce composant ne fait que le rendre. Usage :
//   <StatusPill pill={DOCUMENT_PILLS.aRelire} />
//   <StatusPill pill={pillForDevisStatus(devis.status)} />
//
// <span> : une pastille se pose au fil du texte, et un <div> dans un <p> casse
// l'hydratation (cf. ui/badge.tsx).
export function StatusPill({ pill, className }: { pill: PillSpec; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-sm font-bold",
        PILL_TONE_CLASSES[pill.tone],
        className
      )}
    >
      {/* Le glyphe double le mot pour l'œil ; le lecteur d'écran lit le mot seul. */}
      <span aria-hidden="true">{pill.glyph}</span>
      {pill.label}
    </span>
  );
}
