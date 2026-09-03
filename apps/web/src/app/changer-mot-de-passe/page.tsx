import { requirePasswordRotationSession } from "@/lib/auth/guards";
import { MIN_PASSWORD_LENGTH } from "@/lib/security/password-policy";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { KeyRound, ShieldAlert } from "lucide-react";

export const metadata = { title: "Changer mon mot de passe · EODA Conseil" };

export default async function ChangePasswordPage() {
  // Seule route authentifiée ouverte à un compte dont la rotation est due.
  const { mustChangePassword } = await requirePasswordRotationSession();

  return (
    <div className="min-h-dvh flex items-center justify-center px-6 py-12 bg-ivoire-light">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-eoda-lg p-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-ambre/15 flex-shrink-0">
              <KeyRound className="w-5 h-5 text-ambre" aria-hidden="true" />
            </span>
            <h1 className="text-brun-ancre text-lg font-semibold">Changer mon mot de passe</h1>
          </div>

          {mustChangePassword ? (
            <div
              role="status"
              className="flex items-start gap-2 text-sm text-brun-ancre bg-ambre/10 border border-ambre/30 rounded-md px-3 py-2.5 my-5"
            >
              <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0 text-ambre" aria-hidden="true" />
              <span>
                Votre compte utilise encore le mot de passe temporaire qui vous a été
                communiqué. Choisissez-en un nouveau pour accéder à la plateforme.
              </span>
            </div>
          ) : (
            <p className="text-gris-mid text-sm mt-2 mb-5">
              Vous serez déconnecté après le changement, sur cet appareil comme sur les
              autres.
            </p>
          )}

          <p className="text-gris-mid text-xs mb-5">
            {MIN_PASSWORD_LENGTH} caractères minimum. Une phrase de passe longue protège
            mieux qu&apos;un mot court compliqué.
          </p>

          <ChangePasswordForm />
        </div>

        <p className="text-center text-gris-mid text-xs mt-6">
          © 2026 EODA Conseil · Outil de préparation interne · Non officiel HAS
        </p>
      </div>
    </div>
  );
}
