// Règles d'affichage PURES de l'assistant (refonte du 11/11/2026, façon ChatGPT / Claude).

export type ConversationSummary = { id: string; title: string; updatedAt: Date };

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const DAY = 24 * 60 * 60 * 1000;

// L'historique groupé par date, dans l'ordre reçu (le plus récent d'abord).
export function groupConversationsByDate(
  conversations: readonly ConversationSummary[],
  now: Date
): { label: string; items: ConversationSummary[] }[] {
  const today = startOfDay(now);
  const labelOf = (date: Date): string => {
    const day = startOfDay(date);
    if (day >= today) return "Aujourd'hui";
    if (day >= today - DAY) return "Hier";
    if (day >= today - 7 * DAY) return "7 derniers jours";
    return "Plus ancien";
  };
  const groups: { label: string; items: ConversationSummary[] }[] = [];
  for (const conversation of conversations) {
    const label = labelOf(conversation.updatedAt);
    const group = groups.find((g) => g.label === label);
    if (group) group.items.push(conversation);
    else groups.push({ label, items: [conversation] });
  }
  return groups;
}

export function firstName(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? first : null;
}

// ── Ce que l'assistant a lu (11/11/2026) ─────────────────────────────────────
// Sous chaque réponse, une phrase au lieu de la liste brute des outils : « A lu vos
// structures, 2 documents et le référentiel HAS · 1 crédit ». Les outils propose_…
// ne lisent rien (ils créent une carte) : ils n'y figurent pas.

const READ_TOOLS: Record<string, { one: string; many: (n: number) => string; order: number }> = {
  list_structures: { one: "vos structures", many: () => "vos structures", order: 0 },
  get_structure_documents: { one: "la liste des documents d'une structure", many: (n) => `les documents de ${n} structures`, order: 1 },
  get_document: { one: "1 document", many: (n) => `${n} documents`, order: 2 },
  describe_document_design: { one: "la mise en page d'un Word", many: (n) => `la mise en page de ${n} Word`, order: 3 },
  get_structure_design: { one: "la mise en page enregistrée", many: () => "la mise en page enregistrée", order: 4 },
  search_knowledge: { one: "le référentiel HAS", many: () => "le référentiel HAS", order: 5 },
};

function joinFrench(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} et ${parts.at(-1)}`;
}

export function describeAssistantReading(toolsUsed: readonly string[], credits: number): string | null {
  const counts = new Map<string, number>();
  for (const name of toolsUsed) if (READ_TOOLS[name]) counts.set(name, (counts.get(name) ?? 0) + 1);
  const creditText = credits > 0 ? `${credits} crédit${credits > 1 ? "s" : ""}` : null;
  if (counts.size === 0) return creditText;
  const parts = [...counts.entries()]
    .sort(([a], [b]) => READ_TOOLS[a]!.order - READ_TOOLS[b]!.order)
    .map(([name, n]) => (n > 1 ? READ_TOOLS[name]!.many(n) : READ_TOOLS[name]!.one));
  const reading = `A lu ${joinFrench(parts)}`;
  return creditText ? `${reading} · ${creditText}` : reading;
}

// Ce qui s'enregistre : les seuls outils de LECTURE connus — un nom d'outil vient du
// modèle, il n'est stocké que s'il est l'un des nôtres.
export function readToolsOnly(toolsUsed: readonly string[]): string[] {
  return toolsUsed.filter((name) => Object.hasOwn(READ_TOOLS, name)).slice(0, 40);
}
