"use client";

import { useActionState } from "react";
import { updateEstablishment } from "@/lib/actions/establishment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import type { EstablishmentType, StructureType } from "@eoda/database";

type EstablishmentInitialValues = {
  id: string;
  name: string;
  finessNumber: string | null;
  type: EstablishmentType;
  structureType: StructureType | null;
  address: string | null;
  hasEvaluationTargetDate: Date | null;
};

// Édition SEULEMENT. Il n'existe plus de mode création : une fiche client naît de la
// signature d'un devis (cf. lib/actions/establishment.ts). `establishment` n'est donc
// plus optionnel — le typage interdit d'appeler ce formulaire à vide.
type Props = { establishment: EstablishmentInitialValues };

// Les valeurs nulles viennent des fiches antérieures à ces champs obligatoires. On ne
// les remplace par aucun défaut : une valeur inventée serait indiscernable d'une
// saisie réelle. Le champ reste vide, `required` le signale.
function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function EstablishmentForm({ establishment }: Props) {
  const action = updateEstablishment.bind(null, establishment.id);
  const [state, formAction, isPending] = useActionState(action, null);
  const cancelHref = `/dashboard/cabinet/etablissements/${establishment.id}`;

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">
          Raison sociale <span className="text-rouge-imp">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          placeholder="ex : Association ASSAD BENOIT"
          defaultValue={establishment.name}
          required
          autoFocus
          disabled={isPending}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="finessNumber">
            Numéro FINESS <span className="text-rouge-imp">*</span>
          </Label>
          <Input
            id="finessNumber"
            name="finessNumber"
            placeholder="ex : 930034459"
            defaultValue={establishment.finessNumber ?? undefined}
            maxLength={9}
            required
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type">
            Type SAD <span className="text-rouge-imp">*</span>
          </Label>
          <Select id="type" name="type" required disabled={isPending} defaultValue={establishment.type ?? ""}>
            <option value="">— Sélectionner —</option>
            <option value="SAD_AIDE">SAD Aide (aide à domicile uniquement)</option>
            <option value="SAD_MIXTE">SAD Mixte (aide + soins)</option>
          </Select>
        </div>
      </div>

      {/* Statut juridique — axe SÉPARÉ du type SAD ci-dessus, et non une valeur de
          plus dans la même liste. Une association loi 1901 peut être SAD Aide ou SAD
          Mixte ; les fusionner rendrait la moitié des combinaisons inexprimables. */}
      <div className="space-y-1.5">
        <Label htmlFor="structureType">
          Statut juridique <span className="text-rouge-imp">*</span>
        </Label>
        <Select
          id="structureType"
          name="structureType"
          required
          disabled={isPending}
          defaultValue={establishment.structureType ?? ""}
        >
          <option value="">— Sélectionner —</option>
          <option value="ASSOCIATION">Association loi 1901</option>
          <option value="PUBLIC">CCAS / CIAS (organisme public)</option>
          <option value="PRIVE">Secteur privé</option>
        </Select>
        <p className="text-xs text-gris-mid">
          Indépendant du type SAD : une association peut être Aide ou Mixte.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">
          Adresse <span className="text-rouge-imp">*</span>
        </Label>
        <Input
          id="address"
          name="address"
          placeholder="ex : 12 rue de la Paix, 93150 Le Blanc-Mesnil"
          defaultValue={establishment.address ?? undefined}
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hasEvaluationTargetDate">
          Date cible de l&apos;évaluation HAS <span className="text-rouge-imp">*</span>
        </Label>
        <Input
          id="hasEvaluationTargetDate"
          name="hasEvaluationTargetDate"
          type="date"
          defaultValue={toDateInputValue(establishment.hasEvaluationTargetDate ?? null)}
          required
          disabled={isPending}
        />
        <p className="text-xs text-gris-mid">
          Permet de prioriser les établissements selon l'urgence dans le tableau de bord.
        </p>
      </div>

      {state?.error && (
        <div
          role="alert"
          className="flex items-center gap-2 text-rouge-imp text-sm bg-rouge-imp/10 border border-rouge-imp/20 rounded-md px-3 py-2.5"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="flex gap-3 pt-2 border-t border-gris-light mt-6">
        <Button type="submit" disabled={isPending} className="mt-6">
          {isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Enregistrer les modifications
        </Button>
        <Button type="button" variant="outline" asChild className="mt-6">
          <Link href={cancelHref}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
