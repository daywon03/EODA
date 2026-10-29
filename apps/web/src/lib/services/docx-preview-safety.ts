// ─────────────────────────────────────────────────────────────────────────────
// LIENS D'UN WORD DESSINÉ DANS LE NAVIGATEUR — entrée hostile (21/10/2026).
//
// Un .docx déposé par un tiers peut porter un lien `javascript:` ou `data:` : dessiné
// sur NOTRE domaine, un clic l'exécuterait avec la session de la personne. Après le
// rendu, chaque lien est relu : seuls http(s) et mailto restent cliquables, ouverts
// dans un nouvel onglet sans référent ni accès à la page d'origine ; tout le reste
// perd son adresse. Les ancres internes (#signet) restent, elles ne quittent pas le
// document.
// ─────────────────────────────────────────────────────────────────────────────

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function isSafeDocxHref(href: string): boolean {
  const value = href.trim();
  if (value.startsWith("#")) return true;
  try {
    return SAFE_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

// IMAGES QU'UN NAVIGATEUR NE SAIT PAS DESSINER (29/10/2026) : EMF et WMF, les formats
// vectoriels de Windows (un schéma ou un SmartArt collé dans Word — l'annexe 6
// « À qui m'adresser ? » du DIPEC du pilote). docx-preview les met en `data:` avec
// leur type ; aucun navigateur ni tablette ne les affiche, la page montrait un trou.
// L'aperçu les remplace par un encadré qui le DIT, au lieu de se taire.
export function isBrowserUnreadableImage(src: string | null): boolean {
  if (!src) return false;
  return /^data:image\/(?:x-)?(?:emf|wmf)\b/i.test(src) || /^data:application\/(?:x-)?msmetafile\b/i.test(src);
}

export function neutralizeDocxLinks(root: ParentNode): number {
  let removed = 0;
  for (const link of Array.from(root.querySelectorAll("a[href]"))) {
    const href = link.getAttribute("href") ?? "";
    if (!isSafeDocxHref(href)) {
      link.removeAttribute("href");
      removed++;
      continue;
    }
    if (!href.trim().startsWith("#")) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    }
  }
  return removed;
}
