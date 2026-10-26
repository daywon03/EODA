"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ADMISSION_EXPLANATIONS,
  ADMISSION_EXPLANATIONS_PROVISIONAL,
  ADMISSION_HANDED_DOCUMENTS,
  allAdmissionPoints,
  type HandedDocumentId,
} from "@/content/admission/explications";

// Ce que le manuel HAS demande d'expliquer à l'arrivée (content/admission). Chaque
// point se coche AVEC la personne ; l'heure est gardée et figure dans le contrat.

function Tick({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onToggle} className={cn("flex min-h-[68px] w-full items-center gap-3.5 rounded-xl border-2 px-3.5 py-2 text-left text-[19px]", on ? "border-ok-text bg-ok-soft" : "border-line bg-card")}>
      <span className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border-2", on ? "border-ok-text bg-green-fill" : "border-muted bg-card")}>
        {on && <Check className="h-5 w-5" aria-hidden="true" />}
      </span>
      <span className="flex flex-col">{children}</span>
    </button>
  );
}

export function AdmissionExplainStep({ explained, handed, onExplained, onHanded }: {
  explained: Record<string, string>;
  handed: Partial<Record<HandedDocumentId, string>>;
  onExplained: (next: Record<string, string>) => void;
  onHanded: (next: Partial<Record<HandedDocumentId, string>>) => void;
}) {
  const total = allAdmissionPoints().length;
  const done = allAdmissionPoints().filter((p) => explained[p.id]).length;
  const toggle = <K extends string>(map: Partial<Record<K, string>>, key: K): Partial<Record<K, string>> => {
    const next = { ...map };
    if (next[key]) delete next[key];
    else next[key] = new Date().toISOString();
    return next;
  };

  return (
    <div className="flex max-w-[860px] flex-col gap-7">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[19px]">Dites chaque point avec vos mots, puis cochez-le. La personne peut poser toutes ses questions.</p>
        <span className="tabular-nums text-[19px] font-bold">{done} sur {total}</span>
      </div>

      {ADMISSION_EXPLANATIONS.map((section) => (
        <section key={section.id} aria-labelledby={`expl-${section.id}`} className="flex flex-col gap-2.5">
          <h2 id={`expl-${section.id}`} className="text-[24px] font-bold">{section.title}</h2>
          {section.points.map((point) => (
            <Tick key={point.id} on={Boolean(explained[point.id])} onToggle={() => onExplained(toggle(explained, point.id) as Record<string, string>)}>
              <span>{point.label}</span>
              {point.hint && <span className="text-[17px] text-ink2">{point.hint}</span>}
              {point.toConfirm && <span className="text-[16px] font-bold text-ink2">À confirmer par EODA : {point.toConfirm}</span>}
            </Tick>
          ))}
        </section>
      ))}

      <section aria-labelledby="expl-remis" className="flex flex-col gap-2.5">
        <h2 id="expl-remis" className="text-[24px] font-bold">Documents remis à la personne</h2>
        <p className="text-[18px] text-ink2">Cochez quand le document est dans ses mains.</p>
        {ADMISSION_HANDED_DOCUMENTS.map((doc) => (
          <Tick key={doc.id} on={Boolean(handed[doc.id])} onToggle={() => onHanded(toggle(handed, doc.id))}>
            {doc.label}
          </Tick>
        ))}
      </section>

      {ADMISSION_EXPLANATIONS_PROVISIONAL && <p className="text-[16px] text-ink2">Points provisoires, en attente de validation par EODA.</p>}
    </div>
  );
}
