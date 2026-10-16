import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { roleHomePath } from "@/lib/auth/capabilities";
import { readPublicMonthlyPrices } from "@/lib/db/read-public-offers";
import { SELF_SERVICE_FORMULES, SELF_SERVICE_OFFERS } from "@/lib/services/self-service-service";
import { EodaLockup } from "@/components/layout/EodaLogo";
import { PublicOfferPrice } from "@/components/public/PublicOfferPrice";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Préparer son évaluation HAS",
  description: "Plateforme de préparation à l'évaluation qualité HAS pour les Services Autonomie à Domicile.",
};

const HOW = [
  { verb: "Expliquer", text: "Chaque critère HAS est dit avec des mots simples." },
  { verb: "Observer", text: "Vous répondez, vous déposez vos documents. La plateforme dit ce qui manque." },
  { verb: "Démontrer", text: "Chaque preuve est rangée. Vous voyez ce qui est prouvé." },
  { verb: "Accompagner", text: "Si besoin, EODA vous aide. Vous ne perdez rien." },
] as const;

const LINK_PRIMARY =
  "inline-flex min-h-12 items-center justify-center rounded-[10px] bg-accent-fill px-6 text-lg font-bold text-on-accent hover:bg-accent-fill/90";
const LINK_SECONDARY =
  "inline-flex min-h-12 items-center justify-center rounded-[10px] border border-ink bg-card px-6 text-lg font-bold text-ink hover:bg-soft";

// Page d'accueil PUBLIQUE (maquette « Portail Client v2 », landing) : promesse,
// « Comment ça marche », trois offres « à partir de », inscription. Un visiteur
// connecté est renvoyé vers son espace (ici ET dans le middleware). Aucune photo
// d'équipe fictive ; rappel « pas une évaluation officielle de la HAS ».
export default async function HomePage() {
  const session = await auth();
  if (session) redirect(roleHomePath(session.user.role));
  const prices = await readPublicMonthlyPrices();

  return (
    <div className="min-h-dvh bg-paper text-lg text-ink">
      <header className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
        <EodaLockup width={170} />
        <nav aria-label="Navigation de la page" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a href="#comment" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            Comment ça marche
          </a>
          <a href="#offres" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            Les offres
          </a>
          <Link href="/login" className="inline-flex min-h-11 items-center rounded-[10px] border border-ink px-4 font-bold hover:bg-soft">
            Se connecter
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-[1180px] items-center gap-10 px-4 pb-16 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-5">
            <h1 className="text-balance text-4xl font-bold leading-tight sm:text-5xl">
              Préparez votre évaluation HAS, une étape à la fois.
            </h1>
            <p className="max-w-[60ch] text-xl text-ink2">
              Pour les Services Autonomie à Domicile. Vous savez ce qui manque. Vous savez qui doit agir. Vous voyez ce qui
              est déjà prouvé.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/inscription" className={LINK_PRIMARY}>
                Commencer mon diagnostic
              </Link>
              <a href="#offres" className={LINK_SECONDARY}>
                Voir les offres
              </a>
            </div>
            <p className="text-base text-ink2">Auto-évaluation préparatoire. EODA n&apos;est pas un organisme évaluateur.</p>
          </div>
          <figure className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 shadow-eoda-md">
            <figcaption className="text-base text-ink2">Exemple d&apos;écran — données fictives</figcaption>
            <div className="flex items-center gap-4">
              <span className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border-[6px] border-accent-fill text-xl font-bold tabular-nums">
                9 / 16
              </span>
              <div>
                <p className="font-bold">Plus de la moitié est faite.</p>
                <p className="text-ink2">Il reste 5 documents à déposer.</p>
              </div>
            </div>
            <div className="rounded-xl bg-soft p-4">
              <p className="text-base text-ink2">La prochaine chose à faire</p>
              <p className="font-bold">Déposez la procédure de traitement des plaintes.</p>
            </div>
          </figure>
        </section>

        <section id="comment" aria-labelledby="comment-titre" className="border-y border-line bg-card">
          <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 py-14 sm:px-8">
            <h2 id="comment-titre" className="text-3xl font-bold">
              Comment ça marche
            </h2>
            <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-5">
              {HOW.map((step, index) => (
                <li key={step.verb} className="flex flex-col gap-2">
                  <span className="flex items-center gap-3">
                    <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-fill font-bold text-on-ink">
                      {index + 1}
                    </span>
                    <span className="text-xl font-bold">{step.verb}</span>
                  </span>
                  <p className="text-ink2">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="offres" aria-labelledby="offres-titre" className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 py-14 sm:px-8">
          <div className="flex flex-col gap-2">
            <h2 id="offres-titre" className="text-3xl font-bold">
              Trois façons d&apos;avancer
            </h2>
            <p className="max-w-[65ch] text-ink2">
              Même espace, mêmes écrans. Vous pouvez passer à l&apos;accompagnement à tout moment, sans rien perdre.
            </p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-5">
            {SELF_SERVICE_FORMULES.map((formule) => {
              const offer = SELF_SERVICE_OFFERS[formule];
              const accompanied = formule === "EXCELLENCE";
              return (
                <article
                  key={formule}
                  aria-labelledby={`offre-${formule}`}
                  className={cn("flex flex-col gap-3 rounded-2xl border bg-card p-6", accompanied ? "border-2 border-ink" : "border-line")}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-md border px-2.5 py-0.5 text-sm font-bold",
                        accompanied ? "border-ink bg-ink-fill text-on-ink" : "border-muted text-ink"
                      )}
                    >
                      {offer.who}
                    </span>
                    {formule === "ESSENTIEL" && <span className="text-base text-ink2">Pour commencer</span>}
                  </div>
                  <h3 id={`offre-${formule}`} className="text-2xl font-bold">
                    {offer.name}
                  </h3>
                  <p className="text-ink2">{offer.what}</p>
                  <ul className="flex flex-col gap-1.5">
                    {offer.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden="true" className="font-bold text-accent-text">
                          ✓
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <PublicOfferPrice monthlyEuros={prices[formule]} className="mt-auto pt-2" />
                  <Link href={`/inscription?offre=${formule}`} className={accompanied ? LINK_PRIMARY : LINK_SECONDARY}>
                    {offer.cta}
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="equipe-titre" className="bg-ink-fill text-on-ink">
          <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-8">
            <div className="flex max-w-[60ch] flex-col gap-2">
              <h2 id="equipe-titre" className="text-2xl font-bold">
                Derrière la plateforme, une équipe qualité.
              </h2>
              <p>
                Les consultantes EODA accompagnent les structures d&apos;aide à domicile. Avec l&apos;offre Excellence, elles
                relisent et valident chaque document avant qu&apos;il vous revienne.
              </p>
            </div>
            <Link
              href="/inscription?offre=EXCELLENCE"
              className="inline-flex min-h-12 items-center rounded-[10px] bg-card px-6 font-bold text-ink hover:bg-soft"
            >
              Parler à EODA
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-[1180px] flex-col gap-2 px-4 py-8 text-base text-ink2 sm:px-8">
        <span>EODA conseil · Expliquer · Observer · Démontrer · Accompagner</span>
        <span>
          Outil de préparation et de conseil. Ce n&apos;est pas une évaluation officielle de la HAS : l&apos;évaluation est
          réalisée par un organisme accrédité.
        </span>
      </footer>
    </div>
  );
}
