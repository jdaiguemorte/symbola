# ADR 0102 — Messagerie par sujet, adresse d'expédition sur le domaine de Symbola, journal des envois, portail aux couleurs et installable

- Statut : accepté. Service d'envoi (D2) : **Scaleway Transactional Email**, formule Essential,
  **choix de Julien du 19/11/2026** (comparatif `docs/etudes/service-envoi-emails.md`).
- Date : 2026-11-19
- Remplace, pour MSG-04 : la décision Q18 du 11/11/2026 (envoi depuis le domaine du planner).
- Complète : [0072](0072-emails-a-l-image-de-l-organisation.md) (e-mails à l'image de l'organisation),
  [0076](0076-file-des-taches-et-adaptateur-e-mail.md) (file des tâches, adaptateur d'e-mail),
  [0027](0027-telechargements-servis-par-l-app.md) (fichiers servis par l'app),
  [0053](0053-acces-des-tiers-par-lien-personnel.md) (tiers par lien),
  [0064](0064-jour-j-hors-ligne.md) (service worker), [0095](0095-notifications-automatismes-radar-et-vocabulaire.md)
  et [0096](0096-bibliotheque-web-push.md) (notifications, Web Push), [0046](0046-documents-a-son-image.md) (couleur des documents).
- Exigences : MSG-03, POR-06, MSG-04 (révisée), MSG-05, POR-08 (partiel : V1), POR-11 ; spécification
  `docs/lots/lot-55-messagerie-et-portail.md`, validée le 19/11/2026 (D1 à D4 en a).

## Contexte

Le cahier des charges demande l'envoi depuis le domaine du planner (MSG-04), décidé en Q18 le 11/11.
Le 19/11, Julien a simplifié : « on fait l'envoi depuis Symbola avec une personnalisation possible
pour la Wedding planner ou l'agence correspondante […] la plupart du temps les agences et planners
feront leurs envois elles-mêmes depuis leur plateforme d'email ». Aujourd'hui tout part de
`SMTP_FROM` (IONOS) ; IONOS impose une boîte ou un alias par adresse et ne rend pas compte de la
remise, ce qui rend MSG-05 impossible. Le portail n'avait ni messagerie, ni couleurs, ni manifeste.

## Décision

### 1. Écart assumé avec MSG-04 (décision du 19/11)

Pas d'envoi depuis le domaine de la planner : pas de DKIM ni de SPF à régler chez elle. Chaque
organisation envoie depuis **`<partie locale>@<domaine d'envoi de Symbola>`** :

- **D1 (a)** : un sous-domaine dédié, `SMTP_FROM_DOMAIN`, par défaut `envoi.symbola.fr`, validé au
  démarrage. Le domaine principal reste protégé si un client signale un e-mail comme indésirable.
  `symbola.com` (cité par Julien) reste possible par la variable si Julien le possède.
- La partie locale est proposée depuis le nom (`atelier-camille`), **unique** (index unique de
  `hub.organizations.sender_local_part`), en minuscules, 2 à 40 caractères ; les parties locales
  techniques (RFC 2142 : `postmaster`, `abuse`…) et celles qui feraient passer pour Symbola sont
  réservées. La Propriétaire la change (Paramètres › Adresse d'envoi) ; une adresse prise est
  refusée sans dire par qui.
- Le **nom affiché** reste celui de l'organisation ; les **réponses** vont à son adresse de contact
  (ADR 0072, inchangé).
- **Bascule sans risque** : `SMTP_SENDER_MODE` vaut `shared` par défaut (tout part encore de
  `SMTP_FROM`, comme avant le lot) ; il passe à `organization` une fois le service d'envoi choisi et
  le sous-domaine vérifié (SPF, DKIM, DMARC). En dev, Mailpit accepte tout.

### 2. Le service d'envoi : Scaleway Transactional Email, derrière deux interfaces (D2)

Choix de Julien du **19/11/2026** : **Scaleway Transactional Email**, formule Essential, région fr-par
(Paris, aucun sous-traitant dédié, webhooks signés, SMTP). Domaine d'envoi : `envoi.symbola.fr` par
défaut (`envoi-staging.symbola.fr` en staging), Julien n'ayant pas indiqué posséder `symbola.com`.

- **Envoi** : toujours en SMTP par l'adaptateur du lot 40b ; `SendMailInput` gagne `fromAddress`
  (l'adresse de l'organisation) et `messageId`. Aucune dépendance de code nouvelle.
- **Remise** : un adaptateur de webhook par service (`EmailDeliveryWebhookAdapter`), qui vérifie la
  signature et traduit l'appel en statuts **remis**, **rejeté** (adresse inexistante, boîte pleine,
  refus) ou **plainte**. Le lot livre l'adaptateur **simulé** (HMAC-SHA256 de « horodatage.corps »,
  fenêtre de cinq minutes, comparaison en temps constant, `node:crypto`), interdit en production.
- **Adaptateur Scaleway** (`scaleway-webhook.ts`, `EMAIL_DELIVERY_WEBHOOK=scaleway`) : TEM publie ses
  évènements dans un sujet de Topics and Events (compatible SNS), poussé en HTTPS. Sans dépendance
  (`node:crypto`) :
  - enveloppe SNS validée ; sujet (`TopicArn`) dans la liste `EMAIL_DELIVERY_WEBHOOK_TOPIC_ARN` ;
    message de moins de 6 heures et pas plus de 5 minutes dans le futur ;
  - certificat de signature pris seulement sur `messaging.s3.<région>.scw.cloud/<région>/sns/`, au nom
    `sns.mnq.<région>.scaleway.com`, en cours de validité, signé par un intermédiaire de la chaîne
    publiée par Scaleway sur le même hôte, lui-même signé par la **racine épinglée** dans le code
    (« Scaleway MnQ Root », valable jusqu'en 2032, empreinte vérifiée par un test) ; certificats gardés
    en mémoire, dix au plus ;
  - signature RSA de la chaîne canonique SNS (SHA-1 en version 1, SHA-256 en version 2) ;
  - une demande d'abonnement signée est confirmée (GET de `SubscribeURL`, seulement sur
    `sns.mnq.<région>.scaleway.com`) ;
  - l'e-mail est retrouvé par l'en-tête `X-Symbola-Delivery` qu'il porte (TEM recopie les en-têtes dans
    `email_headers`), sinon par son Message-ID. Évènements : `email_delivered` → remis ;
    `email_mailbox_not_found`, `email_blocklisted`, `email_dropped` → rejeté (motif) ; `email_spam` →
    plainte ; mise en file et report ignorés.
  Pas de secret partagé avec Scaleway : la signature fait foi. Les tests fabriquent une autorité de
  test avec openssl, sans clé privée dans le dépôt.
- **SMTP** : `smtp.tem.scaleway.com`, port 587 ; avec une authentification, l'app exige STARTTLS
  (`requireTLS`). Utilisateur : l'identifiant du projet Scaleway ; mot de passe : une clé d'API IAM
  réservée à l'envoi.
- Route `/api/webhooks/envois` : corps brut limité à 256 Ko ; signature absente, fausse ou trop
  ancienne → **401** et journal (le motif seulement, jamais le corps ni un en-tête) ; référence
  inconnue ou d'une autre organisation → ignorée (200), sans dire si elle existe.

### 3. Journal des envois (MSG-05)

- Chaque e-mail d'une organisation (`sendOrganizationEmail`) porte un **Message-ID** fait de
  l'organisation et de la ligne du journal (`<org>.<ligne>@<domaine>`, sans donnée personnelle) ;
  quand la file l'a envoyé, la ligne entre dans `hub.email_deliveries` : destinataire (et son
  empreinte SHA-256 pour la recherche par contact), objet, nature, évènement, statut « envoyé ».
  Jamais le corps.
- Le statut n'avance que vers l'avant (envoyé → remis → rejeté ou plainte) : un appel rejoué ou dans
  le désordre ne change rien.
- **Un rejet remonte en alerte** : notification « E-mail rejeté » (lot 53, immédiate), qui mène à la
  fiche du contact, où un bandeau « L'adresse de Léa est rejetée » reste tant qu'aucun envoi plus
  récent n'est remis ; sans contact, elle mène au journal. Jamais l'adresse dans la notification.
- Journal visible par l'organisation (Paramètres › Journal des envois), filtré par contact, par
  évènement et par statut ; **purgé 13 mois après l'envoi** (purge quotidienne, fin de mois ramenée
  au dernier jour). Hors de l'export complet (trace temporaire), trouvé et effacé par le RGPD.

### 4. Fils de discussion (MSG-03, POR-06 ; D3 a)

- Schéma `events` : `message_topics`, `message_topic_links` (prestataires du sujet),
  `messages` (visibilité `internal` ou `shared`), `message_attachments`.
- **Un message interne n'a aucun chemin vers l'extérieur** :
  - deux zones d'écriture distinctes, postées vers **deux routes** différentes (`…/interne`,
    `…/partage`) ; aucun champ ne choisit la visibilité ;
  - le bouton du message partagé **nomme ses destinataires** (« Envoyer à Léa et Maxime ») ; leur
    empreinte est renvoyée et comparée : s'ils ont changé entre l'affichage et l'envoi, refus ;
  - la note interne ne déclenche ni e-mail ni push ; elle a un fond et une étiquette « Interne » ;
  - la base refuse un message interne écrit par un lien (`messages_internal_team_check`) ; le rôle
    applicatif n'a **pas le droit UPDATE** sur `events.messages` : une visibilité ne change jamais ;
  - toute lecture pour un lien ne prend que les messages partagés, dans la requête même ; un sujet
    sans message partagé (notes internes seulement) reste invisible, nom compris ; une pièce jointe
    d'un message interne répond comme absente.
- **Portail** : rubrique « Messages », fermée par défaut (POR-10), ouverte par la planner sur le lien
  d'un client ; le client lit, répond, joint un fichier et peut ouvrir un sujet. Un prestataire ajouté
  au sujet le lit et y répond depuis son espace (il n'en ouvre pas).
- Pièces jointes : cinq au plus par message, contrôlées comme les autres fichiers (type par le
  contenu, taille, antivirus, stockage privé) et servies par l'app après contrôle des droits
  (ADR 0027) ; envoyées par une route dédiée (L16-SEC-02 : origine, session, débit, taille).
- **Notifications** : le destinataire d'un message partagé reçoit l'e-mail « Nouveau message sur
  <sujet> » (nature `new_message`, modèle de l'organisation), avec le lien vers le fil et **jamais le
  contenu** ; la planner reçoit la notification « Message d'un client » (lot 53, immédiate par
  e-mail, push si elle l'a activé).
- Rafraîchissement à l'ouverture (hors périmètre : temps réel).

### 5. Portail aux couleurs et installable (POR-08, POR-11 ; D4 a)

- **Couleurs** : celle des documents de l'organisation (lot 17 ; il n'y a qu'une couleur réglée),
  passée par le même calcul que les documents (ADR 0046) : assombrie jusqu'à **4,5:1** sur le blanc
  et sur sa teinte claire ; le texte posé dessus garde le seuil. Posées en variables CSS par une
  feuille à **nonce** (la CSP refuse les styles en ligne), seulement des couleurs `#rrggbb`. Le logo
  reste en tête (lot 26a). Le domaine personnalisé du portail est en V2.
- **Manifeste** : `/portail/manifeste/<organisation>`, au nom et à la couleur de l'organisation,
  logo en icône (`…/icone`, sinon l'icône de Symbola), `start_url` et `scope` `/portail`. Il est
  public, parce qu'un navigateur lit le manifeste et ses icônes sans les cookies de la page :
  l'identifiant de l'organisation n'est pas devinable et le manifeste ne porte que le nom et la
  couleur de l'entreprise, comme ses documents ; un identifiant inconnu reçoit celui de Symbola.
- **Installation** : la proposition n'apparaît **qu'à partir de la deuxième visite** (une visite =
  une session du navigateur), jamais si le portail est déjà installé ; refusée, elle se tait
  **30 jours**. État dans le navigateur seulement. Android et ordinateur : la proposition du
  navigateur ; iPhone : les étapes.
- **Push du portail**, facultatif et désactivé par défaut (`events.link_push_subscriptions`) : nouveau
  message partagé et décision demandée (pour un client qui voit la rubrique de la décision), la
  sorte seulement, jamais le contenu. Même service worker et même envoyeur Web Push que le lot 53.
  L'écran explique que sur iPhone le push ne marche qu'une fois le portail installé.

## Conséquences

- Migrations **0191** (`events`) et **0192** (`hub`), ajout seul, annulables ; l'annulation est
  refusée tant qu'un message ou un modèle « Nouveau message » personnalisé existe.
- Variables d'environnement : `SMTP_FROM_DOMAIN`, `SMTP_SENDER_MODE`, `EMAIL_DELIVERY_WEBHOOK`
  (`none`, `scaleway`, `simulated`), `EMAIL_DELIVERY_WEBHOOK_TOPIC_ARN` (requis avec Scaleway),
  `EMAIL_DELIVERY_WEBHOOK_SECRET` (webhook simulé seulement, interdit en production), et, pour
  Documenso, `DOCUMENSO_SMTP_FROM_ADDRESS` (avec Scaleway, `SMTP_USER` n'est plus une adresse).
- **Nouveau sous-traitant** : Scaleway SAS, déclaré dans `docs/conformite/sous-traitants.md` et pour
  information à la DPO (DPO-11), avec son DPA et les conditions propres à Transactional Email.
- **À faire par Julien** avant `SMTP_SENDER_MODE=organization` (runbook de déploiement, § Lot 55) :
  créer le domaine chez Scaleway, poser SPF, DKIM et DMARC du sous-domaine chez le registraire, créer
  le sujet, l'abonnement et le webhook, remplir le `.env` ; dire un jour si `symbola.com` existe (D1).
- Le registre RGPD déclare les nouveaux champs ; le journal des envois garde des adresses 13 mois
  (point DPO).
