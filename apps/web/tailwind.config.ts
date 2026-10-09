import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // Charte EODA officielle — context/04-charte-eoda.md
        //
        // `rgb(var(--x) / <alpha-value>)` plutôt qu'un hex figé : c'est ce qui
        // permet à `--brun-ancre` etc. (globals.css) de changer de valeur en mode
        // sombre système, sans toucher un seul composant qui écrit `bg-terre` ou
        // `text-brun-ancre` — et `<alpha-value>` conserve les modificateurs
        // d'opacité déjà utilisés partout (`bg-terre/12`, `border-rouge-imp/50`).
        // La variable CSS doit rester des CANAUX bruts ("62 44 38"), jamais un hex
        // ni un mot-clé : `rgb(#3E2C26 / 0.1)` n'est pas du CSS valide.
        "brun-ancre": "rgb(var(--brun-ancre) / <alpha-value>)",
        "brun-moyen": "rgb(var(--brun-moyen) / <alpha-value>)",
        terre: "rgb(var(--terre) / <alpha-value>)",
        ambre: "rgb(var(--ambre) / <alpha-value>)",
        ivoire: "rgb(var(--ivoire) / <alpha-value>)",
        "ivoire-light": "rgb(var(--ivoire-light) / <alpha-value>)",
        "rouge-imp": "rgb(var(--rouge-imp) / <alpha-value>)",
        "vert-ok": "rgb(var(--vert-ok) / <alpha-value>)",
        "gris-mid": "rgb(var(--gris-mid) / <alpha-value>)",
        "gris-light": "rgb(var(--gris-light) / <alpha-value>)",
        // Fond de carte/panneau — remplace les ~150 usages de `bg-white` (blanc en
        // clair, brun très sombre en sombre) : la SEULE couleur de cette liste qui
        // n'existait pas dans la charte d'origine, ajoutée pour ce motif précis.
        surface: "rgb(var(--surface) / <alpha-value>)",
        // Couleurs de cotation HAS — réservées, ne pas réutiliser ailleurs
        "cot-1": "#C0392B",
        "cot-2": "#E67E22",
        "cot-3": "#27AE60",
        "cot-4": "#1A5276",
        "cot-star": "#D69646",
        "cot-nc": "#8A7B72",
        "cot-ri": "#8E44AD",
        // Tokens de rôle — maquettes v2 (09/10/2026). Alias des variables de
        // charte (globals.css) quand une teinte existe : `bg-paper` et
        // `bg-ivoire-light` désignent la même valeur et ne peuvent pas diverger.
        // Contrastes vérifiés par lib/design/theme-contrast.test.ts.
        paper: "rgb(var(--paper) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        soft: "rgb(var(--soft) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        ink2: "rgb(var(--ink2) / <alpha-value>)",
        // Bordures et décor uniquement : 3.7:1 sur le papier, pas un texte.
        muted: "rgb(var(--muted) / <alpha-value>)",
        "ink-fill": "rgb(var(--ink-fill) / <alpha-value>)",
        "on-ink": "rgb(var(--on-ink) / <alpha-value>)",
        "on-accent": "rgb(var(--on-accent) / <alpha-value>)",
        "accent-text": "rgb(var(--accent-text) / <alpha-value>)",
        "accent-fill": "rgb(var(--accent-fill) / <alpha-value>)",
        "danger-text": "rgb(var(--danger-text) / <alpha-value>)",
        "danger-fill": "rgb(var(--danger-fill) / <alpha-value>)",
        "ok-text": "rgb(var(--ok-text) / <alpha-value>)",
        "ok-soft": "rgb(var(--ok-soft) / <alpha-value>)",
        "amber-fill": "rgb(var(--amber-fill) / <alpha-value>)",
        "green-fill": "rgb(var(--green-fill) / <alpha-value>)",
        highlight: "rgb(var(--highlight) / <alpha-value>)",
        focus: "rgb(var(--focus) / <alpha-value>)",
        // Noms shadcn/ui encore utilisés (`border-border`, `ring-ring`,
        // `ring-offset-background`) : ils pointaient sur des HSL figés en clair,
        // donc une bordure et un anneau clairs en thème sombre. Ils suivent
        // désormais les tokens de rôle. Les autres noms shadcn (primary, card…)
        // n'avaient aucun usage et entraient en collision avec les rôles.
        border: "rgb(var(--line) / <alpha-value>)",
        input: "rgb(var(--line) / <alpha-value>)",
        ring: "rgb(var(--focus) / <alpha-value>)",
        background: "rgb(var(--paper) / <alpha-value>)",
        foreground: "rgb(var(--ink) / <alpha-value>)",
      },
      // Plancher typographique : 14 px (CLAUDE.md §6, « même un enfant de 12 ans »).
      // `text-xs` (12 px par défaut) est écrit plus de 300 fois : plutôt que de le
      // laisser rendre du texte trop petit, l'échelle elle-même commence à 14 px.
      // Vérifié par lib/design/ui-class-guard.test.ts, qui refuse aussi toute
      // taille arbitraire sous 14 px (`text-[11px]`).
      fontSize: {
        xs: ["0.875rem", { lineHeight: "1.25rem" }],
      },
      fontFamily: {
        sans: ["'Trebuchet MS'", "'Segoe UI'", "Arial", "sans-serif"],
      },
      borderRadius: {
        // Rayon de carte : 12 px (maquette v2).
        xl: "0.75rem",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "eoda-sm": "0 1px 2px rgba(62, 44, 38, 0.06), 0 1px 1px rgba(62, 44, 38, 0.04)",
        "eoda-md": "0 4px 10px rgba(62, 44, 38, 0.08), 0 1px 3px rgba(62, 44, 38, 0.06)",
        "eoda-lg": "0 12px 28px rgba(62, 44, 38, 0.14), 0 2px 6px rgba(62, 44, 38, 0.08)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  // Rendu de l'aperçu Markdown d'un document déposé (FilePreviewModal) — un .docx
  // n'est plus affiché en texte brut mais formaté (titres, tableaux, images
  // inline). Pas de contenu utilisateur-libre en dehors de cet aperçu.
  plugins: [typography],
};

export default config;
