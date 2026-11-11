# Fiche pour l'expert-comptable — facturation et fiscalité dans Symbola

Préparée le 11 novembre 2026 pour Julien, éditeur de Symbola. Brouillon à relire avant envoi.

## Pourquoi cette fiche

Symbola est un logiciel de gestion pour les organisateurs d'évènements, d'abord les wedding
planners. Il produit leurs devis et leurs factures, et enregistre ce que leurs clients leur paient.
Plusieurs règles fiscales changent la façon dont le logiciel doit se comporter. Nous ne voulons pas
les trancher nous-mêmes. Chaque question ci-dessous appelle une réponse courte. À côté, nous
indiquons ce que fera Symbola selon votre réponse.

## Ce que fait Symbola aujourd'hui

- **Clients** : surtout des particuliers (des couples), parfois des entreprises.
- **Devis** : numérotés, avec des versions successives. Une version envoyée ne change plus.
- **Factures** :
  - une facture par acompte de l'échéancier du devis, puis une facture de solde qui déduit les
    acomptes déjà facturés ;
  - une numérotation continue, sans trou, par série et par année ;
  - une facture émise ne se modifie ni ne se supprime : une erreur se corrige par un avoir ;
  - les données de la facture sont figées à l'émission, et le PDF est redessiné à l'identique à
    partir de ces données.
- **Mentions imprimées** :
  - vendeur : nom, adresse, SIREN ou SIRET, RCS ou RM, capital, numéro de TVA ;
  - client : nom et adresse de facturation ;
  - document : numéro, date d'émission, date de la prestation ou de l'acompte, date d'échéance ;
  - lignes et totaux : lignes HT avec taux de TVA, totaux HT, TVA et TTC ;
  - « TVA non applicable, art. 293 B du CGI » ajoutée d'office en franchise en base ;
  - conditions de paiement, avec ce texte de départ, modifiable : « à réception de la facture, par
    virement bancaire. Aucun escompte pour paiement anticipé. En cas de retard de paiement, des
    pénalités au taux d'intérêt légal peuvent être appliquées. »
- **Encaissements** : le planner les saisit à la main (date et mode de paiement). Il n'y a pas
  encore de paiement en ligne.
- **Export « e-reporting »** : un fichier CSV par période. Une ligne par facture, avoir ou
  encaissement : type, date, numéro, référence, libellé, HT, TVA, TTC, mode de paiement.
- **Pas encore fait** : facture au format Factur-X, connexion à une plateforme agréée.
  Aujourd'hui, une facture à un client professionnel est refusée tant que Factur-X n'existe pas.

## Questions

### 1. Mentions obligatoires des devis et des factures

La liste ci-dessus est-elle complète :

- (a) pour une micro-entreprise en franchise en base de TVA ;
- (b) pour une société assujettie à la TVA ?

Quelles mentions manquent ? Le texte de départ des conditions de paiement prévoit des pénalités
« au taux d'intérêt légal » et ne parle pas de l'indemnité forfaitaire de recouvrement : est-ce
suffisant pour un client professionnel ?

> **Symbola** : chaque mention manquante devient un champ obligatoire de l'organisation. La facture
> ne peut pas être émise tant qu'il manque, et le message nomme le champ.

### 2. Mentions ajoutées par la réforme au 1er septembre 2027

Ces mentions sont : le SIREN du client, l'adresse de livraison si elle diffère, la nature de
l'opération (biens ou services) et l'option pour la TVA sur les débits. S'appliquent-elles aussi
aux factures adressées à des particuliers, ou seulement aux factures entre entreprises ?

> **Symbola** : ces champs n'apparaissent que là où ils sont exigés, selon le type de client.

### 3. Facture électronique

Prenons une planner en franchise en base qui facture surtout des particuliers, et
occasionnellement une entreprise.

- Doit-elle émettre des factures électroniques au 1er septembre 2027 pour ses clients
  entreprises ?
- Pour recevoir les factures de ses fournisseurs (obligatoire depuis le 1er septembre 2026),
  doit-elle déjà avoir choisi une plateforme agréée ?

> **Symbola** : Factur-X et le connecteur vers une plateforme agréée sont prévus avant l'été 2027.
> Votre réponse fixe ce qui devient obligatoire et pour quels clients.

### 4. E-reporting des ventes aux particuliers

Pour cette même planner :

- quelles données doit-elle transmettre (montants par opération ou par jour, encaissements) ?
- à quelle fréquence ?
- par quel canal, la plateforme agréée ?

Notre export actuel (voir plus haut) est-il une base suffisante ?

> **Symbola** : l'export et le futur connecteur reprennent exactement les données et la périodicité
> que vous indiquerez.

### 5. Encaissements de particuliers (article 286, I, 3° bis du CGI)

Symbola enregistre les paiements reçus de particuliers : date, montant et mode.

- Le planner est-il tenu d'utiliser un logiciel qui garantit l'inaltérabilité, la sécurisation, la
  conservation et l'archivage de ces données ?
- La réponse dépend-elle de son régime de TVA (franchise ou assujetti) ?
- Si oui, l'attestation individuelle de l'éditeur suffit-elle, et que doit-elle contenir ?

> **Symbola** : chaque encaissement sera enchaîné au précédent par une empreinte et ne pourra plus
> être modifié, seulement corrigé par une écriture inverse. Nous pourrons délivrer l'attestation
> dans la forme que vous indiquerez.

- Faut-il des **clôtures périodiques** (cumuls figés par jour, par mois, par exercice), comme pour un
  logiciel de caisse ? Si oui, lesquelles ?

> **Symbola** (lot 23b, 11/11/2026) : c'est fait. Factures, avoirs, encaissements et annulations
> sont enchaînés par empreinte dans l'ordre de leur enregistrement ; la chaîne est vérifiée chaque
> nuit ; un export annuel des écritures (CSV) est disponible. Aucune clôture périodique n'existe
> encore : nous l'ajouterons selon votre réponse.

### 6. Conservation des factures pendant dix ans

Aujourd'hui, Symbola fige les données de chaque facture et redessine le PDF à l'identique à la
demande.

- Faut-il conserver le fichier PDF émis lui-même, comme original ?
- Un format d'archivage particulier est-il attendu, par exemple le PDF/A ?

> **Symbola** : nous prévoyons de conserver le fichier émis, avec son empreinte, sans le recompresser
> ni le reconstruire.

### 7. Factures d'acompte

Une facture par acompte, puis une facture de solde qui déduit les acomptes : est-ce la bonne
pratique pour un planner en franchise ? Et pour un planner assujetti, compte tenu de
l'exigibilité de la TVA à l'encaissement pour les prestations de services ?

> **Symbola** : nous ajustons la génération des factures selon votre réponse.

### 8. Ce que vous voulez recevoir

Quel format d'export vous évite toute ressaisie :

- un journal des ventes et des encaissements en CSV ;
- le fichier des écritures comptables (FEC) ;
- un autre format ?

À quelle fréquence ?

> **Symbola** : nous produirons ce format. Un accès en lecture seule pour le comptable est aussi
> prévu.

### 9. Planner intermédiaire ou revendeur (volet TVA)

Un planner peut travailler de deux façons :

- **intermédiaire** : le prestataire facture directement le client, et le planner facture ses
  honoraires, parfois avec une commission versée par le prestataire ;
- **revendeur** : le planner achète la prestation et la refacture.

Quelles conséquences de TVA pour chaque mode, en franchise et en assujetti ?

> **Symbola** : les deux modes seront proposés, avec des factures et des montants distincts. Les
> commissions seront tracées.

### 10. Arrondi de la TVA

Symbola calcule la TVA **par taux** : il additionne les montants hors taxe des lignes au même
taux (remise globale déduite), applique le taux à ce total, puis arrondit une seule fois au
centime le plus proche (un demi-centime est arrondi vers le haut). C'est le calcul de la norme
européenne de facture électronique (EN 16931), suivie par Factur-X. L'autre méthode, la TVA
calculée ligne par ligne puis additionnée, peut donner un centime d'écart sur une facture de
plusieurs lignes.

Ce calcul par taux vous convient-il, pour les factures papier comme pour la facture
électronique ?

> **Symbola** : la règle est écrite dans l'ADR 0059. Si vous préférez le calcul par ligne, il
> sera changé avant les contrats et les factures complètes.

## Ce dont nous avons besoin

Des réponses écrites, même brèves, à chaque question numérotée.

- **Avant de développer les contrats et les factures complètes** : questions 1, 6, 7 et 10.
- **Avant le printemps 2027** : questions 2 à 5, pour être prêts au 1er septembre 2027.
