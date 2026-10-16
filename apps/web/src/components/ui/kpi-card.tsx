import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: string;
  icon?: LucideIcon;
  // Ce que le chiffre veut dire, en une ligne. Un indicateur sans définition se fait
  // interpréter de travers une fois, puis plus jamais regardé — « CA signé » cumule-t-il
  // les devis annulés ? La réponse doit être à l'écran, pas dans le code.
  hint?: string;
  // Carte cliquable (accueil cabinet) : un VRAI lien, nommé par le chiffre et le
  // libellé — jamais un `onClick` sur une div.
  href?: string;
};

const CARD_CLASS = "block rounded-xl border border-line bg-card p-5";

// Carte d'indicateur (accueil cabinet, commercial). Libellé et définition en texte
// secondaire `ink2` (≥ 4.5:1), jamais en gris de décor.
export function KpiCard({ label, value, icon: Icon, hint, href }: Props) {
  const content = (
    <>
      <div className="flex items-center gap-4">
        {Icon && (
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-ambre/40 bg-ambre/15">
            <Icon className="h-5 w-5 text-ink2" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          {/* Chiffre d'abord, libellé ensuite : c'est l'ordre dans lequel on lit un
              tableau de bord. `tabular-nums` pour que quatre cartes alignées ne
              dansent pas quand les valeurs changent. */}
          <p className="text-2xl font-bold leading-none text-ink tabular-nums">{value}</p>
          <p className="mt-1 text-sm text-ink2">{label}</p>
        </div>
      </div>
      {hint && <p className="mt-3 border-t border-line pt-2.5 text-sm leading-snug text-ink2">{hint}</p>}
    </>
  );

  if (!href) return <div className={CARD_CLASS}>{content}</div>;
  return (
    <Link href={href} className={`${CARD_CLASS} transition-colors hover:border-accent-text`}>
      {content}
    </Link>
  );
}
