import { buildEvaluationExport, recordEvaluationExport } from "@/lib/actions/evaluation-export";

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
