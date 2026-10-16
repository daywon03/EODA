import { randomUUID } from "node:crypto";
import { prisma } from "@eoda/database";
import type { TabletSessionContext } from "@/lib/auth/guards";
import { getBeneficiaryDataPort, getHdsFileStoragePort, type ChecklistTick } from "@/lib/hds";
import { RECEPTION_DOCUMENTS, type ReceptionDocument } from "@/content/enquete/reception";
import { buildSignatureEvidence } from "@/lib/services/signature-evidence-service";
import { describePresentedDocuments, renderReceptionSheet, SIGNER_QUALITY_LABELS } from "@/lib/services/reception-sheet-service";
import { formatDate } from "@/lib/services/date-format-service";
import type { TerrainWriteResult } from "./terrain-write";

// ─────────────────────────────────────────────────────────────────────────────
// FEUILLE DE RÉCEPTION — l'écriture complète, appelée par recordReceptionSheet
// (terrain-write.ts) APRÈS la garde de tablette et le verrou HDS. Module sans
// « use server » : il n'est pas une action atteignable depuis le navigateur.
//
// Le texte vient du gabarit FINALE de la bibliothèque (jamais rédigé ici), la preuve
// est décidée par signature-evidence-service, les deux fichiers (texte rendu, PNG de
// la signature) vont dans le stockage HDS — jamais dans `eoda-documents`.
// ─────────────────────────────────────────────────────────────────────────────

const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;
const SIGNER_ROLES = ["PERSONNE", "REPRESENTANT"] as const;

function parseJsonArray(raw: FormDataEntryValue | null): unknown[] {
  if (typeof raw !== "string" || raw.length > 20_000) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function parsePresented(raw: FormDataEntryValue | null): ReceptionDocument["kind"][] {
  const kinds = RECEPTION_DOCUMENTS.map((doc) => doc.kind);
  return parseJsonArray(raw).filter((k): k is ReceptionDocument["kind"] => kinds.some((kind) => kind === k));
}

// Seuls les points CONNUS sont retenus, avec le libellé du contenu (pas celui reçu).
function parseTicks(raw: FormDataEntryValue | null): ChecklistTick[] {
  return parseJsonArray(raw).flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const { documentKind, pointId, tickedAt } = item as Record<string, unknown>;
    const doc = RECEPTION_DOCUMENTS.find((d) => d.kind === documentKind);
    const point = doc?.points.find((p) => p.id === pointId);
    const at = typeof tickedAt === "string" ? new Date(tickedAt) : null;
    if (!doc || !point || !at || Number.isNaN(at.getTime())) return [];
    return [{ documentKind: doc.kind, pointId: point.id, label: point.label, tickedAt: at }];
  });
}

export async function recordReceptionSheetForSession(
  session: TabletSessionContext,
  formData: FormData
): Promise<TerrainWriteResult> {
  const scope = { tenantId: session.tenantId, establishmentId: session.establishmentId };
  const port = getBeneficiaryDataPort();
  const person = (await port.listBeneficiaries(scope)).find((b) => b.id === formData.get("beneficiaryId"));
  if (!person) return { error: "Personne introuvable." };
  const signerRole = SIGNER_ROLES.find((role) => role === formData.get("signerRole"));
  const signature = PNG_DATA_URL.exec(String(formData.get("signature") ?? ""));
  if (!signerRole || !signature) return { error: "La signature est incomplète." };

  const template = await prisma.templateVersion.findFirst({
    where: { id: String(formData.get("templateVersionId") ?? ""), stage: "FINALE", templateDocument: { tenantId: session.tenantId } },
    select: { id: true, extractedText: true },
  });
  const presented = parsePresented(formData.get("presented"));
  const signerName = String(formData.get("signerName") ?? "").trim();
  const signedAt = new Date();
  const rendered = renderReceptionSheet(template?.extractedText ?? null, {
    "structure.nom": session.establishmentName,
    "personne.civilite": person.civility === "MADAME" ? "Madame" : person.civility === "MONSIEUR" ? "Monsieur" : "",
    "personne.prenom": person.firstName,
    "personne.nom": person.lastName,
    "signataire.nom": signerName,
    "signataire.qualite": SIGNER_QUALITY_LABELS[signerRole],
    "intervenant.nom": session.staffDisplayName,
    "date.remise": formatDate(signedAt),
    "documents.remis": describePresentedDocuments(presented),
  });
  if (!template || !rendered.ok) return { error: "La feuille de réception n'a pas de gabarit validé utilisable." };

  const renderedDocument = Buffer.from(rendered.text, "utf8");
  const signatureImage = Buffer.from(signature[1]!, "base64");
  const evidence = buildSignatureEvidence({
    beneficiaryFullName: `${person.firstName} ${person.lastName}`,
    representative: person.representative,
    signerRole,
    signerName,
    witnessStaffMemberId: session.staffMemberId,
    deviceEnrollmentId: session.deviceEnrollmentId,
    renderedDocument,
    signatureImage,
    presentedDocuments: presented,
    ticks: parseTicks(formData.get("ticks")),
    signedAt,
  });
  if (!evidence.ok) return { error: evidence.problems.join(" ") };

  const storage = getHdsFileStoragePort();
  const documentKey = `${session.establishmentId}/reception/${randomUUID()}.txt`;
  const signatureKey = `${session.establishmentId}/signature/${randomUUID()}.png`;
  await storage.upload(documentKey, renderedDocument, "text/plain; charset=utf-8");
  await storage.upload(signatureKey, signatureImage, "image/png");
  await port.recordSignedDocument(scope, {
    beneficiaryId: person.id,
    kind: "FEUILLE_RECEPTION",
    sourceTemplateVersionId: template.id,
    renderedFileKey: documentKey,
    sha256: evidence.documentSha256,
    issuedAt: signedAt,
    renewDueOn: null,
    evidence: {
      signerRole,
      signerName,
      witnessStaffMemberId: session.staffMemberId,
      deviceEnrollmentId: session.deviceEnrollmentId,
      signedAt,
      signatureImageKey: signatureKey,
      documentSha256: evidence.documentSha256,
      checklist: evidence.checklist,
    },
    // Remise en main propre. La copie par e-mail n'est PAS encore envoyée : elle
    // passera par un envoi conforme une fois l'hébergement HDS en place.
    delivery: { channel: "MAIN_PROPRE", deliveredAt: signedAt },
  });
  return { ok: true };
}
