import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { STORAGE_ROOT } from "@/lib/storage/local-fs-storage-adapter";

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// Sert les fichiers du fallback dev local (jamais utilisé en production —
// cf. getFileStoragePort()). Authentification requise, pas de vérification
// de cloisonnement par établissement ici : suffisant pour du dev local.
export async function GET(
  request: Request,
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

    const { searchParams } = new URL(request.url);
    const disposition = searchParams.get("disposition") === "inline" ? "inline" : "attachment";
    const filename = searchParams.get("filename");
    const contentType = MIME_TYPES_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";

    const headers = new Headers({ "Content-Type": contentType });
    headers.set(
      "Content-Disposition",
      filename ? `${disposition}; filename="${encodeURIComponent(filename)}"` : disposition
    );

    return new NextResponse(content, { headers });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
