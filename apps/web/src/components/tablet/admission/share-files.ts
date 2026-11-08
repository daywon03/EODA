// « Envoyer » sur la tablette : la feuille de partage de l'appareil (messagerie,
// AirDrop, impression…). Le fichier ne passe jamais par le serveur d'EODA.
//
// Règle (retour de Damon, 08/11/2026 — « j'appuie sur Annuler et ça télécharge
// quand même ») : « Envoyer » ne TÉLÉCHARGE jamais à la place d'envoyer quand la
// tablette sait partager. Chrome sur Android refuse de partager un Word (.docx) : un
// dossier qui en contenait un partait aussitôt en téléchargement, sans rien demander.
// Désormais on n'envoie que les fichiers que la tablette accepte (les PDF), on dit
// lesquels ne sont pas partis, et une feuille refermée ou un envoi raté ne déclenche
// aucun téléchargement. Seul un appareil SANS partage télécharge, et l'écran le dit.

export type SharedFile = { fileName: string; blob: Blob };
export type ShareOutcome = "shared" | "downloaded" | "cancelled" | "failed";
export type ShareResult = { outcome: ShareOutcome; notSent: string[] };

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  csv: "text/csv",
  zip: "application/zip",
};

function toFile(file: SharedFile): File {
  const extension = file.fileName.split(".").pop()?.toLowerCase() ?? "";
  return new File([file.blob], file.fileName, { type: file.blob.type || MIME_BY_EXTENSION[extension] || "application/octet-stream" });
}

export async function shareFiles(
  files: readonly SharedFile[],
  title: string,
  download: (file: SharedFile) => void
): Promise<ShareResult> {
  const nav: Partial<Navigator> | undefined = typeof navigator === "undefined" ? undefined : navigator;
  if (typeof nav?.share !== "function" || typeof nav.canShare !== "function") {
    files.forEach(download);
    return { outcome: "downloaded", notSent: [] };
  }
  const canShare = nav.canShare.bind(nav);
  const shareable = files.filter((file) => canShare({ files: [toFile(file)] }));
  const notSent = files.filter((file) => !shareable.includes(file)).map((file) => file.fileName);
  if (shareable.length === 0) return { outcome: "failed", notSent };
  try {
    await nav.share({ files: shareable.map(toFile), title });
    return { outcome: "shared", notSent };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { outcome: aborted ? "cancelled" : "failed", notSent: aborted ? [] : files.map((file) => file.fileName) };
  }
}

// Le message affiché après le geste. `sent` / `downloaded` : la phrase propre à l'écran.
export function describeShare(result: ShareResult, sent: string, downloaded: string): string | null {
  const left = result.notSent.length > 0 ? ` Pas envoyé depuis la tablette : ${result.notSent.join(", ")} — utilisez « Télécharger ».` : "";
  if (result.outcome === "shared") return `${sent}${left}`;
  if (result.outcome === "downloaded") return downloaded;
  if (result.outcome === "failed") return "L'envoi n'a pas abouti. Rien n'a été téléchargé : utilisez « Télécharger » si besoin.";
  return null;
}
