"use client";

import { useActionState } from "react";
import { createEstablishment } from "@/lib/actions/establishment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";

export function EstablishmentForm() {
  const [state, action, isPending] = useActionState(createEstablishment, null);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">
          Raison sociale <span className="text-rouge-imp">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          placeholder="ex : Association ASSAD BENOIT"
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
            maxLength={9}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type">
            Type SAD <span className="text-rouge-imp">*</span>
          </Label>
          <Select id="type" name="type" required disabled={isPending}>
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
          disabled={isPending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hasEvaluationTargetDate">Date cible de l'évaluation HAS</Label>
        <Input
          id="hasEvaluationTargetDate"
          name="hasEvaluationTargetDate"
          type="month"
          disabled={isPending}
        />
        <p className="text-xs text-gris-mid">
          Permet de prioriser les établissements selon l'urgence dans le tableau de bord.
        </p>
      </div>

      {state?.error && (
        <div className="flex items-center gap-2 text-rouge-imp text-sm bg-rouge-imp/10 rounded-md px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Créer l'établissement
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/cabinet">Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
