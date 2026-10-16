import Link from "next/link";
import { Callout } from "@/components/ui/callout";
import { HDS_LOCKED_MESSAGE } from "@/lib/hds/hds-errors";

// État HONNÊTE d'un écran qui écrirait des données de personnes accompagnées tant que
// le verrou HDS est fermé (ADR 20261014). Il dit ce qui est fermé, pourquoi, et ce
// qu'on peut faire maintenant : voir le parcours en démonstration.
export function HdsLockedNotice({ showDemoLink = true }: { showDemoLink?: boolean }) {
  return (
    <Callout tone="warning" title="Pas encore ouvert : données de santé">
      <p>{HDS_LOCKED_MESSAGE}</p>
      {showDemoLink && (
        <p className="mt-2">
          En attendant, le parcours se montre en démonstration, avec des personnes fictives.{" "}
          <Link href="/tablette/demonstration" className="font-bold text-accent-text underline underline-offset-4">
            Voir la démonstration
          </Link>
        </p>
      )}
    </Callout>
  );
}
