import Link from "next/link";
import type { ReactNode } from "react";
import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { getEstablishment } from "@/lib/actions/establishment";
import { getEstablishmentChecklist } from "@/lib/actions/checklist";
import { formatDate } from "@/lib/services/date-format-service";
import { ESTABLISHMENT_TYPE_LABELS, STRUCTURE_TYPE_LABELS } from "@/lib/services/structure-identity-service";
import { DOCUMENT_CATEGORY_LABELS, flattenChecklist } from "@/lib/services/structure-documents-service";
import { structureHref } from "@/lib/design/structure-tabs";
import { Button } from "@/components/ui/button";
import { InviteClientForm } from "@/components/etablissement/InviteClientForm";
import { ClientUserRow } from "@/components/etablissement/ClientUserRow";
import { EstablishmentLogoForm } from "@/components/etablissement/EstablishmentLogoForm";
import { DocumentScopeToggle } from "@/components/checklist/DocumentScopeToggle";

export const metadata = { title: "Réglages · EODA Conseil" };

type Props = { params: Promise<{ id: string }> };

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-xl border border-line bg-card p-5">
      <div>
        <h2 id={id} className="text-xl font-bold text-ink">
          {title}
        </h2>
        {description && <p className="mt-1 text-ink2">{description}</p>}
      </div>
      {children}
    </section>
  );
}

// Réglages de la fiche : identité, comptes clients, logo, documents réclamés. Ce sont
// les outils d'administration de l'ancienne fiche, regroupés ; chaque geste garde son
// action serveur et sa garde.
export default async function StructureSettingsPage({ params }: Props) {
  const { id } = await params;
  const { role } = await requireEstablishmentInTenant(id);
  const [establishment, checklist] = await Promise.all([getEstablishment(id), getEstablishmentChecklist(id)]);
  // Basculer un document entre « réclamé » et « produit par EODA » vaut pour tous
  // les clients : politique de cabinet, réservée à CABINET_ADMIN (l'action le
  // revérifie).
  const isAdmin = role === "CABINET_ADMIN";
  const documents = flattenChecklist(checklist);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section id="settings-identity" title="Identité de la structure">
        <dl className="space-y-2">
          <div>
            <dt className="text-sm text-ink2">Type de SAD · statut juridique</dt>
            <dd className="text-ink">
              {ESTABLISHMENT_TYPE_LABELS[establishment.type]} ·{" "}
              {establishment.structureType ? STRUCTURE_TYPE_LABELS[establishment.structureType] : "Statut juridique non renseigné"}
            </dd>
          </div>
          {establishment.finessNumber && (
            <div>
              <dt className="text-sm text-ink2">FINESS</dt>
              <dd className="tabular-nums text-ink">{establishment.finessNumber}</dd>
            </div>
          )}
          {/* Le SIRET est le seul champ d'identité rendu ABSENT plutôt qu'omis : il
              est facultatif à la saisie (il ne bloque aucune signature), mais il
              devra figurer sur la première facture. Le taire garantirait de s'en
              apercevoir ce jour-là. */}
          <div>
            <dt className="text-sm text-ink2">SIRET</dt>
            <dd className={establishment.siretNumber ? "tabular-nums text-ink" : "font-bold text-ink"}>
              {establishment.siretNumber ?? "À renseigner"}
            </dd>
          </div>
          {establishment.address && (
            <div>
              <dt className="text-sm text-ink2">Adresse</dt>
              <dd className="text-ink">{establishment.address}</dd>
            </div>
          )}
          {establishment.hasEvaluationTargetDate && (
            <div>
              <dt className="text-sm text-ink2">Évaluation HAS visée</dt>
              <dd className="tabular-nums text-ink">{formatDate(establishment.hasEvaluationTargetDate)}</dd>
            </div>
          )}
        </dl>
        <Button variant="outline" asChild>
          <Link href={structureHref(id, "modifier")}>Modifier la fiche</Link>
        </Button>
      </Section>

      <Section
        id="settings-accounts"
        title="Comptes clients"
        description={
          establishment.establishmentUsers.length === 0
            ? "Aucun interlocuteur côté client pour l'instant."
            : `${establishment.establishmentUsers.length} interlocuteur(s) rattaché(s).`
        }
      >
        {establishment.establishmentUsers.length > 0 && (
          <ul className="divide-y divide-line">
            {establishment.establishmentUsers.map(({ user, roleInEstablishment }) => (
              <ClientUserRow
                key={user.id}
                establishmentId={establishment.id}
                user={{ id: user.id, name: user.name, email: user.email, isActive: user.isActive }}
                roleInEstablishment={roleInEstablishment}
              />
            ))}
          </ul>
        )}
        <div className="border-t border-line pt-4">
          <h3 className="mb-1 font-bold text-ink">Inviter un interlocuteur</h3>
          <p className="mb-3 text-sm text-ink2">
            Le mot de passe temporaire généré s&apos;affiche une seule fois — communiquez-le par e-mail.
          </p>
          <InviteClientForm establishmentId={establishment.id} />
        </div>
      </Section>

      <Section
        id="settings-logo"
        title="Logo de la structure"
        description="Il figure sur les documents que la plateforme produit pour cette structure. Sans logo déposé, c'est son nom qui est écrit."
      >
        <EstablishmentLogoForm
          establishmentId={establishment.id}
          establishmentName={establishment.name}
          logoDataUri={establishment.logoDataUri}
        />
      </Section>

      <Section
        id="settings-requested"
        title="Documents réclamés à la structure"
        description={
          isAdmin
            ? "Ce qu'on réclame au client n'est pas tout ce qu'EODA produit pour lui. Ce réglage vaut pour toutes les structures."
            : "Ce qu'on réclame au client n'est pas tout ce qu'EODA produit pour lui. Seul un administrateur du cabinet peut modifier cette liste."
        }
      >
        <ul className="divide-y divide-line">
          {documents.map((doc) => (
            <li key={doc.documentTypeId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="flex flex-col">
                <span className="text-ink">{doc.label}</span>
                <span className="text-sm text-ink2">{DOCUMENT_CATEGORY_LABELS[doc.category]}</span>
              </span>
              <DocumentScopeToggle
                documentTypeId={doc.documentTypeId}
                requestedFromClient={doc.requestedFromClient}
                canEdit={isAdmin}
              />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
