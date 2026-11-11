"use client";

import { useEffect, useState } from "react";
import { DEFAULT_ASSISTANT_MODEL_ID, isKnownAssistantModelId } from "@/lib/llm/assistant-models";

// Le modèle choisi est une préférence de CE navigateur (comme MusicPlanner) : mémorisé
// dans le stockage local, relu au chargement, ignoré s'il n'est plus au catalogue. Le
// serveur le revalide de toute façon (resolveAssistantModel).
const KEY = "eoda.assistant.model";

export function useAssistantModel(): [string, (id: string) => void] {
  const [model, setModel] = useState(DEFAULT_ASSISTANT_MODEL_ID);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (isKnownAssistantModelId(saved)) setModel(saved);
    } catch {
      // Stockage indisponible (navigation privée) : le défaut suffit.
    }
  }, []);

  function choose(id: string) {
    if (!isKnownAssistantModelId(id)) return;
    setModel(id);
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      // idem
    }
  }

  return [model, choose];
}
