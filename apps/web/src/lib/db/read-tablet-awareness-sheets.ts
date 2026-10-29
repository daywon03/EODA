import { prisma } from "@eoda/database";
import { AWARENESS_SHEET_CODES, selectAwarenessSheets } from "@/lib/services/awareness-sheet-service";
import type { TabletAwarenessSheet } from "@/lib/services/awareness-sheet-links";

// Les fiches de sensibilisation que la tablette peut montrer, et où les trouver dans le
// stockage. UNE lecture pour la page et pour la route qui sert le fichier : les deux
// appliquent la même règle (`selectAwarenessSheets`). L'établissement vient TOUJOURS de
// l'appareil enregistré, jamais d'un identifiant reçu.
export async function readTabletAwarenessSheets(establishmentId: string): Promise<{
  sheets: Record<string, TabletAwarenessSheet>;
  storage: ReadonlyMap<string, { fileStorageKey: string; originalFilename: string }>;
}> {
  const documents = await prisma.document.findMany({
    where: { establishmentId, documentType: { code: { in: [...AWARENESS_SHEET_CODES] } } },
    select: {
      validatedAt: true,
      documentType: { select: { code: true } },
      versions: {
        select: {
          id: true,
          versionNumber: true,
          uploadedAt: true,
          originalFilename: true,
          fileStorageKey: true,
          uploadedBy: { select: { role: true } },
        },
      },
    },
  });

  const sheets = selectAwarenessSheets(
    documents.flatMap((document) =>
      document.documentType
        ? [
            {
              code: document.documentType.code,
              validatedAt: document.validatedAt,
              versions: document.versions.map((version) => ({
                id: version.id,
                versionNumber: version.versionNumber,
                uploadedAt: version.uploadedAt,
                originalFilename: version.originalFilename,
                producedByCabinet: version.uploadedBy.role !== "CLIENT_USER",
              })),
            },
          ]
        : []
    )
  );
  const storage = new Map(
    documents.flatMap((d) => d.versions).map((v) => [v.id, { fileStorageKey: v.fileStorageKey, originalFilename: v.originalFilename }])
  );
  return { sheets, storage };
}
