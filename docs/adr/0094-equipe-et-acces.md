# ADR 0094 — Équipe et accès : comptable en lecture, équipe par évènement, renfort du jour J par lien, sessions et alertes

- Statut : accepté (spécification du lot 52 validée par Julien le 18/11/2026, décisions D1 à D6 dans
  leur option a)
- Date : 2026-11-18
- Complète : [0067](0067-fournisseur-d-identite-logto.md) (identité chez Logto, session opaque Symbola),
  [0053](0053-acces-des-tiers-par-lien-personnel.md) (tiers par lien personnel), [0091](0091-jour-j-de-terrain-et-file-hors-ligne.md)
  (file d'actions du jour J), [0013](0013-auth-maison-pour-le-mvp.md) (une porte d'entrée pour l'identité),
  [0060](0060-journal-d-audit-commun.md) (journal d'audit).
- Exigences : HUB-04, HUB-05, EVT-06, SEC-02, SEC-08 ; rôle Comptable (réponse de Julien du 18/11 au
  lot 58) ; scénario SC-08 étape 7, SC-11 en partie ; `docs/lots/lot-52-equipe-et-acces.md`.

## Contexte

Une organisation avait une Propriétaire et des Planners qui voyaient tout. Il manquait le comptable,
l'équipe par évènement, le renfort du jour J (renvoyé ici par le lot 51), le transfert de propriété, la
liste des sessions et les alertes de sécurité. L'identité est chez Logto depuis le lot 33 : Symbola n'a
plus de mot de passe, mais garde sa session opaque, relue à chaque requête.

## Décision

1. **Rôles** (`hub.membership_role`) : `owner`, `member` (Planner) et `accountant`. Le Comptable n'est
   pas un rôle de planner : toutes les gardes de la planner le refusent (refus par défaut, SEC-13) ; il
   n'a que `/comptable` et la lecture des factures, avoirs, encaissements, e-reporting et de l'archive
   comptable (écritures CSV, originaux), par `requireAccountingReader` et
   `authorizedAccountingReader`. La double authentification lui est exigée comme à la Propriétaire et
   à l'Exploitation (`requiresMfa`, déclaration `acr`, `mfa.required` chez Logto).
   **Factures de commission** (lot 48b) : décision de Julien du 19/11/2026, « Oui on peut ouvrir un
   accès au comptable sur action de la Wedding Planner : elle peut ajouter un utilisateur "Comptable"
   qui dispose d'un accès aux comptes ». Le Comptable invité par la Propriétaire les lit donc, en
   lecture seule, comme les autres factures (original Factur-X par `/devis/argent/factures/<id>`,
   ligne « Facture de commission » sur `/comptable`). Il ne peut ni les émettre ni modifier une
   commission.
2. **Révocation** (HUB-04) : supprime aussitôt les sessions Symbola du membre pour l'organisation (sa
   requête suivante est refusée : la session est relue à chaque requête), ferme ses sessions chez Logto
   par l'API d'administration (`GET /api/users/{id}/sessions` puis `DELETE …/sessions/{uid}` avec
   révocation des autorisations) s'il n'a plus d'autre organisation, et le retire des équipes
   d'évènement. Ses tâches restent : elles n'ont pas de responsable nominatif (rôles planner, clients,
   prestataire). Un échec chez Logto ne rétablit rien et ne garde que le type d'erreur au journal.
3. **Transfert de propriété** (D1) : vers une Planner active qui a au moins un second facteur chez Logto
   (lu par l'API d'administration) ; lien de confirmation par e-mail (jeton après « # », haché en base,
   sept jours, usage unique, une seule demande en cours par organisation) ; la Planner confirme
   connectée avec sa double authentification ; rôles échangés en une transaction ; e-mails aux deux ;
   journal d'audit (`hub.ownership.*`). `hub.ownership_transfers` est une table d'identité, sans RLS,
   lue seulement par `packages/auth` (comme `hub.invitations`).
4. **Équipe d'un évènement** (EVT-06, D2) : `events.event_team_members` (RLS), un planner principal
   (index unique partiel) et des assistants ; la personne qui crée un évènement en devient le planner
   principal. L'assistant ne supprime pas l'évènement. Le réglage d'organisation
   `all_planners_see_all_events` est activé par défaut (rien ne change pour la pilote) ; coupé, une
   Planner ne voit que les évènements de son équipe : la mise en page de l'évènement répond
   « introuvable », la liste, l'agenda, l'accueil, la recherche et le mode Jour J les écartent. Le
   lot 53 lit le planner principal par `listEventLeads`.
5. **Renfort du jour J** (D3) : un lien personnel de public `day_helper` (ADR 0053), sans rubrique du
   portail, avec code à usage unique à chaque ouverture, valable du début de la veille (heure de Paris)
   à la fin du lendemain de l'évènement daté (`link-expiry.json` : données de départ, pas de constante).
   Sa session n'ouvre que `/jour-j/<son évènement>` et ses routes (`resolveDayOfViewer`) : tout autre
   évènement, toute autre organisation, et tout autre écran répondent comme une page inexistante. Il
   voit « Maintenant », l'annuaire, les documents gardés, le pointage, la main courante et les listes ;
   ni remises d'argent (budget), ni réglages des listes et des documents, ni décalage du programme, ni
   l'adresse des comptes de l'équipe. Ses actions (pointage, incident, coche, photo) portent son lien
   (`link_id`, `checked_by_link_id`, `taken_by_link_id` ; les colonnes d'auteur du compte deviennent
   facultatives, un seul auteur par ligne) ; il est nommé « Hugo, renfort ». Un lien retiré ou expiré
   coupe aussitôt ses sessions : la file rejouée reçoit 401 « link », que l'appareil lui dit.
6. **Sessions et appareils** (HUB-05, D4) : `hub.sessions` garde l'appareil (deux clés navigateur et
   système, traduites à l'écran), un identifiant d'appareil aléatoire (cookie `symbola_appareil_id`,
   HttpOnly) et la dernière activité, écrite au plus une fois par heure ; aucune adresse IP ni ville.
   « Mes sessions » (`/securite`) : fermer une session, ou toutes les autres ; la dernière fermée ferme
   aussi la session Logto.
7. **Alertes** (SEC-08, D6) : un appareil inconnu du compte (`hub.known_devices`) envoie « Nouvelle
   connexion à Symbola » avec « Ce n'est pas moi » (jeton haché, sept jours, usage unique), qui ferme
   toutes les sessions, chez Symbola et chez Logto. Le premier appareil d'un compte est retenu sans
   alerte (sinon chaque compte serait alerté au déploiement). Un webhook Logto (`User.Data.Updated`,
   `PostResetPassword`), créé par `configure-identity`, appelle `/api/webhooks/identite` ; sa signature
   HMAC-SHA256 est vérifiée (clé lue par l'API d'administration, jamais affichée) ; un appel non signé
   ou mal signé est refusé (401) et journalisé (`hub.identity_webhook.refused`). Un changement d'adresse
   alerte l'ancienne adresse, gardée dans `hub.identity_change_alerts` jusqu'à l'envoi ; un facteur
   ajouté ou retiré est reconnu à l'empreinte de la liste des facteurs (la première est retenue sans
   alerte) ; la réception est idempotente (empreinte du corps). Le centre de compte de Logto permet
   désormais de changer l'adresse.
8. **SEC-02** (D5) : bandeau discret « Sécurisez votre compte » pour une Planner dont la session s'est
   ouverte sans second facteur ; « Plus tard » le ferme un mois (`hub.users.mfa_prompt_dismissed_at`).
9. **E-mails** : quatre natures personnalisables (`new_device_login`, `identity_changed`,
   `ownership_transfer`, `day_helper_link`), contrainte réunie avec main dans une migration à part
   (0180), annulable vers la liste exacte de main.

## Écarts assumés

- **Tables d'identité sans RLS** : `hub.known_devices`, `hub.ownership_transfers`,
  `hub.identity_change_alerts` suivent `hub.sessions` et `hub.memberships` (en-tête de
  `schema/hub.ts`) : accès par `packages/auth` seulement.
- **Visibilité** : appliquée aux écrans et listes de l'évènement ; la base garde l'isolation par
  organisation (RLS), pas par équipe. Une action serveur sur un évènement hors de vue reste limitée à
  l'organisation : le cloisonnement entre Planners d'une même organisation n'est pas une frontière de
  sécurité au sens de SEC-10.
- **Mot de passe** : Symbola n'en a plus ; une réinitialisation chez Logto alerte
  (`PostResetPassword`), mais un changement de mot de passe dans le centre de compte n'est pas
  distinguable par le webhook (il n'en dit rien), et n'alerte pas.
- **Webhook en développement** : Logto refuse d'appeler une adresse du réseau privé ; en local, le
  webhook se teste par des appels signés simulés (tests d'intégration), l'appel réel ne vaut qu'en
  environnement.
- **Téléphone du renfort** : l'e-mail est obligatoire (le code d'ouverture y part, faute d'envoi de
  SMS) ; le téléphone est facultatif, pour l'annuaire du jour.

## Conséquences

- Migrations 0178 (hub), 0179 (events), 0180 (natures d'e-mails), annulables (`drizzle-rollback`).
- DPO, sans question nouvelle : appareils et dernière activité gardés tant que la session vit, les
  appareils connus 30 jours après leur dernière activité, les alertes 30 jours (purge horaire) ; nom,
  e-mail et téléphone du renfort gardés avec l'évènement, purgés avec lui.
- Le lot 53 adresse ses alertes au planner principal (`listEventLeads`), sinon à la Propriétaire.
