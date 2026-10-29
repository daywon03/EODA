import { buildEvaluationExport } from "@/lib/actions/evaluation-export";
import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";

// Journalisation séparée de la construction : la page d'aperçu compte les lignes sans
// que ça constitue un export, seul le TÉLÉCHARGEMENT en est un. Ici, et non dans le
// fichier d'actions : une fonction exportée d'un fichier « use server » est appelable
// directement, et n'importe quel compte cabinet aurait pu inscrire au journal des
// exports qui n'ont jamais eu lieu (audit du 28/10/2026).
async function recordEvaluationExport(establishmentId: string): Promise<void> {
  const { userId, session } = await requireEstablishmentInTenant(establishmentId, "READ");
  await recordAuditEvent({
    action: "EVALUATION_EXPORTED",
    actorUserId: userId,
    actorRole: session.user.role,
    establishmentId,
    detail: "Export CSV des cotations",
  });
}

// Téléchargement du fichier de cotations.
//
// Une route de téléchargement et non une action serveur : un fichier se sert avec ses
// en-têtes (type, nom, cache), ce qu'une action serveur ne fait pas. La garde reste la
// même que partout — `buildEvaluationExport` passe par
// `requireEstablishmentInTenant`, donc un identifiant hors périmètre donne un 404
// avant qu'une seule ligne ne soit lue.
//
// `dynamic = "force-dynamic"` + `no-store` : un export mis en cache renverrait les
// cotations d'hier au milieu d'une séance de cotation, et pire, celles d'un autre
// utilisateur derrière un cache partagé.
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  const { id } = await context.params;

  const { csv, fileName } = await buildEvaluationExport(id);
  // Journalisé APRÈS la construction : un export qui a échoué n'est pas un export.
  await recordEvaluationExport(id);

  return new Response(csv, {
    headers: {
      // `charset=utf-8` en plus du BOM : les deux disent la même chose à deux
      // lecteurs différents (le navigateur lit l'en-tête, Excel lit le BOM).
      "Content-Type": "text/csv; charset=utf-8",
      // Le nom suit la convention EODA et ne contient ni accent ni espace
      // (document-naming-service), il n'a donc pas besoin de la forme encodée.
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
