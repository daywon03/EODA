import Link from "next/link";
import { AuditAction } from "@eoda/database";
import { listAuditLog } from "@/lib/actions/audit-log";
import { AUDIT_PAGE_SIZE } from "@/lib/services/pagination-service";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/services/date-format-service";
import { ScrollText } from "lucide-react";

export const metadata = { title: "Journal d'audit · EODA Conseil" };

// Libellés exhaustifs : le Record<AuditAction, string> cesse de compiler dès qu'une
// valeur est ajoutée à l'enum sans être traduite ici. C'est le contrôle mécanique
// qui évite qu'un nouvel événement apparaisse à l'écran sous son nom technique.
const ACTION_LABELS: Record<AuditAction, string> = {
  DOCUMENT_UPLOADED: "Document déposé",
  DOCUMENT_DOWNLOADED: "Document téléchargé",
  DOCUMENT_PREVIEWED: "Document consulté",
  DOCUMENT_STATUS_ANSWERED: "Statut de document renseigné",
  DOCUMENT_JUSTIFICATION_UPDATED: "Justification corrigée",
  DOCUMENT_VERSION_DELETED: "Version de document supprimée",
  CLIENT_USER_INVITED: "Interlocuteur client invité",
  CLIENT_USER_UPDATED: "Fiche interlocuteur corrigée",
  CLIENT_USER_UNLINKED: "Accès à l'établissement retiré",
  USER_DEACTIVATED: "Compte désactivé",
  USER_REACTIVATED: "Compte réactivé",
  USER_DELETED_WITH_ESTABLISHMENT: "Compte supprimé avec l'établissement",
  PASSWORD_RESET_BY_ADMIN: "Mot de passe réinitialisé par le cabinet",
  ESTABLISHMENT_DELETED: "Établissement supprimé",
  LOGIN_FAILED: "Échec de connexion",
  LOGIN_RATE_LIMITED: "Connexion bloquée (trop de tentatives)",
  LOGIN_REFUSED_INACTIVE: "Connexion refusée (compte désactivé)",
  PASSWORD_CHANGED: "Mot de passe changé",
  PASSWORD_CHANGE_FAILED: "Échec de changement de mot de passe",
  PASSWORD_CHANGE_RATE_LIMITED: "Changement de mot de passe bloqué",
  DEVIS_DELETED: "Devis supprimé",
  DEVIS_CANCELLED: "Devis annulé",
  CATALOGUE_ITEM_RETIRED: "Ligne de catalogue retirée",
  CATALOGUE_ITEM_RESTORED: "Ligne de catalogue restaurée",
  OPTION_QUOTE_REQUESTED: "Demande de devis d'option (client)",
  OPTION_REQUEST_HANDLED: "Demande d'option traitée",
  PROSPECT_CONVERTED: "Devis signé — fiche client et profil créés",
  MISSION_SCOPE_UPDATED: "Périmètre de mission modifié (offre, options)",
  MISSION_CLOSED: "Mission close (bibliothèque en lecture seule)",
  MISSION_REOPENED: "Mission rouverte (dépôt de nouveau possible)",
  MISSION_CLIENT_ACCESS_REVOKED: "Accès client révoqué",
  MISSION_CLIENT_ACCESS_RESTORED: "Accès client rétabli",
  ANALYSIS_PUBLISHED: "Analyse relue et restituée au client",
  ANALYSIS_UNPUBLISHED: "Analyse retirée du portail client",
  DOCUMENT_VALIDATED: "Document validé",
  DOCUMENT_UNVALIDATED: "Validation de document retirée",
  DOCUMENT_TYPE_SCOPE_CHANGED: "Document réclamé au client / produit par EODA",
  EVALUATION_EXPORTED: "Export des cotations d'auto-évaluation",
  AVENANT_SIGNED: "Avenant signé (retour du client)",
  AVENANT_SIGNATURE_CLEARED: "Signature d'avenant retirée",
  DOCUMENT_REMINDER_SENT: "Relance des pièces manquantes",
  TEMPLATE_VERSION_UPLOADED: "Modèle — version publiée",
  TEMPLATE_VERSION_DELETED: "Modèle — version supprimée",
  TEMPLATE_DOCUMENT_DELETED: "Modèle supprimé",
};

const ROLE_LABELS: Record<string, string> = {
  CABINET_ADMIN: "Cabinet — admin",
  CABINET_EVALUATOR: "Cabinet — évaluateur",
  CLIENT_USER: "Client",
};

// Format unique de l'application (date-format-service) : JJ/MM/AAAA à HH:MM.

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function buildQueryString(params: SearchParams, overrides: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const key of ["establishmentId", "actorUserId", "action"]) {
    const value = readParam(params, key);
    if (value) search.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) search.set(key, value);
  return `?${search.toString()}`;
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const pageParam = Number(readParam(params, "page") ?? "1");

  const result = await listAuditLog({
    establishmentId: readParam(params, "establishmentId"),
    actorUserId: readParam(params, "actorUserId"),
    action: readParam(params, "action"),
    // Un paramètre de page non numérique retombe sur 1 plutôt que de produire un
    // `skip: NaN` que Prisma refuserait par une erreur technique.
    page: Number.isFinite(pageParam) ? Math.trunc(pageParam) : 1,
  });

  const selectedEstablishment = readParam(params, "establishmentId") ?? "";
  const selectedActor = readParam(params, "actorUserId") ?? "";
  const selectedAction = readParam(params, "action") ?? "";
  const firstIndex = result.total === 0 ? 0 : (result.page - 1) * AUDIT_PAGE_SIZE + 1;
  const lastIndex = Math.min(result.page * AUDIT_PAGE_SIZE, result.total);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal d'audit"
        icon={ScrollText}
        backHref="/dashboard/cabinet"
        subtitle="Accès aux documents, cycle de vie des comptes et tentatives de connexion — traçabilité du secteur médico-social"
      />

      {/* Filtres — formulaire GET : la page reste partageable et rejouable par URL,
          et aucune mutation n'est possible depuis cet écran (lecture seule). */}
      <form
        method="get"
        className="bg-white border border-gris-light rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="establishmentId">Établissement</Label>
          <Select id="establishmentId" name="establishmentId" defaultValue={selectedEstablishment}>
            <option value="">Tous</option>
            {result.establishmentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="actorUserId">Auteur</Label>
          <Select id="actorUserId" name="actorUserId" defaultValue={selectedActor}>
            <option value="">Tous</option>
            {result.actorOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="action">Événement</Label>
          <Select id="action" name="action" defaultValue={selectedAction}>
            <option value="">Tous</option>
            {Object.values(AuditAction).map((action) => (
              <option key={action} value={action}>
                {ACTION_LABELS[action]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit">Filtrer</Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/cabinet/journal">Réinitialiser</Link>
          </Button>
        </div>
      </form>

      <div className="bg-white border border-gris-light rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gris-light flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gris-mid">
            {result.total === 0
              ? "Aucun événement"
              : `Événements ${firstIndex} à ${lastIndex} sur ${result.total}`}
          </p>
          <p className="text-xs text-gris-mid">Du plus récent au plus ancien</p>
        </div>

        {result.rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gris-mid">
            Aucun événement ne correspond à ces filtres.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ivoire text-left text-xs uppercase tracking-wide text-gris-mid">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-semibold">Date</th>
                  <th scope="col" className="px-5 py-2.5 font-semibold">Événement</th>
                  <th scope="col" className="px-5 py-2.5 font-semibold">Auteur</th>
                  <th scope="col" className="px-5 py-2.5 font-semibold">Établissement</th>
                  <th scope="col" className="px-5 py-2.5 font-semibold">Précision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gris-light">
                {result.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-ivoire/50 transition-colors">
                    <td className="px-5 py-2.5 whitespace-nowrap tabular-nums text-gris-mid">
                      {formatDateTime(row.occurredAt)}
                    </td>
                    <td className="px-5 py-2.5 text-brun-ancre">{ACTION_LABELS[row.action]}</td>
                    <td className="px-5 py-2.5 text-brun-ancre">
                      {row.actorLabel}
                      {row.actorRole && (
                        <span className="block text-xs text-gris-mid">
                          {ROLE_LABELS[row.actorRole] ?? row.actorRole}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-gris-mid">{row.establishmentName ?? "—"}</td>
                    <td className="px-5 py-2.5 text-gris-mid">{row.detail ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result.pageCount > 1 && (
          <div className="px-5 py-3 border-t border-gris-light flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" asChild disabled={result.page <= 1}>
              <Link
                href={`/dashboard/cabinet/journal${buildQueryString(params, { page: String(Math.max(1, result.page - 1)) })}`}
                aria-disabled={result.page <= 1}
              >
                Précédent
              </Link>
            </Button>
            <span className="text-xs text-gris-mid tabular-nums">
              Page {result.page} / {result.pageCount}
            </span>
            <Button variant="outline" size="sm" asChild disabled={result.page >= result.pageCount}>
              <Link
                href={`/dashboard/cabinet/journal${buildQueryString(params, { page: String(Math.min(result.pageCount, result.page + 1)) })}`}
                aria-disabled={result.page >= result.pageCount}
              >
                Suivant
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
