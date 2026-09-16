import { getEnv } from "@/lib/config/env";

// Décrit une image extraite d'un document déposé (photo d'un panneau affiché,
// organigramme…) — enrichit le contexte d'analyse documentaire (demande de Damon,
// 16/09/2026). Modèle FIXE, jamais exposé au sélecteur cabinet (contrairement aux
// 4 modèles d'analyse dans openrouter-models.ts) : ce n'est pas un choix éditorial,
// c'est un détail d'implémentation. google/gemini-3.8-flash : le moins cher des
// modèles Gemini récents avec entrée image, vérifié sur openrouter.ai/google le
// 16/09/2026.
//
// BEST-EFFORT : toute erreur (réseau, clé absente, réponse inattendue) rend `null`
// plutôt que de lever — décrire une image est un enrichissement, jamais un
// préalable au dépôt du document (même discipline que extractMarkdown).
const VISION_MODEL = "google/gemini-3.8-flash";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

type OpenRouterVisionResponse = {
  choices?: { message?: { content?: string } | null }[];
};

export async function describeImage(input: {
  buffer: Buffer;
  contentType: string;
}): Promise<string | null> {
  const apiKey = getEnv().openrouter?.apiKey;
  if (!apiKey) return null;

  try {
    const base64 = input.buffer.toString("base64");
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://eoda-conseil.com",
        "X-Title": "EODA Conseil - Description d'image",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Décris en 2-3 phrases ce que représente cette image (photo d'un panneau affiché, organigramme, logo...), pour donner du contexte à une analyse documentaire. Reste factuel, pas d'interprétation.",
              },
              {
                type: "image_url",
                image_url: { url: `data:${input.contentType};base64,${base64}` },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`Description d'image — appel au modèle de vision échoué (HTTP ${response.status})`);
      return null;
    }

    const body = (await response.json()) as OpenRouterVisionResponse;
    const content = body.choices?.[0]?.message?.content;
    return content && content.trim().length > 0 ? content.trim() : null;
  } catch (error) {
    console.error("Description d'image — appel au modèle de vision échoué :", error);
    return null;
  }
}
