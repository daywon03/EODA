// Les réglages de docx-preview, UNE fois : l'aperçu d'un Word (DocxPreview) et la
// copie PDF d'un contrat signé sur la tablette (word-pdf-client) doivent dessiner la
// même page — sinon le PDF ne montrerait pas ce que la personne a relu.
// `useBase64URL` : images et polices en `data:`, rien ne part sur le réseau.
export const DOCX_RENDER_OPTIONS = {
  className: "docx",
  inWrapper: true,
  breakPages: true,
  renderHeaders: true,
  renderFooters: true,
  renderFootnotes: true,
  renderEndnotes: true,
  ignoreFonts: false,
  ignoreWidth: false,
  ignoreHeight: false,
  useBase64URL: true,
  renderChanges: false,
  renderComments: false,
  experimental: false,
} as const;
