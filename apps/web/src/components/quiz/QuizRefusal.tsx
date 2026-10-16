import { CircleAlert } from "lucide-react";

const MESSAGES: Record<"INVALID" | "EXPIRED" | "USED" | "RATE_LIMITED", { title: string; text: string }> = {
  INVALID: { title: "Ce lien ne marche pas.", text: "Demandez un nouveau lien à votre responsable." },
  EXPIRED: { title: "Ce lien a expiré.", text: "Demandez un nouveau lien à votre responsable." },
  USED: { title: "Ce quiz est déjà fait.", text: "Merci ! Vos réponses sont bien enregistrées." },
  RATE_LIMITED: { title: "Trop d'essais.", text: "Attendez un quart d'heure, puis recommencez." },
};

// Refus du quiz public, en phrases courtes. Le même message pour un jeton inconnu
// et un jeton mal formé : on ne renseigne pas sur ce qui existe.
export function QuizRefusal({ state }: { state: keyof typeof MESSAGES }) {
  const message = MESSAGES[state];
  return (
    <section role="status" className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-card p-6">
      <CircleAlert className="h-10 w-10 text-accent-text" aria-hidden="true" />
      <h1 className="text-[26px] font-bold leading-tight">{message.title}</h1>
      <p>{message.text}</p>
    </section>
  );
}
