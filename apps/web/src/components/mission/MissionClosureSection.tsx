"use client";

import { useState, useTransition } from "react";
import { closeMission, reopenMission, setClientAccessRevoked } from "@/lib/actions/mission";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, Lock, Unlock, Archive, RotateCcw } from "lucide-react";
import { formatDate } from "@/lib/services/date-format-service";
import {
  deriveMissionAccessState,
  MISSION_ACCESS_LABELS,
} from "@/lib/services/mission-access-service";

type Props = {
  missionId: string;
  closedAt: Date | null;
  clientAccessRevokedAt: Date | null;
  // Clore et révoquer sont des décisions de gérance, pas du suivi opérationnel :
  // l'action serveur les réserve à CABINET_ADMIN. Ce drapeau ne fait que ne pas
  // proposer un bouton qui serait refusé.
  canManageClosure: boolean;
};



export function MissionClosureSection({
  missionId,
  closedAt,
  clientAccessRevokedAt,
  canManageClosure,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const state = deriveMissionAccessState({ closedAt, clientAccessRevokedAt });

  function run(action: () => Promise<{ error: string } | null>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-brun-ancre">Fin de mission</h3>
        <Badge variant={state === "ACTIVE" ? "secondary" : undefined}>
          {MISSION_ACCESS_LABELS[state]}
        </Badge>
        {isPending && <Loader2 className="w-4 h-4 animate-spin text-gris-mid" aria-hidden="true" />}
      </div>

      <p className="text-sm text-gris-mid">
        {state === "ACTIVE" &&
          "L'accompagnement est en cours : le client dépose ses documents et consulte son espace."}
        {state === "LIBRARY" &&
          `Mission close le ${closedAt ? formatDate(closedAt) : "—"}. Le client garde l'accès à sa bibliothèque en lecture seule ; plus aucun dépôt n'est possible.`}
        {state === "REVOKED" &&
          `Accès client coupé le ${clientAccessRevokedAt ? formatDate(clientAccessRevokedAt) : "—"}. Les documents sont conservés côté cabinet — rien n'a été supprimé.`}
      </p>

      {canManageClosure && (
        <div className="flex flex-wrap gap-2">
          {closedAt === null ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => closeMission(missionId))}
            >
              <Archive className="w-3.5 h-3.5" aria-hidden="true" />
              Clore la mission
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => reopenMission(missionId))}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Rouvrir la mission
            </Button>
          )}

          {clientAccessRevokedAt === null ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => setClientAccessRevoked(missionId, true))}
            >
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              Révoquer l&apos;accès client
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => run(() => setClientAccessRevoked(missionId, false))}
            >
              <Unlock className="w-3.5 h-3.5" aria-hidden="true" />
              Rétablir l&apos;accès client
            </Button>
          )}
        </div>
      )}

      {/* Dit ce que ces boutons ne font PAS. La crainte légitime devant « révoquer »
          est la perte de données ; ici rien n'est supprimé, et les deux gestes se
          défont. */}
      <p className="text-xs text-gris-mid">
        Aucun de ces gestes ne supprime de document : ils ouvrent ou ferment l&apos;accès,
        et se défont. La rétention reste côté cabinet.
      </p>

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-rouge-imp">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
