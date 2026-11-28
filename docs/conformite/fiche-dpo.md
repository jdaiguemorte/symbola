# Fiche pour le délégué à la protection des données — Symbola

Préparée le 11 novembre 2026 pour Julien, éditeur de Symbola. Brouillon à relire avant envoi.

## Pourquoi cette fiche

Symbola est un logiciel en ligne pour les organisateurs d'évènements, d'abord les wedding planners.
Il garde, pour chaque planner, les données de ses prospects, de ses clients et de ses
prestataires. Bientôt, il gardera aussi celles des invités de chaque évènement, dont leurs régimes
alimentaires et leurs allergies. Plusieurs choix de protection des données changent le
fonctionnement du logiciel. Nous ne voulons pas les trancher nous-mêmes. Chaque question appelle
une réponse courte. À côté, nous indiquons ce que fera Symbola selon votre réponse.

## Ce que fait Symbola aujourd'hui, et ce qui est prévu

- **Hébergement** : un serveur dans l'Union européenne. Les sauvegardes chiffrées vont chez un
  second fournisseur européen. La signature électronique est hébergée par nos soins. Pour placer
  les adresses des prestataires sur une carte, Symbola interroge le service public de géocodage de
  l'IGN. Le service d'envoi d'e-mails n'est pas encore choisi : il sera européen.
- **Personnes concernées** : prospects, clients (couples, parents payeurs, entreprises),
  prestataires et, plus tard, invités, enfants compris.
- **Outils RGPD du planner** :
  - recherche d'une personne dans tous les modules ;
  - export de ses données ;
  - effacement ou anonymisation, avec une preuve horodatée ;
  - suivi des demandes et de leurs échéances ;
  - purge mensuelle des données arrivées à échéance. Aujourd'hui elle attend la validation du
    planner ; elle deviendra automatique, avec un préavis.
- **Durées par défaut, réglables par le planner** : prospects, 3 ans après le dernier contact venu
  d'eux ; clients, 3 ans après la fin de la relation ; pièces comptables, 10 ans ; comptes de
  clients inactifs, 2 ans ; preuve d'une demande RGPD close, 5 ans.
- **Prévu pour les tiers** : clients, prestataires et invités n'auront pas de compte. Ils
  agiront par un lien personnel :
  - un jeton aléatoire d'au moins 128 bits, stocké haché ;
  - limité à une personne, un évènement et des droits précis ;
  - qui expire ;
  - avec un code à usage unique pour les actions sensibles : signer, payer, voir le budget.
- **Mesure d'usage** : compteurs agrégés, sans cookie tiers ni identifiant personnel. Aucun traceur
  publicitaire.

## Questions

### 1. Qui est responsable de quoi

- Confirmez-vous ce partage : le planner est responsable de traitement pour ses prospects,
  clients, prestataires et invités, et Symbola est son sous-traitant ?
- Symbola est-il responsable de traitement pour les comptes, l'abonnement et l'assistance ?
- Une offre est envisagée pour les couples qui organisent seuls leur mariage. Quel est alors le
  rôle de Symbola ?

> **Symbola** : l'accord de sous-traitance et la politique de confidentialité suivront ce partage.

### 2. Données des invités : base légale et durée

Nous prévoyons l'intérêt légitime du client et du planner comme base légale. Les données
seraient purgées 30 jours après l'évènement, avec un préavis de sept jours au planner. Il pourrait
reporter la purge, en donnant un motif. La base et la durée vous conviennent-elles ?

> **Symbola** : la purge efface aussi les exports et les copies gardées sur les téléphones.

### 3. Régimes alimentaires et allergies

- Ces informations sont-elles des données de santé au sens de l'article 9 ?
- Prévu : une liste fermée paramétrable, une case d'accord non précochée et un texte clair sur
  l'usage et les destinataires (le traiteur). L'accès est limité aux membres autorisés, et le
  champ est chiffré. Est-ce suffisant ? Qui recueille et garde la preuve de l'accord : le
  planner, ou Symbola pour son compte ?

> **Symbola** : sans accord, la donnée n'est pas enregistrée. Un assistant sans droit voit le
> nombre de régimes, pas les noms.

### 4. Enfants invités

Nous prévoyons de limiter leurs données au prénom, à une tranche d'âge et au régime alimentaire,
saisis par un adulte du foyer, sans aucun moyen de contact direct. Est-ce adapté ?

### 5. Analyse d'impact

- Une analyse d'impact est-elle obligatoire ? Pour Symbola, comme sous-traitant qui héberge les
  données de nombreux planners ? Pour chaque planner ?
- Avant quelle étape : la première donnée réelle, ou l'ouverture commerciale ?
- Pouvons-nous fournir aux planners un modèle d'analyse, comme nous fournirons un registre des
  traitements prérempli ?

> **Symbola** : l'analyse sera versée dans `docs/conformite/`, et le modèle mis à disposition des
> planners.

### 6. Durées de conservation par défaut

Validez-vous les durées listées plus haut, ainsi que 6 à 12 mois pour les journaux de sécurité et
13 mois pour la mesure d'usage ? La purge automatique avec préavis remplace la validation mensuelle
par le planner : ce choix vous convient-il ?

### 7. Liens personnels sans compte

Le dispositif décrit plus haut (jeton haché, portée limitée, expiration, code à usage unique pour
les actions sensibles, pages exclues des moteurs de recherche) vous paraît-il assurer un niveau de
sécurité adapté, au sens de l'article 32 ? Un lien transféré par le client à un proche est le
risque principal.

> **Symbola** (lot 26a, 12/11/2026) : en place pour le client et le parent payeur. Jeton de 256 bits
> dont seul le haché est gardé, placé après « # » dans l'adresse (jamais transmis au serveur ni
> écrit dans un journal), retiré de l'adresse dès l'ouverture ; droits par personne (rubriques,
> catégories du budget) ; expiration 30 jours après l'événement ; retrait immédiat ; pages non
> indexées. Chaque page du portail affiche une **mention d'information** au nom du planner
> (`packages/starter-templates/src/link-privacy-notice.json`), que le planner peut adapter dans
> ses réglages RGPD. **Ce texte de départ est à relire** : contenu (finalité, base légale,
> durée, droits, réclamation à la CNIL) et formulation.

### 8. Accord de sous-traitance et sous-traitants ultérieurs

Quel contenu minimal pour l'accord ? Quel préavis avant de changer de sous-traitant ultérieur ? La
liste publique et datée des sous-traitants suffit-elle pour informer les planners ?

### 9. Violation de données

Nous prévoyons :

- un registre des incidents ;
- une information du planner sans délai, pour qu'il puisse notifier la CNIL dans les 72 heures ;
- des modèles de notification fournis.

Faut-il fixer un délai précis pour informer le planner ? Quels éléments doivent y figurer ?

### 10. Relances de prospects par e-mail

Symbola enverra des relances automatiques aux prospects qui ont demandé un devis, et elles
s'arrêtent dès qu'ils répondent. Est-ce de la prospection commerciale, qui exige l'accord de la
personne ou une exception légale, un lien de désinscription et une liste d'opposition ?

> **Symbola** : chaque message porte un lien de désinscription, et une adresse en opposition ne
> reçoit plus aucun envoi commercial.

### 11. Journal d'audit et adresses IP des connexions

Symbola tient un journal d'audit en ajout seul : connexions, changements de droits, exports,
partages, factures émises, encaissements et suppressions, ainsi que chaque accès de l'équipe
Symbola à la base, avec son motif. Le journal ne contient aucun nom ni e-mail : l'identifiant du
compte, l'action, l'objet et la date. L'adresse IP d'une connexion est gardée à part, illisible
par l'application et par la titulaire, pour l'enquête en cas d'incident (compte piraté,
notification d'une violation).

- Quelle durée de conservation pour le journal d'audit, famille par famille (connexions,
  autres gestes) ?
- Douze mois pour les adresses IP des connexions vous conviennent-ils (la recommandation de la
  CNIL sur la journalisation va de six mois à un an) ?
- La titulaire lit les connexions de ses collaborateurs (sans adresse IP) : faut-il les en
  informer, et sous quelle forme ?

> **Symbola** : rien n'est purgé du journal tant que vous n'avez pas fixé ces durées ; les
> adresses IP le sont après la durée réglée, douze mois par défaut.

## Ce dont nous avons besoin

Des réponses écrites, même brèves, à chaque question numérotée.

- **Avant de construire le module Invités** : questions 2 à 4.
- **Avant les liens personnels** : question 7.
- **Avant l'ouverture commerciale** : questions 1, 5, 6, 8, 9, 10 et 11.

## Réponses reçues le 13 novembre 2026

La DPO a répondu aux questions 1 à 10, puis le même jour à la question 11, posée à part ; Julien
confirme que ses réponses ont été vérifiées. La note reste hors de ce dépôt, qui est public ; ce
qui suit est ce que Symbola en retient. Suites : `docs/QUESTIONS.md` (Q35).

| Q | Ce que Symbola retient | Où |
| --- | --- | --- |
| 1 | Partage confirmé : le planner est responsable de traitement (prospects, clients, prestataires, invités), Symbola son sous-traitant ; Symbola est responsable pour les comptes, l'abonnement, la facturation, l'assistance, les journaux de sécurité et sa propre prospection. Toute réutilisation des données des planners est interdite par défaut dans l'accord. Évènement d'entreprise : Symbola peut être sous-traitant ultérieur, l'accord prévoit la chaîne. Offre « couples » : Symbola très probablement responsable de traitement ; produit distinct, avec sa politique de confidentialité. | Accord de sous-traitance ; offre couples (V2) |
| 2 | Invités : intérêt légitime (du planner et du couple), avec un test de mise en balance documenté ; information de l'invité dès le premier contact (art. 14) et droit d'opposition. Purge 30 jours après l'évènement avec 7 jours de préavis, mais régimes et allergies purgés plus tôt (7 jours après) ; un seul report, 90 jours au plus ; gel pour litige à part, accès restreint. Sauvegardes : rotation de 35 jours au plus, et rejouer le journal des effacements après toute restauration. Exports transmis au traiteur : clause du planner et information des destinataires (art. 19). | Lot 49 ; sauvegardes (Q35) |
| 3 | Régimes et allergies : données de l'article 9, tout le champ. L'accord vient de l'invité lui-même par son lien (ou du titulaire de l'autorité parentale), jamais du client qui saisit la liste ; Symbola conserve la preuve pour le planner (horodatage, version du texte, canal) ; retrait aussi simple que l'accord ; pas de champ libre ; transmission au traiteur limitée ; compteur agrégé qui ne dévoile pas un régime unique dans un petit groupe. | Lot 49 (RGP-06, RGP-07) |
| 4 | Enfants : prénom, tranche d'âge et régime conviennent ; le régime n'est enregistré que si la personne qui saisit déclare être le représentant légal ; ni compte ni lien pour un enfant. | Lot 49 (RGP-18) |
| 5 | Analyse d'impact obligatoire (données sensibles, personnes vulnérables), à faire par chaque planner avant la première donnée réelle d'invité. Symbola fournit une analyse « socle » du module Invités (outil de la CNIL) que chaque planner complète, et un registre prérempli ; Symbola tient son registre de sous-traitant (art. 30.2). | Avant l'ouverture du lot 49 (RGP-19) |
| 6 | Durées validées (prospects 3 ans, clients 3 ans, pièces comptables 10 ans, journaux 6 à 12 mois, mesure d'usage 13 mois, preuve d'une demande 5 ans). Distinguer la base active de l'archivage intermédiaire. Supprimer la copie d'une pièce d'identité après vérification. Purge automatique avec préavis validée, inscrite dans l'accord comme instruction du planner, avec export avant purge, journal et corbeille courte. | Lots 34 et 35 |
| 7 | Dispositif des liens validé (art. 32), avec ajouts : code à usage unique aussi pour voir et modifier les données sensibles, envoyé au seul contact enregistré ; limitation des tentatives, code à courte durée, révocation par le planner et par la personne, alerte sur un nouvel appareil ; avertir que le lien est personnel et n'afficher que les données de la personne. Déjà en place : jeton retiré de l'adresse, `Referrer-Policy: no-referrer` et `X-Robots-Tag: noindex` sur les pages à lien. | Lot 43 (SEC-16), lot 49 |
| 8 | Contenu minimal de l'accord de sous-traitance (art. 28.3) ; changement de sous-traitant ultérieur annoncé 30 jours avant (15 jours pour une urgence de sécurité), opposition motivée, résiliation sans pénalité ; liste publique complétée d'un abonnement par e-mail. Géocodage : l'adresse seule (déjà le cas) ; étudier une base d'adresses locale. | Accord de sous-traitance (Q35) |
| 9 | Violation : alerte initiale au planner sous 24 heures, puis compléments ; contenu minimal fixé ; liste des enregistrements touchés par planner ; modèles de notification. C'est le planner qui notifie la CNIL. | Lot 57 (RGP-12) |
| 11 | Journal d'audit : « rien n'est purgé » est une conservation sans limite, **non conforme, à corriger dès maintenant**, même provisoirement. Trois durées : 12 mois glissants pour les gestes courants (connexions, droits, exports, partages, suppressions) ; 3 ans pour les accès de l'équipe Symbola à la base (risque documenté, procédure d'analyse écrite) ; la durée des pièces comptables pour les factures et encaissements, dans un flux à part. Journal découpé par date, segments supprimés à l'échéance, points de contrôle d'intégrité. Une ligne de suppression peut rester comme preuve d'effacement si la correspondance identifiant-personne disparaît. Adresses IP à 12 mois validées, à conditions : un seul exemplaire (aucune copie plus longue chez le proxy ou le service d'e-mails), finalité unique, accès par un rôle nommé avec motif journalisé, procédure pour les remettre à la personne qui les demande, mention dans la politique de confidentialité, même règle pour les connexions par lien. Collaborateurs : notice de Symbola à l'invitation et à la première connexion, consultable depuis le profil ; mention type fournie à la titulaire pour informer ses collaborateurs (consultation du CSE s'il existe) ; chacun voit son propre journal ; le journal de la titulaire sert la sécurité, pas le suivi du temps de travail. | Lot à part, avant les données réelles (Q35) |
| 10 | Relances automatiques de devis = prospection. Particuliers : consentement préalable (case non précochée au formulaire de demande, preuve gardée). Entreprises : sans consentement si le message touche leur activité, avec origine des données et opposition simple. Identifier le planner comme expéditeur, informer à la collecte, listes d'opposition par planner ou commune. | Lot 45 (CRM-06, RGP-17) |

## Question du 15 novembre 2026 (lot 35)

### 12. Effacement à la fin de l'abonnement

À la résiliation, la Propriétaire fermera son espace :

- pendant 30 jours, elle peut encore tout exporter, et un e-mail la prévient avant la fin ;
- ensuite, Symbola supprime l'espace et ses fichiers.

- **Effacement complet.** Confirmez-vous que Symbola, sous-traitant (réponse 1), efface toutes les
  données de la planner 30 jours après la fermeture, après lui avoir proposé l'export ? C'est
  l'article 28.3 g : rendre ou supprimer.
- **Pièces gardées.** L'avocat est interrogé sur les pièces que Symbola devrait peut-être garder
  (factures, contrats signés et dossiers de preuve). S'il conclut qu'il faut en garder, à quelles
  conditions Symbola peut-il le faire : accès, durée, information de la planner et des personnes ?
- **Trace de la suppression.** Pour rejouer l'effacement après une restauration (réponse 2),
  Symbola garde une trace de chaque suppression : identifiant de l'organisation, dates de
  fermeture et de suppression, sans donnée personnelle. Combien de temps la garder ? Faut-il en
  parler dans l'accord de sous-traitance ?

> **Symbola** : la fermeture d'un espace ne sera développée qu'après votre réponse et celle de
> l'avocat. La durée de rotation des sauvegardes (réponse 2 : 35 jours au plus) est une décision
> déjà en cours chez Julien (`docs/QUESTIONS.md`, Q35).

Besoin : une réponse **avant de développer la fermeture d'un espace** (lot 35c).

**Décision de Julien (18/11/2026)** : (a). Symbola efface tout au 30e jour ; l'export reste
proposé jusqu'au dernier jour. **La clause de réversibilité** (délai, préavis, format, sort des
données) **sera écrite à la création officielle de la société**, avec les conditions de
l'éditeur. Le lot 35c peut se coder.

**Livré au lot 35c (19/11/2026, ADR 0100)** : fermeture par la Propriétaire (double
authentification, nom de l'espace), export jusqu'au dernier jour, e-mail à la fermeture et sept jours
avant ; au 30e jour, tout est effacé, fichiers et comptes de l'équipe compris (ceux qui n'ont pas
d'autre espace, chez le fournisseur d'identité aussi). **Délai maximal** : les données effacées
disparaissent des sauvegardes au bout de leur cycle, 35 jours au plus (ADR 0092), soit au plus
65 jours après la fermeture. **Trace** : identifiant de l'organisation et dates, sans donnée
personnelle, gardée sans limite de durée pour rejouer l'effacement après une restauration ; sa durée
et sa mention dans l'accord de sous-traitance restent à fixer avec la clause de réversibilité.

## Questions du 18 novembre 2026 (lot 46, rendez-vous)

### 13. Page publique de réservation et agenda de la planner

Le module Rendez-vous ouvre une page publique où un futur client choisit un créneau libre, sans
compte. Les créneaux tiennent compte de l'agenda personnel de la planner (Google, Apple, Outlook),
lu toutes les quinze minutes par son adresse secrète.

- **DPO-1 — Lecture de l'agenda de la planner.** Symbola ne garde de cet agenda que les heures
  occupées (début et fin), de la veille à l'horizon de réservation, remplacées à chaque lecture :
  ni titre, ni lieu, ni participants. L'adresse est chiffrée et ne se réaffiche jamais. Faut-il une
  information particulière pour la planner elle-même (ou pour chaque personne de son équipe qui
  relie son agenda) ? Rien sur les tiers de son agenda n'est gardé.
- **DPO-2 — Durée de conservation d'une personne qui a seulement pris rendez-vous**, sans suite (ni
  évènement, ni devis). Nous appliquons la règle des prospects : trois ans après son dernier
  échange (le plus récent de ses rendez-vous), puis la ligne entre dans la purge mensuelle, validée
  par la titulaire. Cette règle convient-elle, ou faut-il plus court ?
- **DPO-3 — Mention d'information de la page de réservation**, au nom de la planner. Texte de départ
  proposé (la planner peut le remplacer) :

  > {organisation} utilise les informations de ce formulaire (votre nom, votre adresse e-mail,
  > votre téléphone si vous le donnez et vos réponses) pour organiser ce rendez-vous et vous
  > recontacter à son sujet, à votre demande. Elles sont gardées trois ans après votre dernier
  > échange avec {organisation} si aucun projet ne suit, puis supprimées. Vous pouvez y accéder,
  > les faire corriger ou effacer, ou vous opposer à leur utilisation en écrivant à {contact}. Vous
  > pouvez aussi adresser une réclamation à la CNIL (www.cnil.fr). Symbola héberge ces données pour
  > le compte de {organisation}.

  Convient-il (finalité, base, durée, droits, réclamation) ? Faut-il nommer la base légale
  (mesures précontractuelles prises à la demande de la personne) ?

> **Symbola** : en attendant vos réponses, le module reste fermé par défaut (seule l'Exploitation
> l'ouvre), le texte ci-dessus s'affiche à titre provisoire et la règle des prospects s'applique.
> Aucune donnée réelle avant votre relecture de DPO-3.

Besoin : une réponse **avant d'ouvrir le module Rendez-vous à la pilote**.

## Question du 18 novembre 2026 (lot 49)

### 14. Module Invités : six points avant l'ouverture à la pilote

Le module Invités applique vos réponses 2 à 5 (13 novembre) : intérêt légitime et information au
premier contact, accord de l'invité lui-même pour les régimes (preuve gardée : horodatage, version
du texte, canal), aucun lien ni contact pour un enfant, purge des régimes 7 jours après
l'évènement et du reste 30 jours après, avec préavis et un seul report de 90 jours au plus. Le
module reste fermé chez la pilote tant que l'analyse d'impact n'est pas faite. Six points
restent ouverts ; Symbola n'en tranche aucun et applique d'ici là le réglage le plus prudent.

- **DPO-1 — Régimes à caractère religieux.** Halal, casher, sans porc… révèlent une conviction
  religieuse (autre catégorie de l'article 9). Ils sont **absents de la liste de départ** ; la
  planner peut en ajouter un, sous sa responsabilité, après un avertissement à l'écran. Faut-il
  les proposer, et à quelle condition (texte d'accord distinct, information renforcée) ?
- **DPO-2 — Accompagnant adulte sans moyen de contact.** Un adulte sans e-mail ni téléphone n'a
  pas de lien personnel : son régime reste vide. Le répondant du foyer peut-il le donner pour lui,
  avec une déclaration (« il m'a demandé de répondre pour lui ») ? Sinon, la règle actuelle reste.
- **DPO-3 — Opposition d'un invité.** Au clic sur « Je ne souhaite pas que mes données soient
  conservées », ses coordonnées et ses régimes sont effacés aussitôt et il ne reçoit plus rien ;
  sa **présence déjà donnée reste, sous son seul nom**, jusqu'à la purge (le plan de table et le
  traiteur en dépendent). Faut-il effacer aussi cette présence ?
- **DPO-4 — Textes de départ.** La mention d'information de la page de réponse (en tête et en
  pied, au nom de la planner et des mariés : qui traite, pourquoi, combien de temps, droits,
  opposition), le passage d'information de l'e-mail d'invitation, et le texte de l'accord aux
  régimes (version « 2026-11-18 », gardée avec chaque preuve) sont dans
  `packages/starter-templates/src/guest-texts.json` et `email-templates.json`. Pouvez-vous les
  relire ? La planner peut remplacer la mention (réglages RGPD) ; le texte de l'accord ne change
  qu'avec une nouvelle version.
- **DPO-5 — Seuil d'agrégation.** Hors titulaire, les régimes s'affichent en nombres par temps
  fort ; un régime porté par une ou deux personnes s'affiche « moins de 3 ». Ce seuil suffit-il,
  y compris pour le client au portail et pour un petit évènement ?
- **DPO-6 — Exports stockés à la purge.** À la purge du reste (J+30), Symbola supprime les archives
  de l'export complet de l'organisation qui comptent des foyers d'invités, et les exports RGPD
  encore gardés, préparés depuis l'ajout du premier foyer ; la titulaire en est prévenue par
  e-mail. Un fichier déjà téléchargé reste sous sa responsabilité (l'écran le rappelle). Est-ce la
  bonne lecture de « la purge efface aussi les exports stockés » ?

> **Symbola** : DPO-1 et DPO-4 sont à trancher **avant d'ouvrir le module à la pilote**, avec
> l'analyse d'impact « socle » que Julien prépare avec vous. Les autres peuvent suivre.

Besoin : une réponse à DPO-1 et DPO-4 avant l'ouverture du module ; aux autres, avant le
lot 50 (plan de table et synthèse pour le traiteur).

## Question du 18 novembre 2026 (lot 50)

### 15. Plan de table et synthèse pour le traiteur

Le lot 50 ajoute au module Invités le plan de table et la synthèse pour le traiteur (repas par
type, régimes et allergènes, par table). La synthèse n'est **jamais gardée dans Symbola** : elle
est calculée à chaque téléchargement, et chaque téléchargement est noté (qui, quand, quelle
version), sans son contenu. La titulaire seule obtient la version nominative ; un membre de
l'équipe obtient des nombres exacts par table, sans aucun nom. Les contraintes de placement
(« ensemble », « séparés ») sont internes : jamais montrées au client, jamais dans une synthèse ni
dans un export. Tout est purgé avec les invités ; à J+7, la synthèse ne contient plus de régime.

- **DPO-7 — Synthèse nominative pour le traiteur.** Nom, table, type de repas et régimes ou
  allergies de chaque personne, exportés par la titulaire et envoyés au traiteur hors de Symbola.
  Le texte d'accord du lot 49 nomme le traiteur parmi les destinataires et la durée de 7 jours
  après l'évènement. Cela suffit-il, ou faut-il rappeler au traiteur une durée de conservation ?
  Symbola applique d'ici là la recommandation de travail : une mention en pied du PDF nominatif
  (« Données transmises pour le service du repas ; à supprimer après l'évènement ») et une phrase à
  l'écran de téléchargement.
- **DPO-8 — Contraintes « séparés ».** Données internes à l'organisation, jamais exportées,
  purgées avec les invités (30 jours après l'évènement). Faut-il une durée plus courte ? Et le
  droit d'accès d'un invité couvre-t-il ces contraintes ? Symbola montre aujourd'hui, dans la
  recherche RGPD, la table d'une personne par temps fort, mais pas ses contraintes.

> **Symbola** : rien n'est tranché ; le réglage le plus prudent s'applique en attendant (mention en
> pied, contraintes jamais exportées). Le module reste fermé chez la pilote (question 14).

Besoin : une réponse avant l'ouverture du module Invités à la pilote.

## Question du 18 novembre 2026 (lot 51)

### 16. Jour J de terrain : photos, main courante, file sur le téléphone

Le lot 51 permet à l'équipe sur place de pointer le programme, de noter des incidents (dictés par le
clavier du téléphone, sans service de reconnaissance vocale) et de prendre des photos : incident,
case d'une liste d'installation, reçu d'une remise. Tout se garde d'abord sur le téléphone, même
sans réseau, puis part au serveur.

- **DPO-9 — Photos prises sur un lieu de mariage.** Des invités peuvent apparaître sur une photo
  d'incident ou de liste. Proposition appliquée en attendant votre avis : les photos restent
  **internes à l'organisation** (jamais montrées aux clients ni aux prestataires, ni dans aucun
  export qui sort de l'organisation, servies par l'app après contrôle des droits) ; l'écran conseille
  de **photographier les choses plutôt que les personnes** ; elles sont **purgées avec les documents
  de l'évènement** (corbeille, durée de conservation, demande d'oubli qui vise l'évènement). Les
  pointages et les incidents sont des données de travail : ni nom d'invité ni donnée de santé ; un
  malaise se note sans le nom de la personne (rappel dans l'aide et sous le champ). Faut-il une durée
  plus courte pour les photos, ou une mention à destination des invités (affichage sur le lieu) ?
- **File sur le téléphone.** Tant qu'elles ne sont pas envoyées, les actions (textes d'incident et
  photos compris) restent dans le navigateur du téléphone, sans chiffrement par l'application
  (verrouillage du téléphone), comme la copie de lecture du lot 29. Elles ne partent qu'avec la
  session de leur auteur ; la file se vide à l'envoi.

> **Symbola** : rien n'est tranché ; le réglage le plus prudent s'applique (photos internes, purge
> avec l'évènement, conseil à l'écran).

Besoin : une réponse avant le premier jour J réel avec photos chez la pilote.

## Pour information : notifications push (lot 53, 18 novembre 2026)

Sans question ouverte (DPO-10, pour information).

- **DPO-10 — Abonnements push et services de push des navigateurs.** Chaque membre de l'équipe peut
  activer, appareil par appareil, les notifications push. Symbola garde alors l'**abonnement** de
  l'appareil : l'adresse du service de push de son navigateur, deux clés publiques et un nom lisible
  (« Safari · iOS »), sans autre identifiant. Ce sont des **données techniques**, déclarées au
  registre : supprimées quand la personne désactive le push, quand le service répond que l'abonnement
  n'existe plus, ou après **90 jours sans usage**. Les services de push des navigateurs (Apple, Google,
  Mozilla) reçoivent seulement un **message chiffré** jusqu'au navigateur (norme Web Push), son heure
  et sa durée de vie (six heures) : la sorte de notification en mots et l'écran à ouvrir, **jamais de
  nom, d'adresse, de téléphone ni de montant**. Ils sont notés comme **destinataires techniques** dans
  la liste des sous-traitants. Les notifications elles-mêmes (centre de l'application, e-mails à
  l'équipe) sont effacées 90 jours après leur création ; l'objet d'un e-mail ne dit que la sorte.

## Question du 19 novembre 2026 (lot 55, messagerie et journal des envois)

- **DPO-11 — Nouveau sous-traitant : Scaleway Transactional Email (pour information).** Julien a
  retenu le 19/11/2026 **Scaleway Transactional Email** (Scaleway SAS, France), formule Essential, après
  un comparatif (Scaleway, Brevo, Mailjet, Lettermint). Il remplacera IONOS pour envoyer chaque
  organisation depuis sa propre adresse sur un sous-domaine de Symbola (`atelier-camille@envoi.symbola.fr`)
  et rendre compte de la remise. Il reçoit l'adresse du destinataire et le contenu des e-mails, comme
  IONOS aujourd'hui ; il garde les métadonnées d'envoi (destinataire, statut) tant que le domaine
  d'envoi est actif. Hébergement à **Paris (région fr-par)**, rien répliqué hors de l'Union européenne,
  **aucun sous-traitant dédié** au contenu des e-mails, selon la documentation « Data privacy » du
  service. Garanties contractuelles : le **contrat de sous-traitance (DPA) général de Scaleway** et les
  **conditions propres à Transactional Email**, acceptés dans la console avant l'activation. Les
  rapports de remise arrivent par le service Topics and Events de Scaleway (même hébergement), signés
  par un certificat de Scaleway que Symbola vérifie. Déclaré dans `docs/conformite/sous-traitants.md`.
  Si vous voyez une vérification à faire avant l'activation (liste des sous-traitants de Scaleway,
  transferts), dites-le-nous.
- **DPO-12 — Journal des envois gardé 13 mois.** Pour chaque e-mail envoyé au nom d'une organisation,
  Symbola garde l'adresse du destinataire (et son empreinte), l'objet, la nature et le statut
  (envoyé, remis, rejeté, plainte), jamais le corps, **13 mois** après l'envoi, puis l'efface. Il
  sert à prévenir la planner d'une adresse rejetée (bandeau sur la fiche du contact) ; il est trouvé
  et effacé par une demande RGPD. Question : la durée de 13 mois vous convient-elle ?
- **Pour information — messagerie et push du portail.** Les messages d'un sujet (et leurs pièces
  jointes) vivent avec l'évènement, déclarés au registre ; une note interne ne sort jamais vers un
  client ou un prestataire ; l'e-mail qui annonce un message n'en reprend pas le contenu. Le push du
  portail est facultatif et désactivé par défaut, avec les mêmes garanties que DPO-10 (message chiffré,
  la sorte seulement, abonnement supprimé à la désactivation ou avec le lien).

## Pour information : relances des prospects (lot 45, 18 novembre 2026)

Sans question ouverte. **Décision de Julien (18/11/2026)**, contraire à votre réponse 10 : les
relances d'un prospect qui a fait une demande sont la suite de sa demande, pas de la prospection,
puisque la première approche vient toujours des mariés ; ni case d'accord au formulaire de contact, ni
liste d'opposition par planner (RGP-17 « Sans objet »). Les relances restent préparées et validées par
la planner (envoi automatique seulement en réglage), chacune porte « Vous ne souhaitez plus de
nouvelles ? Répondez simplement. », et la planner a un geste « Ne plus relancer »
(`docs/QUESTIONS.md`, Q39 ; ADR 0090).

## Pour information : l'annuaire d'un programme repris (lot 71, 28 novembre 2026)

Sans question ouverte ; à confirmer si vous le souhaitez. Le PDF du programme du jour J d'un ancien
logiciel porte un annuaire des intervenants (nom, rôle, téléphone), qui peut nommer des proches du
couple (témoins, famille). **Décision de Julien (27/11/2026, I4)** : l'annuaire est gardé à part, avec
l'import, **90 jours au plus**, pour être proposé au carnet depuis le bilan ; il est effacé plus tôt
quand la planner l'ajoute au carnet ou retire l'import, et n'est jamais exporté. « Ajouter au carnet »
n'ajoute que les professionnels (le téléphone d'une fiche existante, ou une fiche créée) : les mariés et
l'agence sont écartés ; les fiches ajoutées suivent ensuite la conservation du carnet. Les PDF eux-mêmes
ne sont jamais gardés : seul ce qui a été lu attend la confirmation, dans le brouillon de l'import.
