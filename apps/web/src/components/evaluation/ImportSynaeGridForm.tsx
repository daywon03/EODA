"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";
import { importSynaeGrid, type SynaeImportResult } from "@/lib/actions/evaluation-import";
import { Button } from "@/components/ui/button";

// Import d'une grille Synaé cotée : le chapitre se lit dans la grille, les cotations
// complètent la session ouverte — ce qui est déjà coté à l'écran est conservé.
export function ImportSynaeGridForm({ establishmentId }: { establishmentId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<SynaeImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setResult(null);
    startTransition(async () => {
      setResult(await importSynaeGrid(establishmentId, data));
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-ink">
        <span className="font-bold">Grille Synaé cotée (.xlsx)</span>
        <input
          ref={inputRef}
          name="file"
          type="file"
          required
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={isPending}
          className="min-h-11 text-ink file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-line file:bg-card file:px-3 file:text-ink"
        />
      </label>
      <Button type="submit" variant="outline" className="w-fit" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
        Importer la grille
      </Button>
      {result && "error" in result && (
        <p role="alert" className="text-danger-text">
          {result.error}
        </p>
      )}
      {result && !("error" in result) && (
        <div role="status" className="space-y-1.5 text-ink">
          <p>
            Chapitre {result.chapterNumber} : {result.summary}
          </p>
          {result.refused.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-ink2">
              {result.refused.slice(0, 10).map((line) => (
                <li key={line}>{line}</li>
              ))}
              {result.refused.length > 10 && <li>… et {result.refused.length - 10} autre(s).</li>}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
