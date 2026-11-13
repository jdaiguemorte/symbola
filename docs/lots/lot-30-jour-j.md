# Lot 30 — Mode Jour J en lecture et chrono à la minute

**Statut** : spécification validée par Julien le 12/11/2026 (« Oui, comme recommandé » : D1 à D9
en (a)). Branche `lot-30-jour-j`, partie du lot 29b (PR #108) ; la PR visera `main` après #108.
30a fait le 13/11/2026 (PR #109) ; 30b fait le 13/11/2026, branche `lot-30b-chrono` (bilans plus bas).

## Contexte

Phase 1 du plan (`docs/GAP_REPORT.md` § 7 et 9) : le MVP pilote comprend « Jour J en lecture hors
ligne » (parcours PAR-08, porte 2). Le lot 29 a posé la couche hors ligne et un écran du jour J en
lecture ; le lot 30 en fait le mode Jour J du cahier des charges, et complète le chrono.

**Exigences** : JRJ-01, JRJ-03, CHR-06, UX-05 (P0).
**Voisines, hors du lot** :
- JRJ-05 à JRJ-09 : pointage, listes, main courante, partage, paiements du jour (V1, lot 51) ;
- CHR-07 : chrono diffusé par destinataire (lot 37) ;
- EVT-04 : événements sur plusieurs jours et temps forts (lot 51) ;
- EVT-06 : équipe par événement et renfort (lot 52).

**Décisions déjà prises** : lot 29 (D1 à D8, ADR 0064) ; `DESIGN.md` (ADR 0057) fixe déjà
l'écran de terrain : thème `night`, contraste de 7:1 (testé), typographie `field-now` de 40 px,
cibles de 56 px au jour J, action principale ancrée en bas, barre d'onglets de cinq entrées au plus.

**Scénario** : SC-08 étape 1 (« Maintenant » et « Ensuite » s'affichent, en mode avion) et
étape 2 (elle appelle le traiteur depuis la séquence en cours). Mesures : toute information à
deux touchers, contraste de 7:1 sur l'écran principal. Les étapes 4 à 7 restent hors du MVP.

**Critères d'acceptation du cahier des charges** :

| ID | Critère |
| --- | --- |
| JRJ-01 | « Maintenant » et « Ensuite », gros caractères, contraste fort, thème sombre. Lisible en plein soleil, utilisable d'une main. |
| JRJ-03 | Appel ou message en un toucher, contacts d'urgence. Le contact de la séquence en cours est à un toucher. |
| CHR-06 | Séquences à la minute avec lieu, responsable, prestataires concernés et notes techniques. Décaler une séquence propose de décaler les suivantes. Les durées et les heures de fin se calculent seules. |
| UX-05 | Portail client, espace prestataire, RSVP et Jour J conçus à 360 px. Cibles tactiles de 44 px au moins. Actions principales dans la zone du pouce. |

## Constat du 12/11/2026 (après le lot 29b)

- **Écran du jour J** (`/jour-j/<id>`, lot 29a) : clair, en une colonne ; programme complet,
  lieux, contacts (prestataires retenus, clients), documents ; gardé sur l'appareil et lisible
  sans réseau. Ni « Maintenant » ni « Ensuite », ni thème sombre, ni contacts d'urgence, ni
  barre d'actions en bas ; les liens d'appel sont dans la liste des contacts (deux touchers).
- **Programme** (`events.program_items`) : heure de début, heure de fin facultative (plus petite
  que le début : après minuit), libellé, lieu, participants (postes de prestataires ou noms
  libres), note interne ; chevauchements signalés. Ni responsable, ni durée affichée ; une fin
  absente reste vide ; changer une heure ne propose rien pour les séquences suivantes.
- **Équipe** : les comptes n'ont ni nom ni téléphone ; seule la fiche entreprise a un téléphone
  de contact. **Aucun contact d'urgence** n'existe, ni dans l'app ni dans le jeu fictif.
- **Jeu fictif** : le chrono de EV-REF-01 donne heure et durée de chaque séquence (24 le jour J),
  chargées comme programme depuis le lot 29a.
- **360 px et cibles** : les parcours tournent en 375 px ; certains contrôlent 360 px sans
  défilement horizontal. Aucune mesure des cibles tactiles.

## Découpage (décision D1)

- **30a — L'écran du jour J** : « Maintenant » et « Ensuite », thème sombre et gros caractères,
  barre du bas (appel de la séquence en cours, onglets), annuaire du jour avec contacts d'urgence,
  cibles de 56 px ; contrôle à 360 px. Une migration (contacts du jour J).
- **30b — Le chrono à la minute** : responsable de chaque séquence, durées et heures de fin
  calculées, décalage proposé des séquences suivantes, sur la fiche ; contrôle à 360 px et des
  cibles de 44 px du portail et de l'espace du prestataire. Une migration (responsable).

## Lot 30a — L'écran du jour J

### Partie A — « Maintenant » et « Ensuite » (JRJ-01, décision D2)

- En tête de l'écran, deux cartes :
  - **Maintenant** : la séquence en cours, en gros caractères (`field-now`) : libellé, heures et
    durée, lieu, prestataires et intervenants, note interne, temps restant ;
  - **Ensuite** : la séquence suivante, avec « dans 25 min », son lieu et ses prestataires.
- Calculées sur l'appareil, à l'heure de Paris, et remises à jour chaque minute : elles marchent
  sans réseau.
- Cas :
  - avant le jour J : « Le jour J, c'est le 12 juin » et, en « Ensuite », la première séquence ;
  - entre deux séquences : « Pause jusqu'à 13:00 » ;
  - après la dernière : « Programme terminé » ;
  - fin absente : la séquence dure jusqu'au début de la suivante.

### Partie B — Écran de terrain (JRJ-01, UX-05, décision D3)

- Thème sombre `night` sur tout l'écran du jour J, gros caractères, contraste de 7:1 sur les
  cartes (déjà garanti par les jetons).
- **Barre du bas**, dans la zone du pouce, toujours visible :
  - le bouton « Appeler … », pour le contact de la séquence en cours (voir D5) ;
  - quatre onglets sur la même page : Maintenant, Programme, Contacts, Documents.

  Toute information est ainsi à deux touchers au plus.
- Cibles de 56 px au moins sur l'écran ; contrôle automatique à 360 px.
- Le panneau « Sur cet appareil » (lot 29a) passe en bas de l'écran, replié une fois le jour J
  gardé.

### Partie C — Annuaire du jour et contacts d'urgence (JRJ-03, décisions D4 et D5)

- **Onglet « Contacts »** :
  - les prestataires retenus, puis les clients (lot 29a) ;
  - les contacts du jour J saisis pour l'événement : régisseur du domaine, taxi, pharmacie de
    garde ;
  - les numéros d'urgence.

  Chaque contact a « Appeler » et « Écrire » (SMS) en un toucher.
- **Contacts du jour J** : une liste par événement, saisie sur la fiche (nom, rôle, téléphone),
  copiée avec l'écran. Table `events.event_day_contacts` (RLS), inscrite au registre RGPD.
- **Numéros d'urgence** : un fichier de données traduisible (`packages/starter-templates`), jamais
  écrit dans le code : 112, SAMU 15, Police 17, Pompiers 18, et le 114 par SMS.
- **Contact de la séquence en cours** : ses prestataires qui ont un téléphone. Il est à un toucher
  depuis la carte « Maintenant » et depuis la barre du bas.

### Partie D — Tests, rejeu et documents du 30a

- **Tests unitaires** (horloge simulée) :
  - séquence en cours et suivante : avant le jour J, le jour même, pause, dernière séquence, fin
    absente ;
  - fin après minuit, passage à l'heure d'été.
- **Isolation** : les contacts du jour J d'une autre organisation ; un lien personnel et l'Admin
  n'y ont pas accès.
- **Playwright** (360 px et ordinateur) :
  - « Maintenant » et « Ensuite » à une heure simulée ;
  - l'appel du traiteur depuis la séquence en cours, en un toucher ;
  - l'annuaire et les urgences ;
  - le mode avion ;
  - les cibles de 56 px, le contraste, axe-core.
- **Rejeu** : SC-08 étapes 1 et 2 sur le jeu fictif, en mode avion, à une heure simulée du
  12 juin 2027 ; `docs/recette/SC-08.md`.
- **Documents** : `docs/gap.csv` (JRJ-01, JRJ-03, JRJ-02), aide de l'écran, registre RGPD.

### Bilan du lot 30a (13/11/2026)

**Fait** :
- **« Maintenant » et « Ensuite »** (`day-timeline.ts`, `field-day.tsx`) :
  - calculés sur le téléphone, à l'heure murale de Paris, toutes les 30 secondes, sans réseau ;
  - la veille : « Le jour J, c'est demain » (plus tôt : dans combien de jours), et la première
    séquence en « Ensuite » ;
  - entre deux séquences : « Pause », « Reprise à 17:00 » ;
  - après la dernière : « Programme terminé » ;
  - une fin absente vaut le début de la suivante, et la dernière dure jusqu'à minuit ;
  - une séquence qui passe minuit reste en cours le lendemain.
- **Écran de terrain** :
  - thème nuit (jetons de `DESIGN.md`) sur l'écran du jour J et la page « Hors ligne », panneaux,
    cases et aide compris ;
  - contraste de 14,9:1 sur la carte « Maintenant » ;
  - cibles de 56 px, retour et aide sur une ligne ;
  - barre du bas fixe : l'appel du premier prestataire de la séquence en cours, puis quatre
    onglets (Maintenant, Programme, Contacts, Documents) ;
  - au programme, l'heure de fin calculée et la durée de chaque séquence.
- **Annuaire du jour** :
  - les urgences, tirées de `packages/starter-templates/src/emergency-numbers.json` (112, 15, 17
    et 18 en appel, 114 en SMS ; libellés en français et en anglais) ;
  - les contacts du jour J, les prestataires retenus, puis les mariés ;
  - appel, SMS ou e-mail en un toucher ; libellé visible court, nom complet pour les lecteurs
    d'écran.
- **Contacts du jour J** :
  - migration 0118 : `events.event_day_contacts` (nom, rôle, téléphone, ordre d'ajout), avec RLS
    forcée, horodatage, journal des suppressions et annulation ;
  - saisis dans l'onglet « Programme » de la fiche (ajout, retrait, refus clairs) ;
  - copiés avec l'écran du jour J ;
  - RGPD : registre, trouvés par nom ou téléphone, rendus avec l'événement, supprimés à l'oubli.
- **Textes et aide** : en français et en anglais ; aide de l'écran réécrite, avec la question
  « Où ajouter le régisseur du domaine ou un taxi ? ».

**Vérifications** :
- tests unitaires : app 418 (dont 16 pour « Maintenant » : veille, pause, minuit, heure d'été),
  données de départ 41 ; lint, types, frontières de modules : verts ;
- intégration : base 150 (isolation de `event_day_contacts`, annulation de 0118), app 528
  (contacts du jour J : ajout, refus, abus d'une autre organisation, RGPD) ;
- de bout en bout :
  - suite complète : 230 réussis, 1 ignoré (déjà ignoré avant), 3 échecs, tous sur la console
    Admin, trop lente sur une base de test de 545 organisations. Sur une base neuve, ces
    parcours passent (22 sur 22, avec ceux du jour J) ;
  - après les dernières retouches de l'écran du jour J, ses parcours et ceux de l'aide repassent
    (20 sur 20) ;
  - `e2e/jrj-01-03-mode-jour-j.spec.ts`, en taille ordinateur et en 375 px, contrôle à 360 px :
    « Maintenant » et « Ensuite » à une heure simulée, l'appel du traiteur depuis la barre du bas,
    l'annuaire, le mode avion, les cibles de 56 px (aide ouverte comprise), axe-core, et le contact
    du jour J sur la fiche ;
- Semgrep : 0 alerte ; Gitleaks : 0 dans les fichiers du lot.

**Rejeu SC-08 étapes 1 et 2** (`docs/recette/SC-08.md`) : le samedi à 17:20, en mode avion,
« Maintenant » (le vin d'honneur) et « Ensuite » dès l'ouverture ; le traiteur à un toucher depuis
la barre du bas. Le rejeu a trouvé des défauts, corrigés avant le commit :
- des couleurs du thème clair restées sur l'écran sombre ;
- deux cibles de 44 px ;
- le nom du lien e-mail pour les lecteurs d'écran ;
- la mise en page à 360 px.

**Écarts avec la spécification, et suites** :
- La veille dit « c'est demain » plutôt que la date, et une pause dit « Reprise à 17:00 » plutôt
  que « Pause jusqu'à 13:00 » : même information, plus courte.
- L'annuaire commence par les urgences, puis les contacts du jour J, les prestataires et les
  mariés : l'urgence d'abord. Les contacts du jour J suivent l'ordre d'ajout, sans réordonnancement.
- Le panneau « Sur cet appareil » est en bas de l'écran, mais il n'est pas replié : il tient en une
  ligne d'état et deux actions.
- Aucun ADR nouveau : le calcul sur l'appareil suit l'ADR 0064, les numéros d'urgence l'ADR 0007.
- **Déploiement** : la migration 0118 rejoint le déploiement d'ensemble (gel des déploiements).
- **Reste** : 30b (chrono à la minute, 360 px et cibles de 44 px du portail et de l'espace du
  prestataire) ; rejeu de Julien sur le staging, sur iPhone, à la porte 2.

## Lot 30b — Le chrono à la minute

### Partie E — Responsable, durées, heures de fin (CHR-06, décisions D6 et D7)

- **Responsable** de chaque séquence : texte court (« Camille », « Le domaine »), proposé parmi les
  responsables déjà saisis pour l'événement. Colonne `program_items.responsible`.
- **Durée et heure de fin** : à la saisie, l'une se calcule depuis l'autre. Partout (fiche, PDF,
  jour J), la séquence s'affiche avec sa durée (« 16:00 – 17:00 · 1 h »). Une fin absente vaut
  le début de la séquence suivante.

### Partie F — Décalage proposé (CHR-06, décision D8)

- Quand l'heure de début d'une séquence change, la fiche propose : « Décaler aussi les 5
  séquences suivantes de 20 min ». Un toucher les décale, début et fin ; « Annuler » reste
  possible dix secondes (UX-07).
- Le jour J, ce décalage reste au lot 51 (pointage, JRJ-05).

### Partie G — 360 px et cibles de 44 px (UX-05, décision D9)

- Le portail du client et l'espace du prestataire sont contrôlés à 360 px, avec des cibles de
  44 px. Les corrections nécessaires font partie du lot.
- Le contrôle (aide de test commune) mesure chaque bouton, lien hors d'une phrase et case à
  cocher visible.

### Partie H — Tests, rejeu et documents du 30b

- **Tests unitaires** : calcul de la durée et de la fin, fin après minuit ; décalage (séquences
  suivantes seulement, après minuit, retour arrière).
- **Isolation** : le décalage d'un programme d'une autre organisation est refusé.
- **Playwright** : saisie avec durée, décalage proposé puis annulé, portail et espace du
  prestataire à 360 px avec des cibles de 44 px, axe-core.
- **Rejeu** : SC-08 étape 1 avec les durées affichées.

### Bilan du lot 30b (13/11/2026)

**Fait** :
- **Responsable** (D6) :
  - migration 0119 : `events.program_items.responsible`, texte de 1 à 120 caractères, avec annulation ;
  - saisi sur la fiche, proposé parmi les responsables déjà saisis (liste de suggestions) ;
  - affiché sur la fiche, dans le PDF (sous l'intitulé) et sur l'écran du jour J (carte
    « Maintenant » et programme) ;
  - RGPD : registre, trouvé par la recherche, rendu avec l'événement ; effacé avec la ligne.
- **Durées et heures de fin** (D7) :
  - à la saisie, la durée en minutes donne l'heure de fin, et l'inverse ; changer le début garde
    la durée. Le service accepte une durée seule (une journée au plus) ;
  - partout, « 16:00 – 17:00 · 1 h » ; une fin absente vaut le début de la suivante ; la dernière
    séquence sans fin n'affiche que son début ;
  - calcul partagé, utilisable sans réseau : `apps/symbola/lib/program-spans.ts`, repris par
    l'écran du jour J.
- **Décalage proposé** (D8, UX-07) :
  - après le changement de l'heure de début, la fiche propose « Décaler aussi les 5 séquences
    suivantes de 20 min » (ou « Avancer ») ;
  - un clic décale début et fin des séquences qui commençaient après, tout ou rien, en une
    transaction ; « Annuler (10 s) » rejoue le décalage opposé ;
  - un début qui sortirait du jour J (après minuit) : pas de bouton, un message dit de déplacer
    à la main ;
  - la proposition vit dans l'adresse ; une fois faite, elle en est retirée, pour qu'un
    rechargement ne décale pas deux fois.
- **360 px et 44 px** (D9) :
  - aide de test commune `expectTouchTargets` (`e2e/helpers.ts`) : boutons, sommaires, liens hors
    d'une phrase, cases par leur libellé ;
  - portail du client et espace du prestataire corrigés : sommaire des rubriques, lien du PDF,
    lien e-mail du contact, boutons « Cocher la tâche » et « Fermer l'accès ». Ces derniers
    mesuraient 40 px, à cause de la règle des formulaires d'un seul bouton.
- **Textes et aide** : en français et en anglais, avec la question d'aide « Comment décaler la
  suite du programme ? ».

**Vérifications** :
- tests unitaires : app 431, dont les durées (après minuit, dernière séquence) et le décalage
  (écart signé, séquences suivantes seulement, sortie du jour, retour arrière) ;
- intégration : base 151 (annulation de 0119), app 535. Pour le responsable, la durée et le
  décalage : abus d'une autre organisation, séquence d'un autre événement glissée, tout ou rien,
  RGPD ;
- de bout en bout, sur une base neuve : 241 réussis, 1 ignoré (déjà ignoré avant), aucun échec.
  Ils comprennent :
  - `e2e/chr-06-chrono.spec.ts` : durées, durée saisie, responsable proposé, décalage fait puis
    annulé, décalage gardé après dix secondes ;
  - `e2e/ux-05-tiers-360.spec.ts` : portail et espace du prestataire à 360 px, cibles de 44 px,
    axe-core ;
- lint, types, frontières de modules : verts ; Semgrep : 0 alerte ; Gitleaks : 0 dans les
  fichiers du lot.

**Rejeu SC-08 étape 1** (`docs/recette/SC-08.md`) :
- la veille, la cérémonie prend vingt minutes de retard ; Camille accepte le décalage des 14
  séquences suivantes ;
- le samedi à 17:20, en mode avion, « Maintenant » est le vin d'honneur (17:20 – 19:05 · 1 h 45)
  et les durées s'affichent au programme.

**Écarts avec la spécification, et suites** :
- La dernière séquence sans fin n'affiche que son début sur la fiche, dans le PDF et au programme
  du jour J. La carte « Maintenant » la garde jusqu'à minuit, comme au 30a.
- Le RSVP n'existe pas encore : il se contrôlera à 360 px à sa livraison (lots 49 et 50).
- Le message « décalées » paraît un instant avant le rafraîchissement de la liste de la fiche.
- Aucun ADR nouveau.
- **Déploiement** : la migration 0119 rejoint le déploiement d'ensemble (gel des déploiements).
- **Reste** : rejeu de Julien sur le staging, porte 2.

## Migrations (à partir de 0118 ; 0117 est celle du lot 29b)

| Lot | Schéma | Contenu |
| --- | --- | --- |
| 30a | `events` | `event_day_contacts` (nom, rôle, téléphone, ordre ; RLS) |
| 30b | `events` | `program_items.responsible` (texte court, facultatif) |

Chaque migration a son script d'annulation, testé par `rollback.integration.test.ts`.

## Fichiers touchés (prévision)

- **30a** :
  - `apps/symbola/app/jour-j/[eventId]/` : écran de terrain, horloge, barre du bas, annuaire ;
  - `app/events/[id]/` : contacts du jour J ;
  - `modules/events/` : contacts du jour J, service et RGPD ;
  - `packages/starter-templates` : numéros d'urgence ;
  - `globals.css` : `field-screen`, `field-card`, `field-action` ;
  - migration 0118.
- **30b** :
  - `modules/events/program.ts` : durée, fin, décalage ;
  - `app/events/[id]/program-*` ;
  - PDF du programme ;
  - `app/portail/`, `app/prestataire/` : corrections pour 360 px et les cibles ;
  - aide de test des cibles tactiles ;
  - migration 0119.
- **Les deux** : traductions et aide, `docs/gap.csv`, `docs/recette/SC-08.md`.

## Hors périmètre

- Pointage, décalage le jour même, avertir les prestataires (JRJ-05, lot 51) ; main courante,
  photos, partage en temps réel (lot 51).
- Chrono diffusé par destinataire et versions (CHR-07, lot 37).
- Responsable choisi parmi les comptes de l'équipe (EVT-06, lot 52) ; téléphones de l'équipe.
- RSVP à 360 px (UX-05) : il n'existe pas encore (invités, lots 49 et 50).

## Ambiguïtés relevées

- **« Contacts d'urgence »** n'est pas défini. Proposé : des contacts du jour J saisis par
  événement (régisseur, taxi), plus les numéros d'urgence nationaux tirés d'un fichier de données
  (D4).
- **« Responsable »** d'une séquence : les comptes n'ont pas de nom avant le lot 52. Proposé : un
  texte court (D6).
- **« Décaler une séquence propose de décaler les suivantes »** (CHR-06) recouvre JRJ-05 (le jour
  J, V1). Proposé : sur la fiche au lot 30, le jour même au lot 51 (D8).
- **Heure de « maintenant »** : celle de l'appareil, à l'heure de Paris (fuseau de l'événement à
  venir, ARC-17).

## Décisions à prendre

- **D1 — Découpage.**
  - (a) Deux PR : 30a (écran du jour J, annuaire, urgences), puis 30b (chrono à la minute, 360 px
    du portail et de l'espace du prestataire).
  - (b) Une seule PR.

  **Recommandation : (a).** Le 30a ferme SC-08 étapes 1 et 2 ; le 30b touche la fiche et d'autres
  écrans.

- **D2 — « Maintenant » et « Ensuite ».**
  - (a) Calculés sur l'appareil, chaque minute, à l'heure de Paris, avec les cas « avant le
    jour J », « pause », « programme terminé » ; une fin absente vaut le début de la suivante.
  - (b) Seulement le jour même ; avant, le programme seul.

  **Recommandation : (a).** La veille, la planner voit déjà ce qui l'attend, et rien ne dépend du
  réseau.

- **D3 — Écran de terrain.**
  - (a) Thème sombre sur tout l'écran du jour J ; barre du bas avec l'appel de la séquence en
    cours et quatre onglets (Maintenant, Programme, Contacts, Documents) ; cibles de 56 px.
  - (b) Thème sombre pour les seules cartes « Maintenant » et « Ensuite », le reste inchangé.

  **Recommandation : (a).** C'est ce que fixe `DESIGN.md`, et tout est à deux touchers d'une main.

- **D4 — Contacts d'urgence.**
  - (a) Une liste par événement (nom, rôle, téléphone) saisie sur la fiche, plus les numéros
    d'urgence nationaux tirés d'un fichier de données (112, 15, 17, 18, 114 par SMS).
  - (b) Les numéros d'urgence seuls.
  - (c) Une liste pour toute l'organisation, la même pour chaque événement.

  **Recommandation : (a).** Le régisseur du domaine change d'un mariage à l'autre ; les numéros
  nationaux ne doivent pas être écrits dans le code.

- **D5 — Contact de la séquence en cours.**
  - (a) Ses prestataires qui ont un téléphone : un bouton « Appeler … » par prestataire sur la
    carte « Maintenant », et le premier dans la barre du bas.
  - (b) Le seul premier prestataire.

  **Recommandation : (a).** Une séquence peut réunir le traiteur et le DJ ; le premier reste à un
  toucher du pouce.

- **D6 — Responsable d'une séquence (30b).**
  - (a) Un texte court, avec les responsables déjà saisis proposés.
  - (b) Attendre le lot 52 pour choisir un compte de l'équipe.

  **Recommandation : (a).** CHR-06 est P0 ; le texte suffit tant que les comptes n'ont pas de
  nom.

- **D7 — Durées et heures de fin (30b).**
  - (a) À la saisie, la durée ou l'heure de fin, l'une calculant l'autre. La durée s'affiche
    partout ; une fin absente vaut le début de la suivante.
  - (b) L'heure de fin devient obligatoire.

  **Recommandation : (a).** C'est le critère de CHR-06, sans rendre la saisie plus lourde.

- **D8 — Décalage des séquences suivantes (30b).**
  - (a) Proposé sur la fiche après un changement d'heure, en un toucher, annulable dix secondes ;
    le jour même au lot 51.
  - (b) Automatique, sans proposition.

  **Recommandation : (a).** Le cahier des charges dit « propose » ; une pause qui ne bouge pas
  (photos, discours) ne doit pas glisser toute seule.

- **D9 — 360 px et cibles tactiles (30b).**
  - (a) Portail du client et espace du prestataire contrôlés à 360 px, cibles de 44 px, corrections
    comprises.
  - (b) L'écran du jour J seul ; le portail et l'espace du prestataire plus tard.

  **Recommandation : (a).** UX-05 les cite ; le contrôle automatique évitera les retours de la
  recette.
