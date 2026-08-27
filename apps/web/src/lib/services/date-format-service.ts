// ─────────────────────────────────────────────────────────────────────────────
// FORMATAGE DES DATES — point unique de rendu d'une date dans l'application.
//
// Demande de Sandrine (26/08) : « tu mets ce format-là partout, partout où il y a une
// date » — jour sur deux chiffres, mois sur deux chiffres, année sur quatre. Neuf
// endroits du code formataient une date, et pas deux de la même façon : « 3 sept.
// 2026 », « 03/09/26 », « 3 septembre 2026 ».
//
// Le format long (« jeudi 3 septembre 2026 ») reste disponible pour les EN-TÊTES de
// journée d'un agenda, où il se lit mieux qu'une suite de chiffres. Ce n'est pas une
// exception au format : c'est un autre usage, et il est nommé comme tel.
//
// `Intl` plutôt qu'un formatage à la main ici : contrairement aux montants (cf.
// price-format-service), un runtime small-icu rend correctement les chiffres d'une
// date — c'est le nom des MOIS qui manquerait, et il n'apparaît que dans les libellés
// longs, jamais dans un document contractuel.
// ─────────────────────────────────────────────────────────────────────────────

const NUMERIC = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DAY_HEADING = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const TIME = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

// JJ/MM/AAAA — le format par défaut, celui de tous les écrans.
export function formatDate(date: Date): string {
  return NUMERIC.format(date);
}

// JJ/MM/AAAA à HH:MM. Le « à » est écrit ici plutôt que dans les composants : c'est
// la même phrase à chaque fois.
export function formatDateTime(date: Date): string {
  return `${NUMERIC.format(date)} à ${TIME.format(date)}`;
}

export function formatTime(date: Date): string {
  return TIME.format(date);
}

// « 09:00 – 12:30 ». Tiret demi-cadratin entouré d'espaces insécables fines : c'est
// une plage, pas une soustraction.
export function formatTimeRange(startsAt: Date, endsAt: Date): string {
  return `${TIME.format(startsAt)} – ${TIME.format(endsAt)}`;
}

// « jeudi 3 septembre 2026 » — en-tête de journée dans une liste de rendez-vous.
export function formatDayHeading(date: Date): string {
  return DAY_HEADING.format(date);
}

// Valeur d'un champ <input type="date">, qui n'accepte que `AAAA-MM-JJ`. Construite
// à partir des composantes LOCALES : `toISOString()` convertit en UTC et fait reculer
// d'un jour toute date du soir en heure d'été.
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
