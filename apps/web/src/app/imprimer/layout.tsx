// Layout volontairement nu (pas d'AppHeader/nav) — sert uniquement les pages
// de récapitulatif imprimable, ouvertes dans un onglet isolé depuis le détail
// d'un devis. cf. context/07-outil-pilotage-missions.md §6.4.
export default function ImprimerLayout({ children }: { children: React.ReactNode }) {
  return (
    // `document-print` : autorise l'impression des fonds de la charte (globals.css).
    <div className="document-print max-w-2xl mx-auto px-6 py-10 print:px-0 print:py-0">{children}</div>
  );
}
