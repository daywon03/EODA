# Référentiel HAS — règles exactes (source de vérité)

> Ce fichier encode les règles métier exactes du manuel d'évaluation HAS (juillet 2025).
> En cas de doute pendant le développement, c'est ce fichier qui tranche — pas la mémoire
> du modèle, qui confond fréquemment ce référentiel avec le système Qualiscope.

## 1. Structure hiérarchique du référentiel

```
Manuel HAS (juillet 2025)
 └─ 3 Chapitres
     └─ 8 Thématiques
         └─ ~42 Objectifs
             └─ 157 Critères (dont 16 à 18 impératifs selon profil ESSMS)
                 └─ Éléments d'Évaluation (E.E.) — unité atomique de cotation
```

Note de périmètre : les grilles Synaé concrètement utilisées pour un SAD ne couvrent pas
forcément les 157 critères du manuel complet (certains critères du manuel ne s'appliquent
qu'à d'autres types d'ESSMS). Le périmètre effectivement extrait pour SAD dans les grilles
Synaé du projet (Chapitres 1, 2, 3 confondus) compte **137 critères** / **295 E.E.** Toujours
préciser "sur le périmètre SAD" quand on affiche un total dans l'UI, pour ne pas créer de
confusion avec le "157" qui est le chiffre toujours utilisé en communication commerciale
HAS/EODA (cf `EODA_offre_commerciale_SAD.pdf`).

## 2. Les 3 chapitres

| # | Nom | Méthode | Interlocuteur | Durée indicative |
|---|---|---|---|---|
| 1 | La personne | Accompagné traceur | Personne accompagnée + entourage | ~90 min |
| 2 | Les professionnels | Traceur ciblé | Professionnels de terrain | ~60 min |
| 3 | L'ESSMS | Audit système | Gouvernance / direction | ~120 min |

## 3. Système de cotation — règles exactes

### 3.1 Les valeurs possibles

| Code | Libellé exact HAS | Valeur numérique pour calcul de moyenne |
|---|---|---|
| `1` | Le niveau attendu n'est **pas du tout satisfaisant** | 1 |
| `2` | Le niveau attendu n'est **plutôt pas satisfaisant** | 2 |
| `3` | Le niveau attendu est **plutôt satisfaisant** | 3 |
| `4` | Le niveau attendu est **tout à fait satisfaisant** | 4 |
| `★` | Le niveau atteint est **optimisé** | 4 (traité comme un 4 dans les agrégations) |
| `NC` | L'ESSMS est **non concerné** par l'élément d'évaluation | exclu du calcul |
| `RI` | La personne accompagnée donne une **réponse inadaptée** à l'intervenant | exclu du calcul |

### 3.2 Règles de cotation à respecter impérativement dans le code

1. **`RI` n'existe que pour le Chapitre 1.** Ne jamais proposer cette option sur un E.E. des
   chapitres 2 ou 3. Condition : `chapitre === 1`.
2. **`NC` est interdit sur les critères impératifs.** Avant de coter NC, l'évaluateur doit
   se poser 4 questions (cf. fiche HAS "La cotation non concerné", 9 décembre 2025) :
   - le périmètre du critère est-il vraiment hors des missions de l'ESSMS ?
   - l'ESSMS pourrait-il mobiliser des ressources externes pour répondre à l'attendu ?
   - le choix de la personne accompagnée explique-t-il l'absence d'élément ?
   - l'ESSMS a-t-il une action préventive en place malgré tout ?
   → Dans l'UI, le bouton NC doit afficher un avertissement (pas un blocage strict — c'est
   un garde-fou pédagogique, pas une contrainte technique dure) quand le critère est impératif.
3. **`★` compte comme `4`** dans toute moyenne — jamais comme une valeur "5" ou un bonus.
4. **L'agrégation est une moyenne, calculée à plusieurs niveaux** : E.E. → Critère →
   Objectif → Thématique → Chapitre → Global. Le manuel HAS pondère en réalité l'objectif
   3.10 (démarche qualité) à hauteur de 10% dans le score global officiel — c'est une
   spécificité documentée dans la note méthodologique Qualiscope. Pour l'auto-évaluation
   interne EODA, une moyenne simple non pondérée est acceptable en V1, **mais le moteur de
   calcul doit être conçu pour accepter une pondération par objectif en V2** (ne pas
   hardcoder une moyenne arithmétique simple sans point d'extension).
5. **Échelle indicative de lecture du score moyen /4** (utilisée dans le prototype existant,
   à conserver comme aide à la lecture, pas comme règle officielle HAS) :
   - ≥ 3.5/4 → "Tout à fait satisfaisant" (zone cible pour les impératifs)
   - 2.5 à 3.49/4 → "Plutôt satisfaisant"
   - 1.5 à 2.49/4 → "Plutôt pas satisfaisant"
   - < 1.5/4 → "Pas du tout satisfaisant"

### 3.3 Qualiscope — à ne PAS confondre, mais à connaître

Qualiscope est l'échelle de publication **publique** des résultats agrégés HAS, calculée
sur 2 dimensions : (i) moyenne pondérée des objectifs ramenée sur 100, (ii) % de critères
impératifs cotés ≥ 3,5. Le résultat est une lettre A/B/C/D, publique et visible des
financeurs. **Ce n'est pas un système de cotation d'E.E. ou de critère** — c'est un score
de communication calculé en aval, par la HAS, sur la base des cotations 1-4 du dossier.
La plateforme EODA peut proposer une estimation indicative du score Qualiscope en sortie
de diagnostic (à titre d'aide à la compréhension du client), mais ne doit **jamais** demander
à l'utilisateur de "coter en A/B/C/D" — l'unité de saisie reste toujours 1/2/3/4/★/NC/RI.

## 4. Critères impératifs — liste de référence (SAD)

| Critère | Thématique | Chapitre |
|---|---|---|
| 2.2.2 | Dignité & intégrité | 2 |
| 2.2.3 | Vie privée & intimité | 2 |
| 2.2.4 | Liberté d'opinion, croyances, vie spirituelle | 2 |
| 2.2.5 | Droit à l'image | 2 |
| 2.2.6 | Exercice des droits et libertés (rôle ESSMS) | 2 |
| 2.2.7 | Confidentialité & protection des données | 2 |
| 3.11.1 | Plan de prévention maltraitance/violence | 3 |
| 3.11.2 | Traitement des signalements maltraitance/violence | 3 |
| 3.12.1 | Recueil et traitement des plaintes/réclamations | 3 |
| 3.12.2 | Communication sur le traitement des plaintes/réclamations | 3 |
| 3.12.3 | Analyse en équipe des plaintes/réclamations | 3 |
| 3.13.1 | Recueil et traitement des EI/EIG | 3 |
| 3.13.2 | Communication sur les EI/EIG | 3 |
| 3.13.3 | Déclaration et analyse en équipe des EI/EIG (CREX) | 3 |
| 3.14.1 | Plan de gestion de crise / continuité d'activité | 3 |
| 3.14.2 | Communication du plan de gestion de crise | 3 |

→ **16 critères impératifs pour un SAD Aide.**

Pour un **SAD Mixte** (aide + soins), s'ajoute :

| Critère | Thématique | Chapitre |
|---|---|---|
| 3.6.2 | Sécurisation du circuit médicamenteux | 3 |

→ **17 critères impératifs pour un SAD Mixte.**

⚠️ Le nombre "18" apparaît dans certaines communications HAS génériques tous-ESSMS
confondus (annexe note méthodologique Qualiscope) — pour le périmètre SAD spécifique du
projet EODA, retenir **16 (Aide) ou 17 (Mixte)** comme vérité opérationnelle, conformément
au tableau UNA et à l'offre commerciale EODA. Le modèle de données doit stocker le profil
de l'établissement (`type: 'AIDE' | 'MIXTE'`) et en déduire dynamiquement la liste des
critères impératifs applicables — ne jamais hardcoder un nombre fixe dans l'UI.

## 5. Conséquence réglementaire d'un critère impératif non satisfait

Si un critère impératif est coté 1, 2 ou 3 (donc < 4) lors d'une évaluation officielle :
1. L'évaluateur doit compléter un **formulaire critère impératif** individualisé et
   justifié (généré automatiquement sur Synaé en conditions réelles).
2. L'ESSMS a l'obligation d'élaborer un **plan d'actions** correctif.
3. Ce plan d'actions doit être transmis à l'**ATC** en même temps que le rapport final.

→ Pour la plateforme EODA (qui prépare en amont, hors évaluation officielle), ceci se
traduit fonctionnellement par : tout critère impératif coté < 4 dans le module
auto-évaluation doit **automatiquement générer une entrée prioritaire dans le plan d'action**
(PLAC) du module 2, avec un statut "critique" distinct des critères standards. C'est un
besoin produit direct, pas seulement une règle informative.

## 6. Indépendance évaluateur / conseil — contrainte de positionnement produit

Le cahier des charges HAS applicable aux organismes évaluateurs accrédités leur interdit
d'agir en tant que conseil (assistance, consulting, coaching) pour un ESSMS qu'ils évaluent.
EODA Conseil n'est **pas** un organisme évaluateur accrédité — EODA est un cabinet de
préparation/conseil. Implication produit : la plateforme ne doit jamais s'auto-désigner
comme "évaluation HAS officielle" dans ses textes d'interface — toujours "auto-évaluation
préparatoire", "diagnostic", "simulation". Ce n'est pas un détail cosmétique : c'est une
clarification de positionnement qui protège juridiquement EODA et doit transparaître dans
toute copie UI générée (pages d'accueil, emails automatiques, rapports exportés).

## 7. Sources documentaires internes mobilisées pour ce fichier

- `manuel_devaluation_de_la_qualite_essms-MAJ-08072025.pdf` — référentiel complet
- `fiche_pratique__le_systeme_de_cotation_du_dispositif_devaluation_de_la_qualite_des_essms.pdf`
- `02Critères_impératifs_SAD__Tableau_UNA.pdf`
- `20251104_note_methodologique_publication_des_resultats_v2_...Qualiscope.pdf`
- `EODA_offre_commerciale_SAD.pdf`
- `Support_formation_e_valuateur_ESSMS_2025_11_17_et_18....pdf`
- `Grille_Chapitre_{1,2,3}_..._SAA_ASSAD_BENOIT.xlsx` (grilles Synaé opérationnelles, 137 critères extraits)
