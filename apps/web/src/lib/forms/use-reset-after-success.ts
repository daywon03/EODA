import { useEffect, useRef, type RefObject } from "react";

// Pendant de submitWithoutReset : un formulaire qui AJOUTE une ligne (commentaire,
// rendez-vous, dossier, option de catalogue, relance) comptait sur la remise à zéro
// automatique de React après l'envoi. Elle a disparu avec `onSubmit` — sans elle, le
// texte reste au-dessus de la ligne qu'il vient de créer et on l'envoie deux fois.
//
// La remise à zéro redevient donc EXPLICITE, et seulement après un SUCCÈS : un refus
// garde la saisie à l'écran pour être corrigée plutôt que retapée.

// Décision pure : vrai à la fin d'un envoi (en cours → terminé) qui a réussi. Jamais
// au premier rendu, où l'état « pas d'erreur » ne signifie pas « envoyé ».
export function shouldResetAfterSubmit(wasPending: boolean, isPending: boolean, succeeded: boolean): boolean {
  return wasPending && !isPending && succeeded;
}

export function useResetAfterSuccess(isPending: boolean, succeeded: boolean): RefObject<HTMLFormElement | null> {
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (shouldResetAfterSubmit(wasPending.current, isPending, succeeded)) formRef.current?.reset();
    wasPending.current = isPending;
  }, [isPending, succeeded]);

  return formRef;
}
