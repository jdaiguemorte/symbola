# ADR 0089 — Proposition en page web, signer puis régler par virement, relances et payeurs

- Statut : accepté (spécification du lot 43 validée par Julien le 18/11/2026, décisions D1 à D10 en (a))
- Date : 2026-11-18
- Exigences : FAC-02, FAC-08 (Divergent, ADR 0087), FAC-09, FAC-15, GC-01, SEC-16, BUD-06, BUD-11 ;
  JUR-07 (règles du lot 31b, inchangées).
- Liens : ADR 0026 (signature, Documenso), ADR 0028 (QR codes), ADR 0053 (liens personnels et
  avenant des actions sensibles), ADR 0065 (contrat et rétractation), ADR 0076 (file des tâches),
  ADR 0087 (règlement par virement au RIB, sans prestataire de paiement).

## Contexte

Le parcours PAR-02 s'arrêtait au devis signé : le client n'avait ni page de proposition, ni écran
pour régler l'acompte, ni relance ; ses familles ne pouvaient pas financer une part d'une ligne. Le
18/11/2026, Julien a retenu le règlement par virement au RIB du planner (Q21, ADR 0087) : « payer »
veut dire afficher le RIB, le montant et une référence, recueillir la déclaration du payeur, puis
laisser la planner confirmer l'encaissement.

## Décisions

### 1. La proposition est une page du portail, par version envoyée (FAC-02, FAC-15 ; D2, D3)

- Adresse `/portail/proposition/<version>` (identifiant non devinable de la version), ouverte par le
  lien personnel du client (rubrique « Devis ») : mêmes droits que le portail. Une version d'un autre
  évènement, un brouillon ou un identifiant forgé n'existent pas (SEC-13).
- Les blocs (mot d'accueil, présentation, photos, devis et options, échéancier, validité) suivent le
  **modèle de proposition** de l'organisation, par type d'évènement (`quotes.proposal_templates`,
  départ dans `proposal-templates.json`). Le devis est toujours présent ; « Accepter et signer »
  vient toujours à la fin.
- Le **mot d'accueil** se fige à l'envoi avec la version (`quote_versions.proposal_greeting`), repris
  du modèle s'il n'a pas été écrit pour ce devis. Les **photos** (trois au plus, PNG ou JPEG, type lu
  dans le contenu, antivirus, stockage privé) appartiennent au modèle et sont servies par l'app
  après contrôle du lien (ADR 0027). Elles ne figurent pas dans l'archive de l'export complet (la
  liste en `jsonb` n'est pas un champ de fichier du contrat export/v1) : limite connue.
- Le **PDF** est celui du devis (même rendu), précédé du mot d'accueil ; il porte les options
  choisies, ou toutes marquées « non retenue » si rien n'est choisi.
- L'**aperçu « vu par le client »** de la planner rend la même page, actions inactives, sans rien
  enregistrer.
- **Validité** : la date d'expiration est `quote_versions.valid_until`, déjà figée à l'envoi — pas de
  seconde colonne `expires_on`. L'expiration se calcule (le lendemain de cette date, heure de Paris) ;
  le statut `expired` de l'énuméré reste inemployé. Une version expirée ne se signe plus : le lien de
  signature n'est plus montré, l'envoi en signature et le choix des options par le client sont
  refusés ; la planner prolonge (`valid_until` repoussé, relance réarmée) ou envoie une nouvelle
  version. Une demande de signature déjà partie chez Documenso reste signable par le lien de l'e-mail
  de signature : la planner prolonge ou envoie une nouvelle version avant la signature.

### 2. « Accepter et signer » est un enchaînement, la signature reste celle du lot 31b (GC-01)

Étapes : options (si elles ne sont pas figées), **document préparé par la planner** (contrat généré
puis envoi en signature, inchangés : le contrat doit suivre le dernier choix des options), code à
usage unique, commande et information selon le canal (lot 31b, inchangé), signature (Documenso,
inchangé), puis « Régler l'acompte ». Symbola ne crée pas lui-même la demande de signature après le
choix des options : ce serait un changement du lot 31b (PDF, signataires, adresses de facturation)
hors du lot. La page de signature fictive renvoie à l'espace du client, où l'enchaînement reprend.

### 3. Le code avant de signer réutilise les codes des liens (SEC-16 ; D4)

- Les codes de l'ouverture d'un lien (`events.event_link_codes` : six chiffres, dix minutes, cinq
  essais, un seul usage, cinq par heure) servent aussi avant la signature, par deux fonctions du
  module events (`sendLinkActionCode`, `verifyLinkActionCode`) qui n'ouvrent pas de session : aucune
  table nouvelle dans `events`.
- La preuve est gardée côté devis : `quote_signers.signing_code_verified_at`. Le lien de signature
  ne s'affiche sur le portail que pour un signataire en attente dont le code a été vérifié **depuis
  son lien** il y a moins de trente minutes. Un code reçu par un autre lien ne vaut rien.
- L'e-mail de signature du lot 31b porte toujours le lien de signature (sauf à distance, où la
  commande passe d'abord par le portail) : il prouve la même chose que le code (accès à la boîte du
  signataire). JUR-14 (SMS, signature avancée) reste hors du lot.

### 4. Régler par virement : référence, QR code, déclaration, confirmation (FAC-08 Divergent ; D5, D6)

- `quotes.payment_references` : une référence par échéance, `SYM-<année>-<six caractères>` tirés au
  hasard dans l'alphabet de Crockford (sans I, L, O, U), unique dans l'organisation (contrainte de la
  base, nouveau tirage en cas de collision), sans nom ni numéro de devis. Elle est créée quand le
  règlement s'ouvre.
- QR code européen de virement (EPC069-12, version 002, UTF-8, correction M) : bénéficiaire (70
  caractères), IBAN (clé vérifiée), BIC facultatif, montant, référence en texte libre (elle n'est pas
  une référence RF ISO 11649). Produit par `qrcode` (ADR 0028), en SVG, sans script.
- **Selon le canal du contrat** (règles et textes de `contract-rules.json`, relus par l'avocat) :
  - en établissement, ou devis signé sans contrat : RIB affiché dès que tous ont signé ;
  - à distance : RIB affiché, avec le rappel des quatorze jours et du formulaire ;
  - hors établissement (rétractation ouverte) : **ni RIB ni déclaration avant le 8e jour** (signature
    complète + `noPaymentDays`), l'écran dit « Aucun paiement ne peut vous être demandé avant le … »,
    et un e-mail `payment_details` apporte le RIB et la référence ce jour-là, une seule fois. Aucune
    relance d'impayé ne part avant. AV-8 demande si cela suffit.
- « J'ai fait le virement » : déclaration horodatée, une fois, à une date ni future ni antérieure à
  la signature, par le **payeur désigné** s'il y en a un (module budget, lu par l'appelant et passé
  au service). La planner la voit dans « Aujourd'hui » et la confirme par l'**encaissement existant**
  (écritures du lot 23b). Aucun rapprochement automatique.

### 5. Relances d'impayés et avant expiration (FAC-09, FAC-15 ; D1, D7)

- Une tâche horaire (verrou des tâches périodiques, ADR 0076), dans les heures d'envoi (9 h à 19 h,
  Paris) : relance avant expiration (J-3 par défaut, une seule fois, ni signé, ni refusé, ni en
  signature), RIB du 8e jour, puis relances d'impayés (J+3, J+10, J+20 par défaut) d'un devis signé.
- Une relance s'inscrit dans `quotes.payment_reminders` (unicité échéance + rang) **juste avant
  l'envoi**, après avoir relu l'échéance sous verrou : réglée, déclarée ou suspendue, rien ne part,
  même si la déclaration arrive entre la liste et l'envoi. Après une panne, seule la plus récente des
  relances manquées part (pas trois e-mails d'un coup). La clé d'unicité de la file des e-mails
  (lot 40b) évite tout doublon d'envoi.
- Destinataires : les signataires du devis. La planner suspend les relances d'une échéance avec un
  motif, et les reprend.
- Pénalités : celles du lot 41 face à un professionnel ; face à un particulier, seulement au taux de
  la clause que l'organisation renseigne (vide par défaut) ; sinon une phrase neutre. AV-7.

### 6. Payeurs et calendrier, dans le module budget (BUD-06, BUD-11 ; D8, D9)

- `budget.event_payers` : les mariés (créés d'office, jamais retirés) et les autres payeurs, avec ou
  sans lien client. `budget.budget_line_payer_shares` : pourcentage ou montant par ligne ; les
  montants d'abord (plafonnés), puis les pourcentages, le reste aux mariés ; les arrondis au plus
  grand reste : la somme des parts égale le montant de référence de la ligne (engagé, sinon devisé,
  sinon prévu), au centime.
- Payeur désigné d'une échéance : colonne `vendor_payments.payer_id` (prestataires) et table
  `budget.planner_instalment_payers` (échéances de la planner, identifiant opaque du module quotes,
  ADR 0011). Le module quotes ne lit pas le budget (le budget lit déjà les devis) : l'écran passe le
  lien du payeur désigné au service de règlement.
- « Sa part seule » (oui par défaut) : le service du budget ne renvoie à ce payeur ni catégorie, ni
  total, ni la part d'un autre ; seulement sa part et ses échéances. Seul un des mariés (lien rattaché
  à un client de l'évènement) change ce réglage depuis son portail ; la planner aussi.
- Calendrier : mois par mois, échéances de la planner et des prestataires, avec payeur, statut et
  « Régler » ; filtré pour un payeur « part seule » ; en « catégories choisies », ses seules
  catégories. La même vue sert la planner.

### 7. Quatre natures d'e-mails (D10)

`proposal_sent`, `proposal_expiry_reminder`, `payment_details`, `invoice_reminder`, personnalisables
par l'organisation. La contrainte `hub.email_templates_kind_check` est élargie par une migration hub
à part (0169), accord de Julien : réunion des natures de main et des quatre ; l'annulation rend la
liste de main et est refusée tant qu'un modèle personnalisé de ces natures existe.

## Conséquences

- Migrations 0167 (quotes), 0168 (budget), 0169 (hub), ajouts seulement, annulables, sans arrêt de
  l'app. La PR fusionnée après une autre les renumérote et date leur `when` après la dernière.
- Données de départ : `proposal-templates.json`, `payment-reminders.json`, textes du règlement dans
  `contract-rules.json`, quatre modèles d'e-mails.
- Registre RGPD : nom du payeur, nom de qui déclare un virement, motif d'une suspension, mots
  d'accueil ; `privacy/v1` des modules quotes et budget les trouvent et les anonymisent.
- Aucun prestataire de paiement, aucune dépendance nouvelle, aucun sous-traitant.
- Questions pour l'avocat : AV-7 (pénalités d'un particulier), AV-8 (hors établissement : suffit-il de
  ne pas montrer le RIB avant le 8e jour ?).
