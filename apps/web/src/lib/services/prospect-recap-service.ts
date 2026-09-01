import type { DevisStatus, ProspectStatus } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// RÉCAPITULATIF D'UN DOSSIER — « où j'en suis », en un coup d'œil.
//
// « Qu'on ait un encart récapitulatif, là où tu en es. Sandrine, quand tu cliques sur
// cette page-là, tu sais que tu as déjà… je vois que j'ai déjà envoyé le devis en un
// seul coup d'œil, sans aller trop chercher, faire monter, faire descendre »
// (call du 01/09).
//
// Ce service ne stocke RIEN et ne décide de rien : il relit les faits déjà en base et
// les remet dans l'ordre du parcours de vente. C'est la même règle que les badges
// d'étape et les KPI de portefeuille — un récapitulatif qui recalculerait l'avancement
// à sa façon finirait par contredire la fiche qu'il résume.
//
// Ce qu'il ne fait PAS : dire quoi faire ensuite. C'est le rôle de
// `prospect-next-action-service`, déjà rendu juste au-dessus à l'écran. Le
// récapitulatif regarde derrière, l'étape suivante regarde devant.
//
// Règles PURES : ni Prisma, ni React, ni horloge.
// ─────────────────────────────────────────────────────────────────────────────

export type RecapStepId =
  | "PREMIER_CONTACT"
  | "DECOUVERTE"
  | "DEVIS_EMIS"
  | "DEVIS_ENVOYE"
  | "SIGNATURE";

export type RecapStep = {
  id: RecapStepId;
  label: string;
  // Date du fait, quand il a une date. `null` avec `done: true` est possible : on sait
  // que le devis existe, on n'affiche pas forcément quand il a été émis.
  at: Date | null;
  done: boolean;
  // Complément court affiché sous le libellé. Jamais une phrase.
  detail: string | null;
};

export type ProspectRecapFacts = {
  firstContactDate: Date;
  // Dernière sauvegarde de la grille d'entretien : c'est la trace que la réunion de
  // découverte a eu lieu. Un rendez-vous programmé ne prouve rien — il peut avoir été
  // annulé, et l'écran de découverte est le seul endroit où la réunion laisse un
  // dépôt.
  discoveryUpdatedAt: Date | null;
  // Devis du dossier, du plus récent au plus ancien.
  devis: readonly { number: string; status: DevisStatus; createdAt: Date }[];
  status: ProspectStatus;
  // Fiche client créée : la signature a produit ses effets.
  establishmentId: string | null;
};

// Un devis « émis » est un devis qui existe, quel que soit son état. « Envoyé » est un
// fait distinct : c'est le moment où la balle passe chez le client, et c'est
// exactement ce que Sandrine veut voir sans chercher.
//
// ⚠️ `ANNULE` ne compte pour aucun des deux, même s'il a été envoyé : un devis annulé
// est sorti du dossier commercial, et le montrer comme une étape franchie ferait
// croire qu'on attend une réponse.
const SENT_STATUSES: readonly DevisStatus[] = ["ENVOYE", "SIGNE", "REFUSE"];

export function buildProspectRecap(facts: ProspectRecapFacts): RecapStep[] {
  const liveDevis = facts.devis.filter((d) => d.status !== "ANNULE");
  const latest = liveDevis[0] ?? null;
  const sent = liveDevis.find((d) => SENT_STATUSES.includes(d.status)) ?? null;
  const signed = liveDevis.find((d) => d.status === "SIGNE") ?? null;

  return [
    {
      id: "PREMIER_CONTACT",
      label: "Premier contact",
      at: facts.firstContactDate,
      done: true,
      detail: null,
    },
    {
      id: "DECOUVERTE",
      label: "Réunion de découverte",
      at: facts.discoveryUpdatedAt,
      done: facts.discoveryUpdatedAt !== null,
      detail: facts.discoveryUpdatedAt === null ? "grille non renseignée" : null,
    },
    {
      id: "DEVIS_EMIS",
      label: "Devis établi",
      at: latest?.createdAt ?? null,
      done: latest !== null,
      detail: latest?.number ?? null,
    },
    {
      id: "DEVIS_ENVOYE",
      label: "Devis envoyé au client",
      // Aucune colonne n'enregistre la date d'envoi : le devis change de statut, sans
      // horodatage propre. On affiche donc le fait sans date plutôt que la date de
      // création, qui laisserait croire qu'il est parti le jour où il a été rédigé.
      at: null,
      done: sent !== null,
      detail: sent?.number ?? null,
    },
    {
      id: "SIGNATURE",
      label: "Devis signé",
      at: null,
      done: signed !== null || facts.establishmentId !== null,
      detail: signed?.number ?? null,
    },
  ];
}

// Un dossier perdu n'a pas d'étape « en cours » : le dire évite de proposer une suite
// à une affaire close. Le récapitulatif reste affiché — savoir jusqu'où on était allé
// est précisément ce qui sert à comprendre pourquoi ça a échoué.
export function isRecapClosed(status: ProspectStatus): boolean {
  return status === "PERDU";
}
