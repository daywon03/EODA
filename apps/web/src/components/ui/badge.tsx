import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Chaque statut porte une bordure de sa propre teinte à 40-60 % en plus du fond
// teinté : un badge à fond transparent-à-15 % sans bordure se lit comme une tache
// pastel plutôt que comme une étiquette — retour de Sandrine du 15/09/2026 (« les
// couleurs font trop pastel »). La bordure est ce qui donne au badge un bord net et
// le fait "lire" comme un statut plutôt que comme un fond de carte. Palette EODA
// uniquement (charte §1) : aucun bleu/orange Tailwind par défaut, qui sortait de la
// charte pour "Analysé" et "Périmé".
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-terre text-ivoire-light",
        secondary: "border-transparent bg-gris-light text-brun-ancre",
        missing: "border-rouge-imp/50 bg-rouge-imp/12 text-rouge-imp",
        compliant: "border-vert-ok/50 bg-vert-ok/12 text-vert-ok",
        incomplete: "border-ambre/60 bg-ambre/15 text-brun-moyen",
        // « Analysé » : statut actif/transitoire, sur l'accent terre — plus de bleu
        // hors charte. Le point qui pulse (StatusBadge) porte l'idée de progression ;
        // la couleur porte l'appartenance à la marque.
        analyzing: "border-terre/50 bg-terre/12 text-terre",
        not_applicable: "border-gris-mid/30 bg-gris-light text-gris-mid",
        // Périmé : même famille qu'incomplet (ambre = correction nécessaire), mais le
        // texte et la bordure passent au rouge pour marquer l'urgence — sans aller
        // jusqu'au rouge plein de "manquant", qui reste le seul statut bloquant.
        expired: "border-rouge-imp/40 bg-ambre/15 text-rouge-imp",
        imperatif: "border-rouge-imp/50 bg-rouge-imp/12 text-rouge-imp",
        outline: "text-brun-ancre border-gris-light",
        // Statuts prospect (ProspectStatus) / devis (DevisStatus) — cf.
        // context/07-outil-pilotage-missions.md §5.1 et §6.3
        nouveau: "border-gris-mid/30 bg-gris-light text-brun-ancre",
        rdv: "border-ambre/60 bg-ambre/15 text-brun-moyen",
        devisEnvoye: "border-terre/50 bg-terre/12 text-terre",
        negociation: "border-ambre/60 bg-ambre/15 text-brun-moyen",
        signe: "border-vert-ok/50 bg-vert-ok/12 text-vert-ok",
        perdu: "border-rouge-imp/50 bg-rouge-imp/12 text-rouge-imp",
        brouillon: "text-brun-ancre border-gris-light",
        // Devis annulé : gris barré-neutre, volontairement distinct du rouge
        // « refusé » — un refus vient du prospect, une annulation du cabinet.
        annule: "border-gris-mid/30 bg-gris-light text-gris-mid line-through",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

// <span> et non <div> : un badge est une étiquette EN LIGNE, posée au fil du texte
// (« Devis DEV-2026-014 · Essentiel [Signé] »). Un <div> à l'intérieur d'un <p> est
// du HTML invalide — le navigateur ferme le paragraphe tout seul, ce qui produit un
// arbre différent côté serveur et côté client, donc une erreur d'hydratation.
// `inline-flex` rend exactement pareil sur un <span>.
function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
