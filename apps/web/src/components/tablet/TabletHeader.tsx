import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EodaMark } from "@/components/layout/EodaLogo";
import { TABLET_SECONDARY } from "./tablet-ui";

// En-tête de la tablette (maquette « Tablette terrain ») : marque, structure, et à
// droite la personne connectée et sa sortie. Collant en haut, cibles de 56 px.
// `backToHome` : depuis l'enquête ou l'accueil d'une personne, le retour à l'accueil
// de la tablette pour choisir l'autre parcours (demande de Damon, 08/11/2026).
export function TabletHeader({ structureName, aside, backToHome = false }: { structureName: string; aside?: ReactNode; backToHome?: boolean }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-card">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-4 px-4 py-2.5 sm:px-6">
        {backToHome && (
          <Link href="/tablette" className={`${TABLET_SECONDARY} gap-2`}>
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            Accueil de la tablette
          </Link>
        )}
        <div className="flex min-w-[12rem] flex-1 items-center gap-2.5">
          <EodaMark size={44} />
          <div className="flex flex-col leading-tight">
            <span className="font-bold">{structureName}</span>
            <span className="text-[16px] text-ink2">Tablette terrain</span>
          </div>
        </div>
        {aside}
      </div>
    </header>
  );
}

export function TabletMain({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-16 pt-8 text-[19px] sm:px-6">{children}</main>;
}
