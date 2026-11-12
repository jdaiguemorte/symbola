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
