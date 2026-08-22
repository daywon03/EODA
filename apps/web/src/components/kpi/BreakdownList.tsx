type Props = { title: string; entries: { label: string; count: number }[] };

export function BreakdownList({ title, entries }: Props) {
  const max = Math.max(1, ...entries.map((e) => e.count));

  return (
    <div className="bg-white border border-gris-light rounded-xl p-5">
      <h3 className="text-sm font-semibold text-brun-ancre mb-3">{title}</h3>
      <div className="space-y-2.5">
        {entries.map(({ label, count }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="text-xs text-gris-mid w-32 flex-shrink-0 truncate">{label}</span>
            <div className="flex-1 h-2 bg-ivoire rounded-full overflow-hidden">
              <div
                className="h-full bg-terre rounded-full"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-brun-ancre w-6 text-right tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
