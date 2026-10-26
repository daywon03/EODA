"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/progress-bar";
import { TABLET_INPUT, TABLET_SECONDARY } from "../tablet-ui";
import { DEMO_DIPC, DEMO_PEOPLE, DEMO_STAFF, DEMO_STRUCTURE, DEMO_SURVEYS_ALREADY_DONE, DEMO_TOTAL_PEOPLE, SURVEYS_PER_PERSON, girTone, surveyCount, type DemoPerson } from "./demo-data";
import { DemoSurvey } from "./DemoSurvey";
import { DemoReception, type DemoEvidence } from "./DemoReception";
import { DemoDossier } from "./DemoDossier";
import { fullName, type AdmissionRecord } from "@/lib/services/admission-service";
import { AdmissionWizard } from "../admission/AdmissionWizard";
import { downloadBlob, sha256Hex } from "../admission/use-admissions";

// ─────────────────────────────────────────────────────────────────────────────
// MODE DÉMONSTRATION DE LA TABLETTE (lot C) — tourne ENTIÈREMENT en mémoire du
// navigateur, sur des données fictives. N'appelle aucune action serveur, aucun port :
// rien n'est enregistré, et le bandeau le dit sur chaque écran. C'est ce qui rend le
// parcours démontrable tant que le verrou HDS est fermé.
// ─────────────────────────────────────────────────────────────────────────────

type Screen =
  | { kind: "home" }
  | { kind: "survey"; personId: string }
  | { kind: "reception" }
  | { kind: "admission"; personId: string }
  | { kind: "admission-done"; record: AdmissionRecord }
  | { kind: "dossier"; personId: string };

export function TabletDemo() {
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [people, setPeople] = useState<DemoPerson[]>([...DEMO_PEOPLE]);
  const [query, setQuery] = useState("");
  const [evidence, setEvidence] = useState<Record<string, DemoEvidence>>({});
  const [toast, setToast] = useState<string | null>(null);
  // Contrats signés de la démonstration : en mémoire seulement, jamais rangés.
  const [contracts, setContracts] = useState<Record<string, Blob>>({});
  const [demoDipcSha, setDemoDipcSha] = useState("");

  useEffect(() => {
    void sha256Hex(new TextEncoder().encode(DEMO_DIPC.text)).then(setDemoDipcSha);
  }, []);

  const go = (next: Screen) => {
    setScreen(next);
    window.scrollTo(0, 0);
  };
  // Compté en QUESTIONNAIRES : deux par personne (la personne, puis un proche).
  const totalSurveys = DEMO_TOTAL_PEOPLE * SURVEYS_PER_PERSON;
  const done = people.reduce((n, p) => n + surveyCount(p), 0) + DEMO_SURVEYS_ALREADY_DONE;
  const firstToSurvey = people.find((p) => surveyCount(p) < SURVEYS_PER_PERSON) ?? people[0]!;
  const visible = people.filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()));
  const update = (id: string, change: (p: DemoPerson) => DemoPerson) => setPeople((list) => list.map((p) => (p.id === id ? change(p) : p)));

  return (
    <div className="flex flex-col gap-7">
      <p role="status" className="rounded-xl border-2 border-accent-fill bg-highlight px-4 py-3 text-[19px] font-bold">
        Démonstration — rien n&apos;est enregistré. Toutes les personnes sont fictives.
      </p>
      {screen.kind !== "home" && (
        <button type="button" className={cn(TABLET_SECONDARY, "w-fit")} onClick={() => go({ kind: "home" })}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Accueil
        </button>
      )}
      {toast && <p role="status" className="rounded-xl bg-ink-fill px-5 py-4 text-[18px] text-on-ink">{toast}</p>}

      {screen.kind === "home" && (
        <>
          <div>
            <h1 className="text-[36px] font-bold">Bonjour {DEMO_STAFF}.</h1>
            <p className="mt-1.5 text-[21px]">{totalSurveys - done} enquêtes restent à faire. Commencez par les personnes que vous voyez aujourd&apos;hui.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <button type="button" onClick={() => go({ kind: "survey", personId: firstToSurvey.id })} className="flex flex-col gap-3 rounded-[18px] border-2 border-accent-fill bg-card p-7 text-left text-[19px] text-ink">
              <span className="w-fit rounded-md bg-amber-fill px-3 py-0.5 text-[16px] font-bold">Priorité · avant l&apos;évaluation</span>
              <span className="text-[30px] font-bold leading-tight">Enquête de satisfaction</span>
              <span>Posez les questions à la personne ou à sa famille. Les réponses sont comptées automatiquement.</span>
              <span className="tabular-nums text-[16px] text-ink2">{done} enquêtes faites sur {totalSurveys} · deux par personne, l&apos;une avec elle, l&apos;autre avec un proche</span>
              <ProgressBar value={done} max={totalSurveys} label="Enquêtes faites" colorClassName="bg-accent-fill" />
              <span className="mt-2 flex h-[60px] items-center justify-center rounded-xl bg-accent-fill text-[20px] font-bold text-on-accent">Commencer une enquête</span>
            </button>
            <button type="button" onClick={() => go({ kind: "reception" })} className="flex flex-col gap-3 rounded-[18px] border border-line bg-card p-7 text-left text-[19px] text-ink">
              <span className="w-fit rounded-md border border-muted px-3 py-0.5 text-[16px] font-bold text-ink2">À l&apos;arrivée d&apos;une personne</span>
              <span className="text-[30px] font-bold leading-tight">Nouvelle personne accompagnée</span>
              <span>Présentez le livret d&apos;accueil, le règlement de fonctionnement et le DIPC. La personne signe une fois sur la tablette.</span>
              <span className="mt-auto flex h-[60px] items-center justify-center rounded-xl border-2 border-ink text-[20px] font-bold">Créer son dossier</span>
            </button>
            <button type="button" onClick={() => go({ kind: "admission", personId: `n${Date.now()}` })} disabled={!demoDipcSha} className="flex flex-col gap-3 rounded-[18px] border border-line bg-card p-7 text-left text-[19px] text-ink md:col-span-2">
              <span className="w-fit rounded-md border border-muted px-3 py-0.5 text-[16px] font-bold text-ink2">Nouveau · contrat signé sur la tablette</span>
              <span className="text-[30px] font-bold leading-tight">Accueil et contrat (DIPC)</span>
              <span>Fiche remplie une fois, DIPC relu ensemble, points du manuel HAS expliqués et cochés, signatures, PDF à envoyer ou exporter.</span>
              <span className="mt-auto flex h-[60px] items-center justify-center rounded-xl border-2 border-ink text-[20px] font-bold">Essayer avec une personne fictive</span>
            </button>
          </div>
          <section aria-labelledby="personnes-titre" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="personnes-titre" className="text-[26px] font-bold">Les personnes accompagnées</h2>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un nom" aria-label="Rechercher une personne" className={cn(TABLET_INPUT, "w-[320px] max-w-full")} />
            </div>
            <ul className="flex flex-col gap-2.5">
              {visible.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => go({ kind: "dossier", personId: p.id })} className="flex min-h-20 w-full flex-wrap items-center gap-4 rounded-2xl border border-line bg-card px-5 py-4 text-left text-[19px] text-ink hover:border-accent-fill">
                    <span className={cn("flex h-16 w-16 flex-shrink-0 flex-col items-center justify-center rounded-xl leading-tight", girTone(p.gir))}>
                      <span className="text-sm font-bold">GIR</span>
                      <span className="text-[26px] font-bold">{p.gir}</span>
                    </span>
                    <span className="flex min-w-[13rem] flex-1 flex-col">
                      <span className="text-[21px] font-bold">{p.name}</span>
                      <span className="text-[17px] text-ink2">{p.address}</span>
                    </span>
                    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3 py-1 text-[16px] font-bold", surveyCount(p) === SURVEYS_PER_PERSON ? "border-ok-text bg-ok-soft" : "border-dashed border-ink2 bg-card")}>
                      {surveyCount(p) === SURVEYS_PER_PERSON ? <Check className="h-4 w-4" aria-hidden="true" /> : <Circle className="h-4 w-4" aria-hidden="true" />}
                      {surveyCount(p) === SURVEYS_PER_PERSON ? "Deux enquêtes faites" : surveyCount(p) === 0 ? "Enquêtes à faire" : "1 enquête sur 2"}
                    </span>
                    <ChevronRight className="h-6 w-6 text-ink2" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {screen.kind === "survey" && (
        <DemoSurvey
          people={people}
          initialPersonId={screen.personId}
          onDone={(id, who) => update(id, (p) => ({ ...p, surveys: { ...p.surveys, [who]: true } }))}
          onHome={() => go({ kind: "home" })}
        />
      )}

      {screen.kind === "reception" && (
        <DemoReception
          onCancel={() => go({ kind: "home" })}
          onCreated={(person, proof) => {
            setPeople((list) => [...list, person]);
            setEvidence((all) => ({ ...all, [person.id]: proof }));
            setToast(proof.copyByEmail ? "Dossier créé (démonstration). En service réel, une copie signée partirait par e-mail." : "Dossier créé (démonstration).");
            go({ kind: "dossier", personId: person.id });
          }}
        />
      )}

      {screen.kind === "admission" && (
        <AdmissionWizard
          structureName={DEMO_STRUCTURE}
          staffName={DEMO_STAFF}
          dipc={{ ...DEMO_DIPC, sha256: demoDipcSha }}
          person={{ personId: screen.personId, lastName: "Rousseau (fictif)", firstName: "Germaine" }}
          onCancel={() => go({ kind: "home" })}
          onSigned={async (record, pdf) => {
            setContracts((all) => ({ ...all, [record.id]: pdf }));
            setPeople((list) => [
              ...list,
              { id: record.personId, name: fullName(record.identity), gir: 3, address: "Adresse fictive", hours: "Heures selon le DIPC", since: "aujourd'hui", surveys: { PERSONNE: false, FAMILLE: false }, pap: [], contacts: [], journal: [], receptionSignedOn: "aujourd'hui" },
            ]);
            go({ kind: "admission-done", record });
          }}
        />
      )}

      {screen.kind === "admission-done" && (
        <section role="status" className="mx-auto flex max-w-[760px] flex-col items-center gap-5 text-center">
          <h1 className="text-[34px] font-bold">Contrat signé (démonstration)</h1>
          <p className="text-[20px]">{fullName(screen.record.identity)} · rien n&apos;est enregistré. En service réel, le contrat reste sur la tablette, s&apos;envoie à la personne et s&apos;exporte vers Ximi.</p>
          <button
            type="button"
            className="inline-flex min-h-16 w-full items-center justify-center rounded-2xl bg-accent-fill px-6 text-[21px] font-bold text-on-accent"
            onClick={() => {
              const pdf = contracts[screen.record.id];
              if (pdf) downloadBlob(screen.record.pdfFileName, pdf);
            }}
          >
            Voir le contrat (PDF)
          </button>
          <button type="button" className="inline-flex min-h-16 w-full items-center justify-center rounded-2xl border border-ink bg-card px-6 text-[19px]" onClick={() => go({ kind: "dossier", personId: screen.record.personId })}>
            Ouvrir son dossier
          </button>
        </section>
      )}

      {screen.kind === "dossier" && (() => {
        const person = people.find((p) => p.id === screen.personId);
        if (!person) return null;
        return (
          <DemoDossier
            person={person}
            evidence={evidence[person.id] ?? null}
            onSurvey={() => go({ kind: "survey", personId: person.id })}
            onNote={(text, possibleAdverseEvent) =>
              update(person.id, (p) => ({ ...p, journal: [{ date: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), text, possibleAdverseEvent }, ...p.journal] }))
            }
          />
        );
      })()}
    </div>
  );
}
