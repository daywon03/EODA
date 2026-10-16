import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { roleHomePath } from "@/lib/auth/capabilities";
import { readPublicMonthlyPrices } from "@/lib/db/read-public-offers";
import { parseSelfServiceFormule } from "@/lib/services/self-service-service";
import { SignupForm } from "@/components/public/SignupForm";

export const metadata = { title: "Créer mon espace" };

type Props = { searchParams: Promise<{ offre?: string }> };

// Inscription en libre-service en trois étapes (maquette « Portail Client v2 ») :
// structure, offre, compte. Crée un PROSPECT et son compte — jamais un établissement.
export default async function InscriptionPage({ searchParams }: Props) {
  const session = await auth();
  if (session) redirect(roleHomePath(session.user.role));
  const [{ offre }, prices] = await Promise.all([searchParams, readPublicMonthlyPrices()]);
  const initialOffer = parseSelfServiceFormule(offre) ?? "ESSENTIEL";
  return <SignupForm prices={prices} initialOffer={initialOffer} />;
}
