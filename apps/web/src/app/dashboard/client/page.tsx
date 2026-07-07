import { getClientChecklist } from "@/lib/actions/checklist";
import { ChecklistCategory } from "@/components/checklist/ChecklistCategory";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageHeader } from "@/components/layout/PageHeader";
import { Building2, AlertTriangle, ShieldAlert, CheckCircle2, Clock } from "lucide-react";
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
        <PageHeader title="Espace Client" icon={Building2} accent="ambre" />
        <div className="flex items-start gap-3 bg-ambre/10 border border-ambre/30 rounded-lg px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-ambre flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-brun-ancre">Aucun établissement rattaché</p>
            <p className="text-gris-mid">
              Votre consultant EODA doit d&apos;abord vous rattacher à votre établissement.
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
  const allItems = Object.values(checklist).flat();
  const totalItems = allItems.length;
  const missingCount = allItems.filter((i) => i.status === "MISSING").length;
  const compliantCount = allItems.filter((i) => i.status === "COMPLIANT").length;
  const otherCount = totalItems - missingCount - compliantCount;
  const progressPct = totalItems > 0 ? Math.round((compliantCount / totalItems) * 100) : 0;

  const stats = [
    { label: "Manquants", value: missingCount, icon: AlertTriangle, color: "text-rouge-imp bg-rouge-imp/10" },
    { label: "Conformes", value: compliantCount, icon: CheckCircle2, color: "text-vert-ok bg-vert-ok/10" },
    { label: "En cours", value: otherCount, icon: Clock, color: "text-ambre bg-ambre/10" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={establishment.name}
        subtitle="Checklist documentaire — Préparation évaluation HAS"
        icon={Building2}
        accent="ambre"
      />

      {/* Progression globale */}
      <div className="bg-white border border-gris-light rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-brun-ancre">Progression globale</span>
          <span className="text-gris-mid tabular-nums">
            {compliantCount} / {totalItems} documents conformes
          </span>
        </div>
        <ProgressBar value={progressPct} colorClassName="bg-vert-ok" />
        <div className="grid grid-cols-3 gap-3 pt-1">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex items-center gap-2.5">
              <span className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${color}`}>
                <Icon className="w-4 h-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brun-ancre tabular-nums leading-none">{value}</p>
                <p className="text-xs text-gris-mid leading-none mt-1">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Avertissement déontologique */}
      <p className="flex items-start gap-2 text-xs text-gris-mid bg-ivoire border border-gris-light rounded-lg px-4 py-3">
        <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
        Outil de préparation interne EODA Conseil · Auto-évaluation préparatoire uniquement ·
        Non officiel HAS · Les statuts affichés sont indicatifs et n&apos;engagent pas EODA Conseil.
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
