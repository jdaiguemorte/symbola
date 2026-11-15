# Lot 36 — Le contact unique

**Statut** : spécification **validée par Julien le 15/11/2026** (« Oui, je valide » : D1 à D12
en (a)), ce qui vaut accord pour toucher les schémas `hub`, `events` et `quotes`.
Branche `lot-36-contacts` (36a), partie de `main` après le lot 35 (PR #118).

## Contexte

Le cahier des charges veut qu'une personne n'existe qu'une fois dans Symbola, quel que soit le
nombre d'apps, et qu'aucune information déjà connue ne soit redemandée. Il place le contact dans le
noyau du hub : « Personne, foyer ou entreprise. Coordonnées, consentements » (§ 10). Julien a
tranché Q17 : **une table de contacts dans le hub**.

| ID | Exigence | Critère | État (`docs/gap.csv`) |
| --- | --- | --- | --- |
| CRM-03 | Fiche contact unique pour personnes, foyers et entreprises, avec historique : messages, rendez-vous, documents, notes. | Un contact n'existe qu'une fois, quel que soit le nombre d'apps. | Absent : clients saisis par évènement, signataires recopiés |
| DAT-12 | Unicité : un contact par adresse e-mail et par organisation, un numéro de facture par entité et par série. | — | Partiel : numéros uniques ; pas d'entité contact |
| UX-02 | Zéro ressaisie. | Aucune information déjà connue n'est redemandée. Dans les scénarios SC-01 à SC-12, aucun champ n'est saisi deux fois. | Partiel |
| HUB-14 | Import de contacts, prestataires, invités et budgets depuis CSV ou XLSX : correspondance des colonnes, aperçu, détection des doublons, annulation. | Contacts et prestataires au MVP, le reste en V1. Un import s'annule en bloc. | Partiel : pas d'import de contacts |
| ARC-03 | Noyau partagé minimal dans le hub : organisation, utilisateur, contact, évènement (identité seule), fichier. | Toute entrée nouvelle dans le noyau passe par un ADR. | Partiel : ni contact ni fichier |

## Ce qui existe aujourd'hui

- **Clients d'un évènement** (`events.event_clients`, lots 1 et 14) : prénom, nom, e-mail,
  téléphone, adresse, ville, position. Ils sont saisis à chaque évènement : un couple qui revient
  pour un second évènement est ressaisi. Le repository des évènements les lit à 17 endroits ; ils
  servent aussi au portail, à la recherche, à l'import des fiches PDF, à l'export complet et au
  RGPD (recherche, effacement, purge de conservation).
- **Signataires d'un devis** (`quotes.quote_signers`) : nom et e-mail préremplis depuis les clients
  de l'évènement ; **l'adresse de facturation se ressaisit à chaque envoi en signature**, alors
  que la fiche du client a une adresse. Les signataires et les acheteurs des factures sont des
  copies figées, comme l'exige DAT-04.
- **Liens personnels** (`events.event_links`, lot 26) : nom et e-mail de la personne, recopiés ; un
  lien client pointe vers son client (`event_client_id`).
- **Carnet de prestataires** (`vendors.vendors`) : des entreprises, avec un nom de contact, un
  e-mail et un téléphone, et leurs champs propres.
- **Import** (lots 5, 14) : évènements, tâches, budgets, catalogue, prestataires, fiches PDF ; pas
  de contacts. Le scénario SC-10 importe 600 contacts, dont 48 doublons
  (`docs/recette/contacts-import-test-600.csv`), où clients et prestataires sont mêlés
  (colonne « Catégorie »).
- **Ce qui manque encore** : messages et rendez-vous n'existent pas (lots 38 et 46) ; la fusion de
  doublons hors import est CRM-07 (P1).

## Découpage (D1)

- **36a — Le contact unique** (CRM-03, DAT-12, UX-02, ARC-03) : la table des contacts dans le hub,
  la reprise des clients d'aujourd'hui, la liste et la fiche des contacts, l'évènement qui choisit
  ses clients parmi les contacts, les signataires préremplis jusqu'à l'adresse, le RGPD et
  l'export adaptés.
- **36b — Foyers, entreprises et import** (CRM-03, HUB-14) : regrouper des personnes en foyer,
  rattacher des personnes à une entreprise et porter ses identifiants (SIREN, TVA) jusqu'aux
  devis ; importer des contacts depuis un tableur, doublons signalés, annulation en bloc (SC-10).

## Lot 36a — Le contact unique

### Partie A — La table des contacts (ARC-03 ; D2, D3)

- **`hub.contacts`**, sous RLS, une ligne par contact :
  - nature : personne, foyer ou entreprise (les deux dernières prennent vie au 36b) ;
  - personne : prénom, nom ; foyer ou entreprise : un nom ;
  - coordonnées : e-mail, téléphone, adresse, code postal, ville, pays ;
  - marque d'essai (`is_demo`), auteur et dates de la ligne.
- **Unicité** (DAT-12) : une adresse e-mail n'appartient qu'à un contact de l'organisation
  (minuscules, espaces retirés ; index unique partiel). Un contact peut ne pas avoir d'e-mail.
- **Notes** (`hub.contact_notes`) : des notes datées, avec leur auteur, sur la fiche (CRM-03,
  « notes »).
- **Accès** : par la porte du hub (`service.ts`) ; les autres modules ne gardent que l'identifiant
  du contact, sans clé étrangère entre schémas (avenant de l'ADR 0012).
- **Un ADR** (ARC-03 : toute entrée nouvelle dans le noyau en demande un) : le contact dans le
  noyau, ce que gardent les modules, et les copies figées qui restent.

### Partie B — Les clients deviennent des contacts (D4, D5, D6)

- **`events.event_clients` devient le lien** entre l'évènement et ses contacts clients :
  évènement, contact, position. Les coordonnées n'y restent pas ; le module Évènements les
  demande au hub, par lot pour les listes.
- **La reprise des clients existants** (D6) :
  - un contact par client ;
  - deux clients de la même organisation avec la même adresse e-mail deviennent un seul contact ;
  - un client sans e-mail devient son propre contact (la fusion manuelle viendra avec CRM-07) ;
  - les liens personnels et les signataires qui pointent vers un client pointent vers son contact.
- **Copies figées qui restent** (D5) :
  - signataires d'un devis et acheteurs d'une facture (DAT-04 : modifier le contact ne change pas
    une pièce émise ni une preuve de signature) ;
  - nom et adresse d'envoi d'un lien personnel : ils disent à qui le lien a été envoyé.

  Toutes portent désormais l'identifiant du contact, et se préremplissent depuis lui.

### Partie C — La liste et la fiche des contacts (CRM-03 ; D7)

- **« Contacts »** dans le menu principal, pour toute l'équipe : recherche par nom, e-mail ou
  téléphone ; tri ; 375 px.
- **La fiche** :
  - l'identité et les coordonnées, modifiables ;
  - l'historique (D7) : les évènements où le contact est client (statut, date), ses devis et
    factures (numéro, statut, montant), les documents de ces évènements, ses notes ;
  - messages et rendez-vous : absents tant que leurs modules n'existent pas (ARC-07 : masqués,
    jamais en erreur).
- **La recherche globale** trouve aussi les contacts.

### Partie D — Zéro ressaisie (UX-02, DAT-12)

- **Créer un évènement** : le client se choisit parmi les contacts (recherche en tapant), ou se
  crée sur place. Une adresse e-mail déjà connue propose le contact existant au lieu d'en créer un
  second (DAT-12).
- **Envoyer en signature** : nom, e-mail **et adresse de facturation** préremplis depuis le contact ;
  une adresse saisie ou corrigée ici est proposée pour la fiche du contact (D8).
- **Créer un lien personnel** : nom et e-mail préremplis depuis le contact.
- **Modifier les coordonnées depuis l'évènement** : c'est la fiche du contact qui change, partout.

### Partie E — RGPD et export

- **Registre** (`privacy.registry.yaml`) : les champs personnels passent de `event_clients` à
  `hub.contacts` ; notes du contact déclarées.
- **`privacy/v1`** : le hub trouve, exporte, anonymise et efface les contacts ; les modules
  Évènements et Devis répondent pour ce qui s'y rattache (liens, copies figées), comme aujourd'hui.
- **Conservation** (RGP-05, ADR 0056) : un contact se purge selon la règle de ses évènements
  (prospect ou client, trois ans) ; un contact sans évènement suit la règle des prospects (D9).
- **Export complet** (lot 35, D10) : nouvelles entités `hub/contacts` et `hub/contact_notes` ;
  `events/event_clients` perd ses coordonnées.

## Lot 36b — Foyers, entreprises et import

### Partie F — Foyers et entreprises (CRM-03 ; D2)

- **Un foyer** regroupe des personnes (un couple, une famille) ; **une entreprise** rattache des
  personnes (interlocuteurs) et porte ses identifiants : SIREN ou SIRET, numéro de TVA, adresse de
  facturation.
- **Liens entre contacts** (`hub.contact_members`) : quel contact appartient à quel foyer ou à
  quelle entreprise, avec un rôle libre (« conjoint », « assistante de direction »).
- **Un évènement d'entreprise** a l'entreprise pour client ; ses identifiants se reportent sur le
  devis et la facture (SC-11 : « La facture porte le SIREN, le bon de commande et l'adresse de
  facturation »).

### Partie G — Importer des contacts (HUB-14 ; D11)

- **« Contacts »** devient une nature d'import, avec la mécanique existante : correspondance des
  colonnes, aperçu, rapprochements, annulation en bloc (ADR 0022).
- **Doublons** : une même adresse e-mail dans le fichier, ou déjà connue dans l'organisation, est
  signalée ; la personne choisit, ligne par ligne, de compléter le contact existant ou d'ignorer
  la ligne (DAT-12 : jamais deux contacts pour une adresse).
- **Fichier mêlé** (SC-10, colonne « Catégorie ») : D11.

## Décisions à prendre

- **D1 — Découpage.**
  - (a) Deux parties, deux PR : 36a contact unique, 36b foyers, entreprises et import.
  - (b) Une seule PR.

  **Recommandation : (a).** Le 36a change le schéma de trois modules et la reprise des données ; il
  se recette mieux seul.
- **D2 — Le foyer.**
  - (a) Un contact de nature « foyer », qui regroupe des personnes ; le client d'un mariage reste
    les deux personnes, le foyer les relie (et servira aux invités, INV-01).
  - (b) Le foyer comme simple nom commun, porté par chaque personne.

  **Recommandation : (a).** Le cahier des charges fait du foyer un contact (§ 10), et la liste
  d'invités regroupera par foyers.
- **D3 — Une adresse e-mail partagée** (un couple qui n'a qu'une boîte).
  - (a) Une adresse n'appartient qu'à un contact (DAT-12) : la seconde personne n'a pas d'e-mail,
    ou l'adresse est portée par le foyer (36b).
  - (b) Autoriser la même adresse sur deux personnes.

  **Recommandation : (a).** C'est la lettre de DAT-12, et un lien personnel vise une adresse. La
  saisie le dit clairement quand l'adresse est déjà prise.
- **D4 — Où vivent les coordonnées du client.**
  - (a) Seulement dans le contact ; `event_clients` ne garde que le lien et la position.
  - (b) Dans le contact, avec une copie dans `event_clients`.

  **Recommandation : (a).** Une copie, c'est deux contacts qui divergent : le critère de CRM-03 est
  « un contact n'existe qu'une fois ».
- **D5 — Les copies figées.**
  - (a) Signataires, acheteurs des pièces et liens personnels gardent leur copie, préremplie depuis
    le contact, avec l'identifiant du contact.
  - (b) Tout lire depuis le contact, sans copie.

  **Recommandation : (a).** DAT-04 l'impose pour les pièces ; une preuve de signature ne doit pas
  changer après coup.
- **D6 — La reprise des clients existants**, qui traverse deux schémas (`events` vers `hub`).
  - (a) Une migration SQL unique, atomique et annulable, avec une exception écrite à la règle « une
    migration ne touche que le schéma de son module » (DAT-09) dans l'ADR du contact.
  - (b) Trois temps : migrations du hub et des évènements, un script de reprise lancé entre les
    deux au déploiement, puis la migration qui retire les colonnes.

  **Recommandation : (a).** Une reprise atomique ne laisse jamais de clients à moitié repris, et
  s'annule d'un bloc ; le déploiement reste une seule étape, application arrêtée.
- **D7 — L'historique de la fiche.**
  - (a) Ce qui existe : évènements, devis et factures, documents de ces évènements, notes.
    Messages et rendez-vous viendront avec leurs modules.
  - (b) Seulement les évènements et les notes.

  **Recommandation : (a).**
- **D8 — Une adresse saisie à l'envoi en signature.**
  - (a) Proposée pour la fiche du contact (une case cochée par défaut).
  - (b) Toujours copiée dans la fiche.
  - (c) Jamais.

  **Recommandation : (a).** Elle évite la ressaisie la fois suivante, sans changer une fiche à
  l'insu de la planner.
- **D9 — La conservation d'un contact sans évènement** (créé à la main, ou importé).
  - (a) La règle des prospects : trois ans après sa dernière modification, avec préavis.
  - (b) Jamais purgé automatiquement.

  **Recommandation : (a)**, conforme à la durée validée par la DPO (réponse 6 : prospects trois
  ans).
- **D10 — Le format d'export `symbola.export/v1`** : `event_clients` perd des champs, ce qui
  devrait créer une v2 (ADR 0068).
  - (a) Changer la v1 sur place : aucune archive n'a encore quitté une machine de développement
    (gel des déploiements). L'ADR 0068 le note.
  - (b) Passer en v2 dès maintenant.

  **Recommandation : (a).** La règle de version protège des archives livrées ; il n'y en a pas
  encore.
- **D11 — Un fichier qui mêle clients et prestataires** (SC-10).
  - (a) Un import « Contacts » crée des contacts ; une colonne du fichier peut écarter des lignes
    (« ignorer les lignes dont Catégorie vaut Prestataire »), que la planner importe ensuite comme
    prestataires.
  - (b) Un seul import qui range chaque ligne dans les contacts ou dans le carnet selon une
    colonne.

  **Recommandation : (a).** Deux imports simples, chacun annulable en bloc.
- **D12 — Les prestataires du carnet.**
  - (a) Le carnet reste dans son module ; relier une fiche du carnet à un contact entreprise viendra
    plus tard. L'ADR du contact assume cet écart avec CRM-03.
  - (b) Les prestataires deviennent des contacts entreprise dès le 36b.

  **Recommandation : (a).** Le carnet a ses champs, ses filtres, sa carte et ses fichiers ; le
  fondre maintenant doublerait le lot. Une personne à la fois cliente et prestataire est rare.

## Migrations (prévision)

- **36a** :
  - `hub` : `contacts` et `contact_notes`, sous RLS, avec leur journal ;
  - `events` : `event_clients` reçoit l'identifiant du contact et perd ses coordonnées ;
    `event_links` reçoit l'identifiant du contact ;
  - `quotes` : `quote_signers` reçoit l'identifiant du contact ;
  - la reprise des clients existants (D6).
- **36b** : `hub.contact_members` ; identifiants d'entreprise sur `hub.contacts` ; nature d'import
  « contacts » (`hub.import_entity_type`).

Chacune a son script d'annulation et son test. La migration du 36a n'est pas compatible avec
l'image d'avant (elle retire les coordonnées de `event_clients`) : application arrêtée le temps de
la migration, comme 0132 et 0133. Gel des déploiements : elles partent avec le déploiement
d'ensemble.

## Fichiers touchés (prévision)

- `packages/db` : schémas `hub`, `events`, `quotes`, migrations, annulations, tests (isolation,
  annulation, reprise).
- `packages/contracts` : le contrat du contact ; `EventClient` lu depuis le contact.
- `apps/symbola/modules/hub` : contacts, notes, recherche, `privacy/v1`, export.
- `apps/symbola/modules/events` : clients par contact (repository, service, privacy, export,
  import des fiches PDF), liens personnels.
- `apps/symbola/modules/quotes` : signataires par contact, préremplissage de l'adresse.
- `apps/symbola/lib` : RGPD (recherche, effacement, purge), recherche globale, import (36b), jeu de
  recette.
- `apps/symbola/app` : `/contacts` (liste, fiche), création d'évènement, fiche de l'évènement,
  signature, liens, import (36b).
- `privacy.registry.yaml`, `packages/i18n` (FR, EN), aide des écrans, `docs/adr` (contact),
  `docs/export/format-v1.md` et `docs/schemas/export/v1`, `docs/gap.csv`.

## Tests

- **Chaque critère devient un `it`** sous son identifiant.
- **Unicité** (DAT-12) : deux contacts avec la même adresse (casse et espaces mis à part) sont
  refusés ; à la création d'un évènement, l'adresse connue propose le contact existant.
- **Reprise** : clients avec et sans e-mail, même adresse sur deux évènements (un contact), liens
  et signataires rattachés ; l'annulation rend les clients tels qu'ils étaient.
- **Zéro ressaisie** : le parcours SC-02 (devis puis signature) ne redemande ni le nom, ni
  l'e-mail, ni l'adresse.
- **Isolation et abus** : un contact d'une autre organisation n'est ni lu, ni choisi comme client,
  ni rattaché à un lien ; la fiche d'un contact inexistant répond comme un objet inexistant ; la
  recherche ne sort rien d'une autre organisation.
- **RGPD** : un contact se trouve, s'exporte, s'efface (copies figées gardées avec leur motif
  légal) ; la purge le propose à son échéance (horloge simulée, veille et jour même).
- **Playwright** : liste, fiche, création d'évènement avec un contact existant, signature
  préremplie ; ordinateur et 375 px, axe-core. 36b : import du fichier de 600 contacts (SC-10).
- **Rejeu** : SC-01 et SC-02 (zéro ressaisie) au 36a ; SC-10 au 36b. Résultats dans
  `docs/recette/`.

## Hors périmètre

- Fusion de doublons hors import (CRM-07, P1).
- Messages et rendez-vous dans l'historique (lots 38 et 46).
- Consentements (relances : lot 45, RGP-17).
- Champs personnalisés sur les contacts (HUB-25, P1).
- Prestataires du carnet devenus contacts (D12).
- Invités et foyers d'invités (module Invités, lot 49).

## Ambiguïtés relevées

- **« Un contact par adresse e-mail »** (DAT-12) ne dit rien d'une boîte partagée par un couple :
  D3.
- **« Historique : messages, rendez-vous, documents, notes »** (CRM-03) cite deux modules qui
  n'existent pas encore : D7.
- **« Un contact n'existe qu'une fois, quel que soit le nombre d'apps »** et le carnet de
  prestataires, qui a ses propres fiches d'entreprises : D12.
- **La règle de migration par module** (DAT-09) et une reprise qui traverse deux schémas : D6.

## Bilan du lot 36a (15/11/2026)

### Fait

- **Le contact dans le noyau** (ARC-03, ADR 0069) : `hub.contacts` (personne pour l'instant ; foyer
  et entreprise prévus au 36b) et `hub.contact_notes`, sous RLS, avec leur journal. Le service du
  hub crée, retrouve, modifie, cherche, anonymise et efface les contacts ; les autres modules n'en
  gardent que l'identifiant.
- **Unicité** (DAT-12) : une adresse e-mail n'appartient qu'à un contact de l'organisation (index
  unique partiel, adresse en minuscules et sans espaces). Saisie à la création d'un évènement,
  elle reprend le contact qui la porte ; ailleurs, elle est refusée avec un lien vers lui.
- **Les clients deviennent des contacts** (D4, D5) : `event_clients` n'est plus que le lien entre
  l'évènement et ses contacts ; les liens personnels et les signataires portent l'identifiant du
  contact, et leurs copies figées restent.
- **Migration 0135** (D6) : une seule migration atomique traverse `hub`, `events` et `quotes`.
  Elle reprend les clients existants (un contact par client, fusion par adresse e-mail dans
  l'organisation, sauf entre clients d'un même évènement), avec son annulation et son test.
  Elle demande l'arrêt de l'app au déploiement (runbook).
- **Écrans** (CRM-03, D7) :
  - « Contacts » dans le menu : liste avec recherche et pages ; ajout d'un contact ;
  - la fiche : identité et coordonnées modifiables, historique (évènements, devis et factures,
    documents de ces évènements), notes de l'équipe datées avec leur auteur ;
  - la recherche globale trouve les contacts, après les évènements.
- **Zéro ressaisie** (UX-02, D8) :
  - à la création d'un évènement, chaque client se choisit par la recherche ou se crée sur place ;
    « Créer un évènement » depuis une fiche choisit le contact d'emblée ;
  - à l'envoi en signature, nom, e-mail et adresse de facturation sont repris de la fiche ; une
    adresse saisie ou corrigée y est gardée si la case, cochée par défaut, le reste ;
  - modifier les coordonnées d'un client depuis l'évènement modifie sa fiche, donc partout.
- **RGPD et export** : registre à jour ; le hub trouve, exporte et anonymise les contacts ;
  l'effacement d'un client anonymise son contact s'il n'est plus client d'aucun évènement ; un
  contact sans évènement suit la règle des prospects (D9) ; les essais créent des contacts d'essai,
  purgés avec eux. Format `symbola.export/v1` changé sur place (D10, avenant de l'ADR 0068).
- **Aide** : écran « Contacts » avec sa capture, fiche du contact ; textes de la création
  d'évènement et du devis complétés ; capture de la création régénérée.

### Écarts et points ouverts

- **Foyers, entreprises et import de contacts** : lot 36b (HUB-14, SC-10).
- **Prestataires du carnet** hors des contacts (D12, écart assumé par l'ADR 0069).
- **Fusion de deux contacts sans e-mail** : CRM-07.
- **Jeu fictif** : les évènements sans client nommé y reçoivent un client au nom de l'évènement,
  qui paraît désormais dans les contacts (64 des 65 d'ORG-02). À compléter dans le jeu ; décision
  de Julien (`docs/recette/SC-02.md`).
- **Un envoi en signature refusé** ne garde pas les adresses saisies, et le bloc de signature ne
  liste pas les mentions manquantes (remarque du rejeu).

### Vérifications (en local)

- Lint, typecheck, frontières de modules : verts. Registre RGPD à jour.
- Unitaires : app 499, `@symbola/privacy` 42, `@symbola/contracts` 24, `@symbola/i18n` 39.
- Intégration :
  - app 633, dont 8 pour les contacts (unicité, retour d'un couple, recherche, notes, isolation,
    purge à l'horloge simulée, essais) ;
  - `@symbola/db` 172, dont la reprise de 0135 et son annulation, et l'isolation des contacts ;
  - `@symbola/auth` 21.
- Parcours e2e, base rechargée : 285 réussis, 3 ignorés (les mêmes qu'avant). Nouveau parcours
  `crm-03-ux-02-contacts`, en taille ordinateur et en 375 px, avec axe-core ; `sec-13` couvre la
  fiche d'un contact d'une autre organisation. Le premier passage a trouvé un défaut : la
  recherche globale montrait le contact avant l'évènement, alors qu'un nom de client doit ouvrir
  l'évènement (AIDE-08). Les évènements restent en tête.
- Semgrep (`p/default`) : rien sur le code du lot (les six signalements anciens de
  `quotes/service.ts`).
- Rejeu : SC-02, étapes 1, 3 et 4 sans ressaisie, et SC-01, étape 4 (`docs/recette/`).

## Bilan du lot 36b (16/11/2026)

### Fait

- **Foyers et entreprises** (CRM-03, D2) : `hub.contact_members` relie une personne à un foyer ou à
  une entreprise, avec un rôle libre.
  - Sur la fiche d'un foyer ou d'une entreprise, on ajoute et on retire ses personnes ; la fiche
    d'une personne dit de quels groupes elle fait partie.
  - La liste des contacts nomme la nature (foyer, entreprise) ; la création demande la nature.
- **Identifiants d'une entreprise** : SIREN ou SIRET, et numéro de TVA, nettoyés à la saisie et
  réservés aux entreprises par la base ; imprimés sous le nom du client sur le devis.
- **Import de contacts** (HUB-14, D11) :
  - une nature « Contacts », en tête de l'écran Import et accessible depuis la liste ;
  - le nom et le prénom d'une seule colonne (« NOM Prénom ») ; un import sans colonne de nom est
    refusé dès l'étape des colonnes ;
  - une étape « Lignes » écarte les lignes selon la valeur d'une colonne, sans tenir compte de la
    casse ni des espaces ; les lignes écartées restent au rapport des écarts ;
  - les doublons d'adresse (dans le fichier ou l'organisation) complètent le contact, ses champs
    vides seulement, ou la ligne est ignorée : jamais deux contacts pour une adresse (DAT-12) ;
  - la colonne de notes et les colonnes gardées deviennent une note ; l'annulation est en bloc,
    et garde un contact devenu client, membre d'un foyer ou annoté depuis.
- **Reconnaissance des colonnes** : un champ d'e-mail ou de téléphone est renforcé par une colonne
  qui en contient (tous les imports).
- **RGPD et export** : registre à jour (identifiants d'entreprise, rôle) ; la recherche RGPD rapporte
  les foyers et entreprises d'une personne ; le rôle s'efface à l'anonymisation ; l'entité
  `hub/contact_members` entre dans l'export complet (v1).
- **Migration 0136** (schéma `hub`), avec son annulation et son test ; elle passe sans arrêter
  l'app. Avenant de l'ADR 0069.
- **Corrections trouvées en route** :
  - à 150 %, l'écran « Colonnes » et la frise des étapes débordaient de l'écran (défauts d'avant le
    lot, sur le chemin de SC-10) ;
  - après une erreur, le formulaire d'un contact perdait la nature choisie et ce qui était saisi ;
  - les fiches RGPD d'un contact montraient des clés brutes (`phone`, `note1`) au lieu de libellés.

### Écarts et points ouverts

- **Identifiants d'entreprise sur la facture** : une facture à un client professionnel est refusée
  tant que la facturation électronique n'existe pas (lot 41) ; ils y entreront avec elle.
- **Tutoriel** : l'aide guidée de l'import montre les fiches événement, pas un fichier de contacts.
- **Messages et rendez-vous** dans l'historique d'un contact : avec leurs modules (lots 38 et 46).
- **Jeu fictif** : toujours la remarque du 36a sur les clients au nom de l'évènement (décision de
  Julien).

### Vérifications (en local)

- Lint, typecheck, frontières de modules : verts. Registre RGPD à jour.
- Unitaires : app 500 (le client entreprise sur le devis), `@symbola/contracts` 24.
- Intégration : `@symbola/db` 174 (annulation de 0136, isolation des membres, accès Admin) ;
  `@symbola/auth` 21 ; app 645, dont 8 pour l'import de contacts sur le fichier de 600 lignes et 4
  pour les foyers et entreprises.
- Parcours e2e, base rechargée : 289 réussis, 3 ignorés (les mêmes qu'avant). Nouveau parcours
  `hub-14-sc-10-contacts`, en taille ordinateur et en 375 px, avec axe-core ; `imp-09-reprise`
  compte désormais quatre tuiles (les contacts en tête).
- Semgrep (`p/default`) : rien sur le code du lot. Gitleaks : aucune fuite dans les commits du lot.
- Rejeu : SC-10, étapes 2 à 5, à 150 %, sans blocage (`docs/recette/SC-10.md`).

