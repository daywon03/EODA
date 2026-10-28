"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Plus } from "lucide-react";
import { createDocumentType, type CreateDocumentTypeResult } from "@/lib/actions/document-type-creation";
import { submitWithoutReset } from "@/lib/forms/submit-without-reset";
import { useResetAfterSuccess } from "@/lib/forms/use-reset-after-success";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/services/structure-documents-service";
import {
  CREATABLE_DOCUMENT_CATEGORIES,
  DOCUMENT_TYPE_LABEL_MAX,
} from "@/lib/services/document-type-creation-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Props = {
  // Fiche d'où la ligne est créée — pour proposer de l'ouvrir aussitôt. Absente sur
  // la page de cabinet « Documents réclamés ».
  establishmentId?: string;
  // Adresse de l'onglet Documents de cette fiche.
  documentsPath?: string;
  onClose: () => void;
};

// Le formulaire « Ajouter un document à la liste » — une fois, pour toutes les
// structures (createDocumentType). Chargé à la demande par NewDocumentTypeForm.
export function NewDocumentTypeFields({ establishmentId, documentsPath, onClose }: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (_previous: CreateDocumentTypeResult | null, data: FormData) => createDocumentType(data),
    null
  );
  const succeeded = state !== null && "ok" in state;
  const formRef = useResetAfterSuccess(isPending, succeeded);

  // La liste affichée à côté se relit : la nouvelle ligne y apparaît sans recharger.
  useEffect(() => {
    if (succeeded) router.refresh();
  }, [succeeded, state, router]);

  return (
    <form
      ref={formRef}
      method="post"
      onSubmit={submitWithoutReset(formAction)}
      className="max-w-xl space-y-4 rounded-xl border border-line bg-card p-4"
      aria-labelledby="new-document-type-title"
    >
      <h3 id="new-document-type-title" className="text-base font-bold text-ink">
        Ajouter un document à la liste
      </h3>
      <p className="text-sm text-ink2">
        Le document est ajouté une seule fois, pour <strong>toutes les structures</strong> dont l&apos;accompagnement
        couvre sa catégorie. Ses critères HAS se rattachent ensuite une fois, dans la matrice des critères, et valent
        pour tout le monde.
      </p>
      {establishmentId && <input type="hidden" name="establishmentId" value={establishmentId} />}

      <div className="space-y-1.5">
        <Label htmlFor="new-document-type-label">Nom du document</Label>
        <Input
          id="new-document-type-label"
          name="label"
          required
          maxLength={DOCUMENT_TYPE_LABEL_MAX}
          disabled={isPending}
          placeholder="Par exemple : Plan de continuité d'activité"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new-document-type-category">Catégorie</Label>
        <Select id="new-document-type-category" name="category" required disabled={isPending} defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          {CREATABLE_DOCUMENT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {DOCUMENT_CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
        <p className="text-sm text-ink2">La liste de la loi 2002-2 est fixée par la loi : elle ne se complète pas ici.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold text-ink">Qui le fournit ?</legend>
        <label className="flex min-h-11 items-center gap-2 text-ink">
          <input type="radio" name="provider" value="EODA" defaultChecked disabled={isPending} />
          EODA le prépare pour la structure
        </label>
        <label className="flex min-h-11 items-center gap-2 text-ink">
          <input type="radio" name="provider" value="STRUCTURE" disabled={isPending} />
          La structure le dépose sur son espace
        </label>
      </fieldset>

      <label className="flex min-h-11 items-center gap-2 text-ink">
        <input type="checkbox" name="announce" defaultChecked disabled={isPending} />
        Prévenir par e-mail les structures accompagnées concernées
      </label>

      {state && "error" in state && (
        <p role="alert" className="flex items-center gap-2 text-sm text-rouge-imp">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
          Ajouter pour toutes les structures
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={isPending}>
          Fermer
        </Button>
      </div>

      {succeeded && <Success state={state} documentsPath={documentsPath} />}
    </form>
  );
}

function Success({
  state,
  documentsPath,
}: {
  state: Extract<CreateDocumentTypeResult, { ok: true }>;
  documentsPath: string | undefined;
}) {
  return (
    <div role="status" className="space-y-2 text-sm text-ink">
      <p className="flex items-center gap-2 text-ok-text">
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        « {state.label} » est ajouté à la liste de toutes les structures.
      </p>
      <p>{announcementMessage(state.announced)}</p>
      {state.visibleOnStructure === false && (
        <p>L&apos;offre de cette structure ne couvre pas cette catégorie : la ligne n&apos;apparaît pas sur sa fiche.</p>
      )}
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        {documentsPath && state.visibleOnStructure && (
          <Link className="font-bold text-accent-text underline" href={`${documentsPath}?doc=${state.documentTypeId}`}>
            Ouvrir la ligne
          </Link>
        )}
        <Link className="font-bold text-accent-text underline" href="/dashboard/cabinet/criteres">
          Rattacher ses critères HAS
        </Link>
      </p>
    </div>
  );
}

// Ce qui est réellement parti — jamais un succès muet, jamais un envoi compté s'il
// n'est pas parti (countDeliveries).
function announcementMessage(announced: Extract<CreateDocumentTypeResult, { ok: true }>["announced"]): string {
  if (announced === null) return "Aucune structure n'a été prévenue (vous ne l'avez pas demandé).";
  if (announced.structures === 0) return "Aucune structure accompagnée n'est concernée pour l'instant.";
  const structures = `${announced.structures} structure${announced.structures > 1 ? "s" : ""}`;
  if (announced.recipients === 0) return `${structures} concernée(s), mais aucun compte à prévenir.`;
  if (announced.sent === 0) return `${structures} concernée(s) : e-mail non parti (messagerie non configurée ou indisponible).`;
  return `${structures} prévenue(s) — ${announced.sent} e-mail${announced.sent > 1 ? "s" : ""} parti${announced.sent > 1 ? "s" : ""} sur ${announced.recipients}.`;
}
