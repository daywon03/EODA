import type { Metadata } from "next";
import { openPasswordSetupLink } from "@/lib/actions/password-setup";
import { isOneTimeTokenWellFormed } from "@/lib/security/one-time-token";
import { PASSWORD_SETUP_LINK_MESSAGES } from "@/lib/services/password-setup-service";
import { PublicCard } from "@/components/public/PublicCard";
import { PasswordSetupForm } from "@/components/public/PasswordSetupForm";

// Le jeton est dans l'adresse : aucun référent ne part vers un autre site, aucun
// moteur n'indexe la page.
export const metadata: Metadata = {
  title: "Choisir mon mot de passe",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

// Lien reçu par e-mail (audit du 28/10/2026) — route ANONYMOUS (lib/auth/routes.ts,
// testée). La page n'écrit RIEN en s'affichant : le mot de passe se pose à l'envoi du
// formulaire, par setPasswordFromLink, qui revérifie tout (forme, débit, empreinte,
// usage unique).
export default async function PasswordSetupPage({ params }: Props) {
  const { token } = await params;
  const link = isOneTimeTokenWellFormed(token) ? await openPasswordSetupLink(token) : { state: "INVALID" as const, email: null };
  return (
    <PublicCard title="Choisir mon mot de passe">
      {link.state === "VALID" && link.email ? <PasswordSetupForm token={token} email={link.email} /> : <p role="alert">{PASSWORD_SETUP_LINK_MESSAGES[link.state === "VALID" ? "INVALID" : link.state]}</p>}
    </PublicCard>
  );
}
