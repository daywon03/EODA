"use client";

import { useActionState, useState } from "react";
import { upsertCatalogueOption } from "@/lib/actions/catalogue";
import { formatStartingPrice } from "@/lib/services/price-format-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import type { CatalogueOption, PricingUnit } from "@eoda/database";

// Import de **type** uniquement : `import { PricingUnit }` (valeur) tire
// `@eoda/database` — donc `new PrismaClient()` et le runtime Prisma — dans le
// bundle navigateur de cette page cliente (mesuré : +53 ko). Le type suffit ; la
// clé de `Record<PricingUnit, string>` garantit à la compilation qu'une unité
// ajoutée au schéma doit être libellée ici (Open/Closed conservé).
const UNIT_LABELS: Record<PricingUnit, string> = {
  FORFAIT: "Forfait",
  HEURE: "Par heure",
  JOUR: "Par jour",
  DOCUMENT: "Par document",
  SUPPORT: "Par support",
  MOIS: "Par mois (abonnement)",
};

// Sans `option`, le formulaire crée une nouvelle prestation à la carte.
// Avec `option`, il modifie libellé/prix/unité d'une prestation existante (code figé).
export function CatalogueOptionForm({ option }: { option?: CatalogueOption }) {
  const [state, formAction, isPending] = useActionState(upsertCatalogueOption, null);
  const isEdit = !!option;

  // État local uniquement pour l'aperçu « À partir de … » : ce que le client lira
  // sur son devis, visible pendant la saisie (règle §12.3 — jamais un prix fixe).
  const [priceEuros, setPriceEuros] = useState(option?.priceEuros ?? 0);
  const [pricingUnit, setPricingUnit] = useState<PricingUnit>(option?.pricingUnit ?? "FORFAIT");
  const [priceMaxEuros, setPriceMaxEuros] = useState(option?.priceMaxEuros ?? null);
  const [minQuantity, setMinQuantity] = useState(option?.minQuantity ?? null);

  const id = option?.id ?? "new";

  return (
    <form action={formAction} className="space-y-2 border border-gris-light rounded-xl p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`code-${id}`}>Code</Label>
          <Input
            id={`code-${id}`}
            name="code"
            defaultValue={option?.code}
            disabled={isPending || isEdit}
            required
            className="w-40"
            placeholder="ex : ATELIER_SUPP"
          />
        </div>
        <div className="space-y-1 flex-1 min-w-[180px]">
          <Label htmlFor={`label-${id}`}>Libellé</Label>
          <Input id={`label-${id}`} name="label" defaultValue={option?.label} disabled={isPending} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`price-${id}`}>Prix (€)</Label>
          <Input
            id={`price-${id}`}
            name="priceEuros"
            type="number"
            min={0}
            value={priceEuros}
            onChange={(e) => setPriceEuros(Number(e.target.value))}
            disabled={isPending}
            required
            className="w-32"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`unit-${id}`}>Unité</Label>
          <Select
            id={`unit-${id}`}
            name="pricingUnit"
            value={pricingUnit}
            onChange={(e) => setPricingUnit(e.target.value as PricingUnit)}
            disabled={isPending}
            className="w-48"
          >
            {(Object.keys(UNIT_LABELS) as PricingUnit[]).map((unit) => (
              <option key={unit} value={unit}>
                {UNIT_LABELS[unit]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`price-max-${id}`}>Prix max. (€)</Label>
          <Input
            id={`price-max-${id}`}
            name="priceMaxEuros"
            type="number"
            min={0}
            value={priceMaxEuros ?? ""}
            onChange={(e) => setPriceMaxEuros(e.target.value === "" ? null : Number(e.target.value))}
            disabled={isPending}
            className="w-28"
            placeholder="fourchette"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`min-qty-${id}`}>Quantité min.</Label>
          <Input
            id={`min-qty-${id}`}
            name="minQuantity"
            type="number"
            min={1}
            max={999}
            value={minQuantity ?? ""}
            onChange={(e) => setMinQuantity(e.target.value === "" ? null : Number(e.target.value))}
            disabled={isPending || pricingUnit === "FORFAIT"}
            className="w-28"
            placeholder="ex : 2"
          />
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            !isEdit && <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          {isEdit ? "Enregistrer" : "Ajouter"}
        </Button>
      </div>

      <p className="text-xs text-gris-mid">
        Affiché au client : <span className="text-brun-ancre">{formatStartingPrice({ priceEuros, pricingUnit, priceMaxEuros, minQuantity })}</span>
      </p>

      {state?.error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp w-full">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
    </form>
  );
}
