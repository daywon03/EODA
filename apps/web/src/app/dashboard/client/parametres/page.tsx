import { getStructureAccesses } from "@/lib/actions/client-access";
import {
  CLIENT_ACCESS_ROLE_LABELS,
  CLIENT_LEVEL_LABELS,
  CLIENT_MODULE_LABELS,
} from "@/lib/auth/capabilities";
import { ACCESS_STATUS_LABELS, clientPermissionMatrix } from "@/lib/services/client-access-service";
import { FUNCTION_LABELS } from "@/lib/services/action-item-service";
import { formatDate } from "@/lib/services/date-format-service";
import { initialsOf } from "@/lib/design/navigation";
import { ClientAccessDialog } from "@/components/client/settings/ClientAccessDialog";
import { cn } from "@/lib/utils";

export const metadata = { title: "Paramètres" };

// ─────────────────────────────────────────────────────────────────────────────
// PARAMÈTRES DE LA STRUCTURE (maquette de l'espace d'une structure, écran A8) — N9.
//
// Réservé à la DIRECTION : la lecture passe par le module ACCESS (seul rôle qui
// l'a) ; un autre rôle qui tape l'adresse est renvoyé à l'accueil par la garde. On y
// voit qui a accès, avec quel rôle, et la matrice rôle × module — la même que celle
// qu'appliquent les gardes (capabilities.ts), jamais une copie rédigée à la main.
// EODA n'y figure pas : le cabinet n'est pas un rôle de la structure.
// ─────────────────────────────────────────────────────────────────────────────
export default async function ClientSettingsPage() {
  const data = await getStructureAccesses();
  if (!data) {
    return (
      <div className="space-y-3">
        <h1 className="text-[30px] font-bold">Paramètres</h1>
        <p>Aucune structure n&apos;est rattachée à votre compte.</p>
      </div>
    );
  }
  const active = data.rows.filter((row) => row.status !== "REVOKED");
  const matrix = clientPermissionMatrix();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold leading-tight">Paramètres</h1>
          <p className="mt-1 max-w-[60ch] text-ink2">
            {active.length} personne{active.length > 1 ? "s ont" : " a"} accès. Seule la direction peut donner un accès ou
            changer un rôle.
          </p>
        </div>
        {data.canEdit && <ClientAccessDialog mode="grant" />}
      </div>

      <section aria-labelledby="acces" className="flex flex-col gap-3">
        <h2 id="acces" className="text-[22px] font-bold">
          Accès à l&apos;espace
        </h2>
        <ul className="divide-y divide-line rounded-[14px] border border-line bg-card">
          {data.rows.map((row) => (
            <li key={row.userId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-soft font-bold"
              >
                {initialsOf(row.name)}
              </span>
              <span className="flex min-w-[12rem] flex-1 flex-col">
                <span className="font-bold">
                  {row.name}
                  {row.isSelf && <span className="font-normal text-ink2"> (vous)</span>}
                </span>
                <span className="break-all text-ink2">
                  {FUNCTION_LABELS[row.roleInEstablishment]} · {row.email}
                </span>
              </span>
              <span className={cn("min-w-[10rem] font-bold", row.status === "REVOKED" ? "text-ink2" : "text-ink")}>
                {ACCESS_STATUS_LABELS[row.status]}
                {row.revokedAt && <span className="font-normal"> le {formatDate(row.revokedAt)}</span>}
              </span>
              {data.canEdit && row.status !== "REVOKED" && !row.isSelf ? (
                <ClientAccessDialog mode="edit" row={row} />
              ) : (
                <span className="rounded-[10px] border border-line px-3.5 py-2 font-bold">
                  {CLIENT_ACCESS_ROLE_LABELS[row.accessRole].label}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="droits" className="flex flex-col gap-3">
        <div>
          <h2 id="droits" className="text-[22px] font-bold">
            Ce que chaque rôle peut faire
          </h2>
          <p className="mt-1 text-ink2">Le rôle se change à tout moment. Il s&apos;applique à la page suivante.</p>
        </div>
        <div className="grid items-start gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {matrix.map(({ role, rows }) => (
            <table key={role} className="w-full overflow-hidden rounded-xl border border-line bg-card text-[16px]">
              <caption className="bg-soft px-4 py-3 text-left font-bold">
                {CLIENT_ACCESS_ROLE_LABELS[role].label}
                <span className="font-normal text-ink2">
                  {" "}
                  · {active.filter((r) => r.accessRole === role).length}
                </span>
              </caption>
              <tbody>
                {rows.map(({ module, level }) => (
                  <tr key={module} className="border-t border-line">
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      {CLIENT_MODULE_LABELS[module]}
                    </th>
                    <td
                      className={cn(
                        "whitespace-nowrap px-4 py-2 text-right",
                        level === "FULL" && "font-bold",
                        level === "NONE" && "text-ink2"
                      )}
                    >
                      {level === "NONE" ? <span aria-label="Non">—</span> : CLIENT_LEVEL_LABELS[level]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </section>
    </div>
  );
}
