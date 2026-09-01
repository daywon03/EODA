"use server";

import { prisma, EstablishmentType, type DevisStatus } from "@eoda/database";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCabinetAdminSession } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import {
  CONVERSION_REFUSAL_MESSAGES,
  planConversion,
  summariseConversionForAudit,
  toMissionOptionSnapshots,
} from "@/lib/services/conversion-service";
import {
  firstError,
  optionalDate,
  optionalEnum,
  optionalString,
  requiredDate,
  requiredString,
} from "@/lib/validation/form-parsers";

// ─────────────────────────────────────────────────────────────────────────────
// SIGNATURE D'UN DEVIS → FICHE CLIENT + PROFIL, EN UNE TRANSACTION
//
// §12.4, « le parcours à verrouiller en priorité ». Sandrine coche l'offre et les
// options pendant la réunion d'évaluation des besoins (§12.3, le client ne
// s'auto-configure jamais) ; à la signature, ce même choix produit la fiche
// établissement et le profil client. « En cliquant ça, ça génère dans le portail
// client un profil » — et le profil, ce n'est pas un nouveau mécanisme : c'est la
// bonne Mission, dont `offer-scope-service` dérive déjà checklists documentaires,
// items de suivi et périmètre de critères.
//
// Réservé à CABINET_ADMIN comme tout le pipeline commercial (CLAUDE.md §7), via la
// couche d'autorisation unique. `devisId` vient d'une route HTTP publique : il est
// résolu filtré par tenant, et un devis hors périmètre donne `notFound()`, jamais
// une redirection — on ne révèle pas qu'un identifiant existe ailleurs.
//
// IDEMPOTENCE — quelle contrainte protège quoi :
//   · double signature        → table de transitions (SIGNE n'est pas atteignable
//                               depuis SIGNE), vérifiée AVANT d'ouvrir la transaction
//                               puis re-vérifiée DEDANS sur la ligne relue ;
//   · second établissement    → `prospects_establishment_id_key` (unique) ;
//   · seconde mission         → `missions_establishment_id_key` (unique) ;
//   · lignes d'options en double → `mission_options_mission_id_catalogue_option_id_key`
//                               (unique), sur laquelle s'appuie `skipDuplicates`.
// Aucune de ces garanties n'est réimplémentée en TypeScript : le contrôle applicatif
// ne sert qu'à produire un message lisible plutôt qu'une erreur technique.
// ─────────────────────────────────────────────────────────────────────────────

const PROSPECT_LIST_PATH = "/dashboard/cabinet/commercial/prospects";
const DEVIS_LIST_PATH = "/dashboard/cabinet/commercial/devis";
const COMMERCIAL_DASHBOARD_PATH = "/dashboard/cabinet/commercial";

export type ConvertDevisResult =
  | {
      ok: true;
      establishmentId: string;
      establishmentName: string;
      // Vrai seulement si CETTE exécution a créé la fiche. Sert à l'écran de
      // confirmation : « fiche créée » et « fiche déjà existante, mission complétée »
      // ne se racontent pas de la même façon.
      establishmentCreated: boolean;
      optionCount: number;
      // Pré-remplissage de l'invitation client, proposée en fin de parcours et
      // toujours facultative.
      contactEmail: string | null;
      contactName: string | null;
    }
  | { ok: false; error: string };

type ParsedFicheInput = {
  type: EstablishmentType | null;
  finessNumber: string | null;
  address: string | null;
  hasEvaluationTargetDate: Date | null;
};

// Champs de la fiche client, saisis AU MOMENT DE LA SIGNATURE — c'est-à-dire au seul
// moment où ils sont réellement connus. Les demander plus tôt, à la création d'une
// fiche vide, revenait à réclamer le numéro FINESS d'une structure qui n'avait encore
// rien signé ; c'est cette porte-là qui a été fermée.
//
// `creating` distingue les deux usages de la signature :
//   - true  → la fiche est créée : tous les champs sont exigés, ils partent
//             directement dans les livrables HAS ;
//   - false → la signature ne fait qu'ajouter la mission à une fiche existante. Rien
//             n'est redemandé, et surtout rien n'est écrasé.
//
// La distinction n'est pas réinventée ici : elle vient de `planConversion`, qui la
// calcule déjà pour décider s'il faut créer l'établissement.
//
// Le statut juridique, lui, n'est PAS dans ce formulaire : le prospect le porte déjà
// (`Prospect.structureType`). Le redemander à la signature, c'est offrir l'occasion
// de saisir une valeur qui contredit celle du pipeline.
function parseFicheInput(
  formData: FormData,
  creating: boolean
): { error: string } | ParsedFicheInput {
  const type = optionalEnum(formData, "type", "Le type de SAD", EstablishmentType);
  const finessNumber = creating
    ? requiredString(formData, "finessNumber", "Le numéro FINESS", 20)
    : optionalString(formData, "finessNumber", "Le numéro FINESS", 20);
  const address = creating
    ? requiredString(formData, "address", "L'adresse", 300)
    : optionalString(formData, "address", "L'adresse", 300);
  const hasEvaluationTargetDate = creating
    ? requiredDate(formData, "hasEvaluationTargetDate", "L'échéance d'évaluation HAS")
    : optionalDate(formData, "hasEvaluationTargetDate", "L'échéance d'évaluation HAS");

  const error = firstError(type, finessNumber, address, hasEvaluationTargetDate);
  if (error) return { error };
  if (!type.ok || !finessNumber.ok || !address.ok || !hasEvaluationTargetDate.ok) {
    return { error: "Formulaire invalide." };
  }

  // Le FINESS est la clé d'identification de l'ESSMS auprès de la HAS : une saisie
  // approximative finit dans un livrable.
  if (finessNumber.value && !/^\d{9}$/.test(finessNumber.value)) {
    return { error: "Le numéro FINESS doit comporter exactement 9 chiffres." };
  }

  return {
    type: type.value,
    finessNumber: finessNumber.value,
    address: address.value,
    hasEvaluationTargetDate: hasEvaluationTargetDate.value,
  };
}

export async function convertDevisToClient(
  devisId: string,
  _prevState: ConvertDevisResult | null,
  formData: FormData
): Promise<ConvertDevisResult> {
  const { userId, tenantId } = await requireCabinetAdminSession();

  if (typeof devisId !== "string" || devisId.length === 0) {
    return { ok: false, error: "Devis manquant." };
  }

  const devis = await prisma.devis.findFirst({
    where: { id: devisId, tenantId },
    select: {
      id: true,
      number: true,
      status: true,
      tenantId: true,
      catalogueFormule: { select: { formule: true } },
      options: {
        select: {
          catalogueOptionId: true,
          labelSnapshot: true,
          priceSnapshotEuros: true,
          pricingUnitSnapshot: true,
          priceMaxSnapshotEuros: true,
          minQuantitySnapshot: true,
        },
      },
      prospect: {
        select: {
          id: true,
          tenantId: true,
          structureName: true,
          // Statut juridique déjà qualifié au stade prospect — recopié sur la fiche
          // plutôt que redemandé, pour qu'une seule saisie fasse foi des deux côtés.
          structureType: true,
          contactEmail: true,
          contactName: true,
          establishmentId: true,
        },
      },
    },
  });
  if (!devis) notFound();

  const existingMission = devis.prospect.establishmentId
    ? await prisma.mission.findUnique({
        where: { establishmentId: devis.prospect.establishmentId },
        select: { id: true },
      })
    : null;

  // La fiche n'est créée que si le prospect n'en a pas encore : c'est cette réponse
  // qui décide quels champs sont exigés du formulaire, d'où l'analyse en deux temps.
  const creatingFiche = devis.prospect.establishmentId === null;

  const parsed = parseFicheInput(formData, creatingFiche);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const plan = planConversion({
    devisStatus: devis.status,
    devisTenantId: devis.tenantId,
    prospectTenantId: devis.prospect.tenantId,
    existingEstablishmentId: devis.prospect.establishmentId,
    existingMissionId: existingMission?.id ?? null,
    establishmentType: parsed.type,
  });
  if (plan.kind === "REFUSED") {
    return { ok: false, error: CONVERSION_REFUSAL_MESSAGES[plan.reason] };
  }

  const formule = devis.catalogueFormule.formule;
  const missionOptions = toMissionOptionSnapshots(devis.options);
  const prospectId = devis.prospect.id;

  let converted: { establishmentId: string; establishmentName: string } | { error: string };
  try {
    converted = await prisma.$transaction(async (tx) => {
      // Relecture du statut DANS la transaction : entre la vérification ci-dessus et
      // ici, un second onglet a pu signer le même devis. Sans cette relecture, deux
      // clics simultanés passent tous les deux le contrôle applicatif.
      const fresh = await tx.devis.findFirst({
        where: { id: devis.id, tenantId },
        select: { status: true },
      });
      if (!fresh || fresh.status !== devis.status) {
        return { error: "Ce devis a changé de statut entre-temps. Rechargez la page." as const };
      }

      // 1. La fiche client. Créée seulement si le prospect n'en a pas — le nom vient
      //    de `structureName`, seule dénomination dont on dispose à cet instant.
      const establishment = plan.createsEstablishment
        ? await tx.establishment.create({
            data: {
              tenantId,
              name: devis.prospect.structureName,
              // Non nul ici : `planConversion` refuse la création sans type.
              type: parsed.type ?? "SAD_AIDE",
              // Recopié du prospect, jamais ressaisi : deux saisies du même fait
              // finissent par diverger, et c'est le pipeline qui aurait raison.
              structureType: devis.prospect.structureType,
              finessNumber: parsed.finessNumber,
              address: parsed.address,
              hasEvaluationTargetDate: parsed.hasEvaluationTargetDate,
              // Reste BETA, affichage/historique uniquement — la formule qui fait
              // autorité est celle de la Mission créée ci-dessous (CLAUDE.md §7).
              commercialTier: "BETA",
            },
            select: { id: true, name: true },
          })
        : await tx.establishment.findFirstOrThrow({
            where: { id: devis.prospect.establishmentId ?? "", tenantId },
            select: { id: true, name: true },
          });

      // 2. Le lien prospect → établissement, protégé par `prospects_establishment_id_key`.
      await tx.prospect.update({
        where: { id: prospectId },
        data: { establishmentId: establishment.id, status: "SIGNE" },
      });

      // 3. Le devis passe à SIGNE. Même transaction que tout le reste : un devis
      //    signé sans profil, ou un profil sans devis signé, sont deux états qu'on
      //    ne veut jamais avoir à réparer à la main.
      await tx.devis.update({ where: { id: devis.id }, data: { status: "SIGNE" } });

      // 4. Le PROFIL. Ce n'est pas un mécanisme de plus : `offer-scope-service` dérive
      //    déjà de `formule` + `gratuit` les catégories documentaires, les items de
      //    checklist et le périmètre de critères. « S'il a signé qu'Essentiel, il y
      //    aura documents de loi 2 ; s'il a signé Excellence, il y aura tout. »
      const mission = await tx.mission.create({
        data: {
          tenantId,
          establishmentId: establishment.id,
          formule,
          // Un devis signé est une vente : le bêta-test gratuit reste un geste
          // délibéré, posé sur la mission, jamais déduit d'une signature.
          gratuit: false,
          sourceDevisId: devis.id,
        },
        select: { id: true },
      });

      // 5. Les options souscrites, sur la mission. `skipDuplicates` s'appuie sur
      //    l'index unique (missionId, catalogueOptionId) — c'est la base qui garantit
      //    l'absence de doublon, y compris sous concurrence.
      if (missionOptions.length > 0) {
        await tx.missionOption.createMany({
          // `priceIsFirm: true` posé explicitement, alors que c'est le défaut en base :
          // ce chemin-ci recopie un devis SIGNÉ, ses montants font contrat. Le
          // rattachement manuel côté mission pose `false` (prix catalogue, « à partir
          // de »). Écrire les deux noir sur blanc évite qu'un futur changement de
          // défaut requalifie silencieusement des estimations en engagements.
          data: missionOptions.map((option) => ({
            missionId: mission.id,
            ...option,
            priceIsFirm: true,
          })),
          skipDuplicates: true,
        });
      }

      return { establishmentId: establishment.id, establishmentName: establishment.name };
    });
  } catch {
    // Une contrainte unique a tranché une course entre deux signatures simultanées.
    // Rien n'a été écrit — la transaction est atomique — et l'état visé est déjà
    // atteint par l'exécution gagnante.
    return {
      ok: false,
      error:
        "Cette conversion a déjà été enregistrée (ou l'est au même instant). Rechargez la page.",
    };
  }

  if ("error" in converted) return { ok: false, error: converted.error };

  // Journalisé hors transaction : la trace ne doit ni annuler la conversion en cas
  // d'échec d'écriture, ni être annulée avec elle. `detail` ne porte que des clés
  // techniques — pas le nom de la structure, pas celui du contact.
  await recordAuditEvent({
    action: "PROSPECT_CONVERTED",
    actorUserId: userId,
    actorRole: "CABINET_ADMIN",
    establishmentId: converted.establishmentId,
    targetId: devis.id,
    detail: summariseConversionForAudit({
      devisNumber: devis.number,
      formule,
      optionCount: missionOptions.length,
    }),
  });

  revalidatePath(`${DEVIS_LIST_PATH}/${devis.id}`);
  revalidatePath(DEVIS_LIST_PATH);
  revalidatePath(`${PROSPECT_LIST_PATH}/${prospectId}`);
  revalidatePath(PROSPECT_LIST_PATH);
  revalidatePath(COMMERCIAL_DASHBOARD_PATH);
  revalidatePath("/dashboard/cabinet");
  revalidatePath(`/dashboard/cabinet/etablissements/${converted.establishmentId}`);

  return {
    ok: true,
    establishmentId: converted.establishmentId,
    establishmentName: converted.establishmentName,
    establishmentCreated: plan.createsEstablishment,
    optionCount: missionOptions.length,
    contactEmail: devis.prospect.contactEmail,
    contactName: devis.prospect.contactName,
  };
}

// Récapitulatif lu par l'écran de signature : ce que le clic va produire, avant de
// le produire. Lecture cloisonnée par tenant comme tout le reste ; un devis hors
// périmètre donne `notFound()`.
export type SignatureContext = {
  devisId: string;
  number: string;
  status: DevisStatus;
  structureName: string;
  formuleLabel: string;
  totalAmountEuros: number;
  optionLabels: string[];
  contactEmail: string | null;
  contactName: string | null;
  // Fiche déjà rattachée au prospect : la conversion complétera la mission au lieu
  // de créer un doublon.
  existingEstablishmentId: string | null;
};

export async function getSignatureContext(devisId: string): Promise<SignatureContext> {
  const { tenantId } = await requireCabinetAdminSession();

  const devis = await prisma.devis.findFirst({
    where: { id: devisId, tenantId },
    select: {
      id: true,
      number: true,
      status: true,
      formuleLabelSnapshot: true,
      totalAmountEuros: true,
      options: { select: { labelSnapshot: true }, orderBy: { labelSnapshot: "asc" } },
      prospect: {
        select: {
          structureName: true,
          // Statut juridique déjà qualifié au stade prospect — recopié sur la fiche
          // plutôt que redemandé, pour qu'une seule saisie fasse foi des deux côtés.
          structureType: true,
          contactEmail: true,
          contactName: true,
          establishmentId: true,
        },
      },
    },
  });
  if (!devis) notFound();

  return {
    devisId: devis.id,
    number: devis.number,
    status: devis.status,
    structureName: devis.prospect.structureName,
    formuleLabel: devis.formuleLabelSnapshot,
    totalAmountEuros: devis.totalAmountEuros,
    optionLabels: devis.options.map((option) => option.labelSnapshot),
    contactEmail: devis.prospect.contactEmail,
    contactName: devis.prospect.contactName,
    existingEstablishmentId: devis.prospect.establishmentId,
  };
}
