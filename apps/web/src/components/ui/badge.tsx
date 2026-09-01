import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-terre text-ivoire-light",
        secondary: "border-transparent bg-gris-light text-brun-ancre",
        missing: "border-transparent bg-rouge-imp/15 text-rouge-imp",
        compliant: "border-transparent bg-vert-ok/15 text-vert-ok",
        incomplete: "border-transparent bg-ambre/20 text-brun-moyen",
        analyzing: "border-transparent bg-blue-100 text-blue-700",
        not_applicable: "border-transparent bg-gris-light text-gris-mid",
        expired: "border-transparent bg-orange-100 text-orange-700",
        imperatif: "border-rouge-imp/40 bg-rouge-imp/10 text-rouge-imp",
        outline: "text-brun-ancre border-gris-light",
        // Statuts prospect (ProspectStatus) / devis (DevisStatus) — cf.
        // context/07-outil-pilotage-missions.md §5.1 et §6.3
        nouveau: "border-transparent bg-gris-light text-brun-ancre",
        rdv: "border-transparent bg-ambre/20 text-brun-moyen",
        devisEnvoye: "border-transparent bg-terre/15 text-terre",
        negociation: "border-transparent bg-ambre/20 text-brun-moyen",
        signe: "border-transparent bg-vert-ok/15 text-vert-ok",
        perdu: "border-transparent bg-rouge-imp/15 text-rouge-imp",
        brouillon: "text-brun-ancre border-gris-light",
        // Devis annulé : gris barré-neutre, volontairement distinct du rouge
        // « refusé » — un refus vient du prospect, une annulation du cabinet.
        annule: "border-transparent bg-gris-light text-gris-mid line-through",
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
