import { Info, TriangleAlert } from "lucide-react";
import type { HelpBlock } from "@/content/aide";

// Rendu des blocs de contenu. Aucun texte d'article n'est écrit ici : ce composant
// ne connaît que des formes (paragraphe, étapes, liste, encadré). Le contenu vit
// dans src/content/aide/*.
export function HelpArticleBody({ blocks }: { blocks: readonly HelpBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;

        if (block.kind === "paragraph") {
          return (
            <p key={key} className="text-sm text-brun-ancre leading-relaxed">
              {block.text}
            </p>
          );
        }

        if (block.kind === "steps") {
          return (
            <ol key={key} className="space-y-2">
              {block.items.map((item, i) => (
                <li key={item} className="flex gap-3 text-sm text-brun-ancre leading-relaxed">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-terre text-white text-xs font-semibold flex-shrink-0 tabular-nums">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{item}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (block.kind === "list") {
          return (
            <ul key={key} className="space-y-1.5">
              {block.items.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm text-brun-ancre leading-relaxed">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-ambre flex-shrink-0" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        const isWarning = block.tone === "warning";
        const Icon = isWarning ? TriangleAlert : Info;
        return (
          <div
            key={key}
            className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${
              isWarning
                ? "bg-rouge-imp/5 border-rouge-imp/25 text-brun-ancre"
                : "bg-ambre/10 border-ambre/30 text-brun-ancre"
            }`}
          >
            <Icon
              className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isWarning ? "text-rouge-imp" : "text-ambre"}`}
              aria-hidden="true"
            />
            <span className="leading-relaxed">{block.text}</span>
          </div>
        );
      })}
    </div>
  );
}
