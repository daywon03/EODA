// Message quand on passe une question sans répondre. Il nomme la réponse « je ne sais
// pas » de CETTE question, si elle en a une : écrit en dur, il proposait « Ne se
// prononce pas » sur des questions qui ne l'ont pas (12 A, 15…, version du 21/10).
export function missingAnswerHint(options: readonly { choice: string; label: string }[]): string {
  const dontKnow = options.find((option) => option.choice === "NSP");
  return dontKnow ? `Choisissez une réponse. « ${dontKnow.label} » en est une.` : "Choisissez une réponse.";
}
