"use client";

import { useCallback, useEffect, useState } from "react";
import { EMPTY_ROSTER, parseStoredRoster, rosterStorageKey, type Roster } from "@/lib/services/survey-roster-service";

// La liste vit dans le stockage du navigateur de la tablette, et NULLE PART ailleurs
// (survey-roster-service). Il peut être indisponible (navigation privée, données
// effacées) : la page marche quand même, et le dit.
export function useSurveyRoster(establishmentId: string) {
  const key = rosterStorageKey(establishmentId);
  const [roster, setRoster] = useState<Roster>(EMPTY_ROSTER);
  const [loaded, setLoaded] = useState(false);
  const [storageWorks, setStorageWorks] = useState(true);

  useEffect(() => {
    try {
      setRoster(parseStoredRoster(window.localStorage.getItem(key)));
    } catch {
      setStorageWorks(false);
    }
    setLoaded(true);
  }, [key]);

  const update = useCallback(
    (next: Roster) => {
      setRoster(next);
      try {
        if (next.people.length === 0) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, JSON.stringify(next));
        setStorageWorks(true);
      } catch {
        setStorageWorks(false);
      }
    },
    [key]
  );

  return { roster, update, loaded, storageWorks };
}

export function newPersonId(): string {
  return window.crypto.randomUUID();
}

// Le fichier se fabrique ici, dans le navigateur : les noms ne passent jamais par le
// serveur.
export function downloadText(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
