"use client";

import { useEffect } from "react";
import { applyTheme, resolveInitialTheme } from "./theme-storage";

// Réapplique le choix stocké (ou, à défaut, la préférence système) à CHAQUE
// chargement complet de page — `data-theme` vit sur <html>, qui est recréé au
// rechargement, contrairement à une navigation côté client. Monté à la racine
// (RootLayout) plutôt que dans AppHeader : certaines pages (login, aide) ne
// rendent pas forcément le même bandeau, et cet effet doit courir partout.
//
// Pas de <script> inline injecté à la main : la CSP de ce projet est à nonce
// strict (cf. content-security-policy.ts, panne du 03/09/2026 sur /login), et un
// script non noncé ne s'exécuterait pas. Ce composant passe par le bundle JS
// habituel de Next, déjà couvert par la politique — au prix d'un très bref flash
// du thème par défaut avant hydratation, préférable à rouvrir ce risque.
export function ThemeInit() {
  useEffect(() => {
    applyTheme(resolveInitialTheme());
  }, []);

  return null;
}
