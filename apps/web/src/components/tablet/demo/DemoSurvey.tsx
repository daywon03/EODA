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
type Props = { people: readonly DemoPerson[]; initialPersonId: string; onDone: (personId: string) => void; onHome: () => void };
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
  const answer = answers[question.id];

  function next() {
    if (question.kind === "SCALE" && !answer?.choice) {
      setHint("Choisissez une réponse ou « Ne se prononce pas ».");
      return;
    }
    setHint(null);
    if (isLast) {
      onDone(person.id);
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
        <ul className="flex flex-col gap-2.5">
          {people.map((p) => (
            <li key={p.id}>
              <button type="button" aria-pressed={p.id === personId} onClick={() => setPersonId(p.id)} className={cn(TABLET_CHOICE, "justify-between", p.id === personId ? "border-accent-fill bg-paper text-ink" : TABLET_CHOICE_OFF)}>
                <span>{p.name}</span>
                <span className="text-[17px] font-normal text-ink2">GIR {p.gir} · {p.surveyDone ? "enquête faite" : "enquête à faire"}</span>
              </button>
            </li>
          ))}
        </ul>
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2 text-[21px] font-bold">Qui répond ?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["PERSONNE", "FAMILLE"] as const).map((code) => (
              <button key={code} type="button" aria-pressed={who === code} onClick={() => setWho(code)} className={cn(TABLET_CHOICE, "min-h-24 flex-col items-start justify-center gap-1", who === code ? TABLET_CHOICE_ON : TABLET_CHOICE_OFF)}>
                <span>{code === "PERSONNE" ? "La personne" : "Un proche"}</span>
                <span className="text-[17px] font-normal">{code === "PERSONNE" ? "Elle répond elle-même" : "La famille répond pour elle"}</span>
              </button>
            ))}
          </div>
        </fieldset>
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
          Question {index + 1} sur {total} · {who === "PERSONNE" ? "questionnaire personne" : "questionnaire famille"}
        </p>
        <ProgressBar value={index + 1} max={total} label="Avancement de l'enquête" colorClassName="bg-accent-fill" className="min-w-[140px] max-w-[280px] flex-1" />
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
