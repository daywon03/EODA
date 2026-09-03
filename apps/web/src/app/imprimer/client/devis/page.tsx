import { notFound } from "next/navigation";
import { getOwnSignedDevis } from "@/lib/actions/client-documents";
import { DevisSummaryPrintable } from "@/components/devis/DevisSummaryPrintable";
import { PrintButton } from "@/components/devis/PrintButton";
import { buildDevisFileName } from "@/lib/services/devis-sharing-service";

export const metadata = { title: "Mon devis signé · EODA Conseil" };

// ─────────────────────────────────────────────────────────────────────────────
// LE DEVIS SIGNÉ, VU PAR LA STRUCTURE QU'IL ENGAGE.
//
// 🔐 AUCUN IDENTIFIANT DANS L'URL. Le devis est résolu depuis le lien de session,
// comme le fil d'échange : il n'y a rien à falsifier, et donc aucune classe IDOR
// possible sur cette route. C'est pour ça qu'elle existe à côté de
// `/imprimer/devis/[id]` plutôt que d'assouplir la garde de celle-ci — deux gardes
// à tenir, c'est une de trop.
//
// Sans devis signé : `notFound()`. Ni page vide, ni message d'erreur qui laisserait
// croire à une panne — il n'y a simplement rien à montrer tant que rien n'est signé.
// ─────────────────────────────────────────────────────────────────────────────
export default async function ImprimerMonDevisPage() {
  const devis = await getOwnSignedDevis();
  if (!devis) notFound();

  const fileName = buildDevisFileName({
    number: devis.number,
    structureName: devis.prospectStructureName,
    issuedOn: devis.createdAt,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end print:hidden">
        <PrintButton fileName={fileName} />
      </div>
      <DevisSummaryPrintable {...devis} />
    </div>
  );
}
