"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { uploadEstablishmentLogo, removeEstablishmentLogo } from "@/lib/actions/establishment";
import { Button } from "@/components/ui/button";
import { AlertCircle, ImageUp, Loader2, Trash2 } from "lucide-react";

type Props = {
  establishmentId: string;
  establishmentName: string;
  logoDataUri: string | null;
};

// Dépôt du logo de la structure — apposé à côté de celui d'EODA sur les documents
// produits pour elle.
//
// Déposé par le CABINET et non par le client : c'est un élément de mise en page de nos
// livrables, pas une pièce de son dossier. Un aperçu remplace la description : sur un
// logo, ce qui compte est de voir ce qui sortira sur le document.
export function EstablishmentLogoForm({ establishmentId, establishmentName, logoDataUri }: Props) {
  const [state, formAction, isUploading] = useActionState(uploadEstablishmentLogo, null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemoving, startRemove] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const isPending = isUploading || isRemoving;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-40 items-center justify-center rounded-lg border border-dashed border-gris-light bg-ivoire/50 p-2">
          {logoDataUri ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoDataUri}
              alt={`Logo de ${establishmentName}`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="px-2 text-center text-xs text-gris-mid">Aucun logo déposé</span>
          )}
        </div>

        <div className="space-y-2">
          <form ref={formRef} action={formAction}>
            <input type="hidden" name="establishmentId" value={establishmentId} />
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg"
              disabled={isPending}
              onChange={() => formRef.current?.requestSubmit()}
              className="block w-full text-xs text-gris-mid file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-gris-light file:bg-white file:px-3 file:py-2 file:text-xs file:font-medium file:text-brun-ancre hover:file:border-terre/40 disabled:opacity-50"
              aria-label="Déposer le logo de la structure"
            />
          </form>

          <p className="flex items-center gap-1.5 text-xs text-gris-mid">
            <ImageUp className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            PNG ou JPEG, 300 Ko maximum. Il apparaîtra sur les documents produits pour
            cette structure, à côté du logo EODA.
          </p>

          {logoDataUri && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                setRemoveError(null);
                startRemove(async () => {
                  const result = await removeEstablishmentLogo(establishmentId);
                  if (result && "error" in result) setRemoveError(result.error);
                });
              }}
            >
              {isRemoving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              Retirer le logo
            </Button>
          )}
        </div>

        {isUploading && (
          <span className="flex items-center gap-1.5 text-xs text-gris-mid">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            Dépôt en cours…
          </span>
        )}
      </div>

      {(state?.error || removeError) && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-rouge-imp">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          {state?.error ?? removeError}
        </p>
      )}
    </div>
  );
}
