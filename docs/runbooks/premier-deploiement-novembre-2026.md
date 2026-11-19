# Check-list — premier déploiement après le gel (novembre 2026)

Pour Julien. C'est le premier déploiement depuis le gel du 11/11. Il emporte les lots 22 à 60 (sauf
42, 54, 55, 57, 59) et les migrations jusqu'à la dernière de `main`. Tout se fait sur le VPS,
depuis la session `julien` (`ssh symbola`). Le détail de chaque étape est dans
`docs/runbooks/deploiement.md` (cité en « § ») et `docs/runbooks/restauration.md`.

**Ordre** : staging complet, recette, puis production dans la fenêtre (du lundi 8 h au vendredi
12 h). Partout, `$ENV` vaut `staging`, puis `production`.

Aucune valeur secrète n'est écrite ici. Chaque secret généré va **d'abord** dans le gestionnaire
de mots de passe, puis dans `infra/compose/.env.$ENV`.

---

## 0. Avant de commencer (une fois)

- [ ] **Tous les lots voulus sont fusionnés** dans `main` (58 et 60 compris), et la CI de `main`
      est verte. Noter le **SHA complet** du dernier commit de `main` : c'est le tag de l'image.
- [ ] **Copies instantanées hors d'atteinte du VPS** (NFR-13, à faire avant la première donnée
      réelle), si ce n'est pas déjà fait à la phase C du lot 22 :
      `sudo /opt/symbola/infra/backup/check-snapshot-protection.sh staging --confirm=staging`
      (`restauration.md`, § 7).
- [ ] **Dépôt à jour** : `cd /opt/symbola && sudo git pull` (depuis `julien`, jamais depuis
      `sudo -i`).

## 1. Secrets nouveaux de l'environnement ($ENV)

Pour chacun, il faut le générer, le ranger dans le gestionnaire, l'écrire dans
`infra/compose/.env.$ENV`, puis vérifier avec `sudo grep -c '^NOM=.\+' infra/compose/.env.$ENV`
(réponse attendue : 1).

- [ ] `DATA_ENCRYPTION_KEY` (`openssl rand -base64 32`), **différente** de `MFA_ENCRYPTION_KEY`.
      **Perdue, les données chiffrées sont perdues** : IBAN, régimes, notes confidentielles,
      agendas. La sauvegarde ne contient pas la clé (§ « Socle des lots 46 et 49 »).
- [ ] `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` :
      `node /opt/symbola/apps/symbola/scripts/generate-vapid-keys.mjs` (§ « Lot 53 »).
- [ ] `LOGTO_DB_PASSWORD` et `LOGTO_M2M_SECRET` (`openssl rand -hex 32` chacun), si Logto n'est pas
      encore en service sur cet environnement (§ « Fournisseur d'identité », étape 2).
- [ ] Facultatif : `GLITCHTIP_DB_PASSWORD`, `GLITCHTIP_SECRET_KEY`, et `erreurs` dans
      `COMPOSE_PROFILES`, pour le suivi des erreurs (§ « Suivi des erreurs »). Sans eux, les erreurs
      restent au journal du conteneur.
- [ ] Comparer les clés de `.env.$ENV` à `infra/compose/.env.$ENV.example` à jour : aucune clé du
      modèle ne doit manquer.

## 2. Sauvegarde : 35 jours (ADR 0092)

- [ ] Dans `/etc/symbola/backup/$ENV.env`, remplacer les lignes `KEEP_DAILY`, `KEEP_WEEKLY` et
      `KEEP_MONTHLY` par `KEEP_WITHIN=35d`.
- [ ] **À savoir** : la prochaine sauvegarde effacera d'un coup les copies de plus de 35 jours.
      C'est voulu, et c'est sans retour. Pour garder une ancienne copie, la mettre à part avant.

## 3. Logto, le fournisseur d'identité : avant la mise à jour de l'app

Sans Logto, personne ne se connecte. Si Logto tourne déjà sur l'environnement, passer
directement à l'étape « Régler Logto ».

- [ ] **DNS** chez le registraire : `connexion.staging.symbola.fr` (puis `connexion.symbola.fr`)
      vers l'adresse du VPS.
- [ ] **Base dédiée** : relancer le bootstrap (§ « Fournisseur d'identité », étape 3).
- [ ] **Démarrer Logto** (étape 4).
- [ ] **Caddy** : ajouter le bloc `LOGTO_DOMAIN` → `symbola-logto-$ENV:3001`, recharger, puis
      vérifier le `curl …/oidc/.well-known/openid-configuration` (étape 5).
- [ ] **Régler Logto** avec `configure-identity` (étape 6). Rejouable, cette commande ajoute aussi
      le webhook du lot 52 (alertes de changement d'e-mail).

## 4. Déployer l'app

- [ ] `sudo /opt/symbola/infra/server/deploy.sh $ENV <sha>`. Le script s'arrête au premier problème
      et le dit. Il enchaîne :
  - le contrôle du durcissement ;
  - **une sauvegarde avant tout** ;
  - le dépôt mis au commit ;
  - l'image ;
  - les migrations : il arrête `symbola` le temps de celles qui l'exigent (0130, 0132, 0135, 0176,
    etc.). La 0176 chiffre l'IBAN de la planner et demande `DATA_ENCRYPTION_KEY` ;
  - le démarrage et la sonde de santé ;
  - **le retour automatique** à l'ancienne version si la nouvelle ne répond pas.
- [ ] Lire `/var/log/symbola/deploiements.log` : la ligne « Nouvelle version installée » doit y
      être.

## 5. Comptes (une fois par environnement)

- [ ] **Reprise des comptes** existants vers Logto : `migrate-accounts` (§ « Fournisseur
      d'identité », étape 8).
- [ ] **Compte d'exploitation**, si l'environnement n'en a pas encore :
      `create-account -- --role admin --email <ton-e-mail>` (§ « Premiers comptes »). La double
      authentification est installée à la première connexion.
- [ ] **Organisation de ta compagne** (production) : depuis `/exploitation`, l'inviter, ou utiliser
      `create-account -- --role owner …` si les e-mails ne partent pas encore.
- [ ] **Modules fermés par défaut**, à ouvrir depuis `/exploitation` si tu le veux :
  - Rendez-vous ;
  - Plans de salle ;
  - **Invités** : seulement après l'analyse d'impact (Q38, avis de la DPO).

## 6. Vérifications après déploiement

- [ ] `https://<APP_DOMAIN>/health` répond avec le bon SHA.
- [ ] En-têtes de sécurité (`curl -sI … | grep -Ei "content-security-policy|strict-transport|x-frame|referrer"`).
- [ ] Isolation staging ↔ production (§ « Vérifier l'isolation »).
- [ ] Une sauvegarde manuelle passe : `sudo systemctl start symbola-backup@$ENV.service`.
- [ ] Uptime Kuma : une sonde sur l'app et une sur `connexion.<domaine>`.

## 7. Recette rapide (staging, puis un passage en production)

- [ ] Staging : charger le jeu fictif (`sudo /opt/symbola/infra/server/recette.sh staging`).
- [ ] Se connecter par lien magique, puis avec la double authentification.
- [ ] Créer un prospect, puis un devis : proposition, signature, écran « Régler l'acompte » avec le
      RIB et la référence.
- [ ] Ouvrir un portail client par lien.
- [ ] Mode Jour J : « Maintenant », un pointage, un incident.
- [ ] Un export comptable du mois.
- [ ] Notifications : la cloche dans l'application, et le récapitulatif du lendemain matin.

## 8. Production

- [ ] Recommencer les étapes 1 à 6 avec `ENV=production`, avec des **secrets propres à la
      production**, jamais ceux du staging, et **pendant la fenêtre**.
- [ ] Aucune donnée fictive en production : `recette.sh` la refuse.

## En cas de problème

- **La nouvelle version ne répond pas** : le script remet seul l'ancienne.
- **Un problème découvert après coup** :
  `sudo /opt/symbola/infra/server/rollback.sh $ENV --motif="…"`. Le schéma reste compatible avec
  la version précédente.
- **Revenir avant le lot 33** (connexion par mot de passe) : c'est impossible par un simple retour.
  Il faut **restaurer la sauvegarde prise juste avant le déploiement** (`restauration.md`), en
  perdant ce qui a été saisi depuis.

## Rappels de Julien (décisions assumées)

- **Données réelles avant la création de la société** : l'avocat demandait la société d'abord
  (réponse 8). Tu l'assumes ; à régulariser.
- **Clause de réversibilité** des conditions de l'éditeur : à écrire à la création de la société.
