# Lot 17 — Des devis et des factures à son image

**Statut : validé par Julien le 08/11/2026** : maquette et décisions A à G, puis « pense à
intégrer également les devis dans l'amélioration proposée ». Le devis reçoit donc la même
mise en page que la facture et l'avoir, avec ses textes à lui (introduction, conditions
particulières) et son échéancier d'acomptes.

**Avancement (09/11/2026)** : DEV-07 à DEV-12 réalisés sur la branche `lot-17-documents`
(ADR 0046, migration 0081). Écarts : la facture prend le vendeur à jour à son émission (règle 3) ;
l'aperçu passe en deux colonnes seulement si la zone de contenu a la place.

Maquette : artefact « Lot 17 — Factures personnalisables »
(<https://claude.ai/artifact/B3JaWwPaXocAKs9PCUNFym>).

## Contexte

Retour de Julien du 08/11/2026, après la recette du lot 16 : « il est primordial de pouvoir
personnaliser le modèle de facture et faire quelque chose de plus agréable : avec son propre
logo, des mentions particulières etc. »

État avant le lot 17 :

- le PDF du devis, de la facture et de l'avoir est une seule mise en page (`QuotePdfDocument`),
  en noir et blanc, en Helvetica ;
- le logo est prévu (`organization_profiles.logo_key`), mais aucun écran ne permet de le
  déposer ;
- la fiche entreprise ne porte que le nom, l'adresse, le SIREN, la forme juridique et le régime
  de TVA : ni e-mail, ni téléphone, ni SIRET, ni numéro de TVA, ni RCS, ni capital ;
- seule la facture a un texte libre (« mentions de facturation ») ; le devis n'a ni
  introduction ni conditions particulières, et son échéancier d'acomptes n'est pas imprimé ;
- aucun IBAN : le client ne sait pas où virer son acompte.

## Décisions (validées le 08/11/2026)

| | Question | Décision |
| --- | --- | --- |
| **A** | Où se règle l'apparence ? | Une rubrique **Paramètres › Ventes › Documents**. Le logo se dépose aussi depuis **Entreprise et TVA**. |
| **B** | Que devient un document déjà émis quand on change le modèle ? | Il **garde son apparence** : un devis envoyé, une facture ou un avoir émis sont figés à l'émission. Un devis en brouillon suit les réglages courants. |
| **C** | Quelles polices ? | Deux : **Moderne** (Helvetica) et **Classique** (Times), incluses dans le moteur PDF (aucune dépendance). |
| **D** | Quelle couleur ? | Une **couleur libre** et six nuances proposées. Le contraste est corrigé automatiquement : le texte reste lisible quelle que soit la couleur choisie. |
| **E** | Où figurent l'IBAN et le BIC ? | Sur les **factures** (avec l'échéance et la référence de virement) et sur le **devis**, sous l'échéancier des acomptes. |
| **F** | Quels textes ? | Une introduction par document (devis, facture), les **conditions particulières du devis**, les **conditions de paiement** de la facture (l'actuel champ « mentions »), un **pied de page libre**. Les mentions obligatoires s'ajoutent seules : TVA non applicable, « EI » après le nom d'un entrepreneur individuel, SIRET, RCS, capital. L'indemnité de 40 € ne concerne que les clients professionnels, encore non gérés (DEV-04). |
| **G** | Le logo sert-il ailleurs ? | Oui : sur le **programme du jour J** (déjà le cas) et dans l'**en-tête de l'espace client**. La couleur ne s'applique qu'aux PDF. |

## Règles communes

1. **Rien n'est en dur** (CLAUDE.md §2.5) : nuances proposées, textes de départ (conditions
   particulières du devis, conditions de paiement) sont des fichiers de données traduisibles de
   `packages/starter-templates`. Un texte jamais enregistré n'est pas imprimé ; le champ est
   pré-rempli avec le texte de départ, à relire.
2. **Un document émis ne change jamais** (ONB-02, DEV-04) : l'apparence, les coordonnées, les
   textes et l'IBAN sont copiés dans l'instantané vendeur (`seller_snapshot`) à l'envoi du devis
   et à l'émission de la facture ; un avoir reprend l'instantané de sa facture. Un instantané
   antérieur au lot 17 s'imprime avec l'apparence neutre (police Moderne, graphite).
3. **La facture prend le vendeur à jour** au moment de son émission (avant le lot 17 : celui figé
   à l'envoi du devis). La mention de TVA et les totaux restent ceux du devis signé.
4. **Le logo est un fichier privé** (ADR 0027) : PNG ou JPEG, 2 Mo au plus, type vérifié par le
   contenu, antivirus ; servi par l'app après contrôle de la session, jamais par un lien direct
   vers le stockage.

## DEV-07 — Fiche entreprise complète pour les documents

- **Étant donné** la fiche Entreprise et TVA, **quand** la titulaire ou une planner saisit
  l'e-mail et le téléphone de contact, le site web, le SIRET, le numéro de TVA
  intracommunautaire, l'immatriculation (RCS ou RM) et le capital social, **alors** ils sont
  enregistrés et figurent sur les prochains devis et factures.
- **Étant donné** un SIRET qui n'a pas 14 chiffres, un numéro de TVA mal formé ou un e-mail
  invalide, **quand** elle enregistre, **alors** l'enregistrement est refusé avec un message
  qui dit quoi corriger, et rien n'est modifié.
- **Étant donné** une organisation en entreprise individuelle ou micro-entreprise, **quand** un
  document est produit, **alors** le nom du vendeur est suivi de « EI ».
- **Étant donné** une société, **quand** un document est produit, **alors** le pied de page
  porte la forme juridique, le capital, le SIRET, l'immatriculation et le numéro de TVA
  renseignés, sans ligne vide pour ceux qui manquent.
- Isolation : l'organisation A ne lit ni ne modifie la fiche de B ; un marié n'y a pas accès ;
  l'Admin non plus.

## DEV-08 — Logo de l'organisation

- **Étant donné** Paramètres › Ventes › Documents ou Entreprise et TVA, **quand** elle dépose un
  PNG ou un JPEG de 2 Mo au plus, **alors** il remplace le logo précédent et apparaît dans
  l'aperçu.
- **Étant donné** un fichier d'un autre type (même renommé en `.png`), de plus de 2 Mo ou
  infecté, **quand** elle le dépose, **alors** il est refusé avec un message clair et le logo
  actuel ne change pas.
- **Quand** elle retire ou remplace le logo, **alors** les prochains documents n'ont plus
  l'ancien ; les documents déjà émis gardent le leur (le fichier reste dans le stockage tant
  qu'un document émis le cite).
- **Étant donné** un marié connecté à son espace, **quand** il ouvre son espace, **alors**
  l'en-tête montre le logo de l'organisation (sinon son nom seul).
- Isolation : le logo de A n'est jamais servi à une session de B ; un visiteur sans session
  reçoit un refus.
- Limite de débit : les envois de logo passent par la limite des envois de fichiers (SEC-02).

## DEV-09 — Apparence des documents

- **Quand** elle choisit une des six nuances ou saisit une couleur libre (`#RRGGBB`), **alors**
  l'aperçu se met à jour aussitôt, et les prochains documents utilisent cette couleur pour les
  titres, les filets et le bandeau du total.
- **Étant donné** une couleur trop claire pour du texte sur fond blanc (jaune pâle), **quand**
  le document est produit, **alors** la couleur des textes est assombrie jusqu'à un contraste
  d'au moins 4,5:1, et le texte posé sur la couleur est blanc ou encre selon ce qui contraste
  le mieux.
- **Quand** elle choisit la police Classique, **alors** les documents sont en Times ; Moderne,
  en Helvetica.
- **Quand** elle clique « Télécharger un exemple en PDF » (devis ou facture), **alors** elle
  reçoit un PDF d'exemple avec ses réglages enregistrés, marqué « Exemple », sans numéro de
  série consommé ni document créé.
- **Étant donné** une couleur saisie qui n'est pas au format `#RRGGBB`, **quand** elle
  enregistre, **alors** l'enregistrement est refusé.

## DEV-10 — Textes des devis et des factures

- **Quand** elle saisit l'introduction du devis et ses conditions particulières, **alors** le
  devis les imprime : l'introduction sous le bloc client, les conditions après les totaux.
- **Quand** elle saisit l'introduction de la facture et ses conditions de paiement, **alors**
  les factures les impriment aux mêmes places.
- **Quand** elle saisit un pied de page libre, **alors** il figure en bas de chaque page de
  tous les documents, au-dessus de la ligne des mentions légales et du numéro de page.
- **Étant donné** des textes jamais enregistrés, **quand** elle ouvre l'écran, **alors** les
  conditions particulières du devis et les conditions de paiement sont pré-remplies avec le
  texte de départ dans sa langue ; rien n'est imprimé tant qu'elle n'a pas enregistré.
- Chaque texte est limité (introductions et pied de page : 600 caractères ; conditions : 2 000).

## DEV-11 — Paiement : IBAN, échéance, échéancier

- **Quand** elle saisit un IBAN et un BIC valides, **alors** ils sont enregistrés (IBAN affiché
  par groupes de quatre caractères).
- **Étant donné** un IBAN dont la clé de contrôle est fausse, ou un BIC qui n'a pas 8 ou 11
  caractères, **quand** elle enregistre, **alors** l'enregistrement est refusé.
- **Étant donné** une facture émise avec un IBAN renseigné, **alors** son PDF porte un encadré
  « Règlement » : échéance, IBAN, BIC et référence à indiquer (le numéro de la facture).
- **Étant donné** un devis avec un échéancier, **alors** son PDF liste les acomptes (libellé,
  date, montant) et le solde, puis l'IBAN et le BIC s'ils sont renseignés.
- **Étant donné** une organisation sans IBAN, **alors** l'encadré n'affiche que l'échéance (ou
  l'échéancier), sans ligne vide.
- Registre RGPD : IBAN, e-mail et téléphone de contact sont déclarés (ceux d'un entrepreneur
  individuel sont des données personnelles), ainsi que l'instantané vendeur qui les copie.

## DEV-12 — Nouvelle mise en page, figée à l'émission

- **Étant donné** un devis, une facture d'acompte, une facture de solde ou un avoir, **alors**
  le PDF suit la mise en page de la maquette : logo et coordonnées en tête, type et numéro à
  droite dans la couleur, blocs « De » et « Pour », dates, tableau des lignes, totaux avec un
  bandeau (« Reste à payer » sur une facture, « Total » sur un devis ou un avoir), mentions,
  pied de page avec les mentions légales et « Page n / N ».
- **Étant donné** un devis envoyé, **quand** elle change la couleur, la police, les textes ou
  l'IBAN, **alors** le PDF de ce devis ne change pas ; un devis en brouillon, lui, suit les
  nouveaux réglages.
- **Étant donné** une facture émise, **quand** elle change ses réglages, **alors** le PDF de la
  facture ne change pas, et l'avoir émis ensuite sur cette facture reprend son apparence.
- **Étant donné** un document émis avant le lot 17, **alors** il s'imprime avec l'apparence
  neutre et ses données d'origine, sans erreur.
- **Étant donné** un document d'essai (`is_demo`), **alors** le filigrane « Essai » reste.
- **Étant donné** le PDF envoyé en signature, **alors** le bloc « Bon pour accord » garde une
  balise par signataire (DEV-02).

## Hors périmètre

- Factur-X et clients professionnels (lot dédié, DEV-04) ; l'indemnité forfaitaire de 40 € en
  dépend.
- Plusieurs modèles par organisation, polices importées, couleur dans l'interface de l'app.
- Envoi des factures par e-mail depuis l'app.
