import { Lock } from "lucide-react";
import { RESTRICTED_DOCUMENT_NOTICE } from "@/content/documents/acces-restreint";
import { cn } from "@/lib/utils";

// Le cadenas d'une ligne à ACCÈS RESTREINT (le tampon de la structure, ADR 20261110),
// là où l'écran aurait proposé Voir / Télécharger. Le mot porte le sens, le pictogramme
// ne fait que l'accompagner (WCAG 1.4.1) ; le refus réel est dans chaque porte serveur.
export function RestrictedFileNotice({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-bold text-ink", className)}>
      <Lock className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      {RESTRICTED_DOCUMENT_NOTICE}
    </span>
  );
}
