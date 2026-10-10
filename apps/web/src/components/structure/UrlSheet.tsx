"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";

// Panneau latéral PILOTÉ PAR L'ADRESSE (`?doc=…`) : le serveur décide de ce qu'il
// contient — et répond notFound() à un identifiant hors périmètre — ; ce composant
// ne fait que l'afficher et, à la fermeture, revenir à l'adresse sans le paramètre.
// Le lien est donc partageable, et « Précédent » referme le panneau.
//
// Rendu après le montage seulement : Sheet passe par un portail vers document.body,
// qui n'existe pas pendant le rendu serveur.
export function UrlSheet({ title, closeHref, children }: { title: string; closeHref: string; children: ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <Sheet title={title} onClose={() => router.push(closeHref, { scroll: false })}>
      {children}
    </Sheet>
  );
}
