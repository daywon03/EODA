import Link from "next/link";
import { Info } from "lucide-react";
import type { LinkDisclosure } from "@/lib/services/email-verification-service";

// Ce que l'écran dit honnêtement de l'envoi du lien de confirmation (tranche 11). Sans
// service d'e-mail (poste local), il le dit ; en DÉVELOPPEMENT SEULEMENT, il montre le
// lien pour pouvoir tester (confirmationLinkDisclosure, testé : jamais en production).
export function LinkDisclosureNotice({ disclosure }: { disclosure: LinkDisclosure }) {
  if (!disclosure.emailNotSentLocally) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-soft p-4 text-base text-ink">
      <Info className="mt-1 h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <p className="font-bold">E-mail non envoyé en local</p>
        <p>Aucun service d&apos;envoi n&apos;est configuré sur ce poste : aucun e-mail n&apos;est parti.</p>
        {disclosure.devConfirmationPath && (
          <p>
            Développement seulement :{" "}
            <Link href={disclosure.devConfirmationPath} className="font-bold text-accent-text underline underline-offset-4">
              ouvrir le lien de confirmation
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
