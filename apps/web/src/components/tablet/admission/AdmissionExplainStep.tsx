"use client";

import { useState } from "react";
import { Check, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { awarenessSheetIsWord, tabletAwarenessSheetUrl, type TabletAwarenessSheet } from "@/lib/services/awareness-sheet-links";
import { DocxPreview } from "@/components/structure/DocxPreview";
import { TABLET_SECONDARY } from "../tablet-ui";
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

// « Voir la fiche » (call du 28/10/2026) : l'intervenant montre la fiche de
// sensibilisation, l'explique, puis coche. Un Word se dessine ici ; un PDF ou une image
// s'ouvre tel quel. Rien n'est enregistré : c'est un document de la structure.
function SheetButton({ title, sheet, onOpen }: { title: string; sheet: TabletAwarenessSheet; onOpen: () => void }) {
  const className = cn(TABLET_SECONDARY, "w-fit gap-2");
  if (!awarenessSheetIsWord(sheet.originalFilename)) {
    return (
      <a href={tabletAwarenessSheetUrl(sheet.versionId)} target="_blank" rel="noopener" className={className}>
        <FileText className="h-5 w-5" aria-hidden="true" />
        Voir la fiche « {title} »
      </a>
    );
  }
  return (
    <button type="button" onClick={onOpen} className={className}>
      <FileText className="h-5 w-5" aria-hidden="true" />
      Voir la fiche « {title} »
    </button>
  );
}

function SheetViewer({ title, sheet, onClose }: { title: string; sheet: TabletAwarenessSheet; onClose: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <div role="dialog" aria-modal="true" aria-label={`Fiche — ${title}`} className="fixed inset-0 z-50 flex flex-col bg-paper">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="text-[22px] font-bold">{title}</h2>
        <button type="button" onClick={onClose} className={cn(TABLET_SECONDARY, "gap-2")} autoFocus>
          <X className="h-5 w-5" aria-hidden="true" />
          Fermer la fiche
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {failed ? (
          <p className="text-[19px]">
            La fiche ne s&apos;affiche pas ici.{" "}
            <a href={tabletAwarenessSheetUrl(sheet.versionId)} className="font-bold underline">Ouvrir le fichier</a>
          </p>
        ) : (
          <DocxPreview url={tabletAwarenessSheetUrl(sheet.versionId)} title={title} onFailed={() => setFailed(true)} />
        )}
      </div>
    </div>
  );
}

export function AdmissionExplainStep({ explained, handed, sheets = {}, onExplained, onHanded }: {
  explained: Record<string, string>;
  handed: Partial<Record<HandedDocumentId, string>>;
  sheets?: Readonly<Record<string, TabletAwarenessSheet>>;
  onExplained: (next: Record<string, string>) => void;
  onHanded: (next: Partial<Record<HandedDocumentId, string>>) => void;
}) {
  const [opened, setOpened] = useState<{ title: string; sheet: TabletAwarenessSheet } | null>(null);
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
          {section.points.map((point) => {
            const sheet = point.sheet ? sheets[point.sheet] : undefined;
            return (
              <div key={point.id} className="flex flex-col gap-2">
                <Tick on={Boolean(explained[point.id])} onToggle={() => onExplained(toggle(explained, point.id) as Record<string, string>)}>
                  <span>{point.label}</span>
                  {point.hint && <span className="text-[17px] text-ink2">{point.hint}</span>}
                  {point.toConfirm && <span className="text-[16px] font-bold text-ink2">À confirmer par EODA : {point.toConfirm}</span>}
                </Tick>
                {sheet && <SheetButton title={sheetTitle(point.label)} sheet={sheet} onOpen={() => setOpened({ title: sheetTitle(point.label), sheet })} />}
                {point.sheet && !sheet && (
                  <span className="pl-1 text-[16px] text-ink2">La fiche de sensibilisation n&apos;est pas encore disponible (EODA la dépose et la valide).</span>
                )}
              </div>
            );
          })}
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
      {opened && <SheetViewer title={opened.title} sheet={opened.sheet} onClose={() => setOpened(null)} />}
    </div>
  );
}

// Titre de la fiche, tiré de sa ligne : « Expliquer comment faire une plainte ou une
// réclamation, et à qui s'adresser » → « comment faire une plainte ou une réclamation ».
function sheetTitle(label: string): string {
  return label.replace(/^Expliquer\s+/i, "").replace(/,.*$/, "");
}
