"use client";

import { tariffCellTexts, type RecapTariffs } from "@/lib/services/recap-contract-word-service";
import type { AdmissionAid } from "@/lib/services/admission-service";
import { TABLET_INPUT } from "../tablet-ui";

const LABEL = "flex flex-col gap-1.5 text-[18px] font-bold";

// Le tableau des tarifs du contrat récapitulatif envoyé au Département (30/10/2026) :
// les heures viennent de l'aide saisie au-dessus, seuls les tarifs horaires (hors prise
// en charge) se tapent ici. Vides, les cases restent à remplir à la main.
export function RecapTariffSection({ tariffs, onTariffs, aid }: { tariffs: RecapTariffs; onTariffs: (next: RecapTariffs) => void; aid: AdmissionAid }) {
  const total = tariffCellTexts(tariffs, aid.weekdayHours, aid.sundayHours)[4];
  return (
    <section aria-labelledby="projet-tarifs" className="flex flex-col gap-2.5">
      <h2 id="projet-tarifs" className="text-[24px] font-bold">Tarifs (contrat pour le Département)</h2>
      <p className="text-[18px] text-ink2">Tarif horaire en cas de non prise en charge, en euros. Les heures sont celles de l&apos;aide, plus haut.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={LABEL}>
          Tarif horaire en semaine
          <input value={tariffs.weekdayRate} onChange={(e) => onTariffs({ ...tariffs, weekdayRate: e.target.value })} className={TABLET_INPUT} inputMode="decimal" maxLength={10} />
        </label>
        <label className={LABEL}>
          Tarif horaire le dimanche et les jours fériés
          <input value={tariffs.sundayRate} onChange={(e) => onTariffs({ ...tariffs, sundayRate: e.target.value })} className={TABLET_INPUT} inputMode="decimal" maxLength={10} />
        </label>
      </div>
      {total && <p className="text-[19px]">Total mensuel écrit dans le contrat : <span className="font-bold">{total}</span></p>}
    </section>
  );
}
