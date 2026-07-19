"use client";

import { useActionState } from "react";
import { createEstablishment, updateEstablishment } from "@/lib/actions/establishment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import type { EstablishmentType } from "@eoda/database";

type EstablishmentInitialValues = {
  id: string;
  name: string;
  finessNumber: string | null;
  type: EstablishmentType;
  address: string | null;
  hasEvaluationTargetDate: Date | null;
};

type Props = { establishment?: EstablishmentInitialValues };

function toMonthInputValue(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function EstablishmentForm({ establishment }: Props) {
  const isEdit = !!establishment;
  const action = isEdit ? updateEstablishment.bind(null, establishment.id) : createEstablishment;
  const [state, formAction, isPending] = useActionState(action, null);
  const cancelHref = isEdit
    ? `/dashboard/cabinet/etablissements/${establishment.id}`
    : "/dashboard/cabinet";

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
          defaultValue={establishment?.name}
          required
          autoFocus
          disabled={isPending}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="finessNumber">Numéro FINESS</Label>
          <Input
            id="finessNumber"
            name="finessNumber"
            placeholder="ex : 930034459"
            defaultValue={establishment?.finessNumber ?? undefined}
            maxLength={9}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type">
            Type SAD <span className="text-rouge-imp">*</span>
          </Label>
          <Select id="type" name="type" required disabled={isPending} defaultValue={establishment?.type ?? ""}>
            <option value="">— Sélectionner —</option>
            <option value="SAD_AIDE">SAD Aide (aide à domicile uniquement)</option>
            <option value="SAD_MIXTE">SAD Mixte (aide + soins)</option>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Adresse</Label>
        <Input
          id="address"
          name="address"
          placeholder="ex : 12 rue de la Paix, 93150 Le Blanc-Mesnil"
          defaultValue={establishment?.address ?? undefined}
          disabled={isPending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hasEvaluationTargetDate">Date cible de l'évaluation HAS</Label>
        <Input
          id="hasEvaluationTargetDate"
          name="hasEvaluationTargetDate"
          type="month"
          defaultValue={toMonthInputValue(establishment?.hasEvaluationTargetDate ?? null)}
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
          {isEdit ? "Enregistrer les modifications" : "Créer l'établissement"}
        </Button>
        <Button type="button" variant="outline" asChild className="mt-6">
          <Link href={cancelHref}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
