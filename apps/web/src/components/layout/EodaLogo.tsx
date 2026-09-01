import Image from "next/image";

// ─────────────────────────────────────────────────────────────────────────────
// LOGO EODA — asset OFFICIEL, jamais redessiné.
//
// Jusqu'ici, l'en-tête et la page de connexion affichaient un SVG dessiné à la main :
// une approximation du rond, en ambre uni, sans les quartiers brun / terre / ambre du
// vrai logo. Un logo approximé est une marque abîmée — et celui-ci part sur des devis
// et des documents remis à des clients.
//
// Deux déclinaisons, une seule source :
//   `marque`  — le rond seul, sur les fonds SOMBRES (en-tête brun ancre), où le
//               lettrage brun du bloc complet serait illisible ;
//   `bloc`    — le lockup complet (rond + EODA conseil + signature), sur les fonds
//               CLAIRS : page de connexion, documents imprimés, e-mails.
//
// Le fond blanc du fichier d'origine a été détouré ; l'ivoire du rond, lui, est
// conservé — c'est une couleur de la charte, pas un fond.
//
// `width`/`height` sont toujours déclarés : une image sans dimensions décale la mise
// en page au chargement (CLS).
// ─────────────────────────────────────────────────────────────────────────────

const RATIO = 492 / 182;

export function EodaMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/marque-eoda.png"
      alt=""
      // Décoratif : le nom « EODA conseil » est écrit juste à côté, en texte. Un
      // `alt` ici ferait répéter la marque deux fois au lecteur d'écran.
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}

export function EodaLockup({ width = 220, className }: { width?: number; className?: string }) {
  return (
    <Image
      src="/logo-eoda.png"
      alt="EODA conseil — accompagnement qualité des ESSMS"
      width={width}
      height={Math.round(width / RATIO)}
      className={className}
      priority
    />
  );
}
