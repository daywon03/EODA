import Link from "next/link";
import { getProspectSpace } from "@/lib/actions/prospect-space";
import { CALL_MAX_DAYS_AHEAD, momentLabelFor } from "@/lib/services/prospect-diagnostic-service";
import { SELF_SERVICE_OFFERS } from "@/lib/services/self-service-service";
import { toDateInputValue } from "@/lib/services/date-format-service";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Callout } from "@/components/ui/callout";
import { AccompanimentForm } from "@/components/prospect-space/AccompanimentForm";

export const metadata = { title: "Mon espace" };

function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateInputValue(d);
}

function longDay(date: Date): string {
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

// Espace d'une structure inscrite SEULE (D5) : son diagnostic préliminaire déclaratif
// (questions sur les pratiques), sa liste de travail estimée, et « Être accompagné ».
// Aucun dépôt de document : les documents sont rattachés à une fiche structure, qui
// naît à la signature — l'écran le dit.
export default async function ProspectSpacePage() {
  const space = await getProspectSpace();
  const { progress } = space;
  const nextQuestion = space.questions.findIndex((q) => q.current === null || q.outdated);
  const questionsHref = `/espace/diagnostic?q=${nextQuestion === -1 ? 1 : nextQuestion + 1}`;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[34px] font-bold leading-tight">Bonjour{space.firstName ? ` ${space.firstName}` : ""}</h1>
        <p className="text-ink2">
          {space.formule ? `Offre envisagée : ${SELF_SERVICE_OFFERS[space.formule].name} · ${SELF_SERVICE_OFFERS[space.formule].who.toLowerCase()}. ` : ""}
          Rien n&apos;est signé : vous découvrez la plateforme avec votre diagnostic.
        </p>
      </div>

      {space.signed && (
        <Callout tone="success" title="Votre accompagnement est signé">
          EODA ouvre l&apos;espace de votre structure. Vous recevrez vos accès par e-mail.
        </Callout>
      )}

      <section aria-labelledby="diagnostic" className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="diagnostic" className="text-2xl font-bold">
              Mon diagnostic
            </h2>
            <p className="text-ink2">
              Un document ne suffit pas. Racontez comment vous faites au quotidien : une question par critère impératif.
            </p>
          </div>
          <span className="text-xl font-bold tabular-nums">
            {progress.answered} / {progress.total}
          </span>
        </div>
        <ProgressBar value={progress.percent} label="Questions sur les pratiques" valueText={progress.label} colorClassName="bg-accent-fill" />
        {space.hasProfile && space.questions.length > 0 ? (
          <Link
            href={questionsHref}
            className="inline-flex min-h-14 w-fit items-center rounded-[10px] bg-ink-fill px-6 text-lg font-bold text-on-ink hover:bg-ink-fill/90"
          >
            {progress.stage === "NOT_STARTED" ? "Commencer les questions" : progress.stage === "DONE" ? "Revoir mes réponses" : "Reprendre les questions"}
          </Link>
        ) : (
          <p className="text-ink2">Les questions ne sont pas encore disponibles pour votre structure. EODA vous recontacte.</p>
        )}
        {space.provisional && <p className="text-base text-ink2">Questions provisoires, en cours de relecture par EODA.</p>}
      </section>

      <section aria-labelledby="travail" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="travail" className="text-2xl font-bold">
            Votre liste de travail
          </h2>
          <p className="text-ink2">
            Vous avez des pratiques, mais pas toujours de trace écrite. Voici les documents à créer pour le jour de
            l&apos;évaluation — une estimation, à partir de vos réponses.
          </p>
        </div>
        {space.workList.length === 0 ? (
          <p className="rounded-xl border border-dashed border-muted bg-card p-5 text-ink2">
            {progress.stage === "NOT_STARTED"
              ? "Répondez aux questions : la liste apparaît au fil de vos réponses."
              : "Aucun document à créer d'après vos réponses pour le moment."}
          </p>
        ) : (
          <ul className="flex flex-col rounded-xl border border-line bg-card">
            {space.workList.map((item) => (
              <li key={item.documentTypeId} className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5 last:border-b-0">
                <span className="font-bold">{item.label}</span>
                <span className="text-base text-ink2">Critère{item.criterionCodes.length > 1 ? "s" : ""} {item.criterionCodes.join(", ")}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-base text-ink2">Vous déposerez vos documents une fois l&apos;abonnement signé.</p>
      </section>

      <section aria-labelledby="accompagne" className="flex flex-col gap-4 rounded-2xl border-2 border-ink bg-card p-6">
        <h2 id="accompagne" className="text-2xl font-bold">
          Être accompagné par EODA
        </h2>
        {space.pendingCall ? (
          <p>
            Votre demande est enregistrée : appel le <strong>{longDay(space.pendingCall.startsAt)}</strong>,{" "}
            {momentLabelFor(space.pendingCall.startsAt)}
            {space.pendingCall.status === "CONFIRME" ? " — confirmé par EODA." : " — EODA vous confirme le rendez-vous par e-mail."}
          </p>
        ) : (
          <>
            <p className="text-ink2">
              EODA peut rédiger ces documents avec vous. Choisissez un moment pour un appel de 20 minutes : EODA regarde
              votre diagnostic avec vous et vous propose un accompagnement. Vous gardez tout ce que vous avez déjà fait.
            </p>
            <AccompanimentForm minDay={dayOffset(1)} maxDay={dayOffset(CALL_MAX_DAYS_AHEAD)} />
          </>
        )}
      </section>

      <p className="text-base text-ink2">
        Auto-évaluation préparatoire, sur les critères impératifs de votre service. Ce n&apos;est pas une évaluation officielle
        de la HAS.
      </p>
    </>
  );
}
