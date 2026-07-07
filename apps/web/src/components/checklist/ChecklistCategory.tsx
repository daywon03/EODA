"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { DocumentUploadButton } from "./DocumentUploadButton";
import type { ChecklistItem } from "@/lib/actions/checklist";
import type { DocumentStatus } from "@eoda/database";

type Props = {
  title: string;
  items: ChecklistItem[];
  defaultOpen?: boolean;
  establishmentId?: string;
};

const STATUS_ORDER: DocumentStatus[] = [
  "MISSING", "INCOMPLETE", "EXPIRED", "UPLOADED", "ANALYZING", "COMPLIANT", "NOT_APPLICABLE",
];

function statusScore(s: DocumentStatus): number {
  return STATUS_ORDER.indexOf(s);
}

export function ChecklistCategory({ title, items, defaultOpen = false, establishmentId }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const missing = items.filter((i) => i.status === "MISSING").length;
  const compliant = items.filter((i) => i.status === "COMPLIANT").length;
  const sorted = [...items].sort((a, b) => statusScore(a.status) - statusScore(b.status));

  return (
    <div className="border border-gris-light rounded-lg overflow-hidden">
      {/* En-tête accordéon */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-ivoire transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="w-4 h-4 text-gris-mid flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gris-mid flex-shrink-0" />
          )}
          <span className="font-semibold text-brun-ancre">{title}</span>
          <span className="text-xs text-gris-mid">({items.length} document{items.length > 1 ? "s" : ""})</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {missing > 0 && (
            <span className="text-rouge-imp font-medium">{missing} manquant{missing > 1 ? "s" : ""}</span>
          )}
          {compliant > 0 && (
            <span className="text-vert-ok font-medium">{compliant} conforme{compliant > 1 ? "s" : ""}</span>
          )}
        </div>
      </button>

      {/* Contenu */}
      {open && (
        <ul className="divide-y divide-gris-light border-t border-gris-light">
          {sorted.map((item) => (
            <li key={item.code} className="flex items-start justify-between gap-4 px-5 py-3 bg-white">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-brun-ancre leading-snug">{item.label}</p>
                {item.isConditional && item.status !== "NOT_APPLICABLE" && (
                  <p className="text-xs text-gris-mid mt-0.5">Si concerné</p>
                )}
                {item.expectedFrequency === "ANNUAL" && (
                  <p className="text-xs text-ambre mt-0.5">Fréquence annuelle attendue</p>
                )}
                {item.currentVersion && (
                  <p className="flex items-center gap-1 text-xs text-gris-mid mt-1">
                    <FileText className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">
                      {item.currentVersion.originalFilename} · v{item.currentVersion.versionNumber}
                    </span>
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <StatusBadge status={item.status} />
                {establishmentId && (
                  <DocumentUploadButton
                    establishmentId={establishmentId}
                    documentTypeId={item.documentTypeId}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
