"use client";

import { useId, useState } from "react";
import { Select } from "@/components/ui/select";
import { documentTypeLabelKey } from "@/lib/services/document-type-creation-service";
import { CriterionLinker } from "./CriterionLinker";

// Rattacher ou retirer des critères d'un type de document depuis la MATRICE (call du
// 21/10/2026, retours du 09/11/2026). On choisit le type ; la liste des critères est
// le composant unique `CriterionLinker`, le même que dans la fiche document — cocher,
// décocher, chercher par numéro ou par mot. Le serveur recalcule tout.
export function ManualMatrixLink({ documentTypes }: { documentTypes: readonly { code: string; label: string }[] }) {
  const [typeCode, setTypeCode] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const typeId = useId();

  // Types dans l'ordre alphabétique, filtrables par mot (call du 28/10/2026 : le type
  // cherché ne se trouvait pas). Accents et casse ignorés.
  const typeNeedle = documentTypeLabelKey(typeFilter);
  const sortedTypes = [...documentTypes]
    .sort((a, b) => a.label.localeCompare(b.label, "fr"))
    .filter((t) => typeNeedle === "" || t.code === typeCode || documentTypeLabelKey(t.label).includes(typeNeedle));

  return (
    <div className="space-y-4 rounded-xl border border-line bg-card p-5">
      <input
        type="search"
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
        placeholder="Chercher un type : « affiche », « crise »…"
        aria-label="Chercher un type de document"
        className="h-11 w-full rounded-md border border-line bg-card px-3 text-ink placeholder:text-ink2"
      />
      <label htmlFor={typeId} className="block space-y-1">
        <span className="font-bold text-ink">Type de document ({sortedTypes.length})</span>
        <Select id={typeId} value={typeCode} onChange={(e) => setTypeCode(e.target.value)}>
          <option value="">Choisir un type…</option>
          {sortedTypes.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </Select>
      </label>

      {/* `key` : changer de type repart d'une liste vierge (sélection, recherche, message). */}
      {typeCode && <CriterionLinker key={typeCode} typeCode={typeCode} canEdit />}
    </div>
  );
}
