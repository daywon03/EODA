"use client";

import { useRef, useState, useTransition } from "react";
import { uploadDocument } from "@/lib/actions/document";
import { LLM_MODEL_OPTIONS, DEFAULT_LLM_MODEL_ID } from "@/lib/llm/openrouter-models";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, AlertCircle } from "lucide-react";

type Props = {
  establishmentId: string;
  documentTypeId: string;
  // Côté cabinet uniquement : comparer les résultats entre IA sur un même document
  // est un usage interne (choix de Damon, 10/09/2026), pas une option à exposer au
  // client — sans OPENROUTER_API_KEY configurée, ce choix est de toute façon ignoré
  // par l'adaptateur actif (cf. lib/llm/index.ts).
  showModelSelector?: boolean;
};

export function DocumentUploadButton({
  establishmentId,
  documentTypeId,
  showModelSelector = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelId] = useState(DEFAULT_LLM_MODEL_ID);
  const [isPending, startTransition] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("establishmentId", establishmentId);
    formData.set("documentTypeId", documentTypeId);
    formData.set("file", file);
    if (showModelSelector) formData.set("modelId", modelId);

    setError(null);
    startTransition(async () => {
      const result = await uploadDocument(formData);
      if ("error" in result) setError(result.error);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {showModelSelector && (
        <select
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          disabled={isPending}
          aria-label="Modèle IA pour l'analyse de ce dépôt"
          className="text-xs border border-gris-light rounded-md px-1.5 py-0.5 bg-white text-brun-ancre"
        >
          {LLM_MODEL_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
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
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp max-w-[220px] text-right">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
