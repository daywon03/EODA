"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Loader2, RotateCcw } from "lucide-react";
import {
  listHiddenDocumentTypes,
  restoreDocumentTypeForEstablishment,
  type HiddenDocumentType,
} from "@/lib/actions/document-type-exclusion";
import { formatDate } from "@/lib/services/date-format-service";
import { Button } from "@/components/ui/button";

// « Lignes masquées » de CETTE structure (10/11/2026) : la poubelle « seulement pour
// cette structure » est réversible, et c'est ici qu'on la défait. Liste lue au clic
// seulement (administration du cabinet, requireAdminEstablishmentInTenant).
export function HiddenDocumentTypes({ establishmentId }: { establishmentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<HiddenDocumentType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      setLines(await listHiddenDocumentTypes(establishmentId));
    });
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) load();
  }

  function restore(documentTypeId: string) {
    setError(null);
    startTransition(async () => {
      const result = await restoreDocumentTypeForEstablishment(establishmentId, documentTypeId);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setLines(await listHiddenDocumentTypes(establishmentId));
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={toggle} aria-expanded={open}>
        <EyeOff className="h-4 w-4" aria-hidden="true" />
        Lignes masquées
      </Button>
      {open && (
        <div className="max-w-xl space-y-2 rounded-lg border border-line bg-card p-3">
          <p className="text-sm text-ink2">Retirées de la liste de cette structure seulement. Les autres structures les voient toujours.</p>
          {lines === null && (
            <p role="status" className="flex items-center gap-2 text-ink2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Chargement…
            </p>
          )}
          {lines?.length === 0 && <p className="text-ink">Aucune ligne masquée.</p>}
          {lines && lines.length > 0 && (
            <ul className="divide-y divide-line">
              {lines.map((line) => (
                <li key={line.documentTypeId} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="text-ink">{line.label}</span>
                    <span className="block text-sm text-ink2">Masquée le {formatDate(line.hiddenAt)}</span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => restore(line.documentTypeId)}
                    aria-label={`Rétablir la ligne « ${line.label} »`}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Rétablir
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {error && (
            <p role="alert" className="text-danger-text">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
