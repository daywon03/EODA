import { startTransition } from "react";

// React 19 RÉINITIALISE un `<form action={fonction}>` après chaque réponse de
// l'action — y compris une erreur de validation : tout ce que la personne a tapé
// disparaît, et un radio contrôlé peut rester coché dans l'état React mais décoché
// dans le DOM (le second envoi part alors sans lui). Défaut trouvé en recette le
// 13/10/2026 sur l'inscription et sur la signature d'un devis.
//
// À brancher en `<form method="post" onSubmit={submitWithoutReset(formAction)}>` :
// l'action reçoit le même FormData, `isPending` de useActionState fonctionne
// toujours, mais rien n'est effacé. `method="post"` évite qu'un envoi avant
// hydratation reparte en GET avec les champs dans l'adresse.
type SubmitEventLike = { preventDefault(): void; currentTarget: HTMLFormElement };

export function submitWithoutReset(
  action: (data: FormData) => void,
  readForm: (form: HTMLFormElement) => FormData = (form) => new FormData(form)
): (event: SubmitEventLike) => void {
  return (event) => {
    event.preventDefault();
    const data = readForm(event.currentTarget);
    startTransition(() => action(data));
  };
}
