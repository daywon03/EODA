type Props = {
  establishmentName: string;
  // Data URI du logo de la structure, ou null si elle n'en a pas déposé.
  establishmentLogo: string | null;
};

// En-tête de marque des documents produits par la plateforme : logo EODA à gauche,
// logo de la structure à droite.
//
// « D'un côté il y a mon logo, pour dire que c'est un document que j'ai créé, et de
// l'autre côté le logo de l'entreprise à qui c'est destiné. » (26/08)
//
// Sans logo côté client — le cas au départ, et celui des structures qui n'en ont pas —
// on écrit son NOM à la place. Un emplacement vide dit « il manque quelque chose » ;
// le nom dit « ce document est pour vous ».
//
// <img> et non next/image : ces composants sont rendus dans la vue imprimable, qui ne
// doit dépendre d'aucune route d'optimisation au moment où quelqu'un lance
// l'impression.
export function DocumentBrandHeader({ establishmentName, establishmentLogo }: Props) {
  return (
    <div className="flex items-start justify-between gap-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-eoda.png"
        alt="EODA conseil — accompagnement qualité des ESSMS"
        width={196}
        height={72}
        className="h-auto max-w-[196px]"
      />

      {establishmentLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={establishmentLogo}
          alt={establishmentName}
          // Hauteur bornée et largeur libre : les logos clients arrivent dans tous les
          // formats, et un logo étiré est pire que pas de logo.
          className="max-h-[64px] w-auto max-w-[180px] object-contain"
        />
      ) : (
        <p className="text-right text-sm font-semibold text-brun-ancre">{establishmentName}</p>
      )}
    </div>
  );
}
