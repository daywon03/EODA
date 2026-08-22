import type { Prisma } from "@eoda/database";

// Génère le numéro de devis annuel "DEVIS-AAAA-NNN" (context/07-outil-pilotage-missions.md §6.2).
// DOIT être appelé dans la même transaction que la création du Devis : l'upsert
// avec increment prend un verrou de ligne Postgres qui sérialise les créations
// concurrentes pour un même (tenant, année) — pas de risque de doublon.
export async function generateDevisNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  year: number
): Promise<string> {
  const counter = await tx.devisCounter.upsert({
    where: { tenantId_year: { tenantId, year } },
    update: { value: { increment: 1 } },
    create: { tenantId, year, value: 1 },
  });

  return `DEVIS-${year}-${String(counter.value).padStart(3, "0")}`;
}
