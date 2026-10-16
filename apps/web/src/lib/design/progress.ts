// Pourcentage d'avancement borné et arrondi — une barre ne déborde jamais et
// `aria-valuenow` reste un entier lisible par un lecteur d'écran.
export function clampPercent(value: number, max = 100): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.round(Math.min(100, Math.max(0, (value / max) * 100)));
}
