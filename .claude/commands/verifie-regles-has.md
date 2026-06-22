# /verifie-regles-has — Auditer la conformité métier HAS d'un bout de code

Utilisation : `/verifie-regles-has` (sur un fichier ouvert ou un diff en cours)

Relis `context/02-referentiel-has.md` en entier, puis vérifie le code visé contre cette
checklist, ligne par ligne :

- [ ] Aucune trace du système Qualiscope (A/B/C/D) utilisée comme unité de cotation d'un
  critère ou d'un E.E. — seul `1/2/3/4/STAR/NC/RI` est valide en saisie
- [ ] `RI` n'est proposable/acceptable que si le critère appartient au Chapitre 1
- [ ] `NC` déclenche un avertissement (pas un blocage dur) si le critère est `IMPERATIF`
- [ ] `STAR` est traité comme valeur `4` dans tout calcul de moyenne
- [ ] `NC` et `RI` sont exclus de tout calcul de moyenne
- [ ] Aucun nombre de critères impératifs hardcodé (16, 17 ou 18) — toujours dérivé de
  `Criterion.requirement_level` + `Criterion.applicable_to` filtré par le type
  d'établissement
- [ ] Aucune confusion DUERP (Code du Travail, RH) / critères 2.2.x HAS (droits des
  personnes accompagnées) dans les libellés ou la logique de rattachement
- [ ] Aucun texte d'UI ne présente l'outil comme une "évaluation HAS officielle" — toujours
  "auto-évaluation préparatoire" / "diagnostic"

Si une violation est trouvée, la corriger directement et expliquer brièvement pourquoi
c'était une erreur (référencer la section précise de `context/02-referentiel-has.md`).
