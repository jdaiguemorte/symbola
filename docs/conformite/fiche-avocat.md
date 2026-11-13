# Fiche pour l'avocat — contrats, consommateurs et obligations de l'éditeur

Préparée le 11 novembre 2026 pour Julien, éditeur de Symbola. Brouillon à relire avant envoi.

## Pourquoi cette fiche

Symbola est un logiciel de gestion pour les organisateurs d'évènements, d'abord les wedding
planners. Leurs clients sont surtout des particuliers (des couples), parfois des entreprises.
Symbola va produire des contrats à partir de modèles, les faire signer en ligne et encaisser des
acomptes. Les choix ci-dessous changent la façon dont le logiciel doit se comporter. Nous ne
voulons pas les trancher nous-mêmes. Chaque question appelle une réponse courte. À côté, nous
indiquons ce que fera Symbola selon votre réponse.

La société qui éditera Symbola n'est pas encore créée. Un pilote est en cours avec une wedding
planner. Les obligations d'éditeur (§ 8) s'appliqueront à l'ouverture commerciale.

## Ce que fait Symbola aujourd'hui

- Le planner compose un devis depuis son catalogue ou un modèle de devis, en sections, avec des
  options que le client choisit sur son espace en ligne. Le client le signe en ligne, sans compte,
  par un lien envoyé par le service de signature Documenso, hébergé par nos soins.
- Le dossier de preuve est conservé avec le document signé : identité déclarée, adresse e-mail
  vérifiée par le lien, horodatage, empreinte du document et journal des étapes.
- Chaque devis dit si ses sommes versées d'avance sont des acomptes ou des arrhes : le planner
  règle une valeur par défaut, et le devis ne part pas sans ce choix. Le mot figure sur le devis,
  les factures et l'espace du client. La clause qui l'explique viendra du contrat.
- Le planner renseigne son assureur et son contrat de responsabilité civile professionnelle (avec
  la couverture géographique), son médiateur de la consommation et ses conditions générales de
  vente. Ils sont repris sur chaque devis, qui ne part pas sans eux (médiateur et conditions
  générales : pour un client particulier).
- Il n'existe encore ni contrat généré depuis un modèle, ni gestion du droit de rétractation.
  **Mise à jour du 13/11/2026 (lot 31b, d'après vos réponses)** :
  - le contrat est généré depuis un modèle à clauses et variables, avec un canal de conclusion
    obligatoire, la catégorie du client et le régime qui en découle ;
  - la génération est refusée tant qu'un élément exigé manque : variable vide, clause encore à
    rédiger, information légale, clause d'acompte ou d'arrhes qui ne concorde pas ;
  - à distance, le client commande sur son espace avant de signer ;
  - sa demande d'exécution anticipée est une case distincte de la signature, horodatée ;
  - un dossier de preuve scellé s'ajoute à celui du service de signature ;
  - chaque modèle porte sa version et la date de sa dernière revue, et l'avertissement est accepté
    à chaque version.
- Nous fournirons des modèles de départ (contrat de prestation, mandat, conditions générales).
  Chacun sera marqué « base à adapter, à faire relire par un professionnel du droit ». Les modèles
  de devis de départ portent déjà l'avertissement « Modèles à adapter ».

## Questions

### 1. Droit de rétractation (articles L221-18 et L221-28 du Code de la consommation)

Le contrat entre un planner et un couple est souvent conclu à distance (signature en ligne) ou
hors établissement (au domicile du couple, sur un salon). L'exception des prestations fournies à
une date déterminée s'applique-t-elle à l'organisation d'un mariage ?

- **Si oui** : le modèle mentionne l'exception, sans délai de rétractation.
- **Si non** : le modèle comprend l'information précontractuelle complète, le délai de quatorze
  jours et le formulaire de rétractation. Une exécution avant la fin du délai n'a lieu que sur
  demande expresse du client, recueillie et tracée par Symbola.

Quelles informations précontractuelles exactes faut-il afficher avant la signature ?

### 2. Acompte ou arrhes (article L214-1 du Code de la consommation)

Pour un planner, recommandez-vous de qualifier les sommes versées d'avance d'acompte ou d'arrhes ?
Quelle clause type pour chaque cas, notamment en cas d'annulation par l'une ou l'autre partie ?

> **Symbola** : le modèle impose ce choix et insère la clause correspondante. Le libellé apparaît
> sur l'échéancier et les factures.

### 3. Informations obligatoires du professionnel

Nous prévoyons de paramétrer, puis de reprendre sur les documents : l'identité de l'entreprise,
l'assurance de responsabilité civile professionnelle (assureur, couverture), le médiateur de la
consommation et les conditions générales. La liste est-elle complète pour un contrat avec un
particulier ? Et pour un contrat avec une entreprise ?

> **Symbola** : chaque information requise devient un champ obligatoire, et aucun document ne part
> s'il est vide.

### 4. Planner intermédiaire ou revendeur, et commissions

Un planner peut être intermédiaire : le prestataire facture le client, et le planner facture ses
honoraires. Il peut aussi être revendeur : il achète la prestation et la refacture. Certains
prestataires lui versent une commission.

- Quel devoir d'information a-t-il envers son client dans chaque cas ?
- Doit-il obligatoirement révéler les commissions reçues ?

> **Symbola** : les deux modes seront proposés et les commissions tracées. L'affichage au client
> sera obligatoire ou laissé au choix du planner, selon votre réponse.

### 5. Niveau de signature électronique

La signature simple avec dossier de preuve, décrite plus haut, suffit-elle pour un contrat de
mariage de plusieurs milliers ou dizaines de milliers d'euros ? À partir de quel enjeu ou de quel
type de contrat faut-il une signature avancée ?

> **Symbola** : le niveau de signature devient un réglage par type de contrat.

### 6. Modèles de départ

Accepteriez-vous de relire nos modèles de contrat de prestation, de mandat et de conditions
générales de vente ? L'avertissement « base à adapter, à faire relire par un professionnel du
droit » suffit-il à limiter notre responsabilité d'éditeur, qui fournit ces modèles sans les
adapter à chaque cas ?

### 7. Clients entreprises (article L441-10 du Code de commerce)

Pour un client professionnel, quelles mentions de délai de paiement, de taux des pénalités de
retard et d'indemnité forfaitaire de recouvrement faut-il sur les devis et les factures ? Faut-il
y reprendre le numéro de bon de commande du client ?

> **Symbola** : ces mentions sont paramétrées et ajoutées d'office aux documents destinés aux
> entreprises.

### 8. Obligations de l'éditeur avant l'ouverture commerciale

Nous prévoyons :

- des conditions générales d'utilisation et de vente ;
- des niveaux de service ;
- un accord de sous-traitance au sens de l'article 28 du RGPD ;
- une politique de confidentialité et des mentions légales ;
- une clause de réversibilité.

La liste est-elle complète ? Dans quel ordre les préparer ? La société doit-elle exister avant
que la pilote utilise l'outil avec de vraies données ?

### 9. Accessibilité

Quelle obligation légale d'accessibilité s'applique à un petit éditeur de logiciel en ligne, au
regard de la directive européenne sur l'accessibilité ? Nous visons de toute façon le niveau
WCAG 2.2 AA pour tous les écrans.

### 10. Licences des logiciels libres utilisés

Cette question relève peut-être d'un juriste spécialisé en logiciel libre.

- Documenso, sous licence AGPL v3, est utilisé sans modification, hébergé par nous et appelé par
  son interface de programmation.
- Nous allons choisir un fournisseur d'identité open source pour la connexion des utilisateurs.

Quelles obligations ces licences créent-elles pour un service en ligne payant ? Lesquelles
faut-il éviter ?

### 11. Marque

Faut-il déposer la marque « Symbola » avant toute communication ? Une recherche d'antériorité
est-elle conseillée ? Le nom de domaine est déjà réservé.

## Ce dont nous avons besoin

Des réponses écrites, même brèves, à chaque question numérotée.

- **Avant de développer les contrats** : questions 1, 2, 3, 5 et 6.
- **Avant l'ouverture commerciale** : questions 4 et 7 à 11.

## Réponses reçues le 13 novembre 2026

L'avocat a répondu aux onze questions par une note écrite. Julien confirme que l'avocat a validé
les points que la note marquait « à vérifier » : ce ne sont plus des hypothèses. **La note reste
hors de ce dépôt, qui est public** (conseil confidentiel) ; Julien la conserve. Ce qui suit est
seulement ce que Symbola en retient. La traduction dans le produit est dans
`docs/lots/lot-31-devis-contrat.md` (révision du 13/11/2026) et `docs/QUESTIONS.md` (Q34).

| Q | Ce que Symbola retient | Où |
| --- | --- | --- |
| 1 | Ne jamais proposer par défaut l'exception des prestations à date déterminée (L221-28, 12°) pour l'organisation d'un mariage. Un champ « canal de conclusion » obligatoire (établissement, à distance, hors établissement, foire ou salon) détermine le régime. À distance ou hors établissement : information complète, quatorze jours, formulaire type ; à distance, confirmation sur support durable et bouton « commande avec obligation de paiement » ; hors établissement, exemplaire remis et aucun paiement avant sept jours. Foire ou salon : modèle dédié, validé à part. Exécution anticipée : case distincte de la signature, horodatée, dans le dossier de preuve. Liste des informations précontractuelles fournie. | Lot 31b |
| 2 | « Acompte » par défaut, avec un barème d'annulation écrit, progressif et réciproque ; arrhes seulement pour une offre volontairement réversible. Un libellé unique sur la clause, l'échéancier et la facture : le générateur refuse un document où ils ne coïncident pas. Deux clauses types fournies (acompte, arrhes), bases à adapter. | Lots 31a (défaut) et 31b |
| 3 | Trois catégories de client : consommateur, non-professionnel, professionnel. Médiateur : adhésion obligatoire, envoi bloqué si le champ est vide. Contrat électronique de 120 € et plus : contrat et dossier de preuve conservés dix ans. Mentions entreprises : voir 7. | Lots 31a et 31b ; réglage de conservation (Q34) |
| 4 | Commission affichée obligatoirement à un client particulier ; mode intermédiaire ou revendeur par ligne du devis ; alerte et blocage du modèle standard pour un forfait touristique. | Lot 48 (JUR-10) |
| 5 | Signature simple renforcée par code SMS pour les devis et avenants de moins de 10 000 € ; signature avancée à partir de 10 000 € et pour les mandats ; niveau réglable par type de contrat, inscrit au dossier de preuve. Licence de Documenso à vérifier pour ces fonctions. | Lot à part (JUR-14), Q34 |
| 6 | L'avertissement « base à adapter » reste, mais ne suffit pas : version et date de la dernière revue juridique sur chaque modèle et dans chaque contrat ; avertissement accepté à la première utilisation et à chaque nouvelle version ; seulement des champs objectifs et des options prédéfinies. Relecture des trois modèles par un avocat ; assurance de l'éditeur ; conditions de l'éditeur. | Lot 31b ; actions de Julien (Q34) |
| 7 | Client entreprise : délai de paiement (30 jours par défaut), pénalités (trois fois le taux d'intérêt légal), indemnité forfaitaire de 40 €, escompte (« Néant »), numéro de bon de commande s'il existe ; repris sur le devis et la facture, verrouillés hors des bornes légales. Facturation électronique à prévoir. | Lot 41 |
| 8 | La société doit exister avant les données réelles de la pilote ; ensuite accord de sous-traitance, registre, mentions légales, politique de confidentialité, plan de sécurité, liste des sous-traitants ultérieurs ; puis conditions, niveaux de service, réversibilité (Data Act), circuit de paiement agréé (Symbola ne détient jamais les fonds). | Actions de Julien (Q34) ; lot 43 |
| 9 | Pas d'obligation directe probable aujourd'hui ; garder WCAG 2.2 AA et publier une déclaration d'accessibilité volontaire pour les écrans du couple ; consigner l'analyse d'exemption. | Lot 40 (JUR-17) |
| 10 | Documenso non modifié, appelé par son API ; obtenir de l'éditeur une confirmation écrite de l'usage, ou prévoir l'édition Business. Fournisseur d'identité sous licence Apache ou MIT (Keycloak, Ory). Inventaire des licences dès maintenant. | Lot 33 (ADR 0052), lot 40 (JUR-18), Q34 |
| 11 | Recherche d'antériorités par un conseil en propriété industrielle, puis dépôt (classes 9, 42, 35), puis communication. | Action de Julien (Q34) |
