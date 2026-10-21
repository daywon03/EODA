"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisRunPhase } from "@/lib/services/analysis-progress-service";

// Une analyse en deux temps visibles (analysis-progress-service) : l'action serveur
// (dépôt ou réanalyse) rend la main DÈS que l'analyse est enregistrée — elle ne
// re-rend plus la page —, puis l'affichage est rafraîchi à part. Sans cette coupure,
// la réponse de l'action embarquait le rendu complet de la fiche, et l'écran tournait
// encore longtemps après la fin de l'analyse.
export function useAnalysisRun() {
  const router = useRouter();
  const [phase, setPhase] = useState<AnalysisRunPhase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRefreshing, startRefresh] = useTransition();
  const refreshStarted = useRef(false);

  useEffect(() => {
    if (phase !== "running") return;
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAt), 500);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === "refreshing" && refreshStarted.current && !isRefreshing) {
      refreshStarted.current = false;
      setPhase("done");
    }
  }, [phase, isRefreshing]);

  // `succeeded` : la réponse du serveur annonce-t-elle une analyse enregistrée ? Sur
  // un refus, rien n'a changé : on revient à l'état initial, sans rafraîchir.
  async function run<R>(task: () => Promise<R>, succeeded: (result: R) => boolean): Promise<R> {
    setElapsedMs(0);
    setPhase("running");
    try {
      const result = await task();
      if (!succeeded(result)) {
        setPhase("idle");
        return result;
      }
      refreshStarted.current = true;
      setPhase("refreshing");
      startRefresh(() => router.refresh());
      return result;
    } catch (error) {
      setPhase("idle");
      throw error;
    }
  }

  return { phase, elapsedMs, run, busy: phase === "running" || phase === "refreshing" };
}
