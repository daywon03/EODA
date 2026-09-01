"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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

// Confirmation d'une action, EN PAGE — deux temps : on demande, puis on confirme.
//
// Remplace `window.confirm`, qui était utilisé partout et pose trois problèmes
// concrets : le navigateur propose de « bloquer les autres dialogues de cette page »
// (la confirmation suivante disparaît alors sans que personne ne le sache), la boîte
// n'est pas stylée ni traduisible, et elle gèle le fil d'exécution.
//
// Le motif retenu est une confirmation en ligne plutôt qu'une fenêtre modale : dans
// une liste, elle apparaît là où on a cliqué, sans déplacer le regard ni piéger le
// focus. Elle est annoncée aux lecteurs d'écran (`role="alert"`), s'annule avec
// Échap, et le bouton de confirmation reçoit le focus — il n'y a donc pas de « clic
// dans le vide » possible.
//
// Tout est rendu en `span` : ce composant s'insère aussi bien dans un `div` que dans
// une ligne de texte, et un `div` imbriqué dans un `p` ou un `span` produit une
// erreur d'hydratation Next.js.
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
  const confirmRef = useRef<HTMLButtonElement>(null);
  // En mode compact le libellé n'est pas rendu : le nom accessible est alors la
  // seule chose qui nomme le bouton, il ne peut jamais être omis.
  const triggerName = accessibleLabel ?? (compact ? label : undefined);

  // Le focus va sur « Confirmer » dès que la question s'affiche : sans ça, un
  // utilisateur au clavier doit retrouver le bouton à la tabulation, et un lecteur
  // d'écran n'annonce rien.
  useEffect(() => {
    if (asking) confirmRef.current?.focus();
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

  if (!asking) {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        {appearance === "link" ? (
          <button
            type="button"
            onClick={() => setAsking(true)}
            disabled={disabled || isPending}
            aria-label={triggerName}
            title={triggerName}
            className={`inline-flex items-center gap-1 rounded text-xs hover:underline cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 ${
              tone === "destructive"
                ? "text-rouge-imp focus-visible:ring-rouge-imp"
                : "text-terre focus-visible:ring-terre"
            }`}
          >
            <TriggerIcon Icon={Icon} isPending={isPending} className="h-3 w-3" />
            {!compact && label}
          </button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant={tone === "destructive" ? "destructive" : "outline"}
            onClick={() => setAsking(true)}
            disabled={disabled || isPending}
            aria-label={triggerName}
            title={triggerName}
          >
            <TriggerIcon Icon={Icon} isPending={isPending} className="h-3.5 w-3.5" />
            {!compact && label}
          </Button>
        )}
        {error && <ErrorLine message={error} />}
      </span>
    );
  }

  return (
    <span
      className="flex flex-col gap-2 rounded-lg border border-rouge-imp/30 bg-rouge-imp/5 p-3"
      role="alert"
      onKeyDown={(event) => {
        if (event.key === "Escape") setAsking(false);
      }}
    >
      <span className="block text-xs leading-snug text-brun-ancre">{question}</span>
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
        <Button type="button" size="sm" variant="ghost" onClick={() => setAsking(false)} disabled={isPending}>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Annuler
        </Button>
      </span>
    </span>
  );
}

function TriggerIcon({
  Icon,
  isPending,
  className,
}: {
  Icon: LucideIcon | undefined;
  isPending: boolean;
  className: string;
}) {
  if (isPending) return <Loader2 className={`${className} animate-spin`} aria-hidden="true" />;
  if (!Icon) return null;
  return <Icon className={`${className} flex-shrink-0`} aria-hidden="true" />;
}

function ErrorLine({ message }: { message: string }) {
  return (
    <span role="alert" className="flex items-start gap-1 text-xs text-rouge-imp">
      <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
      {message}
    </span>
  );
}
