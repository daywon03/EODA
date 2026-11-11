import { Sparkles } from "lucide-react";
import { requireCabinetSession } from "@/lib/auth/guards";
import { getCabinetAssistant } from "@/lib/actions/cabinet-assistant";
import { PageHeader } from "@/components/layout/PageHeader";
import { CabinetAssistant } from "@/components/assistant/CabinetAssistant";

export const metadata = { title: "Assistant" };

// ─────────────────────────────────────────────────────────────────────────────
// ASSISTANT DU MENU LATÉRAL (11/11/2026 — « comme MusicPlanner, mais pour EODA »).
// Administration et consultante (STRUCTURES_WRITE : poser une question coûte des
// crédits et propose des actions) ; chaque action serveur revérifie sa garde.
// ─────────────────────────────────────────────────────────────────────────────
export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ c?: string | string[] }> }) {
  await requireCabinetSession("STRUCTURES_WRITE");
  const raw = (await searchParams).c;
  const conversationId = typeof raw === "string" && raw.length > 0 ? raw : null;
  const initial = await getCabinetAssistant(conversationId);

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Assistant"
        subtitle="Vos structures, leurs documents et leur mise en page, le référentiel HAS — des propositions à vérifier"
        icon={Sparkles}
      />
      <CabinetAssistant initial={initial} />
    </div>
  );
}
