"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { clearDeliverablesCount, CLIENT_DELIVERABLES_PATH } from "@/lib/design/client-navigation";
import type { NavItem } from "@/lib/design/navigation";

// Le compteur des livrables s'éteint dès que la page est ouverte. Le layout n'étant
// pas rejoué d'une page du portail à l'autre, c'est cet état client qui l'éteint
// (clearDeliverablesCount) ; la lecture elle-même est enregistrée en base par
// `markDeliverablesSeen`, page « Mes livrables ».
//
// Un HOOK, et non une copie dans chaque rendu : la barre du bas et la barre latérale
// montrent les mêmes entrées, mais jamais dans la même largeur — chacune a son propre
// état, sinon la pastille resterait allumée sur celle qu'on n'est pas en train de
// regarder jusqu'au rechargement suivant.
export function useVisibleClientNav(items: readonly NavItem[]): readonly NavItem[] {
  const pathname = usePathname();
  const onDeliverables = pathname.startsWith(CLIENT_DELIVERABLES_PATH);
  const [deliverablesOpened, setDeliverablesOpened] = useState(onDeliverables);
  if (onDeliverables && !deliverablesOpened) setDeliverablesOpened(true);
  return deliverablesOpened ? clearDeliverablesCount(items) : items;
}
