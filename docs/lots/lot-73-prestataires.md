# Lot 73 — Réaliser le volet 4 des maquettes : « Prestataires »

**Statut** : **spécification validée par Julien le 27/11/2026** (« Je valide le lot 73 »), décisions
P1 à P14 tranchées le même jour (§ 7). La validation vaut accord pour les trois migrations 0234 (schéma
`vendors`), 0235 (schéma `events`) et 0236 (schéma `hub`), donc pour toucher deux schémas qui ne sont
pas celui du module « Prestataires » (`hub.message_templates` : P10). Le lot touche aussi deux parcours
P0 (PAR-04, SC-04 « Un devis de traiteur dans le budget » ; PRE-01 et PRE-02).
**Branche de la spécification** : `lot-73-prestataires` (une PR vers `main`, ce fichier et
`docs/QUESTIONS.md` seulement). Chaque paquet aura ensuite sa branche `lot-73<x>-…` et sa PR.
**Date** : 27/11/2026, par Claude Code.

Sources, dans l'ordre où elles font foi :

1. `docs/audits/2026-11-ux-parcours/06-decisions-porte-2.md` (D3, D4, D9, D10, D11) ;
2. `docs/audits/2026-11-ux-parcours/10-maquettes-prestataires.md` : choix V1 à V14, inventaire des
   fonctions gardées (§ 3 bis), ce que les maquettes supposent de l'app (§ 4). **Statut de V1 à V14 :
   voir le § 0 ci-dessous** ;
3. les quatre maquettes `docs/maquette/lot-68/18-prestataires-carnet.html`,
   `19-prestataires-rattacher-pieces.html`, `20-prestataires-creation-fiche.html`,
   `21-prestataires-budget-relance.html` ;
4. `docs/audits/2026-11-ux-parcours/04-synthese.md` (C-41 à C-50, C-78 ; principes P-nn) ;
5. `DESIGN.md` réécrit par la phase 6 du lot 68 (PR #193, ADR 0116) et sa note
   `13-design-system.md` (§ 4.2 « Budget », S1 à S15, pas encore tranchés) : ce lot applique les formes
   écrites, il ne réécrit pas `DESIGN.md` ;
6. `docs/CAHIER_DES_CHARGES.md` pour les exigences ; `docs/lots/lot-70-taches-et-transverse.md` et
   `docs/lots/lot-71-reprise-et-import.md` (branche `origin/lot-71-reprise-et-import`) pour ce qu'ils
   laissent à ce lot et pour les composants dont il hérite.

Règle de lecture (décision de Julien du 26/11) : quand une maquette récente contredit une décision
plus ancienne, la maquette l'emporte, à condition qu'aucune fonction majeure ne disparaisse. Les
ajustements restent à la main de la planner : **aucun libre-service du prestataire ni du client,
aucun bouton de relance ajouté, Symbola n'envoie rien de plus qu'aujourd'hui**.

Fichiers sous `apps/symbola/` sauf mention ; `fr` = `packages/i18n/src/messages/fr.json`.

---

## 0. Le statut des choix V1 à V14

Les choix V1 à V14 de la note 10 n'avaient pas de décision écrite de Julien (la PR #187 a été
fusionnée sans commentaire), à la différence des volets 1, 2, 3 et 5. **Julien les a confirmés le
27/11/2026 tels que la maquette les propose (P1)**, entre autres : « V3 Oui le menu latéral disparait :
elle n'a pas d'habitude : on est pas encore en MVP », « V10 La maquette est bonne : métier
obligatoire », « V7 et V14 OK ». Les critères de ce fichier reposent donc sur eux sans réserve.

**Règle générale de Julien pour tout le lot (P6)** : « on a pas encore sorti un MVP : rien n'est en
prod -> il ne faut pas perdre de temps sur les considération des données déjà enregistrées à ce stade
du projet : on supprimera pour repartir de zero en staging si besoin. » Aucune migration de ce lot n'a
d'étape de données, aucune ancienne adresse n'est redirigée, rien n'est reconstruit pour les données
d'avant.

---

## 1. Ce qui change pour la planner, en clair

Une fois le lot livré, Camille verra :

- **Un carnet qui répond d'un coup d'œil.** Chaque prestataire tient sur une ligne : son nom (on
  clique dessus pour ouvrir sa fiche, directement, sans aperçu à côté), le contact et son téléphone,
  le métier et la ville, le nombre de mariages faits ensemble, l'évaluation, et l'état de ses pièces
  (« ✓ À jour », « Kbis · à recevoir », « ! Assurance · à renouveler », P3). Un bouton « Ajouter à un mariage… » et
  un menu « ⋯ » (ouvrir, appeler, écrire, modifier, et à part « Archiver… »). La carte devient une
  vue, « Liste · Carte », au lieu de prendre la moitié de l'écran.
- **Des filtres lisibles.** Les familles de métiers en pastilles comptées, puis les métiers de la
  famille choisie ; une barre de filtres nommés (« Rechercher », « Où ? » et son rayon, « Pièces »,
  « Avec vous », « Évaluation », « Étiquette ») ; chaque filtre posé devient une pastille qui
  s'enlève ; « 2 fiches sur 48, par distance ». Un filtre « Pièces à régler » range d'abord ce qui
  presse (à renouveler, bientôt, à recevoir, à vérifier) avec la raison (« retenu sur 2 mariages »).
- **Trier et agir sur plusieurs fiches.** Chaque en-tête de colonne trie ; « Sélectionner » ouvre la
  barre du volet 1 : ajouter plusieurs fiches à un mariage, leur donner une étiquette, les exporter,
  les archiver.
- **Rattacher un prestataire à un mariage depuis le carnet ou sa fiche** — le geste qui manquait
  (trois abandons sur trois). Une petite fenêtre demande le mariage, le poste du budget (proposé
  d'après le métier) et « Comment l'ajouter ? » : « En comparaison » ou « Retenu », chacun avec ce
  qu'il fait, rien de coché d'avance. Le message qui suit offre « Annuler » et « Ouvrir le poste ».
- **Depuis le poste du mariage, le même geste**, dans un panneau assez large pour lire les noms :
  « Mettre en comparaison » et « Retenir » expliqués en tête, les fiches du métier d'abord avec leurs
  pièces, « Dans la comparaison » écrit au lieu de boutons grisés, une recherche qui repart vide.
  « Chercher dans tout le carnet » ouvre le carnet filtré sur le métier du poste (et non plus autour
  du lieu du mariage), filtre qui s'enlève.
- **« Pressenti » disparaît de l'écran** : un prestataire proposé est « en comparaison », le bouton
  dit « Mettre en comparaison » (V7, P2).
- **Un carnet importé sans métier se range en un écran.** Une phrase dit pourquoi les familles ne le
  montrent pas, et « Classer les 37 fiches » ouvre un écran où chaque fiche reçoit un métier proposé
  d'après son nom (« Proposé d'après « Traiteur » dans le nom »), que Camille valide ; rien n'est
  enregistré avant « Enregistrer les 31 métiers » ; le message « 31 fiches classées · Revoir » rouvre
  l'écran sur ces fiches (P13).
- **Un seul formulaire pour créer un prestataire**, le même au carnet et depuis un poste : nom,
  métier (obligatoire, proposé d'après le poste), contact, téléphone, e-mail, ville ; le reste
  derrière « Plus de détails ». Depuis un poste, il ajoute « Comment l'ajouter ? » et devient « Créer
  et ajouter ». Après création, la fiche s'ouvre.
- **Une fiche qui tient en un écran et demi**, avec une seule action pleine (« Ajouter à un
  mariage… ») ; une alerte juste sous l'en-tête quand une pièce a expiré ou qu'un IBAN a changé ; à
  gauche « Avec vous » (les deux historiques réunis, une seule colonne « Montant », juste) et
  « Pièces » ; à droite « Caractéristiques », « Paiement et fichiers », « Note interne ». Une fiche
  neuve dit pour chaque valeur absente pourquoi ou quoi faire, et propose de demander les pièces
  habituelles en un bouton.
- **Le budget du mariage parle en mots.** Une ligne par poste : le poste, son prestataire (lien vers
  sa fiche), où il en est (« Retenu, contrat non signé », P5), ses pièces, une action quand il y a quelque
  chose à faire (« Ajouter… », « Relancer… »), puis Prévu, Réel (et l'écart), Réglé (et le reste),
  Prochaine échéance, et un menu « ⋯ » (ouvrir le poste, documents, échéancier, changer de
  prestataire, supprimer…). « À trouver » n'est plus rouge ; **le mot « engagé » disparaît de
  l'écran** (P14) : la ligne dit le réel et l'état du contrat en mots ; en tête, « Réel, tout signé »
  ou « Réel · dont 27 000,00 € signés ». Les totaux en tête, en cinq nombres. **Sur téléphone**, une carte par poste avec
  ses quatre montants lisibles, sans défilement de côté.
- **Relancer un prestataire en deux gestes** (V14). « Relancer… » sur la ligne du poste dont le
  contrat n'est pas signé, sur « Aujourd'hui » et dans la fenêtre du poste ouvre la même fenêtre : d'abord
  « Le joindre » (le contact, le téléphone qui appelle, le message prêt et visible, « Copier le
  message », « Ouvrir dans ma messagerie »), puis « Noter ce que vous avez fait » (comment — rien de
  coché d'avance, sauf ce que le geste fait dans la fenêtre a montré —, le jour, quand y revenir, une
  note). La ligne dit aussitôt « dernière relance : aujourd'hui, par e-mail ». **Symbola n'envoie
  rien**, comme aujourd'hui, quel que soit le réglage d'envoi de l'agence (P11).
- **Des messages de relance à ses mots** (P10) : « Relance d'un contrat » et « Relance d'un devis »
  deviennent des modèles modifiables dans Paramètres › Modèles de messages ; la fenêtre « Relancer… »
  part du modèle de l'agence.
- **Retenir sur un poste déjà pourvu** (P12) : la fenêtre propose « Remplacer {nom} » en premier, et
  « Retenir aussi », plus discret.

Ce qui **ne change pas** : la fenêtre du poste et ses cinq rubriques (seule sa relance change, § 5.5) ;
la vue « Carte » elle-même ; les Paramètres du carnet (sauf deux réglages des pièces, P3 et P4) ; l'espace du
prestataire par lien (lot 47) ; l'import d'un carnet et son étape « Types » ; les prestataires retenus
repris d'un PDF (lot 71e).

---

## 2. Exigences et constats traités

| Élément des maquettes | Exigences du cahier des charges | Constats et décisions |
| --- | --- | --- |
| Ligne du carnet, action rapide, menu, vue « Liste · Carte » (page 18) | PRE-01 (annuaire : fiche, catégorie, zone, tarifs, notes, évaluation, documents), PRE-11 (carte filtrable), UX-13, UX-05 (375 px) | C-44, C-48 (aperçu) ; P-10 ; D10 ; V1, V2, V3 |
| Familles, métiers, barre de filtres, pastilles, « Pièces » (page 18) | PRE-01, PRE-11 (« les filtres se combinent »), UX-12 | C-43, C-47 ; D9 ; P-13 ; V4 |
| Tri par colonne, sélection et actions en lot (page 18) | UX-07 (annuler), UX-15, HUB-13 (export) | C-45 ; M2 ; V5 |
| Carnet tout juste importé, « Classer les fiches » (page 18) | PRE-01 (« importable depuis un tableur »), HUB-14, UX-08 | C-47, C-69 ; D9 ; P-06 ; V6 |
| État vide du carnet (page 18) | UX-08, PAR-01 | C-69, C-51 ; P-05 |
| « Ajouter à un mariage… » depuis le carnet et la fiche (page 19) | PRE-02 (rattachement avec statut ; « Retenu » engage la ligne), BUD-01 | C-41 ; P-14 ; V8 |
| Le panneau d'ajout depuis le poste, « Chercher dans tout le carnet » (page 19) | PRE-02, BUD-05 (comparaison) | C-49 ; P-15 ; V7 |
| Les pièces dans le carnet, le budget et la fiche (pages 19 à 21) | PRE-05 (pièces à échéance ; « une pièce qui expire avant la date de l'évènement est signalée »), PRE-10 (IBAN changé) | C-42 ; P-06, P-21 ; V9 |
| Le formulaire unique de création (page 20) | PRE-01, UX-03, UX-10 (erreurs), HUB-19 | C-46 ; P-14, P-18 ; V10 |
| La fiche d'un prestataire, la fiche neuve (page 20) | PRE-01, PRE-05, PRE-08 (évaluation interne, historique), PRE-10 | C-48 ; P-06, P-09 ; D10 ; V11 |
| Le tableau des postes (page 21) | BUD-01 (montants), BUD-03 (échéancier), BUD-04 (documents en un clic), PRE-02 | C-49, C-42, C-86 ; P-21 ; V12 |
| Le budget sur téléphone (page 21) | UX-05, BUD-01 | C-78 ; P-20 ; V13 |
| « Relancer… » (page 21) | PRE-02, HUB-08 (« Aujourd'hui »), SC-05 étape 3 (« reçoit une relance ») | C-50 ; M3 ; ADR 0110 ; V14 |

---

## 3. L'app d'aujourd'hui, en bref

Lu dans `main` (`2342f79e`, lots 70a et 70b compris), sans lancer l'app.

- **Le carnet** (`app/prestataires/page.tsx`, 520 lignes) : en-tête « Paramètres du carnet »,
  « Importer », « Nouveau prestataire » ; pastilles « Tous », familles, « À classer », second rang des
  métiers ; bandeau « N prestataires à classer : les voir · ranger les types » (`:188`) ; barre de
  filtres (`FilterBar`) avec texte, « Où ? » et rayon (5 à 100 km), « déjà travaillé ensemble »,
  évaluation, « sur la carte : à placer », étiquette, champs-filtres du métier ; pastilles des filtres
  posés ; bascule Liste / Carte ; résultats triés par nom (ou par distance autour d'un lieu,
  `modules/vendors/repository.ts:403`), **aucun autre tri**, limite de 200 fiches
  (`service.ts:810`) ; la ligne : nom (qui ouvre un **aperçu latéral**, `?fiche=`), métiers, ville,
  trajet, étoiles, « Exemple », « Non placé sur la carte », bouton « Archiver ». Exports CSV et PDF de
  toute la liste filtrée (`export/route.ts`, cellules neutralisées par `toCsv`). Aucun état de pièce.
- **Depuis un poste** (`app/prestataires/selection.ts:51-63`) : le carnet s'ouvre avec un bandeau
  « Ajouter à la ligne … » et, **sans qu'on le demande, un « Où ? » sur le lieu du mariage** ; chaque
  ligne a « Ajouter à … » (`actions.ts:203`, `addVendorToSlotAction`, statut « Pressenti » seulement).
- **La fiche** (`app/prestataires/[id]/page.tsx`, 450 lignes) : neuf blocs (historique avec vous,
  historique des collaborations, coordonnées et caractéristiques, coordonnées bancaires, pièces, note
  interne, plaquettes et RIB, plans de salle pour un lieu, point sur la carte), un bouton plein par
  bloc. **Le « Prix final » de l'historique est faux quand un poste a plusieurs lignes de budget** :
  `getVendorHistory` (`modules/vendors/service.ts:817-835`) garde l'engagé de la **dernière ligne**
  lue pour le poste (`actualBySlot.set(line.eventVendorSlotId, line.committedAmountCents)`), au lieu
  du total du poste — cause probable du « Prix réel 9 600,00 € · Prix final 600,00 € » de C-48.
- **La création** : au carnet, `vendor-form.tsx` en quatre rubriques (« Rubrique 1 sur 4 », le
  téléphone à la troisième) ; depuis un poste, `app/events/[id]/vendor-choice.tsx` « Nouveau
  prestataire pour … » (nom, métier avec « À classer », e-mail, téléphone, ville), « Créer et
  retenir », « Créer et comparer ».
- **Les pièces** (`modules/vendors/records.ts`, `documents.ts`, schéma `vendors.vendor_documents`) :
  statuts `requested`, `to_verify`, `verified`, date de fin `valid_until`, alerte `documentAlert`
  (`valid`, `expiring` à 30 jours réglables, `expired`, `no_expiry`), `documentsLapsingBefore` (pièce
  qui finit avant le mariage) ; natures de départ (`starter-templates/src/vendor-document-kinds.json`) :
  « Attestation d'assurance responsabilité civile », « Extrait Kbis ou avis de situation Insee »,
  « Plan du lieu », « Autre pièce ». **Aucune nature n'est marquée « demandée d'habitude », aucune n'a
  de nom court.** L'état n'est calculé que pour la fiche et pour « Aujourd'hui »
  (`listVendorDocumentNotices`).
- **Le budget du mariage** (`app/events/[id]/budget-vendors-table.tsx`, `budget-vendor-rows.ts`, lot
  63c) : colonnes Poste (poste, pastille de statut, pastille « Engagé », prestataires, « + Ajouter des
  prestataires »), Prévu, Réel, Écart, Réglé, Reste à payer, Prochaine échéance, puis « Ouvrir » et
  « Supprimer » ; sous-total « dont engagé » ; échéancier déplié par un chevron ; sur téléphone, les
  mêmes cellules libellées par `data-label` (corrigées en largeur au lot 69). Le nom du prestataire
  n'est pas un lien.
- **Le poste** : un prestataire rattaché est une ligne de `events.event_vendor_candidates`
  (`shortlisted`, `contacted`, `quote_received`, `retained`, `contract_signed`, `paid_off`,
  `dismissed`) ; « Retenir » (`selectVendorCandidate`) publie `events.vendor_slot.booked`, que le
  module `budget` consomme pour engager la ligne (`applyVendorSlotBookedToBudget`) ; plusieurs
  prestataires peuvent être retenus sur un même poste (lot 28b, D10 et D14) ; « Changer de
  prestataire » remplace (`changeRetainedVendor`).
- **La relance** (lot 65d, M16) : `app/accueil/note-reminder.tsx`, ouverte depuis « Aujourd'hui »
  (`today-view.tsx`), la Synthèse (`cockpit.tsx`) et la fenêtre du poste (`slot-comparison.tsx`) ;
  « Comment avez-vous relancé ? » avec **le premier canal coché d'avance** (`defaultChecked={index ===
  0}`, `:153`) ; rappel 2, 3 (par défaut), 7, 14 jours ou aucun ; message type derrière un bouton,
  produit par `vendorReminderDraftAction` (`app/accueil/actions.ts:113`) à partir des textes
  `Today.remind.*` de `fr` ; enregistrée par `recordVendorReminder`
  (`modules/events/service.ts:3190`) dans `events.vendor_reminders`, la note dans les notes internes
  du prestataire. « Contrat attendu » vient de `listUncontractedVendors` (`:3169`), daté par
  `candidate.updatedAt` (**la date bouge à chaque modification du prestataire sur le poste**, pas
  seulement quand il est retenu).
- **La fenêtre « Préparer l'e-mail »** existe (`app/ui/prepare-email-dialog.tsx`, lot 65d, ADR 0110) :
  « Ouvrir dans ma messagerie », « Copier le message » (« Message copié »). La relance d'un
  prestataire ne s'en sert pas encore.
- **Les frontières** : le module `vendors` appelle déjà `events` (`listSelectedVendorIds`,
  `listVendorConsultations`, `countWorkedWithByVendor`) et `budget` (`listBudgetLines`) par leurs
  `service.ts` ; les postes et les prestataires rattachés sont dans le schéma `events`, les lignes de
  budget dans `budget` (`event_vendor_slot_id`, sans clé étrangère entre schémas).

---

## 4. Ce qui touche les données, les contrats et les événements

Deux migrations, chacune dans le schéma de son module, avec son retour arrière dans
`packages/db/drizzle-rollback/` (ADR 0036). Numéros réservés pour ce lot : **0234 à 0243** (le lot 71
prend 0218 à 0223, le lot 72 part de 0224, le lot 74 de 0244). Numéros indicatifs, à reprendre au
moment du code.

### 4.1 Migrations

Trois migrations, **sans étape de données** (règle P6 : rien n'est en production ; une base de staging
se recrée). Les valeurs de départ passent par les modèles de départ, posés à la création d'une
organisation.

| N° | Fichier | Ce qu'elle fait | Pourquoi |
| --- | --- | --- | --- |
| 0234 | `0234_lot73a_vendors_document_kind_usage.sql` | Schéma **`vendors`** : ajoute à `vendor_document_kinds` `short_label text` (nullable, 1 à 40 caractères, sans caractère de contrôle) et `requested_by_default boolean not null default false`. Les natures de départ les reçoivent du fichier `vendor-document-kinds.json` au moment où elles sont posées (« Assurance » et « Kbis », demandées d'habitude). Retour arrière : retire les deux colonnes | P3 : le nom de la pièce en tête de son état (« Assurance · à renouveler ») ne tient pas dans une ligne avec le nom complet ; P4 : « Demander l'assurance et le Kbis » suppose de savoir quelles pièces l'agence demande d'habitude |
| 0235 | `0235_lot73a_events_candidate_retained_at.sql` | Schéma **`events`** : ajoute `event_vendor_candidates.retained_at timestamptz` (nullable), posé par le service quand le prestataire passe à `retained` (« Retenir », « Changer de prestataire », « Retenir aussi », import), effacé quand il n'est plus retenu ; index `(organization_id, retained_at)` | « retenu le 18 nov. » (page 21) doit dire depuis quand le prestataire est retenu, pas depuis sa dernière modification (`updatedAt`) |
| 0236 | `0236_lot73f_hub_message_template_starter_key.sql` | Schéma **`hub`** (accord de Julien, P10, 27/11) : ajoute `message_templates.starter_key text` (nullable, clé d'un modèle de départ) et un index unique `(organization_id, starter_key, locale)` parmi les modèles non supprimés dont la clé n'est pas nulle. Retour arrière : retire l'index et la colonne | P10 : retrouver « Relance d'un contrat » et « Relance d'un devis » même quand la planner les a renommés |

Le lot 71 (0221) ajoute `takeover_contract` à la même table `event_vendor_candidates` : pas de
conflit, les deux colonnes sont indépendantes ; la migration 0235 passe après 0221.

**Rien d'autre ne demande de migration** (P5 : pas de date d'envoi du contrat, donc pas de colonne
`contract_sent_on`) : la ligne du carnet, les filtres, le tri, la sélection, le
classement, la fenêtre « Ajouter à un mariage… », le formulaire unique, la fiche, le tableau du budget
et la relance lisent ou écrivent des colonnes qui existent (`vendor_type_links`, `vendor_documents`,
`event_vendor_candidates`, `vendor_reminders`, `budget_lines`).

### 4.2 Ce que chaque module expose (frontières, ARC-01, ARC-02)

Aucun module ne lit la base d'un autre. Les écrans (`app/…`) appellent plusieurs `service.ts`, comme
aujourd'hui.

**Module `vendors`** (`modules/vendors/service.ts`, `records.ts`) :

- `summarizeVendorDocuments(organizationId, vendorIds, { today, eventDatesByVendor? })` : pour chaque
  fiche, l'**état résumé de ses pièces** (fonction pure `documentState` dans `documents.ts`, testée
  seule) : `expired` > `expiring` (dans le délai d'alerte, **ou avant un mariage où elle est
  retenue** : les dates viennent de l'appelant, lues dans `events`) > `requested` > `to_verify` >
  `up_to_date` > `none_requested`, avec la pièce la plus urgente (nature, nom court, date), le
  nombre d'autres pièces à régler (« + 1 ») et la raison. **« Aucune pièce demandée » n'est jamais
  « À jour »** : `up_to_date` exige au moins une pièce vérifiée et aucune à régler. Une seule lecture en
  base pour toutes les fiches de la liste (NFR-02, ADR 0115 : une lecture par affichage).
- `findVendors` gagne : le filtre `documents` (`to_settle`, `up_to_date`, `requested`, `to_verify`,
  `expired_or_soon`) ; le tri `sort` (`name`, `type`, `worked_with`, `rating`, `documents`,
  `distance`) et son sens ; dans chaque résultat `workedWithCount` (lu une fois par
  `countWorkedWithByVendor` du module `events`), `documentState`, le contact et le téléphone. Le tri
  par nom, métier, évaluation et distance se fait en SQL ; le tri par « Avec vous » et par pièces, qui
  dépend d'un autre module ou d'un calcul de date, se fait dans le service sur la liste filtrée. La
  limite passe de 200 à 500 fiches ; au-delà, l'écran dit « Les 500 premières : affinez avec les
  filtres » (aucune agence pilote n'en est près ; à revoir si une agence dépasse).
- `proposeVendorTypeFromName(name, types, synonyms)` : fonction pure. Les mots du nom de la fiche
  comparés aux libellés des métiers de l'organisation et aux synonymes des modèles de départ
  (`starter-templates/src/vendor-type-synonyms.json`, traduisible), mots entiers, sans accents ni
  casse ; rend le métier et le mot qui l'a fait proposer, ou rien. Jamais d'enregistrement d'office.
- `setVendorsPrimaryType(organizationId, assignments)` : donne un métier à plusieurs fiches d'un
  coup (écran « Classer », « Donner le métier… » en lot) ; en transaction ; une fiche qui avait déjà
  un métier le garde et prend le nouveau comme principal seulement si elle était « à classer ».
- `tagVendors`, `archiveVendors` : actions en lot (étiquette ajoutée, archivage), en transaction,
  avec ce qu'il faut pour « Annuler ».
- `getVendorHistory` corrigé : le montant d'un mariage est **la somme du poste** (même calcul que la
  colonne « Réel » du budget, `buildBudgetVendorRows`), et pour un poste soldé le total réglé ; voir
  P9.
- `listVendorDocumentKinds` rend `shortLabel` et `requestedByDefault` ; `requestUsualVendorDocuments`
  demande d'un geste les natures `requested_by_default` qui ne sont pas déjà demandées ou valables.

**Module `events`** (`modules/events/service.ts`) :

- `addVendorToEventSlot({ organizationId, eventId, slotId | newSlotLabel, vendorIds, mode:
  "compare" | "retain", userId })` : la fonction derrière « Ajouter à un mariage… » et « Créer et
  ajouter ». `compare` crée la ligne `shortlisted` (ou la laisse si le prestataire y est déjà) ;
  `retain` (une seule fiche) suit **la règle existante de « Retenir »** (`selectVendorCandidate`, seuil
  d'alerte du budget et « Retenir quand même », publication de `events.vendor_slot.booked`) ; sur un
  poste qui a déjà un retenu, l'appelant choisit (P12) : `replace` (règle de « Changer de
  prestataire », `changeRetainedVendor` : l'ancien repasse en comparaison) ou `retain_also` (un second
  retenu, possible depuis le lot 28b). « Nouveau poste » crée le poste (`addEventVendorSlot`) dans la même
  transaction. Refus d'un évènement annulé, clôturé ou d'une autre organisation par le même message
  que « inexistant ».
- `undoVendorAddition(…)` : défait l'ajout pendant dix secondes (retire la ligne créée ; pour un
  « Retenu », remet l'état d'avant par la règle de « Ne plus retenir », qui publie déjà
  `events.vendor_retention.released`).
- `listEventsForVendorAddition(organizationId)` : les évènements à venir, demandes comprises, le plus
  proche d'abord, avec leurs postes (et pour chacun le nombre en comparaison et le retenu).
- `matchSlotToVendorType(slots, types, families, synonyms)` : fonction pure, la correspondance
  **calculée** entre un poste et un métier ou une famille (même libellé, synonymes des modèles de
  départ, famille du même nom, puis ressemblance), sans donnée nouvelle (P7). Elle sert dans les deux
  sens : proposer le poste d'après le métier (« Ajouter à un mariage… »), et le métier d'après le poste
  (création depuis un poste, carnet ouvert depuis un poste). Elle partage ses règles avec la fonction
  de rangement des postes du lot 71d (`proposeImportSlot`, synonymes de métiers) : une seule fonction
  si 71d est fusionné avant, sinon 71d la reprend.
- `retained_at` posé et effacé par le service (0235) ; `listUncontractedVendors` lit `retained_at` au
  lieu de `updatedAt` (« retenu le … » ; nul → rien n'est écrit) ; l'état se dit « Retenu, contrat non
  signé » (P5).
- `undoVendorReminder(organizationId, reminderId, userId)` : « Annuler » dix secondes après « Noter la
  relance » (retire la relance et sa note).
- `listLastVendorReminders` (existant) lu pour chaque ligne du budget.
- `vendorReminderMessage(organizationId, { eventId, candidateId, locale })` (paquet 73f) : le message
  de la fenêtre « Relancer… », rempli à partir du modèle de l'agence (`hub`, ci-dessous) ; « Relance
  d'un contrat » pour un prestataire retenu dont le contrat n'est pas signé, « Relance d'un devis »
  pour un prestataire en comparaison. Remplace le texte de `Today.remind.*` lu aujourd'hui par
  `vendorReminderDraftAction`.

**Module `hub`** (`modules/hub/message-templates.ts`, paquet 73f, P10) :

- deux modèles de départ de plus dans `packages/starter-templates/src/message-templates.json`
  (fichier de données traduisible, `fr` et `en`) : `vendor_contract_reminder` « Relance d'un
  contrat » et `vendor_quote_reminder` « Relance d'un devis » ; `addStarterMessageTemplates` pose
  aussi `starter_key` ;
- `messageTemplateByStarterKey(organizationId, key, locale)` : le modèle de l'agence s'il existe,
  sinon le texte du fichier de départ (une agence qui a supprimé le modèle a toujours un message) ;
- les variables de ces deux modèles : `first_name` (le contact du prestataire), `vendor` (nouvelle),
  `slot`, `clients`, `event_date`, `organization`, contrôlées comme les autres (une variable inconnue
  est refusée à l'enregistrement).

**Module `budget`** : rien de nouveau dans le service. Le tableau calcule toujours ses montants avec
`buildBudgetVendorRows` (application, fonction pure) ; seule sa forme change.

### 4.3 Contrats (`packages/contracts`)

Changements **compatibles** (ajouts) :

- `VendorDocumentState` (état, pièce la plus urgente, raison, nombre d'autres) et `VendorListItem`
  (`workedWithCount`, `documentState`, `contactName`, `phone`) ; `FindVendorsInput` (`documents`,
  `sort`, `direction`) ;
- `VendorDocumentKind` (`shortLabel`, `requestedByDefault`) ;
- `VendorCandidate` (`retainedAt`) ;
- l'entrée de `addVendorToEventSlot` (`mode` : `compare`, `retain`, `replace`, `retain_also`) et son
  résultat (ce qu'il faut pour le message de retour et « Annuler ») ;
- `EMAIL_VARIABLES` gagne `vendor` ; une liste `VENDOR_REMINDER_VARIABLES` (`emails.ts`) pour les deux
  modèles de relance (P10) ;
- le montant « signé » des totaux du budget (P14) : calculé dans `buildBudgetVendorRows`, sans
  changer le contrat du module `budget`.

Rien d'incompatible : les valeurs de statut ne changent pas (`shortlisted` reste en base, seul son mot
change à l'écran, V7).

### 4.4 Événements internes (`domain_events`)

**Aucun événement nouveau.** « Retenu », « Remplacer » ou « Retenir aussi » depuis le carnet ou par
« Créer et ajouter » passent par `selectVendorCandidate` ou `changeRetainedVendor`, qui publient déjà `events.vendor_slot.booked` et
`events.vendor_retention.released` dans la transaction ; le module `budget` les consomme comme
aujourd'hui. « Annuler » un « Retenu » publie `events.vendor_retention.released` (règle existante de
« Ne plus retenir »). Les actions en lot du carnet (étiquette, archivage, métier) restent internes au
module `vendors`.

### 4.5 Droits et isolation (SEC-10 à SEC-13)

- Toute nouvelle action serveur vérifie session, organisation, rôle (les rôles qui ont accès au carnet
  et au budget aujourd'hui, sans changement) et objet. Les identifiants reçus en lot (fiches, postes,
  évènements) sont tous revérifiés dans l'organisation : un seul identifiant d'ailleurs fait refuser
  tout le lot, avec le message « inexistant ».
- Une Planner qui ne voit pas tous les évènements (lot 52) ne voit dans « Ajouter à un mariage… » que
  les évènements de son équipe ; le compteur « Avec vous » et la raison des pièces (« retenu sur 2
  mariages ») comptent tous les mariages de l'agence mais ne les nomment pas quand elle n'y a pas
  accès (« retenu sur 2 mariages », jamais leurs noms).
- **Le lien d'un prestataire** (lot 47) ne voit ni le carnet, ni l'état résumé de ses pièces tel que
  la planner le voit, ni les autres prestataires du poste, ni la relance notée : il ne voit que ses
  pièces demandées (règle actuelle) ; « Demander au prestataire » et « Demander l'assurance et le
  Kbis » y déposent une demande comme aujourd'hui.
- Un évènement de démonstration (`is_demo`) : « Relancer… » garde son refus actuel
  (`DemoEventRestrictionError`) ; « Ajouter à un mariage… » propose les évènements d'exemple seulement
  pour les fiches d'exemple.
- L'Admin d'exploitation n'accède à aucune de ces données (SEC-09).

### 4.6 Fichiers et pièces (SEC-21)

Le lot n'ajoute **aucun envoi de fichier** : « Ajouter une pièce », les plaquettes, le RIB et le devis
gardent leurs routes actuelles (type lu dans le contenu, taille limitée, ClamAV, stockage privé,
téléchargement servi après contrôle des droits, ADR 0027). Deux points à tenir :

- **L'export de la sélection** (« Exporter… », CSV ou PDF) passe par la route actuelle
  (`app/prestataires/export/route.ts`), qui gagne le paramètre `ids` (les fiches choisies, revérifiées
  dans l'organisation) ; le CSV reste neutralisé (`toCsv` → `neutralizeCell` : cellules commençant par
  `=`, `+`, `-`, `@`) ; l'export garde sa trace au journal (format et nombre, aucun nom, SEC-19).
- Le nom d'un fichier de pièce affiché sur la fiche (« assurance-2026.pdf ») reste échappé ; aucun
  nom de fichier ni nom de prestataire dans une adresse ou un journal.

### 4.7 Registre RGPD (`privacy.registry.yaml`)

Aucune donnée personnelle nouvelle n'est gardée :

| Table | Champ | Catégorie | Règle |
| --- | --- | --- | --- |
| `vendors.vendor_document_kinds` | `short_label`, `requested_by_default` | paramétrage | Réglage de l'organisation, aucune donnée personnelle ; à déclarer comme tel si le registre liste les colonnes de paramétrage, sinon rien |
| `events.event_vendor_candidates` | `retained_at` | technique (date) | Suit la ligne du prestataire rattaché (effacée avec elle, exportée avec elle) |
| `hub.message_templates` | `starter_key` | paramétrage | Clé d'un modèle de départ, aucune donnée personnelle. Le texte des modèles de relance est déjà couvert par le registre des modèles de messages (lot 38b) |

Le message de relance copié ou ouvert dans la messagerie n'est **pas gardé** (il ne l'est pas
aujourd'hui) ; la note de la relance reste une note interne du prestataire (déjà au registre). Le contrat `privacy/v1` des modules `vendors`, `events` et `hub` couvre les nouvelles colonnes (export complet,
HUB-13 ; reprise d'un export, lot 35b : `retained_at` repris tel quel). Le test du registre vérifie
qu'aucune colonne nouvelle n'est oubliée.

---

## 5. Les paquets en détail

Pour chaque paquet : l'écart entre l'app et la maquette, fichier par fichier ; les critères
d'acceptation (chacun devient un `it`) ; les tests. Les `describe` portent l'identifiant de
l'exigence (`describe('PRE-05 — L'état des pièces dans le carnet', …)`).

### 5.1 Paquet 73a — Le socle : pièces, compteurs, correspondances, mots

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `packages/db/src/schema/vendors.ts` (`vendorDocumentKinds:260`), `packages/db/drizzle/0234_…` | Nature : libellé, « expire », clé de départ | `short_label`, `requested_by_default` (§ 4.1) |
| `packages/db/src/schema/events.ts` (`eventVendorCandidates:299`), `packages/db/drizzle/0235_…` | Pas de date de rétention | `retained_at` (§ 4.1) |
| `packages/starter-templates/src/vendor-document-kinds.json`, `modules/vendors/records.ts` (pose des natures de départ) | Libellé et « expire » | `shortLabel` (`fr` « Assurance », « Kbis », « Plan », « Autre » ; `en` « Insurance », « Registration », « Plan », « Other ») et `requestedByDefault` (assurance et Kbis), posés avec les natures à la création d'une organisation (aucune reprise des organisations existantes, P6) ; test des modèles mis à jour |
| `modules/vendors/documents.ts` | `documentAlert` par pièce | `documentState` (fonction pure, § 4.2) |
| `modules/vendors/records.ts`, `repository.ts`, `records-repository.ts` | État calculé pour la fiche et les avis d'« Aujourd'hui » | `summarizeVendorDocuments`, `requestUsualVendorDocuments` ; une lecture pour toute la liste |
| `modules/vendors/service.ts` (`findVendors:776`, `getVendorHistory:817`) | Filtres sans pièces ; tri nom ou distance ; 200 fiches ; « Prix final » de la dernière ligne du poste | Filtre et tri du § 4.2 ; 500 fiches ; montant du poste juste (P9) |
| `modules/vendors/type-proposal.ts` (nouveau) | — | `proposeVendorTypeFromName` |
| `modules/events/vendor-slot-match.ts` (nouveau), `modules/events/service.ts` | Aucune correspondance poste ↔ métier (hors import, `event-vendors-import-rules.ts:34`) | `matchSlotToVendorType` ; `addVendorToEventSlot` (`compare`, `retain`, `replace`, `retain_also`, P12), `undoVendorAddition`, `listEventsForVendorAddition`, `undoVendorReminder` ; `retained_at` ; `listUncontractedVendors` daté par `retained_at` |
| `app/prestataires/[id]/page.tsx`, `fr` (`historyFinal`, `historyQuoted`) | « Prix réel », « Prix final » | Inchangé à l'écran dans ce paquet (la forme vient au 73d) ; seul le nombre devient juste |
| `fr` (`Events.vendorStatusShortlisted`, `VendorCandidates.status.shortlisted`, `BudgetVendors.compare…`) | « Pressenti », « Comparer » | « En comparaison », « Mettre en comparaison » partout où le mot s'affiche (V7, P2) ; les textes anglais « Shortlisted » → « Comparing » ; « Retenu, contrat non signé » pour un retenu sans contrat signé (P5) |

**Critères d'acceptation**

1. L'état résumé des pièces d'une fiche suit l'ordre `expired` > `expiring` > `requested` >
   `to_verify` > `up_to_date` > `none_requested` ; horloge simulée : veille de la fin, jour de la fin
   (encore valable), lendemain (expirée), trentième et trente et unième jour avant la fin, délai
   d'alerte réglé à 15 jours, passage à l'heure d'été.
2. Une pièce valable dans le délai d'alerte mais qui finit **avant un mariage où le prestataire est
   retenu** est `expiring`, avec la raison « avant le mariage de {mariés} » (ou « avant un mariage »
   quand l'utilisatrice n'a pas accès à ce mariage).
3. Une fiche sans aucune pièce, ou dont aucune pièce n'est demandée, est « Aucune pièce demandée »,
   jamais « À jour ».
4. Le filtre « Pièces à régler » rend les fiches `expired`, `expiring`, `requested`, `to_verify`,
   triées dans cet ordre puis par date ; le compte « 5 fiches sur 48 » est juste.
5. Le tri par « Avec vous » range par nombre de mariages faits ensemble (retenus), puis par nom ; le
   tri par nom, métier, évaluation et distance est fait par la base.
6. `proposeVendorTypeFromName` : « Belle Époque Traiteur » → Traiteur (mot « Traiteur ») ;
   « Calèches du Marais » → le métier dont un synonyme est « Calèche » (pluriel compris) ; « Bulles &
   Cie » → rien ; un mot dans un autre mot (« Domaines » dans « Condominium ») ne compte pas ; aucun
   enregistrement.
7. `matchSlotToVendorType` : le poste de départ « Traiteur » donne le métier « Traiteur » ; « Fleurs
   et décoration » donne la famille du même nom ; un poste créé à la main sans correspondance ne donne
   rien (la fenêtre demande alors de choisir).
8. `addVendorToEventSlot` en `compare` crée une ligne « en comparaison » par fiche, sans doublon ; en
   `retain`, la ligne de budget est engagée au montant du devis (règle actuelle) et l'événement
   `events.vendor_slot.booked` part dans la transaction ; au-delà du seuil, l'appelant reçoit la
   question « Retenir quand même ? » (règle actuelle) ; sur un poste déjà pourvu, `retain` est refusé
   sans choix, `replace` fait repasser l'ancien retenu en comparaison, `retain_also` garde les deux
   retenus (P12).
9. `undoVendorAddition` dans les dix secondes rend l'état d'avant, retenu compris (la ligne de budget
   n'est plus engagée).
10. `retained_at` est posé quand un prestataire devient retenu, effacé quand il ne l'est plus ;
    « retenu le … » lit cette date et ne bouge pas quand on modifie ensuite le prestataire.
11. Le « Montant » d'un mariage dans l'historique d'une fiche est la somme des lignes du poste
    (reproduction du cas de C-48 : un poste à deux lignes, 9 000,00 € et 600,00 € engagés, rend
    9 600,00 €).
12. Une organisation créée après ce paquet a l'assurance et le Kbis « demandés d'habitude », avec
    leur nom court ; les migrations 0234 et 0235 et leur retour arrière passent sur une base vide.

**Tests**

- Unitaires : `documents.test.ts` (critères 1 à 3, horloge simulée) ; `type-proposal.test.ts`
  (critère 6) ; `vendor-slot-match.test.ts` (critère 7) ; tri en mémoire.
- Intégration (base réelle) : `vendors-73a.integration.test.ts` (critères 4, 5, 11, 12) ;
  `vendor-addition-73a.integration.test.ts` (critères 8 à 10 ; publication et consommation de
  l'événement par le budget) ; migrations 0234 et 0235 et leur retour arrière (aucune étape de
  données à tester, P6).
- **Isolation et abus** (helpers de `packages/testing`) : l'organisation A ne lit ni l'état des pièces,
  ni les compteurs, ni les natures de B ; `addVendorToEventSlot` avec une fiche, un poste ou un
  évènement de B est refusé (message « inexistant ») et n'écrit rien, même si un seul identifiant du
  lot est de B ; une Planner restreinte ne voit pas les évènements hors de son équipe dans
  `listEventsForVendorAddition` et ne peut y ajouter ; `undoVendorAddition` et `undoVendorReminder`
  refusent un identifiant d'une autre organisation ou d'un autre utilisateur ; un lien de prestataire
  ne lit aucune de ces fonctions ; l'Admin ne lit aucune de ces tables.
- RGPD : test du registre (nouvelles colonnes) ; `export` et `erase` des deux modules couvrent
  `retained_at`.

### 5.2 Paquet 73b — Le carnet : ligne, filtres, tri, sélection, « À classer », vide (page 18)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après (page 18) |
| --- | --- | --- |
| `app/prestataires/page.tsx` (en-tête `:118-132`) | « Paramètres du carnet », « Importer », « Nouveau prestataire » | « Liste · Carte », « Sélectionner », « Nouveau prestataire » (seul bouton plein) et un menu « ⋯ » : « Reprendre et importer » (mot du lot 71, R18), « Exporter en CSV », « Exporter en PDF », puis la section « Réglages » : « Paramètres du carnet » (G14 du volet 6 ; si le lot 74 n'a pas encore posé la section, une entrée simple). Sous-titre : « 48 fiches · une seule par prestataire, réutilisée d'un mariage à l'autre » ; tout juste importé : « 48 fiches · 37 importées le 24 nov. de « carnet-prestataires.xlsx » » |
| Familles (`:157-185`) | « Tous », familles, « À classer » ; second rang « Toute la famille » | Pastilles comptées, inchangées dans leur rôle ; « Tous les métiers » au lieu de « Toute la famille » ; « À classer · 37 » seulement quand il y a des fiches à classer, à côté des familles (C-69) |
| Bandeau « à classer » (`:188-190`) | « N prestataires à classer : les voir · ranger les types » | La phrase d'état de la page 18, avec sa raison selon le cas (« Votre fichier n'avait pas de colonne « métier » » si un import l'explique, sinon « N fiches n'ont pas encore de métier ») et « Classer les N fiches », bouton plein de l'écran dans cet état (« Nouveau prestataire » passe en bouton simple) |
| Barre de filtres (`:195-335`) | Champs et listes, pastilles des filtres posés, « Effacer les filtres » | Mêmes filtres, libellés au-dessus : « Rechercher » (nom ou ville), « Où ? » (champ de 200 px) et « Rayon » (« à 30 km », actif seulement avec un lieu), **« Pièces »** (Toutes, À régler, À jour, Demandées, À vérifier, Expirées ou bientôt), « Avec vous » (Indifférent, Déjà travaillé ensemble), « Évaluation », « Étiquette » (rangée par groupe) ; les champs-filtres d'un métier s'ajoutent quand un métier est choisi (comme aujourd'hui) ; « Sur la carte : à placer » quitte la barre pour la vue « Carte » ; « 3 filtres : … × · Effacer les filtres » ; « Ce lieu n'a pas été trouvé… » reste sous « Où ? » ; une fiche proche hors du rayon est dite sous la liste (« Élodie Perrin Fleurs (Châtellerault, 34 km) n'apparaît pas : hors du rayon. Élargir à 50 km ») |
| Résultats (`:348-403`) | « N résultats » ; liste de liens ; aperçu latéral `?fiche=` (`HoverSync`) | **Tableau** : en-têtes Nom, Métier et ville, Avec vous, Évaluation, Pièces, chacun triant (`?tri=…&sens=…`), le tri dit en clair (« 48 fiches, par nom · Trier par : Nom ») ; ligne de 60 px : nom (lien en encre souligné de gris, **seule cible**, ouvre `/prestataires/<id>`), dessous contact et téléphone ; métier principal et ville (et le trajet quand un lieu est posé : « 2 km · ≈ 4 min ») ; « 4 mariages » ou « Jamais » ; « 4 sur 5 » ou « non noté » ; l'état des pièces (le nom court en tête, puis une tournure sans accord qui dit quoi faire, P3 : « ✓ À jour », « ◷ Assurance : expire le 15 déc. », « ! Assurance · à renouveler », « Kbis · à recevoir », « Kbis · à vérifier », « Aucune pièce demandée » ; liste complète au § 9) et sous lui la raison quand le filtre « Pièces » est posé ; action rapide « Ajouter à un mariage… » (73c) ; menu « ⋯ » : Ouvrir la fiche, Appeler (lien `tel:`), Écrire (lien `mailto:`), Modifier, puis à part « Archiver… » (niveau 1 : « Annuler » dix secondes). « Exemple » reste une étiquette de la ligne. **L'aperçu latéral et `HoverSync` disparaissent** (V3, « le menu latéral disparaît », Julien) ; pas de redirection de l'ancienne adresse `?fiche=<id>` (P6) |
| `app/prestataires/vendor-map.tsx`, vue « Carte » | Carte et liste côte à côte | La vue « Carte » montre la carte seule, avec « 3 à placer » et leur liste ; inchangée sinon (V2) |
| Sélection (nouveau, `app/prestataires/book-selection.tsx`) | Aucune | « Sélectionner » : une case par ligne en mode sélection seulement ; la **barre de sélection du volet 1** (composant de 70d) collée au bas, bordée d'encre : « N fiches sélectionnées », « Ajouter à un mariage… » (toutes en comparaison, 73c), « Ajouter une étiquette… », « Exporter… » (CSV ou PDF, de la sélection ou de toute la liste filtrée), « Archiver… » (niveau 2 : « Archiver 3 fiches ? Elles quittent le carnet, pas les mariages où elles sont. » ; « Garder les fiches » ; puis « Annuler » dix secondes), « Tout désélectionner », « Terminer la sélection » |
| `app/prestataires/classer/page.tsx` (nouveau) | Aucun écran ; il faut ouvrir chaque fiche ou passer par les Paramètres | **« Classer N fiches »** : « Un métier par fiche. Les propositions viennent du nom ; rien n'est enregistré avant « Enregistrer ». » ; « 31 proposées · 6 sans proposition · Afficher d'abord les 6 sans proposition » ; tableau Fiche, Ville (« non renseignée »), Métier (liste des métiers de l'organisation, la proposition choisie, « Choisir un métier » sinon, « Créer un métier » en bas de la liste), « D'où vient la proposition » (marque de provenance du volet 2 : « Proposé d'après « Traiteur » dans le nom », « Rien dans le nom ni le fichier ») ; « Sélectionner » et « Donner le métier… » ; **barre d'enregistrement** en bas (D7, volet 6) : « 31 métiers à enregistrer · 6 fiches resteront « À classer » : vous pourrez y revenir. » « Fermer » et « Enregistrer les 31 métiers » ; après, retour au carnet et message « 31 fiches classées · Revoir » : pas d'« Annuler » de tout le lot, mais « Revoir » rouvre l'écran « Classer » sur ces mêmes fiches, où chaque métier se change (P13 ; les identifiants passent à l'écran, jamais un nom dans l'adresse) |
| États vides (`:357-359`) | Trois textes ; filtres et carte « Fond de carte non installé » au-dessus d'un carnet vide | Carnet vide : le gabarit d'aujourd'hui (titre, phrase, exemple tiré de `fr`), « Nouveau prestataire » et « Reprendre votre carnet (tableur ou export) » (vers la ligne « Carnet » de la page de reprise du lot 71b ; tant qu'elle n'existe pas, vers l'import d'un carnet) ; ni filtres ni carte ; « Vous pourrez aussi en créer un depuis le budget d'un mariage » ; « Aide : le carnet ». Aucun résultat : « 0 fiche sur 48 avec ces filtres » et « Effacer les filtres » |
| Téléphone (375 px) | Liste coupée ; carte au-dessus | Une carte par fiche : nom, « métier · ville · N mariages », état des pièces, téléphone en lien de 44 px qui appelle ; familles qui défilent de côté sous la barre ; « Nom, contact… » et « Filtres » (le panneau du bas de 70f, qui finit par « Voir les N fiches ») ; menu « ⋯ » en panneau du bas ; barre du bas de D4 |

**Critères d'acceptation**

1. Une ligne du carnet a une seule cible (le nom, qui ouvre la fiche en un clic), une action rapide
   « Ajouter à un mariage… » et un menu ; « Archiver » n'est que dans le menu, à part.
2. La ligne montre le contact, le téléphone, le métier principal, la ville, le nombre de mariages faits
   ensemble, l'évaluation et l'état des pièces, chacun lisible sans la couleur (mot et forme) ; le
   rouge n'apparaît que pour une pièce à renouveler (expirée).
3. Chaque en-tête trie, dans les deux sens, et le tri est écrit au-dessus du tableau ; le tri et les
   filtres sont dans l'adresse (lien partageable, retour arrière).
4. Choisir une famille montre ses métiers en second rang ; « Pièces à régler » donne la liste et le
   compte du critère 4 du 73a, avec la raison sous l'état.
5. Chaque filtre posé est une pastille qui s'enlève ; « Effacer les filtres » les retire tous ; le
   compte dit « N fiches sur M ».
6. Un lieu posé trie par distance et écrit le trajet sur la ligne ; le rayon n'est actif qu'avec un
   lieu.
7. En sélection, « Ajouter une étiquette… » et « Archiver… » agissent sur les fiches choisies avec
   « Annuler » ; « Exporter… » de la sélection ne contient que les fiches choisies (vérifié dans le
   fichier), cellules neutralisées.
8. Un carnet dont 37 fiches sont « à classer » le dit en une phrase avec sa raison et met « Classer
   les 37 fiches » en bouton plein ; une fois tout classé, la phrase disparaît.
9. L'écran « Classer » propose un métier pour chaque fiche dont le nom le permet, dit d'où vient chaque
   proposition, n'enregistre rien avant « Enregistrer » et laisse « à classer » les fiches sans
   choix ; « Fermer » avec des choix faits demande « Fermer sans enregistrer ? » (forme du volet 1) ;
   après « Enregistrer », le message « 31 fiches classées · Revoir » rouvre l'écran sur ces 31 fiches,
   avec leur métier enregistré, et un métier changé là s'enregistre comme les autres.
10. Un carnet vide n'affiche ni filtres ni carte et propose « Nouveau prestataire » et « Reprendre
    votre carnet » ; une liste vide par les filtres dit « 0 fiche sur 48 avec ces filtres ».
11. À 375 px : aucune commande sous 44 px, aucun défilement de côté, le téléphone d'une fiche appelle
    d'un toucher.

**Tests** : Vitest (ligne, tri, pastilles, phrase d'état, propositions de l'écran « Classer ») ;
intégration (export de la sélection, archivage et étiquette en lot avec « Annuler », classement en
lot) ; Playwright `lot-73b-carnet.spec.ts` à 1 440 et 375 px, axe-core sur la ligne, la barre de
filtres, la barre de sélection, l'écran « Classer » ; navigation au clavier (Tab dans le tableau,
Entrée, Échap) ; tests existants mis à jour : `lot-11-prestataires.spec.ts`,
`lot-13-prestataires.spec.ts`, `l16-pre-14-15-familles.spec.ts`, `lot-63e-prestataires-metiers.spec.ts`,
`bud-09-10-pre-01-tva-export-carnet.spec.ts`, `imp-07-prestataires.spec.ts`, `filters.test.ts`.
Abus : `?tri=` et `?pieces=` inconnus ignorés sans erreur ; export `ids` d'une autre organisation
refusé ; classement en lot d'une fiche de B refusé.

### 5.3 Paquet 73c — Rattacher à un mariage (page 19)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après (page 19) |
| --- | --- | --- |
| `app/prestataires/add-to-event-dialog.tsx` (nouveau), `app/prestataires/actions.ts` | Aucun geste depuis le carnet ni la fiche | **Fenêtre courte** « Ajouter « {fiche} » à un mariage » (ou « Ajouter 3 fiches à un mariage ») : « Mariage » (les évènements à venir, demandes comprises, le plus proche d'abord, avec leur date ; « Les évènements à venir, demandes comprises ; le plus proche d'abord. ») ; « Poste du budget » (proposé d'après le métier principal : « Fleurs et décoration · 2 en comparaison · Proposé d'après le métier « Fleuriste ». Autre choix : un autre poste, ou « Nouveau poste » » ; sans correspondance, rien de choisi et « Nouveau poste « {métier} » » en tête) ; « Comment l'ajouter ? » : « En comparaison — Le poste reste à pourvoir : vous comparez les devis avec les N autres {métier au pluriel, ou « prestataires »} » ou « Retenu — Il pourvoit le poste ; le montant de son devis passe au réel du budget ; le contrat reste à faire signer » (le mot « engage » de la maquette est retiré, P14), **rien de coché** (M13) ; plusieurs fiches : « En comparaison » seulement, dit ; **poste déjà pourvu (P12)** : « Retenu » choisi, le pied de la fenêtre remplace « Ajouter au mariage » par deux boutons, « Remplacer {nom} » d'abord (bouton plein ; « {nom} repasse en comparaison ») et « Retenir aussi » ensuite, discret (bouton simple ; « Les deux seront retenus sur ce poste ») ; une pièce qui expire avant le mariage : « L'assurance de ce prestataire expire avant le 12 juin. » sous « Mariage » ; « Annuler » et « Ajouter au mariage ». Message de retour : « Ajouté à « Fleurs et décoration », en comparaison. Les Fleurs du Causse · Léa & Maxime · 3 en comparaison », « Annuler », « Ouvrir le poste ». Sur téléphone, la fenêtre en page, depuis le menu « ⋯ » de la carte |
| `app/events/[id]/vendor-choice.tsx` (menu « + Ajouter des prestataires ») | Menu étroit, noms coupés mot par mot ; « Comparer », « Retenir » ; la saisie précédente reste ; « Voir tout le carnet » ; « + Nouveau prestataire » | **Panneau de 700 px rattaché à la ligne du poste** (« Ajouter un prestataire à « {poste} » ») : recherche vide à chaque ouverture (« Chercher dans le carnet : nom, ville… ») ; en tête « Mettre en comparaison : le poste reste à pourvoir. Retenir : il pourvoit le poste. » ; « {Métier}s du carnet · N » d'abord (correspondance du 73a), chaque fiche avec « métier · ville · N mariages avec vous · évaluation » et l'état de ses pièces, puis « Mettre en comparaison » et « Retenir » (sur un poste déjà pourvu, « Retenir » demande sur place « Remplacer {nom} » ou « Retenir aussi », P12) ; une fiche déjà sur le poste dit « Dans la comparaison » ou « Retenu » au lieu de boutons grisés ; « Déjà travaillé ensemble » gardé (dans l'ordre) ; « Retenir quand même ? » gardé au-delà du seuil ; « Chercher dans tout le carnet (48 fiches) » ; « Nouveau prestataire » (le formulaire unique du 73d ; tant que 73d n'est pas fusionné, le formulaire actuel) ; après un ajout, le message de retour avec « Annuler », le panneau reste ouvert. Sur téléphone, le panneau en page (« ← Budget ») |
| `app/prestataires/selection.ts` (`:51-63`), `app/events/[id]/page.tsx` (`catalogHrefs`) | Depuis un poste, « Où ? » posé sur le lieu du mariage | Le carnet ouvert depuis un poste **filtre par le métier ou la famille du poste** (pastille nommée qui s'enlève), plus aucun lieu posé d'office ; bandeau « Pour le poste « {poste} » de {mariés} · choisissez un prestataire, ou plusieurs. » et « Revenir au mariage » ; l'action rapide de chaque ligne devient « Ajouter à ce poste… » (la fenêtre du carnet, mariage et poste déjà choisis) ; une fiche déjà sur le poste dit « Dans la comparaison » ; la sélection ajoute plusieurs fiches en comparaison |
| `app/prestataires/[id]/page.tsx` (en-tête) | « Modifier la fiche », « Archiver » | « Ajouter à un mariage… » (la même fenêtre) ; le reste au 73d |

**Critères d'acceptation**

1. Depuis une ligne du carnet, la fiche ou la sélection, « Ajouter à un mariage… » ouvre la même
   fenêtre ; « Ajouter au mariage » sans réponse à « Comment l'ajouter ? » écrit sous la question
   « Choisissez comment l'ajouter. » et n'envoie rien.
2. Le poste proposé est celui du métier principal quand la correspondance existe ; il reste un choix ;
   « Nouveau poste » crée le poste et y ajoute le prestataire dans la même opération.
3. « En comparaison » ajoute la fiche au poste sans le pourvoir ; « Retenu » pourvoit le poste et
   porte le montant du devis au réel du budget (la ligne est engagée en base, règle actuelle).
4. Sur un poste qui a déjà un retenu, « Retenu » offre « Remplacer {nom} » en premier et « Retenir
   aussi » en second, plus discret ; « Remplacer » fait repasser l'ancien en comparaison, « Retenir
   aussi » garde les deux retenus ; il en va de même depuis le panneau du poste (P12).
5. Le message de retour dit où le prestataire est allé ; « Annuler » dans les dix secondes défait
   l'ajout (le poste et le budget reviennent à l'état d'avant) ; « Ouvrir le poste » ouvre la fenêtre
   du poste.
6. Plusieurs fiches sélectionnées vont toutes en comparaison sur un même poste ; « Retenu » n'est pas
   proposé.
7. Le panneau du poste montre d'abord les fiches du métier avec leurs pièces, explique ses deux
   boutons, écrit « Dans la comparaison » pour une fiche déjà là, et sa recherche est vide à chaque
   ouverture.
8. « Chercher dans tout le carnet » ouvre le carnet filtré par le métier du poste, filtre nommé qui
   s'enlève ; aucun lieu n'est posé ; « Ajouter à ce poste… » y fait le même ajout.
9. À 375 px, la fenêtre et le panneau s'ouvrent en page, sans défilement de côté ni commande sous
   44 px ; aucun nom n'est coupé mot par mot à 1 280 et 1 366 px.

**Tests** : Vitest (fenêtre : état sans choix, plusieurs fiches, poste pourvu ; panneau : ordre,
« Dans la comparaison ») ; intégration (critères 2 à 6) ; Playwright `lot-73c-rattacher.spec.ts` à
1 440, 1 280 et 375 px, axe-core sur la fenêtre et le panneau ; tests mis à jour :
`bud-01-02-cinq-montants.spec.ts`, `lot-63c-evenements-budget-documents.spec.ts`,
`pre-03-04-09-bud-05-prestataires-par-lien.spec.ts`, `prd-bud-03-devis-joint.spec.ts`. Abus : ajouter
une fiche de B à un mariage de A, une fiche de A à un mariage de B, à un mariage annulé, ou à un poste
d'un autre mariage : refusé, rien écrit ; une Planner restreinte ne voit pas les mariages hors de son
équipe dans la fenêtre.

### 5.4 Paquet 73d — Créer une fiche, lire une fiche (page 20)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après (page 20) |
| --- | --- | --- |
| `app/prestataires/vendor-form.tsx`, `app/prestataires/nouveau/page.tsx`, `app/events/[id]/vendor-choice.tsx` (fenêtre de création) | Deux formulaires : quatre rubriques au carnet (le téléphone à la troisième, six réseaux avant le métier, « N° SIRET » sans explication, fenêtre « … : modifier » après création) ; quatre champs sans métier au poste, « Créer et retenir », « Créer et comparer » | **Un seul composant** (`app/prestataires/vendor-create-dialog.tsx`), fenêtre courte : « Nom * », « Métier * » (proposé d'après le poste depuis un poste : « Proposé d'après le poste « Transport ». » ; « Plusieurs métiers ? Ajoutez-en d'autres sur la fiche. » ; « À classer » reste le dernier choix explicite de la liste), « Contact », « Téléphone », « E-mail », « Ville » ; « Plus de détails : adresse, SIRET, site et réseaux, étiquettes, tarifs, note » ouvre en place (adresse, « N° SIRET — 14 chiffres, sur ses devis et factures », site et réseaux, étiquettes à palier, évaluation, tarifs indicatifs, note interne) ; « Tout se complète aussi plus tard, sur la fiche. » ; « * obligatoire » dit avant l'envoi ; erreurs sous le champ (70b) ; un nom proche d'une fiche existante est signalé sous le champ (« Une fiche « Calèches du Marais » existe à Niort. La voir », règle des doublons du volet 2 : fonction du 71d si fusionnée, sinon la même ressemblance de nom que l'import) ; depuis un poste, « Comment l'ajouter à « {poste} » ? » (« En comparaison », « Retenu », rien de coché) et « Créer et ajouter », « la fiche rejoint aussi le carnet » ; la recherche du panneau qui n'a rien trouvé préremplit le nom, et seulement le nom. Après « Créer la fiche », la fiche s'ouvre ; après « Créer et ajouter », le panneau du poste revient avec le message de retour. « Modifier » (menu de la fiche) ouvre la même fenêtre, complète, titrée « Modifier « {nom} » », plusieurs métiers et le principal compris. La page `/prestataires/nouveau` ouvre la fenêtre sur le carnet (adresse gardée pour les liens et « + Créer ») |
| `app/prestataires/[id]/page.tsx` | Deux clics (aperçu puis fiche) ; 3 830 px, neuf blocs, six boutons pleins ; « — » partout ; « Prix réel », « Prix final » | **En-tête en 200 px** : retour « Prestataires », nom, « Traiteur · Poitiers · 5 mariages avec vous · 4,8 sur 5 » et ses étiquettes ; contact cliquable (nom, téléphone `tel:`, e-mail `mailto:`, adresse) ; « Ajouter à un mariage… » (seul bouton plein) ; menu « ⋯ » : Modifier, « Chercher autour de {nom} », Archiver… (à part). **Alertes sous l'en-tête** : une pièce expirée ou à régler (« ! Attestation d'assurance · à renouveler : fin de validité le 31 oct. Maison Haddad est retenu sur 2 mariages à venir. Demander au prestataire », tournure du § 9, P3) ; un IBAN changé (« IBAN changé : à vérifier » et « J'ai vérifié par téléphone », règle actuelle de PRE-10) ; « Archivé » et les messages de géocodage gardés. **À gauche** : « Avec vous » (« Prix moyen : 9 150,00 € · Moyenne 4,8 sur 5, 3 évaluations » ; tableau Mariage (lien vers son poste), Poste, Où en est-on, Montant, Évaluation ; « Montant : ce qui est engagé sur le poste, ou le prix final une fois soldé. » ; « Le détail des évaluations » garde les trois critères et le lien de clôture) ; « Pièces » (chaque pièce, son fichier, son état et sa date ; « Ajouter une pièce », « Demander au prestataire » ; vérifier, date de fin, retirer, gardés). **À droite** : « Caractéristiques » (métiers et principal, tarifs, champs du métier, SIRET, site, réseaux, colonnes importées non reprises en lecture), « Paiement et fichiers » (IBAN masqué et son état, BIC, plaquettes et RIB, journal des changements), « Note interne » (cadenas et règle de la note confidentielle gardés), « Plans de salle » pour un lieu, le point sur la carte (réglé par « Modifier » ou la vue « Carte »). Chaque bloc a « Modifier » en lien, plus de bouton plein par bloc |
| Fiche neuve | « Métier — », « Évaluation — », « Aucune pièce pour l'instant. », « Ce prestataire n'a encore été consulté pour aucun évènement. » | « Pas encore de mariage ensemble. « Ajouter à un mariage… » le met en comparaison ou le retient sur un poste. » ; « Aucune pièce demandée. Votre agence demande d'habitude l'attestation d'assurance et le Kbis. » et « Demander l'assurance et le Kbis » (les natures `requested_by_default` ; sans réglage, « Demander une pièce… ») ; « Tarifs indicatifs non renseignés · Ajouter », « Évaluation pas encore notée : elle se donne après un mariage », « N° SIRET non renseigné · Ajouter », « Adresse non renseignée : la carte et les trajets en ont besoin · Ajouter », « E-mail non renseigné · Ajouter » |
| `app/prestataires/parametres/pieces/` (Paramètres du carnet › Pièces) | Délai d'alerte, natures (libellé, « expire ») | Deux réglages par nature : « Nom court » (modifiable, « Assurance » ; sans nom court, le libellé complet ; aucun genre grammatical enregistré, P3) et « Demandée d'habitude » (case, cochée d'office pour l'assurance et le Kbis de départ, P4), enregistrés seuls (D7) ; rien d'autre ne change sur l'écran (sa forme relève du volet 6, lot 74) |
| Téléphone (375 px) | Fiche en neuf blocs | En-tête court (nom, « métier · ville · N mariages », contact et « Ajouter à un mariage… »), alerte, puis « Avec vous » (une carte par mariage), « Pièces » (« 1 à régler »), les blocs de droite en dessous |

**Critères d'acceptation**

1. Le carnet et le poste ouvrent la même fenêtre de création, aux six champs dans cet ordre ; le
   métier est obligatoire (« À classer » choisi exprès est accepté) ; depuis un poste, le métier est
   proposé et « Comment l'ajouter ? » s'ajoute, sans réponse cochée.
2. « Plus de détails » ouvre en place tous les champs des quatre rubriques d'aujourd'hui ; rien n'est
   perdu (inventaire du § 3 bis de la note 10).
3. Envoyée vide, la fenêtre n'affiche aucune bulle du navigateur ; « Nom » et « Métier » ont leur
   message sous le champ ; la saisie reste.
4. Un nom proche d'une fiche du carnet est signalé sous le champ avec un lien vers elle ; la création
   reste possible.
5. Après « Créer la fiche », la fiche s'ouvre ; après « Créer et ajouter », la fiche est au carnet et
   sur le poste, avec le statut choisi.
6. Le nom d'une ligne du carnet ouvre la fiche en un clic ; l'en-tête tient en 200 px à 1 440 px et
   n'a qu'un bouton plein.
7. Une pièce à renouveler (expirée), ou une pièce qui expire avant un mariage où le prestataire est
   retenu, monte en alerte sous l'en-tête, avec les tournures du § 9 (P3), avec « Demander au prestataire » ; un IBAN changé y monte avec « J'ai vérifié
   par téléphone ».
8. « Avec vous » réunit les deux historiques : un mariage par ligne, son poste, où il en est, le
   montant juste (critère 11 du 73a), l'évaluation ; prix moyen et moyenne en tête ; le détail des
   évaluations reste accessible.
9. Une fiche neuve n'affiche aucun « — » : chaque valeur absente dit pourquoi ou quoi faire.
10. « Demander l'assurance et le Kbis » crée une demande pour chaque nature « demandée d'habitude »
    qui n'est ni demandée ni valable ; la demande paraît sur le lien du prestataire (lot 47) ; message
    de retour « 2 pièces demandées à {nom} » avec « Annuler ». La pièce demandée d'habitude ne dépend
    pas du métier (une suite possible, hors lot, P4).
11. Les fonctions de la fiche d'aujourd'hui sont toutes présentes (plans de salle d'un lieu, point
    sur la carte, note confidentielle, fichiers, journal de l'IBAN, « Chercher autour »).

**Tests** : Vitest (fenêtre : ordre des champs, « Plus de détails », depuis le poste ; fiche : valeurs
absentes) ; intégration (création depuis le poste avec statut, demande des pièces habituelles,
réglages des natures) ; Playwright `lot-73d-creer-lire.spec.ts` à 1 440 et 375 px, axe-core sur la
fenêtre (en erreur comprise) et la fiche ; tests mis à jour : `pre-05-06-10-sec-27-prestataires.spec.ts`,
`lot-11-prestataires.spec.ts`, `por-01-lien-prestataire.spec.ts`, `records.integration.test.ts`. Abus :
note confidentielle toujours refusée à qui n'y a pas droit ; demande de pièces pour une fiche de B
refusée ; un lien de prestataire ne voit ni la note, ni l'IBAN complet, ni les autres pièces que les
siennes demandées.

### 5.5 Paquet 73e — Le budget du mariage et la relance (page 21)

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après (page 21) |
| --- | --- | --- |
| `app/events/[id]/budget-vendors-table.tsx` (en-tête du tableau) | « N lignes pourvues sur M » ; totaux et « dont engagé » en bas | Ligne d'état : « 6 postes complets sur 9 · 1 contrat non signé · 1 pièce à renouveler · budget souhaité 40 000,00 € » (le compteur suit la décision I7 du lot 71 : **postes complets**) ; « Ajouter un poste » (action principale de l'onglet) ; menu « ⋯ » de l'onglet : « Détail du budget (simulation, HT, exports) », « Reprendre et importer », « Reprendre les prestataires retenus (PDF) » (parcours du 71e), « Paramètres des postes par défaut » ; **cinq totaux en tête, en mots** : « 34 600,00 € Prévu », « 31 200,00 € Réel, tout signé » quand tous les contrats des postes retenus sont signés, sinon « 31 200,00 € Réel · dont 27 000,00 € signés » (P14 : le mot « engagé » quitte l'écran ; « signés » = le réel des postes dont le contrat est signé ou le poste soldé), « +1 800,00 € Écart sur les 6 postes retenus », « 5 850,00 € Réglé », « 25 350,00 € Reste à payer » ; l'alerte de dépassement de l'enveloppe reste au-dessus, en bandeau « À vérifier : » (pas en rouge) |
| `budget-vendors-table.tsx` (lignes), `budget-vendor-rows.ts` | Poste, pastille de statut, pastille « Engagé », prestataires, « + Ajouter des prestataires » ; « À trouver » rouge ; trois pastilles vertes ; « Ouvrir », « Supprimer » ; nom du prestataire sans lien ; colonnes Écart et Reste à part | **Sept colonnes** : « Poste, prestataire et ses pièces » (le poste en lien qui ouvre la fenêtre du poste, gardée ; le prestataire retenu en lien vers sa fiche ; l'état en mots et forme : « ✓ Contrat signé », « Retenu, contrat non signé » (P5), « Retenu, contrat non renseigné » (prestataire repris d'un fichier qui ne le dit pas, P8), « 2 en comparaison · 1 devis reçu », « À trouver » neutre, « Non requis » ; dessous l'état de ses pièces et, pour un contrat non signé, « retenu le 18 nov. · aucune relance » ou « dernière relance : aujourd'hui, par e-mail · rappel le 28 nov. ») ; l'**action rapide** seulement quand il y a à faire (« Ajouter… » pour un poste à pourvoir, qui ouvre le panneau du 73c ; « Relancer… » pour un contrat non signé) ; Prévu ; Réel et l'écart dessous (« +600,00 € ») ; Réglé et « reste 9 600,00 € » dessous ; Prochaine échéance (« Acompte 2 880,00 € · ven. 27 nov. · dans 2 jours », « En retard » en rouge avec « ! », « Soldé » neutre) ; menu « ⋯ » : Ouvrir le poste, Documents du poste (devis, contrat, facture : un clic, BUD-04), Voir l'échéancier (déplié en place, « Marquer payée », « + Ajouter une échéance »), Changer de prestataire…, Ne plus retenir…, Non requis, puis à part Supprimer le poste… (poste vide seulement, comme aujourd'hui). **Le mot « engagé » quitte l'écran (P14)** : ni pastille ni mot sur la ligne, qui dit le réel et l'état du contrat en mots ; l'engagé reste calculé en base et présent dans les exports et le détail du budget ; la ligne de total garde Prévu, Réel, Réglé. Rien n'est coupé à 1 280 px. L'état du contrat repris par le 71e s'y lit déjà en mots, sans colonne (P8 : la spécification du lot 71 est amendée en ce sens par la session d'audit) |
| Téléphone (375 px) | Cellules libellées par `data-label`, sans montant lisible avant le lot 69 | **Une carte par poste**, sans défilement de côté : poste, prestataire (lien de 44 px), état et pièces, quatre montants libellés sur deux colonnes (Prévu, Réel, Réglé, Reste ; sans centimes quand ils sont ronds, sur téléphone seulement), la prochaine échéance, l'action rapide en bouton pleine largeur ; les totaux en deux nombres (« 31 200 € réels sur 34 600 € prévus », « 25 350 € reste à payer ») ; le poste en retard d'un paiement en tête, les autres dans l'ordre du budget |
| `app/ui/vendor-reminder-dialog.tsx` (nouveau ; remplace `app/accueil/note-reminder.tsx`), `app/accueil/actions.ts` (`vendorReminderDraftAction`, `noteReminderAction`) | « Noter une relance » depuis « Aujourd'hui », la Synthèse et la fenêtre du poste ; « Comment avez-vous relancé ? », premier canal coché ; message derrière un bouton ; « Copier le message » sans retour ; la ligne du budget ne change pas | **« Relancer… »** (V14) : fenêtre courte, titre « Relancer {prestataire} », sous-titre « Contrat du {poste} de {mariés}, non signé · retenu le {date} · aucune relance encore » (ou « Devis attendu » depuis la comparaison). **1 · Le joindre** : contact, téléphone en lien `tel:`, e-mail ; le message type **visible d'emblée** (dans ce paquet, le texte actuel de `vendorReminderDraftAction` ; au 73f, le modèle de l'agence, P10) ; « Copier le message » (« Message copié »), « Ouvrir dans ma messagerie » (lien `mailto:` avec l'objet et le message, comme `prepare-email-dialog.tsx`) ; « Symbola n'envoie rien : vous écrivez ou appelez vous-même. » **2 · Noter ce que vous avez fait** : « Comment ? » (Téléphone, E-mail, SMS, De vive voix) **rien de coché d'avance** ; copier le message ou ouvrir la messagerie choisit « E-mail », toucher le numéro choisit « Téléphone », avec « Choisi parce que vous avez copié le message. » ; « Le » (aujourd'hui par défaut, jamais dans l'avenir) ; « Me le rappeler » (2 jours, 3 jours par défaut, une semaine, deux semaines, pas de rappel) ; « Note (facultative) » ; « Annuler » et « Noter la relance » ; sans moyen choisi, l'erreur sous la question. Message de retour : « Relance de {prestataire} notée. Rappel le {date} sur « Aujourd'hui » », « Annuler » dix secondes. Sur téléphone, en page. **La même fenêtre pour toutes les agences**, même en « Symbola les envoie pour moi » (ADR 0110) : rien ne part de Symbola, aucun bouton d'envoi (P11) |
| `app/accueil/today-view.tsx`, `app/events/[id]/cockpit.tsx`, `app/events/[id]/slot-comparison.tsx` | « Noter une relance » | « Relancer… », la même fenêtre ; la forme de la ligne d'« Aujourd'hui » et de la Synthèse relève du lot 72 (§ 8) : ce paquet ne change que le bouton et sa fenêtre |
| `modules/events/service.ts` (`listUncontractedVendors`), `budget-vendor-rows.ts` | « Depuis » = `updatedAt` ; pas de relance sur la ligne | « retenu le » = `retained_at` ; la ligne lit la dernière relance (`listLastVendorReminders`) et se met à jour aussitôt après « Noter la relance » |

**Critères d'acceptation**

1. Une ligne de poste montre le poste (lien vers sa fenêtre), le prestataire retenu (lien vers sa
   fiche), son état en mots et ses pièces ; l'action rapide n'apparaît que pour un poste à pourvoir
   (« Ajouter… ») ou un contrat non signé (« Relancer… ») ; tout le reste est au menu.
2. « À trouver » n'est pas rouge ; le rouge ne sert qu'à une pièce à renouveler et à une échéance en
   retard, toujours avec son mot et « ! ».
3. Les totaux en tête redisent au centime les montants des lignes (prévu 34 600,00 €, réel
   31 200,00 €, réglé 5 850,00 €, reste 25 350,00 € sur le jeu de la maquette) ; l'écart ne compte que
   les postes qui ont un réel et le dit ; le réel dit « tout signé » quand tous les contrats des postes
   retenus sont signés, sinon « dont {montant} signés », au centime (P14).
4. Le menu d'une ligne ouvre les documents du poste en un clic (BUD-04), déplie l'échéancier en place,
   et « Supprimer le poste… » n'est offert que pour un poste vide.
5. À 1 280 et 1 366 px, aucune commande n'est coupée ; à 375 px, chaque poste est une carte à quatre
   montants libellés, sans défilement de côté, l'action rapide en bouton de 44 px.
6. « Relancer… » s'ouvre depuis la ligne du budget, « Aujourd'hui », la Synthèse et la fenêtre du
   poste, toujours la même fenêtre ; le message est visible sans clic ; « Copier le message » dit
   « Message copié » ; « Ouvrir dans ma messagerie » ouvre un lien `mailto:` et rien ne part de
   Symbola (aucun e-mail dans Mailpit), y compris pour une agence en « Symbola les envoie pour moi »
   (P11).
7. « Comment ? » n'a rien de coché à l'ouverture ; copier le message choisit « E-mail », toucher le
   téléphone choisit « Téléphone » ; le choix se change d'un clic ; sans choix, « Noter la relance »
   écrit l'erreur sous la question.
8. Après « Noter la relance », la ligne du budget dit « dernière relance : aujourd'hui, par e-mail ·
   rappel le 28 nov. » sans recharger la page ; le rappel paraît sur « Aujourd'hui » le jour dit
   (horloge simulée) ; « Annuler » dans les dix secondes retire la relance et sa note.
9. « retenu le … » dit la date où le prestataire a été retenu, et ne bouge pas quand on modifie
   le prestataire ensuite ; un retenu dont le contrat n'est pas signé se dit « Retenu, contrat non
   signé » (P5).
10. Le mot « engagé » ne paraît nulle part sur l'onglet (texte de la page, ordinateur et téléphone) ;
    une ligne dont le contrat est signé dit « Contrat signé » (SC-04 étape 5 lue ainsi, P14) ;
    l'export du budget garde la colonne de l'engagé.
11. Aucune fonction de la ligne d'aujourd'hui ne disparaît (liens Devis, Contrat, Facture ; échéancier ;
    « Marquer payée » ; « Soldé » ; « En retard » ; « Supprimer » d'un poste vide) — inventaire du § 3
    bis de la note 10.

**Tests** : Vitest (`budget-vendor-rows.test.ts` : états, action rapide selon le cas, totaux ;
fenêtre de relance : rien de coché, choix suivant le geste) ; intégration (relance notée et annulée ;
`retained_at`) ; Playwright `lot-73e-budget-relance.spec.ts` à 1 440, 1 280 et 375 px, axe-core sur le
tableau, les cartes et la fenêtre ; horloge simulée pour le rappel (veille, jour même) ; tests mis à
jour : `bud-01-02-cinq-montants.spec.ts`, `bud-03-lignes-echeances.spec.ts`,
`lot-63c-evenements-budget-documents.spec.ts`, `hub-08-sc-03-lundi-matin.spec.ts`,
`hub-14-lot-67e-prestataires-retenus.spec.ts`, `budget-vendor-rows.test.ts`. Abus : noter ou annuler
une relance sur un prestataire d'un autre évènement, d'une autre organisation, ou d'un évènement de
démonstration : refusé ; le lien de prestataire et l'espace des mariés ne voient jamais la relance
notée ni sa note ; aucun e-mail ne part.

### 5.6 Paquet 73f — Les modèles de relance (P10)

Décision de Julien du 27/11 (P10, l'autre voie) : « oui choisi l'évolution des modèles possibles », avec
son accord pour toucher `hub.message_templates`. Dernier paquet de code du lot.

**Écart, fichier par fichier**

| Fichier | Aujourd'hui | Après |
| --- | --- | --- |
| `packages/db/src/schema/hub.ts` (`messageTemplates:1136`), `packages/db/drizzle/0236_…` | Un modèle n'a qu'un nom ; rien ne le relie à un modèle de départ | `starter_key` et son index unique (§ 4.1) |
| `packages/starter-templates/src/message-templates.json` | Modèles de départ de la relation (première demande, rendez-vous, brochure…) | Deux de plus, en `fr` et `en` : `vendor_contract_reminder` « Relance d'un contrat » (objet « Contrat signé pour {{évènement}} » ; « Bonjour {{prénom}}, nous n'avons pas encore reçu le contrat signé pour {{mariés}}, le {{date_évènement}}. Pourriez-vous nous le retourner ? … {{organisation}} ») et `vendor_quote_reminder` « Relance d'un devis » ; textes à relire par Julien avec la PR |
| `packages/contracts/src/emails.ts` | Pas de variable pour le prestataire | `vendor` dans `EMAIL_VARIABLES` ; `VENDOR_REMINDER_VARIABLES` (`first_name`, `vendor`, `slot`, `clients`, `event_date`, `organization`) |
| `modules/hub/message-templates.ts` | `addStarterMessageTemplates` retrouve un modèle par son nom | Pose `starter_key` ; `messageTemplateByStarterKey` (§ 4.2) ; la variable `vendor` permise pour ces deux modèles seulement |
| Paramètres › Modèles de messages (écran du lot 38b) | Modèles de la relation | Les deux modèles de relance y paraissent, modifiables, versionnés et restaurables comme les autres ; « Revenir au texte de départ » remet le fichier de départ |
| `app/accueil/actions.ts` (`vendorReminderDraftAction`), `fr` (`Today.remind.*`) | Texte fixe de l'app | Le message de la fenêtre « Relancer… » vient de `vendorReminderMessage` (modèle de l'agence, sinon texte de départ) ; les textes `Today.remind.body` et `quoteBody` quittent `fr` |

**Critères d'acceptation**

1. Une organisation créée après ce paquet a « Relance d'un contrat » et « Relance d'un devis » dans
   Paramètres › Modèles de messages, dans sa langue.
2. La planner modifie « Relance d'un contrat » ; la fenêtre « Relancer… » d'un contrat non signé montre
   aussitôt son texte, rempli (prénom du contact, prestataire, poste, mariés, date, agence).
3. Un modèle renommé reste celui de la relance (clé de départ) ; un modèle supprimé laisse la fenêtre
   utiliser le texte de départ, sans erreur.
4. Une variable inconnue dans un modèle de relance est refusée à l'enregistrement ; une variable sans
   valeur (pas de contact) est dite dans la fenêtre, le message reste copiable.
5. Rien ne part de Symbola (P11) : la fenêtre ne fait que préparer.

**Tests** : unitaires (rendu des deux modèles, variables) ; intégration
(`message-templates.integration.test.ts` mis à jour : clé de départ, unicité, retour arrière de 0236) ;
Playwright (modifier le modèle, l'ouvrir dans « Relancer… », 1 440 et 375 px, axe-core). Abus : le
modèle de l'organisation B ne sert jamais à A ; un lien de prestataire ne lit aucun modèle.

### 5.7 Paquet 73g — Mots, aide, captures et rejeu

- **Lexique** (contrôle en cliquet du 70g) : retirer les exceptions de ce volet — « Pressenti »
  (P2), « Comparer » seul pour un prestataire, « Noter une relance » (V14), « Toute la famille »,
  « lignes pourvues », « Ouvrir la fiche complète », « Prix réel », « Prix final », « contrat
  attendu », et **« engagé » sur les écrans du budget et des prestataires** (P14 ; le mot reste dans
  les exports et le détail du budget) ; « famille » reste,
  **si S13 est tranché comme recommandé** (« Garder « famille » ») ; « poste » et « ligne du budget » :
  le volet 4 garde « poste » (« Poste du budget », « Ajouter un poste ») — à sortir de la liste des
  mots à retirer, comme « famille » (à confirmer avec S13, § 8, point 5).
- **Aide contextuelle** (`lib/help/screens.ts`, textes `Help.*`) : réécrire `vendorBook` (ligne,
  filtres, « Pièces à régler », tri, sélection, « Ajouter à un mariage… »), `vendorDetail` (en-tête,
  alertes, « Avec vous »), `vendorNew` (le formulaire unique), `vendorDocuments` (nom court, « demandée
  d'habitude ») ; ajouter l'aide de l'écran « Classer les fiches » ; mettre à jour l'aide du budget du
  mariage (sans « engagé », P14) et la réponse de l'aide sur la relance (`fr:619`, « Avec « Noter une
  relance »… »), qui cite les modèles de relance (P10).
- **Centre d'aide et captures** : `pnpm --filter @symbola/app help:captures` pour `vendorBook`,
  `vendorDetail`, `vendorNew`, `vendorTypes`, et la capture du budget ; relire les images dans la PR.
- **Visites guidées** (`lib/help/tours.ts`, `tours.json`) : étapes du carnet (« Une pastille par
  famille », l'aperçu qui disparaît) et du budget ; leur forme relève du volet 5 (lot 74).
- **Rejeu** (C4) : SC-04 « Un devis de traiteur dans le budget » (PAR-04, P0) et SC-05 « Trois
  fleuristes, un choix » (étape 3, la relance) sur le jeu fictif, plus le parcours PC-05 du panel
  (rattacher depuis le carnet, repérer une pièce manquante) ; comptes rendus `docs/recette/SC-04.md`
  et `SC-05.md` mis à jour.
- **`gap.csv`** : lignes PRE-01, PRE-02, PRE-05, PRE-10, PRE-11, BUD-01, BUD-03, BUD-04, HUB-21,
  UX-05, UX-13 mises à jour par le paquet qui les touche ; la ligne BUD-01 et la note de SC-04 disent
  l'écart de P14 (« la ligne passe à « engagé » » se lit « contrat signé »).

**Critère** : aucun mot retiré ne paraît sur les écrans du volet (Playwright, texte de la page) ;
chaque clé nouvelle a sa traduction anglaise (`scripts/check-messages.ts`).

---

## 6. Le découpage en paquets, et ce qui attend d'autres lots

### 6.1 L'ordre

| Paquet | Contenu | Dépend de | Migrations |
| --- | --- | --- | --- |
| **73a** Le socle | État des pièces, compteurs, tri, correspondance poste ↔ métier, proposition de métier, ajout à un mariage (service, avec « Remplacer » et « Retenir aussi »), montant juste, `retained_at`, natures de pièces (nom court, demandée d'habitude), mots « en comparaison » et « contrat non signé » | — | 0234, 0235 |
| **73b** Le carnet | Ligne, filtres, tri, sélection et lot, « À classer » et « Classer » (avec « Revoir »), état vide, téléphone | 73a ; **70c** (menu « ⋯ » de ligne), **70d** (barre de sélection), **70f** (panneau du bas) | — |
| **73c** Rattacher | « Ajouter à un mariage… » (« Remplacer » ou « Retenir aussi » sur un poste pourvu), panneau du poste, carnet ouvert depuis un poste | 73a, 73b | — |
| **73d** Créer et lire | Formulaire unique, fiche, fiche neuve, deux réglages des pièces | 73a ; 73c (même fichier `vendor-choice.tsx`) ; **71d** pour le signalement des doublons (sinon la ressemblance de nom de l'import) | — |
| **73e** Budget et relance | Tableau à sept colonnes, totaux (« Réel, tout signé », sans « engagé »), menus, cartes du téléphone, « Relancer… » partout (texte actuel du message) | 73a, 73c (le panneau « Ajouter… ») ; **71e** (même tableau, P8) ; le lot 72 pour la forme de la ligne d'« Aujourd'hui » et de la Synthèse | — |
| **73f** Modèles de relance | « Relance d'un contrat » et « Relance d'un devis » modifiables dans Paramètres › Modèles de messages ; la fenêtre « Relancer… » part du modèle de l'agence (P10) | 73e | 0236 (schéma `hub`) |
| **73g** Mots, aide, rejeu | Lexique, aide, captures, rejeu SC-04 et SC-05, `gap.csv` | tous les autres ; **70g** fusionné (contrôle du lexique) | — |

Conduite proposée (règle « aller plus vite ») : 73a seul d'abord (il porte les migrations) ; puis 73b ;
puis 73c ; 73d et 73e en parallèle une fois 73c fusionné (fichiers distincts, sauf `vendor-choice.tsx`,
que 73d touche seul) ; 73f après 73e ; 73g en dernier. Si Julien préfère moins de PR, 73c et 73d
peuvent n'en faire qu'une, et 73f peut rejoindre 73e.

### 6.2 Ce qui dépend des lots 70 et 71, pas encore fusionnés

| Paquet | État au 27/11 (soir) | Ce que ce lot en attend | Mêmes fichiers |
| --- | --- | --- | --- |
| 70a Données des tâches | Fusionné (PR #190) | — | — |
| 70b Retour, danger, erreur | Fusionné (PR #189) | Le message de retour et « Annuler », les niveaux de danger (« Archiver… » en lot), l'erreur sous le champ | — |
| 70c Ligne type et panneau | Fusionné (PR #199) | Le **menu « ⋯ »** de ligne (composant, ordre, danger en dernier) et la forme du titre-lien, repris par le carnet | Aucun fichier du carnet ; `globals.css` (styles de ligne) |
| 70d Écran « Tâches » | Fusionné (PR #201) ; correctif NFR-02 en PR #204 | La **barre de sélection** (M2), reprise par le carnet | `app/ui/selection-bar.tsx` (à créer par le premier des deux) |
| 70e Barre du haut et « + Créer » | Fusionné (PR #196) | « + Créer › Prestataire » ouvre la fenêtre du 73d | `app/creation-rapide/` |
| 70f Le téléphone | PR #203 ouverte | Le **panneau du bas** (filtres, menu « ⋯ » sur téléphone) et la barre du bas | `app/ui/bottom-sheet.tsx` |
| 70g Lexique | Pas commencé | Le contrôle en cliquet dont 73g retire les exceptions | `lexique-exceptions.json` |
| 71b Page de reprise | Pas commencé (71a fusionné, PR #200) | « Reprendre votre carnet » mène à la ligne « Carnet » de la page de reprise | — |
| 71d Doublons | Pas commencé | Le signalement d'un doublon sous le nom (73d) ; la fonction de rangement des postes, partagée avec `matchSlotToVendorType` (73a) | `lib/import/matching.ts`, `modules/events/event-vendors-import-rules.ts` |
| **71e** Prestataires retenus et programme | Pas commencé ; spécification amendée (PR #205) | Les prestataires retenus repris d'un PDF arrivent sur les postes ; **l'état de leur contrat en mots sous le nom, sans colonne** (« Contrat signé », « contrat non signé », « contrat non renseigné », P8) et « non renseigné » | **`budget-vendors-table.tsx`, `budget-vendor-rows.ts`** (P8) |
| 71f Fiche d'un mariage repris | Pas commencé | Le bandeau « À compléter : … de réel selon votre fichier » de l'onglet (mot amendé par la PR #205, P14) garde sa place au-dessus des totaux | `budget-vendors-table.tsx` (en-tête de l'onglet) |

### 6.3 Ce qui dépend des volets pas encore réalisés

| Ce qui attend | Volet (lot) | Ce que fait ce lot en attendant |
| --- | --- | --- |
| L'en-tête de la fiche d'un mariage en 200 px, la frise et les onglets comptés (« Budget et prestataires 6 sur 9 ») | 3, Évènements (lot 72) | L'onglet garde l'en-tête actuel ; seul son contenu change |
| La forme de la ligne d'une attente sur « Aujourd'hui » et de la Synthèse | 3, Aujourd'hui (lot 72) | Seul le bouton devient « Relancer… » et ouvre la fenêtre partagée (`app/ui/vendor-reminder-dialog.tsx`), que le lot 72 appelle s'il refait la ligne |
| La section « Réglages » du menu « ⋯ » (G14) et le sort du bouton « Réglages » (C-11) ; la forme de l'écran des Paramètres du carnet | 6, Paramètres (lot 74) | « Paramètres du carnet » au menu « ⋯ » du carnet ; deux réglages ajoutés à l'écran des pièces actuel |
| Les visites proposées et non imposées (D2), « Revoir la visite » sur « Nouveau prestataire » (C-06) | 5, Premiers pas et aide (lot 74) | Textes des étapes mis à jour, rien d'autre |
| La fenêtre du poste (cinq rubriques) alignée sur la fenêtre d'un objet à un seul « Enregistrer » (S9) | Design System, porte 4 | Non redessinée ; seule sa relance change |
| Les valeurs du bleu, de l'orange et du crème | Design System | Jetons actuels de `DESIGN.md` |
| Les contacts repris et leurs doublons (C-65, D11) | « Contacts », non maquetté | Rien |

---

## 7. Les décisions de Julien (P1 à P14, tranchées le 27/11/2026)

Posées une par une et tranchées par Julien le 27/11/2026 dans la session d'audit ; ses mots sont entre
guillemets quand ils ont été relayés. Celles qui touchent le cahier des charges sont aussi dans
`docs/QUESTIONS.md` (Q50). **Aucun point juridique ou tarifaire** n'est en jeu dans ce lot.

| # | Question | Décision | Ce qu'elle change dans ce fichier |
| --- | --- | --- | --- |
| P1 | Les choix V1 à V14, retenus par défaut, sont-ils validés ? | **Confirmés tels que la maquette les propose** : « V3 Oui le menu latéral disparait : elle n'a pas d'habitude : on est pas encore en MVP », « V10 La maquette est bonne : métier obligatoire », « V7 et V14 OK » | La mention « par défaut » quitte les critères (§ 0) |
| P2 | « Pressenti » ne s'affiche plus (V7, contre le mot de PRE-02) | **La proposition** : « en comparaison » à l'écran, « Mettre en comparaison » pour le bouton, `shortlisted` gardé en base ; un ADR consigne l'écart avec PRE-02 | 73a (mots) ; ADR au § 8 |
| P3 | Les mots d'une pièce dans une ligne (nom court, accord du français) | **Ni la proposition ni la maquette** : le nom de la pièce en tête, puis une tournure qui ne s'accorde pas et dit quoi faire (« Assurance · à renouveler », « Kbis · à recevoir », « Kbis · à vérifier ») ; « Assurance : expire le 15 déc. » reste ; un nom court par nature, modifiable ; **aucun genre enregistré** | Migration 0234 (nom court) ; liste complète des tournures en français et en anglais au § 9 ; 73b, 73d |
| P4 | Les pièces « demandées d'habitude » | **La proposition** : une case « Demandée d'habitude » par nature, cochée d'office pour l'assurance et le Kbis de départ. Une pièce habituelle selon le métier est une suite possible, **hors lot** | Migration 0234 ; 73d |
| P5 | « Contrat à envoyer » et « contrat attendu » | **Un seul état, avec un autre mot** : « Retenu, contrat non signé », avec « Relancer… » ; pas de date d'envoi, pas de geste « J'ai envoyé le contrat », **pas de migration 0236 pour cela** | 73a, 73e ; tous les « contrat attendu » deviennent « contrat non signé » |
| P6 | « Attendu depuis » pour les prestataires déjà retenus | **La proposition, ne rien reconstruire**, et une règle pour tout le lot : « on a pas encore sorti un MVP : rien n'est en prod -> il ne faut pas perdre de temps sur les considération des données déjà enregistrées à ce stade du projet : on supprimera pour repartir de zero en staging si besoin » | Aucune étape de données dans 0234 à 0236 ; plus de redirection de l'ancienne adresse `?fiche=` ; critères de reprise retirés (73a, 73b) |
| P7 | Comment savoir quel poste va avec quel métier | **La proposition** : une correspondance calculée, sans réglage | 73a (`matchSlotToVendorType`) |
| P8 | Le tableau du budget touché par le 71e (colonne « Contrat ») | **La proposition** : le 71e est amendé, l'état du contrat repris s'écrit en mots sous le prestataire, sans colonne, avec les mots de P5 (« Contrat signé », « contrat non signé », « contrat non renseigné ») ; la session d'audit fait corriger la spécification du lot 71 (PR #205) | 73e ; § 6.2 |
| P9 | Le « Montant » d'un mariage sur la fiche | **La proposition** : le réel du poste ; soldé, le total réglé ; non retenu, « devis 9 800,00 € » | 73a, 73d |
| P10 | Le texte du message de relance | **L'autre voie**, avec l'accord de Julien pour toucher `hub.message_templates` : des modèles modifiables dans Paramètres › Modèles de messages, « Relance d'un contrat » et « Relance d'un devis » ; « oui choisi l'évolution des modèles possibles » | Nouveau paquet 73f, dernier paquet de code ; migration 0236 (schéma `hub`) ; textes de départ dans `message-templates.json` |
| P11 | « Relancer… » pour une agence en « Symbola les envoie pour moi » | **La proposition** : la même fenêtre pour toutes, rien ne part de Symbola, aucun bouton d'envoi (décision du 22/11) | 73e (critère 6) |
| P12 | « Retenu » sur un poste qui a déjà un retenu | **Ni la proposition ni la maquette telle quelle** : poste libre, la fenêtre de la maquette ; poste déjà pourvu, deux boutons, « Remplacer {nom} » en premier et « Retenir aussi » en second, discret. Julien pense que neuf fois sur dix la planner créera deux postes plutôt que deux retenus sur un poste : **à observer** | 73a (`replace`, `retain_also`), 73c |
| P13 | « Annuler » après « Enregistrer les 31 métiers » | **Pas d'« Annuler » de tout le lot**, mais le message « 31 fiches classées · Revoir », où « Revoir » rouvre l'écran « Classer » sur ces mêmes fiches | 73b |
| P14 | La pastille « Engagé » et le sous-total « dont engagé » (gardés le 21/11, Q42) | **Le mot « engagé » disparaît de l'écran** : rien sur la ligne (le réel, et l'état du contrat en mots) ; en tête, « Réel, tout signé » quand tous les contrats le sont, sinon « Réel · dont 27 000,00 € signés » (« réel dont x milliers signés Ok ») ; l'engagé reste calculé et présent dans les exports | 73e, 73g ; écart avec BUD-01 et SC-04 au § 8, dans `gap.csv` et Q50 |

**Points qui ne demandent pas de décision mais méritent d'être sus** :

- Le compteur de l'onglet suit la décision I7 du lot 71 (« 6 postes complets sur 9 ») et non le mot
  de la maquette (« 6 postes retenus sur 9 »), qui est plus ancien que cette décision.
- La maquette marque « Aucune reçue » pour des fiches tout juste importées et « Aucune demandée »
  ailleurs : ce lot écrit partout « Aucune pièce demandée » (la règle de la page 19, au féminin de
  « pièce », sans accord à la nature, P3).
- La limite de la liste du carnet passe de 200 à 500 fiches ; au-delà, l'écran le dit (§ 4.2).
- « Demander au prestataire » dépose la demande sur son lien (lot 47) ; s'il n'a encore de lien sur
  aucun mariage, la fenêtre le dit (« La demande l'attendra sur son lien, dès qu'il en aura un ») au
  lieu de laisser croire qu'il est prévenu.

---

## 8. Divergences avec le cahier des charges et avec `DESIGN.md`

**Aucun ADR n'est écrit dans cette PR.** Les écarts 1 et 3 sont des divergences acceptées avec le
cahier des charges (CLAUDE.md § 1) : **un seul ADR, « Les mots des prestataires et du budget »**, les
consigne, écrit au paquet 73a au **premier numéro libre au moment du code** (0119 et 0120 sont dans
`main`, 0121 est pris par le lot 72a, branche `lot-72a-regles-et-comptes` ; aucun numéro n'est réservé
ici, au mieux 0122 aujourd'hui).

1. **« Pressenti » remplacé à l'écran par « en comparaison » (PRE-02, V7, P2 tranchée)** : le cahier des
   charges nomme les statuts « Pressenti, Consulté, Devis reçu, Retenu, Contrat signé, Soldé » ; l'écran
   dit « en comparaison » (avec « devis reçu » en détail), « Retenu, contrat non signé » (P5),
   « Contrat signé », « Soldé ». Les valeurs en base ne changent pas. → ADR ci-dessus ; `gap.csv`
   (PRE-02) ; Q50.
2. **« Catégorie » (PRE-01, PRE-11) contre « famille » puis « métier »** : le cahier des charges dit
   « catégorie » ; l'app et la maquette disent « famille » et « métier ». Dépend de S13 (porte 4 du
   Design System, pas encore tranché ; recommandation « garder famille ») → `gap.csv`, sans ADR si
   S13 est tranché ainsi ; Q50.
3. **Le mot « engagé » quitte l'écran (BUD-01, SC-04 ; P14 tranchée, contre la décision du 21/11,
   Q42)** : BUD-01 veut un budget à cinq montants (estimé, devisé, engagé, payé, reste) ; SC-04 dit « la
   ligne passe à « engagé » ». L'écran montre Prévu, Réel, Réglé, Reste et, en tête, « Réel, tout
   signé » ou « Réel · dont 27 000,00 € signés » ; l'engagé reste calculé, en base et dans les exports.
   **SC-04 étape 5 se lit « la ligne dit « Contrat signé » »**. → **demande un ADR** (un montant
   exigé ne s'affiche plus et un scénario du § 17 change de mot) : le même ADR que le point 1 ;
   `gap.csv` (BUD-01, et la note de SC-04) ; Q50.
4. **`DESIGN.md`** : non réécrit. Deux exceptions de forme à faire voir à la porte 4, sans les
   trancher ici : la ligne d'un poste a **deux liens** (le poste et le prestataire), exception à « une
   ligne, une cible » que la maquette assume (P-11, les deux sens du lien) ; le panneau de 700 px
   rattaché à une ligne n'est pas un composant écrit (`DESIGN.md` connaît la fenêtre courte, la
   fenêtre d'un objet, le panneau latéral et le panneau du bas).
5. **S13 (« famille ») et le mot « poste »** : le contrôle du lexique du 70g tient « famille » et
   « poste » en exception « à retirer » ; ce volet les garde tous deux. → à confirmer avec S13 à la
   porte 4 ; sinon 73g retire « famille » partout (gros changement de textes, sans effet sur les
   données).

---

## 9. Textes (français et anglais)

Clés indicatives, regroupées par paquet. Le français est celui des maquettes ; l'anglais est proposé
ici (C1) et relu par Julien avec la PR de chaque paquet.

| Où | Français | Anglais |
| --- | --- | --- |
| En-tête du carnet | {n} fiches · une seule par prestataire, réutilisée d'un mariage à l'autre · {n} importées le {date} de « {fichier} » · Liste · Carte · Sélectionner · Nouveau prestataire · Reprendre et importer · Paramètres du carnet | {n} records · one per vendor, reused from one wedding to the next · {n} imported on {date} from "{file}" · List · Map · Select · New vendor · Import and take over · Vendor book settings |
| Familles | Tous · Tous les métiers · À classer | All · All trades · To sort |
| Filtres | Rechercher · Nom ou ville · Où ? · Ville ou adresse · Rayon · à {km} km · Pièces · Toutes · À régler · À jour · À recevoir · À vérifier · À renouveler ou bientôt · Avec vous · Indifférent · Déjà travaillé ensemble · Évaluation · Étiquette · {n} filtres · Effacer les filtres · Pièces à régler · {nom} ({ville}, {km} km) n'apparaît pas : hors du rayon. · Élargir à {km} km · Voir les {n} fiches | Search · Name or town · Where? · Town or address · Radius · within {km} km · Documents · All · To sort out · Up to date · Awaited · To check · To renew or soon · With you · Any · Worked together before · Rating · Tag · {n} filters · Clear filters · Documents to sort out · {name} ({town}, {km} km) isn't shown: outside the radius. · Widen to {km} km · Show {n} records |
| Tableau | Nom · Métier et ville · Avec vous · Évaluation · Pièces · {n} fiches sur {total}, par {tri} · Trier par : · du plus au moins · {n, plural, one {# mariage} other {# mariages}} · Jamais · {note} sur 5 · non noté · Les {n} premières : affinez avec les filtres. · 0 fiche sur {total} avec ces filtres | Name · Trade and town · With you · Rating · Documents · {n} of {total} records, by {sort} · Sort by: · most to least · {n, plural, one {# wedding} other {# weddings}} · Never · {rating} out of 5 · not rated · The first {n}: narrow with the filters. · 0 of {total} records with these filters |
| État des pièces : **à jour** (P3) | ✓ À jour | ✓ Up to date |
| État : **bientôt** (fin dans le délai d'alerte, ou avant un mariage où il est retenu) | ◷ {pièce} : expire le {date} · raison : avant le mariage de {mariés} · avant un mariage | ◷ {document}: expires on {date} · reason: before {couple}'s wedding · before a wedding |
| État : **à renouveler** (date de fin passée) | ! {pièce} · à renouveler · raison : fin de validité le {date} · retenu sur {n} mariages | ! {document} · to renew · reason: valid until {date} · booked for {n} weddings |
| État : **à recevoir** (demandée, pas encore reçue) | {pièce} · à recevoir · raison : demande du {date} · demande du {date}, sans réponse | {document} · awaited · reason: requested on {date} · requested on {date}, no answer |
| État : **à vérifier** (déposée par son lien) | {pièce} · à vérifier · raison : dépôt par son lien {quand} | {document} · to check · reason: uploaded via their link {when} |
| État : **aucune demandée** | Aucune pièce demandée | No document requested |
| Plusieurs pièces à régler | {état de la plus urgente} + {n} | {most urgent state} + {n} |
| Alerte de la fiche | ! {pièce, libellé complet} · à renouveler : fin de validité le {date}. {nom} est retenu sur {n} mariages à venir. · Demander au prestataire · ◷ {pièce} : expire le {date}, avant le mariage de {mariés}. | ! {document, full name} · to renew: valid until {date}. {name} is booked for {n} upcoming weddings. · Ask the vendor · ◷ {document}: expires on {date}, before {couple}'s wedding. |
| Bloc « Pièces » de la fiche | {pièce, libellé complet} · {fichier} · vérification du {date} (jamais « vérifié » ni « vérifiée » : pas d'accord, P3) · fin de validité le {date} · {n} à régler | {document, full name} · {file} · checked on {date} · valid until {date} · {n} to sort out |
| Menu de ligne | Ajouter à un mariage… · Ouvrir la fiche · Appeler · Écrire · Modifier · Archiver… · Ajouter à ce poste… · Dans la comparaison | Add to a wedding… · Open record · Call · Email · Edit · Archive… · Add to this item… · In the comparison |
| Sélection | {n} fiches sélectionnées · Ajouter une étiquette… · Exporter… · Archiver {n} fiches ? · Elles quittent le carnet, pas les mariages où elles sont. · Garder les fiches · Tout désélectionner · Terminer la sélection | {n} records selected · Add a tag… · Export… · Archive {n} records? · They leave the book, not the weddings they're on. · Keep the records · Deselect all · Done selecting |
| À classer | {n} fiches n'ont pas encore de métier. · Votre fichier n'avait pas de colonne « métier » ; tant qu'elles ne sont pas classées, les familles ci-dessous ne les montrent pas. Symbola propose un métier d'après le nom, que vous validez. · Classer les {n} fiches · Classer {n} fiches · Un métier par fiche. Les propositions viennent du nom ; rien n'est enregistré avant « Enregistrer ». · {n} proposées · {n} sans proposition · Afficher d'abord les {n} sans proposition · D'où vient la proposition · Proposé d'après « {mot} » dans le nom · Rien dans le nom ni le fichier · Choisir un métier · Créer un métier · Donner le métier… · {n} métiers à enregistrer · {n} fiches resteront « À classer » : vous pourrez y revenir. · Enregistrer les {n} métiers · {n} fiches classées | {n} records have no trade yet. · Your file had no "trade" column; until they're sorted, the families below don't show them. Symbola suggests a trade from the name, for you to confirm. · Sort the {n} records · Sort {n} records · One trade per record. Suggestions come from the name; nothing is saved before "Save". · {n} suggested · {n} without a suggestion · Show the {n} without a suggestion first · Where the suggestion comes from · Suggested from "{word}" in the name · Nothing in the name or the file · Choose a trade · Create a trade · Set the trade… · {n} trades to save · {n} records will stay "To sort": you can come back to them. · Save the {n} trades · {n} records sorted |
| Carnet vide | Votre carnet de prestataires · Une seule fiche par prestataire, réutilisée d'un mariage à l'autre : son métier, ses contacts, ses pièces et ce que vous avez fait ensemble. Exemple : « Maison Haddad, traiteur à Poitiers ». · Reprendre votre carnet (tableur ou export) · Vous pourrez aussi en créer un depuis le budget d'un mariage, sans quitter le mariage. · Aide : le carnet | Your vendor book · One record per vendor, reused from one wedding to the next: their trade, contacts, documents and what you've done together. Example: "Maison Haddad, caterer in Poitiers". · Import your book (spreadsheet or export) · You can also create one from a wedding's budget, without leaving it. · Help: the book |
| Ajouter à un mariage | Ajouter « {fiche} » à un mariage · Ajouter {n} fiches à un mariage · Mariage · Les évènements à venir, demandes comprises ; le plus proche d'abord. · Poste du budget · {n} en comparaison · Proposé d'après le métier « {métier} ». · Autre choix : un autre poste, ou « Nouveau poste ». · Nouveau poste « {métier} » · Comment l'ajouter ? · En comparaison · Le poste reste à pourvoir : vous comparez les devis avec les {n} autres. · Retenu · Il pourvoit le poste ; le montant de son devis passe au réel du budget ; le contrat reste à faire signer. · Remplacer {nom} · Retenir aussi · Les deux seront retenus sur ce poste. · {nom} repasse en comparaison. · Choisissez comment l'ajouter. · {pièce} de ce prestataire : expire le {date}, avant le mariage. · Ajouter au mariage · Ajouté à « {poste} », en comparaison. · Retenu sur « {poste} ». · Ouvrir le poste | Add "{record}" to a wedding · Add {n} records to a wedding · Wedding · Upcoming events, enquiries included; soonest first. · Budget item · {n} being compared · Suggested from the trade "{trade}". · Or another item, or "New item". · New item "{trade}" · How to add it? · To compare · The item stays open: you compare quotes with the {n} others. · Booked · It fills the item; its quote amount goes to the budget's actual; the contract still needs signing. · Replace {name} · Book as well · Both will be booked on this item. · {name} goes back to the comparison. · Choose how to add it. · This vendor's {document}: expires on {date}, before the wedding. · Add to the wedding · Added to "{item}", to compare. · Booked for "{item}". · Open the item |
| Panneau du poste | Ajouter un prestataire à « {poste} » · Chercher dans le carnet : nom, ville… · Mettre en comparaison : le poste reste à pourvoir. Retenir : il pourvoit le poste. · {métier} du carnet · {n} · Mettre en comparaison · Retenir · Chercher dans tout le carnet ({n} fiches) · Pour le poste « {poste} » de {mariés} · choisissez un prestataire, ou plusieurs. · Revenir au mariage | Add a vendor to "{item}" · Search the book: name, town… · Compare: the item stays open. Book: it fills the item. · {trade} in the book · {n} · Compare · Book · Search the whole book ({n} records) · For the "{item}" item of {couple} · choose one vendor, or several. · Back to the wedding |
| Création | Nouveau prestataire · Nom · Métier · Plusieurs métiers ? Ajoutez-en d'autres sur la fiche. · Proposé d'après le poste « {poste} ». · Contact · Téléphone · E-mail · Ville · Plus de détails : adresse, SIRET, site et réseaux, étiquettes, tarifs, note · Tout se complète aussi plus tard, sur la fiche. · 14 chiffres, sur ses devis et factures · * obligatoire · la fiche rejoint aussi le carnet · Comment l'ajouter à « {poste} » ? · Créer la fiche · Créer et ajouter · Modifier « {nom} » · Une fiche « {nom} » existe à {ville}. · La voir | New vendor · Name · Trade · Several trades? Add more on the record. · Suggested from the item "{item}". · Contact · Phone · Email · Town · More details: address, SIRET, website and social, tags, prices, note · Everything can also be filled in later, on the record. · 14 digits, on their quotes and invoices · * required · the record also joins the book · How to add it to "{item}"? · Create record · Create and add · Edit "{name}" · A record "{name}" exists in {town}. · See it |
| Fiche | {métier} · {ville} · {n} mariages avec vous · {note} sur 5 · Avec vous · Prix moyen : {montant} · Moyenne {note} sur 5, {n} évaluations · Mariage · Poste · Où en est-on · Montant · Évaluation · Montant : ce qui est engagé sur le poste, ou le prix final une fois soldé. · Le détail des évaluations · après le jour J · devis {montant} · Non retenu · Pièces · Ajouter une pièce · Demander au prestataire · la demande arrive sur son lien de prestataire · La demande l'attendra sur son lien, dès qu'il en aura un. · Caractéristiques · Paiement et fichiers · Note interne · Chercher autour de {nom} · · IBAN changé : à vérifier | {trade} · {town} · {n} weddings with you · {rating} out of 5 · With you · Average price: {amount} · Average {rating} out of 5, {n} reviews · Wedding · Item · Where it stands · Amount · Rating · Amount: what's committed on the item, or the final price once paid off. · Rating details · after the big day · quote {amount} · Not booked · Documents · Add a document · Ask the vendor · the request reaches their vendor link · The request will wait on their link, as soon as they have one. · Details · Payment and files · Internal note · Search around {name} · · IBAN changed: to check |
| Fiche neuve | Pas encore de mariage ensemble. « Ajouter à un mariage… » le met en comparaison ou le retient sur un poste. · Aucune pièce demandée. Votre agence demande d'habitude {pièces}. · Demander {pièces} · Demander une pièce… · {champ} non renseigné · Ajouter · Évaluation pas encore notée : elle se donne après un mariage · Adresse non renseignée : la carte et les trajets en ont besoin · {n} pièces demandées à {nom} | No wedding together yet. "Add to a wedding…" puts them in a comparison or books them on an item. · No document requested. Your business usually asks for {documents}. · Request {documents} · Request a document… · {field} not provided · Add · Not rated yet: ratings come after a wedding · Address not provided: the map and travel times need it · {n} documents requested from {name} |
| Paramètres des pièces | Nom court · Par exemple : Assurance · Sans nom court, le libellé complet s'affiche. · Demandée d'habitude · Proposée en un bouton sur une fiche neuve. · Enregistré | Short name · For example: Insurance · Without a short name, the full name is shown. · Usually requested · Offered as one button on a new record. · Saved |
| Budget | {n} postes complets sur {total} · {n} contrat non signé · {n} pièce à renouveler · budget souhaité {montant} · Ajouter un poste · Prévu · Réel, tout signé · Réel · dont {montant} signés · Écart sur les {n} postes retenus · Réglé · Reste à payer · Poste, prestataire et ses pièces · Retenu, contrat non signé · Retenu, contrat non renseigné · Contrat signé · {n} en comparaison · {n} devis reçu · À trouver · Non requis · retenu le {date} · aucune relance · dernière relance : {quand}, par {moyen} · rappel le {date} · reste {montant} · Ajouter… · Relancer… · Ouvrir le poste · Documents du poste · Voir l'échéancier · Changer de prestataire… · Ne plus retenir… · Supprimer le poste… · Détail du budget (simulation, HT, exports) · Reprendre les prestataires retenus (PDF) · Paramètres des postes par défaut · {montant} réels sur {montant} prévus · {montant} reste à payer | {n} complete items out of {total} · {n} unsigned contract · {n} document to renew · desired budget {amount} · Add an item · Planned · Actual, all signed · Actual · of which {amount} signed · Variance on the {n} booked items · Paid · Left to pay · Item, vendor and documents · Booked, contract not signed · Booked, contract not provided · Contract signed · {n} being compared · {n} quote received · To find · Not needed · booked on {date} · no follow-up · last follow-up: {when}, by {channel} · reminder on {date} · {amount} left · Add… · Follow up… · Open the item · Item documents · See the schedule · Change vendor… · Unbook… · Delete the item… · Budget details (simulation, excl. VAT, exports) · Import booked vendors (PDF) · Default item settings · {amount} actual out of {amount} planned · {amount} left to pay |
| Relance | Relancer… · Relancer {prestataire} · Contrat du {poste} de {mariés}, non signé · retenu le {date} · Devis attendu · aucune relance encore · Le joindre · Copier le message · Message copié · Ouvrir dans ma messagerie · Symbola n'envoie rien : vous écrivez ou appelez vous-même. · Noter ce que vous avez fait · Comment ? · Téléphone · E-mail · SMS · De vive voix · Choisi parce que vous avez copié le message. · Choisi parce que vous avez touché le numéro. · Choisissez comment vous l'avez relancé. · Le · Me le rappeler · Note (facultative) · Ce qu'il a répondu, ce qui est convenu… · Noter la relance · Relance de {prestataire} notée. · Rappel le {date} sur « Aujourd'hui » | Follow up… · Follow up with {vendor} · {item} contract for {couple}, not signed · booked on {date} · Quote awaited · no follow-up yet · Reach them · Copy the message · Message copied · Open in my email · Symbola sends nothing: you write or call yourself. · Note what you did · How? · Phone · Email · Text · In person · Chosen because you copied the message. · Chosen because you tapped the number. · Choose how you followed up. · On · Remind me · Note (optional) · What they said, what was agreed… · Note the follow-up · Follow-up with {vendor} noted. · Reminder on {date} in "Today" |
| Modèles de relance (73f, P10) | Relance d'un contrat · Relance d'un devis · {{prestataire}} (variable) · (textes de départ dans `message-templates.json`, à relire avec la PR) | Contract follow-up · Quote follow-up · {{vendor}} (variable) · (starter texts in `message-templates.json`) |

Textes **retirés** : `Events.vendorStatusShortlisted` et `VendorCandidates.status.shortlisted`
« Pressenti » (P2), `compare` et `compareOne` « Comparer », `Today.reminder.button` « Noter une
relance » (V14), `Today.remind.body` et `quoteBody` (devenus modèles, P10), tout « engagé » des
écrans du budget (P14), les rubriques du formulaire « Rubrique {n} sur 4 », « Ouvrir la fiche complète »
(aperçu), `historyQuoted` « Prix réel » et `historyFinal` « Prix final », `allFamilyCount` « Toute la
famille », `unclassifiedBanner` et `unclassifiedSort` (« ranger les types »), `notPlaced` sur la ligne,
« lignes pourvues », `engaged` (pastille « Engagé »), `open` et `removeSlot` sur la ligne du budget.

---

## 10. Chaîne de sécurité, rejeu et définition de « terminé »

- **Chaîne de sécurité** (SEC-30 à SEC-36) verte à chaque PR ; tests d'abus des § 5.1 à 5.5
  obligatoires (deux colonnes nouvelles, nouvelles routes et actions serveur, paramètres d'adresse
  `tri`, `sens`, `pieces`, `ids`).
- **Rejeu** (C4) : SC-04 et SC-05 sur le jeu fictif (`docs/recette/symbola-synthetic-users.json`),
  parcours PC-05 ; pas de recette sur le staging avant la fin de tous les lots de réalisation (décision
  de Julien du 27/11).
- **Terminé** (CLAUDE.md § 7) : chaque critère de ce fichier a son test ; SC-04 et SC-05 passent sans
  blocage ; la chaîne de sécurité est verte ; l'aide et les textes des écrans sont à jour (FR et EN) ;
  axe-core et 375 px sur chaque écran touché ; `gap.csv` à jour.
