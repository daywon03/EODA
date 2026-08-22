"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <Button type="button" size="sm" onClick={() => window.print()} className="print:hidden">
      <Printer className="w-3.5 h-3.5" aria-hidden="true" />
      Imprimer
    </Button>
  );
}
