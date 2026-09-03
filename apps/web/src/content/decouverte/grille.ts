import type { DiscoveryGrid } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// GRILLE D'ENTRETIEN DÉCOUVERTE — questions de la réunion R1.
//
// PROVENANCE : `20260830_GABARIT_VIERGE_Grille-Entretien-Decouverte_v03_Interne.docx`,
// le gabarit de Sandrine, transmis le 01/09/2026. Les questions ci-dessous en sont la
// transposition fidèle — c'est désormais SA grille, plus un gabarit d'attente.
//
// Deux écarts assumés par rapport au document, et un seul principe derrière les deux :
// **la grille ne stocke que ce qui n'a pas de colonne.**
//
//  1. Statut juridique, type de SAD et échéance HAS sont demandés par le gabarit
//     (§1 et §3) et ne sont PAS des questions ici. Ils ont une colonne sur le
//     prospect, et cette colonne alimente le devis, le périmètre de critères évalués
//     et les indicateurs commerciaux. Les reposer en réponses de grille en ferait une
//     seconde source, qui finirait par contredire la première. Ils se saisissent sur
//     le MÊME écran, dans le bloc « Identité de la structure » placé juste au-dessus.
//
//  2. La synthèse du gabarit (§6 : formule recommandée, montant estimé, échéance HAS
//     estimée) n'est pas non plus ici. Le document le dit lui-même : « les champs de
//     synthèse correspondent directement aux informations à reporter dans la fiche
//     prospect ». Ils se saisissent à l'étape suivante, l'évaluation des besoins, qui
//     construit le devis à partir de ces mêmes valeurs. Ne restent dans la synthèse
//     que les deux champs sans colonne : points de vigilance et prochaine étape.
//
// Le gabarit numérote deux sections « 3 » — coquille du document, corrigée ici sans
// changer l'ordre ni le contenu.
//
// Changer une question ne demande AUCUNE migration : les réponses sont stockées par
// identifiant, et celles dont la question a disparu sont ignorées à la lecture
// (`discovery-grid-service`). Les identifiants de la v00 ne sont pas repris : les
// quelques réponses saisies sous cette version d'attente restent en base, simplement
// invisibles — c'est ce que « lue défensivement » veut dire.
// ─────────────────────────────────────────────────────────────────────────────

// Même échelle pour les sept pièces de la loi 2002-2. Une échelle unique se lit d'un
// coup d'œil en fin de section — et « Ne sait pas » est une réponse utile : elle
// distingue la pièce absente de celle que l'interlocuteur ne connaît pas.
const ETAT_DOCUMENT = ["À jour", "Existe mais ancien", "Inexistant", "Ne sait pas"] as const;

export const DISCOVERY_GRID: DiscoveryGrid = {
  version: "v03 — gabarit EODA du 30/08/2026",
  sections: [
    {
      id: "structure",
      title: "Contexte de la structure",
      purpose:
        "Comprendre à qui on parle : taille, territoire, et qui porte la qualité aujourd'hui.",
      fields: [
        {
          id: "taille",
          label: "Taille de la structure",
          kind: "SHORT_TEXT",
          hint: "Nombre de personnes accompagnées, nombre de salariés.",
        },
        {
          id: "territoire",
          label: "Territoire d'intervention",
          kind: "SHORT_TEXT",
          hint: "Un siège et plusieurs antennes ? Le périmètre change la charge de la visite.",
        },
        {
          id: "pilotage_qualite",
          label: "Qui assure le pilotage de la démarche qualité aujourd'hui ?",
          kind: "CHOICE",
          options: [
            "Référent qualité dédié",
            "Direction",
            "Poste partagé",
            "Personne identifiée",
            "Ne sait pas",
          ],
          hint: "C'est l'interlocuteur de la mission. Une démarche sans porteur interne ne tient pas après notre départ.",
        },
      ],
    },
    {
      id: "besoin",
      title: "Description du besoin",
      purpose: "Laisser dire avant de proposer. Seule section du gabarit sans question fermée.",
      fields: [
        {
          id: "besoin",
          label: "Ce que la structure demande, dans ses mots",
          kind: "LONG_TEXT",
        },
      ],
    },
    {
      id: "echeance",
      title: "Échéance et contexte réglementaire",
      purpose:
        "Situer le point de départ réglementaire. Ce qui a déjà été fait compte autant que la date.",
      fields: [
        {
          id: "fenetre_echeance",
          label: "Si la date d'évaluation n'est pas connue, dans quelle fenêtre ?",
          kind: "SHORT_TEXT",
          hint: "La date elle-même se note plus haut, dans l'identité de la structure.",
        },
        {
          id: "auto_evaluation_synae",
          label: "Auto-évaluation déjà réalisée sur Synaé ?",
          kind: "CHOICE",
          options: ["Non", "Commencée", "Terminée", "Ne sait pas"],
          hint: "L'évaluation officielle se déroule sur Synaé : un compte inaccessible est un blocage à traiter tôt.",
        },
        {
          id: "synae_stade",
          label: "À quel stade en est-elle ?",
          kind: "LONG_TEXT",
        },
        {
          id: "evaluation_anterieure",
          label: "Déjà évalués ?",
          kind: "CHOICE",
          options: [
            "Jamais",
            "Ancien système Qualiscope",
            "Évaluation HAS antérieure",
            "Ne sait pas",
          ],
          hint: "Qualiscope (A/B/C/D) est un référentiel différent et abandonné : une note passée ne se convertit pas en cotation HAS.",
        },
        {
          id: "evaluation_anterieure_enseignements",
          label: "Quels enseignements en tirez-vous ?",
          kind: "LONG_TEXT",
        },
      ],
    },
    {
      id: "maturite",
      title: "Maturité qualité actuelle",
      purpose:
        "Mesurer l'écart de départ, pièce par pièce. C'est cette section qui calibre la formule.",
      fields: [
        {
          id: "projet_service",
          label: "Projet d'établissement / projet de service",
          kind: "CHOICE",
          options: ETAT_DOCUMENT,
          hint: "Art. L.311-8 du CASF.",
        },
        {
          id: "charte_droits",
          label: "Charte des droits et libertés de la personne accueillie",
          kind: "CHOICE",
          options: ETAT_DOCUMENT,
          hint: "Arrêté du 8 septembre 2003.",
        },
        {
          id: "livret_accueil",
          label: "Livret d'accueil",
          kind: "CHOICE",
          options: ETAT_DOCUMENT,
          hint: "Circulaire du 24 mars 2004.",
        },
        {
          id: "cvs",
          label: "CVS ou autre forme de participation des usagers",
          kind: "CHOICE",
          options: ETAT_DOCUMENT,
          hint: "Décret n° 2004-287 du 25 mars 2004.",
        },
        {
          id: "dipc",
          label: "Contrat de séjour ou DIPC",
          kind: "CHOICE",
          options: ETAT_DOCUMENT,
          hint: "Décret du 26 novembre 2004.",
        },
        {
          id: "reglement_fonctionnement",
          label: "Règlement de fonctionnement",
          kind: "CHOICE",
          options: ETAT_DOCUMENT,
          hint: "Décret n° 2003-1095 du 14 novembre 2003.",
        },
        {
          id: "personne_qualifiee",
          label: "Personne qualifiée",
          kind: "CHOICE",
          options: ETAT_DOCUMENT,
          hint: "Liste arrêtée conjointement par le préfet et le président du conseil départemental.",
        },
        {
          id: "procedures_formalisees",
          label:
            "Procédures formalisées : événements indésirables, plaintes et réclamations, prévention de la maltraitance",
          kind: "LONG_TEXT",
        },
        {
          id: "plan_action",
          label: "Un plan d'actions qualité existe-t-il déjà ?",
          kind: "CHOICE",
          options: ["Oui, suivi activement", "Oui, mais non suivi", "Non", "Ne sait pas"],
          hint: "Un plan écrit que personne ne suit ne vaut pas mieux qu'aucun plan devant un évaluateur.",
        },
        {
          id: "criteres_risque",
          label: "Critères impératifs déjà identifiés comme à risque",
          kind: "LONG_TEXT",
          hint: "Un impératif non conforme pèse plus lourd que dix critères standards : le repérer tôt oriente tout le plan d'action.",
        },
      ],
    },
    {
      id: "mobilisation",
      title: "Mobilisation et organisation",
      purpose:
        "Vérifier que quelqu'un sera là. Une formule à ateliers suppose des équipes libérées.",
      fields: [
        {
          id: "mobilises",
          label: "Qui serait mobilisé côté direction et encadrement ?",
          kind: "LONG_TEXT",
        },
        {
          id: "equipes_sensibilisees",
          label: "Vos équipes de terrain ont-elles déjà été sensibilisées à la démarche ?",
          kind: "CHOICE",
          options: ["Oui", "Partiellement", "Non", "Ne sait pas"],
          hint: "L'évaluateur interroge les équipes et les personnes accompagnées : une procédure que personne n'applique ne rapporte rien.",
        },
        {
          id: "disponibilite_visite",
          label: "Disponibilités envisagées pour une visite sur site",
          kind: "LONG_TEXT",
          hint: "Période et durée.",
        },
      ],
    },
    {
      id: "budget",
      title: "Budget et processus de décision",
      purpose:
        "Savoir ce qui peut être signé, et par qui. Une découverte menée avec quelqu'un qui ne décide pas se rejoue entièrement.",
      fields: [
        {
          id: "budget_identifie",
          label: "Un budget est-il déjà identifié pour cet accompagnement ?",
          kind: "CHOICE",
          options: ["Oui", "Non", "Ne sait pas"],
        },
        {
          id: "budget_ordre_grandeur",
          label: "Dans quel ordre de grandeur ?",
          kind: "SHORT_TEXT",
        },
        {
          id: "decideur",
          label: "Qui décide en dernier ressort ?",
          kind: "CHOICE",
          options: [
            "Direction seule",
            "Validation en conseil d'administration",
            "Accord d'un siège fédéral",
            "Autre",
          ],
        },
        {
          id: "delai_decision",
          label: "Quel délai de décision anticiper après réception du devis ?",
          kind: "SHORT_TEXT",
        },
      ],
    },
    {
      id: "synthese",
      title: "Synthèse de l'entretien",
      purpose:
        "Ce qui a été conclu en séance. La formule, le montant et l'échéance se saisissent à l'étape suivante — l'évaluation des besoins, qui construit le devis à partir d'eux.",
      fields: [
        {
          id: "points_vigilance",
          label: "Points de vigilance identifiés",
          kind: "LONG_TEXT",
        },
        {
          id: "prochaine_etape",
          label: "Prochaine étape convenue",
          kind: "LONG_TEXT",
        },
      ],
    },
  ],
};
