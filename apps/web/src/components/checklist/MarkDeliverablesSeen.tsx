"use client";

import { useEffect } from "react";
import { markDeliverablesSeen } from "@/lib/actions/deliverables";

// Enregistre l'ouverture de « Mes livrables » une fois la page AFFICHÉE dans le
// navigateur — et non pendant son rendu serveur, qu'un préchargement de lien peut
// déclencher sans que personne n'ait rien vu.
export function MarkDeliverablesSeen(): null {
  useEffect(() => {
    // Un échec n'a qu'une conséquence : la pastille réapparaîtra à la prochaine
    // visite. Il ne mérite pas d'interrompre la lecture de la page.
    markDeliverablesSeen().catch(() => undefined);
  }, []);

  return null;
}
