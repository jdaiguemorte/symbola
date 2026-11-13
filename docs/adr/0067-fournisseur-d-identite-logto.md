# ADR 0067 — Fournisseur d'identité : Logto, lien magique envoyé par Symbola

- Statut : accepté (décision D2 a du lot 33, validée par Julien le 13/11/2026, confirmée par le
  prototype du 14/11/2026)
- Date : 2026-11-14
- Complète : [0052](0052-identite-fournisseur-open-source.md) (bascule vers un fournisseur
  d'identité open source). À la bascule, remplace [0013](0013-auth-maison-pour-le-mvp.md),
  [0037](0037-double-authentification-protegee.md) et [0038](0038-appareil-de-confiance.md).
  Reprend la règle de [0063](0063-mots-de-passe-compromis.md) chez le fournisseur.
- Exigences : SEC-01, SEC-07, HUB-01, HUB-02, JUR-18, NFR-27 de `docs/CAHIER_DES_CHARGES.md`.

## Contexte

L'ADR 0052 délègue l'authentification à un fournisseur open source, hébergé sur le VPS. La
spécification du lot 33 (`docs/lots/lot-33-identite-demarrage.md`, partie A) compare cinq
candidats : Logto, Keycloak, Zitadel, authentik et Ory Kratos.

Logto est le seul à offrir, sans code de notre part, à la fois :
- le lien magique ;
- la clé d'accès ;
- le mot de passe et la double authentification ;
- des pages en français.

Keycloak et Zitadel n'ont pas de lien magique dans leurs pages. Ory Kratos n'a pas de pages du
tout.

Julien a retenu Logto sous réserve d'un prototype en local sur sept points.

## Décision

1. **Logto 1.46.0**, image officielle `svhd/logto:1.46.0`, licence MPL-2.0, utilisée sans
   modification. Il tourne dans un conteneur à part, avec une base dédiée dans le PostgreSQL
   existant, comme Documenso. Les mises à jour passent par Renovate et une PR.
2. **OpenID Connect** : flux « code » avec PKCE, côté app par `openid-client` (licence MIT).
   Après l'échange, Symbola ouvre sa propre session opaque, comme avant : le cookie, le
   middleware et le contexte d'organisation (RLS) ne changent pas.
3. **Lien magique (SEC-07)** :
   - Symbola demande à Logto un jeton à usage unique (`POST /api/one-time-tokens`, quinze minutes),
     puis envoie le lien elle-même, avec ses textes en français et en anglais ;
   - le lien ouvre l'autorisation avec `one_time_token` et `login_hint` ;
   - Logto refuse un jeton rejoué, expiré ou présenté avec une autre adresse ;
   - le même lien inscrit une adresse inconnue (HUB-01).
4. **Double authentification** :
   - Logto ne la propose jamais de lui-même (politique `NoPrompt`) ;
   - Symbola l'exige pour la Propriétaire et l'Exploitation (décision D4 du lot 33), en lisant la
     déclaration `acr` du jeton : `urn:logto:acr:mfa` quand elle a eu lieu ;
   - une fois un second facteur installé, le lien magique ne suffit plus : Logto le demande ;
   - une clé d'accès vaut double authentification ;
   - facteurs proposés : application d'authentification, clé d'accès, codes de secours.
5. **Mots de passe compromis (Q22, ADR 0063)** :
   - la liste locale de l'ADR 0063 (49 233 entrées) est chargée dans la politique de Logto
     (« mots interdits »), avec les années de 1900 à 2099 ;
   - longueur de douze caractères au moins, répétitions et suites refusées ;
   - **aucun appel sortant** : le contrôle par Have I Been Pwned de Logto reste coupé.
6. **Configuration en une commande** (dev, CI, staging, production) :
   - une seule ligne SQL d'amorçage dans la base de Logto crée l'application machine à machine
     de Symbola et lui donne le rôle d'administration ;
   - tout le reste passe par l'API d'administration : application web, expérience de connexion,
     connecteur d'e-mail, langues, couleurs ;
   - le script est rejouable.
7. **Console d'administration de Logto** : jamais exposée publiquement, seulement par un tunnel
   SSH.
8. **E-mails envoyés par Logto** (code de connexion, mot de passe oublié) : connecteur SMTP du
   serveur d'envoi de Symbola (Mailpit en dev, IONOS en production).

## Résultats du prototype (14/11/2026, en local)

| Point | Résultat |
| --- | --- |
| 1. Lien magique | Tenu : connexion par le lien. Rejoué : « Le jeton a été consommé ». Expiré : « Le jeton est expiré ». Autre adresse : « L'email ne correspond pas au jeton fourni ». |
| 2. Clé d'accès, double authentification, français | Tenu : pages en français à 375 px, avec « Continuer avec passkey », code par e-mail, mot de passe en option et vérification en deux étapes. |
| 3. Adresse inconnue | Tenu : le lien crée le compte, et l'adresse est vérifiée. |
| 4. Mémoire | Environ 350 Mo au repos. |
| 5. Mots de passe compromis sans appel sortant | Tenu, avec une limite (ci-dessous). « Password1234! », « azertyazerty » et « iloveyou123456 » sont refusés ; une phrase de passe est acceptée. |
| 6. Configuration sans clic | Tenu : une ligne SQL d'amorçage, puis l'API d'administration. |
| 7. Preuve de double authentification | Tenu : `acr` vaut `urn:logto:acr:1fa` avec le lien seul, `urn:logto:acr:mfa` après le code. |

## Limites assumées

- **Contrôle des mots de passe un peu moins strict qu'au lot 24b** :
  - Logto refuse un mot de passe quand la part faite de mots interdits, de répétitions ou de
    suites laisse moins de quatre caractères libres ;
  - il ne défait pas les substitutions : « p@ssw0rd2027 » passe, alors que le lot 24b le
    refusait ;
  - le mot de passe n'est plus qu'une méthode parmi trois, après le lien magique et la clé
    d'accès, et la double authentification protège les comptes qui décident.
- **« Powered by Logto » reste visible** sous ses pages : la version libre refuse de le masquer.
  Les couleurs sont celles de Symbola. Le bouton dit « Continuer avec passkey » : sa phrase est
  commune à d'autres boutons et ne se remplace pas seule ; le reste des pages dit « clé d'accès ».
- **Clé d'accès proposée une fois** après la première connexion, avec « Passer ». Le choix est
  retenu sur le compte.
- **L'amorçage SQL dépend du schéma interne de Logto** (tables `applications` et
  `applications_roles`). Un test le rejoue à chaque montée de version.
- **Projet porté par une entreprise**, avec une offre en ligne payante. Parade : licence
  MPL-2.0, sorties mensuelles, image figée ; changer de fournisseur ne touche que
  `packages/auth`, parce que Symbola tient elle-même les organisations et les rôles (décision
  D6).

## Conséquences

- **Plus de mot de passe ni de secret de double authentification chez Symbola**, après la
  migration de retrait du lot 33 (SEC-01).
- **Un service de plus sur le VPS (NFR-27)** :
  - limites de mémoire et de processeur, comme tout conteneur (ADR 0016) ;
  - base sauvegardée chaque nuit avec celle de Documenso (ADR 0051) ;
  - sonde de surveillance ;
  - un sous-domaine par environnement.
- **Inventaire des licences (JUR-18)** : Logto (MPL-2.0, sans modification) et `openid-client`
  (MIT). Ce ne sont pas des sous-traitants : tout est hébergé sur le VPS.
- **Les parcours de bout en bout se connectent par le lien magique**, lu dans Mailpit. Le job
  `e2e` de la CI démarre Logto.
