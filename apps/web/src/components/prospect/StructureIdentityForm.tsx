"use client";

import { useActionState } from "react";
import type { EstablishmentType, StructureType } from "@eoda/database";
import { updateProspectIdentity } from "@/lib/actions/prospect";
import {
  ESTABLISHMENT_TYPE_LABELS,
  STRUCTURE_TYPE_LABELS,
} from "@/lib/services/structure-identity-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

type Props = {
  prospectId: string;
  structureType: StructureType;
  finessNumber: string | null;
  siretNumber: string | null;
  address: string | null;
  establishmentType: EstablishmentType | null;
  hasEvaluationTargetDate: Date | null;
};

// Identité administrative de la structure, saisissable PENDANT la réunion de
// découverte — sur le même écran que la grille d'entretien.
//
// « J'aimerais bien pouvoir le rentrer soit au début, soit au milieu, à n'importe
// quel moment, le FINESS. En fait : FINESS, SIRET, structure juridique » (call du
// 01/09). Ces trois informations arrivent au fil de l'appel, pas dans l'ordre du
// formulaire de création — et renvoyer la consultante vers l'écran « Modifier » au
// milieu d'un appel lui ferait perdre les réponses de grille non enregistrées.
//
// S'y ajoutent le type de SAD et l'échéance HAS, que la grille v03 demande aussi en
// découverte (§1 et §3). Ils sont ICI et pas dans la grille parce qu'ils ont une
// COLONNE : les stocker en réponses de grille en ferait une seconde source, alors que
// c'est la colonne qui alimente le devis, le périmètre de critères et les indicateurs.
//
// Formulaire volontairement PARTIEL, et distinct de `ProspectForm` : il ne poste que
// ces six champs, et l'action serveur n'écrit que ceux-là. Réunir les deux
// formulaires ferait poster des champs absents de cet écran — donc les effacerait.
export function StructureIdentityForm({
  prospectId,
  structureType,
  finessNumber,
  siretNumber,
  address,
  establishmentType,
  hasEvaluationTargetDate,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    updateProspectIdentity.bind(null, prospectId),
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="identity-structureType">
            Statut juridique <span className="text-rouge-imp">*</span>
          </Label>
          <Select
            id="identity-structureType"
            name="structureType"
            defaultValue={structureType}
            required
            disabled={isPending}
          >
            <option value="ASSOCIATION">{STRUCTURE_TYPE_LABELS.ASSOCIATION}</option>
            <option value="PRIVE">{STRUCTURE_TYPE_LABELS.PRIVE}</option>
            <option value="PUBLIC">{STRUCTURE_TYPE_LABELS.PUBLIC}</option>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="identity-address">Adresse</Label>
          <Input
            id="identity-address"
            name="address"
            defaultValue={address ?? undefined}
            maxLength={300}
            disabled={isPending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="identity-finessNumber">Numéro FINESS</Label>
          <Input
            id="identity-finessNumber"
            name="finessNumber"
            inputMode="numeric"
            placeholder="9 chiffres — ex : 930034459"
            defaultValue={finessNumber ?? undefined}
            maxLength={20}
            disabled={isPending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="identity-siretNumber">Numéro SIRET</Label>
          <Input
            id="identity-siretNumber"
            name="siretNumber"
            inputMode="numeric"
            placeholder="14 chiffres — ex : 80234120900016"
            defaultValue={siretNumber ?? undefined}
            maxLength={20}
            disabled={isPending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="identity-establishmentType">Type de SAD</Label>
          <Select
            id="identity-establishmentType"
            name="establishmentType"
            defaultValue={establishmentType ?? ""}
            disabled={isPending}
          >
            <option value="">— À confirmer —</option>
            <option value="SAD_AIDE">{ESTABLISHMENT_TYPE_LABELS.SAD_AIDE}</option>
            <option value="SAD_MIXTE">{ESTABLISHMENT_TYPE_LABELS.SAD_MIXTE}</option>
          </Select>
          {/* Le périmètre de critères en dépend : un SAD mixte porte un impératif de
              plus (circuit du médicament). D'où sa place dès la découverte. */}
          <p className="text-xs text-gris-mid">
            Détermine le périmètre de critères évalués.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="identity-hasEvaluationTargetDate">Échéance d&apos;évaluation HAS</Label>
          <Input
            id="identity-hasEvaluationTargetDate"
            name="hasEvaluationTargetDate"
            type="date"
            defaultValue={
              hasEvaluationTargetDate
                ? new Date(hasEvaluationTargetDate).toISOString().slice(0, 10)
                : undefined
            }
            disabled={isPending}
          />
          <p className="text-xs text-gris-mid">
            Au jour près quand elle est connue : une évaluation au 27 janvier ne laisse
            pas le même temps qu&apos;une évaluation au 1<sup>er</sup>.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Enregistrer l&apos;identité
        </Button>
        {/* Confirmation explicite : sans elle, un enregistrement réussi en plein appel
            ne se distingue pas d'un clic qui n'a rien fait. */}
        {state && "ok" in state && !isPending && (
          <p className="flex items-center gap-1.5 text-xs text-vert-ok">
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            Identité enregistrée.
          </p>
        )}
      </div>

      {state && "error" in state && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp">
          <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
    </form>
  );
}
