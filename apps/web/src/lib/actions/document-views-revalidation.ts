import { revalidatePath } from "next/cache";

// Les écrans qui montrent l'état d'un document, côté structure ET côté cabinet. UNE
// liste, appelée par chaque geste qui change cet état (dépôt, validation, acceptation…) :
// le 23/10/2026, accepter dans « Mes documents » ne se voyait pas dans « Mes
// livrables », parce que l'acceptation recopiait sa propre liste, sans cette page.
// Pas de "use server" : ce module n'est pas une action, seulement une aide aux actions.
export const CLIENT_DOCUMENT_VIEW_PATHS = [
  "/dashboard/client",
  "/dashboard/client/documents",
  "/dashboard/client/livrables",
] as const;

export function revalidateDocumentViews(establishmentId: string): void {
  for (const path of CLIENT_DOCUMENT_VIEW_PATHS) revalidatePath(path);
  revalidatePath(`/dashboard/cabinet/etablissements/${establishmentId}`);
}
