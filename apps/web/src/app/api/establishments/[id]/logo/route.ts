import { notFound } from "next/navigation";
import { prisma } from "@eoda/database";
import { tryEstablishmentAccess } from "@/lib/auth/guards";
import { NEED } from "@/lib/auth/capabilities";
import { decodeLogoDataUri } from "@/lib/services/logo-response-service";

// Le logo d'une structure, pour l'affichage (liste des structures, en-tête de fiche).
// Même garde que les documents de la structure : qui ne la voit pas n'en voit pas le
// logo, et la réponse est la même que la structure n'existe pas ou soit d'un autre
// cabinet (`notFound`). Pas de journalisation : un logo n'est pas une pièce du dossier.
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  const { id } = await context.params;
  const access = await tryEstablishmentAccess(id, NEED.DOCUMENTS_READ);
  if (!access) notFound();

  const establishment = await prisma.establishment.findUnique({ where: { id }, select: { logoDataUri: true } });
  const logo = decodeLogoDataUri(establishment?.logoDataUri ?? null);
  if (!logo) notFound();

  return new Response(new Uint8Array(logo.bytes), {
    headers: {
      "Content-Type": logo.type,
      // Une heure dans le cache du navigateur seulement (`private`) : un logo change
      // rarement, et la liste des structures le redemande à chaque visite.
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
