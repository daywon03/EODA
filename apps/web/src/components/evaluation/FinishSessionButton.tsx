"use client";

import { useState, useTransition } from "react";
import { finishEvaluationSession } from "@/lib/actions/evaluation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";

export function FinishSessionButton({ sessionId }: { sessionId: string }) {
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await finishEvaluationSession(sessionId);
      setDone(true);
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isPending || done}>
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
      )}
      {done ? "Session terminée" : "Terminer la session"}
    </Button>
  );
}
