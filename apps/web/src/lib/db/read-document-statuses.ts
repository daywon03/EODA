import { cache } from "react";
import { prisma, type DocumentStatus } from "@eoda/database";

// Statut de chaque document d'une structure, par type — MÉMOÏSÉ PAR RENDU : les trois
// chapitres d'auto-évaluation d'une même page le relisaient chacun (21/10/2026).
// Aucune garde ici : l'appelant a déjà vérifié l'appartenance de la structure.
export const readDocumentStatuses = cache(async (establishmentId: string): Promise<Map<string | null, DocumentStatus>> => {
  const documents = await prisma.document.findMany({
    where: { establishmentId },
    select: { documentTypeId: true, status: true },
  });
  return new Map(documents.map((d) => [d.documentTypeId, d.status]));
});
