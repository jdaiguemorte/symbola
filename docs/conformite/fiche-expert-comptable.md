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
- **Mentions exigées** (depuis le 13/11/2026) : une liste de départ, réglable, dit quelles
  mentions chaque document doit porter. L'envoi d'un devis et l'émission d'une facture sont
  refusés tant qu'une mention manque, et le message nomme le champ à remplir :
  - sur le devis, les factures d'acompte et de solde et l'avoir : nom, adresse, SIREN ou SIRET ;
    pour une société (EURL, SARL, SAS, SASU, SA) l'immatriculation (RCS ou RM) et le capital ;
    pour un assujetti, le numéro de TVA ;
  - sur le devis seulement : l'assurance de responsabilité civile professionnelle ; pour un
    client particulier, le médiateur de la consommation et les conditions générales de vente ;
  - sur les factures d'acompte et de solde : les conditions de paiement ;
  - un avoir reprend les mentions figées de sa facture.
- **Acompte ou arrhes** : chaque devis dit si les sommes versées d'avance sont des acomptes ou
  des arrhes ; la facture correspondante s'intitule « Facture d'acompte » ou « Facture
  d'arrhes ».
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

> **Symbola** : la liste des mentions exigées décrite plus haut est un réglage. Nous l'ajustons
> selon votre réponse : chaque mention ajoutée devient un champ obligatoire, et le devis ou la
> facture ne part pas tant qu'il manque.

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

Le devis peut aussi prévoir des arrhes plutôt que des acomptes (question 2 de la fiche de
l'avocat). Symbola émet alors une « facture d'arrhes » de la même façon : est-ce correct,
notamment pour la TVA d'un planner assujetti ?

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

## Réponses reçues le 13 novembre 2026

L'expert-comptable a répondu aux dix questions, puis le même jour à la question des arrhes, posée
à part ; Julien confirme que ses réponses ont été vérifiées. La note reste hors de ce dépôt, qui
est public ; ce qui suit est ce que Symbola en retient. Suites : `docs/lots/lot-31-devis-contrat.md`
(D18 à D22) et `docs/QUESTIONS.md` (Q36).

| Q | Ce que Symbola retient | Où |
| --- | --- | --- |
| 1 | Socle : article 242 nonies A de l'annexe II au CGI et article L441-9 du Code de commerce. À ajouter : quantité et prix unitaire HT par ligne (déjà là), remises (déjà là), la mention « EI » pour un entrepreneur individuel, le numéro de bon de commande quand le client en émet un. Franchise : mention de l'article 293 B, sans TVA (déjà là). **Conditions de paiement : le texte de départ est non conforme face à un professionnel** (« taux d'intérêt légal » est sous le plancher). Deux modèles : professionnels (échéance, escompte, pénalités, indemnité forfaitaire de 40 €) ; particuliers (échéance et escompte). Taux recommandé : celui de la BCE majoré de 10 points ; « trois fois le taux légal » est le plancher. | Lot 31b (D18, D19) ; lot 41 (bon de commande) |
| 2 | Quatre mentions de la réforme (décret 2022-1299) entre assujettis ; imprimer la catégorie de l'opération (biens, services ou les deux) sur toutes les factures. Calendrier d'émission : septembre 2027 pour les PME et micro-entreprises. | Lot 41 |
| 3 | La facturation électronique vaut aussi en franchise. Émission vers les clients entreprises au 1er septembre 2027 ; un PDF par e-mail ne suffira plus. **Réception obligatoire depuis le 1er septembre 2026** pour toute entreprise (plateforme agréée, annuaire) : à vérifier chez la planner pilote. | Lot 41 ; action de Julien (Q36) |
| 4 | E-reporting (art. 242 nonies M) : données agrégées, catégorie LB/PS/LBPS, ventilation par taux et motif d'exonération, encaissements de services dans un flux à part, par une plateforme agréée ; en franchise, par bimestre. L'export CSV actuel est une base, insuffisante. | Lot 42 |
| 5 | Article 286 : la franchise n'est pas concernée ; l'assujetti l'est dès que Symbola enregistre les règlements de particuliers. L'attestation de l'éditeur suffit de nouveau (loi de finances pour 2026, modèle de l'administration). Comparer la conception à la doctrine (clôtures périodiques, archivage restituable). | Lot 42 (JUR-05) |
| 6 | Dix ans (article L123-22 du Code de commerce). Garder le fichier émis comme original, avec son empreinte (déjà le cas, lot 23b) ; PDF/A-3 pour Factur-X. | Lot 41 |
| 7 | Une facture par acompte puis un solde qui les déduit : bonne pratique dans les deux régimes. Assujetti : chaque facture d'acompte porte sa TVA ; **le solde déduit les acomptes en HT et en TVA** ; opération mixte : séparer les lignes par catégorie. | Lot 31b (D20) |
| 7 bis | **Arrhes : pas de « facture d'arrhes »** (le traitement du 31a n'est pas correct). Les arrhes sont une indemnité de dédit, hors champ de la TVA, de la facturation électronique et de l'e-reporting tant qu'elles ne sont pas imputées sur le prix. À l'encaissement : un reçu non fiscal, hors de la série des factures. Facture de solde : le prix total (HT, TVA, TTC), les arrhes imputées figurant comme un règlement ; pour l'assujetti, la TVA devient exigible à l'imputation. Client qui renonce : un constat de renonciation, ni facture ni avoir. Planner qui renonce : un document de restitution du double, sans TVA. Réserves : pour un consommateur, les sommes versées d'avance sont présumées arrhes sauf stipulation contraire, donc le choix doit être explicite et écrit en toutes lettres ; des arrhes sans faculté de dédit réelle seraient requalifiées en acompte. Schéma conseillé : des arrhes versées une seule fois à la réservation, puis des acomptes. | Lot 31b (D21, D22) ; lot 34 (annulation) |
| 8 | Micro-entreprise : journal des recettes en CSV (date d'encaissement, mode, numéro de facture, client). Société : journal des ventes et des encaissements, FEC en fin d'exercice, PDF d'origine rattachés. Accès en lecture seule pour le comptable. | Lot 42 |
| 9 | Intermédiaire transparent : le planner facture ses honoraires ; la commission est facturée au prestataire. Revendeur : base = total refacturé ; en franchise, risque de dépasser le seuil ; débours sous conditions. La qualité d'intermédiaire repose sur le contrat, pas sur la case cochée. | Lot 48 |
| 10 | Calcul par taux validé ; mêmes totaux au centime entre PDF et fichier structuré, même méthode sur papier et en électronique. | Lot 41 |
