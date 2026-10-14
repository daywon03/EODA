import { buildSurveyExport } from "@/lib/actions/terrain-read";

// Export AGRÉGÉ des résultats d'enquête (une ligne par question, jamais par
// répondant). Garde dans buildSurveyExport : requireEstablishmentAccess(TERRAIN_READ),
// donc un identifiant hors périmètre donne un 404 avant toute lecture.
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  const { id } = await context.params;
  const { csv, fileName } = await buildSurveyExport(id);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
