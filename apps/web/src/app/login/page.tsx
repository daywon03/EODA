import { LoginForm } from "./LoginForm";
import { ShieldCheck, FileCheck2, ClipboardCheck } from "lucide-react";

export const metadata = { title: "Connexion · EODA Conseil" };

function EodaLogo({ className = "w-14 h-14" }: { className?: string }) {
  return (
    <svg viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="21" cy="21" r="19" stroke="#D69646" strokeWidth="2" />
      <circle cx="21" cy="21" r="7" stroke="#D69646" strokeWidth="2" />
      <line x1="21" y1="2" x2="21" y2="10" stroke="#D69646" strokeWidth="2" strokeLinecap="round" />
      <line x1="21" y1="32" x2="21" y2="40" stroke="#D69646" strokeWidth="2" strokeLinecap="round" />
      <line x1="2" y1="21" x2="10" y2="21" stroke="#D69646" strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="21" x2="40" y2="21" stroke="#D69646" strokeWidth="2" strokeLinecap="round" />
      <circle cx="21" cy="21" r="3" fill="#D69646" />
    </svg>
  );
}

const HIGHLIGHTS = [
  { icon: FileCheck2, text: "Checklist documentaire loi 2002-2 et HAS" },
  { icon: ClipboardCheck, text: "Suivi de conformité par établissement" },
  { icon: ShieldCheck, text: "Données hébergées en Europe, accès cloisonné" },
];

export default function LoginPage() {
  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      {/* Panneau de marque — masqué sur mobile pour prioriser le formulaire */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #3E2C26 0%, #5C3D2E 55%, #7A5040 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3">
          <EodaLogo className="w-11 h-11" />
          <div>
            <span className="text-ivoire font-bold text-lg tracking-wide block">EODA conseil</span>
            <span className="text-ambre text-[11px] uppercase tracking-widest block">
              Expliquer · Observer · Démontrer · Accompagner
            </span>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-ivoire text-3xl font-bold leading-snug mb-4">
            Préparez votre évaluation qualité HAS en toute sérénité
          </h2>
          <ul className="space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 flex-shrink-0">
                  <Icon className="w-4 h-4 text-ambre" aria-hidden="true" />
                </span>
                <span className="text-ivoire/90 text-sm leading-snug">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-ivoire/50 text-xs">
          © 2026 EODA Conseil · Outil de préparation interne · Non officiel HAS
        </p>
      </div>

      {/* Panneau formulaire */}
      <div className="flex items-center justify-center px-6 py-12 bg-ivoire-light">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="flex flex-col items-center lg:hidden mb-8 gap-3">
            <EodaLogo />
            <div className="text-center">
              <h1 className="text-brun-ancre font-bold text-2xl tracking-wide">EODA conseil</h1>
              <p className="text-terre text-xs uppercase tracking-widest mt-1">
                Expliquer · Observer · Démontrer · Accompagner
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-eoda-lg p-8">
            <h2 className="text-brun-ancre text-lg font-semibold mb-1">Connexion</h2>
            <p className="text-gris-mid text-sm mb-6">
              Outil de préparation à l&apos;évaluation qualité HAS
            </p>
            <LoginForm />
          </div>

          <p className="text-center text-gris-mid text-xs mt-6 lg:hidden">
            © 2026 EODA Conseil · Outil de préparation interne · Non officiel HAS
          </p>
        </div>
      </div>
    </div>
  );
}
