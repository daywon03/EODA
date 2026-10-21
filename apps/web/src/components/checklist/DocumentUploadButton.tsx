"use client";

import { useRef, useState } from "react";
import { uploadDocument } from "@/lib/actions/document";
import { prepareDocumentPages } from "@/lib/services/document-viewer-service";
import { LLM_MODEL_OPTIONS, DEFAULT_LLM_MODEL_ID } from "@/lib/llm/openrouter-models";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, AlertCircle } from "lucide-react";
import { AnalysisRunStatus } from "./AnalysisRunStatus";
import { useAnalysisRun } from "./use-analysis-run";

type Props = {
  establishmentId: string;
  documentTypeId: string;
  // Côté cabinet uniquement : comparer les résultats entre IA sur un même document
  // est un usage interne (choix de Damon, 10/09/2026), pas une option à exposer au
  // client — sans OPENROUTER_API_KEY configurée, ce choix est de toute façon ignoré
  // par l'adaptateur actif (cf. lib/llm/index.ts).
  showModelSelector?: boolean;
  // Côté cabinet : « Version finale d'EODA » — le dépôt vaut validation (call du
  // 18/10/2026). Décochée, c'est un dépôt pour le compte de la structure.
  offerCabinetFinal?: boolean;
};

export function DocumentUploadButton({
  establishmentId,
  documentTypeId,
  showModelSelector = false,
  offerCabinetFinal = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cabinetFinal, setCabinetFinal] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelId] = useState(DEFAULT_LLM_MODEL_ID);
  const { phase, elapsedMs, run, busy: isPending } = useAnalysisRun();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("establishmentId", establishmentId);
    formData.set("documentTypeId", documentTypeId);
    formData.set("file", file);
    if (showModelSelector) formData.set("modelId", modelId);
    if (offerCabinetFinal && cabinetFinal) formData.set("cabinetFinal", "1");

    setError(null);
    void run(
      () => uploadDocument(formData),
      (result) => !("error" in result)
    ).then((result) => {
      if ("error" in result) setError(result.error);
      // Les pages de l'aperçu se préparent dès le dépôt : le premier « voir » tombe
      // sur le cache au lieu d'un lancement de Chromium.
      else prepareDocumentPages(result.documentVersionId, file.name);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="flex min-w-0 max-w-full flex-col items-end gap-1">
      {showModelSelector && (
        <select
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          disabled={isPending}
          aria-label="Modèle IA pour l'analyse de ce dépôt"
          className="max-w-full truncate text-xs border border-gris-light rounded-md px-1.5 py-0.5 bg-surface text-brun-ancre"
        >
          {LLM_MODEL_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      {offerCabinetFinal && (
        <label className="flex max-w-[320px] cursor-pointer items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={cabinetFinal}
            onChange={(e) => setCabinetFinal(e.target.checked)}
            disabled={isPending}
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
        disabled={isPending}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        aria-label={isPending ? "Dépôt en cours" : "Déposer un document"}
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Upload className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        Déposer
      </Button>
      <AnalysisRunStatus phase={phase} elapsedMs={elapsedMs} subject="Analyse du document déposé" />
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp max-w-[220px] text-right">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
