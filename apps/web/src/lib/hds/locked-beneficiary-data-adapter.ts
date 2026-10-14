import type { FileStoragePort } from "@/lib/storage/file-storage-port";
import type {
  BeneficiaryDataPort,
  BeneficiaryDocumentSummary,
  BeneficiarySummary,
  JournalEntry,
  SurveyResponseRecord,
} from "./beneficiary-data-port";
import { HdsNotAvailableError } from "./hds-errors";

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTATEUR VERROUILLÉ — l'adaptateur PAR DÉFAUT, sur l'infrastructure actuelle
// (Supabase + Vercel, non certifiés HDS ; base partagée avec la production).
//
// Toute écriture lève HdsNotAvailableError ; toute lecture rend vide. Il n'importe
// PAS Prisma : même un appel mal routé ne peut rien écrire. C'est volontairement le
// seul adaptateur que le sélecteur rend tant que l'ADR 20261014 n'est pas levée.
// ─────────────────────────────────────────────────────────────────────────────
export class LockedBeneficiaryDataAdapter implements BeneficiaryDataPort {
  readonly isAvailable = false;

  async listBeneficiaries(): Promise<BeneficiarySummary[]> {
    return [];
  }

  async createBeneficiary(): Promise<{ id: string }> {
    throw new HdsNotAvailableError("créer une personne accompagnée");
  }

  async recordSignedDocument(): Promise<{ documentId: string }> {
    throw new HdsNotAvailableError("enregistrer un document signé");
  }

  async listBeneficiaryDocuments(): Promise<BeneficiaryDocumentSummary[]> {
    return [];
  }

  async appendJournalEntry(): Promise<{ id: string }> {
    throw new HdsNotAvailableError("noter un événement au journal");
  }

  async listJournal(): Promise<JournalEntry[]> {
    return [];
  }

  async recordSurveyResponse(): Promise<{ id: string }> {
    throw new HdsNotAvailableError("enregistrer une réponse d'enquête");
  }

  async listSurveyResponses(): Promise<SurveyResponseRecord[]> {
    return [];
  }
}

// Stockage des FICHIERS signés (PDF rendu, image de signature) : distinct du bucket
// `eoda-documents`, verrouillé de la même façon. Même la lecture d'un lien signé est
// refusée — il n'existe aucun fichier à servir.
export class LockedHdsFileStorageAdapter implements FileStoragePort {
  async upload(): Promise<void> {
    throw new HdsNotAvailableError("déposer un fichier signé");
  }

  async getSignedDownloadUrl(): Promise<string> {
    throw new HdsNotAvailableError("ouvrir un fichier signé");
  }

  async download(): Promise<Buffer> {
    throw new HdsNotAvailableError("lire un fichier signé");
  }

  async delete(): Promise<void> {
    throw new HdsNotAvailableError("supprimer un fichier signé");
  }
}
