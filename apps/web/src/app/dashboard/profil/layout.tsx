import { RoleShell } from "@/components/layout/RoleShell";

// Page commune aux deux portails : chacun la voit dans sa propre coquille.
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell>{children}</RoleShell>;
}
