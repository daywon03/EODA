import type { PracticeQuestionnaire } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONS SUR LES PRATIQUES — une par critère impératif (N7).
//
// ⚠️ PROVISOIRES, À VALIDER PAR SANDRINE — comme l'était la première grille de
// découverte. Rédigées le 12/10/2026 à partir :
//   - des intitulés des 16 impératifs SAD aide + 3.6.2 pour un SAD mixte
//     (context/02-referentiel-has.md §4 — l'intitulé exact reste celui de la base) ;
//   - de ses modes opératoires (context/11 : « un document ne suffit pas », contrôle
//     des affichages, preuves de diffusion) et de ses règles dites en séance
//     (context/10 §3 « le paquet d'un critère », §6 plaintes, maltraitance, PCA).
// Côté client, l'écran dit « provisoires » sans nommer personne (D7).
//
// FALC : une idée par phrase, des mots de tous les jours, le « vous » de la
// structure. Aucune question ne demande un nom : la réponse est libre, et le bandeau
// de l'écran rappelle de ne citer aucune personne accompagnée.
//
// Changer une formulation = augmenter `version` de la question. Aucune migration.
// ─────────────────────────────────────────────────────────────────────────────

export const PRACTICE_QUESTIONNAIRE: PracticeQuestionnaire = {
  version: "v01 — 12/10/2026",
  provisional: true,
  questions: [
    {
      criterionCode: "2.2.2",
      version: 1,
      theme: "Dignité",
      question: "Comment l'équipe respecte-t-elle la dignité de la personne pendant l'aide ? Racontez un exemple.",
      proofHint: "Une trace aide : une procédure, une réunion d'équipe sur ce sujet, une feuille d'émargement.",
    },
    {
      criterionCode: "2.2.3",
      version: 1,
      theme: "Vie privée et intimité",
      question: "Pendant la toilette ou chez la personne, comment l'équipe protège-t-elle son intimité ?",
      proofHint: "Une trace aide : une consigne écrite, une fiche remise à l'équipe.",
    },
    {
      criterionCode: "2.2.4",
      version: 1,
      theme: "Opinions et croyances",
      question: "Comment l'équipe respecte-t-elle les opinions et la religion de la personne ?",
      proofHint: "Le livret d'accueil ou le règlement peut le dire. Une phrase claire suffit.",
    },
    {
      criterionCode: "2.2.5",
      version: 1,
      theme: "Droit à l'image",
      question: "Avant une photo ou une vidéo, comment demandez-vous l'accord de la personne ?",
      proofHint: "Joignez le formulaire de consentement vide. Même si vous ne prenez jamais de photo.",
    },
    {
      criterionCode: "2.2.6",
      version: 1,
      theme: "Droits de la personne",
      question: "Comment la personne connaît-elle ses droits ? Qui les lui explique, et quand ?",
      proofHint: "Le livret d'accueil, la charte des droits et une feuille de remise signée.",
    },
    {
      criterionCode: "2.2.7",
      version: 1,
      theme: "Données personnelles",
      question: "Qui peut lire le dossier d'une personne ? Comment protégez-vous ces informations ?",
      proofHint: "Le nom du délégué à la protection des données et le tableau des droits d'accès.",
    },
    {
      criterionCode: "3.11.1",
      version: 1,
      theme: "Prévenir la maltraitance",
      question: "Que fait la structure pour éviter la maltraitance ? Parlez-en avec l'équipe ?",
      proofHint: "La procédure de prévention et la feuille d'émargement de la dernière réunion sur ce sujet.",
    },
    {
      criterionCode: "3.11.2",
      version: 1,
      theme: "Signaler la maltraitance",
      question: "Une aide à domicile voit un signe de maltraitance. Que fait-elle ? À qui le dit-elle ?",
      proofHint: "Le circuit de signalement écrit et une fiche de signalement vide.",
    },
    {
      criterionCode: "3.12.1",
      version: 1,
      theme: "Plaintes et réclamations",
      question: "Quand une personne ou sa famille se plaint, que se passe-t-il ? Racontez-nous.",
      proofHint: "La procédure de traitement des plaintes et le registre des plaintes de l'année.",
    },
    {
      criterionCode: "3.12.2",
      version: 1,
      theme: "Répondre aux plaintes",
      question: "Comment répondez-vous à la personne qui s'est plainte ? Dans quel délai ?",
      proofHint: "Un modèle de réponse écrite, sans nom.",
    },
    {
      criterionCode: "3.12.3",
      version: 1,
      theme: "Parler des plaintes en équipe",
      question: "Parlez-vous des plaintes en équipe ? Qu'avez-vous changé après une plainte ?",
      proofHint: "Le compte rendu d'une réunion où une plainte a été analysée, sans nom.",
    },
    {
      criterionCode: "3.13.1",
      version: 1,
      theme: "Incidents",
      question: "Quand un incident arrive (une chute, une erreur, un oubli), comment est-il noté ?",
      proofHint: "La fiche de déclaration des événements indésirables, vide.",
    },
    {
      criterionCode: "3.13.2",
      version: 1,
      theme: "Informer après un incident",
      question: "Après un incident, qui prévenez-vous ? La personne, sa famille, les autorités ?",
      proofHint: "La procédure écrite qui dit qui prévenir, et quand.",
    },
    {
      criterionCode: "3.13.3",
      version: 1,
      theme: "Analyser les incidents en équipe",
      question: "Analysez-vous les incidents en équipe pour éviter qu'ils recommencent ? Comment ?",
      proofHint: "Le compte rendu d'une analyse en équipe et le registre des incidents.",
    },
    {
      criterionCode: "3.14.1",
      version: 1,
      theme: "Gestion de crise",
      question: "Pendant une canicule ou une épidémie, comment savez-vous qui aider en premier ?",
      proofHint: "Le plan de continuité d'activité et le modèle vide de la liste des personnes prioritaires.",
    },
    {
      criterionCode: "3.14.2",
      version: 1,
      theme: "Faire connaître le plan de crise",
      question: "L'équipe connaît-elle le plan de crise ? Comment le lui avez-vous présenté ?",
      proofHint: "La feuille d'émargement de la réunion où le plan a été présenté.",
    },
    {
      criterionCode: "3.6.2",
      version: 1,
      theme: "Médicaments",
      question: "Pour les soins, comment l'équipe sécurise-t-elle les médicaments de la personne ?",
      proofHint: "La procédure du circuit du médicament et une fiche de traçabilité vide.",
    },
  ],
};
