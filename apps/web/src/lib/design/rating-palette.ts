import type { Rating } from "@eoda/database";

// Couleurs de COTATION HAS (`cot-*`) — réservées à la cotation, jamais aux statuts
// de documents, et jamais l'inverse (plan v2 §4). Teintes FIXES (tailwind.config.ts),
// donc identiques en clair et en sombre : le texte posé dessus est choisi une fois
// pour toutes, blanc ou noir, selon le contraste — vérifié ≥ 4.5:1 par
// rating-palette.test.ts, qui relit aussi tailwind.config.ts pour que les deux ne
// divergent pas.
//
// Les classes sont écrites EN ENTIER : Tailwind ne génère que les classes qu'il lit
// littéralement dans le code.
export type RatingSwatch = {
  hex: string;
  textOn: "white" | "black";
  selectedClass: string;
  dotClass: string;
};

export const RATING_PALETTE: Record<Rating, RatingSwatch> = {
  R1: { hex: "#C0392B", textOn: "white", selectedClass: "border-cot-1 bg-cot-1 text-white", dotClass: "bg-cot-1" },
  R2: { hex: "#E67E22", textOn: "black", selectedClass: "border-cot-2 bg-cot-2 text-black", dotClass: "bg-cot-2" },
  R3: { hex: "#27AE60", textOn: "black", selectedClass: "border-cot-3 bg-cot-3 text-black", dotClass: "bg-cot-3" },
  R4: { hex: "#1A5276", textOn: "white", selectedClass: "border-cot-4 bg-cot-4 text-white", dotClass: "bg-cot-4" },
  STAR: { hex: "#D69646", textOn: "black", selectedClass: "border-cot-star bg-cot-star text-black", dotClass: "bg-cot-star" },
  NC: { hex: "#8A7B72", textOn: "black", selectedClass: "border-cot-nc bg-cot-nc text-black", dotClass: "bg-cot-nc" },
  RI: { hex: "#8E44AD", textOn: "white", selectedClass: "border-cot-ri bg-cot-ri text-white", dotClass: "bg-cot-ri" },
};

// Clé de configuration Tailwind de chaque cotation (`cot-1`…), pour le test.
export const RATING_TOKEN: Record<Rating, string> = {
  R1: "cot-1",
  R2: "cot-2",
  R3: "cot-3",
  R4: "cot-4",
  STAR: "cot-star",
  NC: "cot-nc",
  RI: "cot-ri",
};

// Ordre d'affichage de l'échelle : 1, 2, 3, 4, ★, NC, puis RI (chapitre 1 seulement).
export const RATING_SCALE: readonly Rating[] = ["R1", "R2", "R3", "R4", "STAR", "NC", "RI"];
