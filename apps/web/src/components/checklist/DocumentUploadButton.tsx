"use client";

import { useRef, useState } from "react";
import { LLM_MODEL_OPTIONS, DEFAULT_LLM_MODEL_ID } from "@/lib/llm/openrouter-models";
import { describeDepositEffects } from "@/lib/services/document-deposit-service";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { AnalysisRunStatus } from "./AnalysisRunStatus";
import { DepositReview } from "./DepositReview";
import { useDocumentDeposit } from "./use-document-deposit";

type Props = {
  establishmentId: string;
  documentTypeId: string;
  // Intitulé de la ligne : le récapitulatif dit OÙ le fichier va avant de l'envoyer.
  documentLabel: string;
  // Le document est-il déjà validé ? Un dépôt du cabinet le remet alors tout de suite
  // à la structure (uploadDocument l'annonce) — le récapitulatif doit le dire.
  documentValidated: boolean;
  // Côté cabinet uniquement : comparer les résultats entre IA sur un même document
  // est un usage interne (choix de Damon, 10/09/2026), pas une option à exposer au
  // client — sans OPENROUTER_API_KEY configurée, ce choix est de toute façon ignoré
  // par l'adaptateur actif (cf. lib/llm/index.ts).
  showModelSelector?: boolean;
  // Côté cabinet : « Version finale d'EODA » — le dépôt vaut validation (call du
  // 18/10/2026). Décochée, c'est un dépôt pour le compte de la structure.
  offerCabinetFinal?: boolean;
};

// Dépôt du cabinet, en deux temps (retour de Sandrine du 09/11/2026) : choisir le
// fichier n'envoie RIEN ; le récapitulatif (DepositReview) dit où il va et ce qu'il
// déclenche, puis « Déposer » ou « Annuler ». Pendant l'envoi, « Annuler le dépôt ».
export function DocumentUploadButton({
  establishmentId,
  documentTypeId,
  documentLabel,
  documentValidated,
  showModelSelector = false,
  offerCabinetFinal = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const chooseButton = useRef<HTMLButtonElement>(null);
  const [cabinetFinal, setCabinetFinal] = useState(true);
  const [modelId, setModelId] = useState(DEFAULT_LLM_MODEL_ID);
  const deposit = useDocumentDeposit("CABINET");
  const finalChecked = offerCabinetFinal && cabinetFinal;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    deposit.choose(e.target.files?.[0]);
    // Vidé tout de suite : rechoisir le même fichier après « Annuler » doit rouvrir
    // le récapitulatif (un `change` ne part pas pour une valeur identique).
    e.target.value = "";
  }

  function discard() {
    deposit.discard();
    // Le bouton revient à la place du récapitulatif : le focus le suit.
    requestAnimationFrame(() => chooseButton.current?.focus());
  }

  function confirm() {
    const formData = new FormData();
    formData.set("establishmentId", establishmentId);
    formData.set("documentTypeId", documentTypeId);
    if (deposit.file) formData.set("file", deposit.file);
    if (showModelSelector) formData.set("modelId", modelId);
    if (finalChecked) formData.set("cabinetFinal", "1");
    void deposit.send(formData);
  }

  const effects = describeDepositEffects({ side: "CABINET", cabinetFinal: finalChecked, documentValidated });

  return (
    <div className="flex min-w-0 max-w-full flex-col items-end gap-2">
      <input
        ref={inputRef}
        type="file"
        // Filtre de confort du sélecteur de fichiers, jamais un contrôle : le type
        // réel est déterminé par la signature binaire côté serveur
        // (upload-validation-service). Les structures n'ont pas toutes une suite
        // bureautique récente — .doc et .xls sont acceptés tels quels.
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFileChange}
        disabled={deposit.busy}
      />
      {deposit.file ? (
        <DepositReview
          file={deposit.file}
          documentLabel={documentLabel}
          effects={effects}
          density="cabinet"
          sending={deposit.sending}
          cancelRequested={deposit.cancelRequested}
          phase={deposit.phase}
          elapsedMs={deposit.elapsedMs}
          error={deposit.error}
          onConfirm={confirm}
          onDiscard={discard}
          onRequestCancel={deposit.requestCancel}
        >
          {offerCabinetFinal && (
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={cabinetFinal}
                onChange={(e) => setCabinetFinal(e.target.checked)}
                disabled={deposit.sending}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="font-bold">Version finale d&apos;EODA</span>
                <span className="block text-ink2">
                  Validée au dépôt, sans passer par « À relire ». Décochez pour déposer un document de la structure à sa place.
                </span>
              </span>
            </label>
          )}
          {showModelSelector && (
            <label className="block space-y-1">
              <span className="text-ink2">Modèle d&apos;IA pour l&apos;analyse</span>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                disabled={deposit.sending}
                className="block h-11 w-full max-w-full truncate rounded-md border border-line bg-card px-2 text-sm text-ink"
              >
                {LLM_MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </DepositReview>
      ) : (
        <>
          <Button
            ref={chooseButton}
            type="button"
            variant="outline"
            size="sm"
            disabled={deposit.busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            Déposer un fichier
          </Button>
          <AnalysisRunStatus phase={deposit.phase} elapsedMs={deposit.elapsedMs} subject="Analyse du document déposé" />
          {deposit.outcome?.kind === "cancelled" && (
            <p role="status" className="max-w-[320px] text-right text-sm font-bold text-ink">
              {deposit.outcome.message}
            </p>
          )}
          {deposit.error && (
            <p role="alert" className="max-w-[320px] text-right text-sm text-danger-text">
              {deposit.error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
