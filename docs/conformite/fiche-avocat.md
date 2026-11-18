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

## Question du 15 novembre 2026 (lot 35)

### 12. Fin de l'abonnement : ce que Symbola garde après la suppression

À la résiliation, la Propriétaire fermera son espace :

- pendant 30 jours, elle peut encore tout exporter, et un e-mail la prévient avant la fin ;
- ensuite, Symbola supprime l'espace et ses fichiers.

Le cahier des charges ajoute « hors obligations légales ».

- **Ce que Symbola doit garder.** Symbola, sous-traitant, doit-il tout effacer au 30e jour, la
  planner gardant son export pour remplir ses propres obligations ? Ou doit-il garder certaines
  pièces : factures, avoirs, chaîne d'empreintes, contrats signés et dossiers de preuve ?
- **Les contrats signés.** Vous avez indiqué (réponse 3) qu'un contrat électronique de 120 € et
  plus se conserve dix ans, avec son dossier de preuve. Cette obligation est-elle celle de la
  planner seule, que son export lui permet de remplir ? Ou Symbola doit-il en garder une copie
  après la fermeture ?
- **Les conditions de garde.** Si Symbola garde des pièces : sur quel fondement, combien de temps,
  sous quelle forme (accès restreint, sous scellé), et à qui les remettre sur demande ?
- **Les conditions de l'éditeur.** Que doit dire la clause de réversibilité (réponse 8, Data
  Act) : délai de 30 jours, préavis, format de l'export, sort des données ?

> **Symbola** : deux possibilités.
>
> - **(a)** Symbola efface tout au 30e jour ; l'export reste proposé jusqu'au dernier jour.
> - **(b)** Symbola garde les pièces comptables et les preuves de signature jusqu'à la fin de
>   leur durée légale, sous accès restreint, puis les efface.
>
> Nous proposons (a), sous réserve de votre avis. La fermeture d'un espace ne sera développée
> qu'après votre réponse.

Besoin : une réponse **avant de développer la fermeture d'un espace** (lot 35c).

## Question du 17 novembre 2026 (lot 40c)

### 13. Déclaration d'accessibilité du portail des mariés

Suite à votre réponse 9, un brouillon de déclaration d'accessibilité volontaire pour le portail des
mariés est prêt : `docs/conformite/declaration-accessibilite.md`. Il suit le modèle public de
déclaration (état de conformité, résultats des tests, contenus non accessibles, contact). Il annonce
une conformité partielle à WCAG 2.2 AA, faute d'audit complet par un tiers.

- **Le texte.** Pouvez-vous le relire ? En particulier « partiellement conforme », et la mention
  des documents déposés par la planner ou un prestataire, fournis tels quels.
- **L'analyse d'exemption.** Vous nous avez conseillé de la consigner : pouvez-vous la rédiger, ou
  nous dire ce qu'elle doit contenir ?
- **Les voies de recours.** Quelle mention faut-il pour un éditeur privé dont la déclaration est
  volontaire ?
- **L'éditeur et le contact.** Sous quel nom la déclaration doit-elle paraître tant que la société
  n'existe pas (question 8) ?

Besoin : une réponse **avant de publier la page `/accessibilite`** (lot 40c, JUR-17).

## Questions du 18 novembre 2026 (lot 41)

### 14. Délai de paiement entre professionnels (AV-1)

Votre réponse 7 fixe, face à une entreprise cliente, un délai de 30 jours par défaut, verrouillé
hors des bornes légales. Symbola refuse tout réglage au-delà de **60 jours après l'émission** ou de
**45 jours fin de mois** (article L441-10 du Code de commerce), et accepte ces bornes. Pour « fin
de mois », Symbola ajoute le délai à la date d'émission puis va au dernier jour de ce mois (la plus
courte des deux lectures usuelles). Ces bornes et ce calcul sont-ils justes ? Existe-t-il un
plafond propre au secteur de l'évènementiel ?

> En attendant : 60 jours, ou 45 jours fin de mois, calcul ci-dessus.

### 15. Assistant de conformité (AV-2)

Avant l'envoi d'un devis, d'un contrat ou d'une facture, un panneau « Vérifications avant envoi »
liste des points d'attention qui **ne bloquent pas** l'envoi (le blocage reste celui des mentions
obligatoires). Premier jeu :

1. client professionnel sans numéro de bon de commande ;
2. des biens livrés à un professionnel sans adresse de livraison ;
3. contrat à distance ou hors établissement d'un particulier sans clause de rétractation ;
4. clause de contrat encore marquée « [À rédiger] » ou « [À compléter] » ;
5. contrat au-delà du seuil de signature avancée, signé en signature simple ;
6. facture de solde alors qu'un acompte de l'échéancier n'est pas facturé ;
7. option pour la TVA sur les débits non renseignée (entreprise assujettie) ;
8. date de la prestation absente, ou à plus d'un an.

Sous le panneau, une mention fixe : « Ces vérifications vous aident ; elles ne remplacent pas le
conseil d'un professionnel du droit ou de la comptabilité. »

Cette liste vous semble-t-elle juste ? Le texte de la mention convient-il ? Symbola, éditeur,
encourt-il une responsabilité si un point manque à la liste, ou si un point affiché est erroné ?
L'Admin peut retirer une vérification ; la liste et ses textes sont des données, modifiables sans
développement.

> En attendant : ce jeu et cette mention.

Besoin : des réponses **avant la mise en service auprès de la pilote** (aucune ne bloque le
développement).

## Question du 18 novembre 2026 (lot 46, rendez-vous)

### 16. Mentions légales de la page publique de réservation

Le module Rendez-vous publie, pour chaque planner qui l'ouvre, une page publique de réservation
(`/reserver/<adresse-choisie>`), à son nom, sur le domaine de Symbola. On y choisit un créneau et on
y laisse son nom, son e-mail et, si on veut, son téléphone. La page porte la mention d'information
RGPD de la planner ; elle n'est ni indexée ni intégrable dans un autre site.

- **AV-3** : faut-il y faire figurer les mentions légales de la planner (identité, forme et
  immatriculation, adresse, hébergeur), comme sur un site de l'éditeur ? Ou un lien vers ses
  mentions, ou rien de plus que la mention d'information, la page n'étant qu'un formulaire de
  prise de contact ? Et Symbola, comme hébergeur, doit-il y apparaître ?

> **Symbola** : la page montre aujourd'hui le nom de la planner, la mention d'information (avec son
> adresse de contact) et « Symbola héberge ces données pour le compte de … ». Le module reste fermé
> par défaut ; il ne sera ouvert à la pilote qu'après votre réponse.

Besoin : une réponse **avant d'ouvrir le module Rendez-vous à la pilote**.

## Questions du 18 novembre 2026 (lot 44)

### 17. Mention d'information du formulaire de contact (AV-4)

La planner peut mettre sur son site un formulaire de contact fourni par Symbola (prénom et nom,
e-mail ou téléphone, date ou période, lieu, budget, nombre d'invités, type d'évènement, « comment
m'avez-vous connue ? », message). Chaque envoi crée un prospect chez elle. La planner est
responsable du traitement, Symbola sous-traitant. Avant le bouton d'envoi, une mention
d'information (texte de départ, que nous vous soumettons) :

> « Les informations de ce formulaire sont destinées à {organisation} ({adresse}), responsable de
> leur traitement. Elles servent à répondre à votre demande et, si vous le souhaitez, à préparer
> votre évènement avec vous. Elles sont gardées {durée} mois après notre dernier échange si votre
> projet ne se concrétise pas. Vous pouvez y accéder, les faire corriger ou effacer, ou vous opposer
> à leur utilisation en écrivant à {contact}. Vous pouvez aussi adresser une réclamation à la CNIL
> (www.cnil.fr). Pour en savoir plus : {politique de confidentialité de la planner}. »

Le formulaire ne s'ouvre pas tant que la planner n'a pas donné l'adresse de sa politique de
confidentialité. Aucun e-mail n'est envoyé à la personne. Ce texte suffit-il, ou faut-il une case à
cocher (consentement) pour une simple demande de contact ?

> En attendant : la mention sans case à cocher (base : la demande de la personne, mesures
> précontractuelles).

### 18. Formulaire encadré dans le site de la planner (AV-5)

Le même formulaire peut s'afficher dans le site de la planner (cadre), sans que la personne voie
qu'il est servi par Symbola. Faut-il nommer Symbola (sous-traitant, hébergeur) dans la mention, ou
la politique de confidentialité de la planner, à laquelle la mention renvoie, suffit-elle ?

> En attendant : Symbola n'est pas nommé dans la mention ; la planner le cite comme sous-traitant
> dans sa politique (registre des sous-traitants, docs/conformite/sous-traitants.md).

Besoin : des réponses **avant la première demande réelle** reçue par le formulaire (aucune ne
bloque le développement).

## Question du 18 novembre 2026 (lot 45)

### 19. Relances d'un prospect qui a fait une demande (AV-9)

Numéro provisoire : donné à la fusion avec les questions des autres lots.

Après une demande (formulaire de contact, e-mail, téléphone), la planner répond depuis Symbola. Sans
retour, une relance est préparée à J+3 puis à J+7 (réglable, trois au plus) ; par défaut, la planner
la relit et l'envoie elle-même, l'envoi automatique est un réglage qu'elle active. Les relances
s'arrêtent dès que la personne répond (geste de la planner), que l'évènement est confirmé ou perdu, ou
que la personne agit dans Symbola. Chaque relance porte : « Vous ne souhaitez plus de nouvelles ?
Répondez simplement à ce message. », et la planner a un geste « Ne plus relancer ».

Ces relances sont-elles de la prospection commerciale (consentement préalable, lien de
désinscription : exigence RGP-17), ou la suite de la demande de la personne, sans ces obligations ?
La DPO, interrogée le 13/11 sur les relances de devis, y voit de la prospection (accord préalable
d'un particulier, par une case non précochée au formulaire de demande, et liste d'opposition) ; nous
souhaitons votre avis sur le cas précis d'une personne qui vient d'écrire pour demander une
prestation (`docs/QUESTIONS.md`, Q39).

> En attendant : la suite de sa demande (RGP-17 reste « Sans objet ») ; la phrase « Répondez
> simplement » et le geste « Ne plus relancer » sont en place.

Besoin : une réponse **avant la première relance réelle** (elle ne bloque pas le développement).
