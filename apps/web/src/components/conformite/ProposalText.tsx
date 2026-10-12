import { Fragment } from "react";
import { splitFields } from "@/lib/services/correction-proposal-service";

// Rendu d'un passage en Markdown simple (titres #, listes -, gras **) — le
// sous-ensemble que produit la mise en conformité. Les champs `[À compléter : …]`
// sont soulignés en pointillé : « c'est là qu'il faut remplir » (context/10 §4).
// Jamais de HTML injecté : tout passe par du texte React.

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) => {
        const bold = chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4;
        const value = bold ? chunk.slice(2, -2) : chunk;
        const parts = splitFields(value).map((part, j) =>
          part.kind === "field" ? (
            <span key={j} className="rounded border-2 border-dashed border-ink2 bg-card px-1 font-bold">
              {part.value}
            </span>
          ) : (
            <Fragment key={j}>{part.value}</Fragment>
          )
        );
        return bold ? (
          <strong key={i}>{parts}</strong>
        ) : (
          <Fragment key={i}>{parts}</Fragment>
        );
      })}
    </>
  );
}

export function ProposalText({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text.split("\n").flatMap((raw, i) => {
        const line = raw.trim();
        if (line.length === 0) return [];
        const heading = /^#{1,3}\s+(.*)$/.exec(line);
        if (heading) {
          return [
            <p key={i} className="pt-2 font-bold">
              <Inline text={heading[1]!} />
            </p>,
          ];
        }
        const bullet = /^[-*]\s+(.*)$/.exec(line);
        if (bullet) {
          return [
            <p key={i} className="pl-4">
              <span aria-hidden="true">• </span>
              <Inline text={bullet[1]!} />
            </p>,
          ];
        }
        return [
          <p key={i}>
            <Inline text={line} />
          </p>,
        ];
      })}
    </div>
  );
}
