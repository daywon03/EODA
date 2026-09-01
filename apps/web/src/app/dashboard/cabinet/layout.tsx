import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CabinetNav } from "@/components/layout/CabinetNav";
import { countPendingOptionRequests } from "@/lib/actions/option-request";

export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.user.role === "CLIENT_USER") redirect("/login");

  const isAdmin = session.user.role === "CABINET_ADMIN";
  // « Il faudrait qu'il y ait un mail ET un pop-up pour qu'on ne rate pas les
  // demandes » : la pastille est le pop-up, en plus fiable — elle reste tant que la
  // demande n'est pas traitée, là où une fenêtre se ferme et s'oublie.
  const pendingRequests = isAdmin ? await countPendingOptionRequests() : 0;

  return (
    <div>
      <div className="-mt-6 sm:-mt-8 mb-6 sm:mb-8">
        <CabinetNav isAdmin={isAdmin} pendingRequests={pendingRequests} />
      </div>
      {children}
    </div>
  );
}
