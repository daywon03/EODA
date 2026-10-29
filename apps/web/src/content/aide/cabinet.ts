import { AUDIENCE_CABINET, AUDIENCE_COMMERCIAL, type HelpArticle } from "./types";
import { CABINET_REVIEW_ARTICLES } from "./cabinet-relecture";

// Articles réservés aux comptes du cabinet. Le pipeline commercial est en outre
// restreint à la capacité COMMERCIAL (admin et commercial, N9) : ni une consultante
// ni a fortiori un CLIENT_USER ne doit lire quoi que ce soit sur les prospects, les devis ou les
// prix (CLAUDE.md §7).
//
// Réécrits le 13/10/2026 sur les écrans v2 : il n'existe plus de création manuelle
// de fiche (une fiche ne naît que de la signature d'un devis), la fiche structure
// est organisée en onglets, et le menu « Commercial » remplace l'ancien onglet.

const ARTICLES: readonly HelpArticle[] = [
  {
    // Slug conservé : il figure dans des liens partagés en formation.
    slug: "creer-un-etablissement-et-inviter-le-client",
    title: "De la signature à la fiche client, puis inviter un interlocuteur",
    summary:
      "La fiche d'une structure naît de la signature de son devis ; on y invite ensuite son interlocuteur.",
    category: "MISSION",
    audiences: AUDIENCE_CABINET,
    where: "Commercial → Devis → un devis → « Enregistrer la signature » · puis fiche structure → onglet « Réglages »",
    keywords: ["établissement", "structure", "fiche", "signature", "FINESS", "SAD", "invitation", "compte client", "interlocuteur"],
    body: [
      {
        kind: "paragraph",
        text:
          "Une fiche client ne se crée qu'à la signature d'un devis : prospect, puis devis, puis signature. C'est ce qui la fait apparaître dans les indicateurs commerciaux, avec son offre et son montant.",
      },
      {
        kind: "steps",
        items: [
          "Sur la fiche du prospect, renseignez dès que possible le FINESS, l'adresse, le type de SAD et l'échéance HAS visée. Ils sont facultatifs à ce stade et seront recopiés à la signature.",
          "Ouvrez le devis signé par la structure, puis « Enregistrer la signature ».",
          "Vérifiez l'identité pré-remplie : FINESS, adresse, échéance HAS et type de SAD sont exigés ici. Le type de SAD (aide ou mixte) est toujours demandé, jamais deviné.",
          "Validez : la fiche structure, sa mission et le périmètre de l'offre sont créés en une seule fois.",
          "Sur la fiche, onglet « Réglages », bloc « Inviter un interlocuteur » : saisissez le nom, l'adresse e-mail et la fonction de la personne.",
          "L'interlocuteur reçoit par e-mail un lien pour choisir lui-même son mot de passe (valable 3 jours, une seule fois). Si l'e-mail n'a pas pu partir, le lien s'affiche une fois à l'écran : transmettez-le à la personne.",
        ],
      },
      {
        kind: "paragraph",
        text:
          "Le type de SAD n'est pas cosmétique : un SAD mixte réalise aide et soins, ce qui ajoute des critères — dont l'impératif du circuit du médicament — par rapport à un SAD aide.",
      },
      {
        kind: "note",
        tone: "warning",
        text:
          "Un compte client ne voit que la structure à laquelle il est rattaché, et rien du cabinet. Ne créez jamais un compte « générique » partagé entre deux structures : le cloisonnement repose sur ce rattachement.",
      },
    ],
  },
  {
    slug: "suivre-une-mission",
    title: "Suivre une mission d'accompagnement",
    summary: "Les quatre étapes de la mission, les items du diagnostic et le périmètre de l'offre.",
    category: "MISSION",
    audiences: AUDIENCE_CABINET,
    where: "Fiche structure → onglet « Mission »",
    keywords: ["mission", "formule", "diagnostic", "étapes", "phases", "offre", "PAC", "PLAC", "clôture"],
    body: [
      {
        kind: "paragraph",
        text:
          "La mission est créée à la signature, avec la formule du devis. L'onglet « Mission » la déroule en quatre étapes : Diagnostic, Mise en conformité, Suivi, Préparation finale.",
      },
      {
        kind: "steps",
        items: [
          "Diagnostic : cochez les 12 items au fur et à mesure (liste ci-dessous).",
          "Mise en conformité, Suivi, Préparation finale : posez les dates de début et de fin de chaque étape, puis cochez ses items.",
          "Le bloc « Périmètre contractuel » rappelle la formule et les options souscrites. C'est la formule de la mission, et elle seule, qui gouverne le périmètre.",
          "En fin d'accompagnement, la clôture fige la mission. Elle ne supprime rien et ne coupe pas l'accès : la structure garde ses documents en lecture.",
        ],
      },
      {
        kind: "list",
        items: [
          "Réunion de cadrage (validation des besoins, planning)",
          "Recueil documentaire",
          "Validation du planning de visite",
          "Réunion d'ouverture (revue du planning)",
          "Visite du site (affichage, organisation)",
          "Entretiens méthode HAS — critères impératifs",
          "Réunion de bilan de visite (axes forts / écarts / axes de progrès)",
          "Cotation des critères",
          "Vérification des documents loi 2002-2",
          "Rédaction du rapport de diagnostic",
          "Co-construction du PLAC (plan d'amélioration continue)",
          "Réunion distancielle — restitution du PLAC",
        ],
      },
      {
        kind: "paragraph",
        text:
          "Un item qui n'entre pas dans l'offre souscrite reste visible, avec un cadenas, et sa case est inactive. Le refus est aussi appliqué côté serveur. En Essentiel, ce sont les trois items du protocole de visite longue (validation du planning, réunion d'ouverture, bilan de visite).",
      },
      {
        kind: "paragraph",
        text:
          "Le bloc « Documents du portail client » affiche des compteurs (déposés, analysés, modifiés, conformes). Il est en lecture seule : le travail sur les documents se fait dans l'onglet « Documents » de la fiche.",
      },
    ],
  },
  {
    slug: "coter-les-elements-d-evaluation",
    title: "Coter les éléments d'évaluation",
    summary: "Démarrer une session par chapitre, coter les E.E., et lire les impératifs à risque.",
    category: "EVALUATION",
    audiences: AUDIENCE_CABINET,
    where: "Fiche structure → onglet « Auto-évaluation » → un chapitre",
    keywords: ["cotation", "E.E.", "critère", "impératif", "chapitre", "session", "NC", "RI", "score"],
    body: [
      {
        kind: "paragraph",
        text:
          "Trois chapitres, trois méthodes : chapitre 1 (la personne accompagnée, accompagné traceur), chapitre 2 (les professionnels, traceur ciblé), chapitre 3 (l'ESSMS, audit système). Le périmètre de critères dépend de la formule de la mission.",
      },
      {
        kind: "steps",
        items: [
          "Ouvrez le chapitre, puis « Démarrer la session de cotation ». Rien ne démarre tout seul à l'ouverture de l'écran.",
          "Cotez chaque élément d'évaluation (E.E.) en choisissant sa cote. L'enregistrement est immédiat.",
          "Notez dans le commentaire la preuve consultée : c'est ce qui rend la cotation défendable trois mois plus tard.",
          "« Terminer la session » la clôture. Une session clôturée est une photo : elle ne se cote plus.",
          "Pour une seconde auto-évaluation, « Ouvrir une nouvelle session » : les deux se comparent critère par critère.",
        ],
      },
      {
        kind: "list",
        items: [
          "1 — pas du tout satisfaisant · 2 — plutôt pas satisfaisant · 3 — plutôt satisfaisant · 4 — tout à fait satisfaisant",
          "★ — optimisé, au-delà des attendus : compte comme un 4 dans le score",
          "NC — non concerné : exclu du calcul du score",
          "RI — réponse inadaptée : exclu du calcul du score",
        ],
      },
      {
        kind: "note",
        tone: "warning",
        text:
          "NC est interdit sur un critère impératif. RI n'existe qu'au chapitre 1, et seulement sur les E.E. qui l'autorisent : ailleurs la cote n'est pas proposée. Une cotation refusée renvoie un message et rien n'est enregistré.",
      },
      {
        kind: "paragraph",
        text:
          "Le score d'un critère est la moyenne de ses E.E. cotés ; ceux de l'objectif, de la thématique puis du chapitre s'en déduisent. Tout critère impératif coté sous 4 remonte dans les « impératifs à risque » en haut du chapitre — et dans l'onglet « Plan d'action », qui propose une action par critère coté sous 4.",
      },
      {
        kind: "note",
        tone: "info",
        text:
          "Quand tous les documents rattachés à un critère sont conformes, la plateforme suggère une cotation. Rien n'est enregistré tant que vous n'avez pas choisi la cote vous-même.",
      },
    ],
  },
  {
    slug: "pipeline-commercial",
    title: "Prospects, devis et catalogue",
    summary: "Le module commercial interne : prospects, grille de découverte, devis, catalogue et indicateurs.",
    category: "COMMERCIAL",
    audiences: AUDIENCE_COMMERCIAL,
    where: "Menu « Commercial » : Vue d'ensemble, Prospects, Devis, Catalogue",
    keywords: ["prospect", "devis", "catalogue", "KPI", "prix", "acompte", "conversion", "découverte"],
    body: [
      {
        kind: "note",
        tone: "warning",
        text:
          "Module strictement interne, réservé au rôle administrateur du cabinet. Ces données ne doivent jamais être montrées à un compte client, ni reprises dans un livrable qui lui est destiné.",
      },
      {
        kind: "list",
        items: [
          "Vue d'ensemble — devis émis, taux de conversion, pipeline pondéré, chiffre d'affaires signé, et l'entonnoir du premier contact à la fin d'accompagnement.",
          "Prospects — un dossier par structure : identité, contact, historique (jamais réécrit), grille de découverte puis évaluation des besoins. Étapes : nouveau contact, rendez-vous découverte, devis envoyé, négociation, signé, perdu.",
          "Devis — créés depuis la fiche d'un prospect (la formule envisagée est présélectionnée), envoyés par e-mail avec le PDF joint, puis signés par « Enregistrer la signature ».",
          "Catalogue — les formules, les prestations à la carte avec leur unité de facturation, et les réglages de facturation dont le taux d'acompte.",
        ],
      },
      {
        kind: "paragraph",
        text:
          "Les prix du catalogue sont présentés « à partir de » : le montant définitif se construit dans le devis, options comprises, pendant la réunion d'évaluation des besoins. Le client ne configure pas son offre lui-même.",
      },
    ],
  },
];

export const CABINET_ARTICLES: readonly HelpArticle[] = [...ARTICLES, ...CABINET_REVIEW_ARTICLES];
