import { requireCabinetSession } from "@/lib/auth/guards";
import { getCabinetAssistant } from "@/lib/actions/cabinet-assistant";
import { CabinetAssistant } from "@/components/assistant/CabinetAssistant";

export const metadata = { title: "Assistant" };

// ─────────────────────────────────────────────────────────────────────────────
// ASSISTANT DU MENU LATÉRAL (11/11/2026 — « comme MusicPlanner, mais pour EODA »).
// Administration et consultante (STRUCTURES_WRITE : poser une question coûte des
// crédits et propose des actions) ; chaque action serveur revérifie sa garde.
// ─────────────────────────────────────────────────────────────────────────────
export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ c?: string | string[] }> }) {
  const context = await requireCabinetSession("STRUCTURES_WRITE");
  const raw = (await searchParams).c;
  const conversationId = typeof raw === "string" && raw.length > 0 ? raw : null;
  const initial = await getCabinetAssistant(conversationId);

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Titre de page lu par les lecteurs d'écran ; l'écran, lui, s'ouvre sur la conversation. */}
      <h1 className="sr-only">Assistant</h1>
      <CabinetAssistant initial={initial} userName={context.session.user.name ?? null} />
    </div>
  );
}
