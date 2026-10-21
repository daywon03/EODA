"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { submitAnonymousSurveyLink, type AnonymousSurveyTemplateView } from "@/lib/actions/anonymous-survey";
import { TABLET_PRIMARY } from "@/components/tablet/tablet-ui";
import { AnonymousSurveyFlow } from "./AnonymousSurveyFlow";

type Refusal = "INVALID" | "EXPIRED" | "USED" | "RATE_LIMITED";

const REFUSALS: Record<Refusal, { title: string; text: string }> = {
  INVALID: { title: "Ce lien ne marche pas.", text: "Demandez un nouveau lien au service." },
  EXPIRED: { title: "Ce lien a expiré.", text: "Demandez un nouveau lien au service." },
  USED: { title: "Cette enquête est déjà faite.", text: "Merci ! Les réponses sont bien enregistrées." },
  RATE_LIMITED: { title: "Trop d'essais.", text: "Attendez un quart d'heure, puis recommencez." },
};

// Le même message pour un jeton inconnu et un jeton mal formé : on ne renseigne pas
// sur ce qui existe.
export function SurveyLinkRefusal({ state }: { state: Refusal }) {
  const message = REFUSALS[state];
  return (
    <section role="status" className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-card p-6">
      <CircleAlert className="h-10 w-10 text-accent-text" aria-hidden="true" />
      <h1 className="text-[26px] font-bold leading-tight">{message.title}</h1>
      <p>{message.text}</p>
    </section>
  );
}

export function LinkSurveyRunner({ token, template, notice }: { token: string; template: AnonymousSurveyTemplateView; notice: string }) {
  const [step, setStep] = useState<"intro" | "questions" | "done">("intro");
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  if (refusal) return <SurveyLinkRefusal state={refusal} />;

  if (step === "done") {
    return (
      <section role="status" className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2 className="h-20 w-20 text-ok-text" aria-hidden="true" />
        <h1 className="text-[30px] font-bold">Merci, c&apos;est envoyé.</h1>
        <p>Vos réponses rejoignent celles des autres personnes, sans votre nom. Vous pouvez fermer cette page.</p>
      </section>
    );
  }

  if (step === "intro") {
    return (
      <section aria-labelledby="enquete-intro" className="flex flex-col gap-5">
        <h1 id="enquete-intro" className="text-[30px] font-bold leading-tight">
          {template.title}
        </h1>
        <p>{template.respondentLabel}</p>
        <p className="rounded-xl bg-soft px-4 py-3">{notice}</p>
        <p className="text-ink2">{template.questions.length} questions, environ 5 minutes.</p>
        <button type="button" className={TABLET_PRIMARY} onClick={() => setStep("questions")}>
          Commencer
        </button>
      </section>
    );
  }

  return (
    <AnonymousSurveyFlow
      template={template}
      onBack={() => setStep("intro")}
      onFinish={async (answers) => {
        const result = await submitAnonymousSurveyLink(token, JSON.stringify(answers));
        if (result.state === "DONE") {
          setStep("done");
          window.scrollTo(0, 0);
          return null;
        }
        if (result.state === "ERROR") return result.error;
        setRefusal(result.state);
        return null;
      }}
    />
  );
}
