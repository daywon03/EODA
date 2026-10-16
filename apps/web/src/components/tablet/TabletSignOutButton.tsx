"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { tabletSignOut } from "@/lib/actions/tablet";

// Fin de session sur la tablette : efface la session du salarié, garde l'appareil
// enregistré (la tablette reste celle de la structure).
export function TabletSignOutButton({ name }: { name: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await tabletSignOut();
          router.refresh();
        })
      }
      className="h-14 rounded-xl border border-line bg-card px-4 text-[17px] hover:bg-soft disabled:opacity-70"
    >
      {name} · {isPending ? "Déconnexion…" : "Se déconnecter"}
    </button>
  );
}
