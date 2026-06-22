import { LoginForm } from "./LoginForm";

export const metadata = { title: "Connexion · EODA Conseil" };

function EodaLogo() {
  return (
    <svg viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-14 h-14">
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

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: "linear-gradient(135deg, #3E2C26 0%, #5C3D2E 60%, #7A5040 100%)",
      }}
    >
      <div className="w-full max-w-sm">
        {/* En-tête marque */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <EodaLogo />
          <div className="text-center">
            <h1 className="text-ivoire font-bold text-2xl tracking-wide">EODA conseil</h1>
            <p className="text-ambre text-xs uppercase tracking-widest mt-1">
              Expliquer · Observer · Démontrer · Accompagner
            </p>
          </div>
        </div>

        {/* Carte login */}
        <div className="bg-white rounded-xl shadow-2xl p-8">
          <h2 className="text-brun-ancre text-lg font-semibold mb-1">Connexion</h2>
          <p className="text-gris-mid text-sm mb-6">
            Outil de préparation à l&apos;évaluation qualité HAS
          </p>
          <LoginForm />
        </div>

        <p className="text-center text-ivoire/50 text-xs mt-6">
          © 2026 EODA Conseil · Outil de préparation interne · Non officiel HAS
        </p>
      </div>
    </div>
  );
}
