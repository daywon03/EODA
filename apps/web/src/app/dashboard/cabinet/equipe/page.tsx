import { UserCog } from "lucide-react";
import { requireTeamManagerSession } from "@/lib/auth/guards";
import { CABINET_ROLES, CABINET_ROLE_LABELS } from "@/lib/auth/capabilities";
import { getCabinetTeam } from "@/lib/actions/cabinet-team";
import { countByRole, describeFollowedStructures } from "@/lib/services/cabinet-team-service";
import { formatAgo } from "@/lib/services/elapsed-time-service";
import { initialsOf } from "@/lib/design/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { TeamMemberDialog } from "@/components/team/TeamMemberDialog";

export const metadata = { title: "Équipe EODA" };

// ─────────────────────────────────────────────────────────────────────────────
// ÉQUIPE EODA (maquette « Portail Cabinet v2 », vue Équipe EODA) — tranche N9.
//
// Administration seule (requireTeamManagerSession, capacité TEAM_MANAGE ; le
// middleware a le même filet). Les rôles et leur description viennent de la
// matrice (capabilities.ts) : l'écran ne peut pas annoncer un droit que la garde ne
// donne pas. L'équipe de chaque STRUCTURE se gère depuis son espace, pas ici.
// ─────────────────────────────────────────────────────────────────────────────
export default async function CabinetTeamPage() {
  await requireTeamManagerSession();
  const { members, establishments, currentUserId } = await getCabinetTeam();
  const counts = countByRole(members);
  const now = new Date();
  const nameById = new Map(establishments.map((e) => [e.id, e.name]));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Équipe EODA"
        icon={UserCog}
        subtitle="Les personnes du cabinet et ce qu'elles peuvent faire. L'équipe de chaque structure se gère depuis son espace."
        action={<TeamMemberDialog mode="invite" establishments={establishments} />}
      />

      <section aria-labelledby="team-roles" className="space-y-3">
        <h2 id="team-roles" className="sr-only">
          Rôles
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CABINET_ROLES.map((role) => (
            <li key={role} className="flex flex-col gap-1.5 rounded-xl border border-line bg-card p-4">
              <span className="flex justify-between gap-2">
                <span className="font-bold text-ink">{CABINET_ROLE_LABELS[role].label}</span>
                <span className="tabular-nums text-ink2" aria-label={`${counts[role]} personne(s)`}>
                  {counts[role]}
                </span>
              </span>
              <span className="text-ink2">{CABINET_ROLE_LABELS[role].description}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="team-members" className="space-y-3">
        <h2 id="team-members" className="text-xl font-bold text-ink">
          Membres
        </h2>
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {members.map((member) => {
            const structures = member.assignedEstablishmentIds.flatMap((id) => nameById.get(id) ?? []);
            return (
              <li key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-ink-fill font-bold text-on-ink"
                >
                  {initialsOf(member.name)}
                </span>
                <span className="flex min-w-[12rem] flex-1 flex-col">
                  <span className="font-bold text-ink">
                    {member.name}
                    {member.id === currentUserId && <span className="font-normal text-ink2"> (vous)</span>}
                  </span>
                  <span className="break-all text-ink2">{member.email}</span>
                </span>
                {member.isActive ? (
                  <TeamMemberDialog
                    mode="edit"
                    establishments={establishments}
                    member={member}
                    isSelf={member.id === currentUserId}
                  />
                ) : (
                  <span className="whitespace-nowrap rounded-md border border-line px-3 py-1.5 text-ink2">
                    Accès retiré
                  </span>
                )}
                <span className="min-w-[10rem] flex-1 text-ink">
                  Structures : {describeFollowedStructures(member.role, structures)}
                </span>
                <span className="min-w-[8rem] whitespace-nowrap text-ink2">
                  {member.lastLoginAt ? `Connexion ${formatAgo(member.lastLoginAt, now)}` : "Jamais connecté"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
