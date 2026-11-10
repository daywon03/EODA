"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { Camera, Upload } from "lucide-react";
import { describeDepositEffects } from "@/lib/services/document-deposit-service";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { DepositReview } from "@/components/checklist/DepositReview";
import { useDocumentDeposit } from "@/components/checklist/use-document-deposit";

// ─────────────────────────────────────────────────────────────────────────────
// DÉPÔT EN TROIS ÉTAPES (maquette « Portail Client v2 », R6).
//
//   1. Choisir : un fichier, le glisser, ou prendre une photo (`capture`).
//   2. Vérifier : le récapitulatif PARTAGÉ avec le cabinet (DepositReview,
//      use-document-deposit — 09/11/2026) : fichier, document de destination, ce
//      que le dépôt déclenche, l'avertissement nominatif ; « Déposer » / « Annuler ».
//      Pendant l'envoi, « Annuler le dépôt » retire la version dès qu'elle existe.
//   3. Envoyé.
//
// Le dépôt passe par l'action `uploadDocument` EXISTANTE : la garde, le contrôle de
// périmètre et la détermination du type par signature binaire sont inchangés — le
// filtre `accept` n'est qu'un confort de sélection, jamais un contrôle.
// ─────────────────────────────────────────────────────────────────────────────

const ACCEPTED = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png";

const CLIENT_EFFECTS = describeDepositEffects({ side: "CLIENT", cabinetFinal: false, documentValidated: false });

export function ClientUploadDialog({
  establishmentId,
  documentTypeId,
  documentLabel,
  notice,
  onClose,
}: {
  establishmentId: string;
  documentTypeId: string;
  documentLabel: string;
  // Consigne propre au document (le DIPEC : modèle vierge seulement).
  notice: string | null;
  onClose: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const deposit = useDocumentDeposit("CLIENT");
  const fileInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const dropZone = useRef<HTMLButtonElement>(null);
  const noticeId = useId();

  const step = deposit.outcome?.kind === "deposited" ? 3 : deposit.file ? 2 : 1;

  function pick(list: FileList | null) {
    deposit.choose(list?.[0]);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files);
  }

  function discard() {
    deposit.discard();
    requestAnimationFrame(() => dropZone.current?.focus());
  }

  function send() {
    if (!deposit.file) return;
    const formData = new FormData();
    formData.set("establishmentId", establishmentId);
    formData.set("documentTypeId", documentTypeId);
    formData.set("file", deposit.file);
    void deposit.send(formData);
  }

  const title = step === 1 ? `Choisissez le fichier : ${documentLabel}` : step === 2 ? "Vérifiez le fichier" : "Merci !";

  return (
    <Modal title={title} onClose={onClose} maxWidthClassName="max-w-[600px]">
      <div className="space-y-5 text-lg">
        <p className="font-bold text-ink2">Étape {step} sur 3</p>

        {step === 1 && (
          <>
            {deposit.outcome?.kind === "cancelled" && (
              <p role="status" className="rounded-lg bg-soft px-4 py-3 font-bold">
                {deposit.outcome.message}
              </p>
            )}
            {deposit.error && (
              <p role="alert" className="text-danger-text">
                {deposit.error}
              </p>
            )}
            {notice && (
              <p id={noticeId} className="rounded-lg border-2 border-ink bg-soft px-4 py-3 font-bold">
                {notice}
              </p>
            )}
            <button
              ref={dropZone}
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              aria-describedby={notice ? noticeId : undefined}
              className={`flex min-h-[200px] w-full flex-col items-center justify-center gap-2 rounded-xl border-[3px] border-dashed bg-paper ${
                dragging ? "border-accent-text" : "border-muted hover:border-accent-text"
              }`}
            >
              <Upload className="h-10 w-10 text-ink" aria-hidden="true" />
              <span className="font-bold">Choisir un fichier</span>
              <span className="text-ink2">ou glissez-le ici</span>
            </button>
            <Button type="button" variant="outline" size="lg" className="w-full text-lg" onClick={() => photoInput.current?.click()}>
              <Camera className="h-5 w-5" aria-hidden="true" />
              Prendre une photo du document
            </Button>
            {/* Vidés au choix : rechoisir le même fichier après « Annuler » rouvre
                le récapitulatif (un `change` ne part pas pour une valeur identique). */}
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => {
                pick(e.target.files);
                e.target.value = "";
              }}
            />
            {/* `capture` ouvre l'appareil photo sur tablette et téléphone. */}
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                pick(e.target.files);
                e.target.value = "";
              }}
            />
          </>
        )}

        {step === 2 && deposit.file && (
          <DepositReview
            file={deposit.file}
            documentLabel={documentLabel}
            effects={CLIENT_EFFECTS}
            density="client"
            sending={deposit.sending}
            cancelRequested={deposit.cancelRequested}
            phase={deposit.phase}
            elapsedMs={deposit.elapsedMs}
            error={deposit.error}
            onConfirm={send}
            onDiscard={discard}
            onRequestCancel={deposit.requestCancel}
          >
            <p className="font-bold">Vérifiez qu&apos;il ne contient pas le nom d&apos;une personne accompagnée.</p>
          </DepositReview>
        )}

        {step === 3 && (
          <>
            <div className="flex items-center gap-4" role="status">
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-green-fill text-3xl font-bold text-ink" aria-hidden="true">
                ✓
              </span>
              <div>
                <p className="text-xl font-bold">C&apos;est envoyé.</p>
                <p>La plateforme lit votre document. La réponse arrive dans « Mes documents ».</p>
              </div>
            </div>
            <Button type="button" size="lg" className="w-full text-lg font-bold" onClick={onClose}>
              Fermer
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
