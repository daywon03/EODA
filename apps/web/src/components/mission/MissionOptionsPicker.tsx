import { Label } from "@/components/ui/label";
import type { CatalogueOption } from "@eoda/database";
import { formatStartingPrice } from "@/lib/services/price-format-service";
import { Lock } from "lucide-react";

// Options déjà rattachées au périmètre, telles que renvoyées par getMission().
type SubscribedRow = { catalogueOptionId: string; priceIsFirm: boolean };

type Props = {
  options: CatalogueOption[];
  // Vide à la création d'une mission.
  subscribed?: SubscribedRow[];
  disabled?: boolean;
};

// Choix des prestations à la carte rattachées au périmètre d'une mission.
//
// Les prix affichés sont ceux du CATALOGUE, donc des « à partir de » — rendus via
// formatStartingPrice() et jamais autrement (CLAUDE.md §7). Cocher une option ici ne
// crée aucun devis et n'engage aucun montant ferme : ça ouvre le périmètre côté
// portail client, c'est tout. Le libellé de la section le dit explicitement, pour que
// personne ne prenne cet écran pour un acte de vente.
export function MissionOptionsPicker({ options, subscribed = [], disabled }: Props) {
  const subscribedById = new Map(subscribed.map((row) => [row.catalogueOptionId, row]));

  if (options.length === 0) {
    return (
      <p className="text-sm text-gris-mid">
        Aucune prestation à la carte n&apos;est active au catalogue.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Prestations à la carte</Label>
      <p className="text-xs text-gris-mid">
        Ouvre le périmètre côté client. Les prix sont indicatifs — seul un devis signé fige un
        montant.
      </p>

      <div className="space-y-2">
        {options.map((option) => {
          const row = subscribedById.get(option.id);
          // Une option issue d'un devis SIGNÉ ne se décoche pas ici : la retirer
          // fermerait un accès payé, sans trace côté commercial. L'action serveur
          // refuse de toute façon — la case verrouillée n'est que le reflet visible
          // de cette règle, jamais sa seule application.
          const locked = row?.priceIsFirm === true;

          return (
            <label
              key={option.id}
              className={`flex items-center justify-between gap-3 border border-gris-light rounded-md px-3 py-2.5 text-sm has-[:checked]:border-terre has-[:checked]:bg-terre/5 ${
                locked ? "cursor-not-allowed opacity-90" : "cursor-pointer"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="optionIds"
                  value={option.id}
                  defaultChecked={row !== undefined}
                  disabled={disabled || locked}
                  className="accent-terre"
                />
                {option.label}
                {locked && (
                  <span className="inline-flex items-center gap-1 text-xs text-gris-mid">
                    <Lock className="w-3 h-3" aria-hidden="true" />
                    au devis signé
                  </span>
                )}
              </span>
              <span className="text-gris-mid tabular-nums whitespace-nowrap">
                {formatStartingPrice(option)}
              </span>
            </label>
          );
        })}
      </div>

      {/* Une case `disabled` n'est pas soumise : sans ce champ, une option verrouillée
          disparaîtrait du périmètre au premier enregistrement du formulaire. */}
      {subscribed
        .filter((row) => row.priceIsFirm)
        .map((row) => (
          <input
            key={row.catalogueOptionId}
            type="hidden"
            name="optionIds"
            value={row.catalogueOptionId}
          />
        ))}
    </div>
  );
}
