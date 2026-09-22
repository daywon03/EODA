export type Theme = "light" | "dark";

export const STORAGE_KEY = "eoda-theme";

// Un choix explicite l'emporte sur la préférence système ; en son absence, on
// suit le système — c'est le comportement déjà en place avant ce bouton
// (globals.css, @media prefers-color-scheme), qu'on ne veut pas casser pour qui
// n'a jamais touché au bouton.
export function resolveInitialTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// `data-theme` sur <html>, jamais une classe : globals.css cible déjà
// `:root[data-theme]` pour ne pas dupliquer les variables de couleur sous un
// second sélecteur.
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}
