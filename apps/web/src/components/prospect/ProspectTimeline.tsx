import type { ProspectStatus, ProspectTimelineKind } from "@eoda/database";
import { PROSPECT_STATUS_LABELS } from "./ProspectStatusBadge";
import { ArrowRight, MessageSquare } from "lucide-react";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export type TimelineEntry = {
  id: string;
  kind: ProspectTimelineKind;
  body: string | null;
  statusFrom: ProspectStatus | null;
  statusTo: ProspectStatus | null;
  createdAt: Date;
  author: { name: string } | null;
};

// Le dossier du prospect : ce qui s'est dit et ce qui a bougé, sur une seule frise.
// Les séparer obligerait à lire deux écrans pour répondre à « où en est-on, et
// pourquoi ? » — la question à laquelle ce module existe pour répondre.
export function ProspectTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-gris-mid">
        Aucun échange consigné pour l&apos;instant. Les changements d&apos;étape
        s&apos;inscrivent ici automatiquement.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <span
            className="flex items-center justify-center w-7 h-7 rounded-full bg-ivoire flex-shrink-0 mt-0.5"
            aria-hidden="true"
          >
            {entry.kind === "COMMENTAIRE" ? (
              <MessageSquare className="w-3.5 h-3.5 text-terre" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5 text-ambre" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-brun-ancre whitespace-pre-wrap break-words">
              {entry.kind === "COMMENTAIRE" ? entry.body : describeStatusChange(entry)}
            </p>
            <p className="text-xs text-gris-mid mt-0.5">
              {dateFormatter.format(entry.createdAt)}
              {/* Auteur absent = compte supprimé depuis. On l'écrit plutôt que de
                  laisser une ligne anonyme qui ferait douter de la trace. */}
              {" · "}
              {entry.author?.name ?? "auteur supprimé"}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Le changement d'étape est raconté à partir de `statusFrom`/`statusTo`, jamais
// depuis du texte figé en base : un libellé qui évolue doit se relire correctement
// sur les entrées anciennes.
function describeStatusChange(entry: TimelineEntry): string {
  const from = entry.statusFrom ? PROSPECT_STATUS_LABELS[entry.statusFrom] : "—";
  const to = entry.statusTo ? PROSPECT_STATUS_LABELS[entry.statusTo] : "—";
  return `Étape : ${from} → ${to}`;
}
