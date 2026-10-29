"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// Le formulaire n'est chargé qu'au clic : c'est un geste rare, et l'onglet Documents
// de la fiche est la route la plus lourde du cabinet (budget de JavaScript).
const NewDocumentTypeFields = dynamic(
  () => import("./NewDocumentTypeFields").then((module) => module.NewDocumentTypeFields),
  { loading: () => <p className="text-sm text-ink2">Chargement du formulaire…</p> }
);

type Props = {
  // Fiche d'où la ligne est créée — pour proposer de l'ouvrir aussitôt. Absente sur
  // la page de cabinet « Documents réclamés ».
  establishmentId?: string;
  // Adresse de l'onglet Documents de cette fiche.
  documentsPath?: string;
  // Venu d'un critère (« Ajouter un document à ce critère ») : formulaire ouvert,
  // critère prérempli.
  initialCriterionCode?: string;
};

// « Ajouter un document à la liste » — une ligne créée une fois, pour toutes les
// structures (createDocumentType). Replié par défaut : la liste reste l'objet
// principal de l'écran.
export function NewDocumentTypeForm({ establishmentId, documentsPath, initialCriterionCode }: Props) {
  const [open, setOpen] = useState(initialCriterionCode !== undefined);

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Ajouter un document à la liste
      </Button>
    );
  }

  return (
    <NewDocumentTypeFields
      {...(establishmentId ? { establishmentId } : {})}
      {...(documentsPath ? { documentsPath } : {})}
      {...(initialCriterionCode ? { initialCriterionCode } : {})}
      onClose={() => setOpen(false)}
    />
  );
}
