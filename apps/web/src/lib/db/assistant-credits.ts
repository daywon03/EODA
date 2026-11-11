import { prisma } from "@eoda/database";
import { ASSISTANT_DAILY_CREDITS, parisDay } from "@/lib/services/assistant-service";

// Crédits du jour (Paris) d'un compte, PARTAGÉS par l'assistant de la fiche document et
// celui du menu latéral (11/11/2026) : 40 par jour, quel que soit l'endroit où l'on
// pose la question. Aucune garde ici : les appelants ont franchi lib/auth/guards.ts.

export async function creditsUsedToday(userId: string): Promise<number> {
  const row = await prisma.assistantCreditDay.findUnique({
    where: { userId_day: { userId, day: parisDay(new Date()) } },
    select: { used: true },
  });
  return Math.min(row?.used ?? 0, ASSISTANT_DAILY_CREDITS);
}

export async function debitCredits(userId: string, credits: number, inputTokens: number, outputTokens: number): Promise<void> {
  const day = parisDay(new Date());
  await prisma.assistantCreditDay.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, used: credits, inputTokens, outputTokens },
    update: { used: { increment: credits }, inputTokens: { increment: inputTokens }, outputTokens: { increment: outputTokens } },
  });
}
