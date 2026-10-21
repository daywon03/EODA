import { cache } from "react";
import { prisma } from "@eoda/database";

// Mission d'une structure, MÉMOÏSÉE PAR RENDU (`react.cache`, rien entre deux
// requêtes) : la vue d'ensemble d'une fiche la relisait une fois par chapitre
// d'auto-évaluation, plus une fois par panneau. Aucune garde ici — l'appelant a déjà
// vérifié l'appartenance de la structure (requireEstablishmentInTenant…).
export const readMission = cache(async (establishmentId: string) =>
  prisma.mission.findUnique({ where: { establishmentId } })
);
