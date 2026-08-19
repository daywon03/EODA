import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@eoda/database";
import { tryEstablishmentAccess } from "@/lib/auth/guards";
import { STORAGE_ROOT } from "@/lib/storage/local-fs-storage-adapter";
import { isProductionRuntime } from "@/lib/config/env";

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sert les fichiers du fallback de stockage local (développement uniquement —
// cf. getFileStoragePort(), qui exige S3 en production).
//
// ⚠️ Cette route est HORS du middleware : le `matcher` de src/middleware.ts exclut
// /api. Tout le contrôle d'accès doit donc être fait ici, explicitement.
//
// Trois barrières, dans cet ordre :
//   1. Refus pur et simple en production.
//   2. Cloisonnement par établissement — la clé de stockage est résolue en
//      DocumentVersion, puis l'habilitation est vérifiée sur l'établissement
//      propriétaire. Une clé inconnue n'est jamais servie, même si le fichier
//      existe sur le disque.
//   3. Confinement du chemin sous STORAGE_ROOT.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  // 1. Jamais disponible en production, avant tout autre traitement.
  if (isProductionRuntime()) {
    return NextResponse.json({ error: "Indisponible en production" }, { status: 404 });
  }

  const { key } = await params;
  const storageKey = key.map(decodeURIComponent).join("/");

  // 2. La clé doit correspondre à une version de document réellement enregistrée,
  //    et l'appelant doit être habilité sur l'établissement propriétaire.
  const version = await prisma.documentVersion.findFirst({
    where: { fileStorageKey: storageKey },
    select: { originalFilename: true, document: { select: { establishmentId: true } } },
  });
  if (!version) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });

  const access = await tryEstablishmentAccess(version.document.establishmentId);
  if (!access) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });

  // 3. Confinement du chemin. `path.resolve` normalise les `..` ; la comparaison
  //    inclut le séparateur pour qu'un répertoire frère (".local-storage-autre")
  //    ne passe pas le test de préfixe.
  const root = path.resolve(STORAGE_ROOT);
  const filePath = path.resolve(root, storageKey);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    return NextResponse.json({ error: "Chemin invalide" }, { status: 400 });
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES_BY_EXTENSION[extension];
  // Liste blanche d'extensions : ne jamais servir un contenu dont on ne maîtrise pas
  // le type déclaré (un octet-stream inconnu peut être interprété par le navigateur).
  if (!contentType) {
    return NextResponse.json({ error: "Type de fichier non servi" }, { status: 400 });
  }

  try {
    const content = await readFile(filePath);

    const { searchParams } = new URL(request.url);
    const disposition = searchParams.get("disposition") === "inline" ? "inline" : "attachment";
    // Le nom de fichier vient de la base, jamais du paramètre de requête : un nom
    // fourni par l'appelant permettrait d'injecter dans l'en-tête Content-Disposition.
    const filename = encodeURIComponent(version.originalFilename);

    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename*=UTF-8''${filename}`,
        // Un document client ne doit jamais être mis en cache par un intermédiaire.
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
