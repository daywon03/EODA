import { isNodeRuntime } from "@/lib/config/env";

// Point d'entrée d'instrumentation Next.js : `register()` est appelé UNE FOIS au
// démarrage du serveur, avant la première requête. C'est le seul endroit où une
// application Next.js peut refuser de se lever sur une configuration incomplète.
export async function register(): Promise<void> {
  // register() est invoqué pour chaque runtime (Node.js et Edge) ; les contrôles
  // lisent la base et n'ont de sens que côté Node.
  if (!isNodeRuntime()) return;

  const { runStartupChecks } = await import("@/lib/config/startup-check");
  await runStartupChecks();
}
