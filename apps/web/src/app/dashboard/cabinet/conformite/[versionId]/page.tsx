import { getCorrectionWorkspace } from "@/lib/actions/correction-proposal";
import { requireCabinetSession } from "@/lib/auth/guards";
import { hasCabinetCapability } from "@/lib/auth/capabilities";
import { structureHref } from "@/lib/design/structure-tabs";
import { cabinetConformityHref, isAssistantPanelOpen } from "@/lib/services/document-assistant-entry-service";
import { CorrectionWorkspaceView } from "@/components/conformite/CorrectionWorkspaceView";
import { DocumentAssistant } from "@/components/assistant/DocumentAssistant";

export const metadata = { title: "Mise en conformité" };

type Props = {
  params: Promise<{ versionId: string }>;
  searchParams: Promise<{ assistant?: string | string[] }>;
};

// « Mettre en conformité » côté cabinet (N8) : toujours ouvert dans le tenant ; la
// génération reste soumise au droit de l'offre (correctionRight).
// L'assistant à droite (11/11/2026) : écriture STRUCTURES_WRITE seulement — poser une
// question coûte des crédits ; ses actions revérifient leur garde. Un document à accès
// restreint n'arrive jamais ici (getCorrectionWorkspace le refuse).
export default async function CabinetCorrectionPage({ params, searchParams }: Props) {
  const [{ versionId }, query] = await Promise.all([params, searchParams]);
  const [cabinet, workspace] = await Promise.all([
    requireCabinetSession("STRUCTURES_READ"),
    getCorrectionWorkspace(versionId),
  ]);
  const { establishmentId, documentTypeId } = workspace.context.version;
  const canUseAssistant = hasCabinetCapability(cabinet.role, "STRUCTURES_WRITE");

  return (
    <CorrectionWorkspaceView
      workspace={workspace}
      backHref={structureHref(establishmentId, "documents")}
      backLabel="Documents de la structure"
      assistant={
        canUseAssistant
          ? {
              open: isAssistantPanelOpen(query.assistant),
              openHref: cabinetConformityHref(versionId, { assistant: true }),
              closeHref: cabinetConformityHref(versionId, { assistant: false }),
              panel: <DocumentAssistant establishmentId={establishmentId} documentTypeId={documentTypeId} />,
            }
          : undefined
      }
    />
  );
}
