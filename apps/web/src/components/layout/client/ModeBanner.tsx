import { ModeTag, type SupportMode } from "@/components/ui/mode-tag";

// Ce que le mode change pour la structure, en une phrase. Jamais « Sandrine » (D7).
const MODE_LINES: Record<SupportMode, string> = {
  accompagne: "EODA relit chaque document avant qu'il vous revienne.",
  autonomie: "Ce que la plateforme produit, c'est vous qui le validez.",
};

// Bandeau de mode du portail client (maquette « Portail Client v2 »).
//
// Le mode seul / accompagné n'est PAS encore une donnée (tranche N1,
// `Mission.supportMode`). Tant qu'il ne l'est pas, l'appelant passe `mode={null}`
// et le bandeau ne rend RIEN : un mode deviné — depuis `commercialTier`, qui ment
// déjà (CLAUDE.md §7) — annoncerait à un client un niveau de relecture qu'il n'a
// pas acheté. Le jour où le fait existe, il suffit de le passer ici.
export function ModeBanner({ mode, offerLabel }: { mode: SupportMode | null; offerLabel: string }) {
  if (!mode) return null;

  return (
    <div className="border-b border-line bg-soft">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-2.5 px-4 py-2.5 text-base sm:px-6">
        <ModeTag mode={mode} label={offerLabel} />
        <p className="min-w-[240px] flex-1">{MODE_LINES[mode]}</p>
      </div>
    </div>
  );
}
