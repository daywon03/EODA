// Tâches prédéfinies de l'assistant du menu (11/11/2026, comme MusicPlanner) — fichier
// PUR, importable par l'écran sans tirer la configuration serveur.
export const PREDEFINED_TASKS: readonly { label: string; prompt: string }[] = [
  { label: "Où en sont mes structures ?", prompt: "Fais le point sur les structures que je suis : documents à relire, à faire, et ce qui presse." },
  { label: "Documents à relire en priorité", prompt: "Quels documents sont à relire en priorité, toutes structures confondues ? Classe-les et dis pourquoi." },
  { label: "Ce qui manque dans un document", prompt: "Pour un document que je vais te nommer, dis-moi ce qui manque d'après l'analyse et ce qu'il faut ajouter." },
  { label: "Préparer les demandes de pièces", prompt: "Pour une structure que je vais te nommer, prépare les demandes à lui envoyer pour les informations qui manquent dans ses documents." },
  { label: "Retenir la mise en page d'une structure", prompt: "Regarde la mise en page des documents Word d'une structure que je vais te nommer et propose des consignes de mise en page à enregistrer." },
  { label: "Chercher dans le référentiel HAS", prompt: "Cherche dans le référentiel HAS ce qui est attendu pour un critère ou un sujet que je vais te donner." },
];
