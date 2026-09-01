"use client";

import { useTransition } from "react";
import { openEvaluationSession } from "@/lib/actions/evaluation";
import { Button } from "@/components/ui/button";
import { Loader2, Play } from "lucide-react";

type Props = {
  establishmentId: string;
  chapterId: string;
  chapterNumber: number;
  // Une session a déjà eu lieu sur ce chapitre : le libellé doit le dire, parce que
  // « démarrer » et « en ouvrir une seconde » ne sont pas le même geste — le second
  // engage à refaire l'exercice complet.
  isSecondSession: boolean;
};

// Ouverture explicite d'une session de cotation.
//
// Ce bouton existe parce que la page ne crée plus de session en se chargeant : elle
// le faisait, et rouvrir un chapitre après une clôture faisait disparaître toutes les
// cotations de l'écran (la nouvelle session, vide, était la plus récente).
export function OpenSessionButton({
  establishmentId,
  chapterId,
  chapterNumber,
  isSecondSession,
}: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await openEvaluationSession(establishmentId, chapterId, chapterNumber);
        })
      }
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Play className="h-4 w-4" aria-hidden="true" />
      )}
      {isSecondSession ? "Ouvrir une nouvelle session" : "Démarrer la session de cotation"}
    </Button>
  );
}
