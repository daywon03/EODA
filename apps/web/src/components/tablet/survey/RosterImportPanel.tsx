"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import {
  ROSTER_TEMPLATE_CSV,
  describeRosterImport,
  displayName,
  parseDelimitedText,
  planRosterImport,
  type Roster,
  type RosterImportPlan,
} from "@/lib/services/survey-roster-service";
import { XLSX_MAX_FILE_BYTES, XlsxReadError, readXlsxRows } from "@/lib/services/xlsx-rows-reader";
import { TABLET_INPUT, TABLET_PRIMARY, TABLET_SECONDARY } from "../tablet-ui";
import { downloadText } from "./use-survey-roster";

// Import de la liste : un fichier (Excel ou CSV — par exemple l'export du logiciel
// métier) ou un copier-coller depuis Excel. Le fichier est lu ICI, dans le navigateur,
// jamais envoyé. On MONTRE ce qui a été trouvé avant d'ajouter quoi que ce soit.
export function RosterImportPanel({
  roster,
  onImport,
  onClose,
}: {
  roster: Roster;
  onImport: (plan: RosterImportPlan) => void;
  onClose: () => void;
}) {
  const [plan, setPlan] = useState<RosterImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [reading, setReading] = useState(false);

  async function readFile(file: File) {
    setError(null);
    setPlan(null);
    if (file.size > XLSX_MAX_FILE_BYTES) return setError("Ce fichier est trop gros (5 Mo au plus).");
    setReading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      // La signature décide, pas l'extension : un .xlsx commence par « PK ».
      const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
      const rows = isZip ? await readXlsxRows(bytes) : parseDelimitedText(new TextDecoder().decode(bytes));
      showPlan(planRosterImport(rows, roster.people));
    } catch (cause) {
      setError(cause instanceof XlsxReadError ? cause.message : "Ce fichier n'a pas pu être lu. Essayez un fichier Excel (.xlsx) ou CSV.");
    } finally {
      setReading(false);
    }
  }

  function readPasted() {
    setError(null);
    showPlan(planRosterImport(parseDelimitedText(pasted), roster.people));
  }

  function showPlan(next: RosterImportPlan) {
    if (next.people.length === 0 && next.issues.length === 0) {
      setPlan(null);
      setError("Aucun nom trouvé. Vérifiez que le fichier a une colonne « Nom » (et « Prénom »).");
      return;
    }
    setPlan(next);
  }

  return (
    <Modal title="Importer la liste des personnes" onClose={onClose} maxWidthClassName="max-w-2xl">
      <div className="flex flex-col gap-5 overflow-y-auto p-5 text-[19px]">
        {!plan && (
          <>
            <p>
              Prenez le fichier de vos personnes accompagnées, par exemple <strong>exporté de Ximi</strong>. Il faut une colonne
              <strong> Nom</strong> et une colonne <strong>Prénom</strong> : les autres colonnes sont ignorées.
            </p>
            <label className={`${TABLET_PRIMARY} cursor-pointer focus-within:ring-[3px] focus-within:ring-ink focus-within:ring-offset-2`}>
              <FileUp className="h-6 w-6" aria-hidden="true" />
              {reading ? "Lecture…" : "Choisir le fichier (Excel ou CSV)"}
              <input
                type="file"
                accept=".xlsx,.csv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                disabled={reading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void readFile(file);
                }}
              />
            </label>
            <details className="rounded-xl border border-line p-4">
              <summary className="cursor-pointer font-bold">Ou copier-coller depuis Excel</summary>
              <div className="mt-3 flex flex-col gap-3">
                <label htmlFor="roster-paste">Sélectionnez les colonnes Nom et Prénom dans Excel, copiez, puis collez ici.</label>
                <textarea
                  id="roster-paste"
                  value={pasted}
                  onChange={(event) => setPasted(event.target.value)}
                  rows={6}
                  className={`${TABLET_INPUT} h-auto py-3`}
                />
                <button type="button" className={TABLET_SECONDARY} disabled={pasted.trim() === ""} onClick={readPasted}>
                  Lire ce que j&apos;ai collé
                </button>
              </div>
            </details>
            <button
              type="button"
              className="w-fit text-[17px] text-accent-text underline underline-offset-4"
              onClick={() => downloadText("Modele_liste_enquete.csv", ROSTER_TEMPLATE_CSV, "text/csv;charset=utf-8")}
            >
              Télécharger un modèle de fichier vide
            </button>
          </>
        )}
        {plan && (
          <>
            <p role="status" className="font-bold">
              {describeRosterImport(plan)}
            </p>
            {plan.people.length > 0 && (
              <ul className="max-h-64 overflow-y-auto rounded-xl border border-line bg-soft p-3">
                {plan.people.slice(0, 50).map((p, i) => (
                  <li key={i}>{displayName(p)}</li>
                ))}
                {plan.people.length > 50 && <li className="text-ink2">… et {plan.people.length - 50} autres</li>}
              </ul>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="button" className={TABLET_SECONDARY} onClick={() => setPlan(null)}>
                Choisir un autre fichier
              </button>
              {plan.people.length > 0 && (
                <button type="button" className={`${TABLET_PRIMARY} flex-1`} onClick={() => onImport(plan)}>
                  Ajouter {plan.people.length} personne{plan.people.length > 1 ? "s" : ""}
                </button>
              )}
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="font-bold text-danger-text">
            {error}
          </p>
        )}
        <p className="text-[17px] text-ink2">Le fichier est lu sur cette tablette. Il n&apos;est jamais envoyé à EODA.</p>
      </div>
    </Modal>
  );
}
