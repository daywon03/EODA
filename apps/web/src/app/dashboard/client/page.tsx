import Link from "next/link";
import { requireClientEstablishment } from "@/lib/auth/guards";
import { clientAllows, NEED } from "@/lib/auth/capabilities";
import { LimitedClientHome } from "@/components/client/home/LimitedClientHome";
import { getClientGreetingName } from "@/lib/actions/client-greeting";
import { getClientChecklist } from "@/lib/actions/checklist";
import { listClientAppointments } from "@/lib/actions/appointment";
import { getClientContract } from "@/lib/actions/client-contract";
import {
  uploadEstablishmentLogoAsClient,
  removeEstablishmentLogoAsClient,
} from "@/lib/actions/establishment";
import { describeClientNextStep, summariseDocumentObligations } from "@/lib/services/client-contract-service";
import { canDepositDocuments } from "@/lib/services/mission-access-service";
import { flattenChecklist } from "@/lib/services/structure-documents-service";
import {
  buildClientWorkList,
  countClientFilters,
  depositNoticeFor,
  describeWorkList,
  documentsToDeposit,
  greetingFor,
  toClientDocumentRow,
} from "@/lib/services/client-documents-view-service";
import { SUPPORT_OPTION_CODE } from "@/lib/services/support-mode-service";
import { CLIENT_DOCUMENTS_PATH } from "@/lib/design/client-navigation";
import { EstablishmentLogoForm } from "@/components/etablissement/EstablishmentLogoForm";
import { DepositButton } from "@/components/client/documents/DepositButton";
import { AccompaniedHomeCard, AutonomyHomeCard } from "@/components/client/home/HomeSupportCards";

export const metadata = { title: "Accueil" };

// ACCUEIL DU PORTAIL CLIENT (maquette « Portail Client v2 », R6).
//
// Une question d'abord : « et moi, qu'est-ce que j'ai à faire ? » (la prochaine
// chose à faire), puis les pièces à déposer, puis l'encart propre au mode — liste de
// travail et « Être accompagné » en autonomie, équipe EODA et rendez-vous en
// accompagnement. L'anneau « critères impératifs prouvés » attend la tranche N4
// (liaison type ↔ critère) : il n'est pas affiché tant qu'il ne peut pas être vrai.
export default async function ClientHomePage() {
  // Rôle d'accès d'abord (N9) : l'accueil complet lit les documents, les rendez-vous
  // et le contrat ; un rôle qui n'a pas les documents (intervenant) reçoit un accueil
  // réduit à ce qu'il peut faire — ses lectures gardées le renverraient ici en boucle.
  const { accessRole } = await requireClientEstablishment("HOME");
  if (accessRole && !clientAllows(accessRole, NEED.DOCUMENTS_READ)) {
    return <LimitedClientHome accessRole={accessRole} firstName={await getClientGreetingName()} />;
  }
  const canSeeAppointments = !accessRole || clientAllows(accessRole, { module: "MESSAGES", mode: "READ" });
  const canSeeContract = !accessRole || clientAllows(accessRole, { module: "CONTRACT", mode: "READ" });
  const [data, appointments] = await Promise.all([
    getClientChecklist(),
    canSeeAppointments ? listClientAppointments(3) : Promise.resolve([]),
  ]);
  const { establishment, checklist, missionAccess, libraryUpdateAlert, supportMode, userName } = data;

  if (!establishment) {
    return (
      <div className="space-y-3">
        <h1 className="text-[36px] font-bold leading-tight">{greetingFor(userName)}</h1>
        <p>Votre espace n&apos;est pas encore rattaché à une structure. Écrivez à EODA : EODAconseil@outlook.com.</p>
      </div>
    );
  }

  const items = flattenChecklist(checklist);
  const rows = items.map((item) => toClientDocumentRow(item, supportMode));
  const depositOpen = canDepositDocuments(missionAccess);
  const nextStep = describeClientNextStep(summariseDocumentObligations(items), depositOpen, supportMode);
  const toDeposit = documentsToDeposit(rows, 4);
  const counts = countClientFilters(rows);
  const workList = buildClientWorkList(rows);
  const first = toDeposit[0];

  // « Être accompagné » : la ligne de catalogue, si Sandrine l'a créée.
  const supportOption =
    supportMode === "AUTONOMIE" && canSeeContract
      ? ((await getClientContract()).availableOptions.find((option) => option.code === SUPPORT_OPTION_CODE) ?? null)
      : null;

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-[36px] font-bold leading-tight">{greetingFor(userName)}</h1>
        <p className="mt-2 max-w-[60ch] text-[21px]">
          {counts.accepte} document{counts.accepte > 1 ? "s" : ""} accepté{counts.accepte > 1 ? "s" : ""}.{" "}
          {counts["a-deposer"]} à déposer.
        </p>
      </div>

      {!depositOpen && (
        <p className="rounded-xl border border-line bg-soft px-5 py-4">
          L&apos;accompagnement est terminé. Vos documents restent consultables. Aucun nouveau dépôt n&apos;est
          possible. Écrivez à EODA pour reprendre.
        </p>
      )}

      {libraryUpdateAlert && (
        <p className="rounded-xl border border-ambre bg-amber-fill px-5 py-4">
          <strong>Vos documents datent de plus de cinq mois.</strong> Le référentiel HAS évolue. Un point avec EODA
          permet de vérifier qu&apos;ils sont à jour.
        </p>
      )}

      {nextStep && (
        <section
          aria-labelledby="prochaine-etape"
          className={`flex flex-col gap-3.5 rounded-2xl bg-card p-7 ${
            nextStep.tone === "ACTION" ? "border-2 border-accent-fill" : "border border-line"
          }`}
        >
          <p className="text-[17px] font-bold text-accent-text">La prochaine chose à faire</p>
          <h2 id="prochaine-etape" className="text-[28px] font-bold leading-tight">
            {first && nextStep.tone === "ACTION" ? `Déposer : ${first.label}` : nextStep.title}
          </h2>
          <p>{nextStep.detail}</p>
          {first && depositOpen && (
            <div className="mt-1.5">
              <DepositButton
                establishmentId={establishment.id}
                documentTypeId={first.documentTypeId}
                documentLabel={first.label}
                notice={depositNoticeFor(first.code)}
                label="Déposer ce document"
                large
              />
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="a-deposer" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="a-deposer" className="text-2xl font-bold">
            Documents à déposer
          </h2>
          <Link href={CLIENT_DOCUMENTS_PATH} className="py-2.5 text-lg font-bold text-accent-text">
            Tous mes documents →
          </Link>
        </div>
        {toDeposit.length === 0 ? (
          <div className="rounded-xl border border-line bg-card p-6 text-center">
            <p className="font-bold">Tous les documents sont déposés.</p>
            <p className="text-ink2">Vérifiez les analyses dans « Mes documents ».</p>
          </div>
        ) : (
          toDeposit.map((row) => (
            <div key={row.documentTypeId} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-card px-5 py-4">
              <div className="flex min-w-[240px] flex-1 flex-col">
                <span className="font-bold">{row.label}</span>
                {depositNoticeFor(row.code) && <span className="text-base text-ink2">{depositNoticeFor(row.code)}</span>}
              </div>
              {depositOpen && (
                <DepositButton
                  establishmentId={establishment.id}
                  documentTypeId={row.documentTypeId}
                  documentLabel={row.label}
                  notice={depositNoticeFor(row.code)}
                />
              )}
            </div>
          ))
        )}
      </section>

      {supportMode === "AUTONOMIE" ? (
        <AutonomyHomeCard
          workTitle={describeWorkList(workList.length)}
          hasWork={workList.length > 0}
          supportOption={supportOption}
        />
      ) : (
        <AccompaniedHomeCard appointments={appointments} />
      )}

      {/* Le logo de la structure : son identité, déposée par elle. Masqué en
          bibliothèque — l'action serveur le refuserait de toute façon. */}
      {depositOpen && (!accessRole || clientAllows(accessRole, NEED.ACCESS_WRITE)) && (
        <section aria-labelledby="logo" className="flex flex-col gap-3 rounded-xl border border-line bg-card p-5">
          <h2 id="logo" className="text-xl font-bold">
            Logo de votre structure
          </h2>
          <p className="text-base text-ink2">Il figure sur les documents produits pour vous, à côté du logo EODA.</p>
          <EstablishmentLogoForm
            establishmentId={establishment.id}
            establishmentName={establishment.name}
            logoDataUri={establishment.logoDataUri}
            uploadAction={uploadEstablishmentLogoAsClient}
            removeAction={removeEstablishmentLogoAsClient}
          />
        </section>
      )}

      <p className="text-base text-ink2">
        Outil de préparation EODA Conseil. Ce n&apos;est pas une évaluation officielle de la HAS.
      </p>
    </div>
  );
}
