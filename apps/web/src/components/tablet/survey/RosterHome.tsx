"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Download, FileUp, Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  addPersonError,
  buildRosterCsv,
  cleanName,
  displayName,
  isPersonDone,
  nextToSurvey,
  rosterExportFileName,
  rosterProgress,
  searchRoster,
  type Roster,
  type RosterPerson,
} from "@/lib/services/survey-roster-service";
import { TABLET_CHOICE, TABLET_CHOICE_OFF, TABLET_INPUT, TABLET_PRIMARY, TABLET_SECONDARY } from "../tablet-ui";
import { downloadText } from "./use-survey-roster";

function shortDay(day: string): string {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
}

// Écran d'accueil de l'enquête : qui reste à voir, un grand bouton pour la personne
// suivante, la liste pour en choisir une autre. Un geste par intention.
export function RosterHome({
  roster,
  structureName,
  storageWorks,
  onPick,
  onAnonymous,
  onAdd,
  onOpenImport,
  onClear,
  canManage,
}: {
  // Importer, exporter, effacer la liste : l'administrateur de la tablette seulement
  // (30/10/2026). L'intervenant choisit une personne et passe l'enquête.
  canManage: boolean;
  roster: Roster;
  structureName: string;
  storageWorks: boolean;
  onPick: (person: RosterPerson) => void;
  onAnonymous: () => void;
  onAdd: (lastName: string, firstName: string) => void;
  onOpenImport: () => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const progress = rosterProgress(roster);
  const next = nextToSurvey(roster);
  const shown = searchRoster(roster, query);

  return (
    <section aria-labelledby="enquete-liste" className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
      <h1 id="enquete-liste" className="text-[34px] font-bold leading-tight">
        Enquête de satisfaction
      </h1>

      {!storageWorks && (
        <p role="alert" className="rounded-xl border-2 border-danger-text px-4 py-3 font-bold text-danger-text">
          Cette tablette ne peut pas garder la liste (navigation privée ?). Les enquêtes s&apos;enregistrent quand même, mais la liste sera perdue en
          fermant la page.
        </p>
      )}

      {roster.people.length === 0 ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6">
          <h2 className="text-[26px] font-bold">Ajoutez d&apos;abord vos personnes</h2>
          <p>
            {canManage
              ? "Importez le fichier de vos personnes accompagnées (Excel ou CSV, par exemple exporté de Ximi), ou ajoutez-les une par une."
              : "La liste n'est pas encore sur cette tablette : un administrateur l'importe. Vous pouvez ajouter la personne que vous voyez."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {canManage && (
              <button type="button" className={TABLET_PRIMARY} onClick={onOpenImport}>
                <FileUp className="h-6 w-6" aria-hidden="true" />
                Importer la liste
              </button>
            )}
            <button type="button" className={TABLET_SECONDARY} onClick={() => setAdding(true)}>
              <UserPlus className="h-6 w-6" aria-hidden="true" />
              Ajouter une personne
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-6">
            <p className="text-[21px] font-bold" aria-live="polite">
              {progress.done} personne{progress.done > 1 ? "s" : ""} sur {progress.total} {progress.done > 1 ? "ont" : "a"} répondu
            </p>
            <ProgressBar value={progress.done} max={progress.total} label="Personnes qui ont répondu" colorClassName="bg-accent-fill" />
            {next ? (
              <button type="button" className={cn(TABLET_PRIMARY, "mt-2")} onClick={() => onPick(next)}>
                Commencer avec {displayName(next)}
              </button>
            ) : (
              <p className="flex items-center gap-2 font-bold text-ok-text">
                <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                Tout le monde a répondu. Bravo !
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <label htmlFor="enquete-cherche" className="text-[21px] font-bold">
              Ou choisissez une personne
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-ink2" aria-hidden="true" />
              <input
                id="enquete-cherche"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tapez un nom"
                autoComplete="off"
                className={cn(TABLET_INPUT, "pl-14")}
              />
            </div>
            <ul className="flex flex-col gap-2">
              {shown.map((person) => {
                const done = isPersonDone(person);
                return (
                  <li key={person.id}>
                    <button type="button" onClick={() => onPick(person)} className={cn(TABLET_CHOICE, TABLET_CHOICE_OFF, "justify-between")}>
                      <span className="flex items-center gap-3">
                        {done ? (
                          <CheckCircle2 className="h-7 w-7 shrink-0 text-ok-text" aria-hidden="true" />
                        ) : (
                          <Circle className="h-7 w-7 shrink-0 text-ink2" aria-hidden="true" />
                        )}
                        {displayName(person)}
                      </span>
                      <span className="text-right text-[17px] font-normal">
                        {done ? `Faite le ${shortDay(person.done.PERSONNE!)}` : "À faire"}
                        {person.done.FAMILLE && <span className="block">Proche : faite le {shortDay(person.done.FAMILLE)}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
              {shown.length === 0 && <li className="text-ink2">Personne ne s&apos;appelle comme ça dans la liste.</li>}
            </ul>
          </div>

          <div className={cn("grid gap-3", canManage ? "sm:grid-cols-3" : "sm:grid-cols-1")}>
            <button type="button" className={TABLET_SECONDARY} onClick={() => setAdding(true)}>
              <UserPlus className="h-6 w-6" aria-hidden="true" />
              Ajouter
            </button>
            {canManage && (
              <>
                <button type="button" className={TABLET_SECONDARY} onClick={onOpenImport}>
                  <FileUp className="h-6 w-6" aria-hidden="true" />
                  Importer
                </button>
                <button
                  type="button"
                  className={TABLET_SECONDARY}
                  onClick={() => downloadText(rosterExportFileName(structureName, new Date()), buildRosterCsv(roster), "text/csv;charset=utf-8")}
                >
                  <Download className="h-6 w-6" aria-hidden="true" />
                  Exporter (Ximi)
                </button>
              </>
            )}
          </div>
        </>
      )}

      <button type="button" className={cn(TABLET_SECONDARY, "w-fit")} onClick={onAnonymous}>
        Faire une enquête sans nom
      </button>

      <div className="flex flex-col gap-2 border-t border-line pt-4 text-[17px] text-ink2">
        <p>Cette liste reste sur cette tablette. Elle n&apos;est jamais envoyée à EODA. Les réponses, elles, partent sans aucun nom.</p>
        {canManage &&
          roster.people.length > 0 &&
          (confirmClear ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-ink">Effacer les {roster.people.length} personnes de cette tablette ?</span>
              <button
                type="button"
                className="rounded-xl border-2 border-danger-text px-4 py-2 font-bold text-danger-text"
                onClick={() => {
                  onClear();
                  setConfirmClear(false);
                }}
              >
                Oui, effacer
              </button>
              <button type="button" className="rounded-xl border border-ink px-4 py-2 text-ink" onClick={() => setConfirmClear(false)}>
                Non
              </button>
            </div>
          ) : (
            <button type="button" className="w-fit underline underline-offset-4" onClick={() => setConfirmClear(true)}>
              Effacer la liste de cette tablette
            </button>
          ))}
      </div>

      {adding && <AddPersonModal roster={roster} onAdd={onAdd} onClose={() => setAdding(false)} />}
    </section>
  );
}

function AddPersonModal({ roster, onAdd, onClose }: { roster: Roster; onAdd: (lastName: string, firstName: string) => void; onClose: () => void }) {
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = addPersonError(roster, lastName, firstName);
    if (problem) return setError(problem);
    onAdd(cleanName(lastName), cleanName(firstName));
    setAdded(displayName({ lastName: cleanName(lastName), firstName: cleanName(firstName) }));
    setLastName("");
    setFirstName("");
    setError(null);
  }

  return (
    <Modal title="Ajouter une personne" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4 p-5 text-[19px]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ajout-nom" className="font-bold">
            Nom
          </label>
          <input id="ajout-nom" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="off" autoFocus className={TABLET_INPUT} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ajout-prenom" className="font-bold">
            Prénom
          </label>
          <input id="ajout-prenom" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="off" className={TABLET_INPUT} />
        </div>
        {error && (
          <p role="alert" className="font-bold text-danger-text">
            {error}
          </p>
        )}
        {added && !error && (
          <p role="status" className="font-bold text-ok-text">
            {added} est ajouté(e). Vous pouvez en ajouter une autre.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="button" className={TABLET_SECONDARY} onClick={onClose}>
            Terminé
          </button>
          <button type="submit" className={`${TABLET_PRIMARY} flex-1`}>
            Ajouter
          </button>
        </div>
      </form>
    </Modal>
  );
}
