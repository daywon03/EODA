// Masquage best-effort des champs nominatifs évidents avant envoi à un LLM externe —
// contrainte RGPD, cf. specs/01-mvp-v1.md §Module 1. Best-effort uniquement : ne
// remplace pas une revue humaine, mais réduit le risque d'envoyer des données
// personnelles identifiantes évidentes (email, téléphone, NIR) dans le texte brut.

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /(?:(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4})/g;
// NIR (numéro de sécurité sociale) — 13 ou 15 chiffres, espaces optionnels
const NIR_PATTERN = /\b[12]\s?\d{2}\s?(?:0[1-9]|1[0-2])\s?(?:\d{2}|2[AB])\s?\d{3}\s?\d{3}(?:\s?\d{2})?\b/g;

export function anonymizeText(text: string): string {
  return text
    .replace(EMAIL_PATTERN, "[email masqué]")
    .replace(PHONE_PATTERN, "[téléphone masqué]")
    .replace(NIR_PATTERN, "[NIR masqué]");
}
