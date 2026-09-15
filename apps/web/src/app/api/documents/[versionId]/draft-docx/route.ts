import { notFound } from "next/navigation";
import { prisma } from "@eoda/database";
import { tryEstablishmentAccess } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { generateBrandedDocx } from "@/lib/services/markdown-to-docx-service";
import { buildEodaFileName } from "@/lib/services/document-naming-service";

// Téléchargement du brouillon corrigé — route et non action serveur, mêmes raisons
// que /api/export/cotations/[id] : un .docx se sert avec ses en-têtes, pas via un
// retour d'action serveur (le binaire ne traverse pas proprement une Server Action).
//
// Réservé au cabinet : c'est un brouillon de travail non relu, jamais un livrable
// client (même règle que getCorrectedDraft dans lib/actions/document.ts).
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ versionId: string }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  const { versionId } = await context.params;

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    select: {
      correctedDraftMarkdown: true,
      document: {
        select: {
          establishmentId: true,
          establishment: { select: { name: true } },
          documentType: { select: { label: true, code: true } },
        },
      },
    },
  });
  if (!version) notFound();

  const access = await tryEstablishmentAccess(version.document.establishmentId);
  if (!access || access.isClient) notFound();
  if (!version.correctedDraftMarkdown) notFound();

  const docBuffer = await generateBrandedDocx({
    markdown: version.correctedDraftMarkdown,
    title: version.document.documentType?.label ?? "Document corrigé",
    establishmentName: version.document.establishment.name,
  });

  const fileName = buildEodaFileName({
    issuedOn: new Date(),
    type: version.document.documentType?.code ?? "DOCUMENT",
    clientName: version.document.establishment.name,
    objet: "Brouillon-corrige",
    audience: "Interne",
    extension: "docx",
  });

  await recordAuditEvent({
    action: "CORRECTED_DRAFT_DOWNLOADED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: version.document.establishmentId,
    targetId: versionId,
    detail: version.document.documentType?.code ?? null,
  });

  return new Response(new Uint8Array(docBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
