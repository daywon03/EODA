"use client";

import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { RECEPTION_DOCUMENTS, RECEPTION_POINTS_PROVISIONAL } from "@/content/enquete/reception";
import { TABLET_CHOICE_OFF, TABLET_CHOICE_ON, TABLET_INPUT, TABLET_PRIMARY, TABLET_SECONDARY } from "../tablet-ui";
import { SignaturePad } from "./SignaturePad";
import type { DemoPerson } from "./demo-data";

// Feuille de réception (maquette T6, décision 6) : identité réduite, les trois
// documents présentés un par un avec leurs points « à dire » OBLIGATOIRES, UNE
// signature, copie par e-mail en case à cocher. En démonstration, rien ne part.
type Signer = "PERSONNE" | "PROCHE" | "TUTEUR";
const SIGNERS: { value: Signer; label: string }[] = [
  { value: "PERSONNE", label: "La personne" },
  { value: "PROCHE", label: "Un proche" },
  { value: "TUTEUR", label: "Le tuteur ou curateur" },
];
const STEPS = ["Identité", ...RECEPTION_DOCUMENTS.map((d) => d.label), "Signature"];

export type DemoEvidence = { signer: string; signedAt: string; ticked: number; total: number; copyByEmail: boolean };
type Props = { onCreated: (person: DemoPerson, evidence: DemoEvidence) => void; onCancel: () => void };

export function DemoReception({ onCreated, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [first, setFirst] = useState("Germaine");
  const [last, setLast] = useState("Rousseau (fictif)");
  const [signer, setSigner] = useState<Signer>("PERSONNE");
  const [representative, setRepresentative] = useState("");
  const [ticks, setTicks] = useState<Record<string, string>>({});
  const [signature, setSignature] = useState<string | null>(null);
  const [copy, setCopy] = useState(true);
  const [hint, setHint] = useState<string | null>(null);

  const doc = step >= 1 && step <= RECEPTION_DOCUMENTS.length ? RECEPTION_DOCUMENTS[step - 1]! : null;
  const docTicked = doc ? doc.points.filter((p) => ticks[`${doc.kind}:${p.id}`]).length : 0;
  const allPoints = RECEPTION_DOCUMENTS.reduce((n, d) => n + d.points.length, 0);
  const identityMissing = !first.trim() || !last.trim() || (signer !== "PERSONNE" && !representative.trim());
  const blocked = (step === 0 && identityMissing) || (doc !== null && docTicked < doc.points.length) || (step === STEPS.length - 1 && !signature);

  function toggle(key: string) {
    setTicks((current) => {
      const nextTicks = { ...current };
      if (nextTicks[key]) delete nextTicks[key];
      else nextTicks[key] = new Date().toISOString();
      return nextTicks;
    });
  }

  function next() {
    if (blocked) {
      setHint(step === 0 ? "Remplissez le prénom, le nom et qui signe." : doc ? "Cochez chaque point avec la personne avant de continuer." : "La personne doit signer dans le cadre.");
      return;
    }
    setHint(null);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      window.scrollTo(0, 0);
      return;
    }
    const name = `${first.trim()} ${last.trim()}`;
    const now = new Date();
    onCreated(
      { id: `n${now.getTime()}`, name, gir: 3, address: "Adresse à compléter", hours: "Heures selon le DIPC", since: "aujourd'hui", surveyDone: false, pap: [], contacts: [], journal: [], receptionSignedOn: "aujourd'hui" },
      { signer: signer === "PERSONNE" ? name : representative.trim(), signedAt: now.toLocaleString("fr-FR"), ticked: Object.keys(ticks).length, total: allPoints, copyByEmail: copy }
    );
  }

  return (
    <section aria-labelledby="accueil-titre" className="flex flex-col gap-6">
      <ol className="flex flex-wrap gap-2" aria-label="Étapes">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined} className={cn("flex h-12 items-center gap-2 rounded-full border-2 px-4 text-[17px]", i === step ? "border-ink bg-ink-fill font-bold text-on-ink" : i < step ? "border-line bg-soft" : "border-line bg-card")}>
            {i < step ? <Check className="h-4 w-4" aria-label="fait" /> : <span className="tabular-nums">{i + 1}</span>}
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="flex max-w-[760px] flex-col gap-5">
          <h1 id="accueil-titre" className="text-[34px] font-bold">Qui accueillons-nous ?</h1>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[19px] font-bold">Prénom<input value={first} onChange={(e) => setFirst(e.target.value)} className={TABLET_INPUT} autoComplete="off" /></label>
            <label className="flex flex-col gap-1.5 text-[19px] font-bold">Nom<input value={last} onChange={(e) => setLast(e.target.value)} className={TABLET_INPUT} autoComplete="off" /></label>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[19px] font-bold">Qui signe ?</legend>
            <div className="flex flex-wrap gap-3">
              {SIGNERS.map((option) => (
                <button key={option.value} type="button" aria-pressed={signer === option.value} onClick={() => setSigner(option.value)} className={cn("min-h-[60px] rounded-xl border-2 px-5 text-[19px] font-bold", signer === option.value ? TABLET_CHOICE_ON : TABLET_CHOICE_OFF)}>
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
          {signer !== "PERSONNE" && (
            <label className="flex max-w-[520px] flex-col gap-1.5 text-[19px] font-bold">
              Nom et lien avec la personne
              <input value={representative} onChange={(e) => setRepresentative(e.target.value)} className={TABLET_INPUT} placeholder="Ex. : sa fille (fictif)" autoComplete="off" />
            </label>
          )}
        </div>
      )}

      {doc && (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-6">
            <h1 id="accueil-titre" className="text-[30px] font-bold">{doc.label}</h1>
            <p className="text-[19px]">Présentez le document validé de la structure, au nom de {first} {last}. Faites-le défiler avec la personne.</p>
          </div>
          <div className="flex flex-col gap-2.5 rounded-2xl border-2 border-accent-fill bg-card p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[24px] font-bold">À dire à la personne</h2>
              <span className="tabular-nums text-ink2">{docTicked} sur {doc.points.length}</span>
            </div>
            {doc.points.map((point) => {
              const key = `${doc.kind}:${point.id}`;
              const on = Boolean(ticks[key]);
              return (
                <button key={key} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(key)} className={cn("flex min-h-[68px] items-center gap-3.5 rounded-xl border-2 px-3.5 text-left text-[19px]", on ? "border-ok-text bg-ok-soft" : "border-line bg-card")}>
                  <span className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border-2", on ? "border-ok-text bg-green-fill" : "border-muted bg-card")}>
                    {on && <Check className="h-5 w-5" aria-hidden="true" />}
                  </span>
                  {point.label}
                </button>
              );
            })}
            {RECEPTION_POINTS_PROVISIONAL && <p className="text-[16px] text-ink2">Points provisoires, en attente de validation par EODA.</p>}
          </div>
        </div>
      )}

      {step === STEPS.length - 1 && (
        <div className="flex max-w-[860px] flex-col gap-4">
          <h1 id="accueil-titre" className="text-[34px] font-bold">Signature</h1>
          <div className="rounded-xl border border-line bg-card px-5 py-4">
            <p className="font-bold">{signer === "PERSONNE" ? `${first} ${last}` : representative} confirme avoir reçu et compris les 3 documents.</p>
            <p className="text-[17px] text-ink2">Livret d&apos;accueil · règlement de fonctionnement · DIPC</p>
          </div>
          <SignaturePad onChange={setSignature} />
          <label className="flex min-h-14 w-fit cursor-pointer items-center gap-3 rounded-xl border-2 border-line bg-card px-4 text-[18px]">
            <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} className="h-6 w-6 accent-accent-fill" />
            Envoyer une copie par e-mail
          </label>
        </div>
      )}

      {hint && <p role="alert" className="text-[19px] font-bold text-danger-text">{hint}</p>}
      <div className="flex flex-wrap gap-3 pt-1">
        <button type="button" className={TABLET_SECONDARY} onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Retour
        </button>
        <button type="button" aria-disabled={blocked} className={cn(TABLET_PRIMARY, "flex-1", blocked && "bg-muted/40 text-ink hover:bg-muted/40")} onClick={next}>
          {step === 0 ? "Présenter le livret d'accueil" : step < STEPS.length - 2 ? `Document suivant : ${STEPS[step + 1]!.toLowerCase()}` : step === STEPS.length - 2 ? "Passer à la signature" : "Signer et créer le dossier"}
        </button>
      </div>
    </section>
  );
}
