import type { Metadata } from "next";
import Link from "next/link";
import { TabletHeader, TabletMain } from "@/components/tablet/TabletHeader";
import { TabletDemo } from "@/components/tablet/demo/TabletDemo";
import { DEMO_STRUCTURE } from "@/components/tablet/demo/demo-data";

export const metadata: Metadata = { title: "Démonstration de la tablette", robots: { index: false, follow: false } };

// Démonstration de la tablette terrain (lot C) : données FICTIVES, entièrement en
// mémoire du navigateur. Aucune action serveur, aucun appel au port HDS — c'est
// ce qui permet de montrer le parcours tant que l'hébergement certifié n'existe pas.
export default function TabletDemoPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <TabletHeader
        structureName={DEMO_STRUCTURE}
        aside={
          <Link href="/tablette" className="flex h-14 items-center rounded-xl border border-line bg-card px-4 text-[17px] hover:bg-soft">
            Quitter la démonstration
          </Link>
        }
      />
      <TabletMain>
        <TabletDemo />
      </TabletMain>
    </div>
  );
}
