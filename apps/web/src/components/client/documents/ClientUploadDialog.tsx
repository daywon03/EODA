"use client";

import { useId, useRef, useState, useTransition, type DragEvent } from "react";
import { AlertCircle, Camera, FileText, Loader2, Upload } from "lucide-react";
import { uploadDocument } from "@/lib/actions/document";
import { prepareDocumentPages } from "@/lib/services/document-viewer-service";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// DÉPÔT EN TROIS ÉTAPES (maquette « Portail Client v2 », R6).
//
//   1. Choisir : un fichier, le glisser, ou prendre une photo (`capture`).
//   2. Vérifier : « C'est bien le document X ? » + l'avertissement nominatif.
//   3. Envoyé.
//
// Le dépôt passe par l'action `uploadDocument` EXISTANTE : la garde, le contrôle de
// périmètre et la détermination du type par signature binaire sont inchangés — le
// filtre `accept` n'est qu'un confort de sélection, jamais un contrôle.
// ─────────────────────────────────────────────────────────────────────────────

const ACCEPTED = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

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
  // Consigne propre au document (le DIPC : modèle vierge seulement).
  notice: string | null;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const noticeId = useId();

  const step = sent ? 3 : file ? 2 : 1;

  function pick(list: FileList | null) {
    const chosen = list?.[0];
    if (chosen) {
      setError(null);
      setFile(chosen);
    }
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files);
  }

  function send() {
    if (!file) return;
    const formData = new FormData();
    formData.set("establishmentId", establishmentId);
    formData.set("documentTypeId", documentTypeId);
    formData.set("file", file);
    setError(null);
    startTransition(async () => {
      const result = await uploadDocument(formData);
      if ("error" in result) setError(result.error);
      else {
        // Pages de l'aperçu préparées dès le dépôt (cf. DocumentUploadButton).
        prepareDocumentPages(result.documentVersionId, file.name);
        setSent(true);
      }
    });
  }

  const title = step === 1 ? `Choisissez le fichier : ${documentLabel}` : step === 2 ? "Vérifiez le fichier" : "Merci !";

  return (
    <Modal title={title} onClose={onClose} maxWidthClassName="max-w-[600px]">
      <div className="space-y-5 text-lg">
        <p className="font-bold text-ink2">Étape {step} sur 3</p>

        {step === 1 && (
          <>
            {notice && (
              <p id={noticeId} className="rounded-lg border-2 border-ink bg-soft px-4 py-3 font-bold">
                {notice}
              </p>
            )}
            <button
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
            <input ref={fileInput} type="file" accept={ACCEPTED} className="hidden" onChange={(e) => pick(e.target.files)} />
            {/* `capture` ouvre l'appareil photo sur tablette et téléphone. */}
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => pick(e.target.files)}
            />
          </>
        )}

        {step === 2 && file && (
          <>
            <div className="flex items-center gap-3.5 rounded-xl bg-paper p-4">
              <FileText className="h-9 w-9 flex-shrink-0 text-ink" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate font-bold">{file.name}</p>
                <p className="text-base text-ink2">{formatSize(file.size)}</p>
              </div>
            </div>
            <p className="text-xl">C&apos;est bien le document « {documentLabel} » ?</p>
            <p className="font-bold">Vérifiez qu&apos;il ne contient pas le nom d&apos;une personne accompagnée.</p>
            {error && (
              <p role="alert" className="flex items-start gap-2 text-danger-text">
                <AlertCircle className="mt-1 h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" size="lg" className="text-lg" disabled={isPending} onClick={() => setFile(null)}>
                ← Changer de fichier
              </Button>
              <Button type="button" size="lg" className="flex-1 text-lg font-bold" disabled={isPending} onClick={send}>
                {isPending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                Oui, envoyer
              </Button>
            </div>
          </>
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
