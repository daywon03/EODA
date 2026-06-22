# Prototype existant — ce qui est déjà construit et pourquoi on le réécrit

## Ce qui existe

Un fichier HTML unique, statique, sans backend ni persistance :
`EODA_AutoEval_SAD_HAS_Plateforme_Externe.html`

Contenu fonctionnel déjà validé avec Sandrine :
- Les **137 critères** des 3 chapitres Synaé (Chapitres 1, 2, 3), avec leurs **295 E.E.**
  exacts, extraits des fichiers `Grille_Chapitre_{1,2,3}_..._SAA_ASSAD_BENOIT.xlsx`
- Distinction visuelle critère **Impératif** (★, rouge) vs **Standard**
- Saisie de cotation par bouton : **1 / 2 / 3 / 4 / ★ / NC / RI** (RI affiché uniquement au
  Chapitre 1) — **ce système de cotation a déjà été corrigé une fois en session** (la
  première version utilisait par erreur le système Qualiscope A/B/C/D — ne jamais
  régresser vers ça, voir `context/02-referentiel-has.md`)
- Minuteur par chapitre (pause/reprise/reset), durée estimée affichée
- Zone de commentaire libre par critère ("éléments de preuve consultés")
- Tableau de résultats : score moyen /4 par chapitre et global, distribution des cotations,
  plan d'action priorisé (cotations 1 et 2, impératifs en premier)
- Page "légende" expliquant le système de cotation HAS en détail
- Charte EODA appliquée (couleurs, typo, logo, footer de licence)

## Pourquoi on ne part pas de ce fichier pour la V1 plateforme

Ce prototype est un **artifact statique de démonstration**, pas une fondation technique
viable pour un produit multi-clients :
- Pas de backend, pas de base de données — tout est en mémoire JS (`let cotations = {}`),
  perdu au rechargement de la page
- Pas de notion de compte, d'établissement, ni de cloisonnement des données entre clients
- Les données du référentiel (137 critères, E.E.) sont **codées en dur dans une constante
  JS de plusieurs centaines de lignes** dans le HTML — non maintenable, non réutilisable
  par d'autres modules (Module 1 et 2 ont besoin du même référentiel critère/E.E.)
- Aucune connexion aux documents (Module 1/2) — c'est un module isolé

## Ce qu'on en récupère pour la vraie plateforme

1. **Le contenu métier** : les 137 critères + 295 E.E. extraits doivent être migrés vers
   une **table de référence en base de données** (`criterion`, `evaluation_element` — voir
   `specs/02-architecture-technique.md` §schéma BDD), via un script de seed unique, pas
   redupliqués dans le code applicatif.
2. **La logique de cotation et d'agrégation** (moyenne E.E.→critère→objectif→chapitre,
   exclusion NC/RI, ★=4) — à porter en TypeScript côté backend comme service pur testable
   unitairement (`ScoringService`), pas en JS inline côté client.
3. **La charte visuelle** (couleurs CSS, structure de la page de résultats, page légende)
   — réutilisable quasi telle quelle comme design de référence pour les composants
   React/Tailwind du Module 3.
4. **Les règles de garde-fou UX** déjà pensées (avertissement NC sur critère impératif,
   RI uniquement Chapitre 1) — à conserver comme spec de comportement, voir
   `specs/01-mvp-v1.md` §Module 3.

## Action concrète attendue de Claude Code

Ne pas copier-coller le HTML existant dans le projet Next.js. Le traiter comme une
**spécification fonctionnelle de référence** : reproduire le comportement et le contenu
métier dans la nouvelle architecture propre, en extrayant le référentiel HAS en données
de seed plutôt qu'en code.
