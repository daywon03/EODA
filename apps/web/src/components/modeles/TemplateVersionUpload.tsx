"use client";

import { useActionState, useRef } from "react";
import { uploadTemplateVersion } from "@/lib/actions/template-library";
import type { TemplateDocumentKind } from "@eoda/database";
import {
  TEMPLATE_STAGES,
  TEMPLATE_STAGE_HINTS,
  TEMPLATE_STAGE_LABELS,
} from "@/lib/services/template-library-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, Upload } from "lucide-react";

// Dépôt d'une version. Un vrai formulaire et non un simple sélecteur de fichier : le
// stade et le numéro de version se décident au moment du dépôt, jamais après. Une
// version rangée « on verra plus tard » ne se range jamais, et c'est exactement la
// pile de fichiers qu'on cherche à sortir du PC de la consultante.
export function TemplateVersionUpload({
  templateId,
  kind,
}: {
  templateId: string;
  kind: TemplateDocumentKind;
}) {
  // Un document de référence n'a ni stade ni numéro de version imposé (« le manuel HAS
  // n'aura pas forcément plusieurs versions », call du 03/09). Lui poser les deux
  // questions n'aurait pas de réponse — et une question sans réponse est ce qui fait
  // qu'on ne dépose pas le fichier.
  const isReference = kind === "REFERENCE";
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    async (prev: { error: string } | null, formData: FormData) => {
      const result = await uploadTemplateVersion(templateId, prev, formData);
      // Le formulaire ne se vide qu'en cas de succès : sur refus, la saisie doit
      // rester à l'écran pour être corrigée plutôt que retapée.
      if (!result) formRef.current?.reset();
      return result;
    },
    null
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {isReference ? (
        <div className="space-y-1.5">
          <Label htmlFor="versionLabel">Édition</Label>
          <Input
            id="versionLabel"
            name="versionLabel"
            placeholder="ex : juillet 2025"
            maxLength={40}
            disabled={isPending}
          />
          <p className="text-xs text-gris-mid">
            Facultatif — de quoi distinguer deux éditions du même document. EODA ne
            numérote pas les versions d&apos;un document qu&apos;elle ne produit pas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="stage">
              Stade <span className="text-rouge-imp">*</span>
            </Label>
            <Select id="stage" name="stage" required disabled={isPending} defaultValue="VIERGE">
              {TEMPLATE_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {TEMPLATE_STAGE_LABELS[stage]}
                </option>
              ))}
            </Select>
            {/* Les trois stades se ressemblent et leur ordre n'est pas évident : sans
                explication, la bibliothèque se remplit de fichiers rangés au hasard. */}
            <ul className="space-y-0.5 text-xs text-gris-mid">
              {TEMPLATE_STAGES.map((stage) => (
                <li key={stage}>
                  <span className="font-medium">{TEMPLATE_STAGE_LABELS[stage]}</span> —{" "}
                  {TEMPLATE_STAGE_HINTS[stage]}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="versionLabel">
              Numéro de version <span className="text-rouge-imp">*</span>
            </Label>
            <Input
              id="versionLabel"
              name="versionLabel"
              placeholder="v1.2"
              maxLength={20}
              required
              disabled={isPending}
            />
            <p className="text-xs text-gris-mid">
              C&apos;est vous qui décidez de la portée du changement : une correction de
              forme n&apos;est pas une refonte.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="changeNote">Ce qui change dans cette version</Label>
        <Textarea
          id="changeNote"
          name="changeNote"
          rows={2}
          maxLength={500}
          placeholder="ex : ajout de l'article L.311-8 du CASF, reformulation du §3."
          disabled={isPending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="file">
          Fichier <span className="text-rouge-imp">*</span>
        </Label>
        <Input
          id="file"
          name="file"
          type="file"
          // Filtre de confort du sélecteur, jamais un contrôle : le type réel est
          // déterminé par la signature binaire côté serveur.
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
          required
          disabled={isPending}
        />
        <p className="text-xs text-gris-mid">
          Word, Excel, PDF — 20 Mo au plus. Vous continuez à travailler dans vos outils
          habituels.
        </p>
      </div>

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {isReference ? "Déposer ce fichier" : "Publier cette version"}
      </Button>

      {state && "error" in state && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp">
          <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
    </form>
  );
}
