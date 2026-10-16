import { describe, expect, it } from "vitest";
import {
  buildPrintableHtml,
  buildTextBodyHtml,
  escapeHtml,
  sanitizeExtractedHtml,
} from "./printable-html-service";

// Le nettoyage est la partie SENSIBLE de ce module : le HTML qu'il filtre vient d'un
// fichier déposé par un tiers, puis est rendu par un navigateur qui, lui, tourne sur
// notre serveur. Ces tests protègent donc deux choses distinctes :
//   - ce qui est retiré (script, gestionnaires d'événement, styles, ressources
//     distantes) — sans quoi un `.docx` piégé fait sortir une requête du réseau de
//     l'hébergeur, là où le service de métadonnées répond ;
//   - ce qui est CONSERVÉ (mise en forme, images embarquées, ancres, tableaux) — un
//     filtre trop large rendrait l'aperçu inutile, et serait retiré à la première
//     plainte, sans que personne ne se souvienne de ce qu'il protégeait.

describe("sanitizeExtractedHtml", () => {
  it("retire un script, avec son contenu", () => {
    const html = sanitizeExtractedHtml('<p>Avant</p><script>fetch("http://ailleurs")</script><p>Après</p>');

    expect(html).toBe("<p>Avant</p><p>Après</p>");
  });

  it("retire les cadres et les objets, quelle que soit leur casse", () => {
    const html = sanitizeExtractedHtml('<IFRAME src="http://x"></IFRAME><object data="y"></object>');

    expect(html).not.toMatch(/iframe|object/i);
  });

  it("retire un attribut de style (qui peut porter une url distante)", () => {
    const html = sanitizeExtractedHtml('<p style="background: url(http://x/pixel)">Texte</p>');

    expect(html).toBe("<p>Texte</p>");
  });

  it("retire un gestionnaire d'événement, même entre guillemets simples", () => {
    const html = sanitizeExtractedHtml("<p onclick='alert(1)'>Texte</p>");

    expect(html).toBe("<p>Texte</p>");
  });

  it("retire les balises de tête qui chargeraient une ressource", () => {
    const html = sanitizeExtractedHtml('<link rel="stylesheet" href="http://x/a.css"><p>Texte</p>');

    expect(html).toBe("<p>Texte</p>");
  });

  it("retire une source distante, garde la donnée embarquée", () => {
    const html = sanitizeExtractedHtml(
      '<img src="http://169.254.169.254/latest/meta-data/" /><img src="data:image/png;base64,AAA" />'
    );

    expect(html).not.toContain("169.254.169.254");
    expect(html).toContain('src="data:image/png;base64,AAA"');
  });

  it("garde une ancre et une adresse de courrier, retire le reste des liens", () => {
    const html = sanitizeExtractedHtml(
      '<a href="http://x">a</a><a href="#note">b</a><a href="mailto:contact@eoda.test">c</a>'
    );

    expect(html).not.toContain('href="http://x"');
    expect(html).toContain('href="#note"');
    expect(html).toContain('href="mailto:contact@eoda.test"');
  });

  it("laisse intacte la mise en forme ordinaire d'un document Word", () => {
    const html = "<h1>Titre</h1><p>Avec du <strong>gras</strong>.</p><table><tr><td>1</td></tr></table>";

    expect(sanitizeExtractedHtml(html)).toBe(html);
  });
});

describe("escapeHtml", () => {
  it("neutralise les cinq caractères qui referment un texte ou un attribut", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});

describe("buildPrintableHtml", () => {
  it("met le titre en page et échappe ce qui vient d'un nom de fichier", () => {
    const html = buildPrintableHtml({
      title: '<script>alert(1)</script>',
      subtitle: null,
      bodyHtml: "<p>Corps</p>",
      notice: null,
    });

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("affiche la mention quand elle est fournie, et l'omet sinon", () => {
    const base = { title: "Document", subtitle: "v1 · fichier.docx", bodyHtml: "<p>x</p>" };

    expect(buildPrintableHtml({ ...base, notice: "Non reproduit." })).toContain("Non reproduit.");
    expect(buildPrintableHtml({ ...base, notice: null })).not.toContain('class="notice"');
  });

  it("fixe un format A4 et des marges d'impression", () => {
    const html = buildPrintableHtml({ title: "Document", subtitle: null, bodyHtml: "", notice: null });

    expect(html).toContain("@page { size: A4;");
  });
});

describe("buildTextBodyHtml", () => {
  it("rend le texte tel quel, jamais comme du balisage", () => {
    expect(buildTextBodyHtml("<b>pas du gras</b>")).toBe('<pre class="plain">&lt;b&gt;pas du gras&lt;/b&gt;</pre>');
  });
});
