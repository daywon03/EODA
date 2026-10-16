import type { ReactNode } from "react";
import { EodaMark } from "@/components/layout/EodaLogo";

// Carte centrée des écrans publics courts du libre-service (fin d'inscription,
// confirmation d'adresse, renvoi du lien) : un seul gabarit pour qu'ils se
// ressemblent (D1).
export function PublicCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4 py-10 text-lg text-ink">
      <div className="flex w-full max-w-xl flex-col gap-5 rounded-2xl border border-line bg-card p-6 sm:p-8">
        <EodaMark size={48} />
        <h1 className="text-3xl font-bold">{title}</h1>
        {children}
      </div>
    </main>
  );
}
