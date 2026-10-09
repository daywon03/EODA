"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import type { NavSection } from "@/lib/design/navigation";
import { Sheet } from "@/components/ui/sheet";
import { CabinetNavList } from "./CabinetNavList";

// Navigation du cabinet sur petit écran : la barre latérale devient un tiroir
// (primitive Sheet — piège à focus, Échap, focus restitué au bouton). Il se referme
// dès qu'une entrée est choisie.
export function CabinetMobileNav({ sections, profile }: { sections: readonly NavSection[]; profile: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="inline-flex h-11 flex-shrink-0 items-center gap-2 rounded-lg border border-line bg-card px-3 text-base text-ink lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
        Menu
      </button>
      {isOpen && (
        <Sheet title="Menu" onClose={close}>
          <div className="-mx-5 -my-4 flex min-h-full flex-col bg-soft py-3">
            <nav aria-label="Navigation du cabinet" className="flex flex-1 flex-col">
              <CabinetNavList sections={sections} collapsed={false} onNavigate={close} />
            </nav>
            {profile}
          </div>
        </Sheet>
      )}
    </>
  );
}
