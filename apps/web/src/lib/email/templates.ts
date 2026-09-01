// ─────────────────────────────────────────────────────────────────────────────
// MODÈLES D'E-MAIL — chaînes pures, aucune dépendance à l'envoi.
//
// Ces messages sortent de la plateforme vers des gens : ils sont testés comme du
// code métier, pas rédigés dans un composant. Deux règles tiennent tout le fichier :
//
//   1. TOUTE valeur interpolée est échappée. Un nom de structure, un message client,
//      un libellé de catalogue arrivent d'une saisie ; collés bruts dans du HTML, ils
//      y injectent des balises. Un e-mail n'est pas moins une surface qu'une page.
//   2. Aucun secret dans un message qui n'en a pas besoin. Le mot de passe temporaire
//      n'apparaît QUE dans l'invitation, jamais dans une alerte interne.
// ─────────────────────────────────────────────────────────────────────────────

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailContent = { subject: string; html: string };

// Un client de messagerie ne connaît pas le domaine de l'application : l'URL du logo
// doit être ABSOLUE. Passée en paramètre plutôt que lue ici, pour que ce fichier
// reste pur (et testable sans configuration).
export type BrandAssets = { logoUrl: string };

// Charte EODA (context/04-charte-eoda.md) — en dur ici, et pas via Tailwind : un
// client de messagerie n'exécute aucune feuille de style externe, tout est en ligne.
const BRUN_ANCRE = "#3E2C26";
const TERRE = "#B45A32";
const IVOIRE = "#F0E8DC";

function layout(title: string, body: string, brand?: BrandAssets): string {
  // Le logo n'est affiché que si une URL absolue est fournie. Sans elle, on retombe
  // sur le nom en toutes lettres : une image cassée en tête d'e-mail fait plus de
  // dégâts qu'une ligne de texte.
  const header = brand
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="EODA conseil" width="180" height="67"
           style="display:block;margin:0 0 16px;max-width:100%;height:auto">`
    : `<p style="margin:0 0 4px;color:${TERRE};font-size:13px;letter-spacing:.08em;text-transform:uppercase">EODA Conseil</p>`;

  return `<div style="font-family:'Trebuchet MS',Segoe UI,Arial,sans-serif;background:${IVOIRE};padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
    ${header}
    <h1 style="margin:0 0 16px;color:${BRUN_ANCRE};font-size:20px">${escapeHtml(title)}</h1>
    ${body}
    <p style="margin:24px 0 0;color:#8B7666;font-size:12px;border-top:1px solid ${IVOIRE};padding-top:12px">
      EODA Conseil — Expliquer · Observer · Démontrer · Accompagner<br>
      Accompagnement à la préparation de l'évaluation qualité HAS. Ce message est
      automatique, mais vous pouvez y répondre.
    </p>
  </div>
</div>`;
}

// Invitation d'un interlocuteur client.
//
// ⚠️ Le mot de passe temporaire voyage dans ce message. C'est un compromis assumé,
// demandé en séance le 26/08 : sans lui, Sandrine le recopierait à la main dans un
// e-mail — même canal, même exposition, plus de travail. Ce qui borne le risque :
// le compte est créé avec `mustChangePassword`, la plateforme refuse TOUTE autre
// route tant que le mot de passe n'a pas été changé (guards.ts), et le message le dit.
export function buildClientInvitationEmail(input: {
  recipientName: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
  establishmentName: string;
  brand?: BrandAssets;
}): EmailContent {
  const body = `
    <p style="color:${BRUN_ANCRE};font-size:15px;line-height:1.6">
      Bonjour ${escapeHtml(input.recipientName)},
    </p>
    <p style="color:${BRUN_ANCRE};font-size:15px;line-height:1.6">
      Votre espace en ligne pour l'accompagnement de ${escapeHtml(input.establishmentName)}
      est ouvert. Vous y déposez les documents attendus et suivez leur avancement.
    </p>
    <div style="background:${IVOIRE};border-radius:8px;padding:16px;margin:20px 0">
      <p style="margin:0 0 8px;color:#6B5648;font-size:13px">Identifiant</p>
      <p style="margin:0 0 14px;color:${BRUN_ANCRE};font-size:15px;font-weight:bold">${escapeHtml(input.email)}</p>
      <p style="margin:0 0 8px;color:#6B5648;font-size:13px">Mot de passe temporaire</p>
      <p style="margin:0;color:${BRUN_ANCRE};font-size:16px;font-family:monospace;letter-spacing:.05em">${escapeHtml(input.temporaryPassword)}</p>
    </div>
    <p style="color:${BRUN_ANCRE};font-size:15px;line-height:1.6">
      <strong>Ce mot de passe est temporaire.</strong> La plateforme vous demandera d'en
      choisir un nouveau dès votre première connexion, avant tout autre accès.
    </p>
    <p style="margin:24px 0">
      <a href="${escapeHtml(input.loginUrl)}"
         style="background:${TERRE};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:bold">
        Ouvrir mon espace
      </a>
    </p>`;

  return {
    subject: `Votre accès à l'espace EODA — ${input.establishmentName}`,
    html: layout("Votre espace client est ouvert", body, input.brand),
  };
}

// Alerte interne : un client demande un devis pour une prestation complémentaire.
//
// « Il faudrait qu'il y ait un mail et un pop-up pour qu'on ne rate pas les demandes.
// Surtout les demandes où ils veulent payer plus. » Message court : il sert à faire
// revenir quelqu'un dans l'outil, pas à traiter la demande depuis la boîte mail.
export function buildOptionRequestEmail(input: {
  establishmentName: string;
  optionLabel: string;
  message: string | null;
  requestedByName: string;
  requestUrl: string;
  brand?: BrandAssets;
}): EmailContent {
  const message = input.message?.trim();

  const body = `
    <p style="color:${BRUN_ANCRE};font-size:15px;line-height:1.6">
      <strong>${escapeHtml(input.establishmentName)}</strong> demande un devis pour la
      prestation « ${escapeHtml(input.optionLabel)} ».
    </p>
    <p style="color:#6B5648;font-size:14px">Demande émise par ${escapeHtml(input.requestedByName)}.</p>
    ${
      message
        ? `<blockquote style="margin:16px 0;padding:12px 16px;background:${IVOIRE};border-left:3px solid ${TERRE};border-radius:0 8px 8px 0;color:${BRUN_ANCRE};font-size:14px;line-height:1.6">${escapeHtml(message)}</blockquote>`
        : ""
    }
    <p style="margin:24px 0">
      <a href="${escapeHtml(input.requestUrl)}"
         style="background:${TERRE};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:bold">
        Traiter la demande
      </a>
    </p>`;

  return {
    subject: `Demande de devis — ${input.establishmentName} · ${input.optionLabel}`,
    html: layout("Une structure demande une prestation complémentaire", body, input.brand),
  };
}

// Relance des pièces manquantes.
//
// « Relances automatiques des clients qui ne fournissent pas » (§12.5). Les DÉLAIS,
// la CADENCE et la condition d'arrêt n'ont jamais été spécifiés (§12.7) : rien
// n'envoie ce message tout seul, c'est Sandrine qui déclenche. Un envoi automatique
// dont personne n'a fixé le rythme finit soit inutile, soit harcelant.
//
// La liste des pièces est DANS le message : renvoyer « connectez-vous pour voir ce
// qui manque » ajoute une étape à quelqu'un qui n'a déjà pas trouvé le temps de
// déposer. Aucun contenu de document, aucune analyse, aucun nom de personne
// accompagnée n'y figure — seulement des intitulés de documents attendus.
export function buildDocumentReminderEmail(input: {
  recipientName: string;
  establishmentName: string;
  missingLabels: readonly string[];
  // Mot ajouté par Sandrine avant l'envoi. Facultatif : une relance sans contexte
  // reste utile, une relance qu'on ne peut pas nuancer ne sera pas envoyée.
  message: string | null;
  portalUrl: string;
  brand?: BrandAssets;
}): EmailContent {
  const message = input.message?.trim();
  const items = input.missingLabels
    .map(
      (label) =>
        `<li style="margin:0 0 6px;color:${BRUN_ANCRE};font-size:15px;line-height:1.5">${escapeHtml(label)}</li>`
    )
    .join("");

  const body = `
    <p style="color:${BRUN_ANCRE};font-size:15px;line-height:1.6">
      Bonjour ${escapeHtml(input.recipientName)},
    </p>
    <p style="color:${BRUN_ANCRE};font-size:15px;line-height:1.6">
      Dans le cadre de la préparation de l'évaluation qualité HAS de
      ${escapeHtml(input.establishmentName)}, les pièces suivantes restent attendues :
    </p>
    <ul style="margin:16px 0;padding-left:20px">${items}</ul>
    ${
      message
        ? `<blockquote style="margin:16px 0;padding:12px 16px;background:${IVOIRE};border-left:3px solid ${TERRE};border-radius:0 8px 8px 0;color:${BRUN_ANCRE};font-size:14px;line-height:1.6">${escapeHtml(message)}</blockquote>`
        : ""
    }
    <p style="color:${BRUN_ANCRE};font-size:15px;line-height:1.6">
      Si un document n'existe pas ou ne concerne pas votre structure, indiquez-le
      directement depuis votre espace : c'est une réponse, pas un manque.
    </p>
    <p style="margin:24px 0">
      <a href="${escapeHtml(input.portalUrl)}"
         style="background:${TERRE};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:bold">
        Déposer mes documents
      </a>
    </p>`;

  const count = input.missingLabels.length;
  return {
    subject: `Documents attendus — ${input.establishmentName} (${count} pièce${count > 1 ? "s" : ""})`,
    html: layout("Il reste des pièces à déposer", body, input.brand),
  };
}
