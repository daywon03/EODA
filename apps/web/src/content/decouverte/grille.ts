import type { DiscoveryGrid } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// GRILLE D'ENTRETIEN DÉCOUVERTE — questions de la réunion R1.
//
// ⚠️ PROVENANCE, à lire avant de modifier quoi que ce soit.
//
// Le gabarit de référence de Sandrine — `20260830_GABARIT_VIERGE_Grille-Entretien-
// Decouverte_v03_Interne` — n'est PAS dans le dépôt. Les questions ci-dessous ne le
// reproduisent donc pas : elles couvrent ce que la plateforme a réellement besoin de
// savoir pour proposer une offre et ouvrir un périmètre, et rien d'autre. Chaque
// section est tracée à sa source dans le dépôt (échéance HAS et type de SAD :
// périmètre de critères ; pièces loi 2002-2 : les cinq documents réclamés au client ;
// moyens et attentes : choix de la formule).
//
// Quand le gabarit v03 arrivera, on remplace le tableau et on incrémente `version`.
// Aucune migration : les réponses sont stockées par identifiant de question, et
// celles dont la question a disparu sont simplement ignorées à la lecture
// (discovery-grid-service). C'est exactement pour ça que la grille est un contenu et
// pas un schéma.
//
// Ce qui reste à trancher côté Sandrine, et qui n'est PAS implémenté faute de
// décision : l'ouverture de cette grille au client (« SRE n'est pas sûre de cela »).
// Elle est donc, pour l'instant, réservée au cabinet — comme le reste du pipeline
// commercial.
// ─────────────────────────────────────────────────────────────────────────────

export const DISCOVERY_GRID: DiscoveryGrid = {
  version: "v00 — interne, en attente du gabarit v03",
  sections: [
    {
      id: "contexte",
      title: "Contexte de l'évaluation",
      purpose:
        "Situer l'échéance et le point de départ : c'est ce qui détermine le calendrier et l'urgence.",
      fields: [
        {
          id: "echeance_has",
          label: "Échéance d'évaluation HAS connue ?",
          kind: "SHORT_TEXT",
          hint: "Date ou période annoncée par l'autorité. « Inconnue » est une réponse utile.",
        },
        {
          id: "evaluation_anterieure",
          label: "Évaluation ou audit qualité déjà passé ?",
          kind: "CHOICE",
          options: ["Aucun", "Évaluation externe ancienne", "Audit interne", "Ne sait pas"],
        },
        {
          id: "acces_synae",
          label: "Compte Synaé ouvert et accessible ?",
          kind: "CHOICE",
          options: ["Oui", "Non", "Ne sait pas"],
          hint: "L'évaluation officielle se déroule sur Synaé — sans accès, c'est un point de blocage à traiter tôt.",
        },
        {
          id: "type_activite",
          label: "Activité d'aide seule, ou aide et soins ?",
          kind: "CHOICE",
          options: ["Aide seule (SAD aide)", "Aide et soins (SAD mixte)", "À confirmer"],
          hint: "Détermine le périmètre de critères : un SAD mixte porte un impératif supplémentaire (3.6.2, circuit du médicament).",
        },
      ],
    },
    {
      id: "organisation",
      title: "Organisation qualité",
      purpose: "Savoir sur qui s'appuyer en interne, et ce qui existe déjà.",
      fields: [
        {
          id: "referent_qualite",
          label: "Référent qualité identifié ?",
          kind: "SHORT_TEXT",
          hint: "Nom et fonction. C'est l'interlocuteur de la mission.",
        },
        {
          id: "instances",
          label: "Instances en place (CVS, réunions d'équipe, CREX)",
          kind: "LONG_TEXT",
        },
        {
          id: "demarche_existante",
          label: "Démarche qualité déjà engagée ?",
          kind: "LONG_TEXT",
          hint: "Plan d'action existant, procédures écrites, registre des événements indésirables.",
        },
      ],
    },
    {
      id: "documentation",
      title: "Documentation loi 2002-2",
      purpose:
        "Mesurer l'écart documentaire de départ — les cinq pièces réclamées au client avant la visite.",
      fields: [
        {
          id: "projet_service",
          label: "Projet de service",
          kind: "CHOICE",
          options: ["À jour", "Existe mais ancien", "Inexistant", "Ne sait pas"],
        },
        {
          id: "livret_accueil",
          label: "Livret d'accueil et charte des droits",
          kind: "CHOICE",
          options: ["À jour", "Existe mais ancien", "Inexistant", "Ne sait pas"],
        },
        {
          id: "dipc",
          label: "DIPC et règlement de fonctionnement",
          kind: "CHOICE",
          options: ["À jour", "Existe mais ancien", "Inexistant", "Ne sait pas"],
        },
        {
          id: "documentation_remarques",
          label: "Précisions sur l'état documentaire",
          kind: "LONG_TEXT",
        },
      ],
    },
    {
      id: "moyens",
      title: "Moyens et contraintes",
      purpose: "Calibrer la formule : ce que la structure peut absorber en interne.",
      fields: [
        {
          id: "effectifs",
          label: "Effectifs et personnes accompagnées",
          kind: "SHORT_TEXT",
        },
        {
          id: "disponibilite",
          label: "Disponibilité de l'équipe pour la démarche",
          kind: "LONG_TEXT",
          hint: "Une formule à 3 journées d'atelier suppose des équipes libérées : mieux vaut le savoir avant de la proposer.",
        },
        {
          id: "contraintes",
          label: "Contraintes de calendrier ou de budget annoncées",
          kind: "LONG_TEXT",
        },
      ],
    },
    {
      id: "attentes",
      title: "Attentes et suite",
      purpose: "Fixer ce qui sera repris en évaluation des besoins, et ce qui a été promis.",
      fields: [
        {
          id: "attentes",
          label: "Ce que la structure attend de l'accompagnement",
          kind: "LONG_TEXT",
        },
        {
          id: "decideur",
          label: "Qui décide et signe ?",
          kind: "SHORT_TEXT",
          hint: "Une découverte menée avec quelqu'un qui ne décide pas se rejoue entièrement.",
        },
        {
          id: "prochaine_etape",
          label: "Prochaine étape convenue en séance",
          kind: "LONG_TEXT",
        },
      ],
    },
  ],
};
