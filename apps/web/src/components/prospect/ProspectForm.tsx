"use client";

import { useActionState, useState } from "react";
import { createProspect, updateProspect } from "@/lib/actions/prospect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import type {
  AcquisitionChannel,
  Civility,
  CommercialTier,
  ContactRole,
  StructureType,
} from "@eoda/database";
import {
  ACQUISITION_CHANNEL_LABELS,
  CIVILITY_LABELS,
  CONTACT_ROLE_LABELS,
} from "@/lib/services/prospect-contact-service";

type ProspectInitialValues = {
  id: string;
  structureName: string;
  structureType: StructureType;
  channel: AcquisitionChannel;
  channelOther: string | null;
  civility: Civility | null;
  contactName: string | null;
  contactRole: ContactRole | null;
  contactRoleOther: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  envisagedFormule: CommercialTier | null;
  estimatedAmountEuros: number | null;
  firstContactDate: Date;
  needsAssessmentNotes: string | null;
  notes: string | null;
};

type Props = { prospect?: ProspectInitialValues };

function toDateInputValue(date: Date): string {
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

export function ProspectForm({ prospect }: Props) {
  const isEdit = !!prospect;
  // Les deux précisions ne s'affichent que sur « Autre ». Les montrer en permanence
  // ferait deux champs vides sur chaque fiche ; les cacher sans état les rendrait
  // impossibles à remplir.
  const [channel, setChannel] = useState<string>(prospect?.channel ?? "");
  const [contactRole, setContactRole] = useState<string>(prospect?.contactRole ?? "");
  const action = isEdit ? updateProspect.bind(null, prospect.id) : createProspect;
  const [state, formAction, isPending] = useActionState(action, null);
  const cancelHref = isEdit
    ? `/dashboard/cabinet/commercial/prospects/${prospect.id}`
    : "/dashboard/cabinet/commercial/prospects";

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="structureName">
          Nom de la structure <span className="text-rouge-imp">*</span>
        </Label>
        <Input
          id="structureName"
          name="structureName"
          placeholder="ex : Association d'aide à domicile du Blanc-Mesnil"
          defaultValue={prospect?.structureName}
          required
          autoFocus
          disabled={isPending}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="structureType">
            Type de structure <span className="text-rouge-imp">*</span>
          </Label>
          <Select id="structureType" name="structureType" required disabled={isPending} defaultValue={prospect?.structureType ?? ""}>
            <option value="">— Sélectionner —</option>
            <option value="ASSOCIATION">Association</option>
            <option value="PRIVE">Privé</option>
            <option value="PUBLIC">Public</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="channel">
            Canal d'acquisition <span className="text-rouge-imp">*</span>
          </Label>
          <Select
            id="channel"
            name="channel"
            required
            disabled={isPending}
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <option value="">— Sélectionner —</option>
            {Object.entries(ACQUISITION_CHANNEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* « Autre » sans précision enregistre seulement qu'on ne sait pas : l'analyse
          d'acquisition y perd exactement les cas nouveaux qu'il faudrait repérer. */}
      {channel === "AUTRE" && (
        <div className="space-y-1.5">
          <Label htmlFor="channelOther">
            Comment nous ont-ils connus ? <span className="text-rouge-imp">*</span>
          </Label>
          <Input
            id="channelOther"
            name="channelOther"
            placeholder="ex : salon des ESSMS, recommandation d'une ARS, article de presse..."
            defaultValue={prospect?.channelOther ?? undefined}
            required
            disabled={isPending}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Civilité à part, et non recopiée dans le nom : « Madame Dupont » ne se
            trie pas, ne s'adresse pas et ne se pré-remplit pas dans un devis sans
            être redécoupé à la main. */}
        <div className="space-y-1.5">
          <Label htmlFor="civility">Civilité</Label>
          <Select id="civility" name="civility" disabled={isPending} defaultValue={prospect?.civility ?? ""}>
            <option value="">— Non précisé —</option>
            {Object.entries(CIVILITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactName">Nom du contact</Label>
          <Input id="contactName" name="contactName" defaultValue={prospect?.contactName ?? undefined} disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactPhone">Téléphone</Label>
          <Input id="contactPhone" name="contactPhone" defaultValue={prospect?.contactPhone ?? undefined} disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactEmail">E-mail</Label>
          <Input id="contactEmail" name="contactEmail" type="email" defaultValue={prospect?.contactEmail ?? undefined} disabled={isPending} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="contactRole">Fonction</Label>
          <Select
            id="contactRole"
            name="contactRole"
            disabled={isPending}
            value={contactRole}
            onChange={(e) => setContactRole(e.target.value)}
          >
            <option value="">— Non précisée —</option>
            {Object.entries(CONTACT_ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        {/* Liste volontairement courte, à compléter au fil des rôles réellement
            rencontrés : « Autre » + précision évite d'attendre une migration de
            schéma pour enregistrer un rôle nouveau. */}
        {contactRole === "AUTRE" && (
          <div className="space-y-1.5">
            <Label htmlFor="contactRoleOther">
              Précisez la fonction <span className="text-rouge-imp">*</span>
            </Label>
            <Input
              id="contactRoleOther"
              name="contactRoleOther"
              placeholder="ex : chargée de mission qualité"
              defaultValue={prospect?.contactRoleOther ?? undefined}
              required
              disabled={isPending}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="envisagedFormule">Formule envisagée</Label>
          <Select id="envisagedFormule" name="envisagedFormule" disabled={isPending} defaultValue={prospect?.envisagedFormule ?? ""}>
            <option value="">— Non défini —</option>
            <option value="ESSENTIEL">Essentiel</option>
            <option value="PERFORMANCE">Performance</option>
            <option value="EXCELLENCE">Excellence</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="estimatedAmountEuros">Niveau financier / montant estimé (€)</Label>
          <Input
            id="estimatedAmountEuros"
            name="estimatedAmountEuros"
            type="number"
            min={0}
            defaultValue={prospect?.estimatedAmountEuros ?? undefined}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="firstContactDate">
            Date de premier contact <span className="text-rouge-imp">*</span>
          </Label>
          <Input
            id="firstContactDate"
            name="firstContactDate"
            type="date"
            required
            defaultValue={prospect ? toDateInputValue(prospect.firstContactDate) : undefined}
            disabled={isPending}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="needsAssessmentNotes">Évaluation des besoins</Label>
        <textarea
          id="needsAssessmentNotes"
          name="needsAssessmentNotes"
          rows={3}
          placeholder="Besoins exprimés lors de l'échange de prospection (périmètre attendu, contraintes, échéance...)"
          defaultValue={prospect?.needsAssessmentNotes ?? undefined}
          disabled={isPending}
          className="flex w-full rounded-md border border-gris-light bg-white px-3 py-2 text-base sm:text-sm text-brun-ancre transition-colors placeholder:text-gris-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre focus-visible:ring-offset-2 focus-visible:border-terre disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={prospect?.notes ?? undefined}
          disabled={isPending}
          className="flex w-full rounded-md border border-gris-light bg-white px-3 py-2 text-base sm:text-sm text-brun-ancre transition-colors placeholder:text-gris-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre focus-visible:ring-offset-2 focus-visible:border-terre disabled:cursor-not-allowed disabled:opacity-50"
        />
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
          {isEdit ? "Enregistrer les modifications" : "Créer le prospect"}
        </Button>
        <Button type="button" variant="outline" asChild className="mt-6">
          <Link href={cancelHref}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
