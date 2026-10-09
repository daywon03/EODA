import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CabinetShell } from "./cabinet/CabinetShell";
import { ClientShell } from "./client/ClientShell";

// Coquille des pages communes aux deux portails (Mon profil, Aide) : chacun les
// retrouve dans SA coquille, avec sa navigation — sans quoi on y arrive et on ne
// sait plus en repartir. Le rôle ne fait que CHOISIR l'habillage ; chaque coquille
// relit ensuite l'utilisateur par sa propre garde (lib/auth/guards.ts).
export async function RoleShell({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "CLIENT_USER") return <ClientShell>{children}</ClientShell>;
  return <CabinetShell>{children}</CabinetShell>;
}
