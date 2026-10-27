"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitTabletAnonymousSurvey, type AnonymousSurveyTemplateView } from "@/lib/actions/anonymous-survey";
import type { SurveyMode, SurveyTemplateCode } from "@/lib/hds/beneficiary-data-port";
import { AnonymousSurveyFlow } from "@/components/survey/AnonymousSurveyFlow";
import {
  addPeople,
  dayOf,
  describeRosterImport,
  displayName,
  markSurveyDone,
  nextToSurvey,
  type RosterPerson,
} from "@/lib/services/survey-roster-service";
import { TABLET_CHOICE, TABLET_CHOICE_OFF, TABLET_CHOICE_ON, TABLET_PRIMARY, TABLET_SECONDARY } from "../tablet-ui";
import { RosterHome } from "./RosterHome";
import { RosterImportPanel } from "./RosterImportPanel";
import { newPersonId, useSurveyRoster } from "./use-survey-roster";

// ─────────────────────────────────────────────────────────────────────────────
// ENQUÊTE SUR LA TABLETTE (version officielle, 22/10/2026).
//
// liste → qui répond → questions → merci → personne suivante.
// La personne est choisie dans la liste de la TABLETTE (survey-roster-service) pour
// savoir qui a déjà répondu ; ses réponses partent par `submitTabletAnonymousSurvey`,
// qui ne reçoit NI son nom NI son identifiant. Seule la tablette coche « fait »,
// avec le jour. Une enquête « sans nom » reste possible.
// ─────────────────────────────────────────────────────────────────────────────

type Step = "list" | "pick" | "questions" | "done";

export function TabletSurvey({
  templates,
  establishmentId,
  structureName,
  listedNotice,
  anonymousNotice,
  initialPersonId = null,
}: {
  templates: AnonymousSurveyTemplateView[];
  establishmentId: string;
  structureName: string;
  listedNotice: string;
  anonymousNotice: string;
  // Arrivée depuis le contrat signé d'une personne (26/10/2026) : identifiant de la
  // liste LOCALE, jamais un nom ; ignoré s'il n'est pas dans la liste.
  initialPersonId?: string | null;
}) {
  const { roster, update, loaded, storageWorks } = useSurveyRoster(establishmentId);
  const [step, setStep] = useState<Step>("list");
  const [personId, setPersonId] = useState<string | null>(null);
  const [who, setWho] = useState<SurveyTemplateCode>("PERSONNE");
  const [mode, setMode] = useState<SurveyMode>("ASSISTEE");
  const [importing, setImporting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const template = templates.find((t) => t.code === who) ?? templates[0]!;
  const person = personId ? (roster.people.find((p) => p.id === personId) ?? null) : null;

  function go(next: Step) {
    setStep(next);
    window.scrollTo(0, 0);
  }

  // Ouvre « qui répond ? » pour une personne : on propose d'emblée le questionnaire
  // qui manque (la personne d'abord, puis son proche).
  function pick(target: RosterPerson | null) {
    setPersonId(target?.id ?? null);
    setWho(target?.done.PERSONNE && !target.done.FAMILLE ? "FAMILLE" : "PERSONNE");
    setMode("ASSISTEE");
    setFlash(null);
    go("pick");
  }

  const opened = useRef(false);
  useEffect(() => {
    if (!loaded || opened.current || !initialPersonId) return;
    opened.current = true;
    const target = roster.people.find((p) => p.id === initialPersonId);
    if (target) pick(target);
    // `pick` ne change que l'état local : on n'ouvre qu'une fois, au chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, initialPersonId, roster.people]);

  if (!loaded) return <p role="status">Chargement de la liste…</p>;

  if (step === "done") {
    const next = nextToSurvey(roster);
    return (
      <section role="status" className="mx-auto mt-8 flex max-w-[760px] flex-col items-center gap-5 text-center">
        <CheckCircle2 className="h-24 w-24 text-ok-text" aria-hidden="true" />
        <h1 className="text-[36px] font-bold">Merci, l&apos;enquête est enregistrée.</h1>
        <p className="text-[21px]">
          {person ? `L'enquête de ${displayName(person)} est cochée comme faite. ` : ""}
          Les réponses rejoignent les statistiques du service, sans nom.
        </p>
        <div className="flex w-full flex-col gap-3">
          {person && next && (
            <button type="button" className={TABLET_PRIMARY} onClick={() => pick(next)}>
              Personne suivante : {displayName(next)}
            </button>
          )}
          {!person && (
            <button type="button" className={TABLET_PRIMARY} onClick={() => pick(null)}>
              Enquête suivante sans nom
            </button>
          )}
          <button type="button" className={TABLET_SECONDARY} onClick={() => go("list")}>
            Revenir à la liste
          </button>
          <Link href="/tablette" className={TABLET_SECONDARY}>
            Revenir à l&apos;accueil
          </Link>
        </div>
      </section>
    );
  }

  if (step === "questions") {
    return (
      <AnonymousSurveyFlow
        template={template}
        coaching={mode === "ASSISTEE" ? "Lisez la question à voix haute. Notez la réponse de la personne, pas la vôtre." : "Laissez la personne répondre seule."}
        onBack={() => go("pick")}
        onFinish={async (answers) => {
          // Rien de la personne n'est envoyé : ni nom, ni identifiant de la liste.
          const data = new FormData();
          data.set("templateCode", template.code);
          data.set("mode", mode);
          data.set("answers", JSON.stringify(answers));
          const result = await submitTabletAnonymousSurvey(data);
          if ("error" in result) return result.error;
          if (person) update(markSurveyDone(roster, person.id, template.code, dayOf(new Date())));
          go("done");
          return null;
        }}
      />
    );
  }

  if (step === "pick") {
    const firstName = person?.firstName || (person ? displayName(person) : null);
    return (
      <section aria-labelledby="enquete-qui" className="mx-auto flex max-w-[860px] flex-col gap-6">
        <h1 id="enquete-qui" className="text-[34px] font-bold leading-tight">
          {person ? `Enquête de ${displayName(person)}` : "Enquête sans nom"}
        </h1>
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2 text-[21px] font-bold">Qui répond ?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["PERSONNE", "FAMILLE"] as const).map((code) => {
              const doneOn = person?.done[code];
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={who === code}
                  onClick={() => setWho(code)}
                  className={cn(TABLET_CHOICE, "min-h-24 flex-col items-start justify-center gap-1", who === code ? TABLET_CHOICE_ON : TABLET_CHOICE_OFF)}
                >
                  <span>{code === "PERSONNE" ? (firstName ? `${firstName} répond` : "La personne") : "Un proche"}</span>
                  <span className="text-[17px] font-normal">
                    {code === "PERSONNE" ? "Elle répond elle-même" : "La famille répond pour elle"}
                    {doneOn ? " · déjà faite" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2 text-[21px] font-bold">Comment ?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["ASSISTEE", "SEULE"] as const).map((value) => (
              <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={cn(TABLET_CHOICE, "min-h-20", mode === value ? TABLET_CHOICE_ON : TABLET_CHOICE_OFF)}>
                {value === "ASSISTEE" ? "Je lis les questions" : "La personne lit seule"}
              </button>
            ))}
          </div>
        </fieldset>
        {person?.done[who] && (
          <p role="status" className="rounded-xl border-2 border-line px-4 py-3 font-bold">
            Ce questionnaire est déjà fait pour cette personne. Le refaire ajoutera une deuxième réponse.
          </p>
        )}
        <p className="rounded-xl bg-soft px-4 py-3 text-[17px]">{person ? listedNotice : anonymousNotice}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={TABLET_SECONDARY} onClick={() => go("list")}>
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            Changer de personne
          </button>
          <button type="button" className={cn(TABLET_PRIMARY, "flex-1")} onClick={() => go("questions")}>
            Commencer les questions
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      {flash && (
        <p role="status" className="mx-auto mb-4 w-full max-w-[860px] rounded-xl bg-soft px-4 py-3 font-bold">
          {flash}
        </p>
      )}
      <RosterHome
        roster={roster}
        structureName={structureName}
        storageWorks={storageWorks}
        onPick={pick}
        onAnonymous={() => pick(null)}
        onAdd={(lastName, firstName) => update(addPeople(roster, [{ lastName, firstName }], newPersonId))}
        onOpenImport={() => setImporting(true)}
        onClear={() => {
          update({ version: 1, people: [] });
          setFlash("La liste est effacée de cette tablette.");
        }}
      />
      {importing && (
        <RosterImportPanel
          roster={roster}
          onClose={() => setImporting(false)}
          onImport={(plan) => {
            update(addPeople(roster, plan.people, newPersonId));
            setImporting(false);
            setFlash(describeRosterImport(plan));
          }}
        />
      )}
    </>
  );
}
