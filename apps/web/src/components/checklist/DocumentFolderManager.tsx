"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { FileSpreadsheet, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Folder } from "./DocumentFolderList";

// La liste des dossiers et l'import ne se chargent qu'au clic : gestes rares, et
// l'onglet Documents est la route la plus lourde du cabinet (budget de JavaScript).
const DocumentFolderList = dynamic(() => import("./DocumentFolderList").then((module) => module.DocumentFolderList), {
  loading: () => <p className="text-sm text-ink2">Chargement…</p>,
});
const DocumentTypeImportFields = dynamic(
  () => import("./DocumentTypeImportFields").then((module) => module.DocumentTypeImportFields),
  { loading: () => <p className="text-sm text-ink2">Chargement…</p> }
);

// « Dossiers » et « Importer un tableur » de l'onglet Documents (call du 29/10/2026).
// Réservé à qui gère la liste (CABINET_ADMIN) : les dossiers valent pour toutes les
// structures.
export function DocumentFolderManager({ folders }: { folders: readonly Folder[] }) {
  const [open, setOpen] = useState<"folders" | "import" | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(open === "folders" ? null : "folders")} aria-expanded={open === "folders"}>
          <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
          Gérer les dossiers
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(open === "import" ? null : "import")} aria-expanded={open === "import"}>
          <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
          Importer un tableur
        </Button>
      </div>
      {open === "folders" && <DocumentFolderList folders={folders} onClose={() => setOpen(null)} />}
      {open === "import" && <DocumentTypeImportFields folders={folders} onClose={() => setOpen(null)} />}
    </div>
  );
}
