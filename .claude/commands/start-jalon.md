# /start-jalon — Démarrer un jalon de la roadmap

Utilisation : `/start-jalon 0` (ou 1, 2, 3, 4, 5)

Avant de coder quoi que ce soit pour ce jalon :

1. Relis `CLAUDE.md` à la racine du projet (rappel des priorités et contraintes).
2. Relis `specs/03-roadmap-developpement.md` et localise le jalon demandé — relis sa
   "Definition of done" en entier avant d'écrire la première ligne de code.
3. Si le jalon touche au référentiel HAS, à la cotation, ou aux documents obligatoires,
   relis aussi `context/02-referentiel-has.md` et `context/03-documents-obligatoires.md`
   intégralement — ne pas travailler de mémoire sur ces règles.
4. Si le jalon touche à l'UI visible, relis `context/04-charte-eoda.md`.
5. Propose un plan de tâches découpé (todo list) correspondant aux cases à cocher du
   jalon dans la roadmap, avant de commencer à écrire du code.
6. Signale explicitement si une tâche du jalon dépend d'une information non disponible
   dans le contexte fourni (ex : format d'export Synaé réel, jalon 4) plutôt que de
   deviner une solution arbitraire — proposer une hypothèse de travail clairement
   marquée comme telle, à valider avec Sandrine.
7. Une fois le plan validé par l'utilisateur, exécute les tâches dans l'ordre, en gardant
   chaque service/composant aligné sur les principes SOLID décrits dans
   `specs/02-architecture-technique.md` §3 (séparation des responsabilités).
