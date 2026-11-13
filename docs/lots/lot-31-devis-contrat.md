# Lot 31 — Devis complet et contrat

**Statut** : spécification validée par Julien le 13/11/2026 (« Oui je valide » : D1 à D10 en (a),
D8 revu selon sa remarque). Branche `lot-31-devis`, partie du lot 30b (PR #110) ; la PR visera
`main` après #110.

## Contexte

Phase 1 du plan (`docs/GAP_REPORT.md` § 7) : fermer les parcours P0. Après le Jour J (lots 29 et
30), le lot 31 complète la vente (parcours PAR-02, scénario SC-02 « De la demande à
l'acompte ») : un devis complet avec options, puis un contrat généré, signés ensemble en ligne,
et la facture d'acompte sans autre saisie. Le lot change le schéma et touche des points
juridiques : il attend ta validation, et les textes juridiques restent à faire relire (§ 20 du
cahier des charges, Q29).

**Exigences** (toutes P0) :

| ID | Exigence | Critère |
| --- | --- | --- |
| FAC-01 | Devis composé depuis le catalogue et les modèles : sections, options, remises, conditions. | Un devis type se crée en moins de cinq minutes. |
| FAC-04 | Contrat généré depuis un modèle à variables. Clauses paramétrables. | Aucune variable non remplie ne part au client. |
| FAC-05 | Factures d'acompte, intermédiaires et de solde, générées depuis l'échéancier du devis. | Le solde déduit les acomptes déjà facturés. |
| FAC-07 | Mentions obligatoires paramétrées (HUB-23) et contrôle bloquant avant émission. | L'émission est refusée si une mention requise manque. Le message nomme le champ. |
| DOC-02 | Génération depuis des modèles à variables : contrat, mandat, brief, feuille de route. | Les variables manquantes sont listées avant la génération. |
| DOC-03 | Signature électronique intégrée, plusieurs signataires, dossier de preuve (Documenso). | Le planner ne quitte pas Symbola pour faire signer. |
| JUR-01 | Mentions obligatoires paramétrées et contrôlées avant émission ; exonération en franchise. | Liste à valider par l'expert-comptable. |
| JUR-07 | Contrat à distance ou hors établissement : information précontractuelle, rétractation de 14 jours sauf exception ; le modèle gère les deux cas. | Exception « date déterminée » à valider. |
| JUR-08 | Sommes versées d'avance : acompte ou arrhes, choix imposé par le modèle. | À valider. |
| JUR-09 | Identité, assurance, médiateur de la consommation, conditions générales, paramétrés et repris sur les documents. | À valider. |
| JUR-20 | Modèles juridiques présentés comme des bases à adapter. | Avertissement visible sur chaque modèle. |
| HUB-21 | Modèles par type d'évènement (dont devis et contrat), duplicables et versionnés. | Modifier un modèle ne change pas les évènements déjà créés. |
| HUB-23 | Paramètres fiscaux et légaux datés. | Un changement de régime ne modifie aucun document déjà émis. |
| HUB-26 | Bibliothèque de départ livrée comme données, marquée « à adapter ». | Chaque modèle de contrat porte l'avertissement de relecture. |

**Scénario** : SC-02, étapes 3 à 7 au MVP : Camille compose le devis (formule complète, deux
options), vérifie l'aperçu « vu par le client » et envoie ; Léa coche une option et signe ;
Maxime signe deux jours plus tard ; l'événement, la facture d'acompte et l'échéancier existent
sans autre saisie. Mesures : quinze minutes pour Camille, trois pour Léa, aucune ressaisie,
facture conforme à FAC-07. L'étape 8 (Léa règle l'acompte en ligne) relève du paiement en ligne
(lot 43) ; au MVP, Camille saisit l'encaissement.

**Voisines, hors du lot** : proposition en page web et paiement en ligne (FAC-02, lot 43) ;
Factur-X et mentions de la réforme (lot 41) ; mandat et commissions (JUR-10, lot 48) ; modèles
d'e-mails (lot 38) et questionnaires (lot 45) de HUB-21 ; brief et feuille de route de DOC-02
(lots 37 et 47).

## Constat du 13/11/2026 (après le lot 30b)

- **Devis** (`quotes.quotes`, `quote_versions`, `quote_lines`) : lignes du catalogue ou libres,
  remise par ligne et globale, versions figées à l'envoi (régime de TVA, mention légale, vendeur,
  totaux), aperçu « vu par le client » (lot 27a). **Ni sections, ni options, ni modèle de
  devis** : chaque devis part de zéro.
- **Échéancier** (`payment_schedule_items`) : montant ou pourcentage, date ; le solde est calculé.
  Toutes les avances s'appellent « acompte » ; rien ne distingue les arrhes.
- **Factures** : acompte (une échéance) et solde (acomptes déduits, nets des avoirs) existent ;
  numérotation continue, documents figés, originaux et chaîne d'empreintes (lot 23b). Elles
  s'émettent **à la main** ; rien ne se passe à la signature.
- **Mentions** : la mention « TVA non applicable, art. 293 B du CGI » est automatique en
  franchise ; les conditions de paiement sont un texte libre de départ. **Aucun contrôle
  bloquant** : un devis part même sans SIREN ni adresse.
- **Profil de l'organisation** (`hub.organization_profiles`) : SIREN, adresse, RCS ou RM,
  capital, numéro de TVA, coordonnées. **Ni assurance, ni médiateur, ni conditions générales.**
- **Régime de TVA daté** (`hub.vat_regime_changes`) ; les autres réglages (mentions, conditions)
  ne sont pas datés, mais chaque document émis en garde une copie, et le journal d'audit (lot 23)
  garde chaque modification avec son auteur et sa date.
- **Signature** (Documenso derrière une interface) : un PDF par demande, plusieurs signataires,
  balise `{{SIGNATURE, rN}}`, dossier de preuve archivé avec empreinte. La planner crée la
  demande ; chaque signataire signe par son lien. Le devis seul se signe.
- **Contrat** : rien. Aucun modèle, aucune variable, aucune clause, ni rétractation ni arrhes.
- **Bibliothèque de départ** (`packages/starter-templates`) : listes et textes en données, mais
  sans marque « à adapter » et sans modèle juridique.
- **Fiches** : `docs/conformite/fiche-avocat.md` (rétractation, acompte ou arrhes, informations du
  professionnel, niveau de signature, modèles) et `fiche-expert-comptable.md` (liste des
  mentions) attendent les réponses des professionnels.

## Découpage (décision D1)

- **31a — Le devis complet** : sections et options (choisies par le client sur son portail),
  modèles de devis, mentions obligatoires bloquantes, assurance et médiateur, acompte ou arrhes.
  Deux migrations (quotes, hub).
- **31b — Le contrat et la signature** : modèles de contrat à variables et clauses, génération
  avec liste des variables manquantes, rétractation dans ses deux cas, signature du devis et du
  contrat en un envoi, facture d'acompte sans autre saisie, bibliothèque de départ « à adapter ».
  Une migration (quotes).

## Lot 31a — Le devis complet

### Partie A — Sections et options (FAC-01, décision D2)

- Une version de devis se découpe en **sections** titrées (« Coordination », « Décoration »),
  ordonnées ; une ligne appartient à une section ou à aucune. Chaque section a son sous-total.
- Une ligne peut être **en option** : affichée avec son prix, à part, **hors du total** tant
  qu'elle n'est pas choisie.
- **Le client choisit ses options sur son portail**, avant de signer (SC-02, étape 5) : il coche,
  voit le total se mettre à jour, puis signe le devis tel qu'il l'a choisi. Le choix est figé dès
  que la signature commence ; le second signataire signe le même devis. La planner voit le choix,
  daté et nominatif, et peut aussi cocher à sa place (choix fait au téléphone).
- Le PDF montre les sections, leurs sous-totaux, les options choisies au total et les autres à
  part (« non retenue »).
- **Découpage précisé à la réalisation** (13/11/2026) : au 31a, le choix du client est enregistré
  et le total suit ; la planner lance ensuite la signature, comme aujourd'hui. Au 31b, qui refait
  la signature (devis et contrat en un PDF), le choix du client lance lui-même la signature, pour
  que Léa coche puis signe d'un même geste (SC-02, étape 5).

### Partie B — Modèles de devis (FAC-01, HUB-21, décision D3)

- Un **modèle de devis** par type d'événement : sections, lignes (du catalogue ou libres),
  options, échéancier type (« 30 % à la signature, 40 % à J-60, solde à J-7 »), conditions.
- « Nouveau devis depuis un modèle » copie le tout : modifier le modèle ensuite ne change aucun
  devis existant. Un modèle se **duplique** ; son numéro de version augmente à chaque
  modification, et le devis garde la version dont il vient.
- Un modèle de départ par type d'événement, en données (`packages/starter-templates`), marqué
  « à adapter ».

### Partie C — Mentions obligatoires bloquantes (FAC-07, JUR-01, JUR-09, HUB-23, décision D4)

- **Liste des mentions requises, en données** (fichier de départ, puis réglage de l'Admin, car ce
  sont des valeurs réglementaires) : par document (devis, facture d'acompte, de solde, avoir),
  par régime de TVA (franchise, assujetti), par type de client (particulier, entreprise) et par
  forme juridique. Chaque mention pointe un champ : nom, adresse, SIREN, RCS ou RM, capital
  (société), numéro de TVA (assujetti), assurance, médiateur, conditions générales, conditions de
  paiement, pénalités. La liste est marquée « à valider par l'expert-comptable ».
- **Informations du professionnel** (JUR-09), nouveaux champs du profil : assureur et numéro de
  contrat de la responsabilité civile professionnelle, couverture géographique ; médiateur de la
  consommation (nom, site) ; conditions générales de vente (texte).
- **Contrôle bloquant** à l'envoi d'un devis et à l'émission d'une facture ou d'un avoir : si
  une mention requise manque, l'action est refusée et le message nomme chaque champ, avec un lien
  vers l'endroit où le remplir.
- **Datés** (HUB-23) : chaque document émis garde déjà la copie de ses mentions ; le réglage
  affiche « en vigueur depuis le … » et son historique vient du journal d'audit.

### Partie D — Acompte ou arrhes (JUR-08, décision D5)

- Chaque devis dit si ses sommes versées d'avance sont des **acomptes** ou des **arrhes** : un
  réglage de l'organisation propose une valeur, le devis l'impose avant l'envoi.
- Le mot choisi apparaît sur l'échéancier, le PDF, la facture et le portail ; la clause
  correspondante vient du contrat (31b).

### Partie E — Tests, rejeu et documents du 31a

- **Tests** : sous-totaux de sections, options hors du total, total recalculé après le choix,
  choix figé à la signature, copie d'un modèle (le modifier ne change pas le devis), liste des
  mentions par cas (franchise, assujetti, particulier, entreprise), refus nommant le champ,
  acompte ou arrhes sur les pièces.
- **Isolation** : modèles, sections et choix d'une autre organisation inaccessibles ; un lien
  personnel ne choisit que les options de son devis ; Admin sans accès.
- **Playwright** : un devis type en moins de cinq minutes depuis un modèle ; envoi refusé faute
  d'assurance, avec le nom du champ ; Léa coche une option sur son portail ; 375 px et 360 px,
  axe-core.
- **Rejeu** : SC-02, étapes 3 à 5 (jusqu'au choix de l'option), sur le jeu fictif.
- **Documents** : `docs/gap.csv`, aide des écrans, registre RGPD (choix daté et nominatif du
  client), fiches de l'expert-comptable et de l'avocat mises à jour.

### Bilan du lot 31a (13/11/2026)

**Fait** :
- **Sections et options** (D2) :
  - migration 0120 : `quotes.quote_sections` ; sur `quote_lines`, `section_id`, `is_option`,
    `option_chosen` ; sur `quote_versions`, le choix daté et nominatif (`options_chosen_at`,
    `options_chosen_by`, `options_chosen_by_kind`). Annulation fournie ;
  - sous-total par section ; une option reste hors du total tant qu'elle n'est pas choisie ;
    l'écran, le PDF et le portail marquent « choisie » ou « non retenue, hors du total » ;
  - le client coche ses options sur son portail : le total suit, le choix est daté et nominatif,
    figé dès qu'une demande de signature existe. La planner peut cocher pour lui (choix fait au
    téléphone) ; une nouvelle version garde sections, options et choix ;
  - l'aperçu « vu par » montre les options, boutons inactifs.
- **Modèles de devis** (D3) :
  - quatre tables (`quote_templates`, ses sections, lignes et échéances type) ; écran « Modèles
    de devis » : ajouter le modèle de départ, dupliquer, renommer, supprimer. Depuis un devis :
    l'enregistrer comme nouveau modèle, ou à la place d'un modèle existant (sa version augmente) ;
  - « Partir d'un modèle » à la création du devis, depuis la fiche de l'événement. Le devis copie
    sections, lignes, options, remise globale et échéancier (« à la signature », « N jours avant
    l'événement »), et garde la version du modèle ;
  - modèle de départ « Mariage — organisation complète (à adapter) » en données
    (`packages/starter-templates/src/quote-templates.json`), avec l'avertissement « Modèles à
    adapter ».
- **Mentions exigées** (D4) :
  - liste de départ en données (`required-mentions.json`), par document, régime de TVA, type de
    client et forme juridique, marquée « à valider par l'expert-comptable » ; l'Admin la règle
    (`hub.platform_settings.required_mentions`, migration 0121) ;
  - informations du professionnel (migration 0121) : assureur, contrat et couverture de la
    responsabilité civile professionnelle ; médiateur (nom et site) ; conditions générales de
    vente. Repris sur le devis et son PDF ;
  - contrôle bloquant à l'envoi du devis et à l'émission des factures d'acompte et de solde : le
    refus nomme chaque champ, avec le lien vers l'endroit où le remplir. Un avoir reprend les
    mentions figées de sa facture ; un devis d'essai n'est pas contrôlé.
- **Acompte ou arrhes** (D5) : réglage de l'organisation proposé sur chaque nouveau devis, imposé
  avant l'envoi dès qu'il y a un échéancier ; le mot figure sur l'écran du devis, le PDF
  (« Échéancier des acomptes » ou « des arrhes »), la facture (« Facture d'arrhes ») et le portail.
- **RGPD** : `quote_versions.options_chosen_by` au registre, trouvé par la recherche, anonymisé à
  l'oubli tant que le devis n'est pas signé.
- **Textes et aide** : en français et en anglais ; aide de l'écran « Modèles de devis » et trois
  questions dans l'aide du devis.

**Vérifications** :
- tests unitaires : app 439, dont le PDF (sections, option non retenue, « Échéancier des
  acomptes » ou « des arrhes ») et les mentions par cas (franchise, assujetti, particulier,
  entreprise, société) ; modèles de départ 44 ; traductions 36 ; RGPD 39 ;
- intégration : base 154 (annulation de 0120 et 0121, isolation des sections et des modèles),
  app 545. Elle couvre les sous-totaux, le choix du client puis figé, la copie d'un modèle, le
  refus nommant chaque champ au devis et aux factures, l'acompte ou les arrhes, les abus (autre
  organisation, autre événement, ligne qui n'est pas une option) et le RGPD ;
- de bout en bout : 246 réussis, 1 ignoré (déjà ignoré avant), 1 échec ponctuel. L16-SEC-01, en
  taille ordinateur, a dépassé son délai ; il était passé au premier passage complet, puis passe
  10 fois sur 10 seul, et le lot ne touche pas à la double authentification. Ils comprennent
  `e2e/fac-01-07-devis-complet.spec.ts` : devis type depuis un modèle en moins de cinq minutes,
  envoi refusé faute d'assurance et de médiateur avec le nom du champ, Léa qui coche une option
  sur son portail, modèles de départ ; ordinateur et 375 px, axe-core ;
- lint, types, frontières de modules, registre RGPD : verts ; journaux du serveur sans e-mail ni
  téléphone ; Semgrep : 0 alerte ; Gitleaks : 0 dans les fichiers du lot.

**Rejeu SC-02 étapes 3 à 5** (`docs/recette/SC-02.md`) :
- passé sans blocage : 30 gestes pour Camille du modèle de départ à l'envoi, dont la saisie
  unique des informations du professionnel et les prix du modèle ; 3 gestes pour Léa à 375 px ;
- deux défauts trouvés et corrigés : le mot « acomptes » manquait au PDF et au portail (D5) ; un
  parcours existant (ONB-02-01) visait un bouton devenu ambigu.

**Écarts avec la spécification, et suites** :
- **HUB-23** : le réglage n'affiche pas « en vigueur depuis le … ». Chaque document émis garde la
  copie de ses mentions, et la liste de l'Admin est tracée au journal.
- **Partie A** : le choix du client est enregistré au 31a ; il lancera lui-même la signature au
  31b (découpage précisé le 13/11/2026).
- Les prochaines actions du portail ne citent pas les options à choisir.
- Le jeu fictif ne remplit pas la fiche entreprise des organisations (SIREN, adresse, régime de
  TVA) : le rejeu l'a fait d'abord. À charger dans un lot de recette.
- Aucun ADR nouveau.
- **Déploiement** : les migrations 0120 et 0121 rejoignent le déploiement d'ensemble (gel des
  déploiements).
- **Reste** : réponses de l'expert-comptable (question 1, et les arrhes en question 7) et de
  l'avocat (questions 2 et 3) ; rejeu de Julien sur le staging, porte 2 ; puis le 31b.

## Lot 31b — Le contrat et la signature

### Partie F — Modèles de contrat à variables (FAC-04, DOC-02, HUB-21, décision D7)

- Un **modèle de contrat** par type d'événement : un titre, des **clauses** ordonnées (titre et
  texte), chacune obligatoire ou facultative, et des **variables** entre accolades :
  `{client.noms}`, `{evenement.date}`, `{evenement.lieu}`, `{devis.numero}`,
  `{devis.total_ttc}`, `{devis.echeancier}`, `{organisation.assurance}`, `{organisation.mediateur}`…
  La liste des variables est fixe et documentée, avec un aperçu.
- **Génération** depuis un devis : la planner coche les clauses facultatives ; **avant la
  génération, les variables manquantes sont listées** (« Lieu de l'événement : vide »), et la
  génération est refusée tant qu'il en reste.
- Le contrat généré est **figé** (texte, variables résolues, version du modèle) ; une
  modification crée une nouvelle version, comme le devis.
- Les modèles se dupliquent et sont versionnés, comme ceux du devis.

### Partie G — Rétractation (JUR-07, décision D8)

Dans l'événementiel, le droit de rétractation n'est pas systématique (remarque de Julien du
13/11/2026) : il dépend du contrat (à distance, hors établissement ou en établissement), du
client (particulier ou entreprise) et des exceptions légales. Symbola ne le décide pas : il le
fait paramétrer, et il alerte.

- **Paramétrage** :
  - un réglage de l'organisation propose une valeur : « s'applique » ou « ne s'applique pas » ;
  - chaque contrat la reprend et la planner la confirme ou la change à la génération, avec le
    motif quand elle ne s'applique pas (contrat signé en établissement, client professionnel,
    exception légale) ;
  - les textes viennent des clauses du modèle, à faire relire (D10).
- **Alerte sur l'information légale à présenter**, à la génération et avant l'envoi :
  - si la rétractation s'applique : l'alerte liste ce que le client doit recevoir avant de signer
    (information précontractuelle, délai de quatorze jours, formulaire de rétractation, conditions
    de la renonciation) et signale chaque élément absent du contrat, avec la clause du modèle qui
    le porte ;
  - si elle ne s'applique pas : l'alerte rappelle de dire au client pourquoi, et signale l'absence
    de la clause qui l'explique ;
  - l'alerte avertit sans bloquer : la liste exacte reste à valider par l'avocat.
- **Renonciation des mariés** : quand la rétractation s'applique, les mariés peuvent y renoncer
  pour que la prestation démarre tout de suite. Ils le demandent en signant (case dédiée, texte
  issu du modèle), chacun pour lui ; la demande est tracée (horodatée, nominative) dans le
  dossier de preuve et sur le contrat. La prestation, et la facture d'acompte, démarrent alors
  sans attendre la fin du délai.

### Partie H — Signature du devis et du contrat (DOC-03, décision D9)

- Un seul envoi : **un PDF, le devis (options choisies) suivi de son contrat**, signé par les
  mêmes signataires, avec un seul dossier de preuve. Le contrat se signe aussi seul, s'il est
  généré après la signature du devis.
- La planner ne quitte pas Symbola ; le client signe depuis son portail, par le lien du
  fournisseur, comme aujourd'hui.

### Partie I — Facture d'acompte sans autre saisie (FAC-05, décision D6)

- **Quand tous ont signé**, la facture de la première échéance est **émise d'elle-même**, mentions
  contrôlées, et l'échéancier reste celui du devis (SC-02, étape 7).
- Si le délai de rétractation court et que les mariés n'y ont pas renoncé, elle est émise
  le lendemain de la fin du délai (traitement quotidien), et « À traiter » le dit.
- Une mention manquante bloque l'émission automatique : « À traiter » le signale en nommant le
  champ, et l'émission se fait en un clic une fois le champ rempli.
- La facture de solde déduit déjà les acomptes facturés (inchangé).

### Partie J — Bibliothèque de départ « à adapter » (HUB-26, JUR-20, décision D10)

- Un **modèle de contrat de prestation**, en données, par langue : titres de clauses, variables,
  et à la place de chaque texte juridique un emplacement « [À rédiger avec votre conseil : clause
  d'annulation] ». Aucun texte juridique de fond rédigé par nous.
- Un bandeau sur chaque modèle et à chaque génération : « Base à adapter, à faire relire par un
  professionnel du droit. »
- Les modèles de départ se chargent à l'onboarding, se modifient et se suppriment.

### Partie K — Tests, rejeu et documents du 31b

- **Tests** : résolution des variables, liste des manquantes, refus de génération, clauses
  facultatives, figement et versions, les deux cas de rétractation, l'alerte sur l'information
  légale (élément absent signalé, sans blocage), la renonciation des mariés tracée,
  PDF combiné et signature (faux fournisseur), facture d'acompte émise à la dernière signature ou
  à la fin du délai (horloge simulée : veille, jour même, lendemain), émission bloquée par une
  mention manquante.
- **Isolation** : contrat et modèle d'une autre organisation ; lien personnel du client limité à
  son contrat ; Admin sans accès.
- **Playwright** : générer un contrat (variable manquante signalée, puis comblée), l'envoyer avec
  le devis, deux signatures, facture d'acompte présente sans saisie ; 375 px, axe-core.
- **Rejeu** : SC-02, étapes 3 à 7, sur le jeu fictif.
- **Documents** : `docs/gap.csv`, aide, registre RGPD (contrat : noms, adresse, renonciation horodatée),
  fiche de l'avocat (ce qui attend sa réponse), ADR si la signature combinée change l'ADR 0026.

## Migrations (à partir de 0120 ; 0119 est celle du lot 30b)

| Lot | Schéma | Contenu |
| --- | --- | --- |
| 31a | `quotes` | `quote_sections` ; `quote_lines.section_id`, `quote_lines.is_option` ; choix des options (qui, quand) ; `quote_templates` et leurs sections, lignes et échéances ; `quote_versions.advance_kind` (acompte ou arrhes) ; `quote_settings.advance_kind_default` |
| 31a | `hub` | `organization_profiles` : assurance, couverture, médiateur, conditions générales ; liste des mentions requises (réglage de l'Admin) |
| 31b | `quotes` | `contract_templates`, `contract_template_clauses` (dont le rôle légal d'une clause : information précontractuelle, formulaire, renonciation, exception) ; `contracts` (figés, versionnés, rattachés à une version de devis, rétractation appliquée ou non et motif) ; renonciation de chaque signataire (horodatée) ; lien de la demande de signature au contrat ; réglage de la rétractation par défaut ; facture d'acompte à émettre (date) |

Chaque migration a son script d'annulation, testé par `rollback.integration.test.ts`.

## Fichiers touchés (prévision)

- **31a** : `packages/db/src/schema/quotes.ts` et `hub.ts` ; `modules/quotes/` (sections,
  options, modèles, contrôle des mentions, échéancier) ; `modules/hub/` (profil) ;
  `app/devis/` (composition, modèles, réglages) ; PDF du devis et des factures ; portail
  (rubrique devis : choix des options) ; `packages/starter-templates` (modèles de devis, mentions
  requises).
- **31b** : `modules/quotes/contracts.ts` (variables, génération) ; `modules/quotes/signature`
  (PDF combiné) ; facture d'acompte automatique (signature et traitement quotidien) ;
  `app/devis/[quoteId]/contrat` ; `app/parametres/` (modèles de contrat, rétractation) ;
  portail ; `packages/starter-templates` (modèle de contrat).
- **Les deux** : traductions et aide, `docs/gap.csv`, `docs/recette/SC-02.md`, fiches de
  conformité.

## Hors périmètre

- Proposition en page web et paiement en ligne (FAC-02, lot 43) : au MVP, Camille saisit
  l'encaissement (SC-02, étape 8).
- Mentions de la réforme de 2027, Factur-X (lot 41) ; client professionnel refusé tant que
  Factur-X n'existe pas (inchangé).
- Mandat et commissions (JUR-10, lot 48) ; niveau de signature avancée (JUR-14, selon l'avocat).
- Textes juridiques définitifs : ils viennent de l'avocat de la pilote, pas de nous.

## Ambiguïtés relevées

- **« Options »** (FAC-01) : choisies par qui ? SC-02 répond : le client, avant de signer
  (étape 5). Proposé : sur son portail ; la planner peut cocher pour lui (D2).
- **« Facture d'acompte à la signature »** et « sans autre saisie » (SC-02, étape 7) : la
  rétractation peut imposer d'attendre quatorze jours. Proposé : émise d'elle-même à la dernière
  signature, ou à la fin du délai (D6).
- **Rétractation** (JUR-07) : pas systématique dans l'événementiel ; elle dépend du contrat et du
  client. Retenu (remarque de Julien) : un paramétrage, une alerte sur l'information légale à
  présenter, et la renonciation des mariés pour démarrer tout de suite (D8).
- **« Paramètres datés »** (HUB-23) : historiser chaque réglage, ou s'appuyer sur la copie figée de
  chaque document et le journal d'audit ? Proposé : la seconde, déjà en place (D4).
- **Liste des mentions** : je ne la fixe pas ; je livre une liste de départ marquée « à valider »,
  modifiable par l'Admin, et le contrôle qui l'applique.

## Décisions à prendre

- **D1 — Découpage.**
  - (a) Deux PR : 31a (devis complet), puis 31b (contrat, signature et facture d'acompte).
  - (b) Une seule PR.

  **Recommandation : (a).** Le 31a sert tout de suite (devis type, mentions bloquantes, options) ;
  le 31b dépend en partie des réponses de l'avocat.

- **D2 — Options du devis.**
  - (a) Le client coche ses options sur son portail avant de signer ; le choix est figé à la
    signature ; la planner peut cocher pour lui.
  - (b) La planner retient les options à la demande du client ; le choix en ligne vient au
    lot 43.

  **Recommandation : (a).** C'est l'étape 5 de SC-02, P0.

- **D3 — Modèles de devis.**
  - (a) Un modèle par type d'événement (sections, lignes, options, échéancier type, conditions),
    copié à la création, duplicable et versionné, avec un modèle de départ « à adapter ».
  - (b) Seulement « Dupliquer un devis existant ».

  **Recommandation : (a).** C'est le critère des cinq minutes et HUB-21.

- **D4 — Mentions obligatoires.**
  - (a) Liste en données (départ, puis Admin), par document, régime, type de client et forme
    juridique, contrôle bloquant qui nomme chaque champ ; datation par les copies figées et le
    journal d'audit.
  - (b) Liste écrite dans le code.

  **Recommandation : (a).** Aucune règle fiscale en dur (CLAUDE.md § 2.6) ; l'expert-comptable
  pourra la corriger sans développement.

- **D5 — Acompte ou arrhes.**
  - (a) Valeur proposée par l'organisation, imposée sur chaque devis avant l'envoi, reprise sur
    toutes les pièces.
  - (b) Réglage de l'organisation seulement.

  **Recommandation : (a).** JUR-08 veut que le modèle impose le choix, et un même planner peut
  varier selon le client.

- **D6 — Facture d'acompte.**
  - (a) Émise d'elle-même à la dernière signature ; si la rétractation court sans demande
    expresse, le lendemain de la fin du délai ; une mention manquante la bloque et « À traiter »
    le dit.
  - (b) Préparée à la signature, émise par la planner en un clic.

  **Recommandation : (a).** C'est l'étape 7 de SC-02 (« sans autre saisie ») ; le contrôle des
  mentions et le délai de rétractation en gardent la sûreté.

- **D7 — Contrat.**
  - (a) Modèle à clauses (obligatoires ou facultatives) et variables, généré depuis un devis,
    variables manquantes listées et bloquantes, contrat figé et versionné.
  - (b) Contrat déposé en PDF, sans génération.

  **Recommandation : (a).** C'est FAC-04 et DOC-02.

- **D8 — Rétractation** (revue avec la remarque de Julien du 13/11/2026).
  - (a) Paramétrage : valeur proposée par l'organisation, confirmée ou changée sur chaque contrat,
    avec un motif quand elle ne s'applique pas. Alerte, sans blocage, sur l'information légale à
    présenter, à la génération et avant l'envoi. Renonciation des mariés en signant, tracée, qui
    fait démarrer la prestation et la facture d'acompte tout de suite.
  - (b) Attendre la réponse de l'avocat avant de coder la rétractation.

  **Recommandation : (a).** La rétractation n'est pas systématique dans l'événementiel : la
  planner décide, Symbola l'alerte et garde la trace ; l'avocat validera la liste de l'alerte.

- **D9 — Signature.**
  - (a) Un envoi, un PDF : le devis suivi du contrat, un dossier de preuve ; le contrat seul si
    généré plus tard.
  - (b) Deux signatures séparées, devis puis contrat.

  **Recommandation : (a).** Le client signe une fois ; l'interface du fournisseur ne prend qu'un
  PDF, ce qui convient.

- **D10 — Modèle de contrat de départ.**
  - (a) Squelette : titres de clauses, variables, emplacements « [À rédiger avec votre conseil] »,
    bandeau « à faire relire » ; aucun texte juridique de fond rédigé par nous.
  - (b) Un contrat rédigé en entier, marqué « à adapter ».

  **Recommandation : (a).** Je ne tranche pas un point juridique ; l'avocat de la pilote remplira
  les clauses, et le bandeau reste.
