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
