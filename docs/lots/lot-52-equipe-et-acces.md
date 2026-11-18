# Lot 52 — Équipe : membres, rôles par évènement, renfort du jour J, comptable, sessions et alertes

**Statut** : spécification proposée le 18/11/2026, **à valider par Julien**. Le lot change les
schémas `hub` et `events`, et touche le fournisseur d'identité (webhooks, D6) : validation
explicite requise (CLAUDE.md § 8). Aucune dépendance nouvelle.

Branche `lot-52-equipe-et-acces`, partie de `main`. Aucune version intermédiaire n'est déployée
(gel des déploiements).

Ce lot avance **en parallèle des lots 48 et 53** : voir « Travail en parallèle » à la fin.

## Contexte

Aujourd'hui, une organisation a une **Propriétaire** et des **Planners** :

- la Propriétaire invite une Planner (lot 33b) et retire un collaborateur (lot 24b) ;
- l'identité est chez Logto (lot 33, ADR 0067). La double authentification est exigée pour la
  Propriétaire, et la clé d'accès vaut double authentification ;
- toutes les Planners voient tous les évènements.

Il manque trois choses :

- l'équipe **par évènement** ;
- le **renfort du jour J**, renvoyé ici par le lot 51 (sa D5) ;
- le **comptable**, en lecture : la réponse de Julien du 18/11 au lot 58 en fait « un plus ».

Il manque aussi :

- le **transfert de propriété** ;
- la **liste des sessions**, avec la déconnexion à distance ;
- les **alertes de sécurité**.

Exigences :

- **HUB-04** (P1) — Invitation d'un membre par e-mail, révocation, transfert de propriété.
  *Critère* : la révocation coupe les sessions actives en moins d'une minute.
- **HUB-05** (P1) — Sessions et appareils : liste et déconnexion à distance. *Critère* :
  l'utilisateur voit et ferme chacune de ses sessions.
- **EVT-06** (P1) — Équipe et droits par évènement : planner principal, assistant, renfort du
  jour J. *Critère* : un renfort du jour J n'accède qu'au mode Jour J.
- **SEC-02** (P1, Partiel) — Double authentification proposée à tous, exigée pour la Propriétaire
  et l'Administrateur ; clés d'accès. *Critère* : exigée avant l'ouverture commerciale.
- **SEC-08** (P1, Partiel) — Alerte à l'utilisateur pour toute connexion depuis un nouvel appareil
  et tout changement d'e-mail ou de mot de passe. *Critère* : l'alerte part vers l'ancienne
  adresse en cas de changement d'e-mail.

Scénario : **SC-08** étape 7 (« Hugo, en renfort, voit les mêmes informations à jour »), et
**SC-11** (l'agence et ses équipes) en partie.

## Ce qui existe aujourd'hui

- `hub.memberships` (rôles `owner`, `member`), `hub.invitations` ; écran
  `app/parametres/equipe` (inviter, retirer avec confirmation).
- `hub.sessions` : session opaque de Symbola, avec un jeton haché, une date d'expiration et
  l'indicateur de double authentification. Aucun appareil, aucune date de dernière activité.
- Logto (ADR 0067) :
  - lien magique, clé d'accès, application d'authentification, codes de secours ;
  - double authentification imposée à la Propriétaire et à l'Exploitation (`mfa.required`),
    vérifiée par la déclaration `acr` ;
  - le changement d'e-mail et la gestion des facteurs se font dans le centre de compte de Logto.
- Alerte e-mail au verrouillage seulement (`lib/mfa-lock-mail.ts`).
- Liens personnels des tiers (ADR 0053) : hachés, limités, révocables, expirants ; la copie du
  jour J est lisible sans session jusqu'au lendemain (lot 29) ; la file d'actions hors ligne vient
  du lot 51.

## Une seule PR

Le lot tient en une PR : il porte sur les accès d'une même équipe (qui entre, sur quoi, depuis
quels appareils, et qui en est prévenu).

## Partie A — Membres, révocation, transfert de propriété (HUB-04 ; D1)

- **Inviter** un membre (existant) : la Propriétaire choisit son rôle d'organisation, Planner ou
  Comptable (partie C).
- **Révoquer** : retirer un membre **supprime aussitôt ses sessions** Symbola et **ferme ses
  sessions chez Logto** par l'API d'administration. Sa prochaine requête est refusée : **moins
  d'une minute** (critère, le contrôle de session étant fait à chaque requête). Ses évènements lui
  sont retirés ; ses tâches restent, sans responsable.
- **Transférer la propriété** (D1) :
  - la Propriétaire désigne une Planner qui a déjà la double authentification ;
  - la Planner confirme par e-mail (lien à usage unique, 7 jours) ;
  - les rôles s'échangent : l'ancienne Propriétaire devient Planner ;
  - les deux reçoivent un e-mail ;
  - le journal d'audit garde la trace.

## Partie B — Équipe par évènement et renfort du jour J (EVT-06 ; D2, D3)

- **Rôles sur un évènement** :
  - **planner principal** : un par évènement ; reçoit ses alertes et récapitulatifs (lot 53) ;
  - **assistant** : tout l'évènement, sauf la suppression et les réglages de facturation ;
  - **renfort du jour J** : **le mode Jour J de cet évènement seulement** (critère).
- **Visibilité** (D2) : une Planner voit les évènements où elle est dans l'équipe. La Propriétaire
  voit tout. Un réglage d'organisation, activé par défaut, permet que toutes les Planners voient
  tous les évènements ; il garde le comportement actuel de la pilote.
- **Renfort du jour J** (D3) : **par lien personnel, sans compte** (ADR 0053) :
  - la planner l'ajoute (nom, téléphone ou e-mail) et choisit l'évènement ;
  - le lien est **valable du matin de la veille au lendemain de l'évènement**, révocable,
    avec un code à usage unique à l'ouverture ;
  - il ouvre **seulement** le mode Jour J de cet évènement : « Maintenant », annuaire, documents
    gardés, pointage, main courante, listes. Il n'ouvre ni budget, ni devis, ni invités nominatifs,
    ni réglages ;
  - ses actions hors ligne passent par la file du lot 51, signées par son lien ; le serveur
    refuse une action dont le lien est révoqué ou expiré, et le dit au renfort ;
  - son nom figure dans les pointages et la main courante (« pointé par Hugo, renfort »).
- **Contrôle côté serveur**, à chaque requête : session ou lien, organisation, rôle, évènement,
  portée (SEC-12). Une page hors portée répond comme une page inexistante (SEC-13).

## Partie C — Le comptable en lecture (réponse de Julien du 18/11)

- **Rôle d'organisation « Comptable »** : un compte invité par la Propriétaire, avec double
  authentification **exigée**.
- Accès **en lecture seule** à :
  - factures, avoirs et encaissements ;
  - journal des recettes ou journal des ventes et encaissements ;
  - exports comptables (lot 58, au format de la planner) ;
  - e-reporting.
- Aucun accès aux évènements, aux invités, aux contacts hors factures, ni aux réglages.
- L'export reste le minimum, comme le veut Julien : l'accès comptable est facultatif.

## Partie D — Sessions et appareils (HUB-05 ; D4)

- À l'ouverture d'une session, Symbola note :
  - l'**appareil**, lu dans l'en-tête du navigateur (« Safari sur iPhone ») ;
  - un **identifiant d'appareil** aléatoire, gardé dans un cookie ;
  - la date de création et la **dernière activité**, mise à jour au plus une fois par heure.

  Aucune adresse IP n'est gardée au-delà de la journalisation existante.
- **Écran « Mes sessions »** (`/securite`) : une ligne par session (appareil, ville absente,
  dernière activité, « cet appareil ») ; **« Fermer »** sur chacune, et **« Fermer toutes les
  autres »**. Fermer supprime la session Symbola et, si c'est la dernière, la session Logto.

## Partie E — Double authentification et alertes (SEC-02, SEC-08 ; D5, D6)

- **SEC-02** :
  - la double authentification reste **exigée** pour la Propriétaire, l'Exploitation et le
    Comptable ;
  - pour une Planner, elle est **proposée** : un bandeau discret « Sécurisez votre compte : clé
    d'accès ou application d'authentification », qui se ferme et revient au plus une fois par mois
    tant qu'aucun facteur n'est installé (D5) ;
  - les clés d'accès sont déjà prises en charge par Logto.
- **SEC-08 — alertes par e-mail** :
  - **connexion depuis un nouvel appareil** (identifiant d'appareil inconnu pour ce compte) : un
    e-mail « Nouvelle connexion à Symbola » avec l'appareil et l'heure, et un lien « Ce n'est pas
    moi » qui ferme toutes les sessions et renvoie au centre de compte ;
  - **changement d'e-mail ou de facteur d'authentification** chez Logto : un e-mail d'alerte. En
    cas de changement d'e-mail, il part **à l'ancienne adresse** (critère). Symbola l'apprend par un
    **webhook** de Logto signé et vérifié (D6, SEC-19), et garde l'ancienne adresse jusqu'à
    l'envoi ;
  - il n'y a plus de mot de passe chez Symbola. Si un mot de passe est défini chez Logto (option),
    son changement suit la même voie.

## Décisions à prendre

- **D1 — Le transfert de propriété.**
  - (a) Vers une Planner qui a la double authentification ; confirmation par e-mail ; rôles
    échangés.
  - (b) Par l'Exploitation seulement, sur demande.

  **Recommandation : (a).** Libre-service, mais protégé par la double authentification et une
  confirmation. L'Exploitation n'a pas accès aux données métier (SEC-09).
- **D2 — Qui voit quels évènements.**
  - (a) L'équipe de l'évènement, la Propriétaire voit tout ; un réglage, **activé par défaut**,
    laisse toutes les Planners tout voir.
  - (b) Toujours l'équipe seule.

  **Recommandation : (a).** Une petite agence partage tout, une grande cloisonne ; le défaut ne
  change rien pour la pilote.
- **D3 — Le renfort du jour J.**
  - (a) Par lien personnel, sans compte, borné au mode Jour J d'un évènement et à ses dates.
  - (b) Un compte invité avec un rôle restreint.

  **Recommandation : (a).** Un renfort vient un samedi : lui faire créer un compte est un
  obstacle. Le lien suit la règle des tiers (ADR 0053), et le critère « n'accède qu'au mode
  Jour J » est tenu par la portée du lien.
- **D4 — Ce que la liste des sessions garde.**
  - (a) Appareil lu dans le navigateur, identifiant d'appareil, dernière activité ; aucune adresse
    IP ni ville.
  - (b) Ajouter l'adresse IP et la ville approximative.

  **Recommandation : (a).** Minimisation : l'appareil et l'heure suffisent à reconnaître sa
  session ; la ville demanderait une base de géolocalisation et garderait l'adresse IP.
- **D5 — La double authentification des Planners.**
  - (a) Proposée par un bandeau discret ; exigée pour la Propriétaire, l'Exploitation et le
    Comptable.
  - (b) Exigée pour tous.

  **Recommandation : (a)**, comme le dit SEC-02. Le critère « exigée avant l'ouverture
  commerciale » vise la Propriétaire et l'Administrateur, déjà couverts.
- **D6 — Savoir qu'un e-mail a changé chez Logto.**
  - (a) Webhook de Logto (événement de mise à jour d'un utilisateur), signé et vérifié par
    Symbola ; Symbola garde l'ancienne adresse pour l'alerte.
  - (b) Comparer l'e-mail à chaque connexion. L'alerte partirait trop tard, et à la nouvelle
    adresse.

  **Recommandation : (a).** Seule voie qui tient le critère. Le webhook se configure par la
  commande `configure-identity` existante.

## Points pour les conseils

- **DPO** :
  - la liste des sessions (appareil, dernière activité) est une donnée de sécurité, gardée tant
    que la session vit puis 30 jours ;
  - le renfort du jour J est un tiers par lien : son nom et son téléphone sont gardés jusqu'à la
    purge de l'évènement.

  À noter au registre, sans question nouvelle.
- **Avocat** : rien.

## Migrations (prévision)

Numérotation : à partir du premier numéro libre de `main` (0173 aujourd'hui). Une PR fusionnée
après une autre renumérote ses migrations **et** leur date (`when`).

- **`hub`** :
  - `membership_role` élargi à `accountant` ;
  - `sessions` : `device_label`, `device_id`, `last_seen_at` ;
  - `known_devices` (compte, identifiant d'appareil, vu le) ;
  - `ownership_transfers` (de, vers, demandé le, confirmé le) ;
  - `identity_change_alerts` (compte, nature, ancienne adresse jusqu'à l'envoi, envoyée le) ;
  - réglage d'organisation « toutes les Planners voient tout » ;
  - contrainte des natures d'e-mails, dans une migration à part : `new_device_login`,
    `identity_changed`, `ownership_transfer`, `day_helper_link`.
- **`events`** :
  - `event_team_members` (évènement, membre, rôle principal ou assistant) ;
  - liens de public `day_helper` (portée : mode Jour J, dates bornées) dans `event_links` ;
  - contrainte de public élargie.
- RLS et index partout.

## Tests (prévision)

- **HUB-04** :
  - un membre révoqué est refusé à sa requête suivante (moins d'une minute, horloge simulée) ;
  - ses sessions Logto sont fermées (adaptateur simulé) ;
  - transfert de propriété confirmé, rôles échangés, journal d'audit.
- **EVT-06** :
  - une Planner hors de l'équipe ne voit pas l'évènement quand le réglage est coupé ;
  - un **renfort n'ouvre que le mode Jour J** de son évènement : le budget, les devis, les invités,
    un autre évènement ou une autre organisation répondent comme une page inexistante (test
    d'abus) ;
  - un lien expiré ou révoqué est refusé, y compris pour une action hors ligne rejouée.
- **Comptable** : lecture des factures et des exports, refus partout ailleurs, double
  authentification exigée.
- **HUB-05** : liste des sessions, fermeture d'une session et de toutes les autres.
- **SEC-08** :
  - nouvel appareil, puis alerte ;
  - « Ce n'est pas moi » ferme tout ;
  - webhook de changement d'e-mail, puis alerte **à l'ancienne adresse** ;
  - webhook non signé ou mal signé refusé et journalisé.
- **SEC-02** : bandeau proposé une fois par mois à une Planner sans facteur ; jamais à celle qui en
  a un.
- **Playwright** (ordinateur et 375 px, axe-core) :
  - SC-08 étape 7 avec Hugo en renfort par lien ;
  - écran des sessions ;
  - écran de l'équipe.
- **Rejeu** : SC-08 (étape 7 par lien) ; SC-11 en partie.

## Hors périmètre

- Droits fins par module et par action, au-delà des rôles décrits.
- Renfort avec compte (D3 b) ; géolocalisation des sessions (D4 b).
- Équipes multiples d'agence et tableaux de bord d'agence (lot 56).

## Ambiguïtés relevées

- EVT-06 cite le « renfort du jour J » parmi les droits par évènement, sans dire s'il a un compte :
  la spécification choisit le lien (D3), dans l'esprit des tiers sans compte (UX-11).
- SEC-08 parle de « mot de passe » : Symbola n'en a plus depuis le lot 33 ; l'alerte vaut pour un
  mot de passe défini chez Logto et pour les facteurs.

## Travail en parallèle (lots 48, 52 et 53)

- **Avec le lot 53** :
  - les deux touchent le schéma `hub` (tables différentes) et la contrainte des natures d'e-mails ;
  - la PR fusionnée en second réunit les listes ;
  - le lot 53 utilise le **planner principal** pour adresser les alertes : il lit l'équipe par le
    service `events` et, d'ici la fusion, retombe sur la Propriétaire.
- **Avec le lot 48** : rien dans les schémas.
- Traductions, `gap.csv`, `globals.css` : garder tout, avec les accolades équilibrées.
