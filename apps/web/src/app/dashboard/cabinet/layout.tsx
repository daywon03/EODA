import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CabinetNav } from "@/components/layout/CabinetNav";

export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.user.role === "CLIENT_USER") redirect("/login");

  return (
    <div>
      <div className="-mt-6 sm:-mt-8 mb-6 sm:mb-8">
        <CabinetNav isAdmin={session.user.role === "CABINET_ADMIN"} />
      </div>
      {children}
    </div>
  );
}
