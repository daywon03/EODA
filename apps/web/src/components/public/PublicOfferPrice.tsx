import { formatEuros } from "@/lib/services/price-format-service";

// Prix d'une offre côté public : « à partir de 120 € / mois », ou « xx € » tant que
// le prix n'est pas fixé au catalogue (décision 11 du plan v2 — aucun montant inventé).
export function PublicOfferPrice({ monthlyEuros, className }: { monthlyEuros: number | null; className?: string }) {
  return (
    <span className={className}>
      <span className="text-ink2">à partir de </span>
      <span className="font-bold tabular-nums">{monthlyEuros === null ? "xx €" : formatEuros(monthlyEuros)} / mois</span>
    </span>
  );
}
