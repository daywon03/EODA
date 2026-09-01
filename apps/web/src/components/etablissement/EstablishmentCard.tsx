import Link from "next/link";
import { Building2, Calendar, FileText, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EstablishmentType } from "@eoda/database";
import { StageBadge } from "@/components/crm/StageBadge";
import type { FunnelStage } from "@/lib/services/lifecycle-service";
import { formatDate } from "@/lib/services/date-format-service";
import { ESTABLISHMENT_TYPE_LABELS } from "@/lib/services/structure-identity-service";
import { DeleteEstablishmentButton } from "./DeleteEstablishmentButton";

type Props = {
  id: string;
  name: string;
  finessNumber: string | null;
  type: EstablishmentType;
  hasEvaluationTargetDate: Date | null;
  documentCount: number;
  stage: FunnelStage | null;
  beta: boolean;
  // Logo déposé par le cabinet. Data URI : il voyage avec la page, sans route de
  // service ni URL signée à renouveler.
  logoDataUri: string | null;
};

export function EstablishmentCard({
  id,
  name,
  finessNumber,
  type,
  hasEvaluationTargetDate,
  documentCount,
  stage,
  beta,
  logoDataUri,
}: Props) {
  return (
    // La carte n'est plus un <a> : elle contient désormais un bouton de suppression, et
    // un bouton dans un lien est invalide autant qu'inutilisable — le clic partirait
    // sur la fiche. Le lien couvre la carte en superposition (`absolute inset-0`), la
    // carte reste donc entièrement cliquable, et ce qui doit rester actionnable se
    // place au-dessus (`relative z-10`).
    <Card className="relative border-l-4 border-l-terre transition-all duration-150 hover:-translate-y-0.5 hover:shadow-eoda-md focus-within:ring-2 focus-within:ring-terre focus-within:ring-offset-2 h-full">
      <Link
        href={`/dashboard/cabinet/etablissements/${id}`}
        className="absolute inset-0 z-0 rounded-xl focus:outline-none"
      >
        {/* Nom accessible du lien : la carte entière est cliquable, mais le lien
            lui-même n'a pas de texte propre. */}
        <span className="sr-only">Ouvrir la fiche de {name}</span>
      </Link>

      <div className="pointer-events-none flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* Le logo de la structure quand elle en a un — « ce serait très beau »,
                et surtout ça rend la liste reconnaissable d'un coup d'œil. Sans logo,
                l'icône générique : jamais un emplacement vide. `object-contain` sur
                fond blanc parce qu'un logo n'est presque jamais carré. */}
            {logoDataUri ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URI : next/image ne sait pas l'optimiser et exigerait une taille connue.
              <img
                src={logoDataUri}
                alt=""
                className="h-9 w-9 flex-shrink-0 rounded-lg border border-gris-light bg-white object-contain p-0.5"
              />
            ) : (
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-terre/10">
                <Building2 className="h-4 w-4 text-terre" aria-hidden="true" />
              </span>
            )}
            <h3 className="truncate text-base font-semibold leading-tight text-brun-ancre">
              {name}
            </h3>
          </div>
          <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-gris-mid" aria-hidden="true" />
        </div>

        {finessNumber && <p className="pl-[46px] text-xs text-gris-mid">FINESS {finessNumber}</p>}

        <div className="flex flex-wrap items-center gap-2 pl-[46px]">
          <StageBadge stage={stage} beta={beta} />
          <Badge variant="secondary">{ESTABLISHMENT_TYPE_LABELS[type]}</Badge>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-gris-light pt-2 pl-[46px]">
          <div className="flex items-center gap-4 text-xs text-gris-mid">
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              {documentCount} document{documentCount !== 1 ? "s" : ""}
            </span>
            {hasEvaluationTargetDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDate(new Date(hasEvaluationTargetDate))}
              </span>
            )}
          </div>

          {/* « Il aurait été bien que je puisse le supprimer de là » : il fallait
              jusqu'ici ouvrir la fiche pour s'en défaire. `pointer-events-auto` parce
              que le conteneur les coupe, sinon le lien en dessous capterait le clic. */}
          <div className="pointer-events-auto relative z-10">
            <DeleteEstablishmentButton
              establishmentId={id}
              establishmentName={name}
              compact
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
