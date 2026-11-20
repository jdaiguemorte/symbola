# Lot 55 — Messagerie par sujet, adresse d'envoi personnalisée, journal des envois, portail aux couleurs et installable

**Statut** : spécification proposée le 19/11/2026, **validée par Julien le 19/11/2026** : toutes les décisions retenues dans leur option recommandée (a), changements de schéma compris (accord donné). Le lot change les
schémas `events` et `hub`. Il **remplace la décision Q18** du 11/11 (envoi depuis le domaine du
planner) par la décision de Julien du 19/11 : écart assumé avec MSG-04, ADR à écrire. Il demande
peut-être un **nouveau sous-traitant d'envoi** (D2) : accord requis (CLAUDE.md § 3 et 8).

Branche `lot-55-messagerie`, partie de `main`.

## Décision de Julien (19/11/2026)

> « Je préfère simplifier : on fait l'envoi depuis Symbola avec une personnalisation possible pour
> la Wedding planner ou l'agence correspondante : xxxx.weddingplanner@symbola.com. Surtout que la
> plupart du temps les agences et planners feront leurs envois elles-mêmes depuis leur plateforme
> d'email. »

En clair :

- **Pas d'envoi depuis le domaine de la planner** : pas de DKIM ni de SPF à régler chez elle.
- Chaque organisation a une **adresse d'expédition sur le domaine de Symbola**, qu'elle
  personnalise : `atelier-camille@<domaine d'envoi de Symbola>`. Les **réponses** vont à son
  adresse de contact, ce qui existe déjà (lot 38).
- Le domaine : Julien a écrit `symbola.com`, mais le projet utilise `symbola.fr`. Voir D1.

## Exigences

- **MSG-03** (P1) — Fil de discussion par évènement et par sujet ; messages internes et partagés
  visuellement distincts. *Critère* : un message interne ne peut pas partir au client par erreur.
- **POR-06** (P1) — Messagerie par sujet dans le portail, avec pièces jointes. *Critère* : le client
  retrouve une réponse sans chercher dans ses e-mails.
- **MSG-04** (P1, **Divergent**, décision du 19/11) — Une adresse d'expédition personnalisée sur le
  domaine de Symbola, à la place de l'envoi depuis le domaine de la planner.
- **MSG-05** (P1) — Journal des envois : remis, rejeté. *Critère* : un rejet remonte en alerte sur
  le contact.
- **POR-08** (P1, Partiel) — Portail aux couleurs de la planner : couleurs et logo en V1 ; le domaine
  personnalisé est en V2, hors périmètre.
- **POR-11** (P1) — Portail installable sur l'écran d'accueil, avec notifications. *Critère*
  : l'installation se propose après la deuxième visite, pas avant.

## Ce qui existe aujourd'hui

- **E-mails de service** (lot 38, ADR 0072) :
  - le nom affiché est celui de l'organisation, les réponses vont à son adresse de contact ;
  - l'expéditeur unique est `SMTP_FROM` (IONOS en production, Mailpit en dev) ;
  - la file des envois et l'adaptateur sont ceux du lot 40b (ADR 0076).
- **« Écrire au client »** (lot 38b) et envoi depuis Symbola (lot 45), rangés dans l'historique du
  contact.
- **Logo et couleurs** de l'organisation sur les documents (lots 17 et 38).
- **Notifications push** pour la planner (lot 53, web-push).
- **Service worker** limité au jour J (ADR 0064). Le portail n'a ni manifeste propre ni
  installation.

## Partie A — Fils de discussion (MSG-03, POR-06 ; D3)

- **Sur un évènement**, des **sujets** (« Traiteur », « Cérémonie », « Paiements »), chacun avec son
  fil. Un message porte :
  - un texte ;
  - des **pièces jointes**, contrôlées comme les autres fichiers (ADR 0027) ;
  - une **visibilité** : **interne** (équipe seulement) ou **partagé** (client, et prestataire si
    la planner l'ajoute au sujet).
- **Distinction visuelle** : un message interne a un fond et une étiquette « Interne ».
- **Garde** (critère) : le champ d'écriture d'un message partagé et celui d'un message interne sont
  deux zones distinctes, et le bouton dit à qui le message part (« Envoyer à Léa et Maxime »). Un
  message interne n'a **aucun** chemin vers un destinataire extérieur : contrôle serveur, testé.
- **Dans le portail** : la rubrique « Messages » (fermée par défaut, POR-10) montre les sujets
  partagés. Le client répond et joint un fichier.
- **Notification** :
  - le client et la planner reçoivent un e-mail « Nouveau message sur <sujet> », avec un lien
    vers le fil et sans le contenu ;
  - la planner reçoit aussi la notification du lot 53.

## Partie B — L'adresse d'expédition personnalisée (MSG-04 révisée ; D1, D2)

- Chaque organisation choisit son **adresse d'expédition** : `<partie locale>@<domaine d'envoi>`.
  Elle est proposée depuis son nom (`atelier-camille`), unique, en minuscules, et modifiable. Le
  nom affiché reste celui de l'organisation.
- Tous les e-mails de l'organisation (portail, relances, propositions, notifications) partent de
  cette adresse ; les réponses vont à son adresse de contact.
- **Réserve technique** (D2) : le service d'envoi doit accepter **n'importe quelle partie locale**
  du domaine d'envoi, et rendre compte de la remise (MSG-05). IONOS impose en pratique une boîte
  ou un alias par adresse d'expédition, et ne donne pas de compte rendu de remise.

## Partie C — Journal des envois (MSG-05 ; D2)

- Chaque envoi a un statut : **envoyé**, **remis**, **rejeté** (adresse inexistante, boîte
  pleine), ou **plainte** (marqué comme indésirable).
- Le statut arrive par le **webhook** du service d'envoi, signé et vérifié (SEC-19).
- **Un rejet remonte en alerte sur le contact** (critère) : un bandeau « L'adresse de Léa est
  rejetée », et une notification à la planner.
- Le journal est visible par l'organisation, par contact et par évènement. Il est gardé 13 mois,
  puis purgé, sans contenu, seulement l'objet et le statut.

## Partie D — Portail aux couleurs et installable (POR-08, POR-11 ; D4)

- **Couleurs** : la couleur principale et la couleur d'accent de l'organisation, déjà réglées pour
  les documents, s'appliquent au portail. Le **contraste est contrôlé** : une couleur trop claire
  est assombrie pour garder 4,5:1 (UX-14). Le logo apparaît en tête.
- **Installation** (critère) : le portail a son manifeste, avec le nom et les couleurs de
  l'organisation et son logo en icône. La proposition « Ajouter à l'écran d'accueil » n'apparaît
  **qu'à la deuxième visite** ; une fois refusée, elle ne revient pas avant 30 jours.
- **Notifications du portail** : le client peut activer le push (lot 53) pour les nouveaux
  messages et les décisions demandées. C'est facultatif, désactivé par défaut. Sur iPhone, le push
  ne marche qu'une fois le portail installé, et l'écran l'explique.

## Décisions à prendre

- **D1 — Le domaine d'envoi.**
  - (a) Un **sous-domaine dédié** du domaine de Symbola, par exemple
    `atelier-camille@envoi.symbola.fr`, avec son SPF, son DKIM et son DMARC. Le domaine principal
    est ainsi protégé si un client signale un e-mail comme indésirable.
  - (b) Le domaine principal : `atelier-camille@symbola.fr`.
  - (c) `symbola.com`, comme écrit dans ta phrase, si tu as ce domaine.

  **Recommandation : (a).** C'est la pratique courante des services qui envoient au nom de leurs
  clients. Tu possèdes `symbola.fr` (registraire tiers) ; dis-moi si `symbola.com` existe aussi.
- **D2 — Le service d'envoi.** Nouveau sous-traitant possible.
  - (a) Un service d'envoi européen qui accepte toute adresse du domaine vérifié et donne des
    webhooks de remise et de rejet, par SMTP pour ne pas ajouter de dépendance au code. Exemples :
    **Scaleway Transactional Email** (France), **Brevo** (France), **Mailjet** (France). Le choix est
    le tien, par un comparatif court, comme pour le paiement.
  - (b) Garder IONOS : il faut un alias créé à la main par organisation, et MSG-05 devient
    impossible (pas de rapport de remise).

  **Recommandation : (a)**, avec un comparatif à te présenter avant le code. Sans webhook de
  remise, MSG-05 ne tient pas.
- **D3 — Messages internes et partagés.**
  - (a) Deux zones d'écriture distinctes, un bouton qui nomme les destinataires, et un contrôle
    serveur qui interdit toute sortie d'un message interne.
  - (b) Une case « interne » sur un seul champ.

  **Recommandation : (a).** Une case oubliée suffit à envoyer une note interne au client ; le
  critère l'interdit.
- **D4 — Les couleurs du portail.**
  - (a) Reprises des réglages existants, contraste corrigé automatiquement.
  - (b) Couleurs libres sans contrôle.

  **Recommandation : (a)**, à cause d'UX-14 et de l'accessibilité du portail (lot 40c).

## Points pour les conseils

- **DPO** :
  - nouveau sous-traitant d'envoi (D2) : contrat, lieu d'hébergement dans l'UE, liste des
    sous-traitants ;
  - le journal des envois garde des adresses e-mail pendant 13 mois.
- **Avocat** : rien.

## Migrations (prévision)

- **`events`** :
  - `message_topics` (évènement, nom, participants) ;
  - `messages` (sujet, auteur, visibilité interne ou partagée, texte, pièces jointes) ;
  - rubrique « Messages » dans `event_links_rubrics_check`.
- **`hub`** :
  - adresse d'expédition de l'organisation (partie locale unique) ;
  - `email_deliveries` (envoi, destinataire haché pour la recherche, statut, motif, le) ;
  - natures d'e-mails (« nouveau message »).
- Configuration : `SMTP_FROM_DOMAIN`, secret du webhook du service d'envoi (validés au démarrage).

## Tests (prévision)

- **MSG-03** : un message interne n'atteint jamais un client ou un prestataire, même par une
  requête forgée (test d'abus) ; la distinction est visible (Playwright, axe-core).
- **POR-06** : le client lit et répond dans le portail, avec pièce jointe (contrôles de l'ADR 0027),
  sur ordinateur et à 375 px.
- **MSG-04** : adresse d'expédition unique, utilisée pour tous les envois de l'organisation ;
  réponses vers l'adresse de contact.
- **MSG-05** : webhook signé (et refus si mal signé) ; rejet qui crée l'alerte sur le contact ;
  purge à 13 mois.
- **POR-08** : couleurs appliquées, contraste corrigé (test de calcul).
- **POR-11** : proposition d'installation à la deuxième visite seulement ; manifeste aux couleurs
  de l'organisation.
- **Isolation et abus** (SEC-36) sur chaque table neuve.

## Hors périmètre

- Envoi depuis le domaine de la planner (décision du 19/11).
- Domaine personnalisé du portail (POR-08, V2).
- Messagerie en temps réel : les fils se rafraîchissent à l'ouverture et toutes les 30 s.
