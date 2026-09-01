import { getClientThread, postClientMessage } from "@/lib/actions/message";
import { MessageThread } from "@/components/messages/MessageThread";
import { PageHeader } from "@/components/layout/PageHeader";
import { MessagesSquare } from "lucide-react";

export const metadata = { title: "Mes échanges · EODA Conseil" };

// Fil d'échange, côté client (CDC §5). Aucun identifiant d'établissement n'entre ici :
// `getClientThread` le résout depuis le lien EstablishmentUser de la session.
export default async function ClientMessagesPage() {
  const { establishmentName, messages, canPost } = await getClientThread();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes échanges"
        subtitle={establishmentName ?? undefined}
        icon={MessagesSquare}
        accent="ambre"
      />

      <p className="rounded-lg border border-gris-light bg-ivoire px-4 py-3 text-xs text-gris-mid">
        Ce fil sert aux questions courtes et au suivi de votre accompagnement. Pour éviter
        toute diffusion de données personnelles, n&apos;y mentionnez pas d&apos;informations
        concernant les personnes accompagnées : les documents se déposent dans votre espace
        documentaire.
      </p>

      <MessageThread
        messages={messages}
        viewerSide="CLIENT"
        canPost={canPost}
        action={postClientMessage}
        readOnlyNotice="Votre accès ne permet plus d'envoyer de message. Contactez EODA Conseil par e-mail."
      />
    </div>
  );
}
