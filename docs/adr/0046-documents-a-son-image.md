# ADR 0046 — Devis et factures à son image : apparence figée dans l'instantané vendeur

- Statut : accepté
- Date : 2026-11-09
- Précise : [0019](0019-generation-pdf-react-pdf.md) (PDF côté serveur),
  [0027](0027-telechargements-servis-par-l-app.md) (fichiers servis par l'app) et le lot 4
  (DEV-01 à DEV-04 : instantanés figés à l'envoi et à l'émission)
- Décisions de Julien du 08/11/2026 : maquette et décisions A à G du lot 17
  (`docs/lots/lot-17-documents.md`), puis « pense à intégrer également les devis dans
  l'amélioration proposée ».

## Contexte

« Il est primordial de pouvoir personnaliser le modèle de facture et faire quelque chose de
plus agréable : avec son propre logo, des mentions particulières etc. » Le PDF commun aux
devis, factures et avoirs était en noir et blanc. Le logo était prévu en base sans écran pour
le déposer. La fiche entreprise n'avait ni e-mail, ni téléphone, ni numéro de TVA, et aucun
IBAN n'était imprimé.

Une facture émise ne change jamais (DEV-04), un devis envoyé non plus (ONB-02). Une apparence
réglable ne doit donc pas modifier après coup un document déjà émis.

## Décision

### Données

- **Fiche entreprise** (`hub.organization_profiles`, migration 0081, annulable) : e-mail et
  téléphone de contact, site web, numéro de TVA intracommunautaire, immatriculation (RCS ou
  RM, texte libre), capital social en centimes. Le SIRET reste dans `hub.organizations.siret`,
  saisi à la création (PRD-HUB-03) et désormais modifiable par la planner : une seule source.
- **Réglages des documents** (`quotes.quote_settings`, même migration) :
  - couleur `#rrggbb` (nulle = graphite de départ) ;
  - police `modern` ou `classic` (Helvetica ou Times, incluses dans le moteur PDF : aucune
    dépendance ni fichier de police) ;
  - IBAN et BIC, contrôlés (clé ISO 13616, 8 ou 11 caractères) ;
  - introduction du devis, conditions particulières du devis, introduction de la facture,
    pied de page libre. Les conditions de paiement restent dans `invoice_mentions`.
- Nuances proposées, couleur neutre et conditions particulières de départ : fichier de données
  traduisible `packages/starter-templates/src/document-style.json` (CLAUDE.md §2.5).
- Registre RGPD : e-mail et téléphone de contact, IBAN (ceux d'un entrepreneur individuel sont
  personnels), et l'instantané vendeur qui les copie.

### Figé dans l'instantané vendeur, sans nouvelle colonne

`SellerSnapshot` (jsonb `seller_snapshot` des versions de devis, factures et avoirs) reçoit des
champs facultatifs : forme juridique, SIRET, numéro de TVA, immatriculation, capital,
coordonnées de contact, et `document` (couleur, police, IBAN, BIC, introduction, conditions,
pied de page).

- À l'**envoi d'un devis**, l'instantané fige l'apparence et les textes du devis.
- À l'**émission d'une facture**, l'instantané prend le **vendeur à jour** et l'apparence du
  jour. Avant le lot 17, il recopiait celui figé à l'envoi du devis : une facture de solde
  émise des mois plus tard aurait gardé une ancienne adresse et aucune des nouvelles
  coordonnées. La mention de TVA et les totaux restent ceux du devis signé.
- Un **avoir** reprend l'instantané de sa facture, donc son apparence.
- Un **brouillon** s'imprime avec les réglages courants (`currentQuoteSeller`).
- Un instantané antérieur au lot 17 n'a pas ces champs : il s'imprime avec l'apparence neutre
  (graphite, Moderne), sans erreur. Aucune reprise de données n'est nécessaire.

L'ajout de champs facultatifs garde le contrat interne compatible : `QuoteSettings` et
`updateQuoteSettings` ne changent pas. Les nouveaux réglages ont leur type et leurs fonctions
(`DocumentSettings`, `getDocumentSettings`, `updateDocumentSettings`).

### Mise en page

- Un seul modèle de données (`QuotePdfModel`) pour le devis, la facture et l'avoir, construit
  par des fonctions pures et testées, puis rendu deux fois : en PDF (`quote-pdf.tsx`) et en
  HTML pour l'aperçu de l'écran Documents. Un PDF ne peut pas s'afficher dans la page
  (`X-Frame-Options: DENY`, CSP), d'où cette réplique HTML fidèle.
- Le devis imprime aussi son échéancier (acomptes et solde), puis l'IBAN. La facture imprime un
  encadré « Règlement » (échéance, IBAN, BIC, référence à rappeler).
- Pied de page sur chaque page : texte libre, ligne des mentions légales, « Page n / N ». Le
  nom d'un entrepreneur individuel est suivi de « EI ».
- **Contraste** : la couleur choisie est assombrie jusqu'à 4,5:1 sur le blanc et sur sa propre
  teinte (fond des blocs « De » et « Pour ») ; le texte posé sur la couleur est blanc ou encre.
- Les couleurs de l'aperçu passent par des variables CSS posées en CSSOM après le rendu : la
  CSP refuse les attributs `style` du HTML rendu côté serveur.
- Deux colonnes (formulaire, aperçu) seulement si la zone de contenu, et non l'écran, a la
  place (requête de conteneur) : à 1 280 px, le menu principal et celui des réglages en
  prennent déjà une bonne part.

### Logo

- PNG ou JPEG, 2 Mo au plus, type vérifié par le contenu avant tout stockage, antivirus, par la
  route d'envoi `/logo` (L16-SEC-02, ADR 0044 : origine, session, limite de débit, corps borné).
- Servi par `GET /logo` à l'équipe et aux mariés de l'organisation de la session (aucun
  identifiant dans l'adresse ; `v` ne sert qu'à rafraîchir le cache), jamais par un lien vers le
  stockage (ADR 0027). Refus sans session.
- Un logo remplacé ou retiré reste dans le stockage : les documents émis le citent par leur
  instantané. Aucun traitement ne les supprime encore (le MVP ne supprime pas d'organisation) :
  à prévoir avec la purge des documents en fin de conservation légale.
- Affiché sur les PDF, sur le programme du jour J (déjà le cas) et dans l'en-tête de l'espace
  client (décision G).

## Conséquences

- Annuler 0081 (`docs/runbooks/restauration.md`, § 4 bis) supprime les réglages saisis depuis.
  Les instantanés gardent leurs champs du lot 17, ignorés par une version antérieure de l'app.
- Un document d'exemple (« Télécharger un exemple en PDF ») ne crée rien et ne consomme aucun
  rang de numérotation.
- Hors périmètre : plusieurs modèles par organisation, polices importées, couleur dans
  l'interface, Factur-X et clients professionnels (l'indemnité forfaitaire de 40 € en dépend).
