"use server";

import { prisma, type CommercialTier } from "@eoda/database";
import { revalidatePath } from "next/cache";
import { requireClientEstablishment } from "@/lib/auth/guards";
import { getClientChecklist } from "@/lib/actions/checklist";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { readMissionDocumentCounters } from "@/lib/db/read-mission-document-counters";
import { firstError, optionalString, requiredString } from "@/lib/validation/form-parsers";
import type { MissionDocumentCounters } from "@/lib/services/mission-document-counters-service";
import {
  documentProgressPercent,
  isOptionSubscribed,
  listAvailableOptions,
  resolveContractDevis,
  resolveSubscribedOptions,
  summariseDocumentObligations,
  type AvailableOption,
  type ContractResolution,
  type DocumentObligationSummary,
  type SubscribedOption,
} from "@/lib/services/client-contract-service";

// ─────────────────────────────────────────────────────────────────────────────
// « MON ACCOMPAGNEMENT » — le contrat du client, vu par le client.
//
// Tout ce qui est lu ici est résolu à partir du lien EstablishmentUser de la
// SESSION (requireClientEstablishment), jamais d'un identifiant reçu de la
// requête : il n'existe aucun paramètre permettant de viser l'établissement d'un
// autre client. La seule entrée non fiable de ce module est l'identifiant
// d'option de requestOptionQuote(), et il est revalidé contre le catalogue du
// tenant de l'établissement de l'appelant avant toute écriture.
//
// Périmètre autorisé (.claude/CLAUDE.md §7, exception du 20/08/2026) : son offre,
// ses options, SES montants, et les options non souscrites en « à partir de ».
// Restent hors de portée et ne sont jamais lus ici : les autres établissements,
// les prospects, les devis non signés, les KPI commerciaux.
// ─────────────────────────────────────────────────────────────────────────────

// L'offre effectivement contractée. Vient de Mission.formule (+ gratuit), qui fait
// autorité sur le périmètre — jamais de Establishment.commercialTier, resté à
// l'affichage/historique (CLAUDE.md §7).
export type ClientOffer = {
  formule: CommercialTier;
  gratuit: boolean;
  // Libellé et modules issus de la ligne de catalogue de CETTE formule seulement.
  // Le reste du catalogue de formules n'est pas lu.
  label: string;
  modulesLabel: string | null;
  description: string | null;
};

export type ClientContractView = {
  establishment: { id: string; name: string } | null;
  offer: ClientOffer | null;
  contract: ContractResolution;
  subscribedOptions: SubscribedOption[];
  availableOptions: AvailableOption[];
  documents: DocumentObligationSummary;
  documentProgressPercent: number;
  counters: MissionDocumentCounters | null;
};

const EMPTY_DOCUMENTS: DocumentObligationSummary = {
  total: 0,
  toDeposit: 0,
  justified: 0,
  inReview: 0,
  compliant: 0,
  notApplicable: 0,
};

function emptyView(): ClientContractView {
  return {
    establishment: null,
    offer: null,
    contract: { kind: "NO_DEVIS" },
    subscribedOptions: [],
    availableOptions: [],
    documents: EMPTY_DOCUMENTS,
    documentProgressPercent: 0,
    counters: null,
  };
}

// Contexte minimal partagé par la lecture et l'écriture : l'établissement de
// l'appelant, son tenant, et les options déjà à son contrat. Résolu une seule fois
// — la lecture et l'action doivent voir exactement le même contrat, sinon l'action
// pourrait accepter une demande sur une option que la page affiche comme souscrite.
async function resolveClientContractContext(): Promise<{
  establishment: { id: string; name: string };
  userId: string;
  tenantId: string;
  contract: ContractResolution;
  subscribedOptions: SubscribedOption[];
} | null> {
  const { establishment, userId } = await requireClientEstablishment();
  if (!establishment) return null;

  // Le lien Establishment → Devis n'est pas direct : un devis pend d'un Prospect,
  // et c'est `Prospect.establishmentId` (renseigné à la main à la signature) qui
  // referme la boucle. Aucune autre jointure n'existe — surtout pas un
  // rapprochement par nom, qui associerait deux structures homonymes.
  const record = await prisma.establishment.findUnique({
    where: { id: establishment.id },
    select: {
      tenantId: true,
      // Options souscrites portées par la MISSION — source de vérité depuis la
      // conversion à la signature (CLAUDE.md §7 : la décision contractuelle vit sur
      // Mission). Les snapshots du devis restent le repli pour les missions créées
      // avant cette bascule, cf. resolveSubscribedOptions().
      mission: {
        select: {
          options: {
            select: {
              catalogueOptionId: true,
              labelSnapshot: true,
              priceSnapshotEuros: true,
              pricingUnitSnapshot: true,
              priceMaxSnapshotEuros: true,
              minQuantitySnapshot: true,
            },
            orderBy: { labelSnapshot: "asc" },
          },
        },
      },
      prospect: {
        select: {
          devis: {
            select: {
              id: true,
              number: true,
              status: true,
              formuleLabelSnapshot: true,
              formulePriceSnapshotEuros: true,
              depositPercent: true,
              installmentCount: true,
              totalAmountEuros: true,
              depositAmountEuros: true,
              balanceAmountEuros: true,
              installmentAmountEuros: true,
              options: {
                select: {
                  catalogueOptionId: true,
                  labelSnapshot: true,
                  priceSnapshotEuros: true,
                  pricingUnitSnapshot: true,
                  priceMaxSnapshotEuros: true,
                  minQuantitySnapshot: true,
                },
                orderBy: { labelSnapshot: "asc" },
              },
            },
          },
        },
      },
    },
  });
  if (!record) return null;

  const contract = resolveContractDevis(record.prospect?.devis ?? []);
  // Le devis reste le document commercial — il fait contrat, ses montants sont
  // fermes et ne se réécrivent jamais. Mais le PÉRIMÈTRE ouvert vient de la mission,
  // qui existe même quand le chemin Establishment → Prospect → Devis n'existe pas.
  const subscribedOptions = resolveSubscribedOptions({
    missionOptions: record.mission?.options ?? [],
    devisOptions: contract.kind === "RESOLVED" ? contract.devis.options : [],
  });

  return {
    establishment: { id: establishment.id, name: establishment.name },
    userId,
    tenantId: record.tenantId,
    contract,
    subscribedOptions,
  };
}

export async function getClientContract(): Promise<ClientContractView> {
  const context = await resolveClientContractContext();
  if (!context) return emptyView();

  const { establishment, tenantId, contract, subscribedOptions } = context;

  const [mission, catalogue, pendingRequests, { checklist }] = await Promise.all([
    prisma.mission.findUnique({
      where: { establishmentId: establishment.id },
      select: { formule: true, gratuit: true },
    }),
    // Catalogue d'options du tenant, actives uniquement. Ce n'est PAS le catalogue
    // comme surface de gestion (pas de prix d'achat, pas de marge, pas d'édition) :
    // c'est la liste de ce qui est proposable, avec son prix « à partir de ».
    prisma.catalogueOption.findMany({
      where: { tenantId, active: true },
      select: {
        id: true,
        code: true,
        label: true,
        priceEuros: true,
        pricingUnit: true,
        priceMaxEuros: true,
        minQuantity: true,
      },
      orderBy: { label: "asc" },
    }),
    prisma.clientOptionRequest.findMany({
      where: { establishmentId: establishment.id, status: "DEMANDEE" },
      select: { catalogueOptionId: true },
    }),
    // Chemin de chargement PARTAGÉ avec la page checklist du portail : le filtrage
    // par offre et la résolution des statuts y vivent déjà, on ne les refait pas.
    getClientChecklist(),
  ]);

  const offer: ClientOffer | null = mission
    ? await resolveOfferLabel(tenantId, mission.formule, mission.gratuit)
    : null;

  const documents = summariseDocumentObligations(Object.values(checklist).flat());

  return {
    establishment,
    offer,
    contract,
    subscribedOptions,
    availableOptions: listAvailableOptions({
      catalogue,
      subscribed: subscribedOptions,
      pendingRequestOptionIds: pendingRequests.map((request) => request.catalogueOptionId),
    }),
    documents,
    documentProgressPercent: documentProgressPercent(documents),
    counters: mission
      ? await readMissionDocumentCounters(establishment.id, mission.formule, mission.gratuit)
      : null,
  };
}

// Libellé de l'offre contractée. Une seule ligne de catalogue est lue, celle de la
// formule de la mission. BETA (bêta-test gratuit) n'a pas de ligne au catalogue :
// il n'est pas vendu, il est libellé en clair.
async function resolveOfferLabel(
  tenantId: string,
  formule: CommercialTier,
  gratuit: boolean
): Promise<ClientOffer> {
  const row = await prisma.catalogueFormule.findUnique({
    where: { tenantId_formule: { tenantId, formule } },
    select: { label: true, modulesLabel: true, description: true },
  });

  return {
    formule,
    gratuit,
    label: row?.label ?? (formule === "BETA" ? "Bêta-test" : formule),
    modulesLabel: row?.modulesLabel ?? null,
    description: row?.description ?? null,
  };
}

// ── Demande de devis pour une option non souscrite ───────────────────────────
// §12.3 : le client DEMANDE, Sandrine déclenche. Cette action n'accorde aucun
// droit, ne débloque aucune fonctionnalité et ne touche à aucun montant — elle
// dépose une demande dans la file du cabinet et laisse une trace au journal.

export type RequestOptionQuoteResult = { ok: true } | { ok: false; error: string };

export async function requestOptionQuote(
  formData: FormData
): Promise<RequestOptionQuoteResult> {
  const context = await resolveClientContractContext();
  if (!context) {
    return { ok: false, error: "Aucun établissement n'est rattaché à votre compte." };
  }

  const optionId = requiredString(formData, "catalogueOptionId", "L'option", 64);
  const message = optionalString(formData, "message", "Votre message", 1000);
  const error = firstError(optionId, message);
  if (error) return { ok: false, error };
  if (!optionId.ok || !message.ok) return { ok: false, error: "Demande invalide." };

  const { establishment, userId, tenantId, subscribedOptions } = context;

  // L'identifiant d'option vient d'une route HTTP publique, pas de la page :
  // il est revalidé contre le catalogue ACTIF du tenant de l'établissement de
  // l'appelant. Un identifiant d'un autre tenant donne le même refus qu'un
  // identifiant inexistant — on ne révèle pas qu'il existe ailleurs.
  const option = await prisma.catalogueOption.findFirst({
    where: { id: optionId.value, tenantId, active: true },
    select: { id: true, code: true },
  });
  if (!option) return { ok: false, error: "Cette prestation n'est plus proposée." };

  if (isOptionSubscribed(subscribedOptions, option.id)) {
    return { ok: false, error: "Cette prestation est déjà incluse dans votre contrat." };
  }

  const alreadyPending = await prisma.clientOptionRequest.findFirst({
    where: {
      establishmentId: establishment.id,
      catalogueOptionId: option.id,
      status: "DEMANDEE",
    },
    select: { id: true },
  });
  if (alreadyPending) {
    return { ok: false, error: "Votre demande a déjà été transmise, elle est en cours de traitement." };
  }

  try {
    await prisma.clientOptionRequest.create({
      data: {
        tenantId,
        establishmentId: establishment.id,
        catalogueOptionId: option.id,
        requestedByUserId: userId,
        message: message.value,
      },
    });
  } catch {
    // L'index unique partiel (une seule demande DEMANDEE par couple) a tranché une
    // course entre deux clics. Ce n'est pas une panne, c'est le résultat attendu.
    return { ok: false, error: "Votre demande a déjà été transmise, elle est en cours de traitement." };
  }

  // `detail` porte le CODE de l'option, une clé technique — jamais le message du
  // client, qui est du texte libre potentiellement nominatif.
  await recordAuditEvent({
    action: "OPTION_QUOTE_REQUESTED",
    actorUserId: userId,
    actorRole: "CLIENT_USER",
    establishmentId: establishment.id,
    targetId: option.id,
    detail: option.code,
  });

  revalidatePath("/dashboard/client/accompagnement");
  revalidatePath("/dashboard/cabinet/commercial");

  return { ok: true };
}
