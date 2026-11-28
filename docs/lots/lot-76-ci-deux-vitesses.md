# Lot 76 — CI en deux vitesses

- Origine : décision de Julien du 28/11/2026, après la coupure à 60 min de la moitié 1 des parcours
  sur la PR #218 (sans traces) et la limite portée à 90 min en sursis (PR #219).
- Périmètre : CI, configuration de Playwright, outillage et deux tests. **Aucun écran, aucun schéma,
  aucune migration, aucun parcours réécrit ni supprimé** : pas de validation préalable requise.
- Exigences : ARC-20 (tout est testé), SEC-36 (tests d'abus dans la chaîne de contrôle), NFR-01,
  NFR-02 (mesures du temps de réponse), NFR-24. Décision : [ADR 0124](../adr/0124-ci-en-deux-vitesses.md).

## 1. But

Une PR doit recevoir son verdict en **10 à 15 minutes**, au lieu de 50 à 60 : pendant la réalisation
des lots 70 à 74, une dizaine de PR passent par heure, et chacune rejouait toute la suite (870
parcours sous Chromium, 74 min en série, plus 15 min de scénarios sous Firefox et WebKit).

## 2. Ce qui change

| Quand | Parcours de bout en bout joués | Durée visée |
| --- | --- | --- |
| **Pull request** (voie rapide) | le **socle** (20 parcours essentiels, `apps/symbola/e2e/socle.ts`) et les **fichiers de parcours modifiés ou ajoutés** par la PR, sous Chromium, en ordinateur et en 375 px ; en parallèle, les **mesures du temps de réponse** dans leur job | moins de 15 min |
| **Push sur `main`** (chaque fusion), **chaque nuit** (1 h 30 UTC), **à la demande** (`workflow_dispatch`), ou PR étiquetée **`suite-complete`** | la **suite complète** : Chromium (ordinateur et 375 px, axe-core) en **quatre parts**, les scénarios sous Firefox et WebKit (360 et 1 920 px, zoom à 150 %), et les **mesures du temps de réponse** (NFR-01, NFR-02) dans leur **propre job** | environ 25 min |

- **Le socle** couvre : inscription et connexion par lien, page de connexion, « Aujourd'hui », le
  scénario du lundi matin (SC-03), création d'un évènement puis confirmation et annulation, création
  rapide, écran « Tâches » et cocher-annuler, ligne de budget, devis composé et envoyé, facture et
  avoir, carnet de prestataires, import d'un fichier, mode jour J, portail des mariés, lien d'un
  prestataire avec code, accès croisé entre organisations (SC-S1), portée du lien d'un prestataire
  (SC-S3), lien expiré (SC-S4), exploitation fermée aux autres rôles. Tous choisis dans l'existant,
  courts et indépendants : 2 min en ordinateur, 1 min 40 en 375 px sur main.
- **Les mesures** (ajout du 28/11/2026, décidé par Julien après deux échecs de `lot-71f-fiche-reprise`
  à 328 et 396 ms) se jouent **sur chaque PR comme sur `main`** : une PR qui alourdit toutes les pages
  doit être arrêtée avant la fusion. Ce sont tous les tests dont le titre (ou celui de leur
  description) porte « NFR-01 » ou « NFR-02 » : les trois de `nfr-01-02-mesures.spec.ts` et ceux des
  paquets (`lot-70d-ecran-taches`, `lot-71f-fiche-reprise`, `lot-73b-carnet`) ; un futur test de mesure
  suit la même règle de nom. Ils se jouent à place fixe et serveur chaud : le job démarre le serveur
  une fois, le réchauffe en jouant le socle (ordinateur et 375 px), puis mesure sans redémarrer. Ils ne
  bougent donc plus quand la suite grandit ou se redécoupe ; la voie rapide et les quatre parts les
  écartent (`E2E_SANS_MESURES=1`).
- **La marge se voit** : chaque test de mesure dit sa valeur, même quand il passe
  (`e2e/mesure.ts` : sortie des parcours, annotation du rapport, fichier de mesures), et le job écrit
  dans son résumé GitHub le tableau « mesure, valeur, seuil, marge »
  (`tools/ci-pipeline/tableau-mesures.mjs`). Seul l'affichage des tests de mesure a changé : ni seuil,
  ni méthode.
- **Les traces** des parcours en échec sont publiées après tout échec (`if: always()`), y compris
  quand le temps manque : l'étape des parcours a sa propre limite, plus courte que celle du job, et
  Playwright s'arrête proprement deux minutes avant (`--global-timeout`), en disant ce qui n'a pas
  tourné.
- **Sur `main`**, une exécution en cours n'est plus coupée par la fusion suivante (seules les PR
  gardent `cancel-in-progress`) : sinon, avec des fusions toutes les vingt minutes, la suite complète
  ne finirait jamais.
- **Cache de compilation de Next** (`.next/cache`) repris de la dernière exécution sur `main` (écrit
  par le seul job des mesures, sur `main`) : la compilation, 3 à 4 min par job, raccourcit.
- **Choix des parcours** : `tools/ci-pipeline/plan-parcours.mjs` (job « Parcours à jouer »), testé par
  `plan-parcours.test.mjs` ; le résumé du job dit quelle voie et quels fichiers.

### Pourquoi le socle n'est pas une étiquette `@socle`

Une étiquette dans chaque fichier aurait modifié une vingtaine de fichiers de parcours, que d'autres
branches touchent, et ces fichiers seraient tous devenus « modifiés » pour la voie rapide de cette PR.
Le socle est donc une liste (fichier et début exact du titre), lue par `playwright.config.ts`
(`E2E_SOCLE=1`). Deux garde-fous : `lib/parcours-socle.test.ts` vérifie que chaque titre existe dans
son fichier, et la voie rapide vérifie que Playwright sélectionne exactement un parcours par entrée
et par projet.

### Parcours « rattachés aux zones touchées » : non fait

Pas de règle simple et fiable : les noms des fichiers de parcours mêlent identifiants d'exigences
(`dev-01`, `imp-03`, `hub-14`) et numéros de lot (`lot-72b`), et un module touché (`modules/events`)
sert à des dizaines d'écrans et de fichiers. Une table « dossier → fichiers » serait à tenir à la main,
se tromperait sans le dire, et ferait souvent sortir la voie rapide de ses 15 minutes. Le filet reste
la suite complète sur `main` après la fusion, et l'étiquette `suite-complete` pour une PR à risque.
La voie rapide **avertit** (résumé et annotation) quand une PR touche les outils communs des parcours
(`e2e/*.ts` hors parcours, `playwright.config.ts`) : ils servent à toute la suite.

## 3. Ce qui ne change pas

- Les autres contrôles de chaque PR, tels quels : lint, types, tests unitaires et couverture,
  frontières, registre RGPD, traductions, shellcheck, isolation RLS et services réels, Semgrep,
  Gitleaks, OSV-Scanner, image et Trivy, Factur-X (veraPDF, Mustang).
- Aucun parcours supprimé, aucun seuil relevé (NFR-01 : 2,5 s ; NFR-02 : 300 ms ; recherche :
  500 ms ; trois séries, médiane, ADR 0114 et 0078), un seul worker par job.
- L'image n'est publiée sur GHCR (`publish-image`) qu'après **toute** la suite verte sur `main` ; or
  `deploy.sh` tire l'image du commit : un commit dont la suite complète n'est pas verte n'a pas
  d'image, donc ne se déploie pas (§ 5).
- Les noms des jobs : `e2e` garde son identifiant ; seuls les libellés de la matrice changent
  (« part 1 sur 4 »…). `main` n'a pas de protection de branche (vérifié le 28/11/2026 :
  `gh api …/branches/main/protection` répond 404), aucun contrôle exigé n'est donc renommé.

## 4. Risques

| Risque | Parade |
| --- | --- |
| `main` passe au rouge après une fusion (un parcours hors du socle cassé par la PR) | **Accepté par Julien tant que rien n'est en production** : se corrige aussitôt, par une PR. La suite de nuit le rappelle. |
| Un parcours instable rougit `main` sans lien avec la PR | Le signaler (ce qu'il fait, à quelle part), ne pas le masquer ; les reprises (`retries: 2`) restent. |
| Le socle fond en silence (titre renommé) | Test `parcours-socle.test.ts` et décompte vérifié par la voie rapide. |
| Les mesures, réchauffées autrement, ne sont plus comparables | Mesurées sur cette PR (§ 6) et comparées à main (229 ms le 28/11/2026, 6c8f2b5c ; 220 ms à l'ADR 0115). |
| Une étiquette ajoutée à une PR relance toute sa CI (`labeled`) | Rare ; coût d'une exécution. |
| Les caches de Next encombrent le cache de GitHub et évincent celui de Mustang (lot 75) | Écrit par un seul job, sur `main` seulement ; une éviction ne fait que retélécharger Mustang (avec ses nouvelles tentatives). |

## 5. Avant le premier déploiement réel

La contrepartie ne vaut que tant que rien n'est en production. **Avant le premier déploiement réel,
la suite complète doit redevenir obligatoire avant le déploiement** (ADR 0124, § Condition) :

- C'est déjà vrai par construction : l'image d'un commit n'est publiée que si la suite complète est
  verte, et `deploy.sh` refuse un commit sans image (« image introuvable »). La condition tient tant
  que `publish-image` dépend du job `e2e` de la suite complète : ne jamais l'en détacher, ne jamais
  publier une image à la main.
- `docs/runbooks/deploiement.md` le dit : vérifier sur GitHub que la CI du commit à déployer est verte
  **en entier** (quatre parts, navigateurs, mesures).
- Option à trancher par Julien avant la production : protéger `main` en exigeant la suite complète
  **avant** la fusion (étiquette `suite-complete` obligatoire, ou file de fusion), si `main` rouge
  devient gênant. `deploy.sh` pourrait aussi vérifier lui-même le statut de la CI du commit (appel à
  l'API de GitHub) ; non fait ici (hors périmètre), signalé dans la PR.

## 6. Critères de réussite (mesurés en CI, rapportés dans la PR)

1. Sur la PR du lot, la voie rapide (job « Parcours bout en bout (voie rapide…) ») est **verte en
   moins de 15 min**, préparation comprise.
2. Une suite complète **verte** sur la branche du lot (étiquette `suite-complete`), avec la durée de
   chacune des quatre parts (cible : 25 min environ chacune, toutes sous leur limite de 55 min), du
   job des navigateurs et du job des mesures.
3. Le job des mesures tourne sur la PR, dans la même cible de 15 min, avec son tableau des marges
   dans le résumé ; il donne pour NFR-02 une valeur **comparable** à celle de main (229 ms le 28/11 ;
   comparable = dans la même plage que les dernières exécutions de main, 210 à 250 ms) ; aucun seuil
   n'est relevé.
4. Les tests `plan-parcours.test.mjs`, `ci-pipeline.test.mjs` et `parcours-socle.test.ts` passent.

## 7. Suite possible (hors périmètre) : plusieurs workers dans un job

Aujourd'hui un job ne joue qu'un parcours à la fois, parce que chaque connexion passe par un lien
envoyé par Mailpit et un passage chez Logto, et que les parcours en parallèle se gênaient (lot 33).
Une voie sûre serait de **connecter une fois par compte** : un projet Playwright « préparation »
(`dependencies`) ouvre les sessions des comptes de test et les enregistre (`storageState`), et les
parcours qui ne testent pas la connexion elle-même les reprennent. Les parcours de connexion
(SEC-07, HUB-01, liens des tiers) resteraient en série. Il faudrait aussi que chaque parcours crée
ses propres données (c'est déjà le cas, par `atelier`) et que les mesures restent seules. À mesurer
avant d'y aller : le gain dépend de la part du temps passée dans la connexion.
