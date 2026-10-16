# Charte EODA Conseil — à appliquer sur toute interface

## 1. Palette officielle (source : `charte_couleurs_et_logo.pdf`)

```css
:root {
  --brun-ancre:   #3E2C26;  /* Fond header, ancrage, maturité, crédibilité */
  --brun-moyen:   #5C3D2E;  /* Éléments secondaires, nav */
  --terre:        #B45A32;  /* Terre Brûlée — accents actifs, CTA, blocs KPI/PDCA */
  --ambre:        #D69646;  /* Ambre Doré — accents, tags, bienveillance */
  --ivoire:       #F0E8DC;  /* Fond doux */
  --ivoire-light: #FAF3EB;  /* Fond de page */
  --blanc:        #FFFFFF;
  --rouge-imp:    #C0392B;  /* Réservé : signalement critère impératif / cotation 1 */
  --vert-ok:      #27AE60;  /* Réservé : statut conforme */
  --gris-mid:     #8A7B72;  /* Texte secondaire */
  --gris-light:   #E8DDD6;  /* Bordures, fonds neutres */
}
```

Couleurs de cotation HAS (réservées, ne pas réutiliser ailleurs dans l'UI pour éviter toute
confusion visuelle avec un statut de cotation) :

```css
--cot-1: #C0392B;  /* pas du tout satisfaisant */
--cot-2: #E67E22;  /* plutôt pas satisfaisant */
--cot-3: #27AE60;  /* plutôt satisfaisant */
--cot-4: #1A5276;  /* tout à fait satisfaisant */
--cot-star: #D69646;  /* optimisé */
--cot-nc: #8A7B72;  /* non concerné */
--cot-ri: #8E44AD;  /* réponse inadaptée */
```

## 2. Typographie

Police maison : **Trebuchet MS** (fallback : `'Trebuchet MS', 'Segoe UI', Arial, sans-serif`).

⚠️ Trebuchet MS n'est pas une web font Google Fonts standard — elle est présente nativement
sur Windows/Mac mais pas garantie sur tous les systèmes Linux. Pour la plateforme web en
production, prévoir soit :
- le fallback système (acceptable, cohérent avec les livrables existants), soit
- une web font de substitution visuellement proche si la cohérence cross-device devient un
  enjeu (à valider avec Sandrine avant de changer — ne pas décider seul en cours de build).

## 3. Logo

**Fichier source officiel** : `context/Documents/20260827_CHARTE_EODA_Couleurs-et-logo_v01_Interne.pptx`
(remis par Sandrine le 27/08/2026). Les deux déclinaisons utilisées par la plateforme en
sont extraites, fond blanc détouré :

| Fichier | Contenu | Où |
|---|---|---|
| `apps/web/public/logo-eoda.png` | Bloc complet : rond + « EODA conseil » + signature + « Accompagnement qualité des ESSMS » | Fonds CLAIRS — page de connexion (mobile), devis et avenants imprimés, en-tête des e-mails |
| `apps/web/public/marque-eoda.png` | Le rond seul (quartiers brun / terre / ambre sur ivoire) | Fonds SOMBRES — en-tête de l'application, panneau de connexion, favicon (`apps/web/src/app/icon.png`) |

Le pictogramme est un viseur / croix directionnelle, évoquant la précision du diagnostic.
Wordmark : « EODA conseil ». Signature : *« Expliquer · Observer · Démontrer · Accompagner »*.

⚠️ **Ne jamais redessiner le logo.** Jusqu'au 27/08/2026, l'en-tête et la page de connexion
affichaient un SVG dessiné à la main : un rond en ambre uni, sans les quartiers brun et
terre du vrai logo, et sans le lettrage. Une approximation abîme la marque — et celle-ci
part sur des devis remis à des clients. Le composant unique est
`components/layout/EodaLogo.tsx` (`EodaMark` / `EodaLockup`).

## 4. Convention de nommage des fichiers générés par la plateforme

Tout document exporté par la plateforme (rapport de diagnostic, export Synaé, PLAC généré,
etc.) doit respecter le nommage EODA strict :

```
AAAAMMJJ_TYPE_CLIENT_OBJET_vXX_Interne|Externe.ext
```

Exemple : `20260622_RAPPORT_ASSAD-BENOIT_Diagnostic-Documentaire_v01_Externe.pdf`

Codes `TYPE` connus à ce stade : `DOC` (documentation outil), `RAPPORT`, `GABARIT`, `OUTIL`,
`PLAC`. Le moteur de génération de documents doit centraliser ce formatage dans une seule
fonction utilitaire (`buildExportFilename()`), jamais dupliqué à chaque endroit d'export.

## 5. Mention de licence obligatoire (footer de tout document exporté)

```
Produit par EODA Conseil · Licence d'utilisation interne · Mention d'origine obligatoire à
conserver · © {année} EODA Conseil
```

Base légale : licence d'utilisation non exclusive avec mention obligatoire de source
(Articles L121-1 et L111-1 du Code de la propriété intellectuelle).

## 6. Positionnement de copie (ton, vocabulaire)

- Toujours "auto-évaluation préparatoire" / "diagnostic" — jamais "évaluation HAS officielle"
  (cf. contrainte d'indépendance évaluateur/conseil, `context/02-referentiel-has.md` §6)
- Vocabulaire HAS exact partout : ESSMS, SAD, E.E., critère impératif/standard — jamais de
  substitution Qualiscope (A/B/C/D) dans une zone de saisie ou de cotation
- Contact générique de la marque : `EODAconseil@outlook.com`
- **Jamais « IA »** dans une copie d'interface, un e-mail ou un export (décision du
  30/09/2026) : une sortie automatique est une « proposition à vérifier ».

## 7. Accessibilité — règles d'usage de la charte (30/09/2026)

> La charte ne change pas (confirmé par Damon le 30/09/2026 : « garde le logo et la charte
> graphique actuels, il faut juste que tout soit bien cohérent, facile d'utilisation et
> accessible »). Ce sont ses **usages** qui s'ajustent, parce que les contrastes mesurés
> ci-dessous rendent certaines combinaisons illisibles. Objectif : WCAG 2.2 AA + FALC.

### 7.1 Contrastes mesurés (formule WCAG, seuil AA texte courant = 4,5:1)

| Couleur en texte | sur blanc | sur `--ivoire-light` | Usage autorisé |
|---|---|---|---|
| `--brun-ancre` | 13,2 | 12,0 | Texte principal partout |
| `--brun-moyen` | 9,7 | 8,8 | **Texte secondaire** (remplace le gris) |
| `--terre` | 4,7 | **4,3** | Texte seulement sur **surface blanche**, ou en titre ≥ 24 px (≥ 19 px gras) |
| `--gris-mid` | **4,1** | **3,7** | **Jamais du texte à lire** : icônes décoratives, bordures, placeholders |
| `--ambre` | 2,5 | 2,3 | Jamais en texte sur fond clair ; aplat avec texte brun-ancre (5,2) ou texte sur fond brun-ancre (5,2) |
| `--vert-ok`, `--cot-2` | 2,9 | 2,6 | Aplat + texte brun-ancre (4,6), ou pastille + icône + libellé brun |
| `--rouge-imp` | 5,4 | 4,9 | Texte d'alerte |
| Blanc sur `--terre` | 4,7 | — | Bouton principal |

### 7.2 Tailles et cibles
- Texte courant ≥ 16 px (cabinet), ≥ 18 px (portail client, espace équipe) ; **rien sous
  14 px**. Le code compte aujourd'hui ~18 `text-[10px]` / `text-[11px]` — à supprimer.
- Interligne ≥ 1,5 ; texte aligné à gauche ; pas d'italique ni de mot entier en majuscules
  pour du texte à lire.
- Cibles tactiles ≥ 48 × 48 px côté client et équipe, ≥ 44 px côté cabinet.
- Aucun statut porté par la couleur seule : icône + mot + couleur.

### 7.3 FALC (portail client, espace équipe)
Une idée par phrase, phrases courtes, « vous », mots du quotidien, sigles expliqués,
pictogramme + texte, pas d'abréviation, pas de pourcentage côté équipe, pas d'image
enfantine. Source : [« L'information pour tous », Unapei](https://www.unapei.org/publication/linformation-pour-tous-regles-europeennes-pour-une-information-facile-a-lire-et-a-comprendre/).
Le **logo FALC** n'est apposé qu'après relecture par des personnes concernées.

### 7.4 Pictogrammes
Lucide pour l'interface. **Interdits** : ARASAAC (CC BY-NC-SA) et SantéBD (usage
commercial exclu). Sclera exige un accord écrit. Préférer des pictogrammes propres à EODA.

### 7.5 Dette relevée dans le code (30/09/2026)
~14 couleurs hex codées en dur dans `AppHeader.tsx`, 9 dans l'écran de connexion, 2 dans
`ThemeToggle.tsx` ; ~6 `bg-white` ; les tokens shadcn (`--card`, `--background`…) ne sont
pas redéfinis en sombre. À corriger avec la refonte, via les tokens — jamais en ajoutant
d'autres valeurs en dur.

Brief de refonte complet : `.claude/design/20260930_DOC_EODA_Brief-Claude-Design-Refonte_v01_Interne.md`.
