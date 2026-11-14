# Lot 33 — Identité déléguée, inscription libre et démarrage

**Statut** : spécification **validée par Julien le 13/11/2026** (« Oui, je valide » : D1 à D12 en
(a), dépendances comprises ; aucune donnée réelle en production, pour D3).
33a fait le 14/11/2026 (bilan après la partie G) ; 33b à faire.
Branche `lot-33-identite`, partie de `main` après le lot 32 (PR #112).

## Contexte

Phase 1 du plan (`docs/GAP_REPORT.md` § 7 et § 9) : fermer les parcours P0. Le lot 33 ferme
**PAR-01 « Démarrer : de l'inscription au premier évènement prêt »** et ses deux scénarios, qui
bloquent aujourd'hui dès l'étape 1 :

- **SC-01 « Le premier quart d'heure »** : Camille s'inscrit avec son e-mail, répond au
  questionnaire, reconnaît ses catégories, crée le mariage de Léa et Maxime, ouvre le
  rétroplanning et le budget, commence un devis, puis retrouve tout sur son téléphone. Mesures :
  moins de dix minutes, aucun champ bloquant.
- **SC-10 « Quinze ans de contacts »**, étape 1 : Sophie s'inscrit et répond au questionnaire à
  150 %. Les étapes 2 à 5 (import, aide guidée) sont déjà couvertes par les lots 7, 10 et 13.

Il porte aussi trois décisions du 11 novembre (`docs/QUESTIONS.md`) :

- **Q3 b** : bascule vers un fournisseur d'identité open source (ADR 0052) ;
- **Q5 a** : inscription libre dès le pilote ;
- **Q30** : renommer le rôle d'exploitation, pour ne pas le confondre avec l'« Administrateur »
  d'une organisation (HUB-03).

Cibles visuelles : `docs/maquette/` (écrans « Questionnaire d'accueil » et « Votre espace est
prêt »).

**Exigences** (toutes P0) :

| ID | Exigence | Critère | État (`docs/gap.csv`) |
| --- | --- | --- | --- |
| SEC-01 | Authentification déléguée à un fournisseur d'identité éprouvé. Le code de Symbola ne stocke aucun mot de passe. | Aucune table de mots de passe dans les schémas des apps. | Absent : hachés argon2id dans `hub.users` |
| HUB-01 | Inscription par e-mail avec lien de confirmation. Connexion par lien magique, mot de passe ou clé d'accès. | Un compte se crée avec une seule donnée : l'adresse e-mail. | Partiel : compte créé sur invitation de l'Admin ; ni lien magique ni clé d'accès |
| SEC-07 | Lien magique de connexion à usage unique, valable quinze minutes. | Un lien rejoué est refusé. | Sans objet tant qu'il n'y a pas de lien magique |
| HUB-02 | Une organisation est créée à l'inscription. Un utilisateur peut appartenir à plusieurs organisations et passer de l'une à l'autre. | Les données de deux organisations ne se croisent jamais. | Partiel : une seule organisation par utilisateur, créée par l'Admin |
| HUB-03 | Rôles Propriétaire, Administrateur, Planner, Assistant, Comptable. | Propriétaire et Planner au MVP, les autres en V1. | Partiel : pas de parcours d'ajout d'une Planner |
| HUB-09 | Questionnaire d'accueil : métier, types d'évènements, régime de TVA, volume, outils remplacés. | Les réponses choisissent les modèles chargés. Tout reste modifiable. | Partiel : ni volume ni outils remplacés |
| HUB-10 | Données de démonstration étiquetées, exclues des statistiques, supprimées d'un clic ou proposées à la suppression au premier évènement réel. | Aucun envoi possible vers un tiers réel depuis une donnée de démonstration. | Partiel : pas d'exemple proposé à l'inscription ; blocage des envois non prouvé |
| PAR-01 | Démarrer : de l'inscription au premier évènement prêt. | Moins de dix minutes, aucun champ obligatoire sans valeur par défaut, aucun appel à l'aide. | Partiel : étape 1 absente |
| UX-04 | De la valeur en dix minutes. | Un nouvel inscrit obtient un évènement prêt et un devis en brouillon en moins de dix minutes. | Partiel : durée jamais mesurée |

## Ce qui existe aujourd'hui

- **Authentification maison** derrière `packages/auth` (ADR 0013) :
  - mots de passe en argon2id, règle et refus des mots de passe compromis (lot 24b, ADR 0063) ;
  - double authentification exigée pour tous les comptes professionnels, secret chiffré (ADR 0037) ;
  - appareil de confiance pendant 90 jours (ADR 0038) ;
  - verrouillage après cinq échecs, mot de passe oublié par lien de 30 minutes ;
  - session opaque en base (`hub.sessions`), cookie `symbola_session`, huit heures glissantes.
- **Un utilisateur = une organisation** : `hub.users.organization_id` et `hub.users.role`
  (`owner`, `member`, `admin`). L'Admin crée l'organisation et invite la titulaire.
- **Assistant de démarrage** en sept étapes (lot 12) : types d'évènements, société, TVA,
  documents, postes de budget… Les menus métier restent verrouillés jusqu'à la fin.
- **Données d'essai** `is_demo` (ADR 0008), exclues et purgées, créées par les tutoriels.
- **Tests** : les 76 fichiers Playwright se connectent par `/login` avec mot de passe et code de
  double authentification, et créent leurs comptes par `createUser` avec un mot de passe.

Après la bascule, seul `packages/auth` change de fond (ADR 0052, point 4). Le reste de l'app lit
toujours une session Symbola : les gardes, le contexte d'organisation (RLS) et l'auteur des
écritures ne changent pas de forme.

## Découpage proposé (D1)

- **33a — Identité déléguée** : SEC-01, HUB-01, SEC-07, HUB-02, renommage du rôle d'exploitation
  (Q30), reprise des comptes. Parcours : inscription, connexion, changement d'organisation.
  SC-01, étape 1.
- **33b — Démarrer** : HUB-09, HUB-10, HUB-03, PAR-01, UX-04. SC-01 en entier et SC-10, étape 1.

## Lot 33a — Identité déléguée

### Partie A — Choisir le fournisseur (ADR 0052 ; D2)

Les critères sont ceux de l'ADR 0052. J'ai comparé cinq candidats sur leur documentation
officielle (sources en fin de document).

| Critère | Logto | Keycloak | Zitadel | authentik | Ory Kratos (+ Hydra) |
| --- | --- | --- | --- | --- | --- |
| Licence | MPL-2.0 (copyleft faible, par fichier) | Apache 2.0 | AGPL-3.0 depuis la v3 | MIT, sauf le dossier « enterprise » | Apache 2.0 |
| Lien magique (SEC-07) | Oui : jeton à usage unique créé par l'API, durée réglable, e-mail envoyé par Symbola | Non, sauf extension tierce | Non dans ses pages de connexion : il faudrait les écrire nous-mêmes | À composer avec ses « flux » (non vérifié) | Code à usage unique par e-mail, pas de lien |
| Clé d'accès | Oui, en premier facteur depuis mars 2026 | Oui (26.4) | Oui | Oui | Oui |
| Mot de passe et double authentification | Oui | Oui | Oui | Oui | Oui |
| Plusieurs organisations, rôles | Oui (non nécessaire, voir D6) | Oui (26) | Oui | Groupes | Non |
| Pages fournies | Oui, en français, à nos couleurs par feuille de style | Oui, par thèmes | Oui (service à part en v4) | Oui | Non : toutes à écrire |
| Base | PostgreSQL seul | PostgreSQL | PostgreSQL seul | PostgreSQL (plus de Redis) | PostgreSQL |
| Import des hachés argon2id | Argon2i seulement documenté | Possible, peu documenté | Oui, à activer | Non vérifié | Oui (format PHC) |
| Langage, empreinte | Node.js, comme l'app | Java, le plus lourd | Go, léger | Python, serveur et worker | Go, léger, mais deux services |

**Recommandation : (a) Logto**, sous réserve d'un **prototype d'une demi-journée** en local avant
l'ADR. Raisons :

- c'est le seul candidat qui offre à la fois un lien magique sans code à écrire, la clé d'accès,
  le mot de passe et la double authentification ;
- c'est Symbola qui envoie le lien, avec ses propres e-mails en français et en anglais (Mailpit
  en dev) et une durée de quinze minutes (SEC-07) ;
- sa licence MPL-2.0 n'oblige à rien si on l'utilise sans le modifier (JUR-18) ;
- il tient dans une base dédiée du PostgreSQL existant, comme Documenso.

Le prototype doit vérifier, sinon je reviens vers toi avec Keycloak :

1. le lien magique : usage unique, quinze minutes, rejeu refusé ;
2. la clé d'accès et la double authentification dans ses pages, en français ;
3. l'inscription d'une adresse inconnue par le lien magique ;
4. la mémoire occupée sur le VPS ;
5. le refus des mots de passe compromis sans appel sortant (Q22) ;
6. une configuration en une commande, sans clic dans sa console, pour le dev, la CI et le
   staging ;
7. la preuve de double authentification dans le jeton (pour D4).

Le comparatif et le choix sont écrits dans l'**ADR 0067**, qui complète l'ADR 0052. Les ADR 0013,
0037 et 0038 passent à « remplacé » à la bascule.

### Partie B — Le service sur le VPS (NFR-27)

- **Conteneur** de plus dans `docker-compose.prod.yml` (profil `identite`) et dans
  `docker-compose.dev.yml`. Limites mémoire et processeur obligatoires (ADR 0016).
- **Base dédiée** dans le PostgreSQL existant, créée par `pnpm --filter @symbola/db bootstrap`,
  comme Documenso.
- **Sauvegarde** : `infra/backup/backup.sh` et `restore.sh` prennent cette base, comme celle de
  Documenso. Les tests de `tools/deployment-config` le vérifient.
- **Adresse publique** : un sous-domaine par environnement (par exemple `connexion.` et
  `connexion-staging.`), servi par le Caddy partagé. **Les enregistrements DNS et les secrets
  sont tes gestes**, décrits dans le runbook.
- **Console d'administration du fournisseur** : jamais exposée publiquement. On y accède par un
  tunnel SSH.
- **Surveillance** : une sonde Uptime Kuma de plus (ton geste, runbook).

### Partie C — Inscription et connexion (HUB-01, SEC-07 ; D4, D5, D8)

- **S'inscrire** (`/inscription`) : une seule donnée, l'adresse e-mail. Symbola envoie un lien de
  confirmation.
  - **Valeurs** : usage unique, quinze minutes.
  - **Au clic** : le compte naît chez le fournisseur, puis Symbola crée l'organisation (nom
    provisoire « Mon atelier », modifiable) et l'adhésion de Propriétaire, et ouvre le
    questionnaire (33b).
  - **Rien n'est créé tant que le lien n'est pas confirmé.**
- **Se connecter** (`/login`) :
  - « Recevoir un lien de connexion » (lien magique, quinze minutes, usage unique) ;
  - ou « Mot de passe ou clé d'accès », qui ouvre la page du fournisseur.
- **Réponse identique** pour une adresse connue ou inconnue (SEC-13). Débit limité par adresse et
  par IP (`lib/rate-limit.ts`), piège à robots (`lib/honeypot.ts`), plafond d'envois (lot 24b).
- **Session** : après l'échange OpenID Connect (flux « code » avec PKCE), Symbola ouvre sa propre
  session opaque, comme aujourd'hui. Le cookie, le middleware, l'expiration de huit heures et
  « déconnecter tous les appareils » ne changent pas. La déconnexion ferme aussi la session chez
  le fournisseur.
- **Retirés de Symbola** :
  - mot de passe, mot de passe oublié, verrouillage ;
  - double authentification, appareils de confiance ;
  - pages `/mfa`, `/mot-de-passe`, `/mot-de-passe-oublie`.

  Le fournisseur s'en charge, et le profil renvoie vers sa page de compte.

### Partie D — Plusieurs organisations (HUB-02 ; D6)

- **Adhésions** : nouvelle table `hub.memberships` (utilisateur, organisation, rôle). Elle
  remplace `hub.users.organization_id` et `hub.users.role`.
- **Organisation active** : elle est portée par la session (`hub.sessions.organization_id`) et
  contrôlée à chaque requête. Une adhésion retirée coupe l'accès à la requête suivante.
- **Contexte RLS inchangé** : `SET LOCAL app.organization_id` reçoit l'organisation active.
- **Changer d'organisation** : un sélecteur dans le menu, si l'on en a plusieurs.
  « Créer une autre organisation » ouvre son propre questionnaire.
- **Tests d'abus** :
  - passer sur une organisation sans adhésion est refusé, avec la même réponse qu'une
    organisation inexistante ;
  - une adhésion retirée coupe l'accès dans la requête qui suit.

### Partie E — Rôle d'exploitation (Q30 ; D7)

- « Admin » devient **« Exploitation »** :
  - libellés ;
  - code : valeur `operator`, garde `requireOperator` ;
  - adresses : `/admin` devient `/exploitation`.
- Le compte d'exploitation n'a aucune adhésion et toujours aucun accès aux données métier
  (SEC-09, ADR 0029). La double authentification lui est exigée.
- « Administrateur » reste réservé au rôle d'organisation de HUB-03 (V1).

### Partie F — Reprise des comptes et retrait des mots de passe (SEC-01 ; D3)

- **Script de reprise** (`pnpm --filter @symbola/auth migrate-accounts`), lancé par toi sur le
  VPS. Pour chaque compte actif, il crée l'utilisateur chez le fournisseur (adresse vérifiée),
  puis note son identifiant (`hub.users.idp_subject`). Il est rejouable sans doublon.
- **Première connexion** par lien magique. La double authentification se réinstalle chez le
  fournisseur.
- **Deux migrations** :
  - la première ajoute ;
  - la seconde retire les mots de passe, les secrets de double authentification, les compteurs
    de verrouillage, `hub.password_resets` et `hub.trusted_devices`.

  La seconde refuse de s'appliquer tant qu'un compte actif n'a pas d'identifiant chez le
  fournisseur.
- **Annulation** : elle recrée les colonnes vides. Les hachés et les secrets ne reviennent pas ;
  c'est voulu (SEC-01), et je l'écris dans le runbook.

### Partie G — Les tests

- **Un seul assistant de connexion pour Playwright** (`e2e/helpers.ts`). Il demande le lien et le
  lit dans Mailpit. Les 76 fichiers l'appellent, au lieu du formulaire « mot de passe et code ».
- **Le fournisseur tourne dans la CI** : job `e2e`, base dédiée, configuration en une commande.
- **Création des comptes de test** par une fabrique de `packages/testing`, qui crée l'utilisateur
  chez le fournisseur et l'adhésion. Jamais de route d'essai dans l'app.
- **Tests de SEC-07 à l'horloge simulée** : lien rejoué, lien à 14 min 59 s et à 15 min 01 s,
  lien d'une autre adresse.

### Bilan du lot 33a (14/11/2026)

**Fait** :
- **Logto 1.46.0 sur le VPS** (ADR 0067, NFR-27) : service des Compose de dev et de production,
  base dédiée créée par le bootstrap, console en boucle locale seulement, journaux tournants
  (2 × 5 Mo), limites de mémoire et de processeur. `configure-identity` le règle en une commande
  rejouable : application de Symbola, e-mails, expérience de connexion (mots interdits, verrou
  après cinq échecs pour quinze minutes), centre de compte. Sa base part dans la sauvegarde
  nocturne ; la restauration recrée ses rôles et a été rejouée sur un PostgreSQL vierge.
- **Inscription et connexion** (HUB-01, SEC-07 ; D5, D8) :
  - `/inscription` et `/login` demandent un lien, avec la même réponse pour une adresse connue
    ou inconnue ; débit limité à 20 demandes par adresse IP et 5 par adresse e-mail sur quinze
    minutes ;
  - le lien est un jeton à usage unique de quinze minutes créé par Logto, scellé et envoyé par
    Symbola, dans la langue de l'écran ; il est émis pour l'adresse exacte que Logto connaît,
    casse comprise ;
  - « Se connecter avec un mot de passe ou une clé d'accès » mène aux pages de Logto, par
    demande poussée (PAR) ;
  - au retour, Symbola ouvre sa session opaque ; un nouveau compte arrive sur `/demarrage` avec
    son organisation provisoire, « Mon atelier » ;
  - la déconnexion ferme aussi la session chez Logto.
- **Double authentification** (D4) : titulaires et Exploitation l'ont obligatoire chez Logto
  (`mfa.required`) ; Symbola vérifie à chaque connexion qu'elle a eu lieu (`acr`) et, sinon,
  renvoie vers `/securite`. L'Exploitation la réinitialise par l'API de Logto.
- **Plusieurs organisations** (HUB-02 ; D6) : table `hub.memberships` (titulaire, Planner),
  organisation active portée par la session, bascule par le menu du compte.
- **Rôle d'exploitation** (Q30 ; D7) : « Admin » devient « Exploitation », `/admin` devient
  `/exploitation`, le compte porte le marqueur `operator`.
- **Reprise des comptes et retrait des mots de passe** (SEC-01 ; D3) : `migrate-accounts` relie
  les comptes existants à Logto (rejouable). La migration 0130 retire mots de passe, secrets de
  double authentification, compteurs, `hub.password_resets` et `hub.trusted_devices`. Les
  invitations ne demandent plus de mot de passe. Code retiré : mots de passe, TOTP, codes de
  secours, appareils de confiance, commande `mfa-secrets`, dépendances `@node-rs/argon2` et
  `otpauth` (ce dernier reste en dépendance de développement de l'app, pour les parcours de
  test). Dépendance ajoutée : `openid-client` 6.9.0 (ADR 0067).
- **Journal d'activité** : une connexion se lit « par le service de connexion » ou « avec double
  authentification » ; les méthodes d'avant restent lisibles dans l'historique.
- **Tests** : 42 tests unitaires dans `@symbola/auth` et 21 d'intégration ; 163 d'intégration
  dans `@symbola/db` (dont les annulations de 0129 et 0130) ; 481 unitaires et 579 d'intégration
  dans l'app. Parcours : les 70 fonctions de connexion passent par le lien et Mailpit ; nouveau
  parcours `sec-01-07-connexion` ; suite complète rejouée sur une base rechargée, ordinateur et
  375 px : 265 réussis, 1 ignoré (prévu, taille ordinateur seulement). Lint, typecheck,
  frontières de modules : verts. Semgrep (règles par défaut) : aucune erreur. Gitleaks : les
  mêmes 12 faux positifs que sur `main`, aucun nouveau.
- **Rejeu** : SC-01, étape 1, dans `docs/recette/SC-01.md` (une seule donnée, 4 gestes).
- **Documentation** : ADR 0067 ; ADR 0013, 0037 et 0038 remplacés ; runbooks de déploiement (mise
  en service de Logto, premiers comptes, retour arrière) et de restauration ; registre RGPD ;
  sous-traitants ; `CLAUDE.md` ; `docs/gap.csv`.

**Écarts avec la spécification** :
- **0130 sans garde-fou** : la migration retire les colonnes sans attendre que chaque compte soit
  relié. Le garde-fou prévu aurait bloqué le déploiement d'ensemble ; un compte non relié l'est
  à sa première connexion, par son adresse, donc personne ne reste dehors.
- **Valeur interne `admin`** (D7) : elle reste dans le type des rôles et dans l'auteur des
  lignes du journal d'audit, qui est en ajout seul. Seuls les libellés et les adresses changent.
- **D4 par compte** : Logto ne sait pas exiger le second facteur pour un groupe ; Symbola le pose
  compte par compte (`mfa.required`), quand une titulaire ou l'Exploitation se connecte sans
  l'avoir, puis depuis `/securite`.
- **Grâce de la séance d'inscription** : une session ouverte dans les 60 s qui suivent la
  création du compte n'exige pas encore le second facteur ; il est demandé à la connexion
  suivante. Elle couvre aussi une titulaire créée par l'Exploitation qui se connecte dans la
  minute.
- **Échecs de connexion** : refus et verrous sont journalisés chez Logto, plus dans le journal
  d'activité de Symbola.
- **Adresse chez Logto** : la demande poussée n'empêche pas Logto d'écrire l'adresse et le
  jeton dans ses propres adresses et journaux ; rotation courte, inscrite au registre RGPD.
- **Mots de passe** : le contrôle de Logto (longueur, mots interdits) est moins strict que
  l'ancien ; mention « Powered by Logto » sur ses pages (ADR 0067).
- **Comptes de test** (partie G) : pas de fabrique dans `packages/testing`. Les comptes sont
  créés dans Symbola et reliés à Logto à leur première connexion ; le second facteur des
  titulaires est posé par l'API de Logto dans `e2e/helpers.ts`.

**Corrigé en passant** : l'alerte « même jour » (CRM-04, lot 32b) listait les évènements dans un
ordre variable ; les confirmés passent maintenant avant les options.

**Reste** :
- **33b** : questionnaire, « Votre espace est prêt », exemple, liste de prise en main, ajout
  d'une Planner ; SC-01 en entier et SC-10, étape 1.
- **Déploiement d'ensemble (Julien)** : enregistrements DNS `connexion.staging.symbola.fr` et
  `connexion.symbola.fr`, secrets `LOGTO_*`, mise en service de Logto (runbook de déploiement),
  migrations 0129 et 0130, puis `migrate-accounts` ; recette sur le staging.

## Lot 33b — Démarrer

### Partie H — Questionnaire d'accueil (HUB-09 ; D9, D11)

- **Cinq questions, une par écran**, en mots simples :
  1. métier ;
  2. types d'évènements ;
  3. régime de TVA ;
  4. nombre d'évènements par an ;
  5. outils à remplacer.

  Chaque question a une valeur par défaut, et « Passer » est toujours possible (UX-10).
- **Ce que les réponses déterminent** :
  - les modèles chargés (types, rétroplanning, postes de budget, catalogue, mentions) ;
  - l'ordre de la liste de prise en main : par exemple, « tableur » met « Importer vos contacts »
    en premier.

  Les listes de réponses sont des données traduisibles (`packages/starter-templates`), jamais des
  constantes.
- **Ce qui sort du démarrage** : société, SIRET, logo et documents ne sont plus demandés avant la
  valeur (PAR-01, « à éviter »). Ils vont dans la liste de prise en main et les réglages. Les
  menus ne sont plus verrouillés.

### Partie I — « Votre espace est prêt » et l'exemple (HUB-10, PAR-01 ; D10)

- **L'écran dit en clair ce qui a été préparé** : vos types d'évènements, N tâches de rétroplanning,
  N postes de budget, votre régime de TVA.
- **Deux chemins** : « Créer mon premier évènement » (nom, date, type ; le rétroplanning et le
  budget type apparaissent) ou « Explorer avec un exemple ».
- **L'exemple** est le mariage de référence, en données `is_demo` :
  - il est étiqueté « Exemple » partout ;
  - il est exclu des statistiques, exports et recherches ;
  - il se supprime d'un clic, et sa suppression est proposée à la création du premier évènement
    réel.
- **Aucun envoi vers un tiers réel depuis l'exemple** : e-mails, liens, signature et relances sont
  bloqués côté serveur, et un test le prouve pour chaque canal.

### Partie J — Liste de prise en main (PAR-01, étape 6)

- **Cinq actions** : logo, premier prestataire, premier devis, invitation du client, import des
  contacts.
- **Comportement** : chacune se coche d'elle-même quand elle est faite, et la liste disparaît une
  fois finie. Elle remplace les « premiers pas » actuels.

### Partie K — Ajouter une Planner (HUB-03 ; D12)

- **Invitation** : la Propriétaire invite une Planner par e-mail. Le lien est valable sept jours,
  à usage unique ; au clic, le compte naît si besoin et l'adhésion de Planner est créée.
- **Ce que fait chaque rôle** : la Planner a accès à tous les modules. La Propriétaire garde en
  plus l'équipe, le journal, le RGPD, l'archive comptable et les réglages de l'organisation,
  comme aujourd'hui.
- **Reste au lot 52 (HUB-04)** : le retrait existe déjà (lot 24b) ; le transfert de propriété et
  la liste des sessions y restent.

### Partie L — Rejeu

- **SC-01** en entier, sur un téléphone (375 × 812), chronométré.
- **SC-10**, étape 1, à 150 % de zoom.
- Résultats dans `docs/recette/SC-01.md` et `docs/recette/SC-10.md`.

## Décisions à prendre

- **D1 — Découpage.**
  - (a) 33a puis 33b, deux PR.
  - (b) Deux parties, une seule PR à la fin, comme le lot 32.

  **Recommandation : (a).** Le 33a change chaque connexion et la CI : relu seul, il est plus sûr.

- **D2 — Fournisseur.**
  - (a) Logto.
  - (b) Keycloak.
  - (c) Zitadel.
  - (d) authentik.
  - (e) Ory Kratos et Hydra.

  **Recommandation : (a)**, après le prototype de la partie A. Si un critère échoue, je reviens
  vers toi avec (b).

- **D3 — Reprise des comptes.**
  - (a) Adresse seule : première connexion par lien magique, double authentification à
    réinstaller.
  - (b) Import des hachés argon2id, là où le fournisseur l'accepte.

  **Recommandation : (a).** Aucun haché ne quitte la base. Cela suppose qu'il n'y a toujours
  **aucune donnée réelle en production** (Q15) : peux-tu me le confirmer ?

- **D4 — Double authentification.**
  - (a) Exigée pour la Propriétaire et l'Exploitation, proposée aux Planners. Une clé d'accès en
    tient lieu. Elle est demandée après « Votre espace est prêt », pas pendant l'inscription, et
    exigée dès la connexion suivante.
  - (b) Exigée pour tous, dès l'inscription (règle actuelle, ADR 0037).
  - (c) Proposée seulement, exigée avant l'ouverture commerciale (SEC-02, P1).

  **Recommandation : (a).** Elle garde le niveau actuel pour les comptes qui décident, sans casser
  les dix minutes de PAR-01.

- **D5 — Où se connecter.**
  - (a) Pages de Symbola pour l'inscription et le lien magique, pages du fournisseur pour le mot
    de passe et la clé d'accès.
  - (b) Tout chez le fournisseur.

  **Recommandation : (a).** Le lien magique de Logto passe de toute façon par une page de l'app,
  et nos e-mails restent nos textes.

- **D6 — Qui tient les organisations.**
  - (a) Symbola (`hub.memberships`) : le fournisseur ne fait qu'authentifier.
  - (b) Le fournisseur, avec synchronisation.

  **Recommandation : (a).** Le RLS et les gardes ne changent pas, et l'on peut changer de
  fournisseur.

- **D7 — Renommage du rôle d'exploitation.**
  - (a) Libellés, code et adresses (`/exploitation`).
  - (b) Libellés seulement.

  **Recommandation : (a).** On réécrit déjà ces gardes au 33a.

- **D8 — Inscriptions abusives.**
  - (a) Débit limité, piège à robots, plafond d'envois, rien de créé avant confirmation.
  - (b) En plus, un test anti-robot de type CAPTCHA (dépendance et sous-traitant).

  **Recommandation : (a).** On ajoutera (b) si des abus apparaissent.

- **D9 — L'assistant de démarrage actuel.**
  - (a) Remplacé par le questionnaire. La société, les documents et le logo passent dans la liste
    de prise en main et les réglages.
  - (b) Gardé après le questionnaire.

  **Recommandation : (a)**, comme le demande PAR-01 (ni SIRET ni logo avant la valeur).

- **D10 — Durée de vie de l'exemple.**
  - (a) Suppression d'un clic, proposée au premier évènement réel, et purge automatique après
    30 jours.
  - (b) Sans purge automatique.

  **Recommandation : (a).** PAR-01 dit : « l'exemple se supprime seul ».

- **D11 — Volume et outils remplacés.**
  - (a) Gardés dans le profil de l'organisation. Ils règlent l'ordre de la liste de prise en
    main.
  - (b) Demandés mais non gardés.

  **Recommandation : (a).**

- **D12 — Ajouter une Planner.**
  - (a) Invitation par la Propriétaire dès le 33b.
  - (b) Au lot 52 avec HUB-04 (HUB-03 reste partiel).

  **Recommandation : (a).** Sans elle, on ne peut pas prouver HUB-03.

## Dépendances à approuver

- **Le fournisseur d'identité** choisi en D2 : une image Docker et une base dédiée. Il entre dans
  l'inventaire des licences (JUR-18). C'est un composant hébergé, pas un sous-traitant.
- **`openid-client`** (licence MIT) : client OpenID Connect côté app (PKCE, vérification des
  jetons). Il est générique, pour ne pas lier le code à un fournisseur, et évite d'écrire ces
  contrôles nous-mêmes (SEC-01).

Rien d'autre : les appels à l'API d'administration du fournisseur passent par `fetch`.

## Migrations (prévision, schéma `hub` seulement)

- **33a, ajout** :
  - `hub.memberships` ;
  - `hub.users.idp_subject` (unique) ;
  - `hub.sessions.organization_id` ;
  - reprise des adhésions depuis `users.organization_id` et `users.role` ;
  - `admin` renommé en `operator`.
- **33a, retrait**, après la reprise :
  - mots de passe, secrets et compteurs de `hub.users` ;
  - `users.organization_id` et `users.role` ;
  - `hub.password_resets` et `hub.trusted_devices`.
- **33b** : volume et outils dans `hub.organization_profiles`, rôle sur `hub.invitations`.

Chacune a son script d'annulation et son test. Gel des déploiements : elles partiront avec le
déploiement d'ensemble, dans l'ordre du runbook.

## Fichiers touchés (prévision)

- `packages/auth` : réécrit autour d'OpenID Connect. Mêmes sorties pour l'app : `requireUser`,
  `findSessionActor`, `listTeam`, `removeMember`.
- `apps/symbola/app` :
  - nouveaux : `inscription`, `login`, `auth/callback`, `changer-organisation`, `demarrage`
    (questionnaire, espace prêt) ;
  - retirés : `mfa`, `mot-de-passe`, `mot-de-passe-oublie` ;
  - renommé : `admin` devient `exploitation`.
- `apps/symbola/lib/guards.ts`, `auth-context.ts`.
- `packages/db` : schéma `hub`, migrations, bootstrap de la base du fournisseur.
- `packages/starter-templates` : réponses du questionnaire.
- `packages/testing` : fabrique de comptes.
- `infra/compose` et `infra/backup` : fichiers compose, `.env.example`, sauvegarde.
- `docs` :
  - ADR 0067 ;
  - runbooks de déploiement et de restauration ;
  - `sous-traitants.md` (inchangé : pas de sous-traitant) ;
  - aide (connexion, inscription, démarrage), en français et en anglais.
- `e2e` : assistant de connexion, 76 fichiers mis à jour, nouveaux parcours SC-01 et SC-10.

## Tests

- **Chaque critère devient un `it`** sous son identifiant (`describe('SEC-07 — …')`).
- **Isolation** :
  - A ne lit pas B, même avec une adhésion à A et une organisation active forcée sur B ;
  - l'Exploitation ne lit aucune donnée métier ;
  - une adhésion retirée coupe l'accès ;
  - une invitation ne sert qu'une fois et à son adresse.
- **Horloge simulée** : quinze minutes du lien magique, sept jours de l'invitation, trente jours
  de l'exemple.
- **Playwright** : ordinateur et 375 px, axe-core, SC-01 chronométré, SC-10 à 150 %.

## Hors périmètre

- Rôles Administrateur, Assistant et Comptable (V1), droits par évènement (HUB-03).
- Transfert de propriété, liste des sessions et des appareils (HUB-04, HUB-05, lot 52).
- Alertes de connexion et de changement d'e-mail (SEC-08, lot 52).
- Connexion par Google ou Microsoft : non demandée.
- Contacts uniques (lot 36) : l'import de la liste de prise en main reste l'import actuel.

## Ambiguïtés relevées

- **HUB-01 veut « un lien de confirmation »**, PAR-01 veut « rien d'autre » que l'e-mail. Le lien
  magique d'inscription sert aux deux.
- **SEC-02 (P1) exige la double authentification avant l'ouverture commerciale**, l'ADR 0037 dès
  aujourd'hui pour tous. D4 tranche pour le pilote.
- **PAR-01 dit « l'exemple se supprime seul »**, HUB-10 dit « supprimé d'un clic ou proposé à la
  suppression ». D10 fait les deux.
- **Le refus des mots de passe compromis** (lot 24b, Q22 : sans appel sortant) devra être tenu
  par le fournisseur. Le prototype le vérifie ; sinon, je le signale dans l'ADR.

## Sources du comparatif (consultées le 13/11/2026)

- Logto :
  - [lien magique (jeton à usage unique)](https://docs.logto.io/end-user-flows/one-time-token) ;
  - [clé d'accès](https://docs.logto.io/end-user-flows/sign-up-and-sign-in/passkey-sign-in) ;
  - [reprise des comptes](https://docs.logto.io/user-management/user-migration) ;
  - [organisations](https://docs.logto.io/organizations) ;
  - [dépôt et licence](https://github.com/logto-io/logto).
- Keycloak :
  - [organisations (26)](https://cncf.io/blog/2024/11/13/scalable-authentication-across-organizations-with-keycloak-26) ;
  - [clés d'accès (26.4)](https://www.keycloak.org/2025/09/passkeys-support-26-4) ;
  - [extension de lien magique tierce](https://phasetwo.io/extensions/magic-link/).
- Zitadel :
  - [passage à l'AGPL](https://zitadel.com/blog/zitadel-v3-announcement) ;
  - [reprise des comptes](https://zitadel.com/docs/guides/migrate/users) ;
  - [lien magique, discussion](https://github.com/zitadel/zitadel/discussions/2075).
- authentik : [version 2025.10, sans Redis](https://docs.goauthentik.io/releases/2025.10/).
- Ory Kratos : [import des comptes](https://www.ory.com/docs/kratos/manage-identities/import-user-accounts-identities).
