// Validité PAR DÉFAUT d'un nouveau devis — pure, testée (décision Q10 bis du bilan
// du 08/10/2026, retour de Sandrine du 23/08) : 15 jours si l'évaluation HAS de la
// structure est à moins de 6 mois, 30 jours sinon. Une échéance proche ne laisse
// pas le temps d'attendre une signature : le devis doit expirer vite pour être
// relancé vite.
//
// Ce n'est qu'une valeur PROPOSÉE à la création : le champ reste modifiable, et
// rien n'est recalculé après coup (la validité d'un devis émis fait partie du
// document commercial). La logique de montants (devis-calculation-service) n'est
// pas touchée.

export const SHORT_VALIDITY_DAYS = 15;
export const LONG_VALIDITY_DAYS = 30;
export const NEAR_EVALUATION_MONTHS = 6;

export type DefaultValidity = { days: number; reason: string };

// `now` est un paramètre (D7) ; `fallbackDays` = réglage de facturation du cabinet,
// utilisé seulement quand l'échéance HAS du prospect n'est pas connue — la règle
// ne peut alors pas trancher, et le réglage saisi par le cabinet reste la référence.
export function computeDefaultValidityDays(input: {
  evaluationTargetDate: Date | null;
  now: Date;
  fallbackDays: number;
}): DefaultValidity {
  if (input.evaluationTargetDate === null) {
    return {
      days: input.fallbackDays,
      reason: "Échéance HAS inconnue : durée par défaut des réglages de facturation.",
    };
  }
  const threshold = new Date(input.now);
  threshold.setMonth(threshold.getMonth() + NEAR_EVALUATION_MONTHS);
  if (input.evaluationTargetDate < threshold) {
    return {
      days: SHORT_VALIDITY_DAYS,
      reason: `Évaluation HAS à moins de ${NEAR_EVALUATION_MONTHS} mois : ${SHORT_VALIDITY_DAYS} jours.`,
    };
  }
  return {
    days: LONG_VALIDITY_DAYS,
    reason: `Évaluation HAS à ${NEAR_EVALUATION_MONTHS} mois ou plus : ${LONG_VALIDITY_DAYS} jours.`,
  };
}
