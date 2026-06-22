import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { UserRole } from "@eoda/database";

const ROLE_REDIRECTS: Record<UserRole, string> = {
  CABINET_ADMIN: "/dashboard/cabinet",
  CABINET_EVALUATOR: "/dashboard/cabinet",
  CLIENT_USER: "/dashboard/client",
};

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");
  redirect(ROLE_REDIRECTS[session.user.role] ?? "/login");
}
