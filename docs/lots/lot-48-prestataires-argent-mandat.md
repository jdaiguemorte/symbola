# Lot 48 — Prestataires (pièces, lieu, IBAN), honoraires, commissions et mandat

**Statut** : spécification proposée le 18/11/2026, **validée par Julien le 18/11/2026** : toutes les décisions retenues dans leur option recommandée (a), changements de schéma, contrainte des natures d'e-mails du `hub` et, pour le lot 53, dépendance `web-push` compris (accord donné, ADR à écrire dans la PR). Le lot change les
schémas `vendors`, `quotes` et `budget`, et chiffre des colonnes existantes (D5) : validation
explicite requise (CLAUDE.md § 8). Aucune dépendance nouvelle.

Branches `lot-48a-prestataires` puis `lot-48b-argent-et-mandat` (D1), parties de `main`. Aucune
version intermédiaire n'est déployée (gel des déploiements).

Ce lot avance **en parallèle des lots 52 et 53** : voir « Travail en parallèle » à la fin.

## Contexte

Deux sujets que le plan avait réunis :

- **les prestataires** : leurs pièces qui expirent, la fiche d'un lieu et ses contraintes, et le
  **changement d'IBAN**, première porte d'entrée des fraudes au virement ;
- **l'argent de la planner** :
  - ses honoraires, à distinguer des dépenses de l'évènement ;
  - les commissions qu'elle reçoit ;
  - son rôle, intermédiaire ou revendeur ;
  - le mandat qui va avec.

Exigences :

- **PRE-05** (P1) — Pièces à échéance (assurance, immatriculation), alerte avant expiration.
  *Critère* : une pièce qui expire avant la date de l'évènement est signalée.
- **PRE-06** (P1) — Fiche lieu : capacités, plans, contraintes d'horaires et de bruit, traiteur
  imposé, accès, hébergements proches. *Critère* : les contraintes du lieu alimentent les contrôles
  du chrono. Les plans de salle dessinés sont au lot 60.
- **PRE-10** et **SEC-27** (P1) — Tout changement d'IBAN d'un prestataire est journalisé, signalé
  à la planner et marqué « à vérifier par un autre canal » avant le paiement suivant. *Critère* :
  l'alerte reste visible tant que la planner ne l'a pas levée.
- **DAT-08** (P1) — Chiffrement au niveau du champ : coordonnées bancaires et notes marquées
  confidentielles. Les régimes sont déjà chiffrés (lot 49).
- **BUD-08** (P1) — Honoraires de la planner affichés à part (forfait, pourcentage ou mixte) ;
  commissions tracées. *Critère* : les honoraires ne se confondent jamais avec les dépenses de
  l'évènement.
- **PRE-07** (P1) — Commissions et apports d'affaires tracés par prestataire et par évènement.
  *Critère* : affichage au client selon JUR-10.
- **JUR-10** (P1) — Mandat et transparence : deux modes, intermédiaire (le prestataire facture le
  client, la planner facture ses honoraires) et revendeur (la planner achète et refacture) ;
  commissions tracées.
- **DOC-02** (P0, Partiel) — Génération depuis des modèles à variables : il manque le **mandat**.
- **HUB-26** (P0, Partiel) — Bibliothèque de départ livrée comme données, « à adapter » : il
  manque le **mandat** et les **conditions générales**.

**HUB-25** (champs personnalisés sur contacts, évènements, prestataires, invités) **sort de ce
lot** (D2) : il touche tous les modules à la fois et bloquerait le travail en parallèle.

Ce qui est déjà tranché par les conseils (réponses du 13/11, fiches) :

- **Avocat, réponse 4** :
  - commission **affichée obligatoirement** à un client particulier ;
  - mode intermédiaire ou revendeur **par ligne du devis** ;
  - alerte et blocage du modèle standard pour un **forfait touristique**.
- **Expert-comptable, réponse 9** :
  - intermédiaire transparent : la planner facture ses honoraires, et la commission est facturée
    **au prestataire** ;
  - revendeur : la TVA porte sur le total refacturé ; en franchise, risque de dépasser le seuil ;
  - débours sous conditions.

## Ce qui existe aujourd'hui

- **Prestataires** (module `vendors`) : fiches, types et champs par type (`vendor_type_fields`),
  fichiers (`vendor_files`, dont un RIB en fichier), note interne, évaluation (lot 11).
- **Lieux** :
  - fiches de type `venue` ;
  - lieux d'un évènement (`events.event_places`), qui peuvent désigner une fiche ;
  - le programme a des heures (lots 21, 51).
- **Retenu engage le budget** (PRE-02) ; échéancier des prestataires (BUD-03) ; remises du jour J
  (lot 51).
- **IBAN de la planner** en clair : `quotes.quote_settings.iban` et `bic`. Le lot 43 l'affiche sur
  l'écran « Régler l'acompte ».
- **Chiffrement de champ** : `packages/auth/src/field-box.ts` et `DATA_ENCRYPTION_KEY` (ADR 0079).
- **Contrat** généré depuis un modèle à variables, variables manquantes listées (lot 31b, ADR
  0065) ; modèles de départ « à adapter » avec l'avertissement juridique (lot 31) ; version et date
  de revue juridique sur chaque modèle (réponse 6 de l'avocat).

## Découpage : deux PR (D1)

- **48a — Prestataires** (PRE-05, PRE-06, PRE-10, SEC-27, DAT-08) : modules `vendors` et `events`
  (contrôles du chrono), chiffrement. Sans dépendance aux conseils.
- **48b — Argent et mandat** (BUD-08, PRE-07, JUR-10, DOC-02, HUB-26) : modules `quotes` et
  `budget`. Il porte des règles fiscales et juridiques déjà tranchées par les conseils, mais
  délicates à relire.

La coupure est argumentée : deux sujets, deux jeux de modules, deux relectures différentes. Une
même session les code l'un après l'autre ; 48b part de 48a.

## Partie A (48a) — Pièces à échéance (PRE-05 ; D3)

- Sur la fiche d'un prestataire, des **pièces** : nature (liste de l'organisation, données de
  départ : attestation d'assurance responsabilité civile, extrait Kbis ou avis Insee, autre),
  fichier (contrôles de l'ADR 0027), date de fin de validité.
- **Alertes** :
  - 30 jours avant la fin de validité (réglage) ;
  - **une pièce qui expire avant la date d'un évènement où le prestataire est retenu** est signalée
    sur cet évènement et dans « Aujourd'hui » (critère).
- Le prestataire peut **déposer lui-même** sa pièce par son lien (lot 47), si la planner l'a
  demandé. La pièce arrive « à vérifier ».

## Partie B (48a) — Fiche lieu et contrôles du chrono (PRE-06 ; D4)

- Sur une fiche de type `venue` :
  - capacités (assis, debout, cérémonie) ;
  - **contraintes d'horaires** (heure de fin de la musique, heure de départ des invités, accès des
    prestataires) ;
  - **limite de bruit** (heure de baisse du volume, décibels) ;
  - **traiteur imposé** (oui ou non, lequel) ;
  - accès (parking, livraison, cheminement) ;
  - hébergements proches ;
  - documents (plans, en fichiers).

  Champs en données, par type de prestataire, sur le modèle des champs par type existants.
- **Contrôles du chrono** (critère) : sur un évènement dont un lieu désigne une fiche, une séquence
  qui dépasse une contrainte est signalée sur le programme et dans le mode Jour J. Exemples : DJ
  après l'heure de fin de la musique, livraison hors de l'accès prestataires. Le contrôle est
  **jamais bloquant**, et il explique la règle (« Le château demande la fin de la musique à
  1 h »).
- Nombre d'invités supérieur à la capacité : signalé sur la fiche de l'évènement.

## Partie C (48a) — IBAN des prestataires : contrôle des changements (PRE-10, SEC-27 ; D5)

- Un champ **IBAN structuré** (avec BIC) sur la fiche du prestataire, **chiffré** (DAT-08). Le RIB
  en fichier reste possible comme pièce jointe.
- **Tout changement** (par la planner, ou par le prestataire depuis son lien) est :
  - **journalisé** : qui, quand, ancien et nouvel IBAN masqués (`FR76 •••• •••• 1234`) ;
  - **signalé** dans « Aujourd'hui » et sur la fiche ;
  - **marqué « à vérifier par un autre canal »** : un bandeau rappelle d'appeler le prestataire au
    numéro **déjà connu**, jamais à celui du message qui annonce le changement.
- **Le bandeau reste** tant que la planner ne l'a pas levé, par le geste « J'ai vérifié par
  téléphone », horodaté et nominatif (critère). D'ici là, l'IBAN est affiché « à vérifier » sur
  les échéances, les remises du jour J (lot 51) et le partage au client (lot 12).
- Un IBAN changé par le lien du prestataire n'est **jamais** montré au client avant la levée.

## Partie D (48a) — Chiffrement des champs sensibles (DAT-08 ; D5)

- **Chiffrés** avec `field-box` (ADR 0079) :
  - IBAN et BIC des prestataires (nouveaux champs) ;
  - **IBAN et BIC de la planner** (`quote_settings`), par une migration de données annulable ;
  - **notes confidentielles** : une case « confidentielle » sur les notes de contact, d'évènement
    et de prestataire. Une note confidentielle est chiffrée, absente des exports aux tiers et des
    recherches, visible des seuls membres autorisés.
- **Lecture** : seulement par le service du module, au moment de l'affichage ou du document ;
  jamais dans les journaux. L'écran « Régler l'acompte » (lot 43) déchiffre l'IBAN de la planner à
  l'affichage.

## Partie E (48b) — Honoraires et commissions (BUD-08, PRE-07 ; D6)

- **Honoraires de la planner** par évènement : forfait, pourcentage du budget (sur la base choisie
  : estimé ou engagé), ou mixte. Ils figurent sur le devis de la planner. Dans le budget du client,
  ils forment **une ligne à part, hors des dépenses de l'évènement** (critère) : jamais dans un
  total de catégorie, jamais confondus avec un prestataire.
- **Commissions** : par prestataire et par évènement, en montant ou en pourcentage, avec leur
  statut (attendue, facturée, reçue).
  - Pour un **client particulier**, la commission est **affichée obligatoirement** sur le devis et
    dans le portail (réponse 4 de l'avocat), sans case pour la masquer.
  - Pour un client professionnel, la planner choisit.
- **Facture de commission au prestataire** (réponse 9 de l'expert-comptable) : la planner émet une
  facture **au prestataire**, depuis le module des devis, avec la même numérotation et les mêmes
  règles que ses autres factures (lot 41).

## Partie F (48b) — Intermédiaire ou revendeur, et le mandat (JUR-10, DOC-02, HUB-26 ; D7, D8)

- **Mode par ligne du devis** (réponse 4) :
  - **intermédiaire** : la ligne est une prestation du prestataire, facturée par lui au client ;
    elle apparaît au devis pour information, hors du total de la planner ;
  - **revendeur** : la planner achète et refacture ; la ligne entre dans son total, et donc dans
    sa TVA (réponse 9).

  Le devis montre les deux parties séparément.
- **Franchise en base** : en mode revendeur, Symbola calcule le chiffre d'affaires refacturé de
  l'année et **alerte** à l'approche du seuil de franchise. Le seuil est un paramètre réglementaire
  de l'Admin, jamais en dur (HUB-23).
- **Forfait touristique** (réponse 4) : si le devis réunit un transport ou un hébergement **et**
  une autre prestation touristique vendus ensemble par la planner en revendeur, une alerte
  explique le risque et **bloque le modèle de contrat standard**. La planner doit choisir un
  modèle dédié, absent des données de départ. La règle exacte de détection est à relire (AV-10).
- **Mandat** (DOC-02, HUB-26) :
  - modèle de **mandat** (intermédiaire) dans la bibliothèque de départ, avec variables, version
    et date de revue juridique, et l'avertissement « à faire relire par un professionnel du
    droit » ;
  - généré depuis le devis, variables manquantes listées avant ;
  - signé comme le contrat (lot 31b) ;
  - la signature avancée des mandats (réponse 5 de l'avocat) reste au lot de la signature
    renforcée (Q34).
- **Conditions générales** : modèle de départ « à adapter » dans la bibliothèque (HUB-26), même
  avertissement.
- **Clauses types de l'avocat** : versées seulement après son accord de publication (D14 du lot 31,
  toujours en attente). D'ici là, les modèles restent ceux de Symbola, marqués « à adapter ».

## Décisions à prendre

- **D1 — Une PR ou deux.**
  - (a) Deux PR : 48a (prestataires) puis 48b (argent et mandat), codées par la même session.
  - (b) Une seule PR.

  **Recommandation : (a).** Deux sujets, deux jeux de modules, deux relectures. 48a ne dépend de
  rien ; 48b porte des règles fiscales et juridiques qui méritent une relecture à part.
- **D2 — Les champs personnalisés (HUB-25).**
  - (a) Hors de ce lot : un lot à part, plus tard, quand peu de lots tournent en parallèle.
  - (b) Dans ce lot.

  **Recommandation : (a).** Ils touchent contacts, évènements, prestataires et invités : en
  parallèle des lots 52 et 53, ils créeraient des conflits partout.
- **D3 — Le dépôt des pièces par le prestataire.**
  - (a) Possible par son lien, sur demande de la planner ; la pièce arrive « à vérifier ».
  - (b) La planner seule dépose.

  **Recommandation : (a).** C'est le prestataire qui a l'attestation à jour ; la planner garde la
  vérification.
- **D4 — Les contraintes du lieu.**
  - (a) Champs en données par type de prestataire, contrôle du chrono signalé et jamais bloquant.
  - (b) Contrôle bloquant.

  **Recommandation : (a).** La planner négocie souvent une dérogation avec le lieu.
- **D5 — Le chiffrement de l'IBAN de la planner.** Touche le schéma `quotes` (données
  existantes).
  - (a) Chiffrer aussi l'IBAN de la planner, par une migration de données annulable.
  - (b) Seulement les IBAN des prestataires.

  **Recommandation : (a).** DAT-08 vise toutes les coordonnées bancaires ; l'écran du lot 43 lit
  l'IBAN par le service.
- **D6 — Les commissions et le client particulier.**
  - (a) Affichage obligatoire au particulier (réponse 4 de l'avocat), au choix pour un
    professionnel.
  - (b) Au choix de la planner dans tous les cas (texte de PRE-07).

  **Recommandation : (a).** La réponse de l'avocat prime sur le texte du cahier des charges :
  c'est un écart assumé, noté dans l'ADR.
- **D7 — Le forfait touristique.**
  - (a) Alerte et blocage du modèle standard selon une règle de détection écrite en données, à
    relire par l'avocat (AV-10).
  - (b) Alerte seulement.

  **Recommandation : (a)**, comme l'a demandé l'avocat.
- **D8 — La facture de commission au prestataire.**
  - (a) Émise depuis le module des devis, comme une facture de la planner (numérotation,
    Factur-X), avec un destinataire professionnel.
  - (b) Suivi de la commission seulement, facture faite ailleurs.

  **Recommandation : (a).** C'est ce que l'expert-comptable décrit, et la numérotation continue
  l'impose.

## Points pour les conseils

- **Avocat** (question suivante, numéro donné à la fusion) :
  - **AV-10** — La règle de détection du forfait touristique : transport ou hébergement **et**
    autre prestation, vendus ensemble par la planner en revendeur. Est-ce suffisant ?
  - **AV-11** — L'accord de publication de ses clauses types (D14 du lot 31), pour le mandat et les
    conditions générales.
- **Expert-comptable** :
  - **EC-8** — Les débours en mode revendeur : à quelles conditions une dépense refacturée sort-elle
    de la base de TVA, et quelle mention porter sur la facture ?

## Migrations (prévision)

Numérotation : à partir du premier numéro libre de `main` (0173 aujourd'hui) ; une PR fusionnée
après une autre renumérote ses migrations **et** leur date (`when`).

- **48a** :
  - `vendors` :
    - `vendor_documents` (nature, fichier, fin de validité, déposé par, à vérifier) ;
    - `vendor_document_kinds` ;
    - champs de lieu en données par type ;
    - `vendors.iban_sealed`, `bic_sealed` ;
    - `vendor_bank_changes` (masqué avant et après, par, le, vérifié le, par) ;
  - notes confidentielles : `is_confidential` et contenu chiffré sur les notes des modules
    concernés, chacun dans son schéma ;
  - `quotes` : migration de données qui chiffre `quote_settings.iban` et `bic` (annulable).
- **48b** :
  - `quotes` :
    - `quote_lines.supply_mode` (intermédiaire ou revendeur) ;
    - `planner_fees` ;
    - `vendor_commissions` ;
    - destinataire « prestataire » des factures ;
    - modèles de mandat et de conditions générales ;
  - `budget` : ligne d'honoraires hors dépenses.
- Données de départ : natures de pièces, champs de lieu, modèle de mandat, conditions générales.

## Tests (prévision)

- **PRE-05** (horloge simulée) : alerte à J-30 ; pièce expirant avant l'évènement signalée ; dépôt
  par le lien « à vérifier ».
- **PRE-06** : séquence après l'heure de fin de la musique signalée, avec sa règle ; capacité
  dépassée signalée.
- **PRE-10 et SEC-27** :
  - changement journalisé et masqué ;
  - bandeau persistant jusqu'à la levée nominative ;
  - IBAN « à vérifier » sur les échéances et les remises ;
  - jamais montré au client avant la levée ;
  - test d'abus : un lien de prestataire ne change que son propre IBAN.
- **DAT-08** :
  - la base ne contient aucun IBAN ni note confidentielle en clair ;
  - la migration des IBAN de la planner, et son annulation ;
  - aucun IBAN dans les journaux ;
  - l'écran « Régler l'acompte » toujours juste.
- **BUD-08** : honoraires jamais comptés dans les dépenses ni dans une catégorie.
- **PRE-07 et D6** : commission affichée d'office à un particulier, au choix pour un professionnel ;
  facture de commission au prestataire, numérotée et en Factur-X.
- **JUR-10** :
  - modes par ligne, totaux séparés au centime ;
  - alerte au seuil de franchise (seuil de l'Admin) ;
  - forfait touristique : alerte et modèle standard bloqué.
- **DOC-02 et HUB-26** : mandat généré, variables manquantes listées, avertissement et version de
  revue présents.
- **Isolation et abus** (SEC-36) sur chaque table neuve.
- **Rejeu** : SC-04 et SC-05 (honoraires hors dépenses, IBAN du fleuriste changé puis vérifié),
  SC-09 en partie.

## Hors périmètre

- Champs personnalisés (HUB-25, D2).
- Plans de salle dessinés (lot 60).
- Signature avancée des mandats (lot de la signature renforcée, Q34).
- Clauses types de l'avocat avant son accord de publication.

## Ambiguïtés relevées

- PRE-07 et JUR-10 laissent l'affichage des commissions au choix de la planner ; l'avocat l'impose
  au particulier : sa réponse prime (D6).
- « Apports d'affaires » (PRE-07) : traités comme des commissions, avec une nature distincte.

## Travail en parallèle (lots 48, 52 et 53)

- **Avec le lot 53** : le radar des risques (GC-02) lira les pièces expirées et les IBAN « à
  vérifier » par le service `vendors`. Il ne lit aucune table : le lot 53 code un adaptateur vide
  si 48a n'est pas encore fusionné.
- **Avec le lot 52** : rien dans les schémas. La visibilité des notes confidentielles suit les
  rôles existants ; le lot 52 y branchera ses rôles par évènement.
- Traductions, `gap.csv`, `globals.css` : garder tout, accolades équilibrées.
