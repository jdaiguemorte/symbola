# ADR 0075 — Déploiement et retour arrière en une commande, migrations compatibles, licences et installation contrôlées

- Statut : accepté (lot 40a, décisions D2 à D8 validées par Julien le 17/11/2026)
- Date : 2026-11-17
- Remplace : [0058](0058-fenetre-de-deploiement-regle-ecrite.md) (fenêtre de déploiement écrite,
  appliquée à la main).
- Complète : [0036](0036-migrations-annulables.md) (migrations annulables),
  [0051](0051-sauvegarde-externe-hetzner.md) (sauvegardes), [0060](0060-journal-d-audit-commun.md)
  (journal d'audit et accès d'exploitation), [0016](0016-isolation-reseau-staging-production.md)
  (staging isolé, aux données fictives).
- Exigences : NFR-07, SEC-28, ARC-14, DAT-10, NFR-23 et JUR-18 de `docs/CAHIER_DES_CHARGES.md` ;
  spécification `docs/lots/lot-40-exploitation-mesures.md` (partie 40a).

## Contexte

Le pilote se déployait à la main : changer le tag de l'image dans `.env.<environnement>`, lancer
les migrations dans un conteneur, redémarrer l'app. La fenêtre de déploiement (pas de mise en
production du vendredi midi au lundi matin) était une règle écrite (ADR 0058) ; le contrôle du
durcissement se lançait à part ; revenir en arrière demandait plusieurs commandes et supposait des
migrations compatibles avec le code précédent, que rien ne vérifiait. Il n'y avait ni inventaire des
licences, ni guide d'installation, ni chargement du jeu fictif sur le staging.

## Décision

1. **Déployer en une commande** : `infra/server/deploy.sh <staging|production> <sha>`, lancé par
   Julien sur le VPS. Dans l'ordre : fenêtre, contrôle du durcissement, sauvegarde, dépôt avancé au
   commit (qui doit être sur `main`), image, migrations, démarrage et sonde de santé du Compose,
   journal. La version précédente est notée (`/var/lib/symbola/deploy/<env>.previous`).
2. **Fenêtre (NFR-07)** : en production, refus du vendredi 12 h au lundi 8 h, heure de Paris
   (changements d'heure compris, jours fériés non comptés). `--urgence="motif"` passe outre ; le
   motif (sans donnée personnelle, contrôlé comme celui des accès d'exploitation) va au journal
   d'audit commun (`ops.deploy.completed`) et au journal du serveur
   (`/var/log/symbola/deploiements.log`). Le staging n'est pas concerné.
3. **Durcissement (SEC-28)** : `check-hardening.sh` est rejoué à chaque déploiement ; un ÉCHEC
   l'arrête avant toute autre étape, sauf `--urgence` (le correctif d'une faille ne doit pas
   attendre qu'un contrôle sans rapport repasse au vert). Une sauvegarde en échec l'arrête toujours.
4. **Retour arrière en une commande (ARC-14)** : `infra/server/rollback.sh <env>` remet l'image
   de la version précédente et attend la sonde de santé, sans toucher au schéma. `deploy.sh` le
   fait de lui-même quand la nouvelle version ne répond pas. Le retour arrière n'attend pas la
   fenêtre : revenir à une version qui a tourné est le geste du week-end. Annuler une migration
   reste un geste à part, après une sauvegarde (`restauration.md`, § 4 bis).
5. **Migrations compatibles (ARC-14)** : une migration n'ajoute que des tables, des colonnes
   facultatives ou avec une valeur par défaut, des index, des contraintes et des valeurs. Le test
   `packages/db/src/migration-compatibility.test.ts` lit le texte de chaque nouvelle migration et
   refuse suppression, renommage, changement de type et colonne rendue obligatoire, sauf marqueur
   `-- symbola: arret-requis <raison>` et paragraphe du runbook de déploiement qui la cite.
   `pnpm --filter @symbola/db migrate:plan` liste les migrations en attente ; si l'une demande
   l'arrêt, `deploy.sh` arrête l'app le temps des migrations (quelques secondes). Les migrations
   0000 à 0148, livrées avant la règle, ne sont pas contrôlées en CI ; le détecteur en relève
   douze avec un changement cassant (dont 0132, 0133 et 0135, les trois que le runbook signalait) :
   elles demandent l'arrêt quand elles restent à appliquer, comme au déploiement d'ensemble.
6. **Jeu fictif sur le staging (DAT-10)** : `infra/server/recette.sh staging`, par le chargeur
   de l'app ; il refuse la production (ADR 0016), et le chargeur refuse une base déjà chargée.
7. **Installation en trente minutes (NFR-23)** : `docs/INSTALLATION.md`, rejoué tel quel par le
   workflow « Installation » sur une machine neuve de la CI (blocs de commandes balisés,
   chronométrés ; échec au-delà de trente minutes), à chaque version majeure, à chaque changement du
   guide ou du socle, et à la demande.
8. **Licences (JUR-18)** : `tools/licences` lit `pnpm licenses list` (sans dépendance nouvelle) et
   les images du Compose et des scripts. Une licence permissive passe ; une licence à copyleft doit
   avoir sa ligne justifiée (`autorisees.json`) ; une licence inconnue, un service sans ligne ou une
   ligne périmée font échouer `pnpm test`. `pnpm --filter @symbola/tools-licences inventaire` écrit
   `docs/conformite/licences.md`, qui liste aussi les points à faire valider par l'avocat.

## Conséquences

- NFR-07, SEC-28 et ARC-14 passent à Conforme ; NFR-23 et JUR-18 aussi (JUR-18 avec des points à
  faire valider par l'avocat) ; DAT-10 couvre le staging.
- Le premier déploiement par `deploy.sh` note la version précédente seulement si le tag en place est
  un SHA : un `APP_IMAGE_TAG=latest` ne permet pas de retour arrière.
- `deploy.sh` s'exécute en root (sudo) : root peut toujours contourner la fenêtre ou le contrôle à
  la main. Comme pour les accès d'exploitation (ADR 0060), le runbook demande de passer par le
  script, et ce qui passe par lui est tracé.
- La fenêtre et l'heure sont lues sur l'horloge du serveur ; `SYMBOLA_DEPLOY_NOW` ne sert qu'aux
  tests.
- Le contrôle des migrations lit du texte : une mise à jour de données que l'ancien code ne
  comprend plus (des valeurs renommées par un `UPDATE`, par exemple) reste à signaler par son
  auteur, par le marqueur.
- Les scripts sont testés avec des doublures (`tools/deployment-config/deploy.test.mjs`) ; leur
  première exécution réelle sera le déploiement d'ensemble, par Julien, d'abord sur le staging.
