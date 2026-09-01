"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

type Props = {
  // Nom du fichier attendu, convention EODA (devis-sharing-service). Posé comme
  // titre du document : c'est lui que le navigateur propose par défaut dans
  // « Enregistrer au format PDF ». Sans ça, la pièce jointe s'appelle « localhost »
  // ou « Devis · EODA Conseil », et Sandrine la renomme à la main à chaque envoi.
  fileName: string;
  // Ouverture depuis « Télécharger » : la boîte d'impression s'ouvre seule.
  auto?: boolean;
};

export function PrintButton({ fileName, auto = false }: Props) {
  const hasAutoPrinted = useRef(false);

  useEffect(() => {
    const previousTitle = document.title;
    // Le titre sert de nom de fichier proposé : l'extension y ferait un doublon
    // (« ….pdf.pdf »).
    document.title = fileName.replace(/\.pdf$/i, "");
    return () => {
      document.title = previousTitle;
    };
  }, [fileName]);

  useEffect(() => {
    // Une seule fois : `window.print()` bloque le rendu, et un second appel au
    // remontage rouvrirait la boîte de dialogue derrière celle déjà ouverte.
    if (!auto || hasAutoPrinted.current) return;
    hasAutoPrinted.current = true;
    window.print();
  }, [auto]);

  return (
    <Button type="button" size="sm" onClick={() => window.print()} className="print:hidden">
      <Printer className="w-3.5 h-3.5" aria-hidden="true" />
      Enregistrer en PDF
    </Button>
  );
}
