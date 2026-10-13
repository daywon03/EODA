"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { importStaffMembers } from "@/lib/actions/staff-quiz-write";

// Import d'une liste « nom ; métier » (CSV, pas de tableur binaire). Le résultat
// dit combien de personnes sont ajoutées et quelles lignes sont refusées, et pourquoi.
export function StaffImportDialog({ establishmentId }: { establishmentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("establishmentId", establishmentId);
    setMessage(null);
    startTransition(async () => {
      const result = await importStaffMembers(data);
      if ("error" in result) return setMessage({ tone: "error", text: result.error });
      setMessage({ tone: "ok", text: result.message });
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileUp className="h-4 w-4" aria-hidden="true" />
        Importer une liste
      </Button>
      {open && (
        <Modal title="Importer une liste de l’équipe" onClose={() => setOpen(false)} maxWidthClassName="max-w-xl">
          <form onSubmit={submit} className="space-y-4 overflow-y-auto p-5">
            <p>
              Un fichier CSV, une personne par ligne : <strong>nom ; métier</strong>. Par exemple : « Fatou D. ; Aide à
              domicile ».
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="staff-file">Fichier CSV</Label>
              <input
                id="staff-file"
                name="file"
                type="file"
                accept=".csv,text/csv,text/plain"
                required
                disabled={isPending}
                className="block w-full rounded-md border border-line bg-card p-2"
              />
            </div>
            {message && (
              <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "font-bold text-rouge-imp" : "text-ink"}>
                {message.text}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Importer
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
