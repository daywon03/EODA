import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { roleHomePath } from "@/lib/auth/capabilities";

export default async function DashboardRootPage() {
  const session = await auth();
  if (!session) redirect("/login");
  redirect(roleHomePath(session.user.role));
}
