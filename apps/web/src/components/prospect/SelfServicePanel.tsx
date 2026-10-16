import Link from "next/link";
import type { PipelineFacts } from "@/lib/db/read-prospect-pipeline";
import { modeLabelFor } from "@/lib/services/prospect-pipeline-service";
import { momentLabelFor } from "@/lib/services/prospect-diagnostic-service";
import { formatDate } from "@/lib/services/date-format-service";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SignalDot } from "@/components/commercial/SignalDot";
import { RemindProspectButton } from "./RemindProspectButton";

function longDay(date: Date): string {
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

// Fiche « en autonomie » (maquette v2, vue isAuto) : ce que le cabinet voit d'une
// structure inscrite SEULE — sa demande « Être accompagné », son compte, l'avancement
// de son diagnostic déclaratif et sa dernière activité. Jamais le contenu des réponses.
export function SelfServicePanel({ facts }: { facts: PipelineFacts }) {
  const newDevisHref = `/dashboard/cabinet/commercial/devis/nouveau?prospectId=${facts.id}`;
  return (
    <section aria-labelledby="autonomie" className="flex flex-col gap-4">
      <h2 id="autonomie" className="sr-only">
        Structure inscrite seule
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <span className="whitespace-nowrap rounded-md border border-ink2 bg-soft px-2.5 py-0.5 text-sm font-bold text-ink">
          {modeLabelFor(facts.origin, facts.envisagedFormule)}
        </span>
      </div>

      <div role="note" className="flex items-start gap-3.5 rounded-[10px] border border-line bg-soft px-4 py-4">
        <span aria-hidden="true" className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-ink-fill font-bold text-on-ink">
          i
        </span>
        <div>
          <p className="font-bold text-ink">Cette structure travaille seule.</p>
          <p className="text-ink2">
            Ses réponses restent privées. Vous voyez son compte, l&apos;avancement de son diagnostic et sa dernière
            activité. Tout s&apos;ouvre après la signature d&apos;un accompagnement.
          </p>
        </div>
      </div>

      {facts.pendingCall && (
        <div className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-accent-fill bg-card p-5">
          <div>
            <p className="text-lg font-bold text-ink">Demande « Être accompagné »</p>
            <p className="text-ink2">
              Appel souhaité le {longDay(facts.pendingCall.startsAt)}, {momentLabelFor(facts.pendingCall.startsAt)}
              {facts.pendingCall.notes ? ` · « ${facts.pendingCall.notes} »` : ""}
            </p>
            <p className="text-base text-ink2">Confirmez ou déplacez le rendez-vous dans « Rendez-vous », plus bas.</p>
          </div>
          <Button asChild>
            <Link href={newDevisHref}>Préparer le devis</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-card p-5">
          <h3 className="text-lg font-bold text-ink">Compte</h3>
          <p className="text-ink">
            {facts.accountCount} utilisateur{facts.accountCount > 1 ? "s" : ""}
          </p>
          {facts.accountsCreatedAt && <p className="text-base text-ink2">Créé le {formatDate(facts.accountsCreatedAt)}</p>}
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-card p-5">
          <h3 className="text-lg font-bold text-ink">Abonnement envisagé</h3>
          <p className="text-ink">{modeLabelFor(facts.origin, facts.envisagedFormule)}</p>
          <p className="text-base text-ink2">Rien n&apos;est signé : le devis fait foi.</p>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-card p-5">
          <h3 className="text-lg font-bold text-ink">Dernière activité</h3>
          {facts.signal ? <SignalDot tone={facts.signal.tone} text={facts.signal.text} /> : <p className="text-ink2">—</p>}
          <p className="text-base text-ink2">Sans détail du contenu</p>
          {facts.signal?.inactive && <RemindProspectButton prospectId={facts.id} structureName={facts.structureName} />}
        </div>
      </div>

      {facts.progress && (
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-card p-5">
          <h3 className="text-lg font-bold text-ink">Avancement du diagnostic</h3>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(160px,240px)_minmax(0,1fr)_80px]">
            <span>Questions sur les pratiques</span>
            <span className="col-span-2 sm:col-span-1 sm:row-start-1 sm:col-start-2">
              <ProgressBar
                value={facts.progress.percent}
                label="Questions sur les pratiques"
                valueText={facts.progress.label}
                colorClassName="bg-accent-fill"
              />
            </span>
            <span className="row-start-1 col-start-2 text-right font-bold tabular-nums sm:col-start-3">
              {facts.progress.answered} / {facts.progress.total}
            </span>
          </div>
          {facts.workCount !== null && (
            <p className="text-ink">
              Liste de travail estimée : <strong>{facts.workCount} document{facts.workCount > 1 ? "s" : ""}</strong> à créer.
            </p>
          )}
          <p className="text-base text-ink2">
            Diagnostic déclaratif : la structure répond seule, rien n&apos;est relu par EODA avant la signature.
          </p>
        </div>
      )}
    </section>
  );
}
