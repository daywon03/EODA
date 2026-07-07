import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { STORAGE_ROOT } from "@/lib/storage/local-fs-storage-adapter";

// Sert les fichiers du fallback dev local (jamais utilisé en production —
// cf. getFileStoragePort()). Authentification requise, pas de vérification
// de cloisonnement par établissement ici : suffisant pour du dev local.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Indisponible en production" }, { status: 404 });
  }

  const { key } = await params;
  const relativePath = key.map(decodeURIComponent).join("/");
  const filePath = path.join(STORAGE_ROOT, relativePath);

  if (!filePath.startsWith(STORAGE_ROOT)) {
    return NextResponse.json({ error: "Chemin invalide" }, { status: 400 });
  }

  try {
    const content = await readFile(filePath);
    return new NextResponse(content);
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
