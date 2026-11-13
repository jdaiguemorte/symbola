# Lot 31 — Devis complet et contrat

**Statut** : spécification validée par Julien le 13/11/2026 (« Oui je valide » : D1 à D10 en (a),
D8 revu selon sa remarque). 31a fait. 31b commencé, puis mis en pause pour attendre les
professionnels ; **révisé le 13/11/2026 après les réponses de l'avocat** (section « Révision du
31b »), complété le même jour par les réponses de l'expert-comptable et de la DPO ; **révision
validée par Julien le 13/11/2026** (« Oui je valide » : D11 à D22 en (a) ; D18 : le taux des
pénalités est choisi par la planner). 31b fait ; **31c** (décisions de l'expert-comptable, D18 à
D22) fait le même jour (« Oui, le 31c »). Branche `lot-31-devis`, partie du lot 30b (PR #110) ; la PR
visera `main` après #110.

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

## Révision du 31b après les réponses de l'avocat (13/11/2026)

Julien a reçu le 13/11/2026 la note de l'avocat sur les onze questions de
`docs/conformite/fiche-avocat.md`, et confirme que les points qu'elle marquait « à vérifier » sont
validés. La note reste hors du dépôt, qui est public ; la fiche résume ce que Symbola en retient.
Les réponses 1, 2, 3, 5 et 6 étaient attendues « avant de développer les contrats » : voici ce
qu'elles changent. **Cette révision remplace D8**, précise D5, D6, D7, D9 et D10, et l'emporte sur
les parties F à K là où elles diffèrent.

### Ce que le 31b déjà écrit garde

Rien n'est commité ni déployé : migration 0122 (appliquée seulement sur la base de test, que je
recrée), données de départ, texte du contrat (variables, manquantes ou inconnues, clauses à
rédiger, fin du délai avec report au lundi), dépôt des contrats. Les modèles à clauses et
variables, la génération bloquée par une variable manquante, le contrat figé et versionné, la
signature du devis suivi du contrat en un PDF, la case de démarrage immédiat sur le portail et la
facture d'acompte émise d'elle-même restent comme prévu.

### Partie G révisée — Canal de conclusion et régime (réponse 1, remplace D8)

- **Plus de choix « la rétractation s'applique ou non »**, et l'exception des prestations à date
  déterminée (L221-28, 12°) n'est jamais proposée pour l'organisation d'un mariage.
- **Canal de conclusion**, obligatoire à la génération, sans valeur par défaut, figé dans le
  contrat et le dossier de preuve : dans l'établissement du planner ; à distance ; hors
  établissement ; foire ou salon. Avec la **catégorie du client** (partie L), il détermine le
  régime, par une table en données (`withdrawal.json`) et non dans le code :
  - **établissement** : pas de rétractation, information générale ; le contrat porte la clause
    standard sans rétractation ;
  - **à distance**, client consommateur : rétractation de quatorze jours, information complète et
    formulaire type ; après la signature, confirmation sur support durable (le PDF signé envoyé à
    chaque signataire et gardé sur son portail) ; sur le portail, un bouton « Je commande avec
    obligation de paiement » précède le lien de signature, enregistré (date, nom) ;
  - **hors établissement**, client consommateur, ou non-professionnel dont la planner confirme
    « petite entreprise de cinq salariés au plus, hors de son activité principale » : même
    régime, exemplaire remis (même envoi), et **aucun paiement avant sept jours** : la génération
    refuse une échéance prévue moins de sept jours après le jour même, et la facture d'acompte ne
    demande pas de paiement avant la signature plus sept jours ;
  - **foire ou salon** : génération refusée, « modèle dédié à faire valider » (hors du lot).
- **Information précontractuelle** : la liste de l'avocat (caractéristiques essentielles, prix TTC
  et modalités, date d'exécution, identité et coordonnées, assurance, rétractation et formulaire,
  coût d'une exécution anticipée, durée et résiliation, médiateur) devient, selon le régime, la
  liste des clauses que le contrat doit porter (rôles de clause) et des données qu'il reprend du
  devis. Le client lit le contrat sur son portail avant le bouton de commande.
- **Exécution anticipée** : inchangée (case distincte de la signature, sur le portail, horodatée et
  nominative), et versée au dossier de preuve (partie N).

### Partie J révisée — Acompte et clauses types (réponse 2, précise D5 et D10)

- **« Acompte » par défaut** : un nouveau devis le prend si l'organisation n'a rien réglé, et le
  réglage de l'organisation part sur « acompte » (au 31a, aucun défaut). Les arrhes restent un
  choix explicite.
- **Concordance** : la génération est refusée si la clause des sommes versées d'avance du contrat
  ne correspond pas au choix du devis (rôle « acompte » ou « arrhes »), ou manque alors que le
  devis a un échéancier. L'échéancier et la facture reprennent déjà le mot du devis (31a).
- **Clauses types** : les deux clauses fournies par l'avocat (acompte avec barème progressif et
  réciproque, arrhes) entrent dans le modèle de départ comme bases à adapter. Les valeurs
  objectives deviennent des variables (pourcentage et montant de l'acompte) ; les autres valeurs
  entre crochets (délais, pourcentages du barème, indemnité) restent à compléter par la planner.
- **Champ à compléter** : une clause retenue qui garde un texte entre crochets bloque la
  génération, comme « [À rédiger…] ». Les autres textes juridiques (information sur la
  rétractation, formulaire type, résiliation…) restent des emplacements à rédiger, à fournir par
  l'avocat ou à reprendre des modèles réglementaires.

### Partie L (nouvelle) — Catégorie du client et conservation (réponse 3)

- **Trois catégories** : consommateur, non-professionnel, professionnel (aujourd'hui deux). Elles
  règlent le régime de la partie G et la liste des mentions exigées (en données). Médiateur : le
  champ devient « Médiateur auquel vous adhérez », toujours bloquant pour un consommateur (31a).
  Un non-professionnel est facturé comme un consommateur en attendant l'expert-comptable ; le
  professionnel reste refusé à la facturation jusqu'à Factur-X (lot 41, mentions de la réponse 7).
- **Conservation de dix ans** du contrat et du dossier de preuve (contrat électronique de 120 € et
  plus) : la durée de conservation des devis signés passe de 60 à 120 mois par défaut, réglage
  RGPD de l'organisation (schéma `hub`).

### Partie M (nouvelle) — Niveau de signature (réponse 5, précise D9)

- Recommandé : simple, renforcée par un code SMS, pour les devis et avenants de moins de 10 000 € ;
  avancée à partir de 10 000 € et pour les mandats. Il faut un fournisseur de SMS (nouveau
  sous-traitant) et sans doute l'édition payante de Documenso (réauthentification, signature
  avancée), ou un autre prestataire : choix à faire, lot à part (JUR-14).
- Au 31b : seuil et niveau recommandé en données ; le niveau réellement employé (« simple ») est
  inscrit au dossier de preuve ; au-dessus du seuil, une alerte dit que le niveau avancé est
  recommandé mais pas encore disponible.

### Partie N (nouvelle) — Modèles datés, avertissement accepté, dossier de preuve (réponses 1, 5, 6)

- **Modèles** : chaque modèle de contrat porte sa version et la date de sa dernière revue
  juridique (saisie par la planner ; vide pour le modèle de départ tant qu'un avocat ne l'a pas
  relu). Les deux sont copiés dans chaque contrat et imprimés en pied du PDF.
- **Avertissement accepté** : à la première génération avec une version d'un modèle, la planner
  coche « Base à adapter, à faire relire par un professionnel du droit » ; l'acceptation est
  enregistrée (personne, modèle, version, date).
- **Seulement des faits et des options prédéfinies** : canal, catégorie du client, clauses
  facultatives ; Symbola applique la table de l'avocat, sans conseil sur le choix.
- **Dossier de preuve Symbola** : quand tous ont signé, Symbola écrit un PDF de preuve, scellé par
  son empreinte comme les originaux des factures. Il contient le canal, la catégorie, le régime,
  la version du contrat et du modèle (avec la date de revue), le clic de commande, les demandes
  d'exécution anticipée, le niveau de signature, et les empreintes du document signé et du
  certificat du fournisseur. Il est conservé avec le contrat et téléchargeable par la planner.

### Migration 0122 révisée (rien n'est déployé)

`contracts` : canal de conclusion, catégorie du client, confirmation « petite entreprise », régime
de rétractation figé, version et date de revue du modèle, niveau de signature ; plus de motif
d'exclusion. `contract_templates` : date de la dernière revue. Nouvelles tables : acceptations de
l'avertissement ; actes des signataires (commande, exécution anticipée), à la place des seules
renonciations ; dossier de preuve (clé, empreinte). `quotes.client_kind` : « non_professional ».
`quote_settings` : plus de rétractation par défaut ; acompte par défaut. Schéma `hub` (D16) :
conservation des devis signés à 120 mois par défaut.

### Décisions à prendre (révision)

- **D11 — Canal et régime.** (a) Canal obligatoire, régime déduit de la table de l'avocat, exception
  jamais proposée, foire ou salon refusé. (b) Garder l'exception comme choix non proposé par défaut,
  avec avertissement. **Recommandation : (a)**, c'est la réponse 1 telle quelle.
- **D12 — Information précontractuelle.** (a) Bloquante : la génération est refusée tant qu'une
  clause attendue par le régime manque. (b) Alerte sans blocage, comme prévu au départ.
  **Recommandation : (a)** : la liste est validée, et un modèle sans l'information sur la
  rétractation reste fautif malgré l'avertissement (réponse 6).
- **D13 — Bouton de commande à distance.** (a) Sur le portail, « Je commande avec obligation de
  paiement » enregistré, puis le lien de signature. (b) Attendre une solution chez le fournisseur
  de signature. **Recommandation : (a)** : le bouton du fournisseur ne peut pas changer sans
  modifier Documenso, ce que la réponse 10 déconseille.
- **D14 — Clauses types de l'avocat dans le modèle de départ.** (a) Oui, comme bases à adapter,
  si l'avocat accepte qu'elles soient publiées (le dépôt et le produit sont publics). (b) Non :
  emplacements « à rédiger » seulement. **Recommandation : (a)**, après son accord.
- **D15 — Niveau de signature.** (a) Au 31b, alerte au-dessus de 10 000 € et niveau inscrit au
  dossier de preuve ; SMS et signature avancée dans un lot à part, après tes choix (fournisseur de
  SMS, édition de Documenso). (b) Bloquer l'envoi au-dessus de 10 000 € d'ici là.
  **Recommandation : (a)** : la pilote travaille sur des données fictives tant que la société
  n'existe pas (réponse 8).
- **D16 — Catégories et conservation.** (a) Trois catégories et conservation de 120 mois au 31b
  (touche le schéma `hub`). (b) Les catégories au 31b, la conservation dans un lot à part.
  **Recommandation : (a)** : la durée vaut pour le dossier de preuve que le 31b crée. Le DPO en
  sera informé (fiche DPO).
- **D17 — Acompte par défaut.** (a) Sur chaque nouveau devis et dans le réglage de l'organisation.
  (b) Dans le réglage seulement. **Recommandation : (a)** (réponse 2).

### Réponses de l'expert-comptable et de la DPO (13/11/2026)

Julien a reçu le même jour les réponses vérifiées de l'expert-comptable (questions 1 à 10) et de
la DPO (questions 1 à 10), puis leurs réponses aux deux questions restées ouvertes (arrhes ;
journal d'audit) ; résumés dans leurs fiches de `docs/conformite/`. Pour le lot 31 :

- **Facture d'acompte** (expert-comptable, question 7) : le schéma du lot (une facture par acompte,
  puis un solde qui les déduit) est confirmé dans les deux régimes. Mais **le solde doit déduire
  les acomptes en HT et en TVA** : aujourd'hui il soustrait leurs montants TTC puis ventile le
  reste au prorata, et le PDF ne montre pas le détail par taux. Écart sur FAC-05, corrigé au 31b
  (D20).
- **Arrhes** (question 7 bis) : **pas de « facture d'arrhes »**, contrairement au 31a. Les arrhes
  sont une indemnité de dédit, hors TVA, hors facturation électronique et hors e-reporting tant
  qu'elles ne sont pas imputées sur le prix. À leur encaissement, Symbola remet un **reçu non
  fiscal**, hors de la série des factures, et n'émet aucune facture d'elle-même. La facture de
  solde montre le prix total (HT, TVA, TTC) et les arrhes comme un règlement déjà reçu. Les
  documents de renonciation (constat quand le client renonce, restitution du double quand la
  planner renonce) viennent avec l'annulation d'un évènement (EVT-05, lot 34). Comme le devis du
  31a n'est ni déployé ni poussé, la correction se fait au 31b (D21).
- **Choix écrit en toutes lettres** (même réponse) : pour un consommateur, les sommes versées
  d'avance sont présumées arrhes sauf stipulation contraire. Le choix « acompte » proposé par
  défaut (D17) ne vaut que s'il est écrit : le devis porte la phrase « Les sommes versées d'avance
  sont des acomptes » (ou « des arrhes »), et le contrat la clause concordante (partie J).
- **Conditions de paiement** (question 1) : le texte de départ (« pénalités au taux d'intérêt
  légal ») est sous le plancher légal face à un professionnel. Deux textes de départ, choisis
  selon la catégorie du client (partie L) : particulier et non-professionnel, échéance et
  escompte ; professionnel, échéance, escompte, pénalités et indemnité forfaitaire de 40 € (D18).
  Les organisations qui ont déjà copié l'ancien texte le gardent : l'écran des réglages le
  signale. La facture d'un professionnel reste refusée jusqu'au lot 41 ; le texte sert déjà sur
  son devis, comme le demande l'avocat (réponse 7).
- **Mention « EI »** (question 1) : ajoutée d'office après le nom d'un entrepreneur individuel
  (forme juridique EI ou micro-entreprise) sur les devis, contrats et factures (D19). Le numéro de
  bon de commande vient au lot 41, avec les mentions entre entreprises.
- **DPO** : rien ne change pour le 31b. Les noms des clients dans le contrat et les demandes
  d'exécution anticipée suivent la conservation de dix ans (D16) ; la séparation entre base
  active et archivage intermédiaire (réponse 6) viendra aux lots 34 et 35 (Q35).

- **D18 — Conditions de paiement selon le client.** **Décision de Julien (13/11/2026)** : deux
  textes, et le taux des pénalités choisi par la planner, puisque les deux formulations sont
  légales (« la planner ne peut-elle pas choisir ? »). Dans ses réglages, elle choisit « taux de
  la BCE majoré de 10 points » ou « trois fois le taux d'intérêt légal », sans valeur imposée ; le
  choix est demandé, comme une mention manquante nommée, avant le premier devis ou la première
  facture à un professionnel. Le reste des conditions reste un texte libre (elle peut y reprendre
  celles de ses factures papier). Énoncé d'origine : (a) Deux textes de départ, choisis selon la
  catégorie du client. **Taux des pénalités du texte « professionnel » : à trancher par toi**, les
  deux réponses divergent sur la valeur par défaut : l'avocat propose trois fois le taux
  d'intérêt légal ; l'expert-comptable recommande le taux de la BCE majoré de 10 points (le taux
  qui s'applique sans stipulation, plus élevé), « trois fois le taux légal » étant le plancher. Les
  deux respectent la loi ; la planner peut changer le texte. Je ne recommande pas l'un ou l'autre.
  (b) Un seul texte, comme aujourd'hui, corrigé.
- **D19 — Mention « EI ».** (a) Ajoutée d'office au 31b. (b) Au lot 41. **Recommandation : (a)** :
  elle vaut dès maintenant, pour tous les clients.
- **D20 — Solde par taux.** (a) Au 31b : le solde déduit le HT et la TVA figés de chaque facture
  d'acompte, taux par taux, et le PDF les montre. (b) Au lot 41. **Recommandation : (a)** : FAC-05
  est dans ce lot, et un solde faux d'un centime par taux ne doit pas partir.
- **D21 — Arrhes sans facture.** (a) Au 31b : plus de facture d'arrhes ; reçu non fiscal à
  l'encaissement (numérotation à part) ; solde au prix total, arrhes en règlement ; aucune facture
  émise d'elle-même pour un devis à arrhes ; arrhes exclues de l'export d'e-reporting. (b) Garder
  la facture d'arrhes jusqu'au lot 34. **Recommandation : (a)** : une TVA écrite sur une facture
  est due, et le 31a n'est pas encore parti.
- **D22 — Forme des arrhes.** L'expert-comptable conseille des arrhes versées une seule fois à la
  réservation, puis des acomptes. (a) Au 31b, un devis à arrhes n'a qu'une échéance d'avance (les
  arrhes) ; le reste est réglé au solde. (b) Le choix arrhes ou acompte par échéance, pour avoir
  des arrhes puis des acomptes sur le même devis (le choix passe du devis à l'échéance : schéma
  et contrat plus lourds). **Recommandation : (a)** pour le 31b : l'acompte est le défaut, les
  arrhes l'exception ; (b) plus tard si la pilote en a besoin.

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

### Bilan du lot 31b (13/11/2026)

**Découpage** : le 31b réalise la révision validée sauf les décisions venues de l'expert-comptable,
qui touchent la facturation (D18 à D20, D21 hormis la facture automatique, D22). Elles forment un
**31c** à suivre, avant la PR : conditions de paiement selon le client et taux des pénalités au
choix de la planner, mention « EI », solde par taux, reçu d'arrhes, une seule échéance d'arrhes.

**Fait** :
- **Modèles de contrat** (D7, D10, partie N) :
  - écran « Modèles de contrat » : titre, type d'événement, date de la dernière revue juridique,
    clauses ordonnées (titre, texte à variables, facultative, rôle légal), ajout, modification,
    déplacement, suppression, duplication ; la liste des variables est documentée à l'écran ;
  - chaque modification du texte augmente la version ;
  - le modèle de départ « à adapter » est en données (squelette, emplacements « [À rédiger avec
    votre conseil…] »), chargé à l'assistant de démarrage, et proposé sur l'écran et dans le devis.
- **Génération** (FAC-04, DOC-02 ; D11, D12, D17) :
  - d'un devis envoyé, avec le canal de conclusion (obligatoire, sans valeur proposée), la
    catégorie du client (trois catégories) et, pour un non-consommateur hors établissement, la
    petite entreprise ;
  - refusée tant qu'un problème reste, chacun nommé : variable vide (« Lieu de l'événement :
    vide ») ou inconnue, clause encore à rédiger, information légale absente pour le régime,
    clause d'acompte ou d'arrhes qui ne concorde pas, foire ou salon, échéance avant sept jours
    hors établissement, avertissement « base à adapter » non accepté pour la version ;
  - contrat figé (texte, versions du modèle, date de revue, canal, catégorie, régime, niveau de
    signature) ; une nouvelle génération crée une nouvelle version ; un contrat d'avant un choix
    d'options ou d'une autre version du devis est « à refaire » ;
  - « acompte » proposé par défaut (D17), et la phrase « Les sommes versées d'avance sont des
    acomptes » dans le contrat.
- **Signature** (DOC-03 ; D9, D13) :
  - un PDF, le devis puis son contrat, une demande, un dossier de preuve ; le contrat seul s'il est
    généré après la signature du devis, par les mêmes signataires ;
  - à distance, l'e-mail n'envoie plus le lien du service de signature : le client lit le contrat
    sur son espace, clique « Je commande avec obligation de paiement », puis voit son lien ;
    l'envoi est refusé si un signataire n'a pas de lien personnel ;
  - la demande d'exécution anticipée, case distincte de la signature, au texte de la clause ;
  - quand tous ont signé : le dossier de preuve de Symbola (JSON scellé, lisible en PDF) et
    l'exemplaire signé envoyé à chaque signataire en pièce jointe (support durable).
- **Facture d'acompte sans autre saisie** (FAC-05, D6, D21) : programmée à la signature, émise
  par le worker des événements le jour même, ou le lendemain de la fin du délai de rétractation
  si tous les signataires n'ont pas demandé l'exécution anticipée (passage toutes les heures) ;
  pas pour des arrhes ni pour un client professionnel ; une mention manquante la bloque, la page
  du devis et « À traiter » le disent, l'émission à la main la clôt ; hors établissement, aucun
  paiement demandé avant sept jours.
- **Niveau de signature** (D15) : au-delà de 10 000 € (donnée), une alerte dit que la signature
  avancée est recommandée et pas encore disponible ; le niveau employé est au dossier de preuve.
- **Conservation** (D16) : 120 mois au moins pour les devis signés et leurs contrats (migration
  0124 relève les organisations en dessous ; le réglage refuse moins).
- **Lieu de l'événement** : la fiche de l'événement permet de le saisir (sans quoi la variable ne
  pourrait jamais être comblée) ; les lieux complets restent au lot 34.
- **RGPD** : contrats (texte) et actes des signataires dans la recherche, l'aperçu et l'oubli
  (gardés comme preuve d'un devis signé, sinon anonymisés) ; dossier de preuve retiré à la fin de
  la preuve ; registre complété.
- **Migrations** 0122 (client non-professionnel), 0123 (contrats), 0124 (hub, conservation), avec
  leur annulation ; ADR 0065.

**Vérifications** (13/11/2026) :
- lint, vérification des types, frontières de modules : verts ;
- tests unitaires : tous les paquets verts ; app 454, dont `contract-text.test.ts` (12) et
  `contract-pdf-model.test.ts` (3) ; modèles de départ 47 ;
- intégration sur une base réelle : base 156 (annulation de 0122 à 0124, isolation des sept
  nouvelles tables), app 560, dont `contracts.integration.test.ts` (15, RGPD compris) ;
- Playwright, ordinateur et 375 px : suite entière, 246 passés. Les 2 échecs de `fac-01-07`
  venaient de l'acompte désormais proposé par défaut (D17) ; ils sont corrigés. 3 parcours où
  l'Admin se connecte, en 375 px, échouent sous la charge de la suite entière mais passent
  relancés (déjà vu avant le lot). Relance finale de `fac-04-05-contrat`, `fac-01-07` et de ces
  trois parcours : 28 passés ;
- Semgrep (`--config=auto`, erreurs bloquantes, comme en CI) : 0 constat sur le code ; la sortie
  de compilation `.next`, ignorée par git, est exclue ;
- Gitleaks : aucune fuite dans les fichiers du lot. Les 12 alertes viennent d'anciens parcours
  e2e et des `.env.*.example`.

**Rejeu SC-02, contrat de l'étape 4 et étapes 5 à 7** (`docs/recette/SC-02.md`) : passé sans
blocage.
- Camille : 12 gestes par devis, du devis envoyé au contrat en signature. Il faut 36 gestes, une
  seule fois, pour remplir le modèle avec les textes de son avocat.
- Léa et Maxime : 7 gestes chacun sur leur téléphone (lire, commander, demander le démarrage,
  signer). Aucun débordement à 375 px ; axe-core sans violation.
- La facture d'acompte se programme sans geste. Elle a été bloquée par la mention « Conditions
  de paiement des factures », jamais enregistrée sur l'organisation fictive, puis débloquée en
  5 gestes. Remarque reprise au 31c.

**Écarts et suites** :
- **31c** (expert-comptable) : D18 à D20, D21 (reçu d'arrhes, solde au prix total), D22 ; et les
  conditions de paiement des factures chargées à l'assistant de démarrage (remarque du rejeu) :
  fait (bilan du 31c).
- **Adresses de facturation** : saisies par la planner à l'envoi en signature ; le portail
  pourrait les demander aux mariés.
- **Jours fériés** : le délai de rétractation n'est prolongé que d'un samedi ou d'un dimanche.
- **Clauses types de l'avocat** (D14) : à verser au modèle de départ après son accord.
- **Signature avancée et code SMS** : lot à part (Q34).
- **Déploiement** : migrations 0120 à 0124 au déploiement d'ensemble (gel).

## Lot 31c — Ce que demande l'expert-comptable (D18 à D22)

Lancé le 13/11/2026 (« Oui, le 31c »), sur les décisions D18 à D22 déjà validées. Même branche.

### Partie O — Conditions de paiement selon le client (D18)

- **Deux textes** dans les réglages des devis, chacun prérempli par un texte de départ en
  données, à relire :
  - « Conditions de paiement — particuliers et non-professionnels » : l'échéance et l'escompte ;
  - « Conditions de paiement — professionnels » : l'échéance et l'escompte, en texte libre.
- **Le taux des pénalités de retard** (clients professionnels), à choisir dans une liste, sans
  valeur par défaut :
  - « taux de la BCE majoré de 10 points » ;
  - « trois fois le taux d'intérêt légal ».

  La phrase des pénalités et de l'indemnité forfaitaire de 40 € s'ajoute d'elle-même au texte
  professionnel. La liste, la phrase et le montant sont des données traduisibles.
- **Mentions exigées** (liste de l'Admin, en données) :
  - devis, facture d'acompte et facture de solde d'un professionnel : texte professionnel et
    taux, chacun nommé s'il manque ;
  - facture d'un particulier ou d'un non-professionnel : son texte, comme aujourd'hui.

  La facture d'un professionnel reste refusée jusqu'au lot 41.
- **Le devis d'un professionnel imprime ses conditions de paiement** (texte et phrase des
  pénalités), figées à l'envoi.
- **Ancien texte** : si le texte enregistré est l'ancien texte de départ, l'écran le signale.
- **Assistant de démarrage** : les deux textes de départ sont enregistrés pour l'organisation
  (remarque du rejeu du 31b). Le taux n'est jamais choisi pour elle.

### Partie P — Mention « EI » (D19)

- Elle est déjà imprimée sur les devis, les factures et les avoirs depuis le lot 17, pour l'EI et
  la micro-entreprise. Le 31c l'ajoute au contrat (en-tête et variable `{organisation.nom}`) et
  au reçu d'arrhes.

### Partie Q — Solde par taux (D20)

- La facture de solde déduit chaque facture d'acompte **en HT et en TVA, taux par taux**, nette
  de ses avoirs, à partir de leurs copies figées. Elle ne ventile plus au prorata.
- Le PDF montre :
  - le total de la prestation par taux ;
  - chaque acompte déduit, avec son HT et sa TVA par taux ;
  - le reste dû par taux.

### Partie R — Arrhes (D21, D22)

- **Aucune facture d'arrhes** : l'émission est refusée pour un devis à arrhes, et l'écran ne la
  propose plus.
- **Reçu non fiscal** créé à l'encaissement des arrhes, dans la même transaction :
  - une série à part, de préfixe réglable (« R » par défaut) ;
  - le reçu dit qu'il n'est pas une facture, et il est immuable ;
  - un encaissement annulé le marque « annulé » ; le reçu reste.
- **Facture de solde d'un devis à arrhes** : elle porte le prix total (HT, TVA, TTC), puis les
  arrhes reçues en règlement, puis le reste à payer.
- **E-reporting** : les encaissements d'arrhes sont exclus de l'export.
- **Une seule échéance d'arrhes** (D22). Sont refusés :
  - le choix « arrhes » sur un devis à plusieurs échéances ;
  - une deuxième échéance sur un devis à arrhes.

  Avant l'envoi, un devis à arrhes qui aurait plusieurs échéances (copie d'un modèle) le nomme.
- **RGPD** : le reçu porte les noms des clients, comme la facture. Il est donc cherché, exporté,
  gardé pendant la conservation comptable, puis anonymisé ; le registre est complété.

### Migrations du 31c

| Migration | Schéma | Contenu |
| --- | --- | --- |
| 0125 | `quotes` | valeur `receipt` de la série de numérotation (seule dans sa migration) |
| 0126 | `quotes` | `quote_settings` : texte professionnel, taux des pénalités, préfixe des reçus ; table `earnest_receipts` (RLS, immuable, comme les factures) |

### Choix faits sans toi (à relire)

- **Phrase des pénalités** : elle reprend la règle donnée par l'expert-comptable et l'avocat
  (taux choisi, indemnité forfaitaire de 40 €). Ce n'est pas une clause rédigée par nous.
- **EIRL** : le nom porte déjà « EIRL » (lot 17). Le 31c n'y touche pas.
- **Reçu** : il n'est pas déposé comme original et n'entre pas dans la chaîne des pièces
  (FAC-14), car ce n'est pas une pièce comptable. L'encaissement, lui, y est déjà.

### Tests du 31c

- Unitaires :
  - solde par taux (un taux, deux taux, franchise, avoir partiel, arrhes en règlement) ;
  - phrase des pénalités ;
  - mentions exigées selon le client ;
  - données de départ.
- Intégration :
  - réglages ;
  - mentions nommées (texte professionnel, taux) ;
  - refus de la facture d'arrhes ;
  - reçu à l'encaissement et numérotation ;
  - solde d'un devis à arrhes ;
  - e-reporting sans les arrhes ;
  - une seule échéance d'arrhes ;
  - assistant de démarrage ;
  - isolation et annulation des migrations ;
  - RGPD (recherche, export, effacement du reçu).
- Parcours (ordinateur et 375 px, axe-core) : réglages des conditions et du taux, devis à arrhes
  jusqu'au reçu et au solde.

### Bilan du lot 31c (13/11/2026)

**Fait** :
- **Conditions de paiement selon le client** (D18) :
  - deux textes de départ en données, enregistrés par l'assistant de démarrage (sans le taux) ;
  - le taux des pénalités choisi dans une liste de deux, sans valeur proposée ;
  - la phrase des pénalités et de l'indemnité forfaitaire de 40 € ajoutée d'elle-même au texte
    des professionnels ;
  - texte professionnel et taux exigés, chacun nommé avec son lien, sur le devis et les factures
    d'un professionnel (liste de l'Admin) ;
  - le devis d'un professionnel imprime ses conditions, figées à l'envoi ;
  - l'ancien texte de départ est signalé.
- **Mention « EI »** (D19) : déjà en place depuis le lot 17 sur les devis, factures et avoirs ;
  ajoutée au contrat (en-tête et `{organisation.nom}`) et au reçu.
- **Solde par taux** (D20) : chaque acompte, net de ses avoirs, retiré en HT et en TVA de son taux ;
  le PDF le détaille ; un solde émis avant garde sa présentation.
- **Arrhes** (D21, D22, ADR 0066) :
  - plus de facture d'arrhes ;
  - un reçu non fiscal à l'encaissement (série « R », réglable), immuable, marqué « annulé » si
    l'encaissement l'est ;
  - le solde porte le prix total, avec les arrhes en règlement ;
  - les arrhes sont hors de l'e-reporting ;
  - une seule échéance d'arrhes ;
  - le reçu est pris en compte au RGPD (recherche, données liées, oubli, purge) et au registre.
- **Migrations** 0125 (série des reçus) et 0126 (réglages, reçus), avec leur annulation.

**Vérifications** (13/11/2026) :
- lint, vérification des types, frontières de modules : verts ;
- tests unitaires : tous les paquets verts. App 470, dont le solde par taux, les conditions de
  paiement, les mentions selon le client, le PDF du reçu et « EI » sur le contrat ; modèles de
  départ 51 ;
- intégration sur une base réelle :
  - base 158 (annulation de 0125 et 0126, isolation et immuabilité du reçu) ;
  - app 574, dont `quotes-31c.integration.test.ts` (14) ;
  - un test d'import échoue sous la charge de la suite (« too_large ») et passe seul ; il est sans
    lien avec le lot ;
- Playwright, ordinateur et 375 px, sur une base rechargée : 254 passés. Le test de verrouillage
  de la double authentification (375 px) dépasse son délai sous la charge et passe seul. Nouveau
  parcours `fac-05-jur-08-arrhes` (4) vert ;
- Semgrep (comme en CI, sans `.next`) : 0 constat ; Gitleaks : aucune fuite dans les 69 fichiers
  du lot.

**Rejeu SC-02** (`docs/recette/SC-02.md`, section 31c) : étapes 7 et 8 passées sans blocage.
- La facture d'acompte s'émet d'elle-même 6 s après la dernière signature, sans geste ; la
  remarque du 31b est levée.
- Camille enregistre l'acompte de Léa en 4 gestes.
- Défaut trouvé par le nouveau parcours : à 375 px, le badge « Payée le … » débordait de 12 px
  (depuis le lot 23b). Il passe maintenant à la ligne.
- Remarque : la vue d'ensemble de l'Admin a mis 5,5 s sur une base de test de 1 402
  organisations. Sans effet au pilote, à surveiller.

**Écarts et suites** :
- **Mentions entre entreprises** : le numéro de bon de commande et les mentions de la réforme
  viennent au lot 41, avec les factures aux professionnels.
- **Documents de renonciation aux arrhes** : ils viennent au lot 34, avec l'annulation d'un
  évènement.
- **Jeu fictif** : il saute l'assistant de démarrage, donc les conditions de paiement ne sont pas
  chargées pour les organisations fictives (remarque pour le lot de recette).

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
