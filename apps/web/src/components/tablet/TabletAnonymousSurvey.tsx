"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitTabletAnonymousSurvey, type AnonymousSurveyTemplateView } from "@/lib/actions/anonymous-survey";
import type { SurveyMode, SurveyTemplateCode } from "@/lib/hds/beneficiary-data-port";
import { AnonymousSurveyFlow } from "@/components/survey/AnonymousSurveyFlow";
import { TABLET_CHOICE, TABLET_CHOICE_OFF, TABLET_CHOICE_ON, TABLET_PRIMARY, TABLET_SECONDARY } from "./tablet-ui";

// Enquête ANONYME sur la tablette : qui répond, seul ou avec l'intervenant, puis les
// questions. On ne choisit PAS la personne : la réponse n'est rattachée à personne.
export function TabletAnonymousSurvey({ templates, notice }: { templates: AnonymousSurveyTemplateView[]; notice: string }) {
  const [step, setStep] = useState<"pick" | "questions" | "done">("pick");
  const [who, setWho] = useState<SurveyTemplateCode>("PERSONNE");
  const [mode, setMode] = useState<SurveyMode>("ASSISTEE");
  const template = templates.find((t) => t.code === who) ?? templates[0]!;

  if (step === "done") {
    return (
      <section role="status" className="mx-auto mt-8 flex max-w-[760px] flex-col items-center gap-5 text-center">
        <CheckCircle2 className="h-24 w-24 text-ok-text" aria-hidden="true" />
        <h1 className="text-[36px] font-bold">Merci, l&apos;enquête est enregistrée.</h1>
        <p className="text-[21px]">Les réponses rejoignent les statistiques du service, sans nom.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" className={TABLET_PRIMARY} onClick={() => setStep("pick")}>
            Enquête suivante
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
        onBack={() => setStep("pick")}
        onFinish={async (answers) => {
          const data = new FormData();
          data.set("templateCode", template.code);
          data.set("mode", mode);
          data.set("answers", JSON.stringify(answers));
          const result = await submitTabletAnonymousSurvey(data);
          if ("error" in result) return result.error;
          setStep("done");
          window.scrollTo(0, 0);
          return null;
        }}
      />
    );
  }

  return (
    <section aria-labelledby="enquete-qui" className="mx-auto flex max-w-[860px] flex-col gap-6">
      <h1 id="enquete-qui" className="text-[34px] font-bold leading-tight">
        Enquête de satisfaction anonyme
      </h1>
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
      <p className="rounded-xl bg-soft px-4 py-3 text-[17px]">{notice}</p>
      <button type="button" className={TABLET_PRIMARY} onClick={() => setStep("questions")}>
        Commencer les questions
      </button>
    </section>
  );
}
