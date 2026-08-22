import type { LucideIcon } from "lucide-react";

type Props = { label: string; value: string; icon: LucideIcon };

export function KpiCard({ label, value, icon: Icon }: Props) {
  return (
    <div className="bg-white border border-gris-light rounded-xl p-5 flex items-center gap-4">
      <span className="flex items-center justify-center w-11 h-11 rounded-lg bg-ambre/15 flex-shrink-0">
        <Icon className="w-5 h-5 text-ambre" aria-hidden="true" />
      </span>
      <div>
        <p className="text-2xl font-bold text-brun-ancre leading-none tabular-nums">{value}</p>
        <p className="text-xs text-gris-mid mt-1">{label}</p>
      </div>
    </div>
  );
}
