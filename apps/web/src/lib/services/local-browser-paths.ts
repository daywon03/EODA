// ─────────────────────────────────────────────────────────────────────────────
// OÙ EST LE NAVIGATEUR DE LA MACHINE (20/10/2026)
//
// `@sparticuz/chromium` embarque un binaire **Linux** (AL2023) : sur un poste macOS
// ou Windows il ne peut pas s'exécuter. Jusqu'ici le seul recours était de poser
// `PUPPETEER_EXECUTABLE_PATH` à la main — donc, pour qui clone le dépôt et lance
// `pnpm dev`, chaque aperçu de document répondait 503 sans rien dire d'utile.
//
// Cette liste est la même recherche qu'un humain ferait, dans le même ordre : Chrome
// d'abord (le plus probablement installé), puis Chromium, puis les navigateurs bâtis
// dessus. Elle ne sert QU'EN DÉVELOPPEMENT (voir `headless-chromium-service`) : en
// production le binaire embarqué est le bon, et un repli silencieux vers un Chrome
// de bureau sur un serveur serait une surprise, pas une solution.
//
// Module PUR quant au système de fichiers : l'existence est une fonction reçue en
// argument, pour que la règle se teste sans installer de navigateur.
// ─────────────────────────────────────────────────────────────────────────────

const DARWIN_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];

const WINDOWS_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

const LINUX_CANDIDATES = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

// Les chemins essayés, dans l'ordre, pour une plateforme donnée. `darwin` et `win32`
// sont les deux où le binaire embarqué ne sert à rien ; sous Linux il s'exécute, donc
// la liste n'est qu'un secours (poste de développement Debian sans AL2023).
export function localBrowserCandidates(platform: string): readonly string[] {
  if (platform === "darwin") return DARWIN_CANDIDATES;
  if (platform === "win32") return WINDOWS_CANDIDATES;
  if (platform === "linux") return LINUX_CANDIDATES;
  return [];
}

// Le premier candidat qui EXISTE, ou `null`. Rien n'est lancé ici : un chemin présent
// peut encore refuser de démarrer, et c'est le lancement qui le dira.
export function findLocalBrowser(params: {
  platform: string;
  exists: (path: string) => boolean;
}): string | null {
  return localBrowserCandidates(params.platform).find((path) => params.exists(path)) ?? null;
}
