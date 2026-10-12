import { signOut } from "@/auth";
import { LOGIN_NOTICE_PARAM, loginPathAfterSignOut } from "@/lib/services/login-notice-service";

// Déconnexion par route handler, et non par redirect("/login") depuis une garde.
// Raison : un composant serveur ne peut pas écrire de cookie. Rediriger vers /login
// en laissant le cookie de session posé ferait rebondir le middleware vers le
// tableau de bord, puis la garde vers /login — une boucle infinie. Un route handler,
// lui, peut supprimer le cookie ; c'est le seul endroit correct pour ça.
//
// Utilisé par les gardes quand une session est périmée (mot de passe changé après
// son ouverture), par le bouton de déconnexion, et après un changement de mot de
// passe (`?motif=mot-de-passe-modifie`, pour que la connexion le confirme). Le motif
// est filtré par liste blanche : la destination reste toujours /login.
export async function GET(request: Request): Promise<Response> {
  const target = loginPathAfterSignOut(new URL(request.url).searchParams.get(LOGIN_NOTICE_PARAM));
  await signOut({ redirectTo: target });
  // signOut() lève une redirection Next.js ; ce retour n'est jamais atteint mais
  // satisfait la signature du handler.
  return new Response(null, { status: 302, headers: { Location: target } });
}
