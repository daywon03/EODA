import { getCorrectionWorkspace } from "@/lib/actions/correction-proposal";
import { structureHref } from "@/lib/design/structure-tabs";
import { CorrectionWorkspaceView } from "@/components/conformite/CorrectionWorkspaceView";

export const metadata = { title: "Mise en conformité" };

type Props = { params: Promise<{ versionId: string }> };

// « Mettre en conformité » côté cabinet (N8) : toujours ouvert dans le tenant ; la
// génération reste soumise au droit de l'offre (correctionRight).
export default async function CabinetCorrectionPage({ params }: Props) {
  const { versionId } = await params;
  const workspace = await getCorrectionWorkspace(versionId);
  return (
    <CorrectionWorkspaceView
      workspace={workspace}
      backHref={structureHref(workspace.context.version.establishmentId, "documents")}
      backLabel="Documents de la structure"
    />
  );
}
