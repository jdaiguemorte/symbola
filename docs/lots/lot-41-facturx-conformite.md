# Lot 41 — Factur-X, mentions de la réforme, bon de commande, assistant de conformité

**Statut** : spécification proposée le 18/11/2026, **validée par Julien le 18/11/2026** : toutes les décisions retenues dans leur option recommandée (a), dépendances comprises (accord donné, ADR à écrire dans la PR du lot).
Branche `lot-41-facturx-conformite`, partie de `main` (85c655d, après la PR #131). Le lot change
le schéma `quotes` et, si D7 et D10 sont acceptées, le schéma `hub` : validation explicite
requise (CLAUDE.md § 8). Il ajoute peut-être des outils de contrôle à la CI (D4) : accord et ADR
requis. Il ne touche aucun parcours P0 hors de la facturation (PAR-04).

Comme pour les lots précédents : aucune version intermédiaire n'est déployée (gel des
déploiements jusqu'à la fin des lots). Le lot se rejoue en local.

Ce lot avance **en parallèle des lots 46 et 49** : voir « Travail en parallèle » à la fin.

## Contexte

Aujourd'hui, Symbola refuse toute facture à un client professionnel (« facture Factur-X pour un
client professionnel : pas encore disponible », `ProfessionalInvoiceNotSupportedError`,
`modules/quotes/service.ts`), décision 1 du lot 4 et Q19 (aucun client professionnel pendant le
pilote, « le lot 41 garde sa place »). Les factures des particuliers sont des PDF classiques
(@react-pdf/renderer, polices Helvetica et Times non incorporées), gardés comme originaux avec
leur empreinte (lot 23b, ADR 0061). L'émission électronique devient obligatoire pour les PME et
micro-entreprises le **1er septembre 2027** (JUR-03), franchise comprise (réponse 3 de
l'expert-comptable) ; le connecteur vers une plateforme agréée et l'e-reporting forment le
lot 42, à livrer avant l'été 2027. Ce lot-ci produit le **fichier** que le lot 42 transmettra.

Exigences du lot (`docs/GAP_REPORT.md` § 7, tableau « Phase 2 » ; écarts de `docs/gap.csv`) :

| ID | Exigence | P | Critère d'acceptation | Écart aujourd'hui |
| --- | --- | --- | --- | --- |
| FAC-10 (part 1) | Facture au format Factur-X ; connecteur vers une plateforme agréée | P1 | Échéance réglementaire d'émission : 1er septembre 2027 (JUR-03). | Absent : ni Factur-X ni connecteur (le connecteur est au lot 42) |
| JUR-02 | Mentions de la réforme : SIREN du client, adresse de livraison si elle diffère, nature de l'opération, option pour la TVA sur les débits | P1 | Confirmé (service-public.gouv.fr) | Absent : seule l'adresse de facturation des signataires existe |
| JUR-12 | Délais de paiement, pénalités de retard et indemnité forfaitaire repris sur les factures aux professionnels (art. L441-10 du Code de commerce) | P1 | À valider | Partiel : texte des professionnels, taux des pénalités et indemnité de 40 € (lot 31c) ; ni délai propre aux professionnels, ni bornes, ni escompte |
| JUR-13 | Bon de commande et références d'achat du client sur le devis et la facture | P1 | Pratique courante | Absent |
| GC-03 | Assistant de conformité : avant l'envoi, signalement d'une mention manquante, d'une clause absente, d'une facture incomplète | P1 | Il informe. Il ne remplace pas un conseil juridique. | Absent : seul le contrôle bloquant des mentions (FAC-07) existe |

Décisions et réponses qui s'appliquent :

- **Q19** : aucun client professionnel pendant le pilote ; le lot 41 garde sa place. **Q20** : la
  plateforme agréée reste au lot 42.
- **Réponses de l'expert-comptable du 13/11/2026** (Q36, fiche) : réponse 2 (les quatre mentions
  de la réforme entre assujettis ; la **catégorie de l'opération imprimée sur toutes les
  factures**) ; réponse 3 (la facturation électronique vaut aussi en franchise ; un PDF par
  e-mail ne suffira plus vers une entreprise) ; réponse 6 (garder le fichier émis comme original
  avec son empreinte ; **PDF/A-3 pour Factur-X**) ; réponse 7 (opération mixte : séparer les
  lignes par catégorie ; le solde déduit les acomptes en HT et en TVA) ; réponse 10 (**mêmes
  totaux au centime** entre le PDF et le fichier structuré) ; réponse 1 (numéro de bon de
  commande quand le client en émet un).
- **Réponse 7 de l'avocat** : client entreprise : délai de paiement de 30 jours par défaut,
  pénalités (trois fois le taux d'intérêt légal au moins), indemnité de 40 €, escompte « Néant »,
  numéro de bon de commande s'il existe, repris sur le devis et la facture, **verrouillés hors
  des bornes légales**.
- **ADR existants** : 0019 (PDF par @react-pdf/renderer), 0046 (apparence des documents), 0059
  (arrondi par taux), 0061 (pièces inaltérables), 0065 (contrats et dossier de preuve), 0066
  (reçus d'arrhes, solde par taux), 0069 (contact dans le noyau).

## Ce qui existe aujourd'hui

- **Émission** (`modules/quotes/service.ts`) : `issueDepositInvoice`, `issueBalanceInvoice`,
  `issueCreditNote` ; numérotation continue en transaction (`number_series`) ; copies figées
  (`seller_snapshot`, `buyer_snapshot`, `lines_snapshot`, `totals_snapshot`) ; facture immuable
  en base (déclencheur, migration 0042) ; original gardé par `keepInvoiceOriginal` (lot 23b,
  `original_documents`, chaîne d'empreintes `ledger_entries`). L'acheteur figé est la liste des
  signataires (`InvoiceBuyer = { name, billingAddress }`, adresse en texte libre).
- **Mentions** : liste en données (`packages/starter-templates/src/required-mentions.json`),
  contrôle pur `missingMentions` (`modules/quotes/mentions.ts`) qui bloque l'envoi du devis et
  l'émission en nommant chaque champ (FAC-07). Conditions des professionnels : texte à part
  (`quote_settings.invoice_mentions_professional`) et taux des pénalités
  (`late_penalty_rate`, `late-penalty.json`, indemnité de 40 €) depuis le lot 31c.
- **Type de client** : `quotes.client_kind` (particulier, professionnel, non-professionnel).
  Le client entreprise existe dans le noyau depuis le lot 36b : contact de genre `company` avec
  SIREN ou SIRET (`company_id_number`) et numéro de TVA, adresse structurée (ligne, code postal,
  ville, pays). Le PDF du devis affiche ces identifiants en lisant les clients **actuels** de
  l'évènement (`render-quote-pdf.ts`), rien n'est figé sur le devis.
- **Vendeur** : `hub.organization_profiles` garde l'adresse en **texte libre** (`address`), le
  SIREN, le numéro de TVA, l'immatriculation ; le régime de TVA est daté (`vat_regime_changes`).
- **Délai de paiement** : un seul, `quote_settings.invoice_payment_term_days` (30 par défaut),
  pour tous les clients.
- **Lignes** : `catalog_items`, `quote_lines`, `quote_template_lines` sans nature (bien ou
  service).
- **Contrats** : clauses à rôle (`contract_template_clauses.role`) ; règles en données
  (`contract-rules.json` : rôles exigés selon le régime de rétractation, marqueurs de texte à
  rédiger). Le contrôle des clauses exigées existe déjà au lot 31b.
- **PDF** : polices du moteur (Helvetica, Times), **non incorporées** ; aucune métadonnée XMP,
  aucun profil de couleur : les PDF actuels ne sont pas des PDF/A.
- **Portail** : le client signe le devis et le contrat depuis son lien (lots 27 et 31) ; aucune
  zone pour un numéro de commande.
- **E-reporting** : un export CSV (`app/devis/e-reporting`), base insuffisante d'après la
  réponse 4 de l'expert-comptable ; il reste au lot 42.

## Une seule PR

Le lot tient en une PR : tout se passe dans le module `quotes` (plus deux colonnes du `hub`) et
ses écrans. Le gros morceau est la fabrique Factur-X (partie A) ; les mentions, le bon de
commande et l'assistant s'appuient sur les mêmes données et les mêmes tests.

## Partie A — Factur-X : un PDF/A-3 qui porte son fichier structuré (FAC-10 ; D1 à D5)

- **Quoi** : chaque facture, facture d'acompte, facture de solde et avoir émis **à partir de ce
  lot** devient un Factur-X (D1) : un PDF/A-3 (niveau B) lisible comme aujourd'hui, qui porte le
  fichier `factur-x.xml` (syntaxe CII, profil EN 16931, D2). Les pièces déjà émises ne changent
  pas (immuables).
- **Le fichier structuré** est écrit par l'app, sans bibliothèque (chaîne de gabarits avec
  échappement XML), depuis **les mêmes copies figées** que le PDF : numéro, date, type de pièce
  (facture, acompte, avoir, à confirmer : question EC-1), vendeur, acheteur, lignes, ventilation
  de la TVA par taux, montants dus, échéance, conditions de paiement, référence de commande
  (partie C), facture d'origine pour un avoir. Une fonction pure produit le XML ; une seconde
  relit le XML produit et compare ses totaux au modèle du PDF, **au centime** (réponse 10).
  Une différence arrête l'émission avant la consommation du numéro.
- **Le PDF/A-3** : le PDF de la facture est rendu comme aujourd'hui, avec des polices
  incorporées (D5), puis complété (D3) : métadonnées XMP (identification PDF/A-3 B et schéma
  d'extension Factur-X), profil de couleur sRGB, fichier joint avec sa relation
  « Alternative ». C'est ce fichier final qui devient l'original gardé et chaîné (ADR 0061).
- **Contrôle** (D4) : chaque fichier de test passe un validateur PDF/A et un validateur
  EN 16931 en CI ; le rejeu local fait de même.
- **Envoi** : le Factur-X part par e-mail comme le PDF d'aujourd'hui. Jusqu'au 1er septembre
  2027, c'est admis ; ensuite, vers une entreprise, il devra passer par la plateforme agréée
  (lot 42). Un bandeau le dit sur l'écran des réglages de facturation, avec la date.
- **Client professionnel** : le refus `ProfessionalInvoiceNotSupportedError` disparaît. Une
  facture à un professionnel exige l'acheteur entreprise du devis (partie B, D6) : nom, SIREN,
  adresse structurée ; sinon l'émission est refusée et nomme le champ (FAC-07).

## Partie B — Mentions de la réforme (JUR-02 ; D6 à D10)

Les quatre mentions, portées sur la facture (PDF et XML) et, quand elles sont connues, sur le
devis :

1. **SIREN du client** (professionnel) : celui du contact entreprise désigné comme acheteur du
   devis (D6), figé à l'émission avec sa raison sociale, son numéro de TVA et son adresse
   structurée. Un SIRET saisi donne son SIREN (neuf premiers chiffres).
2. **Adresse de livraison** si elle diffère de l'adresse de facturation : zone facultative du
   devis, reprise et figée sur la facture ; imprimée seulement si elle est remplie et
   différente. Pour un évènement, le lieu de réception est proposé (pas imposé) comme adresse de
   livraison des biens.
3. **Nature de l'opération** (D9) : chaque ligne porte sa nature, « service » par défaut,
   « bien » au choix (catalogue, modèle de devis, ligne). La facture imprime « Prestations de
   services », « Livraisons de biens » ou « Opération mixte », sur **toutes** les factures
   (réponse 2), et la reprend dans le XML (cadre de facturation, à confirmer : EC-2).
4. **Option pour la TVA sur les débits** (D10) : réglage daté de l'organisation, réservé au
   régime assujetti ; quand il est actif, la facture imprime la mention prévue (texte en données,
   à valider : EC-3). Sans objet en franchise.

**Vendeur** (D7) : l'adresse du vendeur devient structurée (ligne, code postal, ville, pays),
exigée par le fichier structuré. L'ancien texte reste affiché tant que la planner n'a pas
complété ; la liste des mentions exige les nouveaux champs **pour les factures** seulement, à
partir de ce lot.

## Partie C — Bon de commande (JUR-13 ; D8)

- Zone « Numéro de bon de commande du client » sur le devis, et, à côté, une « référence de
  l'acheteur » facultative (code service, référence interne de l'acheteur).
- **Modifiable jusqu'à chaque émission**, même après la signature : dans la pratique, le service
  achats émet souvent le bon après l'accord sur le devis. Chaque facture fige la valeur du
  moment ; une facture déjà émise ne change pas.
- **Saisie par le client** : sur son portail, au moment de signer un devis professionnel, la
  cliente peut indiquer son numéro (SC-11, étape 4). La planner le voit et peut le corriger avant
  l'émission. La saisie respecte la portée du lien (seul le signataire du devis concerné).
- Imprimé sur le devis (s'il est connu), sur chaque facture et chaque avoir ; porté dans le XML.

## Partie D — Clients professionnels : délai, pénalités, escompte (JUR-12 ; D11)

- **Délai de paiement propre aux professionnels**, 30 jours par défaut (réponse 7 de l'avocat),
  à côté de celui des particuliers. **Bornes légales en données** (`professional-terms.json` :
  60 jours après l'émission, ou 45 jours fin de mois, à faire confirmer : AV-1) ; un réglage hors
  bornes est refusé et le dit.
- **Escompte pour paiement anticipé** : texte en données, « Néant » par défaut, modifiable.
- **Pénalités et indemnité** : déjà en place (lot 31c) ; reprises sur le devis et la facture d'un
  professionnel, et dans le XML (conditions de paiement).
- La liste des mentions exige délai, escompte, taux des pénalités pour un client professionnel ;
  l'émission manque d'un champ → refus nommé (FAC-07, inchangé dans son principe).

## Partie E — Assistant de conformité (GC-03 ; D12)

- **Avant l'envoi** d'un devis, d'un contrat ou d'une facture, un panneau « Vérifications
  avant envoi » liste des **points d'attention** qui **ne bloquent pas** (le blocage reste celui
  des mentions exigées, FAC-07). Chaque point dit le constat, pourquoi il compte, et mène au
  réglage ou au champ concerné.
- **Règles en données** (`packages/starter-templates/src/compliance-checks.json`, FR et EN),
  réglables par l'Admin comme les mentions exigées. Premier jeu proposé (à faire relire : AV-2
  et EC-4) :
  - client professionnel sans numéro de bon de commande (« si le client en émet un ») ;
  - client professionnel dont l'adresse de livraison n'est pas renseignée alors que des lignes
    sont des biens ;
  - devis à un particulier à distance ou hors établissement dont le contrat lié n'a pas de
    clause de rétractation (rôle exigé du lot 31b non encore rempli au moment du devis) ;
  - clause de contrat encore marquée « [À rédiger » ou « [À compléter » ;
  - contrat d'un montant au-delà du seuil de signature avancée (`contract-rules.json`) signé en
    signature simple ;
  - facture de solde alors qu'une facture d'acompte de l'échéancier n'est pas émise ;
  - option sur les débits non renseignée pour une organisation assujettie ;
  - date de la prestation absente ou postérieure de plus d'un an à l'émission.
- **Mention fixe** sous le panneau : « Ces vérifications vous aident ; elles ne remplacent pas
  le conseil d'un professionnel du droit ou de la comptabilité. » (texte à valider : AV-2).
- Chaque point vu est noté, sans donnée personnelle, au journal d'audit (« vérification
  affichée »), pour savoir ce qui sert ; aucun point ne bloque.

## Décisions à prendre

- **D1 — Quelles pièces en Factur-X.**
  - (a) Toutes les factures et tous les avoirs émis à partir de ce lot, particuliers compris.
  - (b) Seulement ceux des clients professionnels.

  **Recommandation : (a).** Un seul chemin d'émission, exercé chaque jour par la pilote (dont
  tous les clients sont des particuliers) ; avec (b), le chemin professionnel ne serait jamais
  joué avant le premier vrai client entreprise. Le PDF/A-3 sert aussi la conservation de dix
  ans (réponse 6). À confirmer par l'expert-comptable pour les particuliers (EC-5).
- **D2 — Le profil Factur-X.**
  - (a) EN 16931 (anciennement « Comfort ») : toutes les données de la norme européenne.
  - (b) BASIC : plus léger, lignes simplifiées.
  - (c) EXTENDED : plus riche, plus de cas à tester.

  **Recommandation : (a).** C'est le profil de la norme sur laquelle repose la réforme ; (b)
  pourrait ne pas suffire à une plateforme agréée, (c) n'apporte rien au métier du planner. À
  confirmer (EC-1).
- **D3 — Fabriquer le PDF/A-3.** Une dépendance hors pile est possible ici.
  - (a) **Sans dépendance** : l'app ajoute au PDF de @react-pdf/renderer une mise à jour
    incrémentale (objets ajoutés à la fin du fichier, comme le prévoit la norme PDF) :
    métadonnées XMP, profil sRGB, fichier joint, références du catalogue. Environ 300 lignes,
    testées, contrôlées par le validateur de D4.
  - (b) **`pdf-lib`** (MIT) : bibliothèque qui sait joindre un fichier et écrire les métadonnées.
    Plus rapide à écrire ; mais sa dernière version date de 2021 (une variante maintenue existe,
    `@cantoo/pdf-lib`), et elle relit tout le PDF.

  **Recommandation : (a).** Le PDF d'entrée est toujours le même moteur, la mise à jour
  incrémentale est un format simple et stable, et le validateur PDF/A tranche à chaque CI.
  Une dépendance sans entretien sur la pièce la plus réglementée du produit serait le choix
  fragile. (b) reste le repli si (a) ne passe pas le validateur ; il demanderait alors ton
  accord et un ADR.
- **D4 — Valider les fichiers.** Ajoute des outils à la CI (hors pile, jamais dans l'app).
  - (a) Deux validateurs de référence dans un job de CI, par leurs images Docker : **veraPDF**
    (PDF/A, logiciel libre de la fondation PDF Association) et **Mustang** (Factur-X et règles
    EN 16931, Apache 2.0). Ils contrôlent les factures de test de chaque cas (acompte, solde,
    avoir, franchise, assujetti, professionnel, particulier). ADR.
  - (b) Sans validateur externe : nos tests relisent le XML et le PDF.

  **Recommandation : (a).** Sans validateur de référence, rien ne prouve qu'une plateforme
  agréée acceptera nos fichiers ; nos propres tests ne contrôlent que ce que nous savons
  vérifier. Les deux outils ne tournent qu'en CI et au rejeu, jamais en production.
- **D5 — Les polices des factures.** PDF/A exige des polices incorporées.
  - (a) Factures et avoirs avec des polices libres aux mêmes métriques que Helvetica et Times
    (Liberation Sans et Liberation Serif, licence SIL OFL), fichiers rangés dans le dépôt et
    inscrits à l'inventaire des licences ; devis et contrats inchangés.
  - (b) Tous les PDF passent à ces polices.

  **Recommandation : (a).** Même mise en page (mêmes largeurs de caractères), changement limité
  aux pièces qui doivent être PDF/A ; (b) peut suivre si l'écart d'apparence gêne.
- **D6 — L'acheteur d'un devis professionnel.**
  - (a) Le devis désigne son **acheteur entreprise** : un contact de genre « entreprise » parmi
    les clients de l'évènement (ou ajouté). Les signataires restent les personnes qui signent pour
    elle. La facture fige la raison sociale, le SIREN, le numéro de TVA et l'adresse structurée.
  - (b) Les signataires restent l'acheteur, l'entreprise en texte libre.

  **Recommandation : (a).** Le fichier structuré exige un acheteur identifié avec une adresse
  structurée ; le contact entreprise existe déjà (lot 36b), sans ressaisie.
- **D7 — L'adresse structurée du vendeur.** Touche le schéma `hub`.
  - (a) Colonnes ajoutées à `hub.organization_profiles` (code postal, ville, pays) ; l'ancienne
    adresse devient la ligne d'adresse ; la planner complète une fois (la liste des mentions le
    lui demande avant la première facture).
  - (b) Lecture du texte libre actuel (code postal et ville devinés).

  **Recommandation : (a).** Deviner une adresse sur une pièce fiscale n'est pas acceptable ;
  la planner complète en trente secondes, une seule fois.
- **D8 — Le bon de commande.**
  - (a) Sur le devis, modifiable jusqu'à chaque émission, saisissable par la cliente au moment
    de signer depuis son portail, figé sur chaque facture.
  - (b) Saisi par la planner seulement.

  **Recommandation : (a).** SC-11 (étape 4) : « Claire signe et indique son numéro de bon de
  commande ». Le bon arrive souvent après l'accord.
- **D9 — La nature de l'opération.**
  - (a) Par ligne (bien ou service, « service » par défaut), au catalogue, aux modèles et aux
    lignes du devis ; la facture en déduit sa catégorie.
  - (b) Un réglage par organisation.

  **Recommandation : (a).** Réponse 7 de l'expert-comptable : une opération mixte sépare ses
  lignes par catégorie ; un réglage global ne le permet pas. Pour la pilote, rien ne change : tout
  reste « service » par défaut.
- **D10 — L'option pour la TVA sur les débits.** Touche le schéma `hub`.
  - (a) Réglage fiscal de l'organisation, daté comme le régime de TVA (`hub`), figé sur chaque
    facture.
  - (b) Réglage de facturation du module `quotes`.

  **Recommandation : (a).** C'est un choix fiscal de l'entreprise, comme son régime de TVA,
  rangé et daté au même endroit (HUB-23).
- **D11 — Délai des professionnels et bornes légales.**
  - (a) Délai propre aux professionnels (30 jours par défaut), bornes en données (refus hors
    bornes), escompte « Néant » par défaut ; tous repris sur le devis, la facture et le XML.
  - (b) Garder un seul délai pour tous.

  **Recommandation : (a).** C'est la réponse 7 de l'avocat ; un seul délai mêle deux règles
  différentes.
- **D12 — L'assistant de conformité.**
  - (a) Panneau non bloquant avant l'envoi d'un devis, d'un contrat ou d'une facture ; règles en
    données réglables par l'Admin ; mention « ne remplace pas un conseil » ; premier jeu de règles
    ci-dessus, relu par l'avocat et l'expert-comptable.
  - (b) Seulement de nouvelles mentions bloquantes.

  **Recommandation : (a).** Le critère dit « il informe » ; bloquer sur un point d'attention
  (un bon de commande absent) arrêterait des envois légitimes.

## Points pour les conseils

À verser dans leurs fiches (`docs/conformite/`) à l'écriture du lot, ou dès ta validation si tu
veux les envoyer plus tôt. Aucun ne bloque le début du lot ; EC-1 à EC-3 doivent être tranchés
avant la PR.

**Expert-comptable** (question 12 de sa fiche) :

- **EC-1** : profil EN 16931 suffisant (D2) ? Codes de type de pièce : facture (380), facture
  d'acompte (386), avoir (381) ?
- **EC-2** : comment porter la catégorie de l'opération dans le fichier (cadre de facturation de
  la spécification française) et l'imprimer : « Prestations de services », « Livraisons de
  biens », « Opération mixte » ?
- **EC-3** : texte de la mention de l'option pour la TVA sur les débits ; sa place dans le
  fichier structuré.
- **EC-4** : facture de solde : déduire les acomptes par des lignes négatives (HT et TVA par
  taux, comme le PDF depuis le lot 31c) ou par le « montant déjà payé » du fichier ? Les deux
  donnent les mêmes totaux, pas la même ventilation.
- **EC-5** : Factur-X pour les factures aux particuliers aussi (D1) : un inconvénient ?
- **EC-6** : franchise en base : catégorie de TVA et code de motif d'exonération dans le
  fichier ; la mention de l'article 293 B reste imprimée.
- **EC-7** : jusqu'au 1er septembre 2027, l'envoi du Factur-X par e-mail à un client entreprise
  reste-t-il admis ?

**Avocat** (question 14 de sa fiche ; la 13 arrive avec la PR #132) :

- **AV-1** : bornes du délai de paiement entre professionnels (L441-10 : 60 jours après
  l'émission ou 45 jours fin de mois) ; un plafond propre au secteur de l'évènementiel ?
- **AV-2** : liste des vérifications de l'assistant (partie E) et texte de la mention « ne
  remplace pas un conseil » ; une responsabilité de l'éditeur si un point manque à la liste ?

## Migrations (prévision)

- **`quotes`** (une migration, avec son annulation, sans marqueur « arrêt requis » : ajouts
  seulement) :
  - `quotes` : `buyer_contact_id` (contact entreprise, uuid opaque), `client_order_reference`,
    `buyer_reference`, `delivery_address` ;
  - `catalog_items`, `quote_template_lines`, `quote_lines` : `nature` (`service` par défaut,
    `goods`) ;
  - `quote_settings` : `professional_payment_term_days` (30), `professional_discount_terms`
    (« Néant » repris des données) ;
  - `invoices`, `credit_notes` : copies figées nouvelles (référence de commande, adresse de
    livraison, catégorie, option sur les débits) en colonnes facultatives ou dans un instantané
    `jsonb` ; le déclencheur d'immuabilité est étendu aux nouvelles colonnes ;
  - `original_documents` : format de l'original (`pdf`, `facturx`).
- **`hub`** (si D7 et D10 en a ; une migration) : `organization_profiles` : `postal_code`,
  `city`, `country_code` (FR par défaut), `vat_on_debits` daté (table de changements sur le
  modèle de `vat_regime_changes`, ou colonne datée : à trancher à l'écriture).
- Numéros : à partir de 0150. Si une autre PR du lot 46 ou 49 fusionne avant, ce lot renumérote
  les siennes (voir « Travail en parallèle »).

## Fichiers touchés (prévision)

- `packages/db/src/schema/quotes.ts`, `hub.ts` ; migrations et annulations ;
  `packages/db/src/quotes-isolation.integration.test.ts`, `invoices-immutability`.
- `packages/contracts/src/quotes/service-contract.ts` (acheteur entreprise, références, nature).
- `apps/symbola/modules/quotes/` : `service.ts`, `repository.ts`, `mentions.ts`,
  `payment-terms.ts`, `invoicing.ts` ; nouveaux `facturx/` (XML, totaux, PDF/A-3 incrémental,
  tests) et `compliance.ts` (règles de l'assistant, fonction pure).
- `apps/symbola/app/devis/` : formulaires du devis (acheteur, bon de commande, livraison,
  nature des lignes), `factures/invoice-pdf-model.ts`, rendu des factures et avoirs (polices
  incorporées), `[quoteId]/quote-pdf-model.ts`, panneau « Vérifications avant envoi »,
  `parametres` (délai et escompte des professionnels, bandeau du 1er septembre 2027),
  `catalogue` et `modeles` (nature).
- `apps/symbola/app/parametres` : adresse structurée et option sur les débits (fiche de
  l'entreprise).
- `apps/symbola/app/portail` : numéro de bon de commande au moment de signer.
- `apps/symbola/app/exploitation/parametres` : règles de l'assistant (à côté de `required-mentions-form.tsx`).
- `packages/starter-templates/src/` : `required-mentions.json` (nouveaux champs),
  `compliance-checks.json`, `professional-terms.json`, mention des débits.
- `apps/symbola/public/fonts` ou `lib/documents/fonts` (Liberation, D5) ; profil sRGB.
- `packages/i18n/src/messages/fr.json`, `en.json` (espaces de noms `Quotes`, `Documents`,
  `Contracts`, et un nouveau `Compliance` placé juste après `Contracts`).
- `.github/workflows/ci.yml` (job de validation, D4) ; ADR (Factur-X et PDF/A-3 ; validateurs de
  CI) ; `docs/conformite/licences.md` (polices, profil de couleur, outils de CI) ;
  `tools/licences` si besoin.
- Aide des écrans touchés ; `docs/gap.csv` ; bilan du lot ; rejeu `docs/recette/SC-11.md`.

## Tests

- **Chaque critère devient un `it`** sous son identifiant (`FAC-10`, `JUR-02`, `JUR-12`,
  `JUR-13`, `GC-03`).
- **FAC-10** : pour chaque cas (acompte, solde avec acomptes déduits, avoir partiel et total ;
  franchise et assujetti à plusieurs taux ; particulier et professionnel ; essai guidé `DEMO`),
  le XML relu donne les mêmes totaux que le PDF **au centime** ; une différence provoquée bloque
  l'émission sans consommer de numéro ; le fichier passe veraPDF et Mustang en CI (D4) ;
  l'original gardé est le Factur-X et son empreinte entre dans la chaîne ; une facture émise
  avant le lot reste lisible et inchangée ; un client professionnel sans acheteur, sans SIREN ou
  sans adresse structurée : refus qui nomme le champ.
- **JUR-02** : SIREN figé (un SIRET donne son SIREN) ; adresse de livraison imprimée seulement si
  elle diffère ; catégorie « service », « bien », « mixte » imprimée sur toutes les factures ;
  option sur les débits imprimée seulement en assujetti et quand elle est active à la date
  d'émission (changement de date testé avec une horloge simulée).
- **JUR-13** : numéro modifiable après signature, figé à l'émission, inchangé ensuite ; saisi
  par la cliente depuis son lien, refusé depuis le lien d'un autre devis ou d'un autre
  évènement.
- **JUR-12** : délai hors bornes refusé (61 jours, ou 46 jours fin de mois) ; bornes atteintes
  acceptées ; escompte « Néant » par défaut ; mentions présentes sur le devis et la facture d'un
  professionnel, absentes pour un particulier.
- **GC-03** : chaque règle du jeu de départ s'affiche dans son cas et pas en dehors ; aucune ne
  bloque ; la mention « ne remplace pas un conseil » est présente ; une règle désactivée par
  l'Admin ne s'affiche plus.
- **Isolation et abus** : les nouvelles colonnes restent sous la RLS de `quotes` ; un acheteur
  entreprise d'une autre organisation est refusé (même message qu'un contact inconnu) ; l'Admin
  ne lit aucune facture ; le numéro de commande saisi au portail est borné (longueur, caractères)
  et neutralisé dans le XML (échappement testé avec `<`, `&`, guillemets) ; aucune donnée
  personnelle dans les journaux du rendu.
- **Bout en bout** (ordinateur et 375 px, axe WCAG 2.2) : devis professionnel complet jusqu'à la
  facture de solde ; panneau de vérifications ; saisie du bon de commande au portail.
- **Rejeu** : SC-11 étapes 4 et 5 sur le jeu fictif (Novaléa SAS, SIREN fictif, bon
  BC-2027-0142, adresse de facturation distincte du lieu) : la facture porte le SIREN, le bon de
  commande et l'adresse de facturation, et passe les deux validateurs ; SC-02 étape 7 rejoué pour
  vérifier que la facture d'acompte d'un particulier reste juste (désormais en Factur-X).

## Hors périmètre

- Connecteur vers une plateforme agréée, annuaire, statuts de cycle de vie, e-reporting
  (FAC-10 partie 2, JUR-03, JUR-04 : lot 42).
- Réception de factures électroniques (obligation de la planner, hors de Symbola ; action de
  Julien, Q36).
- Validation par un tiers d'un devis au-delà d'un seuil, droits limités d'Hugo (SC-11 étapes 1 à
  3 et 6 : lots 52 et 56).
- Plusieurs entités ou marques dans une organisation (FAC-17, P2).
- Relances d'impayés et calcul des pénalités dues (FAC-09 : lot 43).
- Écran « Mes obligations » (RGP-20, P2) : l'assistant de ce lot en sera une source.

## Ambiguïtés relevées

- **« Adresse de livraison »** : la réforme vise la livraison de **biens** ; une prestation de
  services pure n'en a pas. Le lot la rend facultative, proposée quand des lignes sont des biens.
- **« Nature de l'opération »** et « catégorie de l'opération » (réponse 2) : lues comme la même
  mention.
- **« Verrouillés hors des bornes légales »** (avocat) : lu comme un refus de tout réglage hors
  bornes, pas comme un verrouillage complet du délai.
- **« Références d'achat du client »** (JUR-13) : lues comme le numéro de bon de commande et une
  référence d'acheteur facultative.
- **Factur-X d'un essai guidé** (`DEMO`) : produit comme les autres (pour que l'essai montre la
  vraie pièce), jamais transmis ni compté (ARC-13, DAT-10).

## Travail en parallèle (lots 41, 46 et 49)

Ce lot ne touche ni le module des rendez-vous ni celui des invités. Ses seuls points communs avec
les lots 46 et 49 :

- **Numéros de migration** : chaque lot commence à 0150 ; la deuxième PR fusionnée renumérote
  les siennes (fichiers SQL, annulations, `_journal.json`, instantanés `meta/` regénérés par
  drizzle-kit, listes du test d'annulation).
- **Schéma `hub`** (D7, D10) : le lot 49 y ajoute aussi des colonnes (durées de conservation des
  invités), dans une autre table ; seul l'ordre des migrations est en jeu.
- **Traductions** : ce lot écrit dans `Quotes`, `Documents`, `Contracts` et un nouvel espace
  `Compliance` placé juste après `Contracts` ; les lots 46 et 49 n'y touchent pas.
- **Portail** : ce lot modifie le formulaire de signature (`client-contract-forms.tsx` ou
  `client-quotes.tsx`) ; le lot 46 touche l'accueil du portail, le lot 49 ajoute une rubrique :
  fichiers différents, sauf `portal-content.tsx` si le lot 41 y passe (à éviter).
- **Menu** : aucun ajout au menu principal ; une rubrique de réglages déjà existante
  (« Devis et factures »).

## Bilan du lot 41 (18/11/2026)

Fait (ADR 0080 et 0081) :

- **FAC-10 (partie 1)** : toutes les factures, factures d'acompte, de solde et tous les avoirs
  émis sont des Factur-X EN 16931 : PDF/A-3 B par mise à jour incrémentale, sans dépendance (le
  repli `pdf-lib` n'a pas servi), fichier CII écrit par l'app, relu et comparé au centime aux
  montants du PDF ; une différence arrête l'émission sans consommer de numéro. L'original gardé et
  chaîné est le Factur-X (`original_documents.format`). Le refus « Factur-X pas encore disponible »
  disparaît : un professionnel exige l'acheteur entreprise du devis, nommé s'il manque. Polices
  Liberation incorporées aux factures et avoirs (D5).
- **D4** : job « Factur-X » de la CI : 22 fichiers (onze cas, français et anglais) contrôlés par
  veraPDF (22 PASS) et Mustang (22 valides) ; mêmes résultats en local.
- **JUR-02** : SIREN de l'acheteur figé (un SIRET donne son SIREN), adresse de livraison si elle
  diffère, catégorie de l'opération sur toutes les factures (nature par ligne : catalogue, modèles,
  devis), option sur les débits datée (`hub`), adresse structurée du vendeur (`hub`).
- **JUR-12** : délai des professionnels (30 jours, bornes 60 jours et 45 jours fin de mois en
  données), escompte « Néant » par défaut, pénalités et indemnité, sur le devis, la facture et le
  XML (notes PMD, PMT, AAB).
- **JUR-13** : bon de commande et référence de l'acheteur sur le devis, modifiables jusqu'à chaque
  émission, saisis aussi par le signataire depuis son lien ; figés sur chaque facture et avoir.
- **GC-03** : panneau « Vérifications avant envoi » non bloquant sur le devis, le contrat et la
  facture ; huit règles en données (FR, EN), désactivables par l'Admin ; points vus au journal
  d'audit par leurs clés.
- Migrations `0150` (quotes) et `0151` (hub), annulables, ajouts seulement ; registre RGPD,
  anonymisation de l'adresse de livraison à la fin de la conservation ; inventaire des licences
  (polices, outils de la CI) ; questions EC-1 à EC-7 (fiche de l'expert-comptable, 12 à 18) et AV-1,
  AV-2 (fiche de l'avocat, 14 et 15), défauts prudents appliqués en attendant.

Constats faits en route :

- Un retour à la ligne dans un texte faisait passer le moteur PDF à sa police de secours
  (Helvetica, non incorporée) : chaque ligne devient son propre texte.
- La spécification française (flux 2) que Mustang applique demande les adresses électroniques de
  facturation (BT-34, BT-49) : elles viennent de l'annuaire, au lot 42 (avertissements, pas
  d'erreurs).
- Un formulaire du portail envoyé avant l'hydratation part avec `Origin: null` (politique
  `no-referrer` des pages à lien) et Next.js le refuse : tous les formulaires du portail sont
  concernés ; laissé en l'état, noté dans `docs/recette/SC-11.md`.

Reste, hors de ce lot : connecteur de plateforme agréée, annuaire, e-reporting (lot 42) ; réponses
de l'expert-comptable et de l'avocat ; recette au staging après le gel.
