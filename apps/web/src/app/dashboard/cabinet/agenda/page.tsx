import { listAgendaMonth, listUpcomingAgenda } from "@/lib/actions/appointment";
import { PageHeader } from "@/components/layout/PageHeader";
import { MonthGrid } from "@/components/agenda/MonthGrid";
import { AppointmentList } from "@/components/agenda/AppointmentList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

export const metadata = { title: "Agenda · EODA Conseil" };

const AGENDA_PATH = "/dashboard/cabinet/agenda";

type Props = { searchParams: Promise<{ mois?: string }> };

// `?mois=AAAA-MM`. Une valeur absente ou farfelue retombe sur le mois courant plutôt
// que de produire une grille vide : le paramètre vient de l'URL, donc de n'importe où.
function parseMonth(raw: string | undefined, now: Date): { year: number; month: number } {
  const match = raw ? /^(\d{4})-(\d{2})$/.exec(raw) : null;
  if (!match) return { year: now.getFullYear(), month: now.getMonth() };

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (year < 2020 || year > 2100 || month < 0 || month > 11) {
    return { year: now.getFullYear(), month: now.getMonth() };
  }
  return { year, month };
}

export default async function AgendaPage({ searchParams }: Props) {
  const { mois } = await searchParams;
  const now = new Date();
  const { year, month } = parseMonth(mois, now);

  const [appointments, upcoming] = await Promise.all([
    listAgendaMonth(year, month),
    listUpcomingAgenda(8),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        icon={CalendarDays}
        subtitle="Tous vos rendez-vous, prospects et clients confondus — le planning reste prévisionnel jusqu'à confirmation."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <MonthGrid
          year={year}
          month={month}
          appointments={appointments}
          now={now}
          basePath={AGENDA_PATH}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prochains rendez-vous</CardTitle>
          </CardHeader>
          <CardContent>
            {/* La colonne de droite répond à « qu'est-ce que j'ai cette semaine ? »,
                indépendamment du mois affiché à gauche : naviguer dans le calendrier
                ne doit pas faire perdre de vue ce qui arrive. */}
            <AppointmentList
              appointments={upcoming}
              emptyMessage="Aucun rendez-vous à venir. Programmez-en un depuis la fiche d'un prospect ou d'un client."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
