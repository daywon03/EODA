type Props = {
  // Nom de la structure signataire, tel qu'il doit apparaître sur le document.
  counterpartyName: string;
  // Mention manuscrite attendue en face du client. Un devis se retourne « bon pour
  // accord » ; un avenant aussi. La formulation reste paramétrable parce que ce
  // n'est pas au composant de décider ce qu'un document engage.
  counterpartyInstruction?: string;
};

// Emplacements de signature des documents contractuels — devis, avenant, contrat
// d'accompagnement.
//
// Extrait de l'avenant, où ce bloc existait déjà : le devis et le contrat en ont
// besoin à l'identique, et trois grilles de signature écrites séparément, ce sont
// trois mises en page à corriger le jour où Sandrine demande d'ajouter le cachet
// (D1). Sans emplacement de signature, un document contractuel doit être retouché à
// la main avant chaque envoi — c'est ce qui se passait avant.
export function DocumentSignatureBlocks({
  counterpartyName,
  counterpartyInstruction = "Date, signature et cachet, précédées de la mention « bon pour accord »",
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-8 pt-8 text-sm break-inside-avoid">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brun-moyen">
          Pour EODA Conseil
        </p>
        <p className="mt-1 text-xs text-gris-mid">Date et signature</p>
        <div className="h-20 border-b border-gris-light" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brun-moyen">
          Pour {counterpartyName}
        </p>
        <p className="mt-1 text-xs text-gris-mid">{counterpartyInstruction}</p>
        <div className="h-20 border-b border-gris-light" />
      </div>
    </div>
  );
}
