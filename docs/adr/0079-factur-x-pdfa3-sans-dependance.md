# ADR 0079 — Factur-X : fichier CII écrit par l'app et PDF/A-3 par mise à jour incrémentale

- Statut : accepté (lot 41, décisions D1, D2, D3 et D5 validées par Julien le 18/11/2026)
- Date : 2026-11-18
- Complète : [0019](0019-generation-pdf-react-pdf.md) (PDF par @react-pdf/renderer), [0046](0046-documents-a-son-image.md)
  (apparence des documents), [0059](0059-arrondi-des-montants-et-de-la-tva.md) (arrondi par taux),
  [0061](0061-pieces-inalterables.md) (originaux et chaîne d'empreintes).
- Exigences : FAC-10 (partie 1), JUR-02, JUR-12, JUR-13 de `docs/CAHIER_DES_CHARGES.md` ;
  spécification `docs/lots/lot-41-facturx-conformite.md` ; réponses 2, 3, 6, 7 et 10 de
  l'expert-comptable et 7 de l'avocat (`docs/conformite/`).

## Contexte

L'émission électronique devient obligatoire le 1er septembre 2027 pour les PME et les
micro-entreprises, franchise comprise (JUR-03, réponse 3). Le connecteur vers une plateforme
agréée est au lot 42 ; ce lot produit le fichier qu'il transmettra. Les factures étaient des PDF
classiques, polices non incorporées, gardés comme originaux avec leur empreinte (ADR 0061).

## Décision

1. **Toutes les factures, factures d'acompte, factures de solde et tous les avoirs émis à partir du
   lot 41 sont des Factur-X** (D1), particuliers compris ; profil **EN 16931** (D2), syntaxe CII.
   Une pièce émise avant le lot garde son PDF simple (copie `reform_snapshot` nulle) : rien n'est
   réémis ni réécrit.
2. **Le fichier structuré est écrit par l'app, sans bibliothèque** (`modules/quotes/facturx/cii.ts`) :
   gabarits, chaque texte échappé (et les caractères interdits par XML retirés), montants entiers
   écrits avec deux décimales. Il part **des mêmes copies figées que le PDF** (InvoiceView,
   CreditNoteView). Une seconde fonction relit le XML produit et compare ses totaux (HT, TVA par
   taux, TTC, reste à payer) aux montants que le PDF imprime, **au centime** (réponse 10). Une
   différence lève `FacturXTotalsMismatchError` dans la transaction qui attribue le numéro : la
   pièce n'est pas émise et le numéro n'est pas consommé. Une pièce d'essai (`DEMO`) est contrôlée
   de même, rendue à la demande, jamais transmise ni comptée.
3. **Choix de représentation, défauts prudents en attendant l'expert-comptable** (fiche, questions
   12 à 18) : types 380 (facture), 386 (acompte), 381 (avoir) ; cadre de facturation S1, B1 ou M1
   selon la catégorie de l'opération ; acomptes déduits d'une facture de solde **par lignes
   négatives, taux par taux**, comme le PDF depuis le lot 31c ; arrhes reçues en « montant déjà
   payé » ; franchise en catégorie E, motif `VATEX-FR-FRANCHISE`, avec l'identifiant fiscal (SIREN)
   quand il n'y a pas de numéro de TVA ; option sur les débits en code 5 de la date d'exigibilité ;
   notes PMD (pénalités), PMT (indemnité forfaitaire) et AAB (escompte) face à un professionnel ;
   unité C62 pour toutes les lignes (l'unité libre reste dans le PDF).
4. **Le PDF/A-3 (niveau B) est obtenu par une mise à jour incrémentale** (D3 a ;
   `modules/quotes/facturx/pdfa3.ts`, sans dépendance) : au PDF rendu par @react-pdf/renderer,
   l'app ajoute à la fin du fichier des objets nouveaux — métadonnées XMP (identification PDF/A-3 B
   et schéma d'extension Factur-X), profil sRGB, fichier joint `factur-x.xml` en relation
   « Alternative », dictionnaire des noms, catalogue complété — avec leur table de références et
   leur trailer. Le lecteur ne connaît que ce qu'il faut (table de références classique, catalogue,
   dictionnaire des noms) et refuse tout autre PDF (`UnreadablePdfError`). Le repli `pdf-lib` prévu
   par la spécification n'a pas servi : les validateurs acceptent les fichiers (ADR 0080).
5. **Le profil sRGB est écrit par l'app** (`facturx/icc.ts`) : en-tête ICC v2, primaires sRGB
   adaptées à D50 et courbe de transfert échantillonnée ; aucun fichier tiers ni licence.
6. **Polices incorporées** (D5 a) : factures et avoirs en **Liberation Sans et Liberation Serif 2.1.5**
   (licence SIL OFL 1.1), mêmes largeurs que Helvetica et Times ; fichiers dans
   `apps/symbola/lib/documents/fonts`, copiés dans l'image par `outputFileTracingIncludes`, et
   contrôlés par le test PDF de l'image en CI. Devis et contrats gardent les polices du moteur. Un
   retour à la ligne dans un texte faisait passer le moteur à sa police de secours (Helvetica, non
   incorporée) : chaque ligne devient son propre texte.
7. **L'original gardé et chaîné est le Factur-X** (ADR 0061) ; `original_documents.format` le dit
   (`facturx` ou `pdf`). Son empreinte entre dans la chaîne comme avant.
8. **Les mentions de la réforme sont figées** dans `invoices.reform_snapshot` et
   `credit_notes.reform_snapshot` (catégorie, option sur les débits active à la date d'émission,
   bon de commande, référence de l'acheteur, adresse de livraison si elle diffère, conditions d'un
   professionnel) ; l'acheteur entreprise (raison sociale, SIREN, TVA, adresse structurée) dans
   `buyer_snapshot`. Le déclencheur d'immuabilité couvre ces colonnes ; à la fin de la conservation,
   seule l'adresse de livraison s'efface, dans la transaction déclarée de l'anonymisation de
   l'acheteur ([ADR 0024](0024-rgpd-purge-mensuelle-et-fin-de-conservation-des-factures.md)).

## Conséquences

- Aucune dépendance nouvelle dans l'app ; quatre fichiers de polices (1,6 Mo) dans le dépôt.
- Le lot 42 transmettra ces fichiers ; les adresses électroniques de facturation (BT-34, BT-49),
  que la spécification française exige pour le flux vers une plateforme, viennent de l'annuaire et
  sont de son ressort (avertissements BR-FR-12 et BR-FR-13 de Mustang, sans erreur).
- Une évolution du moteur PDF (structure du fichier, table de références compressée) serait
  arrêtée par le lecteur et par les validateurs de la CI avant d'atteindre une facture.
- Les choix du point 3 changeront peut-être avec les réponses de l'expert-comptable : seules les
  pièces émises ensuite changeront.
