"use client";

import { useState } from "react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { TABLET_PRIMARY, TABLET_SECONDARY } from "../tablet-ui";
import { girTone, type DemoPerson } from "./demo-data";
import type { DemoEvidence } from "./DemoReception";

// Dossier de la personne (maquette T5) : documents, projet personnalisé, contacts,
// journal append-only. « Noter un événement » ajoute une ligne (jamais de
// modification) ; la case « possible événement indésirable » préfigure le registre EI.
type Props = {
  person: DemoPerson;
  evidence: DemoEvidence | null;
  onSurvey: () => void;
  onNote: (text: string, possibleAdverseEvent: boolean) => void;
};

export function DemoDossier({ person, evidence, onSurvey, onNote }: Props) {
  const [noting, setNoting] = useState(false);
  const [text, setText] = useState("");
  const [adverse, setAdverse] = useState(false);
  const docs = [
    { name: "Feuille de réception", done: Boolean(person.receptionSignedOn), status: person.receptionSignedOn ? `Signée · ${person.receptionSignedOn}` : "À faire" },
    { name: "Projet personnalisé (PAP)", done: person.pap.length > 0, status: person.pap.length > 0 ? "Version en cours" : "À construire" },
    { name: "Enquête de satisfaction", done: person.surveyDone, status: person.surveyDone ? "Faite" : "À faire" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-line bg-card p-6">
        <span className={cn("flex h-[88px] w-[88px] flex-shrink-0 flex-col items-center justify-center rounded-2xl leading-tight", girTone(person.gir))}>
          <span className="text-[15px] font-bold">GIR</span>
          <span className="text-[38px] font-bold">{person.gir}</span>
        </span>
        <div className="flex min-w-[16rem] flex-1 flex-col gap-1">
          <h1 className="text-[32px] font-bold leading-tight">{person.name}</h1>
          <span>{person.address}</span>
          <span className="text-[17px] text-ink2">{person.hours} · accompagnée depuis {person.since}</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" className={TABLET_PRIMARY} onClick={onSurvey}>Faire l&apos;enquête</button>
          <button type="button" className={TABLET_SECONDARY} onClick={() => setNoting(!noting)} aria-expanded={noting}>Noter un événement</button>
        </div>
      </div>

      {evidence && (
        <section aria-labelledby="preuve-titre" className="rounded-2xl border-2 border-ok-text bg-ok-soft p-5">
          <h2 id="preuve-titre" className="text-[22px] font-bold">Dossier de preuve (démonstration)</h2>
          <ul className="mt-2 grid gap-1 text-[18px] sm:grid-cols-2">
            <li>Signé par : {evidence.signer}</li>
            <li>Le : {evidence.signedAt}</li>
            <li>Points dits et cochés : {evidence.ticked} sur {evidence.total}</li>
            <li>Témoin : l&apos;intervenant connecté, sur cet appareil</li>
            <li>Signature : image finale seule, aucun tracé gardé</li>
            <li>Copie par e-mail : {evidence.copyByEmail ? "demandée" : "non"}</li>
          </ul>
          <p className="mt-2 text-[17px]">En service réel, l&apos;empreinte du document signé et l&apos;heure exacte sont gardées. Ici, rien n&apos;est enregistré.</p>
        </section>
      )}

      {noting && (
        <form
          className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!text.trim()) return;
            onNote(text.trim(), adverse);
            setText("");
            setAdverse(false);
            setNoting(false);
          }}
        >
          <label className="flex flex-col gap-2 text-[19px] font-bold">
            Ce qui s&apos;est passé
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} className="rounded-2xl border-2 border-muted bg-card p-4 text-[20px] font-normal text-ink" />
          </label>
          <label className="flex min-h-14 w-fit cursor-pointer items-center gap-3 text-[18px]">
            <input type="checkbox" checked={adverse} onChange={(e) => setAdverse(e.target.checked)} className="h-6 w-6 accent-accent-fill" />
            C&apos;est peut-être un événement indésirable
          </label>
          <button type="submit" className={cn(TABLET_PRIMARY, "w-fit")}>Ajouter au journal</button>
        </form>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <aside aria-labelledby="docs-titre" className="overflow-hidden rounded-2xl border border-line bg-card">
          <h2 id="docs-titre" className="bg-soft px-5 py-3.5 font-bold">Ses documents</h2>
          <ul>
            {docs.map((doc) => (
              <li key={doc.name} className="flex min-h-[72px] flex-col justify-center gap-0.5 border-t border-line px-5 py-3 text-[18px]">
                <span className="font-bold">{doc.name}</span>
                <span className={cn("flex items-center gap-1.5 text-[16px]", doc.done ? "text-ok-text" : "text-accent-text")}>
                  {doc.done ? <Check className="h-4 w-4" aria-hidden="true" /> : <Circle className="h-4 w-4" aria-hidden="true" />}
                  {doc.status}
                </span>
              </li>
            ))}
          </ul>
        </aside>
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-6">
            <h2 className="text-[24px] font-bold">Ce qu&apos;on fait chez elle</h2>
            {person.pap.length === 0 ? (
              <p className="text-ink2">Le projet personnalisé se construit avec la personne dans les semaines qui suivent l&apos;arrivée.</p>
            ) : (
              <ul className="list-disc pl-6">{person.pap.map((task) => <li key={task} className="py-1">{task}</li>)}</ul>
            )}
          </section>
          <div className="grid gap-5 md:grid-cols-2">
            <section className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-6">
              <h2 className="text-[22px] font-bold">Contacts</h2>
              {person.contacts.length === 0 && <p className="text-ink2">Aucun contact noté.</p>}
              {person.contacts.map((c) => (
                <p key={c.who} className="flex flex-col border-t border-line py-2"><span className="font-bold">{c.who}</span><span className="text-[17px] text-ink2">{c.how}</span></p>
              ))}
            </section>
            <section className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-6">
              <h2 className="text-[22px] font-bold">Journal</h2>
              {person.journal.length === 0 && <p className="text-ink2">Aucun événement noté.</p>}
              {person.journal.map((entry, i) => (
                <p key={i} className="flex gap-3 border-t border-line py-2 text-[17px]">
                  <span className="w-14 flex-shrink-0 tabular-nums text-ink2">{entry.date}</span>
                  <span>{entry.text}{entry.possibleAdverseEvent && <strong className="ml-1">· à examiner (événement indésirable ?)</strong>}</span>
                </p>
              ))}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
