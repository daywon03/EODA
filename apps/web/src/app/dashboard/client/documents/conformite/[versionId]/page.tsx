import { getCorrectionWorkspace } from "@/lib/actions/correction-proposal";
import { CLIENT_DOCUMENTS_PATH } from "@/lib/design/client-navigation";
import { CorrectionWorkspaceView } from "@/components/conformite/CorrectionWorkspaceView";

export const metadata = { title: "Mettre en conformité" };

type Props = { params: Promise<{ versionId: string }> };

// « Mettre en conformité » côté structure (N8) : en autonomie seulement, et si l'offre
// comprend la génération de ce document — sinon introuvable (correction-context).
export default async function ClientCorrectionPage({ params }: Props) {
  const { versionId } = await params;
  const workspace = await getCorrectionWorkspace(versionId);
  return <CorrectionWorkspaceView workspace={workspace} backHref={CLIENT_DOCUMENTS_PATH} backLabel="Mes documents" />;
}
