// Tâches prédéfinies de l'assistant du menu (11/11/2026, comme MusicPlanner) — fichier
// PUR, importable par l'écran sans tirer la configuration serveur.
// `hint` : une ligne sous l'intitulé de la carte, sur l'écran d'accueil (maquette du 11/11).
export const PREDEFINED_TASKS: readonly { label: string; hint: string; prompt: string }[] = [
  { label: "Où en sont mes structures ?", hint: "À relire, à faire, ce qui presse.",  prompt: "Fais le point sur les structures que je suis : documents à relire, à faire, et ce qui presse." },
  { label: "Documents à relire en priorité", hint: "Classés, avec la raison.",  prompt: "Quels documents sont à relire en priorité, toutes structures confondues ? Classe-les et dis pourquoi." },
  { label: "Ce qui manque dans un document", hint: "D'après l'analyse, et quoi ajouter.",  prompt: "Pour un document que je vais te nommer, dis-moi ce qui manque d'après l'analyse et ce qu'il faut ajouter." },
  { label: "Préparer les demandes de pièces", hint: "Les informations à réclamer à une structure.",  prompt: "Pour une structure que je vais te nommer, prépare les demandes à lui envoyer pour les informations qui manquent dans ses documents." },
  { label: "Retenir la mise en page d'une structure", hint: "Lire ses Word, proposer des consignes.",  prompt: "Regarde la mise en page des documents Word d'une structure que je vais te nommer et propose des consignes de mise en page à enregistrer." },
  { label: "Chercher dans le référentiel HAS", hint: "Ce qui est attendu pour un critère.",  prompt: "Cherche dans le référentiel HAS ce qui est attendu pour un critère ou un sujet que je vais te donner." },
];
