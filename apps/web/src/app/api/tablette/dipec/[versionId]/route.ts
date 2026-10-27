import { notFound } from "next/navigation";
import { resolveTabletSession } from "@/lib/auth/guards";
import { readTabletDipc } from "@/lib/db/read-tablet-dipc";
import { DOCX_MIME_TYPE, detectFileType } from "@/lib/security/upload-validation-service";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { inlineOriginalHeaders } from "@/lib/services/document-original-response";
import { getFileStoragePort } from "@/lib/storage";

// ─────────────────────────────────────────────────────────────────────────────
// LE WORD D'ORIGINE DU DIPEC, POUR LA TABLETTE (27/10/2026).
//
// La tablette remplit le .docx validé par EODA lui-même, dans le navigateur, pour que
// le contrat signé garde la mise en page d'EODA (dipec-word-service). Elle n'a pas de
// session du portail : la garde est l'APPAREIL enregistré + le code du salarié
// (`resolveTabletSession`). Seule la version que la page annonce est servie — même
// règle de sélection (`readTabletDipc`) —, et seulement si c'est bien un Word par sa
// SIGNATURE binaire. Document institutionnel : aucune donnée de personne ne passe ici,
// dans un sens comme dans l'autre.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ versionId: string }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  const session = await resolveTabletSession();
  if (!session) notFound();
  const { versionId } = await context.params;

  const { source, storage } = await readTabletDipc(session.establishmentId);
  const stored = storage.get(versionId);
  if (source.status !== "READY" || source.versionId !== versionId || !stored) notFound();

  const content = await getFileStoragePort().download(stored.fileStorageKey);
  if (detectFileType(content) !== DOCX_MIME_TYPE) notFound();

  await recordAuditEvent({ action: "DOCUMENT_PREVIEWED", establishmentId: session.establishmentId, targetId: versionId, detail: "tablette · DIPEC (Word) à remplir" });
  return new Response(new Uint8Array(content), { headers: inlineOriginalHeaders(DOCX_MIME_TYPE, stored.originalFilename) });
}
