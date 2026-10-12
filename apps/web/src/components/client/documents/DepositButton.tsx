"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ClientUploadDialog } from "./ClientUploadDialog";

// Bouton « Déposer » seul (accueil) : ouvre le dépôt en trois étapes.
export function DepositButton({
  establishmentId,
  documentTypeId,
  documentLabel,
  notice,
  label = "Déposer",
  large = false,
  secondary = false,
}: {
  establishmentId: string;
  documentTypeId: string;
  documentLabel: string;
  notice: string | null;
  label?: string;
  large?: boolean;
  // Geste secondaire (« Déposer une autre version ») : contour, pas d'aplat.
  secondary?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="lg"
        variant={secondary ? "outline" : "default"}
        className={cn(
          secondary ? "font-normal" : "font-bold",
          large ? "h-14 px-6 text-[19px]" : "h-12 px-5 text-[17px]"
        )}
        onClick={() => setOpen(true)}
      >
        {label}
        {/* Nom accessible distinct par document : une liste de « Déposer » tous
            identiques ne dit rien à un lecteur d'écran. Le libellé visible reste
            au début du nom (WCAG 2.5.3, « label dans le nom »). */}
        <span className="sr-only"> : {documentLabel}</span>
      </Button>
      {open && (
        <ClientUploadDialog
          establishmentId={establishmentId}
          documentTypeId={documentTypeId}
          documentLabel={documentLabel}
          notice={notice}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
