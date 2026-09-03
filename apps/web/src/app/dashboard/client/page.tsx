import { getClientChecklist } from "@/lib/actions/checklist";
import { listClientAppointments } from "@/lib/actions/appointment";
import { AppointmentList } from "@/components/agenda/AppointmentList";
import { ChecklistCategory } from "@/components/checklist/ChecklistCategory";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Building2,
  AlertTriangle,
  ShieldAlert,
  ArrowDown,
  CheckCircle2,
  Clock,
  Archive,
  BellRing,
  CalendarDays,
} from "lucide-react";
import {
  describeClientNextStep,
  documentProgressPercent,
  summariseDocumentObligations,
} from "@/lib/services/client-contract-service";
import type { DocumentCategory } from "@eoda/database";
import { canDepositDocuments } from "@/lib/services/mission-access-service";

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
  // « Savoir quand sont ses prochains points, que ce soit en visio ou en présentiel. »
  // Lecture seule : le client lit son agenda, il ne le pilote pas. Les deux lectures
  // partent ensemble — l'agenda ne dépend pas de la checklist.
  const [{ establishment, checklist, missionAccess, libraryUpdateAlert }, appointments] =
    await Promise.all([getClientChecklist(), listClientAppointments(4)]);

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
  // Comptage délégué au service partagé avec « Mon accompagnement » : les deux
  // pages du portail affichent les mêmes nombres, elles ne peuvent pas les
  // recalculer chacune de son côté sans finir par diverger (D1).
  const summary = summariseDocumentObligations(Object.values(checklist).flat());
  const totalItems = summary.total;
  const progressPct = documentProgressPercent(summary);

  // Bibliothèque : la checklist reste lisible, les dépôts s'arrêtent.
  const depositOpen = canDepositDocuments(missionAccess);
  const nextStep = describeClientNextStep(summary, depositOpen);

  // Les quatre états RÉELS, plus deux regroupements qui mentaient.
  //
  // « Manquants » additionnait les pièces à fournir ET celles que le client avait déjà
  // justifiées : il voyait « 5 manquants » après avoir répondu sur trois d'entre elles,
  // et son travail ne se voyait nulle part. « En cours » mélangeait ce qu'EODA relit et
  // ce qui ne s'applique pas à la structure — deux choses qui n'appellent pas du tout
  // la même réaction.
  //
  // Le service produisait déjà ces quatre nombres séparément ; c'est l'écran qui les
  // recollait.
  const stats = [
    {
      label: "À déposer",
      value: summary.toDeposit,
      icon: AlertTriangle,
      color: "text-rouge-imp bg-rouge-imp/10",
    },
    {
      label: "En cours de relecture",
      value: summary.inReview,
      icon: Clock,
      color: "text-ambre bg-ambre/10",
    },
    {
      label: "Conformes",
      value: summary.compliant,
      icon: CheckCircle2,
      color: "text-vert-ok bg-vert-ok/10",
    },
    {
      label: "Non concernés",
      value: summary.justified + summary.notApplicable,
      icon: Archive,
      color: "text-gris-mid bg-gris-light/40",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={establishment.name}
        subtitle="Checklist documentaire — Préparation évaluation HAS"
        icon={Building2}
        accent="ambre"
      />

      {/* CE QU'IL RESTE À FAIRE, avant tout le reste.
          Le portail disait où en était le dossier — quatre nombres et une barre — sans
          jamais répondre à la question qui amène le client ici : « et moi, qu'est-ce
          que j'ai à faire ? ». Il fallait la reconstituer en comparant des compteurs,
          ce qui est exactement le travail qu'un portail existe pour éviter. */}
      {nextStep && (
        <div
          className={`flex items-start gap-3 rounded-lg border px-5 py-4 ${
            nextStep.tone === "ACTION"
              ? "border-terre/40 bg-terre/[0.07]"
              : "border-gris-light bg-white"
          }`}
        >
          {nextStep.tone === "ACTION" ? (
            <ArrowDown className="mt-0.5 h-5 w-5 flex-shrink-0 text-terre" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-vert-ok" aria-hidden="true" />
          )}
          <div className="text-sm">
            <p className="font-semibold text-brun-ancre">{nextStep.title}</p>
            <p className="text-gris-mid">{nextStep.detail}</p>
          </div>
        </div>
      )}

      {/* Fin d'accompagnement — dit ce qui change ET ce qui ne change pas. Un
          portail qui se ferme sans explication ressemble à une panne. */}
      {!depositOpen && (
        <div className="flex items-start gap-3 bg-ivoire border border-gris-light rounded-lg px-5 py-4">
          <Archive className="w-5 h-5 text-ambre flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-brun-ancre">Accompagnement terminé</p>
            <p className="text-gris-mid">
              Vos documents restent consultables et téléchargeables. Aucun nouveau dépôt
              n&apos;est possible : contactez votre consultant EODA pour reprendre un
              accompagnement.
            </p>
          </div>
        </div>
      )}

      {/* Alerte du 5ᵉ mois (§12.5) : rien ne se ferme, mais des documents figés
          depuis cinq mois commencent à dater — le référentiel HAS évolue. */}
      {libraryUpdateAlert && (
        <div className="flex items-start gap-3 bg-ambre/10 border border-ambre/30 rounded-lg px-5 py-4">
          <BellRing className="w-5 h-5 text-ambre flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-brun-ancre">Vos documents datent de plus de cinq mois</p>
            <p className="text-gris-mid">
              Le référentiel HAS et les obligations documentaires évoluent. Un point de
              mise à jour avec EODA Conseil permet de vérifier que votre bibliothèque
              est toujours à jour.
            </p>
          </div>
        </div>
      )}

      {/* Prochains rendez-vous, avant la checklist : c'est la question qu'on se pose
          en ouvrant son espace, et la seule à laquelle une date répond. */}
      <section className="bg-white border border-gris-light rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-terre" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-brun-ancre">Vos prochains rendez-vous</h2>
        </div>
        <AppointmentList
          appointments={appointments}
          readOnly
          emptyMessage="Aucun rendez-vous programmé pour l'instant. Votre consultant EODA vous proposera les prochaines dates."
        />
      </section>

      {/* Progression globale */}
      <div className="bg-white border border-gris-light rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-brun-ancre">Progression globale</span>
          <span className="text-gris-mid tabular-nums">
            {summary.compliant} / {totalItems} documents conformes
          </span>
        </div>
        <ProgressBar value={progressPct} colorClassName="bg-vert-ok" />
        <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-4">
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
              canDeposit={depositOpen}
            />
          );
        })}
      </div>
    </div>
  );
}
