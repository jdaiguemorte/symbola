# Lot 29 — Application installable et Jour J hors ligne

**Statut** : spécification validée par Julien le 12/11/2026 (« Oui, comme recommandé » : D1 à D8
en (a)). Branche `lot-29-hors-ligne`, partie de `main` ; la PR visera `main`. Aucune dépendance
ajoutée (D2).

## Contexte

Phase 1 du plan (`docs/GAP_REPORT.md` § 7 et 9) : le MVP pilote comprend « Jour J en lecture hors
ligne » (§ 19 du cahier des charges, porte 2, parcours PAR-08). Le lot 29 pose la couche hors
ligne ; le lot 30 dessinera l'écran du jour J par-dessus (« Maintenant » et « Ensuite »).

**Exigences** : ARC-09, JRJ-02, JRJ-04, NFR-09 (P0).
**Voisines, hors du lot** :
- JRJ-01, JRJ-03, CHR-06, UX-05 : écran du jour J, annuaire, durées calculées, 360 px (lot 30) ;
- JRJ-05 à JRJ-09 : pointage, listes, main courante, partage, paiements du jour (V1, lot 51) ;
- EVT-06 : équipe par évènement et renfort (lot 52) ;
- INV-05 : plan de table composé dans Symbola (lot 50).

**Décisions déjà prises** :
- Q6 (a) : hors-ligne en lecture au MVP. Q6 prévoyait de demander une dépendance de service worker,
  avec un ADR ; voir D2.
- SEC-05 (lot 24b) : une session expire après 8 heures sans activité.
- ADR 0027 : un fichier est servi par l'app, après contrôle des droits.

**Scénario** : SC-08, étape 1 (ouvrir le mode Jour J en mode avion) et étape 3 (ouvrir le plan de
table hors ligne). « Maintenant », « Ensuite » et l'appel depuis la séquence en cours (étapes 1 et
2 en entier) viennent au lot 30. Les étapes 4 à 7 sont hors du MVP.

**Critères d'acceptation du cahier des charges** :

| ID | Critère |
| --- | --- |
| ARC-09 | Le mode Jour J s'ouvre sans réseau après une première synchronisation. |
| JRJ-02 | Consultation complète au MVP, pointage et notes en V1. Le scénario SC-08 passe en mode avion. |
| JRJ-04 | Le planner choisit les documents embarqués. |
| NFR-09 | Le mode Jour J reste utilisable si le serveur est injoignable (JRJ-02). |
| SC-08 | Toute information à deux touchers. |

## Constat du 12/11/2026 (après le lot 27a)

- **Application web progressive** : il n'y en a pas. `apps/symbola/public` ne contient que l'aide
  et la carte : ni manifeste, ni icône d'application, ni service worker. La CSP permet déjà
  `worker-src 'self' blob:` depuis le lot 11 (la carte). Ses scripts portent un nonce par requête.
- **Écran du jour J** : il n'existe pas. Les données utiles existent déjà :
  - le programme (`events.program_items`) : heures, libellé, lieu, note interne, participants
    (prestataires d'un poste ou libellé libre) ;
  - les lieux (`event_places`) ;
  - les postes de prestataires et les prestataires retenus, avec leurs coordonnées (fiche
    `vendors.vendors` : contact, téléphone, e-mail) ;
  - les clients (`event_clients` : nom, téléphone, e-mail) ;
  - le PDF du programme (`/events/[id]/programme/pdf`).

  L'évènement n'a qu'une date, sans heure (`event_date`) : le programme est celui de ce jour.
- **Documents existants** :
  - les devis signés, dont le PDF est figé (`quotes.signed_document_key`) ;
  - les pièces des lignes de budget, comme les devis des prestataires
    (`budget.budget_line_attachments`) ;
  - les fichiers des fiches de prestataires, comme les contrats ou les fiches techniques
    (`vendors.vendor_files`).

  Aucun document n'est propre à l'évènement : il n'y a ni plan de table (INV-05, lot 50), ni plan
  d'accès, ni plan B.
- **Envoi de fichiers** (`packages/files`) : le type est vérifié par le contenu, puis ClamAV et le
  stockage privé dans Garage. Le fichier est servi après contrôle des droits. Limite : 20 Mo par
  fichier.
- **Session** : elle expire après 8 heures sans activité. Une copie préparée la veille au soir doit
  donc rester lisible le lendemain matin, sans session valide.

## Découpage : deux lots, deux pull requests (décision D1)

- **29a, l'application installable et le jour J hors ligne** : manifeste, icônes, service worker,
  écran du jour J en lecture (programme, lieux, contacts, PDF du programme), copie sur l'appareil,
  mise à jour, effacement, page « Hors ligne ». Aucune migration.
- **29b, les documents embarqués** : documents de l'évènement (plan de table, plans, plan B), choix
  des documents à embarquer et copie sur l'appareil. Une migration.

## Lot 29a — L'application installable et le jour J hors ligne

### Partie A — Application installable (ARC-09, décision D7)

- **Manifeste** : `app/manifest.ts`, une route de métadonnées que Next fournit, sans dépendance.
  - Nom : « Symbola » ; description traduite.
  - Démarrage sur l'accueil, affichage autonome.
  - Couleurs tirées des jetons de `DESIGN.md`.
- **Icônes** : 192 px, 512 px, une version « maskable » et l'icône Apple de 180 px. Elles sont
  dessinées à partir du logo existant par `next/og`, inclus dans Next.
- **Aide** : un article « Installer Symbola sur votre téléphone » (iPhone et Android), lié depuis
  l'écran du jour J. Pas d'invite d'installation automatique.
- **Critère** : l'application s'installe sur Chrome (Android, ordinateur) et sur Safari (iOS). Le
  contrôle d'installabilité de Chrome ne relève aucune erreur.

### Partie B — Service worker (ARC-09, NFR-09, décision D2)

- **Le fichier** : `public/sw.js`, écrit à la main (voir D2). Un petit composant client
  l'enregistre sur les pages de la planner. Il est servi sans cache HTTP, pour que chaque
  déploiement se propage.
- **Portée stricte** : il ne répond qu'à l'écran du jour J, aux fichiers statiques de cet écran,
  aux documents embarqués et aux navigations sans réseau. Tout le reste passe au réseau comme
  aujourd'hui. Aucun écran de gestion n'est servi depuis une copie (D6).
- **Stratégies** :
  - écran du jour J : le réseau d'abord ; la copie si le réseau ou le serveur ne répond pas. Pour
    NFR-09, un serveur injoignable suit le même chemin qu'une absence de réseau ;
  - fichiers statiques de Next : la copie d'abord. Leurs noms portent une empreinte, ils ne
    changent jamais ;
  - documents : la copie d'abord, renouvelée à chaque mise à jour.
- **Navigation sans réseau** vers un autre écran : une page « Hors ligne » liste les jours J
  préparés sur l'appareil.
- **Versions** :
  - les copies portent le numéro de version de l'application ; un déploiement remplace l'ancienne,
    et l'écran du jour J se remet à jour à sa première ouverture en ligne ;
  - interrupteur d'arrêt : un service worker vide, qui se désinscrit. Il est décrit dans le runbook
    de déploiement.

### Partie C — Écran du jour J en lecture (JRJ-02, décision D5)

`/jour-j/[eventId]` a son propre cadre, sans menu ni recherche. Il est pensé pour 360 px ; le
lot 30 l'achèvera (UX-05).

- **En-tête** :
  - nom de l'évènement, date et lieu ;
  - état de la copie : « Prêt hors ligne, mis à jour à 18 h 42 » ou « Pas encore sur cet
    appareil ».
- **Programme du jour** : heures de début et de fin, libellé, lieu, participants, note interne.
- **Lieux** : nom et adresse. Pas de lien d'itinéraire : il enverrait l'adresse à un service de
  cartes tiers, et demanderait le réseau.
- **Contacts** :
  - prestataires retenus : nom, contact, téléphone (lien d'appel), e-mail ;
  - clients : nom, téléphone, e-mail.
- **PDF du programme** (version de l'équipe) : embarqué d'office.
- **Accès** :
  - le titulaire et les membres de l'organisation, comme pour la fiche ; jamais l'Admin ni un lien
    personnel ;
  - l'évènement doit être confirmé (ou réalisé, le lendemain) et daté ;
  - sinon, une page introuvable, qui ne révèle pas que l'évènement existe.
- **Avec le lot 30** : l'écran gagnera « Maintenant » et « Ensuite », les gros caractères, le
  thème sombre, l'annuaire et les contacts d'urgence. La couche hors ligne n'aura pas à changer.

### Partie D — Préparer, mettre à jour, effacer (ARC-09, JRJ-02, décisions D3 et D4)

- **Préparer** : un bouton « Jour J » sur la fiche de l'évènement mène à l'écran ; là, « Garder
  sur cet appareil » est un choix explicite, propre à chaque appareil.
  - L'écran, ses fichiers statiques et le PDF du programme sont alors copiés.
  - « Prêt hors ligne » s'affiche quand tout est copié ; sinon, l'écran dit ce qui manque.
- **Mettre à jour** :
  - à chaque ouverture de l'écran en ligne, et par un bouton « Mettre à jour » ;
  - si la session a expiré, la copie reste lisible et l'écran dit « Reconnectez-vous pour mettre à
    jour ».
- **Effacer** (D4), dans quatre cas :
  - le bouton « Retirer de cet appareil » ;
  - une déconnexion depuis cet appareil ;
  - la connexion d'un autre compte sur le même navigateur ;
  - automatiquement, le lendemain de l'évènement à minuit (heure de Paris), à la première ouverture
    de Symbola qui suit.
- **Stockage** : le navigateur reçoit une demande de stockage persistant
  (`navigator.storage.persist`), pour éviter un effacement par manque de place. L'espace
  disponible est vérifié avant la copie.

### Partie E — Tests, rejeu et documents du 29a

- **Tests unitaires** :
  - expiration de la copie, avec une horloge simulée : la veille, le jour même, le lendemain, le
    surlendemain, et le passage à l'heure d'hiver ;
  - ordre du programme ; choix des contacts affichés.
- **Tests d'abus** : l'écran du jour J d'une autre organisation (introuvable), le rôle Admin et un
  lien personnel (refusés), un évènement non confirmé (introuvable).
- **Playwright** (ordinateur et 375 px, contrôle à 360 px) :
  - préparer, couper le réseau (`setOffline`), recharger : le programme, les lieux, les contacts et
    le PDF restent lisibles ;
  - un autre écran sans réseau mène à la page « Hors ligne » ;
  - « Retirer » et la déconnexion effacent la copie ;
  - axe-core.
- **Rejeu** : SC-08 étape 1 (ouvrir le jour J en mode avion), dans Chrome, réseau coupé ; compte
  rendu dans `docs/recette/SC-08.md`. Sur Safari iOS, Julien rejoue sur le staging (porte 2).
- **Documents** :
  - ADR 0064 (hors ligne et copie sur l'appareil) ;
  - aide et runbook de déploiement (interrupteur d'arrêt) ;
  - `docs/gap.csv` ;
  - registre RGPD : aucun champ nouveau, mais la copie sur l'appareil y est décrite.

### Bilan du lot 29a (12/11/2026)

**Fait** :
- **Installable** : manifeste (`app/manifest.ts`), icônes tirées du logo (`app/icon.tsx`,
  `app/apple-icon.tsx`, `app/icons/[name]`), couleurs des jetons de `DESIGN.md` (testées).
- **Service worker** (`public/sw.js`), écrit à la main, sans dépendance (ADR 0064). Il ne sert que :
  - les fichiers statiques copiés ;
  - l'écran d'un jour J gardé et son PDF, quand le réseau, le serveur ou la session manquent
    (erreur 5xx ou cinq secondes sans réponse) ;
  - la page « Hors ligne » pour toute autre navigation sans réseau.

  Il n'est enregistré que sur un appareil qui garde un jour J ; l'interrupteur d'arrêt est dans le
  runbook de déploiement.
- **Écran du jour J** (`/jour-j/[eventId]`), ouvert depuis le bouton « Jour J » de la fiche : programme
  avec notes internes et participants, lieux, prestataires retenus et clients avec leurs
  coordonnées (appel et e-mail en un toucher), PDF du programme en version de l'équipe.
  - Accès : titulaire et membres, évènement confirmé ou réalisé et daté ; sinon introuvable.
  - Le module Prestataires non souscrit masque les coordonnées, pas les noms.
- **Copie sur l'appareil** (`lib/offline/`) : « Garder sur cet appareil », mise à jour à chaque
  ouverture en ligne, état affiché (prêt, sans réseau, session expirée, place insuffisante,
  navigateur incapable).
  - Effacement : au retrait, à la déconnexion, à la connexion d'un autre compte, le lendemain de
    l'évènement à minuit.
  - Les fichiers de l'application copiés sont ceux que la page charge et ceux que citent les pages
    gardées.
- **Page « Hors ligne »** (`/hors-ligne`) : liste les jours J gardés sur l'appareil.
- **Aide** : fiche « Jour J » du centre d'aide (installation sur iPhone et Android, durée de vie de la
  copie, téléphone perdu), aide de la page « Hors ligne ». Textes en français et en anglais.
- **Documents** : ADR 0064, runbook de déploiement, registre RGPD (copie décrite, aucun champ
  nouveau), `docs/gap.csv` (ARC-09, JRJ-02 et NFR-09 partiels), `docs/recette/SC-08.md`.
- Aucune migration ; aucune dépendance.

**Vérifications** (sur `main` à jour, lot 27b compris) :
- tests unitaires de l'app : 407 réussis ; i18n : 36 réussis ;
- intégration : base 145 ; app 519 sur 520. Le seul échec, RGPD-01 « module qui ne répond pas »,
  laisse 50 ms à chaque module ; sous la charge de la suite complète, le module events les a
  dépassées. Le test passe trois fois sur trois seul ; cette instabilité est antérieure au lot ;
- de bout en bout, sur l'app compilée et une base neuve : 223 réussis, 1 ignoré (déjà ignoré
  avant). Ils comprennent `e2e/jrj-02-jour-j-hors-ligne.spec.ts`, en taille ordinateur et en
  375 px :
  - copie, mode avion, PDF sans réseau, page « Hors ligne » à 360 px ;
  - serveur en erreur 502, session expirée ;
  - effacement par retrait, déconnexion, autre compte et date passée ;
  - accès refusés à une autre organisation, à un évènement non confirmé, à l'Admin et à un lien
    personnel ;
  - axe-core ;
- lint, types, frontières de modules : verts ; Semgrep : 0 alerte ;
- Gitleaks : 0 dans les fichiers du lot. Les 12 alertes du dépôt entier, sans historique, sont
  antérieures et hors du lot : mots de passe de test d'autres parcours, `.env.*.example` ;
- journaux du serveur sans erreur ni adresse.

**Rejeu SC-08** : l'étape 1 passe en lecture et en mode avion. Le jour J s'ouvre en un toucher
depuis la page « Hors ligne », avec 24 séquences. L'étape 2 se fait en deux touchers depuis les
contacts ; le reste vient avec le lot 30.

**Défauts trouvés et corrigés** :
- Le chargeur du jeu fictif ignorait le déroulé, les lieux et les e-mails des mariés ; il ne
  rattachait pas non plus les prestataires consultés à leur fiche.
- Les fichiers propres à la page « Hors ligne » n'étaient pas copiés.
- Un cache vide renaissait après la déconnexion.
- Un navigateur sans service worker recevait un message trompeur.
- Le poste d'un prestataire passait mal à la ligne à 360 px.

**Limites et suites** :
- Safari sur iPhone n'a pas été joué en local ; Julien le rejoue sur le staging (porte 2), avec
  l'application installée.
- Le navigateur intégré à l'outil de développement refuse les service workers. L'écran le dit ;
  Chrome, Safari, Firefox et Edge les acceptent.
- JRJ-04 (documents embarqués) vient au 29b ; « Maintenant », « Ensuite » et l'annuaire au lot 30.
- Gel des déploiements : rien à ajouter au déploiement d'ensemble, hormis l'image.

## Lot 29b — Les documents embarqués

### Partie F — Documents de l'évènement (JRJ-04, décision D8)

- **Rubrique « Documents »** sur la fiche : envoyer un fichier (PDF ou image, 20 Mo au plus)
  avec un intitulé, le renommer, le supprimer.
- **Contrôles** de `packages/files` : type vérifié par le contenu, ClamAV, stockage privé,
  téléchargement servi après contrôle des droits.
- **Table** `events.event_documents` : organisation, évènement, intitulé, clé, type, taille. RLS,
  auteur et dates.

### Partie G — Choisir les documents embarqués (JRJ-04, décision D8)

- **Choisir** : sur l'écran du jour J, un panneau « Documents embarqués » liste les candidats, avec
  une case « Embarquer » et la taille totale :
  - les documents de l'évènement ;
  - les devis signés de l'évènement ;
  - les pièces des lignes de budget de l'évènement ;
  - les devis joints aux prestataires retenus pour l'évènement. Les fichiers du carnet
    (plaquettes, RIB) n'en sont pas : un RIB n'a rien à faire sur un téléphone le jour J ;
  - le PDF du programme, toujours embarqué.
- **Enregistrer le choix** pour l'évènement : toute l'équipe embarque les mêmes documents. Table
  `events.event_day_documents` (source, identifiant de la pièce). Chaque module confirme, par son
  `service.ts`, que la pièce appartient bien à l'évènement : pas de clé étrangère entre schémas.
- **Hors ligne** : l'écran du jour J liste les documents embarqués. Chacun s'ouvre en deux touchers,
  sans réseau.

### Partie H — Tests, rejeu et documents du 29b

- **Isolation** : un document d'une autre organisation, une pièce d'un autre évènement choisie à la
  main (refusée), le rôle Admin, un lien personnel.
- **Playwright** : envoyer un plan de table en PDF, l'embarquer, couper le réseau, l'ouvrir.
- **RGPD** :
  - les documents de l'évènement entrent au registre, à l'export et à l'effacement (avec
    l'évènement) ;
  - RGP-08 : la copie hors ligne est déjà effacée le lendemain de l'évènement, bien avant la purge
    des invités.
- **Rejeu** : SC-08 étape 3 (le plan de table hors ligne).

### Bilan du lot 29b (12/11/2026)

**Fait** :
- **Migration 0117** : `events.event_documents` (intitulé, fichier privé, type, taille) et
  `events.event_day_documents` (choix par événement : source et pièce). Les deux tables ont la
  RLS forcée, l'horodatage et le journal des suppressions ; la migration s'annule.
- **Onglet « Documents » de la fiche** : envoyer un PDF ou une image de 20 Mo au plus, le
  renommer, le supprimer, l'ouvrir. L'envoi passe par une route dédiée : origine, session, débit
  et taille sont contrôlés, puis le type par le contenu et l'antivirus.
- **Écran du jour J** : la rubrique « Documents » liste le PDF du programme et les pièces
  embarquées. « Choisir les documents embarqués » coche, pour l'événement, parmi :
  - les documents de l'événement ;
  - les devis signés ;
  - les pièces des lignes du budget (devis, contrats, factures des prestataires) ;
  - les devis joints aux prestataires retenus.

  Les fichiers du carnet n'en sont pas : un RIB n'a rien à faire sur un téléphone. Un module non
  souscrit n'en propose aucun. Une pièce n'est embarquée et servie que si son module la donne
  comme candidate de l'événement.
- **Copie** : les documents choisis partent avec l'écran, s'ouvrent sans réseau, et leur taille
  entre dans la place libre demandée. Le service worker sert aussi
  `/jour-j/<id>/documents/<source>/<id>`.
- **RGPD** :
  - l'intitulé et le fichier entrent au registre ;
  - le document est trouvé par son intitulé et rendu avec l'événement ;
  - à l'oubli, il est supprimé, fichier et choix compris ;
  - il part aussi avec un essai guidé.
- **Textes et aide** : en français et en anglais, avec la question d'aide « Comment embarquer le
  plan de table ? ».

**Vérifications** :
- intégration : base 148 (isolation des deux tables, annulation de 0117), app 524 (envoi,
  refus, renommage, suppression, choix, abus d'une autre organisation, RGPD) ;
- tests unitaires de l'app : 407 ; lint, types, frontières de modules : verts ;
- de bout en bout, sur une base neuve : 226 réussis, 1 ignoré (déjà ignoré avant), 1 échec. Il
  vient de `l16-sec-01` (5 codes faux), instable sous charge depuis le 27a, qui passe deux fois sur
  deux seul. Ils comprennent `e2e/jrj-04-documents-embarques.spec.ts`, en taille ordinateur et en
  375 px :
  - envoi du plan de table, choix, copie, ouverture en mode avion ;
  - abus : document d'une autre organisation, pièce d'un autre événement glissée dans le choix ;
  - axe-core ;
- Semgrep : 0 alerte ; Gitleaks : 0 dans les fichiers du lot.
- Une première série de parcours avait échoué sur l'Admin. La base de test avait accumulé
  1 409 organisations, et la vue d'ensemble de l'Admin mettait 6,4 s. Sur une base neuve, comme
  en CI, ces parcours passent.

**Rejeu SC-08 étape 3** (`docs/recette/SC-08.md`) : Camille ajoute le plan de table, l'embarque et
garde le jour J. En mode avion, il s'ouvre en deux touchers depuis l'écran du jour J.

**Écarts avec la spécification, et suites** :
- **Fichiers du carnet** : la spécification les citait comme pièces embarquables. Ce sont des
  plaquettes et des RIB ; les contrats des prestataires sont les pièces du budget et les devis des
  consultations. J'ai donc embarqué ces deux sources, et jamais un RIB.
- **Copie hors ligne** : le contenu d'un fichier n'est pas chiffré par l'application ; c'est le
  risque déjà écrit dans l'ADR 0064.
- **Gel des déploiements** : la migration 0117 s'ajoute au déploiement d'ensemble (0109 à 0117).

## Migrations (à partir de 0117 ; 0116 est celle du lot 27b)

| Lot | Schéma | Contenu |
| --- | --- | --- |
| 29a | — | Aucune |
| 29b | `events` | `event_documents` (RLS) ; `event_day_documents` (choix des documents embarqués, RLS) |

La migration a son script d'annulation, testé par `rollback.integration.test.ts`.

## Fichiers touchés (prévision)

- **29a** :
  - `apps/symbola/public/sw.js` ;
  - `apps/symbola/app/manifest.ts`, `app/icon.tsx`, `app/apple-icon.tsx` ;
  - `app/hors-ligne/`, `app/jour-j/[eventId]/` ;
  - `app/app-shell.tsx` (cadre du jour J) ;
  - le bouton de déconnexion (effacement de la copie) ;
  - `next.config.ts` (en-têtes de `sw.js`) ;
  - `apps/symbola/modules/events/` (vue du jour J) et
    `packages/contracts/src/events/service-contract.ts`.
- **29b** :
  - `packages/db/src/schema/events.ts`, migration 0117 et son annulation ;
  - `service.ts` des modules `quotes`, `budget` et `vendors` (pièces d'un évènement) ;
  - `app/events/[id]/` (rubrique « Documents ») ;
  - `privacy.registry.yaml`.
- **Les deux** : traductions et aide, `docs/adr/0064-…`, `docs/runbooks/deploiement.md`.

## Hors périmètre

- **Lot 30** (JRJ-01, JRJ-03, CHR-06, UX-05) : « Maintenant » et « Ensuite », gros caractères,
  thème sombre, annuaire avec contacts d'urgence, appel en un toucher depuis la séquence, durées
  calculées.
- **V1, lot 51** (JRJ-05 à JRJ-09) : file d'actions hors ligne, pointage, notes, incidents, photos,
  envoi des saisies au retour du réseau, partage en temps réel.
- **Plus tard** :
  - notifications push (ARC-09), avec le lot qui en aura l'usage ;
  - carte hors ligne : les tuiles sont trop lourdes pour un téléphone ;
  - plan de table composé dans Symbola (INV-05, lot 50) : il s'ajoutera aux documents candidats ;
  - équipe par évènement et renfort (EVT-06, lot 52 ; SC-08 étape 7).
- **Aucune copie hors ligne** des écrans de gestion, du portail du client ni de l'espace du
  prestataire.

## Ambiguïtés relevées

- **« Cache des écrans clés »** (ARC-09) ne dit pas lesquels. Proposé : le seul écran du jour J au
  MVP, comme le prévoit Q6. Les écrans de gestion restent en ligne : on n'y lit jamais une donnée
  périmée (D6).
- **« Après une première synchronisation »** : par appareil et à la demande, pas automatique pour
  tous les évènements (D3).
- **« Le planner choisit les documents embarqués »** : un choix par évènement, partagé par
  l'équipe, plutôt qu'un choix par appareil (D8).
- **Plan de table, plans, plan B** : ils n'existent pas dans Symbola. Proposé : des documents
  envoyés (D8).
- **Durée de vie de la copie, vol d'un téléphone** : le cahier des charges n'en dit rien. Une copie
  hors ligne ne peut pas être effacée à distance (D4).
- **Dépendance** : Q6 annonçait une dépendance de service worker. Le constat montre qu'une portée
  aussi étroite n'en a pas besoin (D2).

## Décisions à prendre

- **D1 — Découpage.**
  - (a) Deux PR : 29a (application installable, jour J hors ligne), puis 29b (documents embarqués).
  - (b) Une seule PR.

  **Recommandation : (a).** Le 29a n'a pas de migration et rend déjà le jour J lisible en mode
  avion. Le 29b ajoute un schéma et un envoi de fichiers.

- **D2 — Service worker.**
  - (a) Écrit à la main, sans dépendance : environ deux cents lignes, limitées au jour J, testées
    par Playwright réseau coupé. ADR 0064.
  - (b) Serwist, bibliothèque libre qui a succédé à next-pwa : copie de toute l'application dès la
    construction, stratégies prêtes. Une dépendance de plus, à suivre à chaque version de Next ;
    ADR 0064 et demande de dépendance.

  **Recommandation : (a).** La portée tient en un écran, ses fichiers et ses documents. Une
  bibliothèque copierait toute l'application sur chaque téléphone. Un service worker écrit à la
  main se relit en entier en revue de sécurité.

- **D3 — Préparation.**
  - (a) Par appareil, à la demande : « Garder sur cet appareil » sur l'écran du jour J, puis une
    mise à jour à chaque ouverture en ligne. Possible pour un évènement confirmé et daté, jusqu'au
    lendemain de l'évènement.
  - (b) Automatique : tout évènement des sept prochains jours se copie sur chaque appareil
    connecté.

  **Recommandation : (a).** Aucune donnée ne quitte le serveur sans un geste. C'est aussi ce que
  décrit PAR-08 : « La veille, le planner active le mode Jour J ».

- **D4 — Durée de vie de la copie.**
  - (a) La copie s'efface :
    - par « Retirer de cet appareil » ;
    - à la déconnexion depuis cet appareil ;
    - à la connexion d'un autre compte ;
    - le lendemain de l'évènement à minuit, heure de Paris.

    Elle ne s'efface pas à l'expiration de la session (8 h), sinon le jour J préparé la veille
    serait perdu au matin. Pour un téléphone perdu, « Déconnecter tous les appareils » ferme les
    sessions, mais n'atteint pas la copie : elle reste lisible jusqu'au lendemain de l'évènement,
    pour qui sait déverrouiller le téléphone. Ce risque est écrit dans l'ADR ; le verrouillage du
    téléphone reste la protection.
  - (b) Effacer aussi la copie à l'expiration de la session : plus sûr, mais le jour J ne s'ouvre
    plus le matin sans réseau, ce qui contredit ARC-09.

  **Recommandation : (a).**

- **D5 — Contenu de l'écran du jour J (29a).**
  - (a) Le programme du jour, avec les notes internes et les participants ; les lieux ; les
    prestataires retenus et les clients, avec leurs coordonnées ; le PDF du programme. Ni montants,
    ni budget, ni tâches.
  - (b) Le programme seul.

  **Recommandation : (a).** C'est la « consultation complète » de JRJ-02, sans ce qui ne sert pas
  le jour même. Les paiements à remettre viendront avec JRJ-09 (V1).

- **D6 — Les autres écrans sans réseau.**
  - (a) Une page « Hors ligne » qui liste les jours J préparés sur l'appareil ; aucun autre écran en
    copie.
  - (b) Une copie en lecture des derniers écrans consultés, avec leur date.

  **Recommandation : (a).** Un écran de gestion périmé, budget ou devis, induirait en erreur. Q6
  limite le hors-ligne au jour J.

- **D7 — Installation.**
  - (a) Manifeste et icônes tirées du logo, démarrage sur l'accueil, article d'aide pour iPhone et
    Android ; pas d'invite automatique.
  - (b) En plus, une invite « Installer l'application » sur Chrome et Android.

  **Recommandation : (a).** Safari n'a pas d'invite : une explication unique sert tous les
  téléphones. Une invite automatique dérangerait les autres jours.

- **D8 — Documents embarqués (29b).**
  - (a) Une rubrique « Documents » de l'évènement pour le plan de table, les plans et le plan B
    (PDF ou image). Les documents à embarquer se choisissent parmi ceux-là et les pièces existantes
    de l'évènement : devis signés, pièces du budget, fichiers des prestataires retenus. Le choix
    vaut pour l'évènement : chaque appareil de l'équipe embarque les mêmes.
  - (b) Seulement les documents envoyés dans la nouvelle rubrique ; la planner y renvoie les
    contrats.
  - (c) Seulement les pièces existantes, sans nouvelle rubrique.

  **Recommandation : (a).** Le plan de table et le plan B n'existent nulle part aujourd'hui, et les
  contrats sont déjà dans Symbola : les renvoyer serait une double saisie.
