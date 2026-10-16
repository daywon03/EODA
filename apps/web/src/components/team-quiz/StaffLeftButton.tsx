"use client";

import { useRouter } from "next/navigation";
import { UserMinus } from "lucide-react";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { markStaffMemberLeft } from "@/lib/actions/staff-quiz-write";

// Départ d'une personne : elle sort de la matrice, ses quiz réussis restent dans
// l'émargement (rien n'est supprimé).
export function StaffLeftButton({ establishmentId, staffMemberId, name }: { establishmentId: string; staffMemberId: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmActionButton
      label="A quitté la structure"
      accessibleLabel={`${name} a quitté la structure`}
      icon={UserMinus}
      tone="neutral"
      compact
      question={`${name} a quitté la structure ? La personne sort de la liste ; ses quiz réussis restent dans l'émargement.`}
      confirmLabel="Oui, elle est partie"
      onConfirm={async () => {
        const result = await markStaffMemberLeft(establishmentId, staffMemberId);
        if (!result) router.refresh();
        return result;
      }}
    />
  );
}
