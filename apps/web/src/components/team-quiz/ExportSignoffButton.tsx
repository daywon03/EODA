"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportQuizSignoff } from "@/lib/actions/staff-quiz-write";

// « Exporter l'émargement » : le CSV des quiz réussis, nommé selon la convention EODA,
// téléchargé sans passer par une route publique (l'action est gardée et journalisée).
export function ExportSignoffButton({ establishmentId }: { establishmentId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function exportCsv() {
    setError(null);
    startTransition(async () => {
      try {
        const { fileName, content } = await exportQuizSignoff(establishmentId);
        const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      } catch {
        setError("L'export n'a pas pu se faire. Réessayez.");
      }
    });
  }

  return (
    <span className="flex flex-col gap-1">
      <Button variant="outline" onClick={exportCsv} disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
        Exporter l&apos;émargement
      </Button>
      {error && (
        <span role="alert" className="text-rouge-imp">
          {error}
        </span>
      )}
    </span>
  );
}
