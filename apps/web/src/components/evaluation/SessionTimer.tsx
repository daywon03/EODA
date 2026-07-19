"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function SessionTimer({ startedAt }: { startedAt: Date }) {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <span className="flex items-center gap-1.5 text-xs text-gris-mid tabular-nums">
      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
      {formatDuration(Math.max(0, elapsed))}
    </span>
  );
}
