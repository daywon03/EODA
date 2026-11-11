"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, Trash2 } from "lucide-react";
import {
  removeDocumentDesignModel,
  saveDocumentDesignNotes,
  uploadDocumentDesignModel,
} from "@/lib/actions/document-design";
import { formatDate } from "@/lib/services/date-format-service";
import { MAX_DESIGN_NOTES_LENGTH } from "@/lib/services/document-design-service";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// « Mise en page des documents » d'une structure (11/11/2026). Le document corrigé
// reprend d'abord son PROPRE Word ; ce modèle sert quand il n'y en a pas (PDF, document
// écrit par EODA). Les consignes écrites partent à la mise en conformité.
export function DocumentDesignForm({
  establishmentId,
  modelFilename,
  notes,
  updatedAt,
}: {
  establishmentId: string;
  modelFilename: string | null;
  notes: string | null;
  updatedAt: Date | null;
}) {
  const router = useRouter();
  const [text, setText] = useState(notes ?? "");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const fileId = useId();
  const notesId = useId();

  function done(result: { error: string } | null, ok: string) {
    if (result && "error" in result) setMessage({ tone: "error", text: result.error });
    else {
      setMessage({ tone: "ok", text: ok });
      router.refresh();
    }
  }

  function upload(file: File) {
    const data = new FormData();
    data.set("establishmentId", establishmentId);
    data.set("file", file);
    setMessage(null);
    startTransition(async () => done(await uploadDocumentDesignModel(data), "Modèle enregistré."));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="font-bold text-ink">Modèle Word de la structure</p>
        <p className="text-sm text-ink2">
          Son papier à en-tête, ses polices et ses styles de titres. Servent quand le document corrigé n&apos;est pas
          lui-même un Word — sinon, c&apos;est le Word du document qui garde sa mise en page.
        </p>
        {modelFilename ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-ink">{modelFilename}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => startTransition(async () => done(await removeDocumentDesignModel(establishmentId), "Modèle retiré."))}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Retirer
            </Button>
          </div>
        ) : (
          <p className="text-sm text-ink2">Aucun modèle déposé.</p>
        )}
        <label htmlFor={fileId} className="sr-only">
          Déposer un modèle Word
        </label>
        <input
          id={fileId}
          ref={fileRef}
          type="file"
          accept=".docx"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file);
            event.target.value = "";
          }}
        />
        <Button type="button" variant="outline" disabled={isPending} onClick={() => fileRef.current?.click()}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileUp className="h-4 w-4" aria-hidden="true" />}
          {modelFilename ? "Remplacer le modèle" : "Déposer un modèle Word"}
        </Button>
      </div>

      <div className="space-y-2">
        <label htmlFor={notesId} className="block font-bold text-ink">
          Consignes de mise en page
        </label>
        <p className="text-sm text-ink2">Ce que la mise en conformité doit respecter : titres, numérotation, formulations.</p>
        <Textarea
          id={notesId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          maxLength={MAX_DESIGN_NOTES_LENGTH}
          disabled={isPending}
          placeholder="ex : titres en majuscules, numérotation 1. / 1.1, tableau « Identification du document » en tête."
        />
        <Button
          type="button"
          disabled={isPending}
          onClick={() => {
            setMessage(null);
            startTransition(async () => done(await saveDocumentDesignNotes(establishmentId, text), "Consignes enregistrées."));
          }}
        >
          Enregistrer les consignes
        </Button>
      </div>

      {updatedAt && <p className="text-sm text-ink2">Modifié le {formatDate(updatedAt)}.</p>}
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-danger-text" : "flex items-center gap-1.5 text-ok-text"}>
          {message.tone === "ok" && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          {message.text}
        </p>
      )}
    </div>
  );
}
