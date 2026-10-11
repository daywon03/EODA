"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import type { CommercialTier } from "@eoda/database";
import { createDevis, updateDevis } from "@/lib/actions/devis";
import { computeDevisAmounts, optionCommittedAmountEuros } from "@/lib/services/devis-calculation-service";
import { describeSubscriptionDiscount, optionUnitPriceForFormule } from "@/lib/services/subscription-service";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ConditionsFields,
  FormSection,
  OfferPicker,
  OptionPicker,
  type CatalogueOptionItem,
  type FormuleOption,
} from "./DevisFormSections";
import { DevisRecap, type RecapLine } from "./DevisRecap";

// Valeurs d'un devis existant à corriger. Absentes = création.
// Seul un BROUILLON arrive ici : la route de modification refuse les autres, et
// `updateDevis` le revérifie côté serveur.
type DevisDraft = {
  id: string;
  formule: CommercialTier | null;
  optionIds: string[];
  depositPercent: number;
  installmentCount: number;
  validityDays: number;
};

// Deux usages du MÊME formulaire, jamais deux formulaires (D1) :
//   - "devis"      : création ou correction depuis la fiche prospect ;
//   - "assessment" : la réunion d'évaluation des besoins, en direct pendant l'appel
//     (contenu de chaque offre visible, notes de l'appel saisies au même endroit).
// Mise en page v2 (10/10/2026) : des cartes et un récapitulatif collant. La logique
// de montants (devis-calculation-service, subscription-service) est INCHANGÉE.
type Variant = "devis" | "assessment";

type Props = {
  prospectId: string;
  formules: FormuleOption[];
  options: CatalogueOptionItem[];
  defaultDepositPercent: number;
  defaultValidityDays: number;
  // Pourquoi cette validité est proposée (devis-validity-service) — création seulement.
  validityHint?: string;
  structureName?: string;
  draft?: DevisDraft;
  variant?: Variant;
  defaultNeedsAssessmentNotes?: string | null;
  // Lignes du brouillon qui ne sont plus au catalogue : affichées explicitement,
  // elles disparaîtront à l'enregistrement.
  retiredLines?: string[];
};

export function DevisForm({
  prospectId,
  formules,
  options,
  defaultDepositPercent,
  defaultValidityDays,
  validityHint,
  structureName,
  draft,
  variant = "devis",
  defaultNeedsAssessmentNotes,
  retiredLines = [],
}: Props) {
  // `updateDevis` prend l'identifiant en premier argument : lié ici plutôt que posté
  // en champ caché — un identifiant lié n'est pas réécrivable depuis le navigateur.
  const [state, formAction, isPending] = useActionState(
    draft ? updateDevis.bind(null, draft.id) : createDevis,
    null
  );
  const isAssessment = variant === "assessment";
  // Repli sur la première formule active si celle du brouillon a été retirée du
  // catalogue entre-temps.
  const draftFormuleStillSellable = draft !== undefined && formules.some((f) => f.formule === draft.formule);
  const [formule, setFormule] = useState<CommercialTier | "">(
    draft?.formule === null
      ? ""
      : (draftFormuleStillSellable ? draft?.formule : undefined) ?? formules[0]?.formule ?? ""
  );
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(
    (draft?.optionIds ?? []).filter((id) => options.some((o) => o.id === id))
  );
  const [depositPercent, setDepositPercent] = useState(draft?.depositPercent ?? defaultDepositPercent);
  const [installmentCount, setInstallmentCount] = useState(draft?.installmentCount ?? 1);

  const { lines, amounts } = useMemo(() => {
    const chosen = formules.find((f) => f.formule === formule);
    // Une option tarifée à l'heure ou au mois entre au devis pour son engagement
    // minimal, avec la même dégressivité que le serveur — mêmes fonctions (§12.2).
    const optionLines: RecapLine[] = options
      .filter((o) => selectedOptionIds.includes(o.id))
      .map((o) => ({
        id: o.id,
        label: o.label,
        amountEuros: optionCommittedAmountEuros({
          priceEuros: optionUnitPriceForFormule(o, formule === "" ? null : formule),
          minQuantity: o.minQuantity,
        }),
      }));
    return {
      lines: [...(chosen ? [{ id: chosen.formule, label: chosen.label, amountEuros: chosen.priceEuros }] : []), ...optionLines],
      amounts: computeDevisAmounts({
        formulePriceEuros: chosen?.priceEuros ?? 0,
        optionPricesEuros: optionLines.map((l) => l.amountEuros),
        depositPercent,
        installmentCount,
      }),
    };
  }, [formule, selectedOptionIds, depositPercent, installmentCount, formules, options]);

  const subscriptionNotice = describeSubscriptionDiscount(formule === "" ? null : formule);

  function toggleOption(id: string) {
    setSelectedOptionIds((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]));
  }

  return (
    <form action={formAction} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <input type="hidden" name="prospectId" value={prospectId} />

      <div className="space-y-6">
        <FormSection title="Offre">
          <OfferPicker formules={formules} value={formule} onChange={setFormule} disabled={isPending} />
        </FormSection>

        <FormSection title="Prestations à la carte">
          <OptionPicker
            options={options}
            formule={formule}
            selectedIds={selectedOptionIds}
            onToggle={toggleOption}
            subscriptionNotice={subscriptionNotice}
            disabled={isPending}
          />
        </FormSection>

        {isAssessment && (
          <FormSection title="Notes de la réunion">
            <Label htmlFor="needsAssessmentNotes" className="sr-only">
              Notes de la réunion d&apos;évaluation
            </Label>
            <Textarea
              id="needsAssessmentNotes"
              name="needsAssessmentNotes"
              rows={4}
              maxLength={4000}
              defaultValue={defaultNeedsAssessmentNotes ?? ""}
              disabled={isPending}
              placeholder="Contexte, échéance HAS annoncée, points de vigilance, ce qui a motivé le choix de l'offre…"
            />
          </FormSection>
        )}

        <FormSection title="Conditions">
          <ConditionsFields
            depositPercent={depositPercent}
            onDepositChange={setDepositPercent}
            installmentCount={installmentCount}
            onInstallmentChange={setInstallmentCount}
            defaultValidityDays={draft?.validityDays ?? defaultValidityDays}
            validityHint={draft ? undefined : validityHint}
            disabled={isPending}
          />
        </FormSection>

        {retiredLines.length > 0 && (
          <p role="status" className="flex items-start gap-2 rounded-xl border border-line bg-highlight px-4 py-3 text-ink">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-text" aria-hidden="true" />
            Retirées du catalogue depuis la création de ce brouillon, ces lignes ne seront pas conservées à
            l&apos;enregistrement : {retiredLines.join(", ")}.
          </p>
        )}
      </div>

      <DevisRecap structureName={structureName} lines={lines} amounts={amounts} showStartingPriceNote={isAssessment}>
        {state?.error && (
          <p role="alert" className="flex items-start gap-2 text-danger-text">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {draft ? "Enregistrer les corrections" : isAssessment ? "Générer le devis" : "Créer le devis"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link
            href={
              draft
                ? `/dashboard/cabinet/commercial/devis/${draft.id}`
                : `/dashboard/cabinet/commercial/prospects/${prospectId}`
            }
          >
            Annuler
          </Link>
        </Button>
        {!draft && (
          <p className="text-sm text-ink2">
            Le devis est créé en brouillon : il s&apos;envoie ensuite par e-mail, PDF joint.
          </p>
        )}
      </DevisRecap>
    </form>
  );
}
