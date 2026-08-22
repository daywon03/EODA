import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Sparkles, PencilLine, CheckCircle2 } from "lucide-react";
import type { MissionDocumentCounters as Counters } from "@/lib/services/mission-document-counters-service";

type Props = { counters: Counters };

// Reflet en lecture seule du portail client — §12.4. Aucun contrôle de dépôt ici :
// le dépôt vit dans le portail client opérationnel, jamais dans le portail de suivi.
const CELLS: { key: keyof Counters; label: string; icon: typeof Upload; color: string }[] = [
  { key: "deposited", label: "Déposés", icon: Upload, color: "text-terre bg-terre/10" },
  { key: "analyzed", label: "Analysés par l'IA", icon: Sparkles, color: "text-ambre bg-ambre/10" },
  { key: "modified", label: "Modifiés", icon: PencilLine, color: "text-brun-ancre bg-brun-ancre/10" },
  { key: "compliant", label: "Conformes", icon: CheckCircle2, color: "text-vert-ok bg-vert-ok/10" },
];

export function MissionDocumentCounters({ counters }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Documents du portail client</CardTitle>
        <CardDescription>
          Reflet en lecture seule du portail client — le dépôt se fait depuis la fiche
          établissement, pas ici.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CELLS.map(({ key, label, icon: Icon, color }) => (
            <div key={key} className="flex items-center gap-2.5">
              <span
                className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${color}`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brun-ancre tabular-nums leading-none">
                  {counters[key]}
                </p>
                <p className="text-xs text-gris-mid leading-none mt-1">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
