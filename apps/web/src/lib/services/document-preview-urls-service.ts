import { prisma } from "@eoda/database";
import { getFileStoragePort } from "@/lib/storage";
import { isImageFile, isPdfFile } from "./file-type-service";

// ─────────────────────────────────────────────────────────────────────────────
// LES ADRESSES SIGNÉES DES APERÇUS DIRECTS (20/10/2026)
//
// `previewForVersion` (document-row-preview-service) décide tout seul de l'adresse
// des `.docx`/`.xlsx`/`.csv` — c'est notre route. Il lui manque les deux formats que
// le NAVIGATEUR affiche depuis le stockage : le PDF et l'image, dont l'adresse est
// signée et donc à durée de vie courte. Elle ne peut pas être calculée dans le
// navigateur ; elle est pré-signée ici, au rendu de la page, pour que le clic sur une
// ligne ouvre l'aperçu sans un aller-retour.
//
// Ce que cette fonction NE fait pas : décider d'un accès. L'appelant est la page de la
// fiche structure, qui a déjà passé `requireEstablishmentInTenant` ; la requête
// ci-dessous est malgré tout bornée à l'établissement — un identifiant reçu d'un
// appelant ne doit jamais suffire (§5 bis, fail-closed).
//
// Le coût est celui d'une requête et de N signatures LOCALES (S3 signe sans appeler
// le réseau). Une signature qui échoue ne fait pas tomber la page : elle retire cet
// aperçu-là, et le bouton « Voir » du panneau reste disponible.
// ─────────────────────────────────────────────────────────────────────────────
export async function signPreviewUrlsForVersions(params: {
  establishmentId: string;
  versionIds: readonly string[];
}): Promise<Record<string, string>> {
  const { establishmentId, versionIds } = params;
  if (versionIds.length === 0) return {};

  const versions = await prisma.documentVersion.findMany({
    where: {
      id: { in: [...versionIds] },
      document: { establishmentId },
    },
    select: { id: true, fileStorageKey: true, originalFilename: true },
  });

  const storage = getFileStoragePort();
  const signed = await Promise.all(
    versions.map(async (version) => {
      if (!isPdfFile(version.originalFilename) && !isImageFile(version.originalFilename)) {
        return null;
      }
      try {
        const url = await storage.getSignedDownloadUrl(version.fileStorageKey, {
          disposition: "inline",
          filename: version.originalFilename,
        });
        return [version.id, url] as const;
      } catch {
        // Un stockage injoignable retire un aperçu, il ne casse pas l'écran.
        return null;
      }
    })
  );

  return Object.fromEntries(signed.filter((entry): entry is readonly [string, string] => entry !== null));
}
