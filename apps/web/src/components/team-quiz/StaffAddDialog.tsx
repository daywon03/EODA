"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { addStaffMember } from "@/lib/actions/staff-quiz-write";

// « + Ajouter une personne » : une fiche salarié, SANS compte (forte rotation). Le
// téléphone et l'e-mail sont facultatifs — aucun SMS n'est envoyé (décision 8).
export function StaffAddDialog({ establishmentId }: { establishmentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("establishmentId", establishmentId);
    setError(null);
    startTransition(async () => {
      const result = await addStaffMember(data);
      if (result) return setError(result.error);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        Ajouter une personne
      </Button>
      {open && (
        <Modal title="Ajouter une personne à l’équipe" onClose={() => setOpen(false)} maxWidthClassName="max-w-xl">
          <form onSubmit={submit} className="space-y-4 overflow-y-auto p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="staff-name">Prénom et initiale</Label>
                <Input id="staff-name" name="displayName" required maxLength={120} placeholder="Fatou D." disabled={isPending} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-job">Métier</Label>
                <Input id="staff-job" name="jobTitle" required maxLength={120} placeholder="Aide à domicile" disabled={isPending} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-phone">Téléphone (facultatif)</Label>
                <Input id="staff-phone" name="phone" type="tel" maxLength={30} disabled={isPending} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-email">E-mail (facultatif)</Label>
                <Input id="staff-email" name="email" type="email" maxLength={200} disabled={isPending} />
              </div>
            </div>
            {error && (
              <p role="alert" className="font-bold text-rouge-imp">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Ajouter
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
