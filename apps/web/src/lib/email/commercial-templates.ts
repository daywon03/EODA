import { BRUN_ANCRE, TERRE, escapeHtml, layout, type BrandAssets, type EmailContent } from "./templates";

// ─────────────────────────────────────────────────────────────────────────────
// MODÈLES D'E-MAIL DU PARCOURS COMMERCIAL (maquettes v2, 13/10/2026) — chaînes
// pures, même mise en page que templates.ts (D1). Toute valeur interpolée est
// échappée. Côté structure, on parle d'« EODA », jamais d'une personne (D7).
// Aucun montant : un devis fait foi par son PDF.
// ─────────────────────────────────────────────────────────────────────────────

const P = `color:${BRUN_ANCRE};font-size:15px;line-height:1.6`;

function button(href: string, label: string): string {
  return `<p style="margin:24px 0">
      <a href="${escapeHtml(href)}"
         style="background:${TERRE};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:bold">
        ${escapeHtml(label)}
      </a>
    </p>`;
}

function longDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// Relance manuelle d'un devis envoyé.
export function buildDevisReminderEmail(input: {
  structureName: string;
  devisNumber: string;
  senderName: string;
  validUntil: Date;
  brand?: BrandAssets;
}): EmailContent {
  const body = `
    <p style="${P}">Bonjour,</p>
    <p style="${P}">
      Nous revenons vers vous au sujet de notre proposition ${escapeHtml(input.devisNumber)} pour
      ${escapeHtml(input.structureName)}, valable jusqu'au ${escapeHtml(longDate(input.validUntil))}.
      Vous la trouverez dans notre précédent message.
    </p>
    <p style="${P}">Avez-vous des questions ? Nous pouvons en parler au téléphone, simplement.</p>
    <p style="${P};margin-top:24px">Cordialement,<br>${escapeHtml(input.senderName)}</p>`;
  return {
    subject: `Votre devis ${input.devisNumber} — EODA Conseil`,
    html: layout(`Devis ${input.devisNumber}`, body, input.brand),
  };
}

// Inscription en libre-service (et renvoi du lien) : l'espace existe, il s'ouvre une
// fois l'adresse CONFIRMÉE (tranche 11). Le lien mène à une page qui confirme au
// CLIC — jamais à l'ouverture, qu'un scanner de messagerie déclencherait seul.
export function buildEmailConfirmationEmail(input: {
  firstName: string | null;
  structureName: string | null;
  confirmUrl: string;
  validityHours: number;
  brand?: BrandAssets;
}): EmailContent {
  const hello = input.firstName ? `Bonjour ${escapeHtml(input.firstName)},` : "Bonjour,";
  const space = input.structureName ? `L'espace de ${escapeHtml(input.structureName)}` : "Votre espace";
  const body = `
    <p style="${P}">${hello}</p>
    <p style="${P}">
      ${space} est créé. Pour l'ouvrir, confirmez votre adresse e-mail : cliquez sur le bouton,
      puis sur « Confirmer mon adresse ».
    </p>
    ${button(input.confirmUrl, "Confirmer mon adresse")}
    <p style="${P}">Ce lien sert une seule fois. Il est valable ${input.validityHours} heures.</p>
    <p style="color:#6B5648;font-size:14px;line-height:1.6">
      Auto-évaluation préparatoire. EODA n'est pas un organisme évaluateur : ce n'est pas une
      évaluation officielle de la HAS. Si vous n'êtes pas à l'origine de cette inscription,
      ignorez ce message : sans confirmation, l'espace ne s'ouvre pas.
    </p>`;
  return { subject: "Confirmez votre adresse e-mail — EODA", html: layout("Confirmez votre adresse", body, input.brand) };
}

// Inscription avec une adresse qui a DÉJÀ un compte : on ne crée rien, on prévient
// le titulaire de l'adresse. L'écran, lui, dit la même chose dans les deux cas (pas
// d'énumération des comptes).
export function buildSelfServiceExistingAccountEmail(input: { loginUrl: string; brand?: BrandAssets }): EmailContent {
  const body = `
    <p style="${P}">Bonjour,</p>
    <p style="${P}">
      Quelqu'un a demandé à créer un espace EODA avec votre adresse e-mail. Un compte existe déjà
      avec cette adresse : aucun nouvel espace n'a été créé.
    </p>
    <p style="${P}">Si c'était vous, connectez-vous. Mot de passe oublié ? Écrivez-nous en répondant à ce message.</p>
    ${button(input.loginUrl, "Me connecter")}
    <p style="color:#6B5648;font-size:14px;line-height:1.6">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`;
  return { subject: "Votre compte EODA existe déjà", html: layout("Un compte existe déjà", body, input.brand) };
}

// Alerte au cabinet : une structure inscrite seule demande à être accompagnée. Le
// message de la structure n'est PAS recopié (il peut évoquer une situation) : il se
// lit sur la fiche prospect.
export function buildAccompanimentRequestEmail(input: {
  structureName: string;
  preferredDay: Date;
  momentLabel: string;
  prospectUrl: string;
  brand?: BrandAssets;
}): EmailContent {
  const body = `
    <p style="${P}">
      ${escapeHtml(input.structureName)} demande à être accompagnée. Appel souhaité le
      ${escapeHtml(longDate(input.preferredDay))}, ${escapeHtml(input.momentLabel)}.
    </p>
    <p style="${P}">Le rendez-vous est enregistré « demandé » : confirmez-le depuis la fiche.</p>
    ${button(input.prospectUrl, "Ouvrir la fiche")}`;
  return {
    subject: `Demande d'accompagnement — ${input.structureName}`,
    html: layout("Une structure demande à être accompagnée", body, input.brand),
  };
}

// Relance manuelle d'une structure inscrite qui n'avance plus.
export function buildProspectReminderEmail(input: {
  firstName: string;
  structureName: string;
  loginUrl: string;
  brand?: BrandAssets;
}): EmailContent {
  const body = `
    <p style="${P}">Bonjour ${escapeHtml(input.firstName)},</p>
    <p style="${P}">
      Le diagnostic de ${escapeHtml(input.structureName)} vous attend. Quelques questions suffisent
      pour voir votre liste de travail.
    </p>
    ${button(input.loginUrl, "Reprendre mon diagnostic")}
    <p style="${P}">Besoin d'aide ? Répondez à ce message : EODA vous rappelle.</p>`;
  return { subject: "Votre diagnostic vous attend", html: layout("Votre diagnostic vous attend", body, input.brand) };
}
