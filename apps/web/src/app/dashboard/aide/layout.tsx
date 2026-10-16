import { RoleShell } from "@/components/layout/RoleShell";

// Page commune aux deux portails : chacun la voit dans sa propre coquille.
export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell>{children}</RoleShell>;
}
