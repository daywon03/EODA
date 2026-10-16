"use server";

import { prisma } from "@eoda/database";
import { notFound } from "next/navigation";
import { requireEstablishmentAccess, resolveTabletSession, type TabletSessionContext } from "@/lib/auth/guards";
import { NEED } from "@/lib/auth/capabilities";
import { getBeneficiaryDataPort, HDS_LOCKED_MESSAGE, isHdsNotAvailableError, type BeneficiaryScope } from "@/lib/hds";
import { findSurveyTemplate } from "@/content/enquete";
import { canDepositDocuments } from "@/lib/services/mission-access-service";
import { parseSurveyAnswers } from "@/lib/services/survey-answer-parser";
import { firstError, optionalEnum, optionalInt, optionalString, requiredDate, requiredEnum, requiredString } from "@/lib/validation/form-parsers";
import { recordReceptionSheetForSession } from "./terrain-reception";

// ─────────────────────────────────────────────────────────────────────────────
// TERRAIN — ÉCRITURES DE DONNÉES USAGER (lot C). Toutes passent par le port HDS.
//
// Ordre IMMUABLE de chaque action :
//   1. la garde (portail : TERRAIN_WRITE ; tablette : appareil + salarié + code) ;
//   2. le VERROU : si le port n'est pas disponible, réponse honnête, rien d'autre —
//      pas même la lecture du formulaire ;
//   3. la validation, puis l'écriture par le port.
// Le test `beneficiary-actions-locked.test.ts` appelle chaque export de ce fichier
// avec la configuration par défaut et exige la réponse verrouillée, sans écriture.
// ─────────────────────────────────────────────────────────────────────────────

export type TerrainWriteResult = { ok: true } | { error: string; locked?: true };

const LOCKED: TerrainWriteResult = { error: HDS_LOCKED_MESSAGE, locked: true };
const NO_TABLET: TerrainWriteResult = { error: "La session de la tablette est terminée. Reconnectez-vous avec votre code." };

async function portalScope(establishmentId: unknown): Promise<BeneficiaryScope | { error: string }> {
  if (typeof establishmentId !== "string" || establishmentId.length === 0) notFound();
  const access = await requireEstablishmentAccess(establishmentId, NEED.TERRAIN_WRITE);
  if (access.isClient && !canDepositDocuments(access.missionAccess)) {
    return { error: "Votre accompagnement est clos : les dossiers sont en lecture seule." };
  }
  const row = await prisma.establishment.findUniqueOrThrow({ where: { id: access.establishmentId }, select: { tenantId: true } });
  return { tenantId: row.tenantId, establishmentId: access.establishmentId };
}

function tabletScope(session: TabletSessionContext): BeneficiaryScope {
  return { tenantId: session.tenantId, establishmentId: session.establishmentId };
}

async function lockedOr(run: () => Promise<TerrainWriteResult>): Promise<TerrainWriteResult> {
  if (!getBeneficiaryDataPort().isAvailable) return LOCKED;
  try {
    return await run();
  } catch (error) {
    if (isHdsNotAvailableError(error)) return LOCKED;
    throw error;
  }
}

// Nouvelle personne accompagnée, depuis le portail (direction, responsable qualité).
export async function createBeneficiary(formData: FormData): Promise<TerrainWriteResult> {
  const scope = await portalScope(formData.get("establishmentId"));
  if ("error" in scope) return scope;
  return lockedOr(async () => {
    const civility = optionalEnum(formData, "civility", "La civilité", { MADAME: "MADAME", MONSIEUR: "MONSIEUR" } as const);
    const firstName = requiredString(formData, "firstName", "Le prénom", 80);
    const lastName = requiredString(formData, "lastName", "Le nom", 80);
    const address = requiredString(formData, "address", "L'adresse", 300);
    const phone = optionalString(formData, "phone", "Le téléphone", 30);
    const email = optionalString(formData, "email", "L'e-mail", 200);
    const gir = optionalInt(formData, "girLevel", "Le GIR", { min: 1, max: 6 });
    const hours = optionalInt(formData, "monthlyHours", "Les heures par mois", { min: 0, max: 400 });
    const startedOn = requiredDate(formData, "startedOn", "La date de début");
    const error = firstError(civility, firstName, lastName, address, phone, email, gir, hours, startedOn);
    if (error) return { error };
    if (!civility.ok || !firstName.ok || !lastName.ok || !address.ok || !phone.ok || !email.ok || !gir.ok || !hours.ok || !startedOn.ok) {
      return { error: "Formulaire invalide." };
    }
    await getBeneficiaryDataPort().createBeneficiary(scope, {
      civility: civility.value,
      firstName: firstName.value,
      lastName: lastName.value,
      address: address.value,
      phone: phone.value,
      email: email.value,
      girLevel: gir.value,
      monthlyHours: hours.value,
      startedOn: startedOn.value,
      birthDate: null,
      referentStaffMemberId: null,
      externalErpId: null,
      representative: null,
    });
    return { ok: true };
  });
}

// « Noter un événement » sur la tablette. Append-only.
export async function appendBeneficiaryJournal(formData: FormData): Promise<TerrainWriteResult> {
  const session = await resolveTabletSession();
  if (!session) return NO_TABLET;
  return lockedOr(async () => {
    const beneficiaryId = requiredString(formData, "beneficiaryId", "La personne", 64);
    const text = requiredString(formData, "text", "L'événement", 2000);
    const error = firstError(beneficiaryId, text);
    if (error || !beneficiaryId.ok || !text.ok) return { error: error ?? "Formulaire invalide." };
    await getBeneficiaryDataPort().appendJournalEntry(tabletScope(session), {
      beneficiaryId: beneficiaryId.value,
      authorStaffMemberId: session.staffMemberId,
      authorUserId: null,
      text: text.value,
      possibleAdverseEvent: formData.get("possibleAdverseEvent") === "on",
      occurredAt: new Date(),
    });
    return { ok: true };
  });
}

// Une enquête terminée sur la tablette.
export async function recordSurveyResponse(formData: FormData): Promise<TerrainWriteResult> {
  const session = await resolveTabletSession();
  if (!session) return NO_TABLET;
  return lockedOr(async () => {
    const template = findSurveyTemplate(String(formData.get("templateCode") ?? ""));
    const mode = requiredEnum(formData, "mode", "Le mode", { ASSISTEE: "ASSISTEE", SEULE: "SEULE" } as const);
    const beneficiaryId = optionalString(formData, "beneficiaryId", "La personne", 64);
    if (!template) return { error: "Questionnaire inconnu." };
    const answers = parseSurveyAnswers(template, formData.get("answers"));
    const error = firstError(mode, beneficiaryId);
    if (error || !mode.ok || !beneficiaryId.ok) return { error: error ?? "Formulaire invalide." };
    if (!answers.ok) return { error: answers.error };
    await getBeneficiaryDataPort().recordSurveyResponse(tabletScope(session), {
      beneficiaryId: beneficiaryId.value,
      templateCode: template.code,
      templateVersion: template.version,
      respondentKind: template.code === "PERSONNE" ? "PERSONNE" : "PROCHE",
      mode: mode.value,
      collectedByStaffMemberId: session.staffMemberId,
      completedAt: new Date(),
      answers: answers.value,
    });
    return { ok: true };
  });
}

// Feuille de réception signée sur la tablette (rendu, preuve, fichiers HDS).
export async function recordReceptionSheet(formData: FormData): Promise<TerrainWriteResult> {
  const session = await resolveTabletSession();
  if (!session) return NO_TABLET;
  return lockedOr(() => recordReceptionSheetForSession(session, formData));
}
