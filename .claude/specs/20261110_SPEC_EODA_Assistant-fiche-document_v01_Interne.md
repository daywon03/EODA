# Spécification — Assistant dans la fiche document (lot F du plan du 09/11/2026)

> Statut : **v1 codée le 11/11/2026** — décision de Damon : « on fait comme avec MusicPlanner »
> (session du 05/11/2026, PR #75/#78/#79 de MusicPlanner). Source : call du 09/11/2026.
>
> **Décisions tranchées (§5 ci-dessous) :** coût = 40 crédits par jour et par compte, non
> cumulables, remis à minuit (Paris), 1 crédit = 0,0015 € de coût réel (`usage.cost`
> d'OpenRouter), au moins 1 par question, confirmer / écarter gratuit ; à zéro : « Crédits du
> jour épuisés. Ils reviennent à minuit. » — accès : cabinet (`STRUCTURES_WRITE`), jamais une
> structure, ni en autonomie ni accompagnée — conservation : pas de purge, jusqu'à ce que
> l'auteur supprime la conversation. **Écart assumé avec MusicPlanner** : pas de boucle
> d'outils, le contexte d'UN document est remis d'emblée, balisé comme donnée ; réponse JSON
> validée (`parseAssistantReply`). Code : `lib/services/assistant-service.ts`,
> `lib/llm/assistant-chat.ts`, `lib/actions/document-assistant.ts`,
> `components/assistant/DocumentAssistant.tsx`, migration `20261111120000_document_assistant`.
> **Assistant du menu latéral (11/11/2026)** : page `/dashboard/cabinet/assistant`, tâches
> prédéfinies, vraie boucle d'outils (vérifiée sur MiniMax M2.7 via OpenRouter) bornée au
> périmètre de l'appelant — structures, documents, analyses, texte, images décrites, mise en
> page Word, base vectorielle — et cartes (consigne, demande à la structure, consignes de mise
> en page enregistrées pour la structure). Mêmes crédits.
> Pas encore fait : bouton flottant sur toutes les pages, choix du modèle, mesures d'usage,
> lecture des images par un modèle de vision (on lit les descriptions faites à l'analyse).
> Cette spécification passe avant le code parce qu'elle touche à la doctrine IA (`CLAUDE.md` §7 :
> une sortie de modèle est une proposition, jamais un verdict) et au coût par appel.

## 1. Le besoin, dans les mots du call

- Sandrine travaille avec trois écrans : le portail EODA, Claude et Hermès. Elle recopie un
  passage de l'analyse dans Claude (« qu'est-ce que je dois comprendre ? »), corrige le document
  là-bas, puis le redépose. « Cette multiplication d'outils, c'est compliqué psychologiquement et
  intellectuellement. »
- Le champ « Commentaire sur ce document » sert déjà d'amorce de dialogue : « fais attention à
  ça, ignore ça, c'est un mode opératoire ». Il manque l'échange (une question, une réponse) et
  la mémoire, pour que l'instruction ne soit jamais redonnée.
- Damon : remplacer la partie « Analyse » du panneau de droite par un fil de discussion. Les
  appels coûtent peu (6 € déposés sur OpenRouter, presque rien consommé) et le modèle reste en
  Europe.

## 2. Ce que fait l'assistant, et ce qu'il ne fait pas

| Fait | Ne fait pas |
|---|---|
| Explique un point de l'analyse en mots simples (« que veut dire "consentement explicite" ici ? ») | Décider qu'un document est conforme, valider, coter un critère |
| Propose une reformulation ou un ajout, présenté comme une **proposition** (Accepter / Corriger) | Écrire dans le document sans geste humain |
| Retient une instruction **si et seulement si** la consultante la marque « à retenir » | Retenir silencieusement tout ce qui est dit |
| Lit le document courant, son analyse, la matrice du type et les commentaires « pris en compte par l'IA » | Lire les documents d'une autre structure, ou les exemples validés d'un autre tenant |
| Prépare une demande à la structure (« Demander à la structure », lot A7) | Envoyer quoi que ce soit à la structure sans clic |

## 3. Conception

- **Où** : onglet « Analyse » de la fiche document (lot A4). Le fil se place sous le résumé de
  l'analyse, qui ne disparaît pas.
- **Qui** : cabinet seulement (`DOCUMENTS_WRITE`), et jamais pour une structure en autonomie dans
  cette première version. Un document à accès restreint (lot D) n'a pas d'assistant.
- **Mémoire = le mécanisme qui existe déjà.** Une réponse ou une consigne marquée « à retenir »
  devient un commentaire du document (`Document.missingJustification`, « pris en compte par
  l'IA », lu par `readDocumentComment`) ou une guideline de critère (`CriterionGuideline`, append-only,
  `aiEnabled`). Aucune nouvelle mémoire cachée : ce qui est retenu se voit, se désactive et se
  journalise comme aujourd'hui.
- **Fil** : nouvelle table `DocumentAssistantMessage` (documentId, auteur, rôle, texte, date),
  bornée aux 50 derniers échanges par document. Pas de pièce jointe. Le texte n'est **jamais** recopié dans le
  journal d'audit (même règle que le fil d'échange).
- **Appel** : par le port unique `getLLMAnalysisPort()`, qui porte déjà `withScriptGuard`. Le
  document et l'analyse partent comme **données balisées** (`neutralizePromptBlocks`), jamais
  comme instructions. Le texte est anonymisé (`anonymizeText`) avant envoi.
- **Débit** : 30 messages par heure et par compte (compteur partagé, même socle que
  `MESSAGE_RATE_LIMIT`).
- **Modèle** : celui des analyses (`minimax/minimax-m2.7` via OpenRouter). Routage à verrouiller
  au moment de la migration HDS : aucun fournisseur qui conserve les données (`CLAUDE.md` §4).
- **Réserve** : chaque réponse porte « Proposition de l'assistant, à vérifier. » Le mot
  « conforme » est interdit dans ses sorties ; un test de contenu le vérifie, sur le modèle de
  `content-guard.test.ts`.

## 4. Découpage proposé

1. Lecture seule : « Expliquer ce point » sur chaque élément de l'analyse, réponse affichée sans
   fil ni mémoire. Valeur immédiate, aucun nouveau schéma.
2. Fil de discussion (table, débit, journal sans texte).
3. « À retenir » vers le commentaire du document ou une guideline de critère.
4. Propositions d'ajout envoyées vers l'espace de mise en conformité existant (segments
   ORIGINAL / AJOUT), plutôt qu'une seconde porte d'écriture.

## 5. Décisions à prendre avant de coder

- Coût mensuel plafond accepté, et ce que l'écran dit quand il est atteint.
- Ouverture aux structures en autonomie (probablement non : l'assistant ressemble à la relecture
  EODA, qui se vend).
- Durée de conservation du fil.
