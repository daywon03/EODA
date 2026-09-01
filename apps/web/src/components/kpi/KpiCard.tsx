import type { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: string;
  icon: LucideIcon;
  // Ce que le chiffre veut dire, en une ligne. Un indicateur sans définition se fait
  // interpréter de travers une fois, puis plus jamais regardé — « CA signé » cumule-t-il
  // les devis annulés ? La réponse doit être à l'écran, pas dans le code.
  hint?: string;
};

export function KpiCard({ label, value, icon: Icon, hint }: Props) {
  return (
    <div className="rounded-xl border border-gris-light bg-white p-5">
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-ambre/15">
          <Icon className="h-5 w-5 text-ambre" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          {/* Chiffre d'abord, libellé ensuite : c'est l'ordre dans lequel on lit un
              tableau de bord. `tabular-nums` pour que quatre cartes alignées ne
              dansent pas quand les valeurs changent. */}
          <p className="text-2xl font-bold leading-none text-brun-ancre tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-gris-mid">{label}</p>
        </div>
      </div>
      {hint && <p className="mt-3 border-t border-gris-light pt-2.5 text-[11px] leading-snug text-gris-mid">{hint}</p>}
    </div>
  );
}
