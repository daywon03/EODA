"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { signUpSelfService, type SignupState } from "@/lib/actions/self-service";
import {
  SELF_SERVICE_FORMULES,
  SELF_SERVICE_OFFERS,
  type SelfServiceFormule,
} from "@/lib/services/self-service-service";
import { EodaMark } from "@/components/layout/EodaLogo";
import { PasswordInput } from "@/components/ui/password-input";
import { PublicOfferPrice } from "./PublicOfferPrice";
import { PublicCard } from "./PublicCard";
import { LinkDisclosureNotice } from "./LinkDisclosureNotice";
import { ResendVerificationForm } from "./ResendVerificationForm";
import { cn } from "@/lib/utils";

const STEPS = ["Votre structure", "Votre offre", "Votre compte"] as const;
const SERVICE_TYPES = [
  { value: "SAD_AIDE", label: "SAD Aide", hint: "Aide et accompagnement à domicile" },
  { value: "SAD_MIXTE", label: "SAD Mixte", hint: "Aide et soins" },
] as const;
const STATUSES = [
  { value: "ASSOCIATION", label: "Association" },
  { value: "PRIVE", label: "Privé" },
  { value: "PUBLIC", label: "Public (CCAS, CIAS…)" },
] as const;

const FIELD = "h-14 w-full rounded-[10px] border-2 border-line bg-card px-4 text-lg text-ink";
const CHOICE =
  "flex min-h-14 cursor-pointer flex-col justify-center gap-0.5 rounded-xl border-2 border-line bg-card px-4 py-3 text-left text-ink has-[:checked]:border-accent-fill has-[:checked]:bg-paper has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ambre";

// Inscription en trois étapes (maquette « Portail Client v2 », écran 02). Les trois
// étapes sont dans UN formulaire : on peut revenir en arrière sans rien perdre, et le
// serveur revérifie tout à l'envoi (signUpSelfService) — une étape sautée côté
// navigateur n'est jamais sautée côté serveur.
export function SignupForm({
  prices,
  initialOffer,
}: {
  prices: Record<SelfServiceFormule, number | null>;
  initialOffer: SelfServiceFormule;
}) {
  const [state, formAction, isPending] = useActionState<SignupState, FormData>(signUpSelfService, { status: "IDLE" });
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [status, setStatus] = useState("");
  const [offer, setOffer] = useState<SelfServiceFormule>(initialOffer);
  const ids = { name: useId(), finess: useId(), first: useId(), email: useId(), password: useId() };
  const canContinue = step !== 1 || (name.trim().length >= 2 && serviceType !== "" && status !== "");

  // Fin d'inscription (tranche 11) : l'espace s'ouvre une fois l'adresse confirmée.
  // Même écran que l'adresse ait déjà un compte ou non ; « renvoyer le lien » aussi.
  if (state.status === "DONE") {
    return (
      <PublicCard title="Confirmez votre adresse e-mail">
        <p role="status">{state.message}</p>
        <LinkDisclosureNotice disclosure={state.disclosure} />
        <div className="flex flex-col gap-3 border-t border-line pt-5">
          <h2 className="text-xl font-bold">Rien reçu ?</h2>
          <p className="text-ink2">Regardez dans les courriers indésirables, ou demandez un nouveau lien.</p>
          <ResendVerificationForm knownEmail={state.email} />
        </div>
        <Link href="/login" className="inline-flex min-h-12 w-fit items-center rounded-[10px] bg-accent-fill px-6 font-bold text-on-accent">
          Se connecter
        </Link>
      </PublicCard>
    );
  }

  return (
    <div className="grid min-h-dvh bg-paper text-lg text-ink lg:grid-cols-[minmax(320px,2fr)_3fr]">
      <aside className="flex flex-col gap-6 bg-ink-fill px-6 py-8 text-on-ink sm:px-10 lg:py-14">
        <EodaMark size={52} />
        <p className="text-3xl font-bold">Créons votre espace.</p>
        <ol className="flex flex-col gap-3">
          {STEPS.map((label, index) => {
            const n = index + 1;
            return (
              <li key={label} aria-current={step === n ? "step" : undefined} className={cn("flex items-center gap-3", step === n && "font-bold")}>
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 border-ambre font-bold",
                    step >= n ? "bg-amber-fill text-ink" : "text-on-ink"
                  )}
                >
                  {step > n ? "✓" : n}
                </span>
                <span>
                  {label}
                  {step > n && <span className="sr-only"> (fait)</span>}
                </span>
              </li>
            );
          })}
        </ol>
        <p>Vous pouvez revenir en arrière à chaque étape. Rien n&apos;est payé à l&apos;inscription.</p>
      </aside>

      <main className="flex flex-col gap-6 px-4 py-8 sm:px-10 lg:py-14">
        <p className="text-ink2">Étape {step} sur 3</p>
        <form action={formAction} className="flex max-w-[640px] flex-col gap-6">
          <div className={cn("flex-col gap-5", step === 1 ? "flex" : "hidden")}>
            <h1 className="text-3xl font-bold">Votre structure</h1>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.name} className="font-bold">
                Nom de la structure
              </label>
              <input id={ids.name} name="structureName" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoComplete="organization" className={FIELD} />
              <span className="text-base text-ink2">Le nom apparaîtra sur vos documents.</span>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-bold">Type de service</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {SERVICE_TYPES.map((t) => (
                  <label key={t.value} className={CHOICE}>
                    <input type="radio" name="establishmentType" value={t.value} checked={serviceType === t.value} onChange={() => setServiceType(t.value)} className="sr-only" />
                    <span className="font-bold">
                      <span aria-hidden="true">{serviceType === t.value ? "● " : "○ "}</span>
                      {t.label}
                    </span>
                    <span className="text-base text-ink2">{t.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-bold">Statut</legend>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <label key={s.value} className={cn(CHOICE, "min-h-12 flex-row items-center")}>
                    <input type="radio" name="structureType" value={s.value} checked={status === s.value} onChange={() => setStatus(s.value)} className="sr-only" />
                    <span aria-hidden="true">{status === s.value ? "● " : "○ "}</span>
                    {s.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.finess} className="font-bold">
                Numéro FINESS <span className="font-normal text-ink2">(facultatif)</span>
              </label>
              <input id={ids.finess} name="finessNumber" inputMode="numeric" placeholder="9 chiffres" maxLength={20} className={FIELD} />
              <span className="text-base text-ink2">Le numéro qui identifie votre service. Vous pourrez l&apos;ajouter plus tard.</span>
            </div>
          </div>

          <div className={cn("flex-col gap-5", step === 2 ? "flex" : "hidden")}>
            <h1 className="text-3xl font-bold">Votre offre</h1>
            <fieldset className="flex flex-col gap-3">
              <legend className="sr-only">Offre</legend>
              {SELF_SERVICE_FORMULES.map((f) => (
                <label key={f} className={cn(CHOICE, "flex-row items-center gap-4")}>
                  <input type="radio" name="formule" value={f} checked={offer === f} onChange={() => setOffer(f)} className="sr-only" />
                  <span aria-hidden="true" className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-ink">
                    {offer === f && <span className="h-3 w-3 rounded-full bg-accent-fill" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-bold">
                      {SELF_SERVICE_OFFERS[f].name} · {SELF_SERVICE_OFFERS[f].who.toLowerCase()}
                    </span>
                    <span className="text-base text-ink2">{SELF_SERVICE_OFFERS[f].short}</span>
                  </span>
                  <PublicOfferPrice monthlyEuros={prices[f]} className="hidden whitespace-nowrap text-base sm:inline" />
                </label>
              ))}
            </fieldset>
            <p className="text-ink2">Vous pouvez changer d&apos;offre plus tard. Rien n&apos;est signé à l&apos;inscription.</p>
          </div>

          <div className={cn("flex-col gap-5", step === 3 ? "flex" : "hidden")}>
            <h1 className="text-3xl font-bold">Votre compte</h1>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.first} className="font-bold">
                Votre prénom
              </label>
              <input id={ids.first} name="firstName" maxLength={100} autoComplete="given-name" className={FIELD} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.email} className="font-bold">
                Votre adresse e-mail
              </label>
              <input id={ids.email} name="email" type="email" maxLength={254} autoComplete="email" className={FIELD} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.password} className="font-bold">
                Mot de passe <span className="font-normal text-ink2">(12 caractères au moins)</span>
              </label>
              <PasswordInput id={ids.password} name="password" minLength={12} autoComplete="new-password" />
              <span className="text-base text-ink2">Vous pouvez coller un mot de passe ou utiliser celui de votre navigateur.</span>
            </div>
            <p className="rounded-xl bg-soft p-4">
              Récapitulatif : <strong>{name || "votre structure"}</strong> · {SERVICE_TYPES.find((t) => t.value === serviceType)?.label ?? "type à choisir"} ·
              offre <strong>{SELF_SERVICE_OFFERS[offer].name}</strong>
            </p>
            <p className="text-base text-ink2">
              Auto-évaluation préparatoire : ce n&apos;est pas une évaluation officielle de la HAS. Vous déposerez vos documents une
              fois l&apos;abonnement signé.
            </p>
          </div>

          {state.status === "ERROR" && (
            <p role="alert" className="flex items-start gap-2 font-bold text-danger-text">
              <AlertCircle className="mt-1 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              {state.error}
            </p>
          )}

          <div className="flex flex-wrap justify-between gap-3">
            {step > 1 ? (
              <button type="button" onClick={() => setStep(step - 1)} className="inline-flex min-h-14 items-center rounded-[10px] border border-ink bg-card px-5 font-bold hover:bg-soft">
                ← Retour
              </button>
            ) : (
              <Link href="/" className="inline-flex min-h-14 items-center rounded-[10px] border border-ink bg-card px-5 font-bold hover:bg-soft">
                ← Accueil
              </Link>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canContinue}
                className="inline-flex min-h-14 items-center rounded-[10px] bg-accent-fill px-6 text-lg font-bold text-on-accent disabled:opacity-60"
              >
                Continuer
              </button>
            ) : (
              <button type="submit" disabled={isPending} className="inline-flex min-h-14 items-center gap-2 rounded-[10px] bg-accent-fill px-6 text-lg font-bold text-on-accent disabled:opacity-60">
                {isPending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                Créer mon espace
              </button>
            )}
          </div>
          <p className="text-base text-ink2">
            Déjà un compte ?{" "}
            <Link href="/login" className="font-bold text-accent-text underline underline-offset-4">
              Se connecter
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
