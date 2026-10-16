// ─────────────────────────────────────────────────────────────────────────────
// PORT DES DONNÉES DES PERSONNES ACCOMPAGNÉES (lot C, Dependency Inversion)
//
// Seule porte vers les tables usager : personnes accompagnées, représentants,
// documents remis/signés, preuves de signature, remises, journal du dossier,
// réponses d'enquête. Le test `beneficiary-tables-guard.test.ts` échoue si une ligne
// de code, ailleurs que dans l'adaptateur Prisma, touche ces tables.
//
// Types DU MÉTIER, pas de Prisma : les actions et les services ne connaissent pas le
// schéma. Tout est cloisonné par `BeneficiaryScope` (tenant + structure), résolu par
// une garde de lib/auth/guards.ts — jamais un identifiant reçu tel quel.
// ─────────────────────────────────────────────────────────────────────────────

export type BeneficiaryScope = { tenantId: string; establishmentId: string };

export type BeneficiaryCivility = "MADAME" | "MONSIEUR";
export type RepresentativeKind = "PROCHE" | "TUTEUR" | "CURATEUR";
export type BeneficiaryDocumentKind = "FEUILLE_RECEPTION" | "DIPC" | "PAP" | "LIVRET_REMIS" | "REGLEMENT_REMIS";
export type SignerRole = "PERSONNE" | "REPRESENTANT" | "SERVICE";
export type DeliveryChannel = "MAIN_PROPRE" | "EMAIL";
export type SurveyTemplateCode = "PERSONNE" | "FAMILLE";
export type SurveyRespondentKind = "PERSONNE" | "PROCHE";
export type SurveyMode = "ASSISTEE" | "SEULE";
export type SurveyChoice = "TRES" | "PLUTOT" | "PEU" | "PAS" | "NSP" | "NON_CONCERNE";

export type BeneficiarySummary = {
  id: string;
  civility: BeneficiaryCivility | null;
  firstName: string;
  lastName: string;
  address: string;
  girLevel: number | null;
  monthlyHours: number | null;
  startedOn: Date;
  endedOn: Date | null;
  referentStaffMemberId: string | null;
  representative: { kind: RepresentativeKind; fullName: string } | null;
};

// Ce que le CABINET lit d'une personne accompagnée (décision de Damon, 14/10/2026 —
// minimisation RGPD/HDS) : un identifiant opaque et deux dates, de quoi compter et
// dériver des échéances. Ni nom, ni adresse, ni GIR, ni heures, ni représentant.
export type BeneficiaryTimeline = Pick<BeneficiarySummary, "id" | "startedOn" | "endedOn">;

export type NewBeneficiary =Omit<BeneficiarySummary, "id" | "endedOn" | "representative"> & {
  birthDate: Date | null;
  phone: string | null;
  email: string | null;
  externalErpId: string | null;
  representative: { kind: RepresentativeKind; fullName: string; relationship: string } | null;
};

// Un point « à dire » coché pendant la présentation, avec son heure.
export type ChecklistTick = { documentKind: BeneficiaryDocumentKind; pointId: string; label: string; tickedAt: Date };

export type NewSignedDocument = {
  beneficiaryId: string;
  kind: BeneficiaryDocumentKind;
  // Gabarit FINALE de la bibliothèque dont le document est issu (jamais un texte inventé).
  sourceTemplateVersionId: string | null;
  renderedFileKey: string;
  sha256: string;
  issuedAt: Date;
  renewDueOn: Date | null;
  evidence: {
    signerRole: SignerRole;
    signerName: string;
    witnessStaffMemberId: string;
    deviceEnrollmentId: string;
    signedAt: Date;
    // Image FINALE de la signature, seule : jamais le tracé (dynamique = biométrie).
    signatureImageKey: string;
    documentSha256: string;
    checklist: readonly ChecklistTick[];
  };
  delivery: { channel: DeliveryChannel; deliveredAt: Date } | null;
};

export type BeneficiaryDocumentSummary = {
  id: string;
  beneficiaryId: string;
  kind: BeneficiaryDocumentKind;
  issuedAt: Date;
  renewDueOn: Date | null;
  signedAt: Date | null;
};

export type NewJournalEntry = {
  beneficiaryId: string;
  authorStaffMemberId: string | null;
  authorUserId: string | null;
  text: string;
  possibleAdverseEvent: boolean;
  occurredAt: Date;
};

export type JournalEntry = NewJournalEntry & { id: string };

export type SurveyAnswerInput = { questionId: string; choice: SurveyChoice | null; freeText: string | null };

export type NewSurveyResponse = {
  beneficiaryId: string | null;
  templateCode: SurveyTemplateCode;
  templateVersion: number;
  respondentKind: SurveyRespondentKind;
  mode: SurveyMode;
  collectedByStaffMemberId: string | null;
  completedAt: Date;
  answers: readonly SurveyAnswerInput[];
};

export type SurveyResponseRecord = Omit<NewSurveyResponse, "collectedByStaffMemberId"> & { id: string };

export interface BeneficiaryDataPort {
  // Vrai seulement chez un hébergeur certifié HDS (ADR 20261014). Les écrans lisent ce
  // drapeau pour afficher l'état honnête AVANT que la personne ne remplisse quoi que ce soit.
  readonly isAvailable: boolean;

  // Liste NOMINATIVE : réservée à la structure (direction, responsable qualité, tablette).
  listBeneficiaries(scope: BeneficiaryScope): Promise<BeneficiarySummary[]>;
  // Lecture MINIMALE, la seule que le cabinet emprunte : la requête ne sélectionne
  // aucun champ nominatif, ils ne quittent donc jamais la base.
  listBeneficiaryTimelines(scope: BeneficiaryScope): Promise<BeneficiaryTimeline[]>;
  createBeneficiary(scope: BeneficiaryScope, input: NewBeneficiary): Promise<{ id: string }>;

  recordSignedDocument(scope: BeneficiaryScope, input: NewSignedDocument): Promise<{ documentId: string }>;
  listBeneficiaryDocuments(scope: BeneficiaryScope): Promise<BeneficiaryDocumentSummary[]>;

  appendJournalEntry(scope: BeneficiaryScope, input: NewJournalEntry): Promise<{ id: string }>;
  listJournal(scope: BeneficiaryScope, beneficiaryId: string): Promise<JournalEntry[]>;

  recordSurveyResponse(scope: BeneficiaryScope, input: NewSurveyResponse): Promise<{ id: string }>;
  listSurveyResponses(scope: BeneficiaryScope, since: Date | null): Promise<SurveyResponseRecord[]>;
}
