"use client";

import dynamic from "next/dynamic";

// Gestes d'administration de la page Critères d'une structure, hors du premier
// chargement (budget de JavaScript, check:bundle) : un `dynamic()` posé dans un
// composant serveur ne découpe rien, il faut une frontière client — ce fichier.
export const AttachExistingDocument = dynamic(() => import("./AttachExistingDocument").then((m) => m.AttachExistingDocument));

export const DetachDocumentFromCriterion = dynamic(() =>
  import("./DetachDocumentFromCriterion").then((m) => m.DetachDocumentFromCriterion)
);
