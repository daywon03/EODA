"use server";

import type { CommercialTier, SupportMode } from "@eoda/database";
import { requireClientEstablishment } from "@/lib/auth/guards";
import { findMissionOffer } from "@/lib/services/establishment-offer-service";

// Mode d'accompagnement et offre de la structure de l'appelant, pour le bandeau de
// mode du portail (N1). Résolus depuis le lien EstablishmentUser (garde), jamais
// depuis un paramètre. `null` sans mission : on n'annonce pas un mode qu'aucun
// contrat ne porte — le bandeau ne s'affiche pas, et la lecture applique la règle
// stricte (resolveSupportMode).
export async function getClientSupportContext(): Promise<{
  mode: SupportMode;
  formule: CommercialTier | null;
} | null> {
  const { establishment } = await requireClientEstablishment("HOME");
  if (!establishment) return null;
  const offer = await findMissionOffer(establishment.id);
  return offer ? { mode: offer.supportMode, formule: offer.formule } : null;
}
