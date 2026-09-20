"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Folder, FileText, ChevronRight, ChevronLeft, Search, FolderOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  TEMPLATE_STAGES,
  TEMPLATE_STAGE_LABELS,
} from "@/lib/services/template-library-service";
import { formatDate } from "@/lib/services/date-format-service";
import type { LibraryFolder, TemplateSummary } from "@/lib/actions/template-library";

type Kind = "GABARIT" | "REFERENCE";

// ─────────────────────────────────────────────────────────────────────────────
// PARCOURS DE LA BIBLIOTHÈQUE — deux espaces (Gabarits EODA / Documents de
// référence, cf. TemplateDocumentKind), rangés en grille plutôt qu'en liste
// pleine largeur, et parcourus dossier par dossier plutôt que tout affiché
// d'un coup (retour du 20/09/2026, proposition validée par Damon).
//
// Le classement suit les dossiers existants (TemplateCategory, créés et
// ordonnés à la main par le cabinet) — PAS le chapitre/thématique HAS : cette
// réorganisation plus profonde reste une décision à prendre avec Sandrine
// (cf. proposition du 20/09), distincte de ce redesign visuel.
// ─────────────────────────────────────────────────────────────────────────────
export function LibraryBrowser({
  folders,
  hasCriterionFilter,
}: {
  folders: LibraryFolder[];
  // Une bibliothèque non vide filtrée à zéro résultat n'est pas une bibliothèque
  // vide : le message d'amorçage serait faux (cf. page.tsx).
  hasCriterionFilter: boolean;
}) {
  const [activeKind, setActiveKind] = useState<Kind>("GABARIT");
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const foldersForKind = useMemo(
    () =>
      folders
        .map((folder) => ({
          ...folder,
          templates: folder.templates.filter((t) => t.kind === activeKind),
        }))
        .filter((folder) => folder.templates.length > 0),
    [folders, activeKind]
  );

  const gabaritCount = folders.reduce(
    (total, f) => total + f.templates.filter((t) => t.kind === "GABARIT").length,
    0
  );
  const referenceCount = folders.reduce(
    (total, f) => total + f.templates.filter((t) => t.kind === "REFERENCE").length,
    0
  );

  const trimmedQuery = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (trimmedQuery.length === 0) return null;
    return foldersForKind.flatMap((folder) =>
      folder.templates
        .filter((t) => t.title.toLowerCase().includes(trimmedQuery))
        .map((t) => ({ template: t, folderName: folder.name }))
    );
  }, [foldersForKind, trimmedQuery]);

  const openFolder = openFolderId ? foldersForKind.find((f) => f.id === openFolderId) : undefined;

  function switchKind(kind: Kind) {
    setActiveKind(kind);
    setOpenFolderId(null);
    setQuery("");
  }

  if (foldersForKind.length === 0 && trimmedQuery.length === 0) {
    return (
      <div className="space-y-4">
        <KindTabs
          active={activeKind}
          gabaritCount={gabaritCount}
          referenceCount={referenceCount}
          onChange={switchKind}
        />
        <Card>
          <CardContent className="space-y-2 pt-6 text-sm text-gris-mid">
            {hasCriterionFilter ? (
              <p>Aucun modèle rattaché à ce critère pour l&apos;instant.</p>
            ) : activeKind === "GABARIT" ? (
              <>
                <p className="flex items-center gap-2 font-medium text-brun-ancre">
                  <FolderOpen className="h-4 w-4 text-terre" aria-hidden="true" />
                  Aucun gabarit pour l&apos;instant.
                </p>
                <p>
                  Le plus rapide : importez un dossier de votre poste — chaque
                  sous-dossier devient une fiche, et vous relisez le rangement proposé
                  avant que quoi que ce soit ne soit enregistré.
                </p>
              </>
            ) : (
              <p>Aucun document de référence pour l&apos;instant.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <KindTabs
          active={activeKind}
          gabaritCount={gabaritCount}
          referenceCount={referenceCount}
          onChange={switchKind}
        />
        <div className="relative w-full max-w-xs sm:w-64">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gris-mid"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpenFolderId(null);
            }}
            placeholder="Rechercher un modèle..."
            className="h-9 pl-8 text-sm"
            aria-label="Rechercher un modèle par titre"
          />
        </div>
      </div>

      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-xs text-gris-mid">
        {openFolder ? (
          <>
            <button
              type="button"
              onClick={() => setOpenFolderId(null)}
              className="flex cursor-pointer items-center gap-1 hover:text-terre"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {activeKind === "GABARIT" ? "Gabarits EODA" : "Documents de référence"}
            </button>
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <span className="font-medium text-brun-ancre">{openFolder.name}</span>
          </>
        ) : (
          <span>{activeKind === "GABARIT" ? "Gabarits EODA" : "Documents de référence"}</span>
        )}
      </nav>

      {searchResults ? (
        searchResults.length === 0 ? (
          <p className="text-sm text-gris-mid">Aucun modèle ne correspond à « {query} ».</p>
        ) : (
          <TileGrid>
            {searchResults.map(({ template, folderName }) => (
              <TemplateTile key={template.id} template={template} subtitle={folderName} />
            ))}
          </TileGrid>
        )
      ) : openFolder ? (
        <TileGrid>
          {openFolder.templates.map((template) => (
            <TemplateTile key={template.id} template={template} />
          ))}
        </TileGrid>
      ) : (
        <TileGrid>
          {foldersForKind.map((folder) => (
            <FolderTile
              key={folder.id}
              name={folder.name}
              count={folder.templates.length}
              onOpen={() => setOpenFolderId(folder.id)}
            />
          ))}
        </TileGrid>
      )}
    </div>
  );
}

function KindTabs({
  active,
  gabaritCount,
  referenceCount,
  onChange,
}: {
  active: Kind;
  gabaritCount: number;
  referenceCount: number;
  onChange: (kind: Kind) => void;
}) {
  return (
    <div className="flex gap-4 border-b border-gris-light">
      <TabButton active={active === "GABARIT"} onClick={() => onChange("GABARIT")}>
        Gabarits EODA
        <span className="ml-1.5 text-xs font-normal text-gris-mid">{gabaritCount}</span>
      </TabButton>
      <TabButton active={active === "REFERENCE"} onClick={() => onChange("REFERENCE")}>
        Documents de référence
        <span className="ml-1.5 text-xs font-normal text-gris-mid">{referenceCount}</span>
      </TabButton>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`-mb-px cursor-pointer border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
        active
          ? "border-terre text-terre"
          : "border-transparent text-gris-mid hover:text-brun-ancre"
      }`}
    >
      {children}
    </button>
  );
}

function TileGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
  );
}

function FolderTile({ name, count, onOpen }: { name: string; count: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col items-start gap-2 rounded-xl border border-gris-light bg-surface p-3.5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-eoda-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre focus-visible:ring-offset-2"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-terre/10">
        <Folder className="h-4.5 w-4.5 text-terre" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-brun-ancre">{name}</span>
        <span className="block text-xs text-gris-mid">
          {count} modèle{count !== 1 ? "s" : ""}
        </span>
      </span>
    </button>
  );
}

function TemplateTile({ template, subtitle }: { template: TemplateSummary; subtitle?: string }) {
  return (
    <Link
      href={`/dashboard/cabinet/modeles/${template.id}`}
      className="flex flex-col items-start gap-2 rounded-xl border border-gris-light bg-surface p-3.5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-eoda-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre focus-visible:ring-offset-2"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brun-ancre/10">
        <FileText className="h-4.5 w-4.5 text-brun-moyen" aria-hidden="true" />
      </span>
      <span className="min-w-0 w-full">
        <span className="block truncate text-sm font-semibold text-brun-ancre">{template.title}</span>
        {subtitle && <span className="block truncate text-xs text-gris-mid">{subtitle}</span>}
        <span className="mt-1 block text-xs text-gris-mid">
          mis à jour le {formatDate(template.updatedAt)}
        </span>
        <span className="mt-1.5 flex flex-wrap gap-1">
          {template.kind === "REFERENCE" ? (
            <Badge variant="secondary">Référence</Badge>
          ) : (
            TEMPLATE_STAGES.map((stage) =>
              template.stages.includes(stage) ? (
                <Badge key={stage} variant="secondary">
                  {TEMPLATE_STAGE_LABELS[stage]}
                </Badge>
              ) : (
                <Badge key={stage} variant="not_applicable">
                  {TEMPLATE_STAGE_LABELS[stage]} manquante
                </Badge>
              )
            )
          )}
        </span>
      </span>
    </Link>
  );
}
