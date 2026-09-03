import { getClientThread, postClientMessage } from "@/lib/actions/message";
import { MessageThread } from "@/components/messages/MessageThread";
import { PageHeader } from "@/components/layout/PageHeader";
import { MessagesSquare, ShieldAlert } from "lucide-react";

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

      {/* L'avertissement était en gris 12 px, au même niveau qu'un texte d'aide.
          C'est pourtant la seule consigne qui compte de cet écran : un nom de personne
          accompagnée écrit ici est une donnée de santé dans un fil de discussion.
          Il devient un encart identifié — icône, contraste, texte de corps — sans
          devenir alarmant : le fil doit rester utilisé, c'est sa raison d'être. */}
      <div className="flex items-start gap-3 rounded-lg border border-ambre/40 bg-ambre/10 px-4 py-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-ambre" aria-hidden="true" />
        <div className="space-y-1 text-sm text-brun-ancre">
          <p className="font-medium">Aucune donnée personnelle dans ce fil.</p>
          <p className="text-gris-mid">
            Il sert aux questions courtes et au suivi de votre accompagnement. N&apos;y
            mentionnez pas d&apos;informations concernant les personnes accompagnées —
            les documents, eux, se déposent dans votre espace documentaire.
          </p>
        </div>
      </div>

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
