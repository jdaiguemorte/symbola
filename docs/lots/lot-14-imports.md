# Lot 14 — Reprise des données de l'outil actuel : prestataires et fiches événement

Reporté après la refonte UX (lot 13, décision de Julien du 06/11/2026). Le lot 5 sait importer
des tableaux (CSV, Excel, JSON) d'événements, de tâches, de lignes du budget, d'articles du
catalogue et de listes. La planner veut reprendre ce que son outil de planification actuel sait
exporter :

- **la liste de ses prestataires** : un classeur Excel, une ligne par prestataire ;
- **ses événements** : une **fiche PDF par événement** (l'outil n'exporte pas ses événements en
  tableau).

Dans le dépôt (code, tests, commits, PR), l'outil n'est jamais nommé : on parle d'« export d'un
logiciel de planification tiers » (décision de Julien, 07/11/2026). Les vrais exports de Julien
ne sont **jamais commités** ; les fichiers de test sont reconstitués avec des données
entièrement fictives (`packages/testing/import-corpus/files/logiciel-tiers/`, script
`generate_tiers.py`).

## Ce que contiennent les exports (structure relevée sur les fichiers de Julien)

### Prestataires (Excel)

- Une feuille « Worksheet », une ligne d'en-tête, 22 colonnes : Nom, Type de Prestataire,
  Prénom, Nom (deux colonnes « Nom » : l'entreprise puis le contact), E-mail, Adresse, Code
  Postal, Ville, Département, Téléphones, Site Internet, Critères avancés, Page Facebook, Lien X,
  Lien Linkedin, Lien Pinterest, Lien Instagram, N° Siret, Tva Intracommunautaire, Code APE,
  Statut Juridique, et une **22ᵉ colonne sans titre**.
- Défauts à corriger à la lecture, tous reproduits dans le fichier de test :
  - **« Site Internet » et « Critères avancés » sont inversées** : la première contient des
    critères séparés par des virgules (« Moins de 50 invités, 50 à 100 invités… », styles de
    musique, prestations), la seconde des adresses web ;
  - la **22ᵉ colonne sans titre** contient la description des prestations et des tarifs, sur
    plusieurs lignes ;
  - des **entités HTML** dans les noms et les descriptions (`&eacute;`, `&amp;`, `&nbsp;`,
    `&euro;`…) ;
  - les **codes postaux sont des nombres** : le zéro initial est perdu (`5000` pour `05000`), le
    département aussi (`5` ou `"05"`) ;
  - les **téléphones** arrivent sous au moins cinq formes (`0612345678`, `06 12 34 56 78`,
    `06.12.34.56.78`, `+33 6 12 34 56 78`), parfois **plusieurs numéros** dans la cellule, avec
    un prénom entre parenthèses ;
  - environ 45 types de prestataires, dont des quasi-doublons (« Photographe », « Photographe &
    Vidéaste », « Coiffeur(se) », « Coiffeur(se) - Maquilleur(se) »…) ; beaucoup de colonnes
    presque toujours vides (réseaux sociaux, SIRET, TVA, APE, statut juridique).

### Fiche événement (PDF)

- Une page A4 générée par le logiciel (moteur TCPDF), **texte réel** (pas une image : aucune
  reconnaissance de caractères nécessaire).
- Contenu, de haut en bas :
  1. le titre « Prénom NOM & Prénom NOM » ;
  2. « Date de l'événement : samedi 12 juin 2027 » ;
  3. **les deux mariés côte à côte** (deux colonnes) : nom, e-mail, adresse, code postal et
     ville ; un seul bloc « Téléphones » ;
  4. « Lieu de l'événement » : **un ou plusieurs lieux, deux par rangée**, chacun « Nom du lieu -
     samedi 12 juin 2027 à 14:30 », le texte d'un lieu pouvant passer à la ligne ;
  5. parfois une courte note libre sous les lieux ;
  6. « Le budget de l'évènement » : budget souhaité, total payé, solde, total, budget total,
     budget restant, pourcentage utilisé ;
  7. en pied de page, **l'entreprise de la planner** (raison sociale, adresse, SIRET, APE, TVA,
     RCS, téléphone) : jamais importée.
- Les deux colonnes imposent de lire le texte **avec sa position sur la page** (une extraction
  ligne à ligne mélange les deux mariés).

## Décisions à prendre avec Julien avant de coder

- **I. Coordonnées des mariés.** Une fiche événement ne garde aujourd'hui que le prénom et le
  nom de chaque client. Proposition : ajouter **e-mail, téléphone et adresse** à chaque client
  de l'événement (affichés dans l'onglet Mariés, déclarés au registre RGPD, recherchés par le
  module Données personnelles), plutôt que de les ranger en « champs importés » en lecture
  seule. Ce sont des données personnelles : elles suivent les durées de conservation existantes.
- **J. Statut des événements importés.** Proposition : **« Confirmé »** quand la date est à
  venir et qu'au moins un lieu est renseigné, **« Réalisé »** quand la date est passée,
  **« Prospect »** sinon (pas de date ou pas de lieu) ; la planner peut changer le statut de
  chaque ligne dans l'aperçu avant de confirmer.
- **K. Montants de la fiche.** Proposition : seul le **budget souhaité** est repris (budget
  total de l'événement). Total payé, solde et restant viennent de devis et de paiements que la
  fiche ne détaille pas : ils sont montrés dans l'aperçu à titre d'information et gardés en
  champ importé, jamais recalculés en faux paiements.
- **L. Critères des prestataires.** Proposition : chaque critère (« Moins de 50 invités »,
  « Pop »…) devient une **étiquette** du carnet (créée si elle n'existe pas) ; les
  descriptions de prestations (22ᵉ colonne) vont dans la **note interne** du prestataire.
- **M. Liens et identité légale des prestataires.** Le carnet n'a pas de champ site web,
  réseaux sociaux ni SIRET. Proposition : ajouter au carnet trois champs communs à tous les
  types — **site web**, **réseaux sociaux** (Instagram en premier) et **SIRET** — plutôt que de
  les laisser en champs importés. TVA intracommunautaire, APE et statut juridique restent en
  champs importés (rarement remplis, jamais utilisés).
- **N. Types de prestataires.** Proposition : à l'étape « Rapprochements », chaque type du
  fichier est rapproché d'un type existant du carnet (même nom à la casse et aux accents près,
  ou synonyme : « Coiffeur(se) » → « Coiffure ») ; un type sans équivalent est **créé** à la
  confirmation, ou **regroupé** sur un type existant si la planner le choisit (pour éviter les
  45 pastilles).

## Stories et critères d'acceptation

### IMP-07 — Importer ses prestataires depuis l'export Excel

- **Étant donné** l'export des prestataires de l'outil actuel, **quand** elle choisit « Des
  prestataires » à l'étape 1 et dépose le fichier, **alors** le format est reconnu (intitulés
  caractéristiques) et chaque colonne reçoit sa correspondance avec une confiance d'au moins 90 :
  nom, type, contact (prénom + nom), e-mail, adresse, code postal, ville, téléphone, site web,
  réseaux, SIRET, critères, prestations.
- **Quand** la colonne « Site Internet » contient des critères et « Critères avancés » des
  adresses web, **alors** la correspondance suit le **contenu**, pas l'intitulé (les deux
  colonnes sont permutées dans la proposition, la planner le voit et peut corriger).
- Les entités HTML sont décodées (« Ch&acirc;teau » → « Château ») ; un code postal numérique
  est complété à 5 chiffres (`5000` → `05000`) ; le premier téléphone d'une cellule qui en
  contient plusieurs devient le téléphone du prestataire, les autres sont gardés (note interne).
- **Rapprochements** (IMP-03) : un prestataire déjà au carnet (même nom à la casse et aux
  accents près, même ville si renseignée) est proposé en mise à jour plutôt qu'en doublon ; les
  types sont rapprochés comme décidé en N.
- **Confirmation** : les prestataires sont créés ou mis à jour par le `service.ts` du module
  `vendors` ; leur adresse est géocodée comme une saisie à la main (ADR 0031) ; l'import est
  **annulable** comme les autres (lot 5, IMP-05) : prestataires créés supprimés, mis à jour remis
  à leurs valeurs précédentes, étiquettes et types créés retirés s'ils ne servent plus.
- Isolation : un import de l'organisation A ne crée ni ne rapproche jamais un prestataire de B.

### IMP-08 — Importer ses événements depuis les fiches PDF

- **Quand** elle choisit « Des fiches événement (PDF) » à l'étape 1, **alors** elle peut
  déposer **une ou plusieurs fiches à la fois** (jusqu'à 50, réglage de la plateforme) ; chaque
  fiche devient **une ligne** de l'import (un événement), et la suite du parcours est celle du
  lot 5 (colonnes déjà reconnues, rapprochements, écarts, confirmation, annulation).
- Le fichier est reconnu **par son contenu** (signature `%PDF-`), vérifié par l'antivirus,
  limité en taille, lu **sans exécuter aucun script** et sans charger de ressource externe, puis
  oublié (seules les valeurs lues sont gardées, comme pour un tableau).
- La lecture tient compte de la **position du texte** : les deux mariés sont séparés par
  colonne, un lieu qui passe à la ligne est recollé, le pied de page de l'entreprise est ignoré.
- Valeurs reprises : mariés (prénom, nom, et selon la décision I e-mail, téléphone, adresse),
  date de l'événement, lieux (le premier devient le lieu de réception, tous vont dans les lieux
  du programme avec leur heure), note libre, budget souhaité (décision K).
- **Étant donné** une fiche illisible (scannée en image, protégée par mot de passe, pas une
  fiche événement de ce logiciel), **alors** elle est rejetée avec un motif dans le rapport des
  écarts, sans bloquer les autres fiches du lot.
- **Rapprochements** : un événement déjà présent (mêmes mariés, même date) est proposé en mise à
  jour ; deux fiches du même lot qui décrivent le même événement sont signalées.
- Statut des événements créés : décision J. Source du prospect : celle choisie à l'étape de
  confirmation (comme le lot 5).
- Isolation et données d'essai : comme le lot 5 (aucun rapprochement avec un événement d'essai,
  aucune lecture d'une autre organisation).

### IMP-09 — Aide et parcours guidé de la reprise

- La page « Importer » présente les deux reprises en premier (« Reprendre mes prestataires »,
  « Reprendre mes événements ») avec, pour chacune, comment obtenir le fichier dans l'outil
  actuel (texte d'aide, sans nommer l'outil dans le code : le texte vit dans les fichiers de
  traduction).
- Le tutoriel « Importer ses événements existants » (lot 10) utilise une fiche PDF fictive.
- Captures du centre d'aide régénérées pour l'écran Importer (ADR 0033).

## Technique

- **Lecture des PDF** : `pdfjs-dist` (dépendance acceptée au lot 12), dans
  `packages/import-engine`, côté serveur, sans worker navigateur ni police externe, scripts et
  formulaires du PDF ignorés ; limites de taille et de nombre de pages (une fiche = une page ;
  au-delà de 3 pages, refus). Voir ADR 0034.
- **Reconnaissance du format « logiciel tiers »** : un profil de données (intitulés, positions
  relatives des blocs, libellés « Date de l'événement », « Lieu de l'événement », « Le budget de
  l'évènement ») dans `packages/starter-templates`, traduisible, jamais en dur dans le code ;
  un autre logiciel pourra avoir son propre profil plus tard.
- **Prestataires** : nouveau type d'éléments importables `vendors` dans
  `packages/contracts/src/import/fields.ts` ; le module `vendors` expose dans son `service.ts`
  les fonctions d'import, de lecture de l'état courant et d'annulation, comme les modules du
  lot 5.
- **Champs nouveaux** selon les décisions I et M : migrations réversibles, registre RGPD
  (`privacy.registry.yaml` des modules concernés), recherche et effacement RGPD mis à jour.
- **Tests** : `describe('IMP-07 — …')`, `describe('IMP-08 — …')`, un `it` par critère ; lecture
  testée sur les fichiers fictifs du corpus (`files/logiciel-tiers/`) ; isolation A/B pour toute
  nouvelle route ; e2e ordinateur et 375 px, axe-core. Les vrais exports de Julien servent à une
  vérification manuelle en local, jamais en CI ni dans le dépôt.

## Découpage proposé

1. **14a** — Lecture : PDF (`pdfjs-dist`, ADR 0034) et profil « logiciel tiers » (prestataires
   et fiches), testés sur le corpus fictif. Aucun écran.
2. **14b** — Prestataires (IMP-07) : champs du carnet (décision M), étiquettes et types,
   import, rapprochements, annulation, écrans.
3. **14c** — Événements (IMP-08) : coordonnées des mariés (décision I), dépôt de plusieurs
   fiches, import, rapprochements, annulation, écrans.
4. **14d** — Aide et parcours (IMP-09), captures.
