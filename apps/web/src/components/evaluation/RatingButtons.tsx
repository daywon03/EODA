"use client";

import { useState, useTransition } from "react";
import { rateElement } from "@/lib/actions/evaluation";
import { Loader2, AlertTriangle } from "lucide-react";
import type { Rating } from "@eoda/database";

type RatingOption = { value: Rating; label: string; colorClass: string };

const BASE_OPTIONS: RatingOption[] = [
  { value: "R1", label: "1", colorClass: "bg-cot-1" },
  { value: "R2", label: "2", colorClass: "bg-cot-2" },
  { value: "R3", label: "3", colorClass: "bg-cot-3" },
  { value: "R4", label: "4", colorClass: "bg-cot-4" },
  { value: "STAR", label: "★", colorClass: "bg-cot-star" },
  { value: "NC", label: "NC", colorClass: "bg-cot-nc" },
];

const RI_OPTION: RatingOption = { value: "RI", label: "RI", colorClass: "bg-cot-ri" };

type Props = {
  sessionId: string;
  elementId: string;
  currentRating: Rating | null;
  allowsRi: boolean;
};

export function RatingButtons({ sessionId, elementId, currentRating, allowsRi }: Props) {
  const [rating, setRating] = useState<Rating | null>(currentRating);
  const [warning, setWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const options = allowsRi ? [...BASE_OPTIONS, RI_OPTION] : BASE_OPTIONS;

  function handleClick(value: Rating) {
    setWarning(null);
    startTransition(async () => {
      const result = await rateElement(sessionId, elementId, value, null);
      if ("error" in result) {
        setWarning(result.error);
        return;
      }
      setRating(value);
      if (result.warning) setWarning(result.warning);
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleClick(opt.value)}
            disabled={isPending}
            className={`w-8 h-8 rounded-md text-xs font-semibold text-white flex items-center justify-center transition-transform cursor-pointer disabled:cursor-not-allowed ${opt.colorClass} ${
              rating === opt.value ? "ring-2 ring-offset-1 ring-brun-ancre scale-105" : "opacity-60 hover:opacity-100"
            }`}
          >
            {opt.label}
          </button>
        ))}
        {isPending && <Loader2 className="w-4 h-4 animate-spin text-gris-mid self-center" aria-hidden="true" />}
      </div>
      {warning && (
        <p className="flex items-start gap-1 text-xs text-ambre max-w-md">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          {warning}
        </p>
      )}
    </div>
  );
}
