"use client";

import { useId, useState, useTransition } from "react";
import { respondToMissingDocument, updateMissingJustification } from "@/lib/actions/document";
import { MAX_JUSTIFICATION_LENGTH } from "@/lib/services/document-workflow-service";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Check, CheckCircle2, Loader2, X } from "lucide-react";
import type { DocumentCategory, DocumentStatus } from "@eoda/database";
import { canAnswerNotConcerned, type MissingAnswer } from "@/lib/services/missing-answer-service";

type Props = {
  establishmentId: string;
  documentTypeId: string;
  status: DocumentStatus;
  category: DocumentCategory;
  // « Je ne l'ai pas » déjà répondu (missing-answer-service).
  declaredMissing: boolean;
  missingJustification: string | null;
  // Une version existe déjà : le commentaire reste corrigeable, mais la question
  // « ce document vous concerne-t-il ? » n'a plus de sens et ne doit surtout plus
  // pouvoir rebasculer un document déposé en NOT_APPLICABLE.
  hasVersion?: boolean;
};

// « Ce document vous concerne-t-il ? » — Oui/Non + commentaire libre, utilisable comme
// élément de preuve pour la cotation HAS. Le commentaire reste éditable APRÈS dépôt :
// il devenait définitif au premier fichier, une faute de saisie restait affichée pour
// toujours.
//
// Trois corrections d'usage, toutes constatées à l'écran :
//
//  1. L'enregistrement se faisait à la perte du focus, SANS RIEN DIRE. On tapait, on
//     cliquait ailleurs, et rien ne distinguait « enregistré » de « perdu ». Un
//     accusé explicite apparaît désormais, et disparaît à la modification suivante.
//
//  2. Écrire un commentaire RÉPONDAIT à la question. Le champ appelait l'action qui
//     arbitre MISSING/NOT_APPLICABLE en lui repassant la réponse courante : un effet
//     de bord invisible sur un statut qui compte pour la cotation. Le commentaire
//     passe maintenant par l'action qui ne touche QUE lui, dans tous les cas — c'est
//     exactement la raison pour laquelle les deux actions existent séparément.
//
//  3. Les boutons Oui/Non faisaient 22 pixels de haut et ne se distinguaient que par
//     la couleur. Sandrine travaille sur tablette en visite.
export function MissingDocumentJustification({
  establishmentId,
  documentTypeId,
  status,
  category,
  declaredMissing,
  missingJustification,
  hasVersion = false,
}: Props) {
  const [comment, setComment] = useState(missingJustification ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fieldId = useId();

  function handleAnswer(answer: MissingAnswer) {
    setError(null);
    startTransition(async () => {
      const result = await respondToMissingDocument(establishmentId, documentTypeId, answer, comment);
      if (result && "error" in result) setError(result.error);
      else setSaved(true);
    });
  }

  // Le commentaire, et RIEN d'autre. Voir le point 2 de l'en-tête : cette action ne
  // recalcule aucun statut, ce qui la rend utilisable avant comme après un dépôt.
  function handleCommentBlur() {
    if (comment.trim() === (missingJustification ?? "").trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await updateMissingJustification(establishmentId, documentTypeId, comment);
      if (result && "error" in result) setError(result.error);
      else setSaved(true);
    });
  }

  const willProvide = status === "MISSING" && !declaredMissing;
  const notApplicable = status === "NOT_APPLICABLE";

  return (
    <div className="mt-2 space-y-2 rounded-md bg-ivoire p-3">
      {!hasVersion && (
        // `radiogroup` et non des boutons : c'est un choix exclusif, et c'est ce que
        // les lecteurs d'écran annoncent — « Il arrive, sélectionné, 1 sur 3 ».
        <div role="radiogroup" aria-label="Où en est ce document ?">
          <p className="mb-1.5 text-xs font-medium text-brun-ancre">Où en est ce document ?</p>
          <div className="flex flex-wrap items-center gap-2">
            <ChoiceButton
              selected={willProvide}
              disabled={isPending}
              onClick={() => handleAnswer("WILL_PROVIDE")}
              icon={Check}
              label="Il arrive"
              hint="La structure l'a, il n'est pas encore déposé"
            />
            {/* « Je ne l'ai pas » : il reste visible, À PRODUIRE (N3) — ce n'est
                plus « non concerné ». */}
            <ChoiceButton
              selected={declaredMissing}
              disabled={isPending}
              onClick={() => handleAnswer("DONT_HAVE")}
              icon={Check}
              label="Je ne l'ai pas"
              hint="Il est à produire"
            />
            {/* Jamais proposé sur les sept documents de la loi 2002-2 — le serveur
                le refuse de toute façon (missing-answer-service). */}
            {canAnswerNotConcerned(category) && (
              <ChoiceButton
                selected={notApplicable}
                disabled={isPending}
                onClick={() => handleAnswer("NOT_CONCERNED")}
                icon={X}
                label="Non concerné"
                hint="Il ne s'applique pas à cette structure"
              />
            )}
            {isPending && (
              <Loader2 className="h-4 w-4 animate-spin text-ink2" aria-hidden="true" />
            )}
          </div>
        </div>
      )}

      <div className="space-y-1">
        {/* Un vrai libellé, pas un texte d'aide en filigrane : celui-ci disparaît dès
            qu'on écrit, et on ne sait plus à quoi on répond. */}
        <label htmlFor={fieldId} className="block text-xs font-medium text-brun-ancre">
          {hasVersion ? "Commentaire sur ce document" : "Commentaire (facultatif)"}
        </label>
        <Textarea
          id={fieldId}
          value={comment}
          onChange={(event) => {
            setComment(event.target.value);
            setSaved(false);
          }}
          onBlur={handleCommentBlur}
          disabled={isPending}
          rows={2}
          maxLength={MAX_JUSTIFICATION_LENGTH}
          className="text-xs"
          placeholder={
            hasVersion
              ? "Précision utile pour la relecture : version, périmètre, point de vigilance…"
              : "Pourquoi il ne s'applique pas, ou bien où il en est de son côté…"
          }
        />
        <p className="flex min-h-4 items-center gap-1.5 text-sm text-ink2">
          {isPending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Enregistrement…
            </>
          ) : saved ? (
            // L'accusé qui manquait. `role="status"` : annoncé sans interrompre.
            <span role="status" className="flex items-center gap-1.5 text-vert-ok">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Enregistré.
            </span>
          ) : (
            "Enregistré automatiquement quand vous quittez le champ."
          )}
        </p>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-1 text-xs text-rouge-imp">
          <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

// Bouton de choix exclusif. Trois choses qui manquaient : une cible de 44 px de haut
// (tablette en visite), une COCHE en plus de la couleur — un choix qui ne se lit qu'à
// la teinte ne se lit pas du tout pour 8 % des hommes — et l'état porté par
// `aria-checked`, pas seulement par une classe.
function ChoiceButton({
  selected,
  disabled,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: typeof Check;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-terre bg-terre/10 font-medium text-accent-text"
          : "border-gris-light bg-surface text-ink2 hover:border-terre/40 hover:text-brun-ancre"
      }`}
    >
      <Icon
        className={`h-3.5 w-3.5 flex-shrink-0 ${selected ? "" : "opacity-0"}`}
        aria-hidden="true"
      />
      <span>{label}</span>
      <span className="hidden text-ink2 sm:inline">— {hint}</span>
    </button>
  );
}
