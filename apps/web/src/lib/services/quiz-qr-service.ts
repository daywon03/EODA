import qrcode from "qrcode-generator";

// ─────────────────────────────────────────────────────────────────────────────
// QR CODE D'UNE INVITATION (N10) — rendu SVG côté serveur.
//
// Bibliothèque `qrcode-generator` (MIT, aucune dépendance, épinglée 2.0.4) : rien
// n'est envoyé au navigateur que le SVG lui-même, pas de script (CSP à nonce
// intacte). On ne garde que la MATRICE de la bibliothèque et on dessine le SVG ici :
// un seul chemin, des couleurs explicites (lisible imprimé, quel que soit le thème).
// Correction d'erreur « M » : tolère une impression moyenne ou un écran rayé.
// ─────────────────────────────────────────────────────────────────────────────

export function qrMatrix(text: string): boolean[][] {
  const code = qrcode(0, "M");
  code.addData(text, "Byte");
  code.make();
  const size = code.getModuleCount();
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => code.isDark(row, col)));
}

// Données d'un <svg> rendu en JSX (jamais de HTML injecté) : la taille avec une marge
// de 4 modules (zone de silence exigée par la norme) et un chemin unique.
export function qrPathData(text: string): { size: number; d: string } {
  const matrix = qrMatrix(text);
  const margin = 4;
  let d = "";
  matrix.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) d += `M${x + margin} ${y + margin}h1v1h-1z`;
    })
  );
  return { size: matrix.length + margin * 2, d };
}
