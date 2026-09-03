import { getOwnProfile } from "@/lib/actions/profile";
import { ProfileIdentityForm } from "@/components/profile/ProfileIdentityForm";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/services/date-format-service";
import { Building2, KeyRound, ShieldAlert, UserRound } from "lucide-react";

export const metadata = { title: "Mon profil · EODA Conseil" };

const ROLE_LABELS: Record<string, string> = {
  CABINET_ADMIN: "Cabinet — administration",
  CABINET_EVALUATOR: "Cabinet — évaluation",
  CLIENT_USER: "Structure accompagnée",
};

// ─────────────────────────────────────────────────────────────────────────────
// MON PROFIL — ouvert aux trois rôles.
//
// Il n'existait aucun endroit où changer son mot de passe de son plein gré : la page
// dédiée n'était atteignable que lorsque la rotation était IMPOSÉE, c'est-à-dire à la
// première connexion. Ensuite, un client qui pensait son mot de passe compromis
// n'avait qu'une option — écrire à sa consultante pour qu'elle le réinitialise.
//
// 🔐 Ce qui n'est PAS modifiable ici, et pourquoi : l'adresse e-mail (identifiant de
// connexion), le rôle, l'état du compte, le rattachement à une structure. Un endpoint
// self-service qui les accepterait suffirait à s'octroyer un rôle ou à détourner un
// compte (règle S2). Ils sont affichés en lecture, avec la marche à suivre pour les
// faire changer — un champ grisé sans explication n'apprend rien.
// ─────────────────────────────────────────────────────────────────────────────
export default async function ProfilePage() {
  const profile = await getOwnProfile();

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Mon profil"
        subtitle={profile.email}
        icon={UserRound}
        backHref="/dashboard"
      />

      {profile.mustChangePassword && (
        <div className="flex items-start gap-3 rounded-lg border border-ambre/30 bg-ambre/10 px-5 py-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-ambre" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-brun-ancre">
              Vous utilisez encore votre mot de passe temporaire
            </p>
            <p className="text-gris-mid">
              Choisissez-en un nouveau ci-dessous. Il vous sera demandé à la prochaine
              connexion tant que ce n&apos;est pas fait.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vos informations</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileIdentityForm name={profile.name} email={profile.email} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-terre" aria-hidden="true" />
            Mot de passe
          </CardTitle>
          <CardDescription>
            {/* Dit AVANT, pas après : un changement de mot de passe qui déconnecte sans
                prévenir ressemble à une panne. */}
            Le changer ferme toutes vos sessions ouvertes, y compris celle-ci — vous
            serez invité à vous reconnecter.
            {profile.passwordChangedAt && (
              <> Dernier changement le {formatDate(profile.passwordChangedAt)}.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Votre accès</CardTitle>
          <CardDescription>
            Ces éléments ne se modifient pas depuis cet écran. Pour les faire changer,
            écrivez à votre consultante EODA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-gris-mid">Type de compte :</span>
            <Badge variant="secondary">{ROLE_LABELS[profile.role] ?? profile.role}</Badge>
          </div>

          {profile.establishments.length > 0 && (
            <div className="space-y-1">
              <p className="text-gris-mid">
                {profile.establishments.length > 1 ? "Structures rattachées" : "Structure rattachée"} :
              </p>
              <ul className="space-y-1">
                {profile.establishments.map((name) => (
                  <li key={name} className="flex items-center gap-2 text-brun-ancre">
                    <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-terre" aria-hidden="true" />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
