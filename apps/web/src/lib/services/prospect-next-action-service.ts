import type { ProspectStatus } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// L'ACTION SUIVANTE — un bouton par étape, jamais une liste de tout ce qui est
// possible.
//
// Demande de Sandrine (call du 26/08) : « à chaque étape, un bouton qui permet
// d'éditer un document contractuel ». Le parcours réel est linéaire — découverte,
// devis, envoi, négociation, signature — mais l'écran présentait les mêmes actions
// à toutes les étapes, laissant à l'utilisatrice le soin de se rappeler laquelle
// vient ensuite.
//
// Règles PURES : l'étape et quelques faits entrent, un lien sort. Aucune décision
// d'affichage ici (icône, couleur) — c'est le composant qui rend.
// ─────────────────────────────────────────────────────────────────────────────

export type ProspectNextAction = {
  label: string;
  // Pourquoi c'est l'action du moment. Affiché sous le bouton : une action dont on
  // ne comprend pas la raison finit contournée.
  hint: string;
  href: string;
};

export type ProspectActionFacts = {
  prospectId: string;
  status: ProspectStatus;
  // Dernier devis du prospect, s'il existe — on reprend celui-ci plutôt que d'en
  // ouvrir un second, qui ferait deux documents commerciaux pour une seule offre.
  latestDevisId: string | null;
  // Fiche client née de la signature. Sa présence, et non le statut `SIGNE`, dit
  // que la conversion a réellement eu lieu.
  establishmentId: string | null;
};

const PROSPECTS_PATH = "/dashboard/cabinet/commercial/prospects";
const DEVIS_PATH = "/dashboard/cabinet/commercial/devis";

// Ancre de la frise d'historique sur la fiche prospect — l'action « consigner un
// échange » n'ouvre pas une page, elle amène au formulaire déjà présent.
export const TIMELINE_ANCHOR = "historique";

export function deriveProspectNextAction(facts: ProspectActionFacts): ProspectNextAction | null {
  const { prospectId, latestDevisId, establishmentId } = facts;

  switch (facts.status) {
    case "NOUVEAU":
      return {
        label: "Préparer la réunion de découverte",
        hint: "L'évaluation des besoins prépare l'offre et les options à proposer en séance.",
        href: `${PROSPECTS_PATH}/${prospectId}/evaluation-besoins`,
      };

    // Le RDV programmé EST la réunion de découverte : c'est de là qu'on choisit
    // l'offre et les options, et qu'on édite le devis dans la foulée.
    case "RDV":
      return latestDevisId
        ? {
            label: "Reprendre le devis",
            hint: "Un devis existe déjà pour ce prospect — le compléter plutôt qu'en ouvrir un second.",
            href: `${DEVIS_PATH}/${latestDevisId}`,
          }
        : {
            label: "Choisir l'offre et éditer le devis",
            hint: "Offre et options se cochent en séance, le devis s'édite dans la foulée.",
            href: `${DEVIS_PATH}/nouveau?prospectId=${prospectId}`,
          };

    // Devis parti : plus rien à éditer tant qu'ils n'ont pas répondu. Ce qui se perd
    // à cette étape, ce sont les échanges — questions par mail, relances.
    case "DEVIS_ENVOYE":
      return {
        label: "Consigner un échange",
        hint: "Questions reçues, relances, points d'accroche : le dossier se construit ici.",
        href: `${PROSPECTS_PATH}/${prospectId}#${TIMELINE_ANCHOR}`,
      };

    case "NEGOCIATION":
      return {
        label: "Éditer un devis révisé",
        hint: "Une contre-proposition est un nouveau document : le devis envoyé fait foi et ne se réécrit pas.",
        href: `${DEVIS_PATH}/nouveau?prospectId=${prospectId}`,
      };

    case "SIGNE":
      // La signature seule ne suffit pas : tant que la conversion n'a pas eu lieu,
      // il n'y a pas de fiche à ouvrir, et c'est ELLE l'action qui manque.
      return establishmentId
        ? {
            label: "Ouvrir la fiche client",
            hint: "L'accompagnement se pilote désormais depuis la fiche et sa mission.",
            href: `/dashboard/cabinet/etablissements/${establishmentId}`,
          }
        : latestDevisId
          ? {
              label: "Enregistrer la signature",
              hint: "La signature du devis crée la fiche client, la mission et les options souscrites.",
              href: `${DEVIS_PATH}/${latestDevisId}/signature`,
            }
          : null;

    // Perdu : aucune action suivante. En proposer une (« relancer ») rouvrirait un
    // dossier que quelqu'un a délibérément fermé.
    case "PERDU":
      return null;
  }
}

// Un prospect converti n'est plus un prospect. Le mot reste juste sur l'écran de
// prospection, il est faux sur la fiche d'une structure qui a signé — c'est la
// demande « à un moment donné, le titre prospect doit se transformer en client ».
export function describeProspectRelation(facts: {
  status: ProspectStatus;
  establishmentId: string | null;
}): "PROSPECT" | "CLIENT" | "PERDU" {
  if (facts.establishmentId) return "CLIENT";
  if (facts.status === "PERDU") return "PERDU";
  return "PROSPECT";
}
