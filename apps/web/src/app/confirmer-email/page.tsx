import Link from "next/link";
import { PublicCard } from "@/components/public/PublicCard";
import { ResendVerificationForm } from "@/components/public/ResendVerificationForm";

export const metadata = { title: "Recevoir un nouveau lien" };

// Demande d'un nouveau lien de confirmation (tranche 11) — route ANONYMOUS. La réponse
// est la même que l'adresse attende une confirmation ou non (pas d'énumération).
export default function ResendConfirmationPage() {
  return (
    <PublicCard title="Recevoir un nouveau lien">
      <p>Écrivez l&apos;adresse utilisée à l&apos;inscription. Si un espace attend une confirmation, un nouveau lien part.</p>
      <ResendVerificationForm />
      <Link href="/login" className="font-bold text-accent-text underline underline-offset-4">
        Retour à la connexion
      </Link>
    </PublicCard>
  );
}
