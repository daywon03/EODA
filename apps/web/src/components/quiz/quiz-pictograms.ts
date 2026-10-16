import { Droplets, Heart, MessageSquareWarning, ShieldCheck, Siren, type LucideIcon } from "lucide-react";
import type { QuizPictogram } from "@/content/quiz/types";

// Pictogrammes des quiz : icônes Lucide (CLAUDE.md §7 — jamais ARASAAC ni SantéBD),
// toujours accompagnées du titre du quiz en texte.
export const QUIZ_PICTOGRAMS: Record<QuizPictogram, LucideIcon> = {
  heart: Heart,
  shield: ShieldCheck,
  siren: Siren,
  droplets: Droplets,
  message: MessageSquareWarning,
};
