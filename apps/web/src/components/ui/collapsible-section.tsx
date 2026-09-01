import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  title: string;
  // Ce que la section contient, résumé en un mot ou deux : « 3 rendez-vous »,
  // « aucun échange ». Sans lui, replier une section revient à cacher une inconnue —
  // on la rouvre à chaque passage pour vérifier qu'elle est bien vide.
  summary?: string;
  // Repliée par défaut pour les sections consultées de temps en temps ; ouverte pour
  // celles qu'on vient lire.
  defaultOpen?: boolean;
  children: ReactNode;
};

// Section repliable — « une petite flèche qui permet de réduire cette partie-là »
// (call du 01/09). La fiche prospect empile étape suivante, coordonnées, devis,
// rendez-vous et historique : sur un portable, la moitié se lit en faisant défiler,
// et le reproche récurrent de la séance était « je suis un peu perdue sur les pages ».
//
// `<details>` natif plutôt qu'un état React : la section s'ouvre et se ferme sans une
// ligne de JavaScript, donc avant même l'hydratation, et le clavier ainsi que les
// lecteurs d'écran la connaissent déjà. Un composant client n'apporterait ici qu'une
// dépendance de plus et un état à synchroniser.
export function CollapsibleSection({ title, summary, defaultOpen = false, children }: Props) {
  return (
    <details className="group space-y-3" open={defaultOpen}>
      <summary
        className={[
          "flex cursor-pointer list-none items-center gap-2 rounded",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre focus-visible:ring-offset-2",
        ].join(" ")}
      >
        {/* La flèche pivote à l'ouverture. `aria-hidden` : l'état replié/déplié est
            déjà porté par <details>, le redire à voix haute serait du bruit. */}
        <ChevronRight
          className="h-4 w-4 flex-shrink-0 text-gris-mid transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none"
          aria-hidden="true"
        />
        <h2 className="text-base font-semibold text-brun-ancre">{title}</h2>
        {summary && <span className="text-xs text-gris-mid">· {summary}</span>}
      </summary>

      <Card>
        <CardContent className="space-y-5 pt-6">{children}</CardContent>
      </Card>
    </details>
  );
}
