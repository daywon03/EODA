import Link from "next/link";
import type { CalendarAppointment } from "@/lib/services/calendar-service";
import type { AvailableOption } from "@/lib/services/client-contract-service";
import { AppointmentList } from "@/components/agenda/AppointmentList";
import { RequestOptionQuoteForm } from "@/components/client/RequestOptionQuoteForm";
import { EodaMark } from "@/components/layout/EodaLogo";
import {
  CLIENT_CONTRACT_PATH,
  CLIENT_DOCUMENTS_PATH,
  CLIENT_MESSAGES_PATH,
} from "@/lib/design/client-navigation";

const LINK_BUTTON =
  "inline-flex h-12 items-center whitespace-nowrap rounded-[10px] border-2 border-ink bg-card px-[18px] text-[17px] font-bold text-ink hover:bg-soft";

// Accueil EN AUTONOMIE : la liste de travail (ce que la structure a déclaré ne pas
// avoir) et « Être accompagné », qui réutilise la demande d'option existante.
export function AutonomyHomeCard({
  workTitle,
  hasWork,
  supportOption,
}: {
  workTitle: string;
  hasWork: boolean;
  // Ligne de catalogue « accompagnement » si elle existe (SUPPORT_OPTION_CODE).
  supportOption: AvailableOption | null;
}) {
  return (
    <section aria-label="Votre liste de travail" className="flex flex-wrap items-center gap-4 rounded-xl bg-soft px-5 py-[18px]">
      <div className="flex min-w-[260px] flex-1 flex-col">
        <span className="font-bold">{workTitle}</span>
        {/* « pour les rédiger » sous « Votre liste de travail est vide. » ne
            renvoyait à rien (recette du 14/10) : la phrase suit la liste. */}
        <span>
          {hasWork
            ? "EODA peut vous accompagner pour les rédiger."
            : "Rien à créer pour l'instant. EODA peut vous accompagner pour la suite."}
        </span>
      </div>
      {hasWork && (
        <Link href={`${CLIENT_DOCUMENTS_PATH}#travail`} className={LINK_BUTTON}>
          Voir ma liste de travail
        </Link>
      )}
      {supportOption ? (
        <RequestOptionQuoteForm
          catalogueOptionId={supportOption.id}
          optionLabel="Être accompagné"
          triggerLabel="Être accompagné"
          alreadyRequested={supportOption.requestState === "PENDING"}
        />
      ) : (
        <Link href={CLIENT_CONTRACT_PATH} className={`${LINK_BUTTON} border font-normal`}>
          Être accompagné
        </Link>
      )}
    </section>
  );
}

// Accueil ACCOMPAGNÉ : l'équipe EODA (jamais un prénom, D7), le prochain
// rendez-vous, et « Écrire à EODA ».
export function AccompaniedHomeCard({ appointments }: { appointments: CalendarAppointment[] }) {
  return (
    <section
      aria-labelledby="accompagnement"
      className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6"
    >
      <div className="flex flex-wrap items-center gap-5">
        <EodaMark size={72} className="flex-shrink-0" />
        <div className="flex min-w-[240px] flex-1 flex-col gap-1">
          <span className="text-base text-ink2">Votre accompagnement</span>
          <h2 id="accompagnement" className="text-[22px] font-bold">
            L&apos;équipe EODA
          </h2>
        </div>
        <Link
          href={CLIENT_MESSAGES_PATH}
          className="inline-flex h-[52px] items-center rounded-[10px] bg-ink-fill px-5 text-[17px] font-bold text-on-ink hover:bg-ink-fill/90"
        >
          Écrire à EODA
        </Link>
      </div>
      <div>
        <h3 className="mb-2 font-bold">Vos prochains rendez-vous</h3>
        <AppointmentList
          appointments={appointments}
          readOnly
          emptyMessage="Aucun rendez-vous pour l'instant. EODA vous proposera une date."
        />
      </div>
    </section>
  );
}
