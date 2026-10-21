"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SURVEY_SCALES, surveyTemplateFor } from "@/content/enquete";
import type { SurveyChoice, SurveyTemplateCode } from "@/lib/hds/beneficiary-data-port";
import { ProgressBar } from "@/components/ui/progress-bar";
import { TABLET_CHOICE, TABLET_CHOICE_OFF, TABLET_CHOICE_ON, TABLET_PRIMARY, TABLET_SECONDARY } from "../tablet-ui";
import type { DemoPerson } from "./demo-data";

// Enquête sur la tablette (maquette T2-T4) : choisir la personne et qui répond, une
// question par écran avec passage automatique, texte libre facultatif, merci. Les
// questions sont CELLES du questionnaire versionné (content/enquete/).
// DEUX questionnaires par personne (gabarit « Enquête de satisfaction » v1.0) : celui de
// la personne accompagnée (FALC, 12 questions) et celui d'un proche ou de la famille
// (14 questions). « Qui répond ? » choisit le questionnaire, et l'état affiché dans la
// liste suit ce choix : la personne a pu répondre sans que la famille l'ait fait.
type Props = { people: readonly DemoPerson[]; initialPersonId: string; onDone: (personId: string, who: SurveyTemplateCode) => void; onHome: () => void };
type Answer = { choice?: SurveyChoice; text?: string };

export function DemoSurvey({ people, initialPersonId, onDone, onHome }: Props) {
  const [step, setStep] = useState<"pick" | "q" | "done">("pick");
  const [personId, setPersonId] = useState(initialPersonId);
  const [who, setWho] = useState<SurveyTemplateCode>("PERSONNE");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [hint, setHint] = useState<string | null>(null);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (advance.current) clearTimeout(advance.current); }, []);

  const template = surveyTemplateFor(who);
  const person = people.find((p) => p.id === personId) ?? people[0]!;
  const question = template.questions[index]!;
  const total = template.questions.length;
  const isLast = index === total - 1;
  // « 12 questions » et « 14 questions » sont les nombres ANNONCÉS par le gabarit de
  // Sandrine, et ce sont les questions cotées : les zones de texte libre (proposition
  // sur le règlement, message final) n'ont pas de numéro, comme sur le papier. Compter
  // tous les écrans annonçait 14 et 17, soit deux questionnaires qui ne ressemblaient
  // plus à ceux qu'on fait remplir (constat de Damon, 20/10/2026).
  const scaleTotal = template.questions.filter((q) => q.kind === "SCALE").length;
  const textTotal = template.questions.filter((q) => q.kind === "TEXT").length;
  const scalePosition = template.questions.slice(0, index + 1).filter((q) => q.kind === "SCALE").length;
  const whoLabel = who === "PERSONNE" ? "questionnaire personne" : "questionnaire famille";
  const answer = answers[question.id];
  // Question « votre lien avec la personne » : une option fermée, plus la précision
  // libre du gabarit (« autre : .... »). Tout est calculé ici pour ne pas dépendre du
  // rétrécissement de type à l'intérieur des gestionnaires d'événements.
  const choiceText = question.kind === "CHOICE" ? (answer?.text ?? "") : "";
  const otherOption = question.kind === "CHOICE" ? question.otherOption : undefined;
  const otherPrecision =
    otherOption && choiceText.startsWith(`${otherOption} : `) ? choiceText.slice(otherOption.length + 3) : "";
  const otherSelected = otherOption !== undefined && (choiceText === otherOption || otherPrecision !== "");

  function next() {
    if (question.kind === "SCALE" && !answer?.choice) {
      setHint("Choisissez une réponse ou « Ne se prononce pas ».");
      return;
    }
    setHint(null);
    if (isLast) {
      onDone(person.id, who);
      setStep("done");
      window.scrollTo(0, 0);
    } else setIndex(index + 1);
  }

  function choose(choice: SurveyChoice) {
    setAnswers({ ...answers, [question.id]: { choice } });
    setHint(null);
    if (advance.current) clearTimeout(advance.current);
    if (!isLast) advance.current = setTimeout(() => setIndex((i) => (i === index ? i + 1 : i)), 320);
  }

  if (step === "pick") {
    return (
      <section aria-labelledby="enquete-qui" className="mx-auto flex max-w-[860px] flex-col gap-6">
        <div>
          <p className="font-bold text-ink2">Enquête de satisfaction · étape 1 sur 2</p>
          <h1 id="enquete-qui" className="text-[34px] font-bold leading-tight">Avec qui faites-vous l&apos;enquête ?</h1>
        </div>
        {/* « Qui répond ? » vient AVANT la liste : c'est lui qui choisit le
            questionnaire, donc l'état affiché à côté de chaque nom. */}
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2 text-[21px] font-bold">Qui répond ?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["PERSONNE", "FAMILLE"] as const).map((code) => (
              <button key={code} type="button" aria-pressed={who === code} onClick={() => setWho(code)} className={cn(TABLET_CHOICE, "min-h-24 flex-col items-start justify-center gap-1", who === code ? TABLET_CHOICE_ON : TABLET_CHOICE_OFF)}>
                <span>{code === "PERSONNE" ? "La personne" : "Un proche"}</span>
                <span className="text-[17px] font-normal">{code === "PERSONNE" ? "Elle répond elle-même · 12 questions" : "La famille répond pour elle · 14 questions"}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <ul className="flex flex-col gap-2.5">
          {people.map((p) => {
            const alreadyDone = p.surveys[who];
            return (
              <li key={p.id}>
                <button type="button" aria-pressed={p.id === personId} onClick={() => setPersonId(p.id)} className={cn(TABLET_CHOICE, "justify-between", p.id === personId ? "border-accent-fill bg-paper text-ink" : TABLET_CHOICE_OFF)}>
                  <span>{p.name}</span>
                  <span className={cn("text-[17px] font-normal", alreadyDone ? "text-ok-text" : "text-ink2")}>
                    GIR {p.gir} · {alreadyDone ? "questionnaire déjà fait" : "questionnaire à faire"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {/* Le chapeau du questionnaire choisi. Il change avec « Qui répond ? » — c'est
            ce qui montre qu'il y a DEUX questionnaires et non un seul adapté : la
            famille a le sien, avec son introduction, ses 14 questions cotées et ses
            trois zones libres. */}
        <div className="rounded-xl border-2 border-muted bg-card px-5 py-4">
          <p className="text-[21px] font-bold text-ink">{template.title}</p>
          <p className="mt-1.5 text-[17px] leading-relaxed text-ink2">{template.intro}</p>
          <p className="mt-2 text-[17px] font-bold text-ink">
            {scaleTotal} questions · {textTotal} zone
            {textTotal > 1 ? "s" : ""} de texte libre, facultative
            {textTotal > 1 ? "s" : ""}
            {template.questions.some((q) => q.kind === "CHOICE") && " · et une question sur votre lien avec la personne, facultative"}
          </p>
        </div>
        <p className="rounded-xl bg-soft px-4 py-3 text-[17px]">{template.privacyNotice}</p>
        <button type="button" className={TABLET_PRIMARY} onClick={() => { setIndex(0); setAnswers({}); setStep("q"); window.scrollTo(0, 0); }}>
          Commencer les questions
        </button>
      </section>
    );
  }

  if (step === "done") {
    return (
      <section aria-labelledby="enquete-merci" className="mx-auto mt-8 flex max-w-[760px] flex-col items-center gap-5 text-center">
        <CheckCircle2 className="h-24 w-24 text-ok-text" aria-hidden="true" />
        <h1 id="enquete-merci" className="text-[36px] font-bold">Merci, l&apos;enquête est terminée.</h1>
        <p className="text-[21px]">
          En service réel, les réponses {who === "PERSONNE" ? `de ${person.name}` : `de la famille de ${person.name}`} rejoignent les statistiques du service,
          sans nom. Ici, en démonstration, elles ne sont pas gardées.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" className={TABLET_PRIMARY} onClick={() => setStep("pick")}>Enquête suivante</button>
          <button type="button" className={TABLET_SECONDARY} onClick={onHome}>Revenir à l&apos;accueil</button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="enquete-question" className="mx-auto flex max-w-[860px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold tabular-nums text-ink2" aria-live="polite">
          {question.kind === "SCALE"
            ? `Question ${scalePosition} sur ${scaleTotal} · ${whoLabel}`
            : question.kind === "CHOICE"
              ? `Question facultative · ${whoLabel}`
              : `Question libre · ${whoLabel}`}
        </p>
        <ProgressBar value={scalePosition} max={scaleTotal} label="Avancement de l'enquête" colorClassName="bg-accent-fill" className="min-w-[140px] max-w-[280px] flex-1" />
      </div>
      <p className="rounded-xl bg-soft px-4 py-3 text-[17px]">Lisez la question à voix haute. Notez la réponse de la personne, pas la vôtre.</p>
      <h1 id="enquete-question" className="text-balance text-[32px] font-bold leading-tight sm:text-[36px]">{question.prompt}</h1>
      {question.kind === "SCALE" && question.help && <p className="text-[19px] text-ink2">{question.help}</p>}
      {question.kind === "SCALE" ? (
        <div className="flex flex-col gap-3" role="group" aria-labelledby="enquete-question">
          {SURVEY_SCALES[question.scale].options.map((option) => (
            <button key={option.choice} type="button" aria-pressed={answer?.choice === option.choice} onClick={() => choose(option.choice)} className={cn(TABLET_CHOICE, answer?.choice === option.choice ? TABLET_CHOICE_ON : TABLET_CHOICE_OFF)}>
              {option.label}
            </button>
          ))}
        </div>
      ) : question.kind === "CHOICE" ? (
        <div className="flex flex-col gap-3" role="group" aria-labelledby="enquete-question">
          {question.options.map((option) => {
            const selected = choiceText === option || choiceText.startsWith(`${option} : `);
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => setAnswers({ ...answers, [question.id]: { text: option } })}
                className={cn(TABLET_CHOICE, selected ? TABLET_CHOICE_ON : TABLET_CHOICE_OFF)}
              >
                {option}
              </button>
            );
          })}
          {otherSelected && (
            <label className="flex flex-col gap-2">
              <span className="text-[19px] text-ink2">Précisez (facultatif)</span>
              <input
                type="text"
                maxLength={200}
                value={otherPrecision}
                onChange={(event) =>
                  setAnswers({
                    ...answers,
                    [question.id]: {
                      text: event.target.value.trim() ? `${otherOption ?? ""} : ${event.target.value}` : (otherOption ?? ""),
                    },
                  })
                }
                className="w-full rounded-2xl border-2 border-muted bg-card p-4 text-[20px] text-ink"
              />
            </label>
          )}
          {/* Facultative sur le papier : elle ne bloque donc jamais le passage. */}
          <p className="text-[19px] text-ink2">Facultatif : vous pouvez passer cette question.</p>
        </div>
      ) : (
        <label className="flex flex-col gap-2">
          <span className="text-[19px] text-ink2">Écrivez ce que la personne dit. Facultatif. Aucune information de santé.</span>
          <textarea
            rows={5}
            maxLength={1000}
            value={answer?.text ?? ""}
            onChange={(event) => setAnswers({ ...answers, [question.id]: { text: event.target.value } })}
            className="w-full rounded-2xl border-2 border-muted bg-card p-4 text-[20px] leading-relaxed text-ink"
          />
        </label>
      )}
      {hint && <p role="alert" className="text-[19px] font-bold text-danger-text">{hint}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={TABLET_SECONDARY} onClick={() => (index > 0 ? setIndex(index - 1) : setStep("pick"))}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Retour
        </button>
        <button type="button" className={cn(TABLET_PRIMARY, "flex-1")} onClick={next}>
          {isLast ? "Terminer l'enquête" : "Question suivante"}
        </button>
      </div>
    </section>
  );
}
