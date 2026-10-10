import { getEstablishment } from "@/lib/actions/establishment";
import { getCabinetThread, postCabinetMessage } from "@/lib/actions/message";
import { MessageThread } from "@/components/messages/MessageThread";

export const metadata = { title: "Échanges · EODA Conseil" };

type Props = { params: Promise<{ id: string }> };

// Fil d'échange, côté cabinet (CDC §5). `getCabinetThread` passe par
// `requireEstablishmentInTenant` : un identifiant hors périmètre donne notFound().
export default async function CabinetMessagesPage({ params }: Props) {
  const { id } = await params;
  const [establishment, messages] = await Promise.all([
    getEstablishment(id),
    getCabinetThread(id),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-xl font-bold text-ink">Échanges avec {establishment.name}</h2>

      <MessageThread
        messages={messages}
        viewerSide="CABINET"
        canPost
        action={postCabinetMessage.bind(null, id)}
      />
    </div>
  );
}
