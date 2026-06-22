import { getEstablishment } from "@/lib/actions/establishment";
import { InviteClientForm } from "@/components/etablissement/InviteClientForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Building2, Calendar, Users } from "lucide-react";
import type { EstablishmentType } from "@eoda/database";

const TYPE_LABELS: Record<EstablishmentType, string> = {
  SAD_AIDE: "SAD Aide",
  SAD_MIXTE: "SAD Mixte",
};

const ROLE_LABELS: Record<string, string> = {
  DIRECTEUR: "Directeur / Directrice",
  COORDINATEUR: "Coordinateur / Coordinatrice",
  ASSISTANT_QUALITE: "Assistant(e) qualité",
  AUTRE: "Autre",
};

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const establishment = await getEstablishment(id);
  return { title: `${establishment.name} · EODA Conseil` };
}

export default async function EstablishmentDetailPage({ params }: Props) {
  const { id } = await params;
  const establishment = await getEstablishment(id);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/cabinet">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
        </Button>
        <div className="border-l-4 border-terre pl-4 py-0.5">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-terre" />
            <h1 className="text-xl font-bold text-brun-ancre">{establishment.name}</h1>
            <Badge variant="secondary">{TYPE_LABELS[establishment.type]}</Badge>
          </div>
          {establishment.finessNumber && (
            <p className="text-xs text-gris-mid mt-0.5">FINESS {establishment.finessNumber}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Infos établissement */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {establishment.address && (
              <p className="text-gris-mid">{establishment.address}</p>
            )}
            {establishment.hasEvaluationTargetDate && (
              <div className="flex items-center gap-2 text-brun-ancre">
                <Calendar className="w-4 h-4 text-terre flex-shrink-0" />
                <span>
                  Évaluation HAS cible :{" "}
                  <strong>
                    {new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
                      new Date(establishment.hasEvaluationTargetDate)
                    )}
                  </strong>
                </span>
              </div>
            )}
            <Badge variant="not_applicable">
              {establishment.commercialTier === "BETA" ? "Bêta-test gratuit" : establishment.commercialTier}
            </Badge>
          </CardContent>
        </Card>

        {/* Interlocuteurs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-terre" />
              Interlocuteurs client
            </CardTitle>
            <CardDescription>
              {establishment.establishmentUsers.length === 0
                ? "Aucun interlocuteur côté client pour l'instant."
                : `${establishment.establishmentUsers.length} interlocuteur(s) rattaché(s)`}
            </CardDescription>
          </CardHeader>
          {establishment.establishmentUsers.length > 0 && (
            <CardContent>
              <ul className="space-y-2">
                {establishment.establishmentUsers.map(({ user, roleInEstablishment }) => (
                  <li key={user.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-brun-ancre">{user.name}</p>
                      <p className="text-gris-mid text-xs">{user.email}</p>
                    </div>
                    <Badge variant="outline">{ROLE_LABELS[roleInEstablishment] ?? roleInEstablishment}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Invitation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inviter un interlocuteur client</CardTitle>
          <CardDescription>
            Crée un compte d'accès à l'espace client. Le mot de passe temporaire généré sera
            affiché une seule fois — communiquez-le à l'interlocuteur par email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteClientForm establishmentId={establishment.id} />
        </CardContent>
      </Card>
    </div>
  );
}
