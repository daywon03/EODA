"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// ZONE DE SIGNATURE — une seule image PNG FINALE, rien du tracé.
//
// Les points ne sont jamais mémorisés : chaque mouvement est dessiné directement sur
// le canevas, puis oublié. À la fin d'un trait, seule l'image rendue
// (`toDataURL("image/png")`) remonte au parent. Aucune vitesse, pression, ni ordre
// des points n'existe nulle part — c'est ce qui en ferait une donnée biométrique
// (09 §8).
// ─────────────────────────────────────────────────────────────────────────────
// L'image remise est TOUJOURS à l'encre noire. À l'écran, le trait prend la couleur
// du texte ; en thème sombre il est clair, et collé tel quel sur un contrat blanc il
// devenait presque invisible (mesuré le 26/10/2026 sur le PDF du DIPEC). On redessine
// donc l'image en noir, en gardant sa transparence (`source-in`).
function inkPng(canvas: HTMLCanvasElement): string {
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  ctx.drawImage(canvas, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

// `label` nomme le cadre quand plusieurs signataires signent sur le même écran
// (DIPEC : la personne, son représentant, le service).
type Props = { onChange: (pngDataUrl: string | null) => void; label?: string };

export function SignaturePad({ onChange, label = "Signature" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = getComputedStyle(canvas).color;
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const box = event.currentTarget.getBoundingClientRect();
    return [event.clientX - box.left, event.clientY - box.top];
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = event.currentTarget.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const [x, y] = point(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = event.currentTarget.getContext("2d");
    if (!ctx) return;
    const [x, y] = point(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  }

  function end(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasInk) onChange(inkPng(event.currentTarget));
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={cn("relative h-[260px] overflow-hidden rounded-2xl border-[3px] border-dashed bg-card text-ink", hasInk ? "border-ok-text" : "border-muted")}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={hasInk ? `${label} : signature dessinée` : `${label} : zone de signature, vide`}
          className="block h-full w-full cursor-crosshair touch-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[22px] text-ink2">
            Signez ici avec le doigt
          </span>
        )}
        <span aria-hidden="true" className="pointer-events-none absolute bottom-14 left-6 right-6 h-0.5 bg-line" />
      </div>
      <button type="button" onClick={clear} aria-label={`Effacer — ${label}`} className="h-14 w-fit rounded-xl border border-ink bg-card px-5 text-[18px] text-ink hover:bg-soft">
        Effacer
      </button>
    </div>
  );
}
