import Link from "next/link";
import { ModeTag, type SupportMode } from "@/components/ui/mode-tag";
import { AUTONOMY_RESERVE_SHORT } from "@/lib/services/review-mention-service";

// Ce que le mode change pour la structure, en une phrase. Jamais « Sandrine » (D7).
const MODE_LINES: Record<SupportMode, string> = {
  accompagne: "EODA relit chaque document avant qu'il vous revienne.",
  autonomie: "Ce que la plateforme produit, c'est vous qui le validez.",
};

// Bandeau de mode du portail client (maquette « Portail Client v2 »).
//
// Le mode est un FAIT de la mission (`Mission.supportMode`, N1). Sans mission,
// l'appelant passe `mode={null}` et le bandeau ne rend RIEN : un mode deviné —
// depuis `commercialTier`, qui ment déjà (CLAUDE.md §7) — annoncerait un niveau de
// relecture qui n'a pas été acheté. En autonomie, la VERSION COURTE de la réserve
// (review-mention-service) et un lien ; la version complète accompagne chaque
// document.
export function ModeBanner({ mode, offerLabel }: { mode: SupportMode | null; offerLabel: string }) {
  if (!mode) return null;

  return (
    <div className="border-b border-line bg-soft">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-2.5 text-base sm:px-6">
        <ModeTag mode={mode} label={offerLabel} />
        <p className="min-w-[240px] flex-1">
          {MODE_LINES[mode]}
          {mode === "autonomie" && (
            <>
              {" "}
              <strong>{AUTONOMY_RESERVE_SHORT}</strong>{" "}
              <Link href="/dashboard/aide" className="font-bold text-accent-text underline">
                Pourquoi ?
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
