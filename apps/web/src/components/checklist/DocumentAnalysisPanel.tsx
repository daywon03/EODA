"use client";

import { useState } from "react";
import { ChevronDown, AlertCircle, Lightbulb, Check, Sparkles } from "lucide-react";
import type { DocumentAnalysisResult } from "@/lib/llm";
import { describeAnalysis, summariseAnalysis } from "@/lib/services/analysis-view-service";

// Résultat de l'analyse automatique d'une version déposée. Replié par défaut : la
// checklist doit rester lisible en une page, l'analyse s'ouvre pour le document qu'on
// traite. Ce qui reste visible fermé, c'est le nombre de manques — la seule
// information qui décide si on ouvre.
export function DocumentAnalysisPanel({ analysis }: { analysis: DocumentAnalysisResult }) {
  const [open, setOpen] = useState(false);
  const summary = summariseAnalysis(analysis);

  return (
    <div className="mt-2 rounded-lg border border-gris-light bg-ivoire/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre focus-visible:ring-inset rounded-lg"
      >
        <ChevronDown
          className={`w-3.5 h-3.5 text-gris-mid flex-shrink-0 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
          aria-hidden="true"
        />
        <Sparkles className="w-3.5 h-3.5 text-ambre flex-shrink-0" aria-hidden="true" />
        <span className="text-xs text-brun-ancre font-medium">Analyse automatique</span>
        <span
          className={`text-xs ${summary.missingCount > 0 ? "text-rouge-imp" : "text-gris-mid"}`}
        >
          {describeAnalysis(summary)}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 animate-fade-in">
          {summary.missingCount > 0 && (
            <Section
              icon={<AlertCircle className="w-3.5 h-3.5 text-rouge-imp" aria-hidden="true" />}
              title="Éléments attendus non retrouvés"
              entries={analysis.elementsManquants}
            />
          )}

          {summary.suggestionCount > 0 && (
            <Section
              icon={<Lightbulb className="w-3.5 h-3.5 text-ambre" aria-hidden="true" />}
              title="Suggestions de correction"
              entries={analysis.suggestionsCorrection}
            />
          )}

          {summary.presentCount > 0 && (
            <Section
              icon={<Check className="w-3.5 h-3.5 text-vert-ok" aria-hidden="true" />}
              title="Éléments retrouvés"
              entries={analysis.elementsPresents}
            />
          )}

          {/* Mention non négociable : EODA est en conseil/préparation, jamais en
              évaluateur officiel (CLAUDE.md §1). Une analyse automatique présentée
              sans réserve serait lue comme un verdict de conformité HAS. */}
          <p className="text-xs text-gris-mid border-t border-gris-light pt-2">
            Analyse automatique produite à l&apos;appui de la préparation. Elle ne vaut
            pas évaluation HAS et ne remplace pas l&apos;appréciation de votre
            consultant.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  entries,
}: {
  icon: React.ReactNode;
  title: string;
  entries: string[];
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-brun-ancre mb-1">
        {icon}
        {title}
      </p>
      <ul className="space-y-1 pl-5">
        {entries.map((entry) => (
          <li key={entry} className="text-xs text-gris-mid list-disc marker:text-gris-light">
            {entry}
          </li>
        ))}
      </ul>
    </div>
  );
}
