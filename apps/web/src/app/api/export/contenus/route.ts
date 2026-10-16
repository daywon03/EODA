import { buildContentReviewExport } from "@/lib/actions/content-review";
import { parseContentReviewFormat } from "@/lib/services/content-review-export-service";

// Export des « Contenus à valider » (Word ou CSV), pour l'annotation hors ligne de
// Sandrine. Garde dans buildContentReviewExport : requireContentReviewSession
// (CABINET_ADMIN, CABINET_EVALUATOR). `no-store` : le contenu change à chaque
// correction, un export en cache serait déjà faux.
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const format = parseContentReviewFormat(new URL(request.url).searchParams.get("format"));
  if (!format) return new Response("Format inconnu : csv ou docx.", { status: 400 });

  const { body, fileName, contentType } = await buildContentReviewExport(format);
  return new Response(typeof body === "string" ? body : new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
