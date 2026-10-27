import { prisma } from "@eoda/database";
import { DIPC_DOCUMENT_TYPE_CODE, selectTabletDipc, type TabletDipcSource } from "@/lib/services/tablet-dipc-service";

// Le DIPEC que la tablette présente, et où le trouver dans le stockage. UNE lecture
// pour la page (texte) et pour la route du Word d'origine : les deux appliquent la
// même règle (`selectTabletDipc`), sans quoi la route pourrait servir une autre
// version que celle que la page annonce. L'établissement vient TOUJOURS de l'appareil
// enregistré (resolveTabletSession), jamais d'un identifiant reçu.
export async function readTabletDipc(
  establishmentId: string
): Promise<{ source: TabletDipcSource; storage: ReadonlyMap<string, { fileStorageKey: string; originalFilename: string }> }> {
  const document = await prisma.document.findFirst({
    where: { establishmentId, documentType: { code: DIPC_DOCUMENT_TYPE_CODE } },
    select: {
      validatedAt: true,
      versions: {
        select: {
          id: true,
          versionNumber: true,
          uploadedAt: true,
          extractedText: true,
          originalFilename: true,
          fileStorageKey: true,
          uploadedBy: { select: { role: true } },
        },
      },
    },
  });

  const source = selectTabletDipc(
    document && {
      validatedAt: document.validatedAt,
      versions: document.versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        uploadedAt: version.uploadedAt,
        extractedText: version.extractedText,
        originalFilename: version.originalFilename,
        producedByCabinet: version.uploadedBy.role !== "CLIENT_USER",
      })),
    }
  );
  const storage = new Map((document?.versions ?? []).map((v) => [v.id, { fileStorageKey: v.fileStorageKey, originalFilename: v.originalFilename }]));
  return { source, storage };
}
