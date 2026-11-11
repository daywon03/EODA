import { PrismaClient } from "@prisma/client";
import type { ITXClientDenyList } from "@prisma/client/runtime/library";
import { resolveRuntimeDatabaseUrl } from "./database-url";

// COLONNES LOURDES OMISES PAR DÉFAUT (11/11/2026). Mesuré en base : le logo d'une
// structure est un data URI de ~250 Ko, le texte extrait d'une version pèse plusieurs
// dizaines de Ko par document. Toute lecture de ligne complète (`findFirst` sans
// `select`, `include` d'une relation) les transportait à chaque navigation, pour ne
// presque jamais les lire. Les lire reste possible, mais EXPLICITEMENT :
// `select: { logoDataUri: true }` ou `omit: { extractedText: false }`. Le compilateur
// signale tout lecteur qui comptait sur la ligne complète — le type omis disparaît.
export const HEAVY_COLUMNS_OMIT = {
  establishment: { logoDataUri: true },
  documentVersion: { extractedText: true },
} as const;

function createPrismaClient() {
  return new PrismaClient({
    // Prisma lit `DATABASE_URL` lui-même ; on ne la lui repasse que lorsqu'elle a été
    // analysée, pour ne pas remplacer son message d'erreur par le nôtre quand la
    // variable est absente ou illisible.
    ...(databaseUrlReport.parsed ? { datasources: { db: { url: databaseUrlReport.url } } } : {}),
    omit: HEAVY_COLUMNS_OMIT,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export type AppPrismaClient = ReturnType<typeof createPrismaClient>;
// Le client d'une transaction interactive de CE client (omissions comprises) — à
// préférer à `Prisma.TransactionClient`, qui ignore l'omission globale.
export type AppTransactionClient = Omit<AppPrismaClient, ITXClientDenyList>;

const globalForPrisma = globalThis as unknown as { prisma: AppPrismaClient };

// LE POOL EST BORNÉ ICI, pour toutes les instances — poste, prévisualisation, production.
//
// Sans cela, Prisma ouvre `nb_cpu_physiques × 2 + 1` connexions par PROCESSUS (21 sur le
// poste de développement, 10 cœurs mesurés) alors que le pooler en mode session n'en
// accepte que 15, partagées avec la production : la page d'accueil cabinet est tombée
// dessus le 16/10/2026 (`max clients reached in session mode`). Cf. database-url.ts pour
// la mesure complète, et startup-check.ts côté application pour l'avertissement de
// démarrage — ce paquet n'écrit rien dans les journaux.
export const databaseUrlReport = resolveRuntimeDatabaseUrl(process.env.DATABASE_URL ?? "");

export const prisma: AppPrismaClient = globalForPrisma.prisma ?? createPrismaClient();

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
