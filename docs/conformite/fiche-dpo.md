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
