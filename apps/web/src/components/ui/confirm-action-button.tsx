"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, Loader2, X, type LucideIcon } from "lucide-react";

type ActionResult = { error: string } | null | undefined | void;

type Props = {
  // Libellé au repos. Toujours présent, même en mode compact (il devient alors le
  // nom accessible du bouton) : une icône seule ne se comprend pas.
  label: string;
  // Nom accessible, quand le libellé visible ne suffit pas à désigner la cible —
  // « Supprimer » répété sur dix lignes d'historique ne dit pas laquelle. Vaut
  // `label` par défaut.
  accessibleLabel?: string;
  // La question posée. Elle doit dire ce qui va disparaître ET ce qui est
  // irréversible — « Êtes-vous sûr ? » ne renseigne sur rien.
  question: string;
  confirmLabel?: string;
  icon?: LucideIcon;
  onConfirm: () => Promise<ActionResult>;
  // `destructive` colore en rouge et sépare visuellement l'action. Utilisé pour ce
  // qui supprime ; `neutral` pour ce qui se défait (retirer du catalogue, par ex.).
  tone?: "destructive" | "neutral";
  // Icône seule au repos, pour une ligne de liste dense. Le libellé reste porté par
  // `aria-label` et par une infobulle native.
  compact?: boolean;
  // Habillage du déclencheur au repos. `link` existe parce que certaines lignes
  // denses (l'historique de versions d'un document) alignent des actions en texte :
  // y poser un bouton plein déséquilibre la ligne. La question posée, elle, est
  // identique dans les deux cas — c'est elle qui porte la garantie, pas l'habillage.
  appearance?: "button" | "link";
  // Permet au parent de neutraliser l'action pendant une de ses propres opérations
  // (une ligne d'interlocuteur en cours d'enregistrement, par exemple).
  disabled?: boolean;
};

// Confirmation d'une action, en deux temps : on demande, puis on confirme.
//
// Remplace `window.confirm`, qui pose trois problèmes concrets : le navigateur
// propose de « bloquer les autres dialogues de cette page » (la confirmation suivante
// disparaît alors sans que personne ne le sache), la boîte n'est ni stylée ni
// traduisible, et elle gèle le fil d'exécution.
//
// ⚠️ La question s'affiche en SURCOUCHE ANCRÉE, pas en dépliant le bouton. La
// première version dépliait la question sur place : dans une carte de liste, le
// panneau était plus large que son conteneur, débordait sur la carte voisine et
// faisait grandir toute la ligne de la grille. Une confirmation ne doit jamais
// déplacer ce qu'elle demande de confirmer — on ne relit pas ce qui vient de bouger.
//
// Ancrée sous le déclencheur, elle se ferme avec Échap ou un clic à l'extérieur, le
// focus va sur « Confirmer » et revient au déclencheur à la fermeture.
export function ConfirmActionButton({
  label,
  accessibleLabel,
  question,
  confirmLabel = "Confirmer",
  icon: Icon,
  onConfirm,
  tone = "destructive",
  compact = false,
  appearance = "button",
  disabled = false,
}: Props) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const questionId = useId();

  // En mode compact le libellé n'est pas rendu : le nom accessible est alors la
  // seule chose qui nomme le bouton, il ne peut jamais être omis.
  const triggerName = accessibleLabel ?? (compact ? label : undefined);

  // Le focus va sur « Confirmer » dès que la question s'affiche : sans ça, un
  // utilisateur au clavier doit retrouver le bouton à la tabulation, et un lecteur
  // d'écran n'annonce rien.
  useEffect(() => {
    if (asking) confirmRef.current?.focus();
  }, [asking]);

  // Échap et clic à l'extérieur — les deux sorties qu'on essaie d'instinct sur une
  // surcouche. Sans elles, la seule façon de renoncer est de viser « Annuler ».
  useEffect(() => {
    if (!asking) return;

    function close() {
      setAsking(false);
      triggerRef.current?.focus();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setAsking(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [asking]);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await onConfirm();
      if (result && "error" in result) {
        // L'erreur reste affichée et la question se referme : réessayer à
        // l'identique donnerait le même refus.
        setError(result.error);
      }
      setAsking(false);
    });
  }

  const triggerContent = (
    <>
      {isPending ? (
        <Loader2
          className={`${compact ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} animate-spin`}
          aria-hidden="true"
        />
      ) : (
        Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      )}
      {!compact && label}
    </>
  );

  return (
    // `relative` : c'est l'ancre de la surcouche. `inline-flex` pour que le
    // déclencheur garde exactement la place qu'il occupait.
    <span ref={rootRef} className="relative inline-flex flex-col items-end gap-1">
      {appearance === "link" ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setAsking((open) => !open)}
          disabled={disabled || isPending}
          aria-label={triggerName}
          title={triggerName}
          aria-expanded={asking}
          className={`inline-flex items-center gap-1 rounded text-xs hover:underline disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 ${
            tone === "destructive"
              ? "text-rouge-imp focus-visible:ring-rouge-imp"
              : "text-terre focus-visible:ring-terre"
          }`}
        >
          {triggerContent}
        </button>
      ) : (
        <Button
          ref={triggerRef}
          type="button"
          size={compact ? "icon" : "sm"}
          // Sur une carte de liste, une action destructrice ne doit pas être ce
          // qu'on voit en premier : elle est SUBORDONNÉE (contour discret, teinte
          // rouge au survol) et ne devient pleine que là où elle est l'action
          // principale de l'écran. Un bloc rouge plein sur chaque vignette attire
          // l'œil sur la seule chose qu'on ne veut pas cliquer par erreur.
          variant={compact ? "ghost" : tone === "destructive" ? "destructive" : "outline"}
          onClick={() => setAsking((open) => !open)}
          disabled={disabled || isPending}
          aria-label={triggerName}
          title={triggerName}
          aria-expanded={asking}
          className={
            compact && tone === "destructive"
              ? "text-gris-mid hover:bg-rouge-imp/10 hover:text-rouge-imp"
              : undefined
          }
        >
          {triggerContent}
        </Button>
      )}

      {asking && (
        <span
          role="dialog"
          aria-label="Confirmation"
          aria-describedby={questionId}
          // Ancrée SOUS le déclencheur et alignée à droite : elle reste dans le
          // champ de vision sans jamais élargir son conteneur. `max-w` la garde
          // dans l'écran sur un téléphone.
          className="absolute right-0 top-full z-50 mt-2 flex w-64 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-lg border border-gris-light bg-white p-3 text-left shadow-eoda-md"
        >
          <span id={questionId} className="block text-xs leading-snug text-brun-ancre">
            {question}
          </span>
          <span className="flex flex-wrap gap-2">
            <Button
              ref={confirmRef}
              type="button"
              size="sm"
              variant={tone === "destructive" ? "destructive" : "default"}
              onClick={run}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {confirmLabel}
            </Button>
            {/* Sortie toujours offerte, et au même niveau visuel que la confirmation :
                une confirmation sans échappatoire se clique par réflexe. */}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setAsking(false);
                triggerRef.current?.focus();
              }}
              disabled={isPending}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Annuler
            </Button>
          </span>
        </span>
      )}

      {error && (
        <span role="alert" className="flex items-start gap-1 text-xs text-rouge-imp">
          <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
          {error}
        </span>
      )}
    </span>
  );
}
