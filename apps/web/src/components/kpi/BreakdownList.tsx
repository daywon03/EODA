type Entry = { label: string; count: number };
type Props = {
  title: string;
  entries: Entry[];
  // Phrase affichée quand tout est à zéro. Un bloc de barres vides se lit comme une
  // panne (`empty-states`) ; une phrase dit qu'il n'y a rien à voir, pas que ça ne
  // marche pas.
  emptyMessage?: string;
};

export function BreakdownList({ title, entries, emptyMessage }: Props) {
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  const max = Math.max(1, ...entries.map((entry) => entry.count));

  return (
    <section className="rounded-xl border border-gris-light bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-brun-ancre">{title}</h3>

      {total === 0 ? (
        <p className="text-xs text-gris-mid">
          {emptyMessage ?? "Aucune donnée pour l'instant."}
        </p>
      ) : (
        <dl className="space-y-2.5">
          {entries.map(({ label, count }) => (
            <div key={label} className="flex items-center gap-3">
              <dt className="w-32 flex-shrink-0 truncate text-xs text-gris-mid" title={label}>
                {label}
              </dt>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ivoire">
                <div
                  className="h-full rounded-full bg-terre transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: count === 0 ? "0%" : `max(4px, ${(count / max) * 100}%)` }}
                />
              </div>
              {/* Nombre ET part : sans le pourcentage, deux blocs de tailles
                  différentes se comparent à l'œil, donc mal. */}
              <dd className="w-16 flex-shrink-0 text-right text-xs text-gris-mid tabular-nums">
                <span className="font-semibold text-brun-ancre">{count}</span>
                <span className="ml-1">{Math.round((count / total) * 100)}%</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
