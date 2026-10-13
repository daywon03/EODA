"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import type { CommercialTier } from "@eoda/database";
import { createDevis, updateDevis } from "@/lib/actions/devis";
import { computeDevisAmounts, optionCommittedAmountEuros } from "@/lib/services/devis-calculation-service";
import { pickInitialFormule } from "@/lib/services/devis-initial-formule-service";
import { describeSubscriptionDiscount, optionUnitPriceForFormule } from "@/lib/services/subscription-service";
import {
  buildDevisRecap,
  DEFAULT_COMMITMENT_MONTHS,
  describeCommitment,
  parseCommitmentMonths,
  type CommitmentMonths,
} from "@/lib/services/devis-recap-service";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CommitmentPicker,
  ConditionsFields,
  FormSection,
  OfferPicker,
  OptionPicker,
  type CatalogueOptionItem,
  type FormuleOption,
} from "./DevisFormSections";
import { DevisRecap } from "./DevisRecap";

// Valeurs d'un devis existant à corriger. Absentes = création.
// Seul un BROUILLON arrive ici : la route de modification refuse les autres, et
// `updateDevis` le revérifie côté serveur.
type DevisDraft = {
  id: string;
  number: string;
  formule: CommercialTier | null;
  optionIds: string[];
  depositPercent: number;
  installmentCount: number;
  validityDays: number;
  commitmentMonths: number | null;
  clientNote: string | null;
};

// Deux usages du MÊME formulaire, jamais deux formulaires (D1) :
//   - "devis"      : création ou correction ;
//   - "assessment" : la réunion d'évaluation des besoins, en direct pendant l'appel.
// Mise en page de la maquette v2 « Nouveau devis » (13/10/2026). La logique de
// montants (devis-calculation-service, subscription-service) est INCHANGÉE ; le
// rangement « Par mois » / « Ponctuel » vient de devis-recap-service.
type Variant = "devis" | "assessment";

type Props = {
  prospectId: string;
  formules: FormuleOption[];
  options: CatalogueOptionItem[];
  defaultDepositPercent: number;
  defaultValidityDays: number;
  validityHint?: string;
  structureName?: string;
  // Le prospect a-t-il une adresse ? Sans elle, « Envoyer le devis » est impossible.
  canSendByEmail?: boolean;
  // Choix de la structure (liens), rendu par la page en tête de colonne.
  structurePicker?: ReactNode;
  draft?: DevisDraft;
  variant?: Variant;
  defaultNeedsAssessmentNotes?: string | null;
  retiredLines?: string[];
  envisagedFormule?: CommercialTier | null;
};

export function DevisForm({
  prospectId,
  formules,
  options,
  defaultDepositPercent,
  defaultValidityDays,
  validityHint,
  structureName,
  canSendByEmail = false,
  structurePicker,
  draft,
  variant = "devis",
  defaultNeedsAssessmentNotes,
  retiredLines = [],
  envisagedFormule = null,
}: Props) {
  // `updateDevis` prend l'identifiant en premier argument : lié ici plutôt que posté
  // en champ caché — un identifiant lié n'est pas réécrivable depuis le navigateur.
  const [state, formAction, isPending] = useActionState(draft ? updateDevis.bind(null, draft.id) : createDevis, null);
  const isAssessment = variant === "assessment";
  const [formule, setFormule] = useState<CommercialTier | "">(() =>
    pickInitialFormule({ formules, envisagedFormule, draftFormule: draft?.formule })
  );
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(
    (draft?.optionIds ?? []).filter((id) => options.some((o) => o.id === id))
  );
  const [commitment, setCommitment] = useState<CommitmentMonths>(
    () => parseCommitmentMonths(String(draft?.commitmentMonths ?? "")) ?? DEFAULT_COMMITMENT_MONTHS
  );
  const [depositPercent, setDepositPercent] = useState(draft?.depositPercent ?? defaultDepositPercent);
  const [installmentCount, setInstallmentCount] = useState(draft?.installmentCount ?? 1);

  const { recap, amounts } = useMemo(() => {
    const chosen = formules.find((f) => f.formule === formule) ?? null;
    const selected = options
      .filter((o) => selectedOptionIds.includes(o.id))
      .map((o) => ({ ...o, unitPriceEuros: optionUnitPriceForFormule(o, chosen?.formule ?? null) }));
    return {
      recap: buildDevisRecap({
        offer: chosen ? { label: chosen.label, forfaitEuros: chosen.priceEuros, monthlyEuros: chosen.monthlyPriceEuros } : null,
        options: selected,
      }),
      amounts: computeDevisAmounts({
        formulePriceEuros: chosen?.priceEuros ?? 0,
        optionPricesEuros: selected.map((o) => optionCommittedAmountEuros({ priceEuros: o.unitPriceEuros, minQuantity: o.minQuantity })),
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
    <form action={formAction} className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
      <input type="hidden" name="prospectId" value={prospectId} />

      <div className="flex min-w-0 flex-col gap-6">
        {structurePicker}

        <FormSection title="Offre">
          <OfferPicker formules={formules} value={formule} onChange={setFormule} disabled={isPending} />
        </FormSection>

        <FormSection title="Options">
          <OptionPicker
            options={options}
            formule={formule}
            selectedIds={selectedOptionIds}
            onToggle={toggleOption}
            subscriptionNotice={subscriptionNotice}
            disabled={isPending}
          />
        </FormSection>

        <FormSection title="Engagement">
          <CommitmentPicker value={commitment} onChange={setCommitment} disabled={isPending} />
        </FormSection>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="clientNote" className="font-bold text-ink">
            Note pour la structure <span className="font-normal text-ink2">(facultatif)</span>
          </label>
          <Textarea
            id="clientNote"
            name="clientNote"
            rows={3}
            maxLength={2000}
            defaultValue={draft?.clientNote ?? ""}
            disabled={isPending}
            aria-describedby="clientNote-hint"
          />
          <span id="clientNote-hint" className="text-base text-ink2">
            Reprise dans l&apos;e-mail et sur le devis. Aucun nom de personne accompagnée.
          </span>
        </div>

        {isAssessment && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="needsAssessmentNotes" className="font-bold text-ink">
              Notes de la réunion <span className="font-normal text-ink2">(internes)</span>
            </label>
            <Textarea
              id="needsAssessmentNotes"
              name="needsAssessmentNotes"
              rows={4}
              maxLength={4000}
              defaultValue={defaultNeedsAssessmentNotes ?? ""}
              disabled={isPending}
              placeholder="Contexte, échéance HAS annoncée, points de vigilance, ce qui a motivé le choix de l'offre…"
            />
          </div>
        )}

        <FormSection title="Conditions de paiement">
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

      <DevisRecap
        reference={draft?.number ?? "Nouveau"}
        structureName={structureName}
        recap={recap}
        amounts={amounts}
        commitmentLine={describeCommitment(commitment)}
      >
        {state?.error && (
          <p role="alert" className="flex items-start gap-2 text-danger-text">
            <AlertCircle className="mt-1 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {state.error}
          </p>
        )}
        {draft ? (
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Enregistrer les corrections
          </Button>
        ) : (
          <>
            <Button type="submit" name="intent" value="send" size="lg" disabled={isPending || !canSendByEmail}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Envoyer le devis
            </Button>
            <Button type="submit" name="intent" value="draft" variant="outline" disabled={isPending}>
              Enregistrer le brouillon
            </Button>
          </>
        )}
        <Button type="button" variant="ghost" asChild>
          <Link href={draft ? `/dashboard/cabinet/commercial/devis/${draft.id}` : `/dashboard/cabinet/commercial/prospects/${prospectId}`}>
            Annuler
          </Link>
        </Button>
        <p className="text-base text-ink2">
          {draft || canSendByEmail
            ? "La structure reçoit le devis par e-mail, PDF joint. La signature se confirme ensuite depuis l'écran « Signature »."
            : "Ce prospect n'a pas d'adresse e-mail : enregistrez le brouillon, puis complétez sa fiche pour l'envoyer."}
        </p>
      </DevisRecap>
    </form>
  );
}
