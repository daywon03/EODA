import { prisma } from "@eoda/database";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

// Garde commun à tout l'espace Cabinet (établissements, suivi de mission) —
// exclut uniquement CLIENT_USER. CABINET_ADMIN et CABINET_EVALUATOR passent tous
// les deux : la distinction plus stricte (CABINET_ADMIN uniquement) est portée par
// requireCabinetAdminSession() ci-dessous, réservée aux données commerciales.
export async function requireCabinetSession() {
  const session = await auth();
  if (!session || session.user.role === "CLIENT_USER") redirect("/login");
  return session;
}

// Garde strict pour le module pipeline commercial (prospects/devis/catalogue) —
// réservé à CABINET_ADMIN, contrairement à requireCabinetSession() (établissements)
// qui n'exclut que CLIENT_USER. Redirige vers /dashboard/cabinet (pas /login) car
// un CABINET_EVALUATOR est légitimement connecté, juste non autorisé sur ce module.
export async function requireCabinetAdminSession() {
  const session = await auth();
  if (!session || session.user.role !== "CABINET_ADMIN") redirect("/dashboard/cabinet");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { tenantId: true },
  });
  if (!user.tenantId) redirect("/dashboard/cabinet");

  return { session, tenantId: user.tenantId };
}
