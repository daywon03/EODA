import { PrismaClient } from "@prisma/client";
import { resolveRuntimeDatabaseUrl } from "./database-url";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// LE POOL EST BORNÉ ICI, pour toutes les instances — poste, prévisualisation, production.
//
// Sans cela, Prisma ouvre `nb_cpu_physiques × 2 + 1` connexions par PROCESSUS (21 sur le
// poste de développement, 10 cœurs mesurés) alors que le pooler en mode session n'en
// accepte que 15, partagées avec la production : la page d'accueil cabinet est tombée
// dessus le 16/10/2026 (`max clients reached in session mode`). Cf. database-url.ts pour
// la mesure complète, et startup-check.ts côté application pour l'avertissement de
// démarrage — ce paquet n'écrit rien dans les journaux.
export const databaseUrlReport = resolveRuntimeDatabaseUrl(process.env.DATABASE_URL ?? "");

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Prisma lit `DATABASE_URL` lui-même ; on ne la lui repasse que lorsqu'elle a été
    // analysée, pour ne pas remplacer son message d'erreur par le nôtre quand la
    // variable est absente ou illisible.
    ...(databaseUrlReport.parsed ? { datasources: { db: { url: databaseUrlReport.url } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
export { EXPECTED_MIGRATIONS } from "./migrations";
export {
  connectionPoolWarning,
  DEFAULT_CONNECTION_LIMIT,
  resolveRuntimeDatabaseUrl,
  TRANSACTION_POOLER_PORT,
  type DatabaseUrlResolution,
} from "./database-url";
