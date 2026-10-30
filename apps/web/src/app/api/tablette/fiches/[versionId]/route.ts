import { notFound } from "next/navigation";
import { resolveTabletSession } from "@/lib/auth/guards";
import { readTabletAwarenessSheets } from "@/lib/db/read-tablet-awareness-sheets";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { inlineOriginalHeaders, inlineOriginalType } from "@/lib/services/document-original-response";
import { getFileStoragePort } from "@/lib/storage";

// ─────────────────────────────────────────────────────────────────────────────
// UNE FICHE DE SENSIBILISATION, POUR LA TABLETTE (29/10/2026) — et, depuis le
// 30/10/2026, le tampon et le contrat récapitulatif du Département (même règle).
//
// Montrée à la personne à l'accueil, à côté de la ligne « À expliquer » (call du
// 28/10/2026). Même garde que le DIPEC : l'APPAREIL enregistré + le code du salarié
// (`resolveTabletSession`), la structure lue depuis l'appareil. Seule une fiche que la
// page annonce est servie (`readTabletAwarenessSheets`, validation à jour), et
// seulement si son type est reconnu par sa SIGNATURE binaire. Document institutionnel :
// aucune donnée de personne ne passe ici.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ versionId: string }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  const session = await resolveTabletSession();
  if (!session) notFound();
  const { versionId } = await context.params;

  const { sheets, storage } = await readTabletAwarenessSheets(session.establishmentId);
  const announced = Object.values(sheets).some((sheet) => sheet.versionId === versionId);
  const stored = storage.get(versionId);
  if (!announced || !stored) notFound();

  const content = await getFileStoragePort().download(stored.fileStorageKey);
  const type = inlineOriginalType(content);
  if (!type) notFound();

  await recordAuditEvent({ action: "DOCUMENT_PREVIEWED", establishmentId: session.establishmentId, targetId: versionId, detail: "tablette · document de la structure" });
  return new Response(new Uint8Array(content), { headers: inlineOriginalHeaders(type, stored.originalFilename) });
}
