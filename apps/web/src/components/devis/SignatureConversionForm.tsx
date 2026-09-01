"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { convertDevisToClient } from "@/lib/actions/conversion";
import {
  impliesSeventeenthImperatif,
  SEVENTEENTH_IMPERATIF_WARNING,
} from "@/lib/services/conversion-service";
import { InviteClientForm } from "@/components/etablissement/InviteClientForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowRight, CheckCircle2, FileSignature, Loader2 } from "lucide-react";
import type { EstablishmentType } from "@eoda/database";

type Props = {
  devisId: string;
  structureName: string;
  contactEmail: string | null;
  contactName: string | null;
  // Le prospect a déjà une fiche : la signature complètera son profil au lieu d'en
  // créer une seconde. Le type de SAD n'est alors plus demandé — il est déjà saisi.
  existingEstablishmentId: string | null;
};

const TYPE_CHOICES: { value: EstablishmentType; label: string; hint: string }[] = [
  {
    value: "SAD_AIDE",
    label: "SAD aide",
    hint: "Service d'aide et d'accompagnement à domicile seul.",
  },
  {
    value: "SAD_MIXTE",
    label: "SAD mixte (aide et soins)",
    hint: "Activité d'aide ET de soins — 17 critères impératifs opposables.",
  },
];

export function SignatureConversionForm({
  devisId,
  structureName,
  contactEmail,
  contactName,
  existingEstablishmentId,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    convertDevisToClient.bind(null, devisId),
    null
  );
  const [type, setType] = useState<EstablishmentType | "">("");
  const [inviteSkipped, setInviteSkipped] = useState(false);

  // ── Après la conversion ────────────────────────────────────────────────────
  // L'invitation est PROPOSÉE, jamais imposée : certaines structures n'ouvrent le
  // portail que plusieurs semaines après la signature. Elle réutilise l'action
  // d'invitation existante (mot de passe temporaire + rotation obligatoire), elle
  // ne la réimplémente pas.
  if (state?.ok) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-start gap-3 bg-vert-ok/10 border border-vert-ok/30 rounded-lg p-4">
          <CheckCircle2
            className="w-5 h-5 text-vert-ok flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="text-sm space-y-1">
            <p className="font-semibold text-brun-ancre">
              {state.establishmentCreated
                ? `Fiche client créée : ${state.establishmentName}`
                : `Profil complété : ${state.establishmentName}`}
            </p>
            <p className="text-gris-mid">
              Devis signé, mission créée avec l&apos;offre du devis
              {state.optionCount > 0
                ? ` et ${state.optionCount} option(s) souscrite(s).`
                : ", sans option à la carte."}{" "}
              Le portail client n&apos;affiche que les checklists et les tâches de cette
              offre.
            </p>
          </div>
        </div>

        {!inviteSkipped && (
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-brun-ancre">
                Ouvrir l&apos;accès au portail client
              </h2>
              <p className="text-sm text-gris-mid">
                Facultatif — l&apos;accès peut être créé plus tard depuis la fiche
                établissement.
              </p>
            </div>
            <InviteClientForm
              establishmentId={state.establishmentId}
              defaultEmail={state.contactEmail ?? contactEmail}
              defaultName={state.contactName ?? contactName}
            />
          </div>
        )}

        {/* ÉTAPE CONTRAT (§12.6 — « génération de contrat obligatoire »). Elle vient
            après la conversion et pas avant : le contrat récapitule un périmètre qui
            n'existe qu'une fois la mission créée. Le document s'ouvre dans un onglet
            isolé, comme le devis et l'avenant — sa vue imprimable n'a ni en-tête ni
            navigation. */}
        <div className="space-y-2 pt-3 border-t border-gris-light">
          <div>
            <h2 className="text-base font-semibold text-brun-ancre">
              Éditer le contrat d&apos;accompagnement
            </h2>
            <p className="text-sm text-gris-mid">
              Récapitule le devis signé : parties, périmètre, montants fermes et
              engagements réciproques. À faire signer avec le devis en annexe.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link
              href={`/imprimer/contrat/${state.establishmentId}`}
              target="_blank"
              rel="noreferrer"
            >
              <FileSignature className="w-4 h-4" aria-hidden="true" />
              Ouvrir le contrat
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 pt-3 border-t border-gris-light">
          <Button asChild>
            <Link href={`/dashboard/cabinet/etablissements/${state.establishmentId}`}>
              Ouvrir la fiche client
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </Button>
          {!inviteSkipped && (
            <Button type="button" variant="outline" onClick={() => setInviteSkipped(true)}>
              Créer l&apos;accès plus tard
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Avant la conversion ────────────────────────────────────────────────────
  return (
    <form action={formAction} className="space-y-5">
      {existingEstablishmentId === null ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-brun-ancre mb-2">
            Type de SAD <span className="text-rouge-imp">*</span>
          </legend>
          {/* Non dérivable de la forme juridique du prospect (association / privé /
              public) : ce sont deux dimensions différentes. Deviner ici produirait un
              périmètre de critères faux — donc on demande. */}
          <div className="space-y-2">
            {TYPE_CHOICES.map((choice) => (
              <label
                key={choice.value}
                className="flex items-start gap-3 border border-gris-light rounded-md px-3 py-3 cursor-pointer transition-colors has-[:checked]:border-terre has-[:checked]:bg-terre/5"
              >
                <input
                  type="radio"
                  name="type"
                  value={choice.value}
                  checked={type === choice.value}
                  onChange={() => setType(choice.value)}
                  disabled={isPending}
                  required
                  className="accent-terre mt-1"
                />
                <span>
                  <span className="block font-semibold text-brun-ancre text-sm">
                    {choice.label}
                  </span>
                  <span className="block text-xs text-gris-mid mt-0.5">{choice.hint}</span>
                </span>
              </label>
            ))}
          </div>

          {type !== "" && impliesSeventeenthImperatif(type) && (
            <div
              role="status"
              className="flex items-start gap-2 text-sm text-brun-moyen bg-ambre/15 border border-ambre/30 rounded-md px-3 py-2.5"
            >
              <AlertCircle
                className="w-4 h-4 flex-shrink-0 mt-0.5 text-ambre"
                aria-hidden="true"
              />
              <span>{SEVENTEENTH_IMPERATIF_WARNING}</span>
            </div>
          )}
        </fieldset>
      ) : (
        <p className="text-sm text-gris-mid border-l-4 border-gris-light pl-3">
          Ce prospect a déjà une fiche établissement : la signature ne la recrée pas, elle
          y ajoute la mission portant l&apos;offre signée.
        </p>
      )}

      {existingEstablishmentId === null && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="finessNumber">
                Numéro FINESS <span className="text-rouge-imp">*</span>
              </Label>
              <Input
                id="finessNumber"
                name="finessNumber"
                inputMode="numeric"
                placeholder="9 chiffres"
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hasEvaluationTargetDate">
                Échéance évaluation HAS <span className="text-rouge-imp">*</span>
              </Label>
              <Input
                id="hasEvaluationTargetDate"
                name="hasEvaluationTargetDate"
                type="date"
                required
                disabled={isPending}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">
              Adresse <span className="text-rouge-imp">*</span>
            </Label>
            <Input id="address" name="address" required disabled={isPending} />
          </div>
          <p className="text-xs text-gris-mid">
            C&apos;est le moment où ces informations sont connues : la fiche client part
            ensuite dans les livrables HAS, elle ne se crée plus à vide ailleurs. Le nom
            reprend celui du prospect ({structureName}) et le statut juridique est repris
            de sa qualification — rien à ressaisir.
          </p>
        </div>
      )}

      {state?.ok === false && (
        <div
          role="alert"
          className="flex items-center gap-2 text-rouge-imp text-sm bg-rouge-imp/10 border border-rouge-imp/20 rounded-md px-3 py-2.5"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="flex gap-3 pt-2 border-t border-gris-light">
        <Button type="submit" disabled={isPending} className="mt-4">
          {isPending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Enregistrer la signature
        </Button>
        <Button type="button" variant="outline" asChild className="mt-4">
          <Link href={`/dashboard/cabinet/commercial/devis/${devisId}`}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
