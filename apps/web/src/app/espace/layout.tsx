import type { ReactNode } from "react";
import Link from "next/link";
import { requireProspectSession } from "@/lib/auth/guards";
import { EodaMark } from "@/components/layout/EodaLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

// Coquille minimale de l'espace d'une structure inscrite seule (D5) : la marque, le
// nom de la structure, le thème, la déconnexion. La garde relit le compte et le lien
// ProspectAccount à chaque rendu ; un autre rôle est renvoyé à son portail.
export default async function ProspectSpaceLayout({ children }: { children: ReactNode }) {
  const { prospect } = await requireProspectSession();
  return (
    <div className="min-h-dvh bg-paper text-lg text-ink">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Link href="/espace" className="flex min-h-11 items-center gap-3 font-bold">
            <EodaMark size={36} />
            <span>{prospect.structureName}</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a href="/deconnexion" className="inline-flex min-h-11 items-center rounded-[10px] border border-ink px-4 font-bold hover:bg-soft">
              Se déconnecter
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
