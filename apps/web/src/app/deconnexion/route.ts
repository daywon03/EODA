import { signOut } from "@/auth";

// Déconnexion par route handler, et non par redirect("/login") depuis une garde.
// Raison : un composant serveur ne peut pas écrire de cookie. Rediriger vers /login
// en laissant le cookie de session posé ferait rebondir le middleware vers le
// tableau de bord, puis la garde vers /login — une boucle infinie. Un route handler,
// lui, peut supprimer le cookie ; c'est le seul endroit correct pour ça.
//
// Utilisé par les gardes quand une session est périmée (mot de passe changé après
// son ouverture), et par le bouton de déconnexion.
export async function GET(): Promise<Response> {
  await signOut({ redirectTo: "/login" });
  // signOut() lève une redirection Next.js ; ce retour n'est jamais atteint mais
  // satisfait la signature du handler.
  return new Response(null, { status: 302, headers: { Location: "/login" } });
}
