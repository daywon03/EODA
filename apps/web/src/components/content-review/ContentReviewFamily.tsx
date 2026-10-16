import { ChevronRight, CircleDashed } from "lucide-react";
import { countReviewItems, type ReviewFamily, type ReviewGroup, type ReviewItem } from "@/lib/services/content-review-service";

// Une famille de contenus à valider (quiz, pratiques, enquête…). Chaque groupe est un
// <details> natif : il s'ouvre sans JavaScript, au clavier, et les lecteurs d'écran
// en connaissent l'état. Le statut est écrit en toutes lettres sur chaque élément,
// jamais porté par la seule couleur.

export function ReviewStatusTag({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ambre/60 bg-ambre/15 px-2.5 py-0.5 text-sm font-semibold text-ink">
      <CircleDashed className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      {status}
    </span>
  );
}

function ItemCard({ item, status }: { item: ReviewItem; status: string }) {
  return (
    <li className="flex flex-col gap-3 border-t border-line py-4 first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="max-w-[70ch] font-semibold text-ink [text-wrap:pretty]">{item.title}</h4>
        <ReviewStatusTag status={status} />
      </div>
      {item.fields.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
          {item.fields.map((field) => (
            <div key={field.label} className="contents">
              <dt className="text-sm font-semibold text-ink2">{field.label}</dt>
              <dd className="max-w-[75ch] whitespace-pre-line break-words text-ink">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

function GroupDetails({ group, status }: { group: ReviewGroup; status: string }) {
  return (
    <details className="group rounded-xl border border-line bg-card">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3 hover:bg-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text">
        <ChevronRight
          className="h-4 w-4 flex-shrink-0 text-ink2 transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none"
          aria-hidden="true"
        />
        <h3 className="font-bold text-ink">{group.title}</h3>
        <span className="text-sm tabular-nums text-ink2">
          {group.version} · {group.items.length} élément{group.items.length > 1 ? "s" : ""}
        </span>
      </summary>
      <div className="border-t border-line px-4 pb-2 pt-3">
        <p className="mb-2 max-w-[75ch] whitespace-pre-line text-sm text-ink2">{group.provenance}</p>
        <ul aria-label={`Éléments — ${group.title}`}>
          {group.items.map((item) => (
            <ItemCard key={item.id} item={item} status={status} />
          ))}
        </ul>
      </div>
    </details>
  );
}

export function ContentReviewFamily({ family, status }: { family: ReviewFamily; status: string }) {
  const count = countReviewItems(family);
  return (
    <section id={`famille-${family.id.toLowerCase()}`} aria-labelledby={`titre-${family.id}`} className="flex scroll-mt-24 flex-col gap-3">
      <div>
        <h2 id={`titre-${family.id}`} className="text-xl font-bold text-ink [text-wrap:balance]">
          {family.title}
        </h2>
        <p className="mt-1 max-w-[70ch] text-ink2">
          {family.description} {count} élément{count > 1 ? "s" : ""}.
        </p>
      </div>
      <div className="flex flex-col gap-2.5">
        {family.groups.map((group) => (
          <GroupDetails key={group.id} group={group} status={status} />
        ))}
      </div>
    </section>
  );
}
