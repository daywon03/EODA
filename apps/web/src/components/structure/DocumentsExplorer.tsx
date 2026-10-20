"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChecklistItem } from "@/lib/actions/checklist";
import {
  DOCUMENT_CATEGORY_LABELS,
  documentRowPill,
  documentsHref,
  findDocumentRow,
  type DocumentFilters,
  type DocumentRow,
} from "@/lib/services/structure-documents-service";
import { formatDate } from "@/lib/services/date-format-service";
import { previewForVersion } from "@/lib/services/document-row-preview-service";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { Sheet } from "@/components/ui/sheet";
import { DocumentSheetBody } from "@/components/structure/DocumentSheetBody";
import { FilePreviewModal } from "@/components/shared/FilePreviewModal";

// ─────────────────────────────────────────────────────────────────────────────
// LE PANNEAU D'UN DOCUMENT S'OUVRE ET SE FERME SANS ALLER AU SERVEUR (20/10/2026)
//
// Retour de Damon : « quand on appuie sur un document ça prend du temps à s'ouvrir, et
// quand on appuie sur la croix ou le fond grisé ça prend du temps à nous remettre dans
// la page ». C'était exact, et c'était structurel : le document ouvert vivait dans
// l'ADRESSE (`?doc=…`), donc chaque clic était une navigation — deux rendus serveur
// complets de la fiche (`getEstablishmentChecklist`, toutes les versions, toutes les
// analyses) pour afficher un panneau, puis deux autres pour le refermer.
//
// Ici, la sélection est un état LOCAL : le clic ouvre, la croix (ou le fond, ou
// Échap) ferme, au même rendu. La fiche est déjà chargée — tout ce que le panneau
// affiche est dans `allRows`, transmis par le serveur. L'adresse reste tenue à jour par
// `history.replaceState`, sans requête : le lien demeure partageable, et un rechargement
// rouvre le même document (le serveur lit `?doc=` au premier rendu seulement).
//
// DEUXIÈME GESTE, dans le même clic : l'APERÇU. « Quand on appuie sur le document on
// veut directement la preview, je ne dois pas devoir appuyer une deuxième fois sur
// Voir. » L'aperçu se déduit de la ligne sans requête (`previewForVersion` : route de
// pages pour un Word, adresse pré-signée pour un PDF ou une image). Le panneau s'ouvre
// DERRIÈRE : refermer l'aperçu laisse la consultante sur l'analyse, les versions et les
// gestes, sans avoir à recliquer.
// ─────────────────────────────────────────────────────────────────────────────

type Row = DocumentRow<ChecklistItem>;

const COLUMNS: readonly DataTableColumn<Row>[] = [
  {
    id: "name",
    header: "Document",
    isRowHeader: true,
    cell: (row) => (
      <span className="flex flex-col">
        <span>{row.label}</span>
        <span className="text-sm font-normal text-ink2">{DOCUMENT_CATEGORY_LABELS[row.category]}</span>
      </span>
    ),
  },
  { id: "status", header: "Statut", cell: (row) => <StatusPill pill={documentRowPill(row)} /> },
  {
    id: "version",
    header: "Version",
    cell: (row) => (
      <span className="tabular-nums">{row.currentVersion ? `v${row.currentVersion.versionNumber}` : "—"}</span>
    ),
  },
  {
    id: "date",
    header: "Date",
    cell: (row) => (
      <span className="whitespace-nowrap tabular-nums">
        {row.currentVersion ? formatDate(row.currentVersion.uploadedAt) : "—"}
      </span>
    ),
  },
  // « Critères couverts » et « Responsable » de la maquette arrivent avec leurs
  // tranches (N4 rattachements, N9 rôles). Ce qui se sait aujourd'hui : qui doit
  // fournir le document.
  { id: "source", header: "Fourni par", cell: (row) => (row.requestedFromClient ? "La structure" : "EODA") },
];

export function DocumentsExplorer({
  rows,
  allRows,
  filters,
  basePath,
  bucketLabel,
  establishmentId,
  canEditScope,
  initialDocId,
  signedPreviewUrls,
}: {
  rows: readonly Row[];
  allRows: readonly Row[];
  filters: DocumentFilters;
  basePath: string;
  bucketLabel: string;
  establishmentId: string;
  canEditScope: boolean;
  initialDocId: string | null;
  // Adresses signées des PDF et des images, pré-signées au rendu de la page
  // (`signPreviewUrlsForVersions`). Les autres formats n'en ont pas besoin.
  signedPreviewUrls: Readonly<Record<string, string>>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialDocId);
  const [previewOpen, setPreviewOpen] = useState(initialDocId !== null);
  // Le portail vers document.body n'existe pas pendant le rendu serveur : ce garde
  // ne retarde que l'hydratation, jamais un clic.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const opened = selectedId === null ? null : findDocumentRow(allRows, selectedId);
  const preview = useMemo(
    () =>
      previewOpen && opened
        ? previewForVersion(
            opened.currentVersion
              ? { id: opened.currentVersion.id, originalFilename: opened.currentVersion.originalFilename }
              : null,
            signedPreviewUrls
          )
        : null,
    [previewOpen, opened, signedPreviewUrls]
  );

  function open(row: Row) {
    setSelectedId(row.documentTypeId);
    setPreviewOpen(true);
    // L'adresse suit, sans requête. Un rechargement rouvre le même panneau.
    window.history.replaceState(null, "", documentsHref(basePath, { ...filters, doc: row.documentTypeId }));
  }

  function close() {
    setSelectedId(null);
    setPreviewOpen(false);
    window.history.replaceState(null, "", documentsHref(basePath, filters));
  }

  return (
    <>
      <DataTable
        caption={`Documents — ${bucketLabel}`}
        columns={COLUMNS}
        rows={rows}
        getRowKey={(row) => row.documentTypeId}
        rowHref={(row) => documentsHref(basePath, { ...filters, doc: row.documentTypeId })}
        onRowClick={open}
        emptyMessage="Rien dans cette liste. Les documents apparaissent ici dès que leur état change."
      />

      {/* Le panneau est monté AVANT l'aperçu dans le DOM ; l'aperçu étant un portail
          au-dessus (z-50), il prend le dessus comme attendu. */}
      {mounted && opened && (
        <Sheet title={opened.label} onClose={close}>
          <DocumentSheetBody
            item={opened}
            categoryLabel={DOCUMENT_CATEGORY_LABELS[opened.category]}
            establishmentId={establishmentId}
            canEditScope={canEditScope}
          />
        </Sheet>
      )}

      {/* Fermer l'aperçu laisse le panneau ouvert : on referme ce qu'on vient
          d'ouvrir par-dessus, pas la fiche en dessous. */}
      {mounted && preview && <FilePreviewModal preview={preview} onClose={() => setPreviewOpen(false)} />}
    </>
  );
}
