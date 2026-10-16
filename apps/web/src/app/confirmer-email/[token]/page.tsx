import type { Metadata } from "next";
import { isOneTimeTokenWellFormed } from "@/lib/security/one-time-token";
import { CONFIRMATION_MESSAGES } from "@/lib/services/email-verification-service";
import { PublicCard } from "@/components/public/PublicCard";
import { ConfirmEmailForm } from "@/components/public/ConfirmEmailForm";
import { ResendVerificationForm } from "@/components/public/ResendVerificationForm";

// Le jeton est dans l'adresse : aucun référent ne part vers un autre site, aucun
// moteur n'indexe la page.
export const metadata: Metadata = {
  title: "Confirmer mon adresse",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

// Lien reçu par e-mail (tranche 11) — route ANONYMOUS (lib/auth/routes.ts, testée).
// La page n'écrit RIEN en s'affichant : la confirmation se fait au clic, par l'action
// confirmEmailAddress, qui revérifie tout (forme, débit, empreinte, usage unique).
export default async function ConfirmEmailPage({ params }: Props) {
  const { token } = await params;
  return (
    <PublicCard title="Confirmer mon adresse">
      {isOneTimeTokenWellFormed(token) ? (
        <ConfirmEmailForm token={token} />
      ) : (
        <>
          <p role="alert">{CONFIRMATION_MESSAGES.INVALID}</p>
          <ResendVerificationForm />
        </>
      )}
    </PublicCard>
  );
}
