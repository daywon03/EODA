import { getClientChecklist } from "@/lib/actions/checklist";
import { ChecklistCategory } from "@/components/checklist/ChecklistCategory";
import { Building2, AlertTriangle } from "lucide-react";
import type { DocumentCategory } from "@eoda/database";

export const metadata = { title: "Espace Client · EODA Conseil" };

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  LOI_2002_2: "Documents loi 2002-2 (droits des personnes accompagnées)",
  FONCTIONNEMENT: "Fonctionnement de la structure",
  QUALITE_RISQUES: "Démarche qualité et gestion des risques",
  RH: "Ressources humaines",
};

// Loi 2002-2 ouverte par défaut — c'est la catégorie la plus structurante
const DEFAULT_OPEN: DocumentCategory[] = ["LOI_2002_2"];

export default async function ClientDashboardPage() {
  const { establishment, checklist } = await getClientChecklist();

  if (!establishment) {
    return (
      <div className="space-y-6">
        <div className="border-l-4 border-ambre pl-5 py-1">
          <h1 className="text-2xl font-bold text-brun-ancre">Espace Client</h1>
        </div>
        <div className="flex items-start gap-3 bg-ambre/10 border border-ambre/30 rounded-lg px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-ambre flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-brun-ancre">Aucun établissement rattaché</p>
            <p className="text-gris-mid">
              Votre consultant EODA doit d'abord vous rattacher à votre établissement.
              Contactez-le à{" "}
              <a href="mailto:EODAconseil@outlook.com" className="text-terre underline">
                EODAconseil@outlook.com
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const categories = Object.keys(CATEGORY_LABELS) as DocumentCategory[];
  const totalItems = Object.values(checklist).flat().length;
  const missingCount = Object.values(checklist).flat().filter((i) => i.status === "MISSING").length;
  const compliantCount = Object.values(checklist).flat().filter((i) => i.status === "COMPLIANT").length;
  const progressPct = totalItems > 0 ? Math.round((compliantCount / totalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="border-l-4 border-ambre pl-5 py-1">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-ambre" />
          <h1 className="text-2xl font-bold text-brun-ancre">{establishment.name}</h1>
        </div>
        <p className="text-gris-mid text-sm mt-1">Checklist documentaire — Préparation évaluation HAS</p>
      </div>

      {/* Barre de progression globale */}
      <div className="bg-white border border-gris-light rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-brun-ancre">Progression globale</span>
          <span className="text-gris-mid">
            {compliantCount} / {totalItems} documents conformes
          </span>
        </div>
        <div className="h-2.5 bg-gris-light rounded-full overflow-hidden">
          <div
            className="h-full bg-vert-ok rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex gap-4 text-xs text-gris-mid">
          <span className="text-rouge-imp font-medium">{missingCount} manquant{missingCount > 1 ? "s" : ""}</span>
          <span className="text-vert-ok font-medium">{compliantCount} conforme{compliantCount > 1 ? "s" : ""}</span>
          <span>{totalItems - missingCount - compliantCount} autre{totalItems - missingCount - compliantCount > 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Avertissement déontologique */}
      <p className="text-xs text-gris-mid bg-ivoire border border-gris-light rounded px-4 py-2">
        Outil de préparation interne EODA Conseil · Auto-évaluation préparatoire uniquement ·
        Non officiel HAS · Les statuts affichés sont indicatifs et n'engagent pas EODA Conseil.
      </p>

      {/* Checklist par catégorie */}
      <div className="space-y-3">
        {categories.map((cat) => {
          const items = checklist[cat] ?? [];
          if (items.length === 0) return null;
          return (
            <ChecklistCategory
              key={cat}
              title={CATEGORY_LABELS[cat]}
              items={items}
              defaultOpen={DEFAULT_OPEN.includes(cat)}
              establishmentId={establishment.id}
            />
          );
        })}
      </div>
    </div>
  );
}
