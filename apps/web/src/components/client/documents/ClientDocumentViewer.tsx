"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { formatDate } from "@/lib/services/date-format-service";
import { canRenderDocumentPages } from "@/lib/services/file-type-service";
import { documentPagesUrl } from "@/lib/services/document-viewer-service";
import { DocumentViewer } from "@/components/structure/DocumentViewer";
import { DocumentDownloadLink } from "@/components/checklist/DocumentDownloadLink";
import { cn } from "@/lib/utils";

// « Mes documents » — la structure OUVRE ses documents (21/10/2026). Jusqu'ici la carte
// d'un document ne permettait ni de le voir ni de le télécharger : seuls les livrables
// s'ouvraient. Un clic sur le nom (ou sur « Voir ») ouvre la même visionneuse que le
// cabinet, tout de suite — tout ce qu'elle affiche est déjà dans la page.
//
// Les versions reçues sont DÉJÀ filtrées (`versionsVisibleToClient`) : ses dépôts, et
// ceux d'EODA une fois le document validé.

export type ClientViewerVersion = {
  id: string;
  versionNumber: number;
  originalFilename: string;
  uploadedAt: Date;
  producedByCabinet: boolean;
};

export function ClientDocumentViewer({
  label,
  versions,
  mention,
}: {
  label: string;
  versions: ClientViewerVersion[];
  mention: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(versions[0]?.id ?? null);
  const selected = versions.find((version) => version.id === selectedId) ?? versions[0] ?? null;

  if (!selected) return <h3 className="text-[19px] font-bold leading-snug">{label}</h3>;

  return (
    <>
      <h3 className="text-[19px] font-bold leading-snug">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-left underline-offset-4 hover:underline"
          aria-haspopup="dialog"
        >
          {label}
        </button>
      </h3>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex min-h-12 w-fit items-center gap-2 text-base font-bold text-accent-text underline"
      >
        <Eye className="h-5 w-5" aria-hidden="true" />
        Voir le document
        <span className="sr-only"> : {label}</span>
      </button>

      {open && (
        <DocumentViewer
          title={label}
          versionId={selected.id}
          originalFilename={selected.originalFilename}
          onClose={() => setOpen(false)}
          details={
            <div className="flex flex-col gap-4">
              {mention && <p className="text-base font-bold">{mention}</p>}
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-base font-bold">Versions</legend>
                {versions.map((version) => {
                  const active = version.id === selected.id;
                  return (
                    <div
                      key={version.id}
                      className={cn(
                        "flex flex-col gap-2 rounded-lg border px-3 py-2.5",
                        active ? "border-ink bg-soft" : "border-line"
                      )}
                    >
                      <label className="flex min-h-11 cursor-pointer items-center gap-3">
                        <input
                          type="radio"
                          name={`version-${label}`}
                          checked={active}
                          onChange={() => setSelectedId(version.id)}
                          className="h-5 w-5"
                        />
                        <span className="flex flex-col">
                          <span className="font-bold tabular-nums">
                            Version {version.versionNumber} · {formatDate(version.uploadedAt)}
                          </span>
                          <span className="text-ink2">
                            {version.producedByCabinet ? "Préparée par EODA" : "Déposée par votre structure"}
                          </span>
                        </span>
                      </label>
                      <DocumentDownloadLink
                        documentVersionId={version.id}
                        pdfUrl={
                          canRenderDocumentPages(version.originalFilename)
                            ? `${documentPagesUrl(version.id)}?download=1`
                            : null
                        }
                      />
                    </div>
                  );
                })}
              </fieldset>
            </div>
          }
        />
      )}
    </>
  );
}
