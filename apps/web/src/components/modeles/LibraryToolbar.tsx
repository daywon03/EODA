"use client";

import { useEffect, useRef, useState } from "react";
import { FolderUp, FilePlus2, FolderCog, Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { FolderImport } from "@/components/modeles/FolderImport";
import { TemplateForm } from "@/components/modeles/TemplateForm";
import { CategoryManager } from "@/components/modeles/CategoryManager";
import type { CategorySummary } from "@/lib/actions/template-library";

type ActiveModal = "import" | "add" | "organize" | null;

// « + Nouveau », un seul bouton — remplace les trois panneaux repliables qui
// s'ouvraient tous en tête de page avant qu'aucun fichier ne soit visible
// (retour du 20/09/2026 : « on ne voit ni les dossiers ni les fichiers sans
// d'abord traverser trois panneaux d'action »). Les trois gestes existants ne
// changent pas — FolderImport, TemplateForm, CategoryManager sont réutilisés
// tels quels (D1) — seul l'endroit où ils vivent change : une fenêtre modale
// ouverte à la demande, plutôt que trois formulaires toujours visibles.
export function LibraryToolbar({ categories }: { categories: CategorySummary[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  function openModal(modal: ActiveModal) {
    setMenuOpen(false);
    setActiveModal(modal);
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md bg-terre px-4 text-sm font-medium text-ivoire-light shadow-eoda-sm transition-all duration-150 hover:bg-brun-moyen hover:shadow-eoda-md"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Nouveau
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-gris-light bg-surface p-1.5 shadow-eoda-md"
        >
          <MenuItem
            icon={FolderUp}
            label="Importer un dossier"
            hint="depuis votre poste"
            onClick={() => openModal("import")}
          />
          <MenuItem
            icon={FilePlus2}
            label="Ajouter un modèle"
            hint="une fiche à la fois"
            onClick={() => openModal("add")}
          />
          <MenuItem
            icon={FolderCog}
            label="Organiser les dossiers"
            hint={`${categories.length} dossier${categories.length !== 1 ? "s" : ""}`}
            onClick={() => openModal("organize")}
          />
        </div>
      )}

      {activeModal === "import" && (
        <Modal title="Importer un dossier" onClose={() => setActiveModal(null)} maxWidthClassName="max-w-2xl">
          <FolderImport onImported={() => setActiveModal(null)} />
        </Modal>
      )}
      {activeModal === "add" && (
        <Modal title="Ajouter un modèle" onClose={() => setActiveModal(null)}>
          <TemplateForm categories={categories} />
        </Modal>
      )}
      {activeModal === "organize" && (
        <Modal title="Organiser les dossiers" onClose={() => setActiveModal(null)}>
          <CategoryManager categories={categories} />
        </Modal>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: typeof FolderUp;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-ivoire"
    >
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-terre" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-brun-ancre">{label}</span>
        <span className="block text-xs text-gris-mid">{hint}</span>
      </span>
    </button>
  );
}
