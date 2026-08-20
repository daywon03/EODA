import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileSignature,
  FileText,
  Info,
  MessageSquareWarning,
  Package,
  ReceiptText,
  Search,
  ShieldAlert,
  Sparkles,
  Upload,
} from "lucide-react";
import { getClientContract } from "@/lib/actions/client-contract";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RequestOptionQuoteForm } from "@/components/client/RequestOptionQuoteForm";
import { formatEuros, formatPriceWithUnit, formatStartingPrice } from "@/lib/services/price-format-service";

export const metadata = { title: "Mon accompagnement · EODA Conseil" };

// « Ce que j'ai payé / ce que je dois donner en face. »
// Périmètre visible par un CLIENT_USER : exception du 20/08/2026, .claude/CLAUDE.md §7.
// Deux natures de prix cohabitent ici et sont rendues DIFFÉREMMENT, volontairement :
//   - les montants du devis signé, fermes, via formatEuros / formatPriceWithUnit ;
//   - les prix du catalogue, indicatifs, via formatStartingPrice (« À partir de »).
// Confondre les deux, c'est transformer une estimation en engagement.

function SectionTitle({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Package;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-5 h-5 text-terre flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <h2 className="text-base font-semibold text-brun-ancre leading-tight">{title}</h2>
        {hint && <p className="text-xs text-gris-mid mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

function AmountTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-ivoire border border-gris-light rounded-lg px-4 py-3">
      <p className="text-xs text-gris-mid">{label}</p>
      <p className="text-lg font-bold text-brun-ancre tabular-nums leading-tight mt-1">{value}</p>
      {hint && <p className="text-[11px] text-gris-mid mt-0.5">{hint}</p>}
    </div>
  );
}

export default async function ClientAccompagnementPage() {
  const {
    establishment,
    offer,
    contract,
    subscribedOptions,
    availableOptions,
    documents,
    documentProgressPercent,
    counters,
  } = await getClientContract();

  if (!establishment) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mon accompagnement" icon={ReceiptText} accent="ambre" />
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

  const obligations = [
    {
      label: "À déposer",
      value: documents.toDeposit,
      icon: Upload,
      color: "text-rouge-imp bg-rouge-imp/10",
    },
    {
      label: "Commentés, en attente d'arbitrage",
      value: documents.justified,
      icon: MessageSquareWarning,
      color: "text-ambre bg-ambre/10",
    },
    {
      label: "Déposés, en cours de revue",
      value: documents.inReview,
      icon: Search,
      color: "text-brun-moyen bg-gris-light",
    },
    {
      label: "Conformes",
      value: documents.compliant,
      icon: CheckCircle2,
      color: "text-vert-ok bg-vert-ok/10",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon accompagnement"
        subtitle={`${establishment.name} — ce que vous avez souscrit, ce qu'il reste à fournir`}
        icon={ReceiptText}
        accent="ambre"
      />

      {/* ── 1. L'offre souscrite ─────────────────────────────────────────── */}
      <section className="bg-white border border-gris-light rounded-xl p-5 space-y-4">
        <SectionTitle
          icon={Package}
          title="Votre offre"
          hint="Le périmètre de votre accompagnement découle de cette formule."
        />

        {offer ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" className="text-sm px-3 py-1">
                {offer.label}
              </Badge>
              {offer.gratuit && <Badge variant="secondary">Bêta-test gratuit</Badge>}
              {offer.modulesLabel && (
                <span className="text-xs text-gris-mid">Modules : {offer.modulesLabel}</span>
              )}
            </div>
            {offer.description && (
              <p className="text-sm text-brun-ancre leading-relaxed">{offer.description}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gris-mid">
            Votre accompagnement n&apos;est pas encore ouvert : votre consultant EODA n&apos;a pas
            encore enregistré la formule retenue. La checklist documentaire reste consultable
            entre-temps.
          </p>
        )}
      </section>

      {/* ── 2. Les montants du contrat ───────────────────────────────────── */}
      <section className="bg-white border border-gris-light rounded-xl p-5 space-y-4">
        <SectionTitle
          icon={FileSignature}
          title="Votre contrat"
          hint="Montants fermes de votre devis signé — tarifs HT, TVA non applicable (art. 293 B du CGI)."
        />

        {contract.kind === "RESOLVED" && (
          <div className="space-y-4">
            <p className="text-sm text-brun-ancre">
              Devis <span className="font-semibold">{contract.devis.number}</span> ·{" "}
              {contract.devis.formuleLabelSnapshot}
              <Badge variant="signe" className="ml-2 align-middle">
                Signé
              </Badge>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <AmountTile
                label="Total signé"
                value={formatEuros(contract.devis.totalAmountEuros)}
                hint={`dont formule ${formatEuros(contract.devis.formulePriceSnapshotEuros)}`}
              />
              <AmountTile
                label="Acompte à la commande"
                value={formatEuros(contract.devis.depositAmountEuros)}
                hint={`${contract.devis.depositPercent} % du total`}
              />
              <AmountTile label="Solde" value={formatEuros(contract.devis.balanceAmountEuros)} />
              <AmountTile
                label="Échéances"
                value={`${contract.devis.installmentCount} × ${formatEuros(
                  contract.devis.installmentAmountEuros
                )}`}
                hint="répartition du solde"
              />
            </div>
          </div>
        )}

        {contract.kind === "NO_DEVIS" && (
          <div className="flex items-start gap-3 bg-ivoire border border-gris-light rounded-lg px-4 py-3">
            <Info className="w-4 h-4 text-gris-mid flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-gris-mid">
              Aucun devis signé n&apos;est rattaché à votre établissement. Les montants de votre
              contrat ne peuvent donc pas être affichés ici — votre exemplaire signé fait foi.
              Votre périmètre d&apos;accompagnement, lui, reste celui de la formule ci-dessus.
            </p>
          </div>
        )}

        {contract.kind === "AMBIGUOUS" && (
          <div className="flex items-start gap-3 bg-ambre/10 border border-ambre/30 rounded-lg px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-ambre flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-brun-ancre">
              {contract.signedCount} devis signés sont rattachés à votre établissement. Aucun
              montant n&apos;est affiché tant que le devis contractuel n&apos;est pas identifié —
              afficher le mauvais serait pire que n&apos;en afficher aucun. Votre consultant EODA
              régularise cela avec vous.
            </p>
          </div>
        )}
      </section>

      {/* ── 3. Les options souscrites ────────────────────────────────────── */}
      <section className="bg-white border border-gris-light rounded-xl p-5 space-y-4">
        <SectionTitle
          icon={Sparkles}
          title="Vos prestations à la carte"
          hint="Options figées à la signature — le prix indiqué est celui de votre devis."
        />

        {subscribedOptions.length > 0 ? (
          <ul className="divide-y divide-gris-light">
            {subscribedOptions.map((option) => (
              <li
                key={option.catalogueOptionId}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="text-sm text-brun-ancre">{option.labelSnapshot}</span>
                <span className="text-sm font-semibold text-brun-ancre tabular-nums whitespace-nowrap">
                  {formatPriceWithUnit({
                    priceEuros: option.priceSnapshotEuros,
                    pricingUnit: option.pricingUnitSnapshot,
                    priceMaxEuros: option.priceMaxSnapshotEuros,
                    minQuantity: option.minQuantitySnapshot,
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gris-mid">
            Aucune prestation à la carte n&apos;est rattachée à votre contrat.
          </p>
        )}
      </section>

      {/* ── 4. Ce que vous devez fournir ─────────────────────────────────── */}
      <section className="bg-white border border-gris-light rounded-xl p-5 space-y-4">
        <SectionTitle
          icon={FileText}
          title="Ce que vous devez fournir"
          hint="La contrepartie documentaire de votre offre — seules les pièces couvertes par votre formule sont demandées."
        />

        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-brun-ancre">Progression documentaire</span>
          <span className="text-gris-mid tabular-nums">
            {documents.compliant} / {documents.total} pièces conformes
          </span>
        </div>
        <ProgressBar value={documentProgressPercent} colorClassName="bg-vert-ok" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {obligations.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex items-start gap-2.5">
              <span
                className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${color}`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brun-ancre tabular-nums leading-none">
                  {value}
                </p>
                <p className="text-xs text-gris-mid leading-tight mt-1">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {counters && (
          <p className="text-xs text-gris-mid border-t border-gris-light pt-3">
            Traitement EODA sur vos dépôts : {counters.deposited} document
            {counters.deposited > 1 ? "s" : ""} déposé{counters.deposited > 1 ? "s" : ""} ·{" "}
            {counters.analyzed} analysé{counters.analyzed > 1 ? "s" : ""} · {counters.modified} mis
            à jour · {counters.compliant} conforme{counters.compliant > 1 ? "s" : ""}.
          </p>
        )}

        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/client">
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            Déposer mes documents
          </Link>
        </Button>
      </section>

      {/* ── 5. Ce qui n'est pas dans votre offre ─────────────────────────── */}
      <section className="bg-white border border-gris-light rounded-xl p-5 space-y-4">
        <SectionTitle
          icon={Building2}
          title="Prestations complémentaires"
          hint="Non comprises dans votre offre. Prix indicatifs HT : le montant exact est établi par devis."
        />

        {availableOptions.length > 0 ? (
          <ul className="divide-y divide-gris-light">
            {availableOptions.map((option) => (
              <li
                key={option.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-brun-ancre">{option.label}</p>
                  <p className="text-sm text-terre font-semibold tabular-nums mt-0.5">
                    {formatStartingPrice(option)}
                  </p>
                </div>
                <RequestOptionQuoteForm
                  catalogueOptionId={option.id}
                  optionLabel={option.label}
                  alreadyRequested={option.requestState === "PENDING"}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gris-mid">
            Aucune prestation complémentaire n&apos;est proposée pour le moment.
          </p>
        )}

        <p className="flex items-start gap-2 text-xs text-gris-mid bg-ivoire border border-gris-light rounded-lg px-4 py-3">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          Une demande n&apos;engage rien et ne déclenche aucun paiement : votre consultante EODA
          vous rappelle, établit un devis puis un avenant à votre contrat. Toute prestation
          souscrite après la signature fait l&apos;objet d&apos;un avenant.
        </p>
      </section>

      {/* Avertissement déontologique — identique au reste du portail */}
      <p className="flex items-start gap-2 text-xs text-gris-mid bg-ivoire border border-gris-light rounded-lg px-4 py-3">
        <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
        Outil de préparation interne EODA Conseil · Auto-évaluation préparatoire uniquement · Non
        officiel HAS · Les montants affichés reprennent votre devis signé ; en cas d&apos;écart,
        l&apos;exemplaire contractuel signé fait foi.
      </p>
    </div>
  );
}
