import { notFound } from "next/navigation";
import { exportAnnotatedDocx, exportChangeReportDocx } from "@/lib/actions/correction-export";

// Exports Word d'une mise en conformité (N8) — route et non action serveur : un .docx
// se sert avec ses en-têtes. `kind` = « annote » (document surligné + encarts +
// mention) ou « rapport » (rapport des changements). Garde, règle d'usage et journal
// dans correction-export / correction-context.
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ proposalId: string; kind: string }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  const { proposalId, kind } = await context.params;
  const exported =
    kind === "annote"
      ? await exportAnnotatedDocx(proposalId)
      : kind === "rapport"
        ? await exportChangeReportDocx(proposalId)
        : notFound();

  return new Response(new Uint8Array(exported.buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${exported.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
