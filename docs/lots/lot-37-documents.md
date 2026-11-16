# Lot 37 — Les documents de l'évènement et le programme diffusé

**Statut** : spécification **validée par Julien le 16/11/2026** (« Oui, je valide » : D1 à D13
en (a)), ce qui vaut accord pour toucher les schémas `events`, `hub` et `quotes`.
Branche `lot-37-documents`, partie de `main` après le lot 36 (PR #120).

## Contexte

Le cahier des charges veut un espace de documents par évènement, que la planner range, partage et
consulte sans rien télécharger. Il veut aussi que chaque prestataire reçoive son programme du jour,
dans une version numérotée qui ne change pas sous ses yeux.

Exigences du lot (`docs/GAP_REPORT.md`, plan des lots) :

| ID | Exigence | P | Critère d'acceptation | Écart aujourd'hui |
| --- | --- | --- | --- | --- |
| DOC-01 | Espace documents par évènement : dossiers, versions, aperçu. | P0 | Un document s'aperçoit sans téléchargement. | Absent : une liste plate de fichiers, sans dossiers, sans versions, sans aperçu |
| DOC-04 | Partage par lien à durée limitée. | P1 | Un lien expiré ne révèle rien, pas même le nom du fichier. | Divergent : fichiers servis après contrôle des droits, sans lien de partage |
| DOC-07 | Documents produits et non émis : seuls les données et le modèle sont stockés ; le PDF se reconstruit à la demande. | P0 | Aucun PDF de brouillon n'est conservé. Le PDF reconstruit est identique à l'aperçu. | Partiel : rendu à la demande, égalité avec l'aperçu non testée |
| DOC-12 | Compteur de stockage par organisation et par nature. | P0 | Le relevé mensuel existe dès le pilote et alimente le calcul des quotas. | Absent |
| CHR-07 | Diffusion du chrono par destinataire, par lien et en PDF ; versions numérotées. | P0 | Un prestataire ne voit ni les notes internes ni les montants des autres. | Partiel : un PDF pour tous les prestataires, sans version |
| DAT-14 | Les documents contractuels gardent leurs versions : devis, contrat, chrono diffusé. | P0 | — | Partiel : devis et contrats versionnés ; programme diffusé sans version |
| POR-04 | Portail : documents partagés, signature, paiement des factures du planner. | P0 | Paiement en ligne en V1 (FAC-08). | Partiel : ni documents partagés, ni factures |

Règles qui s'appliquent : POR-10 (rien n'est partagé par défaut), DOC-05 et SEC-21 (contrôle des
fichiers), ADR 0027 (fichiers servis par l'app), ADR 0053 (tiers par lien personnel), DOC-08
(originaux légaux jamais reconstruits).

## Ce qui existe aujourd'hui

- **Documents de l'évènement** (lot 29b) : onglet « Documents » de la fiche, `events.event_documents`.
  - Une liste plate : un intitulé et un fichier, contrôlé à l'envoi (type, taille, antivirus) et
    servi par l'app.
  - Un document peut être embarqué pour le jour J.
- **Autres fichiers de l'évènement**, ailleurs :
  - pièces jointes des tâches (lot 34b) et des lignes de budget ;
  - devis des prestataires candidats ;
  - devis et contrats signés, avec leur dossier de preuve ;
  - originaux des factures et des avoirs (lot 23b).
- **Programme du jour J** (lots 30, 34) : séquences, horaires, lieu, intervenants, note interne.
  - Un PDF en deux variantes (mariés, prestataires) ; la variante « prestataires » est la même pour
    tous.
  - L'espace d'un prestataire montre en direct les séquences où il intervient.
- **Portail des clients** (lots 26 à 31) : tâches, programme en PDF, options, budget, devis à
  signer, contrat. Il ne montre ni documents ni factures.
- **Stockage** : chaque fichier est dans Garage, servi par l'app. Plusieurs tables connaissent la
  taille de leurs fichiers ; trois non : documents signés et dossiers de preuve, pièces des contrats,
  logo. Il n'existe aucun compteur par organisation (`core.usage_counters` ne compte que les
  requêtes).

## Découpage (D1)

- **37a — Les documents de l'évènement** : DOC-01, DOC-04, DOC-07, POR-04 (documents et factures au
  portail).
- **37b — Le programme diffusé et le compteur de stockage** : CHR-07, DAT-14, DOC-12.

Deux PR, chacune avec ses migrations, ses tests et son rejeu.

## Lot 37a — Les documents de l'évènement

### Partie A — Un espace par évènement (DOC-01 ; D2, D3, D4)

- **Un seul espace** dans l'onglet « Documents », qui réunit (D2) :
  - les documents déposés par l'équipe, rangés dans des dossiers ;
  - en lecture, les documents produits par les modules : devis, contrats, factures et avoirs,
    pièces des tâches et du budget, devis des prestataires candidats. Chacun reste géré par son
    module, qui le fournit par son `service.ts`.
- **Des dossiers** (D3) : un niveau, nommés par l'équipe (« Plans », « Traiteur »), plus les dossiers
  des modules, fixes. Un document déposé sans dossier va dans « Divers ».
- **Des versions** (D4) : déposer une nouvelle version d'un document garde les précédentes,
  numérotées, consultables. La dernière est celle qu'on voit, qu'on partage et qu'on embarque pour
  le jour J.

### Partie B — L'aperçu sans téléchargement (DOC-01, DOC-07 ; D5)

- **Un PDF ou une image s'ouvre dans la page** (D5), servi par l'app après contrôle des droits
  (ADR 0027) avec « à afficher » au lieu de « à télécharger ». Un autre type de fichier se
  télécharge, comme aujourd'hui.
- **Le devis s'aperçoit de la même façon** : l'aperçu est le PDF lui-même, rendu à la demande depuis
  les données de la version. Aucun PDF de brouillon n'est écrit dans le stockage (DOC-07).
- **Les originaux légaux** (factures, documents signés) s'affichent tels qu'émis, jamais
  reconstruits (DOC-08).

### Partie C — Le partage (POR-04, POR-10, DOC-04 ; D6, D7)

- **Rien n'est partagé par défaut** (POR-10). Un document se partage, à la main, avec les clients
  de l'évènement, avec ses prestataires, ou les deux (D6).
- **Le portail des clients** gagne une section « Documents » : documents partagés, aperçu et
  téléchargement. Les factures et avoirs émis pour eux y figurent d'office (D6).
- **L'espace d'un prestataire** montre les documents partagés avec les prestataires.
- **Un lien de partage à durée limitée** (DOC-04, D7) : pour une personne qui n'a pas de lien
  personnel (un traiteur pas encore retenu, un régisseur).
  - Le lien vit de 1 à 30 jours et se révoque ; son jeton est gardé haché (SEC-14 à SEC-17).
  - Un lien expiré ou révoqué répond comme un lien inconnu, sans le nom du fichier ni de
    l'évènement.
  - Chaque ouverture va au journal de l'évènement.

## Lot 37b — Le programme diffusé et le compteur de stockage

### Partie D — Le programme diffusé par destinataire (CHR-07, DAT-14 ; D8, D9, D10, D11)

- **« Diffuser le programme »** fige une version numérotée (v1, v2…) du programme, avec sa date et
  son auteur (D8). Les modifications suivantes ne se voient pas avant la diffusion suivante. La fiche
  dit ce qui a changé depuis la dernière diffusion.
- **Chaque prestataire voit, par son lien, la dernière version diffusée de ses séquences** et leur
  contexte (D9) : le déroulé du jour en titres et horaires, sans intervenants, sans notes internes,
  sans montants. Il télécharge le même contenu en PDF, avec le numéro de version.
- **Les clients** voient eux aussi la dernière version diffusée (D10).
- **Les versions restent** (DAT-14) : la liste des diffusions, chacune consultable et imprimable.
- **Prévenir** (D11) : la page du prestataire signale « Nouvelle version du programme ». L'e-mail
  automatique vient avec les modèles d'e-mails du lot 38.

### Partie E — Le compteur de stockage (DOC-12 ; D12, D13)

- **Quatre natures** (DOC-12) :
  - originaux légaux : factures et avoirs émis ;
  - documents signés : devis et contrats signés, dossiers de preuve ;
  - dépôts : documents de l'évènement, pièces des tâches et du budget, devis des candidats,
    fichiers du carnet de prestataires ;
  - images : logo et images déposées.

  Les exports (complets, RGPD) sont temporaires et ne comptent pas.
- **Un relevé mensuel** (D12), le premier de chaque mois, par organisation et par nature : nombre de
  fichiers et volume, gardé d'un mois sur l'autre. Il alimentera le calcul des quotas (DOC-06, P1).
- **Qui le voit** (D12) : la titulaire dans Paramètres › Stockage ; l'Admin, les totaux par
  organisation dans la console. Ce sont des données d'exploitation, sans aucun nom de fichier
  (SEC-09).
- **Les tailles** (D13) : le relevé lit les tailles enregistrées en base, sans parcourir le
  stockage. Les trois endroits qui n'enregistrent pas la taille de leurs fichiers l'enregistrent
  désormais ; pour l'existant, le premier relevé lit la taille une fois au stockage et la garde.

## Décisions à prendre

- **D1 — Le découpage.**
  - (a) Deux PR : 37a (documents, partage, portail), 37b (programme diffusé, compteur).
  - (b) Une seule PR.

  **Recommandation : (a).** Deux livraisons qui se rejouent chacune (SC-08 pour le programme, SC-02
  pour le portail).
- **D2 — Ce que réunit l'espace documents.**
  - (a) Les documents déposés et, en lecture, ceux des modules (devis, contrats, factures, pièces
    jointes), chacun géré par son module.
  - (b) Seulement les documents déposés.

  **Recommandation : (a).** C'est le sens d'« espace documents par évènement » : un seul endroit
  pour retrouver une pièce.
- **D3 — Les dossiers.**
  - (a) Un niveau de dossiers libres par évènement, plus les dossiers fixes des modules.
  - (b) Une arborescence libre.

  **Recommandation : (a).** Un évènement compte quelques dizaines de documents ; un niveau suffit et
  reste lisible sur téléphone.
- **D4 — Les versions d'un document déposé.**
  - (a) Une nouvelle version garde les précédentes, numérotées et consultables ; la dernière est
    celle qu'on voit, partage et embarque.
  - (b) Une nouvelle version remplace l'ancienne.

  **Recommandation : (a).** Le critère de DOC-01 parle de versions.
- **D5 — L'aperçu.**
  - (a) PDF et images affichés dans la page par le navigateur, servis par l'app ; les autres types
    se téléchargent.
  - (b) Conversion en images côté serveur (une dépendance de plus), pour tous les types.

  **Recommandation : (a).** Aucune dépendance nouvelle ; les PDF et les images sont l'essentiel des
  documents d'un mariage.
- **D6 — Le partage avec les tiers.**
  - (a) Document par document, avec les clients, les prestataires, ou les deux. Les factures et
    avoirs émis apparaissent d'office aux clients : ils leur sont adressés.
  - (b) Comme (a), mais les factures aussi à partager une à une.

  **Recommandation : (a).** POR-10 permet le partage par règle ; une facture adressée au client qui
  ne lui serait pas montrée serait un oubli de plus à faire.
- **D7 — Le lien à durée limitée (DOC-04, P1).**
  - (a) Dans ce lot : un lien par document, de 1 à 30 jours, révocable, ouvert au journal.
  - (b) Plus tard.

  **Recommandation : (a).** Le mécanisme des liens personnels existe ; ce lien en reprend la
  sécurité, pour un seul document.
- **D8 — Diffuser le programme.**
  - (a) « Diffuser » fige une version numérotée ; les tiers voient la dernière version diffusée,
    pas le programme en cours de modification.
  - (b) Les tiers voient le programme en direct ; les versions ne sont qu'un historique de PDF.

  **Recommandation : (a).** C'est le sens de CHR-07 et de DAT-14 : un prestataire travaille sur une
  version connue, qui ne change pas sans qu'on la lui diffuse.
- **D9 — Le contexte d'un prestataire.**
  - (a) Ses séquences en entier, et le déroulé du jour en titres et horaires seulement.
  - (b) Ses séquences seules.

  **Recommandation : (a).** Un traiteur doit savoir que la cérémonie finit à 16 h 30 sans en lire
  les détails.
- **D10 — Ce que voient les clients.**
  - (a) Eux aussi, la dernière version diffusée.
  - (b) Le programme en direct.

  **Recommandation : (a).** Clients et prestataires lisent la même version ; on ne montre pas au
  client un brouillon de la planner.
- **D11 — Prévenir d'une nouvelle version.**
  - (a) Un avis sur la page du destinataire ; l'e-mail avec les modèles d'e-mails du lot 38.
  - (b) Un e-mail simple dès ce lot.

  **Recommandation : (a).** Le lot 38 fait les e-mails aux couleurs de l'organisation, avec aperçu
  et envoi test ; un e-mail fait à la hâte serait refait.
- **D12 — Le relevé de stockage.**
  - (a) Mensuel, gardé ; visible par la titulaire (Paramètres) et, en totaux, par l'Admin.
  - (b) Calculé à la demande, sans historique.

  **Recommandation : (a).** Le critère de DOC-12 demande un relevé mensuel qui alimente les quotas.
- **D13 — Les tailles des fichiers.**
  - (a) Enregistrées en base partout, et lues une fois au stockage pour l'existant qui n'en a pas.
  - (b) Lues au stockage à chaque relevé.

  **Recommandation : (a).** Le relevé reste rapide et indépendant du stockage. Trois tables gagnent
  une colonne de taille (`quotes.signature_requests`, pièces de contrat, profil de l'organisation
  pour le logo).

## Migrations (prévision)

- **37a** :
  - `events` : dossiers (`event_document_folders`) ; versions (`event_document_versions`) ; dossier
    et partage sur `event_documents`. La reprise met chaque fichier existant en version 1, dans
    « Divers », non partagé.
  - `events` : liens de partage d'un document (`event_document_links`, jeton haché, échéance,
    révocation), sous RLS.
- **37b** :
  - `events` : versions diffusées du programme (`program_versions` : numéro, date, auteur, copie
    figée des séquences sans note interne).
  - `hub` : relevés de stockage (`storage_snapshots` : organisation, mois, nature, fichiers, volume).
  - `quotes` et `hub` : la taille des fichiers là où elle manque (D13).

Chaque migration ne touche que le schéma de son module (DAT-09), et a son annulation.

## Fichiers touchés (prévision)

- `packages/db` : schémas `events`, `hub`, `quotes` ; migrations, annulations, tests (isolation,
  annulation, reprise).
- `packages/contracts` : documents de l'évènement, versions du programme, relevé de stockage.
- `apps/symbola/modules/events` : dossiers, versions, partage, liens de partage, programme diffusé.
- `apps/symbola/modules/quotes` : pièces fournies à l'espace documents, factures du portail, tailles
  des fichiers signés.
- `apps/symbola/modules/hub` : relevé de stockage, taille du logo.
- `apps/symbola/lib` : orchestration de l'espace documents (modules), relevé mensuel (traitement de
  fond), RGPD et export (nouvelles tables).
- `apps/symbola/app` : onglet « Documents », aperçu, portail (documents, factures), espace
  prestataire (documents, programme diffusé), page d'un lien de partage, Paramètres › Stockage,
  console Admin.
- `privacy.registry.yaml`, `packages/i18n` (FR, EN), aide des écrans, `docs/adr` (un ADR pour
  l'espace documents et le programme diffusé), `docs/export/format-v1.md` et
  `docs/schemas/export/v1`, `docs/gap.csv`, runbook (relevé mensuel).

## Tests

- **Chaque critère devient un `it`** sous son identifiant.
- **Aperçu** (DOC-01) : un PDF et une image s'affichent dans la page (réponse « à afficher »,
  bon type) ; un autre type se télécharge.
- **DOC-07** :
  - le PDF d'un devis en cours se reconstruit à partir du même modèle que l'aperçu (même contenu
    texte, deux rendus de suite égaux) ;
  - aucune écriture au stockage pour un brouillon (stockage simulé, compteur d'écritures).
- **Versions** : une nouvelle version garde l'ancienne ; le partage et le jour J suivent la dernière.
- **Partage** (POR-10) : un document déposé n'apparaît ni au portail ni à l'espace prestataire tant
  qu'il n'est pas partagé ; partagé avec les clients, il n'apparaît pas aux prestataires ; une
  facture émise apparaît au portail du client.
- **DOC-04** (horloge simulée) :
  - le lien ouvre son document seulement ;
  - expiré (la veille, non ; le jour d'échéance, selon l'heure) ou révoqué, il répond comme un lien
    inconnu, sans nom de fichier ;
  - chaque ouverture est journalisée.
- **CHR-07** :
  - après diffusion, une modification ne se voit pas chez le prestataire avant la diffusion
    suivante ;
  - le prestataire ne voit ni note interne, ni montant, ni séquence détaillée d'un autre ;
  - le PDF porte le numéro de version ;
  - la liste des versions reste.
- **DOC-12** (horloge simulée) : le relevé du premier du mois, par nature ; l'Admin voit des totaux
  sans aucun nom de fichier ; une taille manquante est lue une fois puis gardée.
- **Isolation et abus** : organisation A contre B pour chaque nouvelle table ; un lien de partage
  n'ouvre que son document ; un lien personnel d'un autre évènement ne voit rien.
- **Playwright** : onglet « Documents » (dossiers, versions, aperçu, partage), portail, espace
  prestataire, programme diffusé, lien de partage, Paramètres › Stockage ; ordinateur et 375 px,
  axe-core.
- **Rejeu** : SC-02 (étape 4, documents et facture au portail) au 37a ; SC-08 (le chrono au jour J,
  diffusé aux prestataires) au 37b. Résultats dans `docs/recette/`.

## Hors périmètre

- Génération de documents depuis des modèles (DOC-02 : contrat fait, mandat, brief, feuille de
  route) : un lot à part.
- Optimisation et dédoublonnage des fichiers déposés (DOC-09, DOC-10, P1), stockage froid (DOC-11,
  P2).
- Quota de stockage par offre (DOC-06, P1) : le relevé de ce lot l'alimentera.
- E-mails de diffusion (lot 38).
- Paiement en ligne des factures au portail (FAC-08, V1).

## Ambiguïtés relevées

- **« Espace documents par évènement »** (DOC-01) ne dit pas si les documents produits par les
  modules y figurent : D2.
- **« Rien n'est partagé par défaut »** (POR-10) et une facture adressée au client : D6.
- **« Ses séquences et leur contexte »** (CHR-07) : jusqu'où va le contexte : D9.
- **« Le relevé mensuel alimente le calcul des quotas »** (DOC-12) : les quotas eux-mêmes sont P1
  (DOC-06) ; ce lot fait le relevé, pas le blocage.

## Bilan du lot 37a (16/11/2026)

### Fait

- **Un espace par évènement** (DOC-01, D2, D3) : l'onglet « Documents » réunit les documents
  déposés, rangés dans des dossiers d'un niveau (« Divers » sans dossier ; retirer un dossier ne
  supprime aucun document), et, en lecture, les pièces des modules dans leurs dossiers fixes :
  devis et documents signés, factures et avoirs, pièces des tâches et du budget, devis des
  prestataires consultés. Chaque module les fournit par son `service.ts`.
- **Des versions** (D4) : une nouvelle version garde les précédentes, numérotées et consultables ;
  la dernière est lue, partagée et embarquée pour le jour J. Supprimer un document supprime les
  fichiers de toutes ses versions.
- **L'aperçu sans téléchargement** (D5) : un PDF ou une image s'ouvre dans un nouvel onglet,
  servi « à afficher » après les contrôles de droits (`?apercu=1`), sans cadre : les en-têtes
  qui interdisent l'encadrement restent entiers (ADR 0070). Le devis s'aperçoit de la même façon
  (« Aperçu du PDF » sur l'écran du devis).
- **DOC-07** : testé, le PDF d'un devis en cours reconstruit est identique à son aperçu (hors dates
  de production) et aucun PDF de brouillon n'est écrit au stockage.
- **Le partage** (POR-04, POR-10, D6) : rien n'est partagé par défaut ; un document se partage
  avec les clients, les prestataires, ou les deux. Le portail gagne une section « Documents » (les
  documents partagés, et d'office les factures et avoirs émis pour l'évènement, originaux) ;
  l'espace du prestataire, les documents partagés avec les prestataires.
- **Le lien de partage** (DOC-04, D7) : un lien par document, de 1 à 30 jours, révocable ; jeton
  haché, après « # », envoyé en POST ; débit limité ; inconnu, expiré ou révoqué, la même réponse
  sans nom de fichier ni d'évènement ; chaque ouverture comptée et au fil d'activité de la fiche.
- **RGPD et export** : registre à jour (versions, nom d'un dossier, fil d'activité) ; un dossier
  est trouvé par la recherche RGPD et supprimé à l'oubli ; l'oubli d'un document emporte ses
  versions, ses liens et leurs ouvertures au fil. Les trois tables entrent dans l'export complet,
  sans jeton (la v1 tient).
- **Migration 0137** (schéma `events`), avec son annulation (refusée tant qu'une ouverture de lien
  est au fil) et son test ; elle passe sans arrêter l'app. ADR 0070, runbook, aide de la fiche, du
  portail et de l'espace prestataire.
- **Corrigé en route** : l'écran RGPD montrait des clés brutes pour douze natures de fiches
  (document de l'évènement, pièce jointe d'une tâche, contrat, prestataire…) ; elles ont leur
  libellé.

### Écarts et points ouverts

- **Le partage par règle** (« tous les plans aux prestataires ») n'existe pas : POR-10 l'autorise ;
  il viendra si l'usage le demande.
- **Paiement en ligne des factures au portail** : en V1 (FAC-08).
- **Les contrats signés** ne sont pas listés à part dans l'espace documents : le document signé du
  devis (avec son contrat, quand ils sont signés ensemble) y est ; le contrat signé seul reste sur
  l'écran du devis.
- **37b** : programme diffusé (CHR-07, DAT-14) et compteur de stockage (DOC-12).

### Vérifications (en local)

- Lint, typecheck, frontières de modules : verts. Registre RGPD à jour.
- Unitaires : app 503 (aperçu des fichiers, règles d'accès et aide de la page `/partage`),
  `@symbola/contracts` 24.
- Intégration :
  - app 665, dont 15 pour l'espace documents (dossiers, versions, partage, liens à horloge
    simulée, abus, RGPD), 3 pour DOC-07 et 2 pour les factures d'un évènement au portail ;
  - `@symbola/db` 179 (annulation de 0137, isolation des dossiers, versions et liens, accès
    Admin) ;
  - `@symbola/auth` 21.
- Parcours e2e, base rechargée : 292 réussis, 3 ignorés (les mêmes qu'avant), 1 instable :
  `prd-evt-06`, navigation interrompue après un retour arrière, sous la charge de cinq parcours en
  parallèle ; relancé seul trois fois, 18 sur 18. Nouveau parcours `doc-01-04-por-04-documents`,
  en taille ordinateur et en 375 px, avec axe-core.
- Semgrep (`p/default`) : rien sur le code du lot. Gitleaks : aucune fuite dans les commits du lot.
- Rejeu SC-02, étape 4 : sans blocage (`docs/recette/SC-02.md`).
