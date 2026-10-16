import { prisma } from "@eoda/database";
import { resolveSignupTenant, SELF_SERVICE_FORMULES, type SelfServiceFormule } from "@/lib/services/self-service-service";

// Prix MENSUELS publics des offres (landing, inscription). Une seule information
// sort, et elle est publique par nature : le prix « à partir de » de chaque offre en
// vente. Null = non fixé (« xx € / mois », décision 11 du plan v2) — y compris si la
// base compte plusieurs cabinets (fail-closed, comme l'inscription).
export async function readPublicMonthlyPrices(): Promise<Record<SelfServiceFormule, number | null>> {
  const none = { ESSENTIEL: null, PERFORMANCE: null, EXCELLENCE: null };
  const tenants = await prisma.tenant.findMany({ take: 2, select: { id: true } });
  const tenantId = resolveSignupTenant(tenants.map((t) => t.id));
  if (!tenantId) return none;
  const rows = await prisma.catalogueFormule.findMany({
    where: { tenantId, active: true, formule: { in: [...SELF_SERVICE_FORMULES] } },
    select: { formule: true, monthlyPriceEuros: true },
  });
  const prices: Record<SelfServiceFormule, number | null> = { ...none };
  for (const row of rows) {
    if (row.formule === "ESSENTIEL" || row.formule === "PERFORMANCE" || row.formule === "EXCELLENCE") {
      prices[row.formule] = row.monthlyPriceEuros;
    }
  }
  return prices;
}
