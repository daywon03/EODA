"use client";

import { submitWithoutReset } from "@/lib/forms/submit-without-reset";
import { useActionState, useId } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { requestAccompaniment, type AccompanimentState } from "@/lib/actions/prospect-space";
import { CALL_MESSAGE_MAX, CALL_MOMENTS } from "@/lib/services/prospect-diagnostic-service";
import { cn } from "@/lib/utils";

const FIELD = "h-14 w-full rounded-[10px] border-2 border-line bg-card px-4 text-lg text-ink";

// « Être accompagné par EODA » (maquette Portail Client v2) : un appel de 20 minutes,
// à une date et un moment choisis LIBREMENT — il n'existe pas d'agenda de
// disponibilités, EODA confirme ensuite par e-mail. Rien n'est engagé.
export function AccompanimentForm({ minDay, maxDay }: { minDay: string; maxDay: string }) {
  const [state, formAction, isPending] = useActionState<AccompanimentState, FormData>(requestAccompaniment, { status: "IDLE" });
  const dayId = useId();
  const messageId = useId();

  if (state.status === "DONE") {
    return (
      <p role="status" className="rounded-xl border border-line bg-ok-soft p-4 font-bold">
        C&apos;est noté. EODA vous confirme le rendez-vous par e-mail.
      </p>
    );
  }

  return (
    <form method="post" onSubmit={submitWithoutReset(formAction)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={dayId} className="font-bold">
          Quel jour pouvons-nous vous appeler ?
        </label>
        <input id={dayId} name="day" type="date" min={minDay} max={maxDay} required className={cn(FIELD, "sm:w-64")} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-bold">À quel moment ?</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CALL_MOMENTS) as (keyof typeof CALL_MOMENTS)[]).map((moment, index) => (
            <label
              key={moment}
              className="inline-flex min-h-12 cursor-pointer items-center rounded-full border-2 border-line bg-card px-5 font-bold has-[:checked]:border-ink-fill has-[:checked]:bg-ink-fill has-[:checked]:text-on-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ambre"
            >
              <input type="radio" name="moment" value={moment} defaultChecked={index === 0} className="sr-only" />
              {CALL_MOMENTS[moment].title}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={messageId} className="font-bold">
          Qu&apos;est-ce qui vous bloque ? <span className="font-normal text-ink2">(facultatif)</span>
        </label>
        <input id={messageId} name="message" maxLength={CALL_MESSAGE_MAX} placeholder="Le plan de continuité, par exemple" className={FIELD} />
        <span className="text-base text-ink2">Aucun nom de personne accompagnée.</span>
      </div>
      {state.status === "ERROR" && (
        <p role="alert" className="flex items-start gap-2 font-bold text-danger-text">
          <AlertCircle className="mt-1 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
      <p className="text-base text-ink2">Rien n&apos;est engagé. EODA vous confirme le rendez-vous par e-mail.</p>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-14 w-fit items-center gap-2 rounded-[10px] bg-accent-fill px-6 text-lg font-bold text-on-accent disabled:opacity-60"
      >
        {isPending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        Demander cet appel
      </button>
    </form>
  );
}
