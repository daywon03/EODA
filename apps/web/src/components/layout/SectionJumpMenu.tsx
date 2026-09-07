"use client";

import { ListTree } from "lucide-react";

export type JumpSection = { id: string; label: string };

// Menu déroulant d'ancres pour une page longue — demande du 07/09/2026 :
// Sandrine s'est perdue en cherchant une section sur une fiche client qui en
// compte une dizaine. Un <select> natif plutôt qu'un menu construit à la main :
// le saut d'ancre est géré par le navigateur, aucun état ni scroll manuel à
// maintenir, et il reste utilisable au clavier sans rien ajouter.
export function SectionJumpMenu({ sections }: { sections: JumpSection[] }) {
  if (sections.length === 0) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <ListTree className="w-4 h-4 text-gris-mid flex-shrink-0" aria-hidden="true" />
      <select
        defaultValue=""
        aria-label="Aller à une section de la page"
        className="border border-gris-light rounded-lg px-2.5 py-1.5 text-sm text-brun-ancre bg-white"
        onChange={(event) => {
          const id = event.target.value;
          if (!id) return;
          document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
          event.target.value = "";
        }}
      >
        <option value="" disabled>
          Aller à…
        </option>
        {sections.map((section) => (
          <option key={section.id} value={section.id}>
            {section.label}
          </option>
        ))}
      </select>
    </div>
  );
}
