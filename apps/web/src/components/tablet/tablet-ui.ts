// Gabarits de la tablette (maquette « Tablette terrain ») : FALC, texte ≥ 19 px,
// cibles de 56 à 72 px, un geste par écran. Partagés par la démonstration et la
// connexion — une seule définition des boutons de terrain.
export const TABLET_PRIMARY =
  "inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-accent-fill px-6 text-[21px] font-bold text-on-accent shadow-eoda-sm transition-colors hover:bg-accent-fill/90 disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-ink";
export const TABLET_SECONDARY =
  "inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl border border-ink bg-card px-6 text-[19px] text-ink transition-colors hover:bg-soft";
export const TABLET_CHOICE =
  "flex min-h-[72px] w-full items-center gap-4 rounded-2xl border-2 px-5 text-left text-[21px] font-bold transition-colors";
export const TABLET_CHOICE_ON = "border-ink bg-ink-fill text-on-ink";
export const TABLET_CHOICE_OFF = "border-line bg-card text-ink hover:border-accent-fill";
export const TABLET_INPUT =
  "h-[60px] w-full rounded-xl border-2 border-muted bg-card px-4 text-[20px] text-ink placeholder:text-ink2";
