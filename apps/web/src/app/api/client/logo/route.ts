import { notFound } from "next/navigation";
import { prisma } from "@eoda/database";
import { requireClientEstablishment } from "@/lib/auth/guards";
import { decodeLogoDataUri } from "@/lib/services/logo-response-service";

// Le logo de la structure du compte client connecté, pour la coquille du portail
// (11/11/2026 — il était écrit en base64 dans chaque page, deux fois). La structure
// vient du LIEN du compte (garde), jamais d'un paramètre ; un accès révoqué rend
// `establishment: null`, donc 404. Pas de journalisation : un logo n'est pas une pièce
// du dossier (même règle que /api/establishments/[id]/logo).
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const { establishment } = await requireClientEstablishment("HOME");
  if (!establishment) notFound();

  const row = await prisma.establishment.findUnique({
    where: { id: establishment.id },
    select: { logoDataUri: true },
  });
  const logo = decodeLogoDataUri(row?.logoDataUri ?? null);
  if (!logo) notFound();

  return new Response(new Uint8Array(logo.bytes), {
    headers: {
      "Content-Type": logo.type,
      // Navigateur seulement (`private`) ; l'adresse porte la version du logo
      // (`versionedLogoUrl`), un nouveau dépôt n'attend donc pas l'expiration.
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
