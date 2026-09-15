"use client";

import { useActionState, useRef, useState, useTransition } from "react";
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
import { AlertCircle, CheckCircle2, Loader2, Upload } from "lucide-react";

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
  // n'aura pas forcément plusieurs versions », call du 03/09), et surtout PAS la
  // contrainte d'unicité stade+version qui empêche deux fichiers GABARIT de coexister
  // sous le même nom : plusieurs fichiers peuvent donc partir en un seul dépôt, chacun
  // devenant sa propre version (10/09/2026, demande de Damon — un dossier de fiches
  // pour la base de connaissances se dépose d'un coup, pas fichier par fichier).
  const isReference = kind === "REFERENCE";

  if (isReference) {
    return <ReferenceUpload templateId={templateId} />;
  }
  return <GabaritUpload templateId={templateId} />;
}

// Plusieurs fichiers, voire un dossier entier — sans l'écran de relecture de
// l'import de dossier de la bibliothèque : ici, pas de stade ni de catégorie à
// deviner, juste des fichiers à rattacher à CE modèle.
//
// DEUX sélecteurs distincts, jamais un seul avec `webkitdirectory` + `multiple` en
// même temps : constaté à l'usage, un champ portant `webkitdirectory` verrouille la
// boîte de dialogue du système en mode « dossier uniquement » sur les navigateurs
// qui le supportent — il ne bascule pas tout seul en sélection multi-fichiers au
// même clic. Un seul champ aurait donc empêché de choisir plusieurs fichiers isolés.
//
// UN APPEL PAR FICHIER, séquentiel — même raison que l'import de dossier : plusieurs
// envois simultanés de fichiers volumineux saturent la liaison montante, et une
// requête unique groupant tout ne passerait aucune passerelle.
function ReferenceUpload({ templateId }: { templateId: string }) {
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<File[]>([]);
  const [versionLabel, setVersionLabel] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outcome, setOutcome] = useState<{ done: number; failures: string[] } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Choisir via l'autre sélecteur REMPLACE la sélection en cours, plutôt que de
  // l'ajouter : reprendre après un choix qu'on a raté doit repartir de zéro, pas
  // accumuler des fichiers qu'on croyait avoir retirés.
  function handlePick(files: FileList | null) {
    setSelected(files ? Array.from(files) : []);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (selected.length === 0) return;

    setOutcome(null);
    setProgress({ done: 0, total: selected.length });

    startTransition(async () => {
      const failures: string[] = [];
      let done = 0;

      for (const file of selected) {
        const formData = new FormData();
        formData.set("versionLabel", versionLabel);
        formData.set("changeNote", changeNote);
        formData.set("file", file);

        const result = await uploadTemplateVersion(templateId, null, formData);
        if (result && "error" in result) failures.push(`${file.name} : ${result.error}`);
        else done += 1;
        setProgress({ done: done + failures.length, total: selected.length });
      }

      setProgress(null);
      setOutcome({ done, failures });
      if (done > 0) {
        setSelected([]);
        if (filesInputRef.current) filesInputRef.current.value = "";
        if (folderInputRef.current) folderInputRef.current.value = "";
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="versionLabel">Édition</Label>
        <Input
          id="versionLabel"
          value={versionLabel}
          onChange={(e) => setVersionLabel(e.target.value)}
          placeholder="ex : juillet 2025"
          maxLength={40}
          disabled={isPending}
        />
        <p className="text-xs text-gris-mid">
          Facultatif — de quoi distinguer deux éditions du même document. EODA ne
          numérote pas les versions d&apos;un document qu&apos;elle ne produit pas.
          Partagée par tous les fichiers déposés ensemble ici.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="changeNote">Ce qui change dans cette version</Label>
        <Textarea
          id="changeNote"
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="ex : ajout de l'article L.311-8 du CASF, reformulation du §3."
          disabled={isPending}
        />
      </div>

      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-brun-ancre">
          Fichier(s) <span className="text-rouge-imp">*</span>
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={filesInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
            disabled={isPending}
            className="hidden"
            onChange={(e) => handlePick(e.target.files)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => filesInputRef.current?.click()}
          >
            Choisir des fichiers
          </Button>

          <input
            ref={folderInputRef}
            type="file"
            // Toujours un dossier entier avec cet attribut — jamais mélangé avec
            // `filesInputRef` ci-dessus, cf. le commentaire en tête de fonction.
            {...({ webkitdirectory: "" } as Record<string, string>)}
            disabled={isPending}
            className="hidden"
            onChange={(e) => handlePick(e.target.files)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => folderInputRef.current?.click()}
          >
            Choisir un dossier
          </Button>
        </div>
        <p className="text-xs text-gris-mid">
          Word, Excel, PDF — 20 Mo au plus par fichier. Chaque fichier devient son
          propre fichier de ce modèle.
        </p>

        {selected.length > 0 && (
          <ul className="space-y-0.5 text-xs text-brun-ancre">
            {selected.map((file, index) => (
              <li key={`${file.name}-${index}`} className="truncate">
                {file.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button type="submit" size="sm" disabled={isPending || selected.length === 0}>
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {isPending && progress
          ? `Dépôt en cours — ${progress.done} / ${progress.total}`
          : selected.length > 1
            ? `Déposer ces ${selected.length} fichiers`
            : "Déposer ce fichier"}
      </Button>

      {outcome && (
        <div role="status" className="space-y-1 text-xs">
          {outcome.done > 0 && (
            <p className="flex items-center gap-1.5 text-vert-ok">
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              {outcome.done} fichier{outcome.done > 1 ? "s" : ""} déposé
              {outcome.done > 1 ? "s" : ""}.
            </p>
          )}
          {outcome.failures.map((failure) => (
            <p key={failure} className="flex items-start gap-1.5 text-rouge-imp">
              <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
              {failure}
            </p>
          ))}
        </div>
      )}
    </form>
  );
}

// Un gabarit exige un stade et un numéro de version PAR fichier (contrainte
// d'unicité stade+version) : plusieurs fichiers simultanés n'auraient pas de sens
// sans redemander ces deux champs à chacun — c'est exactement ce que l'écran
// d'import de dossier fait déjà pour ce cas. Un gabarit reste donc un fichier à la
// fois, ici.
function GabaritUpload({ templateId }: { templateId: string }) {
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
        Publier cette version
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
