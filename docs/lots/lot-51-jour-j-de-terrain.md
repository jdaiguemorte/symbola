# Lot 51 — Jour J de terrain : temps forts, pointage, main courante, listes, partage

**Statut** : spécification proposée le 18/11/2026, **à valider par Julien**. Le lot change les
schémas `events` et `budget` (tables et colonnes) : validation explicite requise (CLAUDE.md § 8).
Aucune dépendance nouvelle (D7).

Branche `lot-51-jour-j-de-terrain`, partie de `main`. Aucune version intermédiaire n'est déployée
(gel des déploiements) : le lot se rejoue en local.

Ce lot avance **en parallèle des lots 43 et 45** : voir « Travail en parallèle » à la fin.

## Contexte

Les lots 29 et 30 ont livré le mode Jour J **en lecture**, même sans réseau :
- « Maintenant » et « Ensuite » ;
- l'annuaire du jour, avec appel en un toucher ;
- les documents gardés sur l'appareil.

Le cahier des charges veut la suite. Parcours **PAR-08** (P0 en lecture, **P1 pour le
pointage**), étapes 4 à 7 :

- le planner pointe chaque séquence ;
- un retard propose de décaler la suite et d'avertir les prestataires concernés ;
- un incident se note en dix secondes ;
- au retour du réseau, tout se synchronise ;
- le lendemain, un bilan est prêt.

Moment de vérité : « 16 h 40, la cérémonie a vingt minutes de retard, il n'y a pas de réseau ».

Scénario **SC-08**, étapes 4 à 7, hors périmètre au MVP et objet de ce lot :

4. Camille pointe et accepte le décalage proposé.
5. Elle dicte un incident et joint une photo.
6. Le réseau revient, tout se synchronise ; les prestataires concernés sont avertis après sa
   validation.
7. Hugo, en renfort, voit les mêmes informations à jour.

Mesures : aucune perte après synchronisation, toute information à deux touchers.

Exigences du lot :

- **EVT-04** (P1) — Évènements sur plusieurs jours et en plusieurs temps forts. *Critère* : chaque
  temps fort a son chrono et ses invités.
- **CHR-08** (P1) — Modèles de chrono et import. *Critère* : un chrono existant s'importe depuis un
  tableur.
- **JRJ-05** (P1) — Pointage des séquences ; un retard propose le décalage de la suite et
  l'information des prestataires concernés. *Critère* : rien n'est envoyé sans validation du
  planner.
- **JRJ-06** (P1) — Listes de contrôle d'installation et de démontage, avec photos. *Critère* : une
  photo se joint en deux touchers.
- **JRJ-07** (P1) — Main courante : incident horodaté, dicté, avec photo. *Critère* : un incident
  se saisit en moins de dix secondes.
- **JRJ-08** (P1) — Partage en temps réel avec l'équipe sur place. *Critère* : deux pointages
  simultanés ne se perdent pas.
- **JRJ-09** (P1) — Liste des paiements à remettre le jour même. *Critère* : chaque remise se
  pointe.
- **ARC-09** (P0, Partiel) — Application web progressive : ce lot ajoute la **file d'actions hors
  ligne** du Jour J. Les notifications push restent au lot 53 (D6).
- **PAR-08** (P0) : ce lot en ferme les étapes 4 à 7.

## Ce qui existe aujourd'hui

- **Temps forts** (lot 49, D2) : `events.key_moments` (nom, date, heure, lieu), gérés sur la
  synthèse ; le RSVP demande la présence par temps fort.
- **Programme** : `events.program_items`, avec une heure de début et de fin mais **pas de jour ni
  de temps fort**. Versions diffusées (CHR-07). Modèles de programme (`program_templates`,
  EVT-21). PDF du programme.
- **Mode Jour J** (lots 29, 30, ADR 0064) :
  - `app/jour-j/[eventId]` ;
  - « Maintenant » et « Ensuite » calculés sur le téléphone, même sans réseau ;
  - thème nuit, contraste de 7:1 ;
  - annuaire du jour et documents gardés sur l'appareil.
- **Hors ligne** :
  - service worker écrit à la main, limité au jour J (`public/sw.js`) ;
  - copie sur l'appareil (`lib/offline/day-copy.ts`, `device-copies.ts`) ;
  - copie lisible sans session jusqu'au lendemain de l'évènement ;
  - **lecture seule : aucune écriture hors ligne aujourd'hui.**
- **Liens prestataires** (lots 26b, 47) : espace du prestataire, programme et sa version ; e-mails
  par la file des tâches (lot 40b).
- **Échéancier des prestataires** dans le budget (BUD-03, lot 28).
- **Import de tableurs** : moteur commun (`packages/import-engine`), cellules neutralisées.

## Une seule PR

Le lot tient en une PR : un seul parcours (PAR-08), un seul écran principal (le mode Jour J), une
seule mécanique hors ligne partagée par le pointage, la main courante, les listes et les remises.
S'il fallait couper, la coupure naturelle serait :
1. A et B (temps forts, import, pointage, file hors ligne) ;
2. puis C, D et E (listes, main courante, remises, bilan).

## Partie A — Plusieurs jours, un chrono par temps fort, import (EVT-04, CHR-08 ; D1)

- **Un chrono par temps fort** (D1) : chaque séquence du programme se rattache à un temps fort
  (`program_items.key_moment_id`), donc à un jour. Un évènement d'un jour garde un temps fort
  unique, créé de lui-même : rien ne change pour les évènements existants (migration de données
  annulable).
- **Plusieurs jours** : la fiche montre les temps forts par jour (vendredi : cocktail de
  bienvenue ; samedi : cérémonie, dîner ; dimanche : brunch). Le programme, son PDF et le mode
  Jour J se lisent **par jour**. Le mode Jour J s'ouvre sur le jour en cours.
- **Invités par temps fort** : déjà là (lot 49) ; le Jour J affiche le nombre de présents du temps
  fort en cours, sans noms (règle du lot 49).
- **Import d'un chrono** (CHR-08) :
  - colonnes reconnues : jour ou temps fort, début, fin, séquence, lieu, responsable, note ;
  - **écran de contrôle avant d'écrire**, avec les écarts expliqués (moteur d'import commun) ;
  - cellules `=`, `+`, `-`, `@` neutralisées ;
  - un import peut créer les temps forts manquants.
- **Modèles** : un modèle de programme peut porter plusieurs temps forts (week-end de mariage) ;
  version figée à l'application (HUB-21).

## Partie B — Pointer, décaler, prévenir (JRJ-05, JRJ-08 ; D2 à D4)

- **Pointer** : sur « Maintenant », un toucher « Commencé » puis « Terminé ». L'heure réelle est
  prise sur le téléphone, avec son fuseau, et vaut **même hors ligne**.
- **Retard** : si une séquence commence ou finit plus tard que prévu, un écran propose de
  **décaler la suite** de ce temps fort :
  - de combien (le retard constaté, modifiable) ;
  - quelles séquences (toutes les suivantes par défaut ; la planner décoche celles qui sont
    fixes, comme l'arrivée d'un bus) ;
  - quels **prestataires concernés** (ceux des séquences décalées) seront prévenus.
  La planner valide d'un geste ou refuse. **Rien n'est envoyé sans cette validation** (critère).
- **Prévenir** (D3) : après validation, une nouvelle version du programme est diffusée (CHR-07).
  Chaque prestataire concerné reçoit un e-mail court (« Décalage de 20 min : votre passage à
  21 h 10 »), et son espace affiche l'horaire mis à jour en tête. Hors ligne, la validation est
  enregistrée et l'envoi part **au retour du réseau** ; l'écran le dit (« 3 prestataires seront
  prévenus dès que le réseau revient »).
- **Équipe** (JRJ-08, D4) : les membres de l'organisation qui ouvrent le Jour J de l'évènement
  voient les pointages, les décalages, les incidents et les listes des autres :
  - **en ligne** : rafraîchissement automatique toutes les 15 secondes, et à chaque retour au
    premier plan ;
  - **hors ligne** : à la synchronisation.
- **Deux pointages simultanés ne se perdent pas** (critère) : chaque pointage est un
  **enregistrement ajouté** (qui, quoi, heure de l'appareil, identifiant unique), jamais une
  valeur écrasée. Si Camille et Hugo pointent la même séquence, les deux restent dans l'historique
  et l'écran retient la première heure. Rien n'est perdu, rien n'est contradictoire.

## Partie C — La file d'actions hors ligne (ARC-09, NFR-09 ; D5)

- Toute écriture du Jour J (pointage, validation de décalage, incident, case de liste, remise,
  photo) passe par une **file sur l'appareil** (IndexedDB). Chaque action porte un **identifiant
  unique** créé sur le téléphone.
- **Envoi** : dès que le réseau revient et que l'écran est ouvert, la file part dans l'ordre. Le
  serveur ignore une action déjà reçue (même identifiant), ce qui permet de rejouer sans risque.
  Un indicateur montre « 3 actions en attente », puis « À jour ».
- **Session** : une action hors ligne garde l'identité de la personne qui l'a faite. Au retour du
  réseau, une session expirée **n'efface pas** la file : la reconnexion la vide ensuite.
- **Photos** : réduites sur le téléphone (2 000 px de côté), mises en file, envoyées au retour du
  réseau, puis contrôlées à l'arrivée (type, taille, antivirus, ADR 0027). Une photo refusée est
  signalée, l'incident reste.
- **Copie de lecture** (lot 29) : elle se met à jour après chaque envoi réussi, pour qu'un
  téléphone hors ligne voie au moins ses propres actions.

## Partie D — Listes, main courante, remises (JRJ-06, JRJ-07, JRJ-09 ; D2)

- **Listes de contrôle** (JRJ-06) :
  - installation et démontage, par temps fort ;
  - copiées d'un modèle de l'organisation (données de départ `day-checklists.json`, FR et EN,
    par type d'évènement) ;
  - une case se coche d'un toucher ;
  - **photo en deux touchers** : « Photo » ouvre l'appareil photo, le déclencheur la joint
    (critère).
- **Main courante** (JRJ-07) :
  - bouton « Incident » toujours visible en mode Jour J ;
  - un champ de texte ouvert d'emblée, **dicté par le clavier du téléphone** (micro du clavier,
    D2) ;
  - photo facultative ;
  - « Enregistrer » ;
  - horodatage automatique ;
  - gravité facultative (info, à suivre, urgent).
  Mesure : moins de dix secondes du toucher à l'enregistrement (critère, test chronométré).
- **Paiements à remettre le jour même** (JRJ-09) :
  - dans le budget, une échéance de prestataire peut être marquée « à remettre le jour J »
    (chèque, espèces dans la limite légale, enveloppe), avec la personne qui remet ;
  - le mode Jour J en montre la liste : prestataire, montant, moyen, à qui ;
  - **chaque remise se pointe** (critère) : qui, quand, et une photo du reçu si on veut ;
  - l'échéance passe à « remise » dans le budget du client.

## Partie E — Le bilan du lendemain (PAR-08, étape 7)

- Le lendemain de l'évènement, dans le fuseau de l'évènement, un **bilan** est prêt sur la fiche :
  - séquences prévues et réelles (écarts) ;
  - décalages validés et prestataires prévenus ;
  - incidents avec leurs photos ;
  - listes (cases non cochées) ;
  - remises faites et non faites.
- Export PDF. Il est interne à l'organisation : jamais montré au client ni aux prestataires.

## Décisions à prendre

- **D1 — Le programme et les temps forts.** Touche le schéma `events`.
  - (a) Chaque séquence appartient à un temps fort (donc à un jour) ; un temps fort unique créé
    pour les évènements existants.
  - (b) Un champ « jour » sur la séquence, sans lien aux temps forts.

  **Recommandation : (a).** EVT-04 dit « chaque temps fort a son chrono et ses invités » ; les
  invités sont déjà par temps fort (lot 49).
- **D2 — La dictée.**
  - (a) La dictée du clavier du téléphone (iOS et Android l'ont), rien de plus.
  - (b) La reconnaissance vocale du navigateur (Web Speech API). Elle envoie la voix aux services
    d'Apple ou de Google, elle n'est pas partout, et elle ne marche pas hors ligne.

  **Recommandation : (a).** Elle marche hors ligne sur les téléphones récents, sans sous-traitant
  ni donnée vocale chez Symbola. Le champ s'ouvre avec le clavier : le micro est à un toucher.
- **D3 — Prévenir les prestataires.**
  - (a) E-mail et espace du prestataire mis à jour, après validation, au retour du réseau.
  - (b) SMS en plus (fournisseur de SMS à choisir, comme pour JUR-14).

  **Recommandation : (a)** dans ce lot. Le SMS viendra avec le choix du fournisseur (Q34) : le
  même service servira à JUR-14 et ici. L'annuaire du jour permet déjà d'appeler en un toucher.
- **D4 — Le temps réel.**
  - (a) Rafraîchissement toutes les 15 secondes en ligne, et au retour au premier plan.
  - (b) Connexion permanente (WebSocket ou flux serveur).

  **Recommandation : (a).** Sur un lieu de mariage, le réseau va et vient : une connexion
  permanente se coupe sans cesse, et la file hors ligne fait de toute façon l'essentiel. 15
  secondes suffisent pour « Hugo voit les mêmes informations à jour ».
- **D5 — Qui pointe.**
  - (a) Les membres de l'organisation ; l'équipe par évènement et les renforts sans compte
    viendront avec le lot 52 (EVT-06, HUB-04).
  - (b) Un lien « renfort » sans compte dès ce lot.

  **Recommandation : (a).** Un renfort sans compte qui écrit hors ligne pose les questions du lot
  52 (droits, révocation). Hugo (SC-08) est un membre de l'équipe.
- **D6 — Les notifications push.**
  - (a) Au lot 53 (notifications), avec leur ADR (bibliothèque `web-push` ou équivalent,
    services de notification des navigateurs).
  - (b) Dans ce lot.

  **Recommandation : (a).** Le lot 53 porte toutes les notifications ; ce lot reste sans
  dépendance.
- **D7 — La file hors ligne.**
  - (a) Écrite à la main : IndexedDB, identifiants uniques, envoi à l'ouverture et au retour du
    réseau, sans dépendance (ADR 0064).
  - (b) Une bibliothèque de synchronisation : dépendance, ADR.

  **Recommandation : (a).** Les actions sont peu nombreuses et ne font qu'ajouter des lignes ; le
  service worker est déjà écrit à la main.
- **D8 — Les remises.** Touche le schéma `budget`.
  - (a) Une échéance de prestataire marquée « à remettre le jour J », pointée dans le mode Jour J.
  - (b) Une liste à part dans le module `events`.

  **Recommandation : (a).** La remise **est** le règlement de l'échéance : la garder dans le
  budget évite une double saisie et met le budget du client à jour.

## Points pour les conseils

- **DPO** : photos d'incident et de liste prises sur un lieu de mariage, où des invités peuvent
  apparaître. Proposition : elles restent internes à l'organisation, l'écran conseille de
  photographier les choses plutôt que les personnes, et elles sont purgées avec les documents de
  l'évènement (DPO-9). Les pointages et incidents sont des données de travail : ni noms d'invités
  ni données de santé ; un incident médical se note sans le nom (aide).
- **Avocat** : remises en **espèces** : rappel de la limite légale des paiements en espèces dans
  l'aide, sans contrôle bloquant (le montant est déjà dans le budget).

## Migrations (prévision)

Numérotation : le lot part du premier numéro libre de `main` au moment de son code. Une PR
fusionnée après une autre **renumérote** les siennes **et** leur donne une date (`when` du
journal) postérieure à la dernière de `main`.

- **`events`** :
  - `program_items.key_moment_id`, rempli par une migration de données (un temps fort par
    évènement existant), annulable ;
  - `day_checkpoints` (séquence, nature commencé ou terminé, heure de l'appareil, par, identifiant
    d'action unique) ;
  - `day_shifts` (temps fort, retard, séquences décalées, prestataires prévenus, validé le, par,
    envoyé le) ;
  - `day_checklists` et `day_checklist_items` (case, cochée le, par, photo) ;
  - `day_incidents` (texte, gravité, photo, heure de l'appareil, par) ;
  - `day_reports` (bilan, PDF) ;
  - `day_checklist_templates` ;
  - RLS et index ; unicité de l'identifiant d'action par organisation.
- **`budget`** : échéance de prestataire : `handover_on_day`, `handover_by`, `handed_over_at`,
  `handed_over_by`, `handover_receipt_key`.
- Aucune migration `hub` (D3 : nature d'e-mail existante du programme diffusé, réutilisée).
- Données de départ : `day-checklists.json` ; colonnes d'import du chrono.

## Fichiers touchés (prévision)

- `packages/db/src/schema/events.ts`, `budget.ts` ; `drizzle/` et `drizzle-rollback/`.
- `apps/symbola/modules/events/` : `day-checkpoints.ts`, `day-shifts.ts`, `day-checklists.ts`,
  `day-incidents.ts`, `day-report.ts`, `program.ts`, `import.ts`, `service.ts`, `privacy.ts`.
- `apps/symbola/modules/budget/` : remises (`handovers.ts`, `service.ts`).
- `apps/symbola/lib/offline/` : `action-queue.ts` (IndexedDB, envoi, rejeu) ; `public/sw.js`
  (seulement si une route d'écriture doit être laissée au réseau).
- `apps/symbola/app/jour-j/[eventId]/` (pointage, décalage, incident, listes, remises, état de la
  file), `app/events/[id]/` (temps forts par jour, bilan), `app/import` (chrono).
- `packages/starter-templates/src/`, `packages/i18n/src/messages/`, centre d'aide,
  `privacy.registry.yaml`.
- `docs/gap.csv` (EVT-04, CHR-08, JRJ-05 à JRJ-09, ARC-09, PAR-08, NFR-09), ADR 0091,
  `docs/recette/SC-08.md` (étapes 4 à 7).

## Tests

- **EVT-04** : chrono par temps fort, évènement sur trois jours, évènements existants inchangés
  après la migration (un temps fort unique), annulation de la migration.
- **CHR-08** : import d'un tableur, écran de contrôle, cellules neutralisées, temps forts créés.
- **JRJ-05** (horloge simulée) : retard détecté, décalage proposé, séquences fixes non décalées ;
  **aucun envoi sans validation** ; après validation, nouvelle version et e-mails aux seuls
  prestataires concernés ; validation hors ligne envoyée au retour du réseau, une seule fois.
- **JRJ-08** : deux pointages simultanés de la même séquence par deux membres, les deux gardés,
  première heure retenue ; Hugo voit le pointage de Camille au rafraîchissement suivant.
- **File hors ligne** (Playwright, mode avion simulé) : pointage, incident avec photo et case
  cochée hors ligne ; retour du réseau, envoi dans l'ordre, **aucune perte, aucun doublon**
  (action rejouée deux fois) ; session expirée pendant la coupure, file gardée.
- **JRJ-06** : photo jointe en deux touchers (Playwright, compte des gestes) ; photo refusée par
  l'antivirus signalée, la case reste cochée.
- **JRJ-07** : incident enregistré en moins de dix secondes (test chronométré, 375 px).
- **JRJ-09** : remise pointée, échéance « remise » dans le budget du client ; payeur hors
  périmètre qui ne la voit pas.
- **Bilan** : prêt le lendemain dans le fuseau de l'évènement (veille, jour même, changement
  d'heure) ; jamais visible du client ni des prestataires.
- **Accessibilité** : contraste de 7:1 sur l'écran principal, cibles de 44 px, axe-core, lecteur
  d'écran pour l'état de la file (`role="status"`).
- **Isolation et abus** (SEC-36) : un membre d'une autre organisation, un prestataire par son
  lien, un client par le sien ne peuvent ni pointer ni lire la main courante ; l'Admin rien.
- **Rejeu** : SC-08 complet (étapes 1 à 7) ; `docs/recette/SC-08.md`.

## Hors périmètre

- Notifications push (lot 53) ; SMS aux prestataires (avec le fournisseur de SMS, Q34).
- Renforts sans compte et équipe par évènement (lot 52).
- Dictée par reconnaissance vocale du navigateur (D2 b).
- Plan de salle et emplacement des prestataires (lot 60).

## Ambiguïtés relevées

- JRJ-05 « information des prestataires concernés » : un prestataire est concerné s'il figure
  sur une séquence décalée (participant ou responsable) ; la planner ajuste la liste avant de
  valider.
- JRJ-08 « temps réel » : lu comme « à jour en quelques secondes en ligne, à la synchronisation
  hors ligne », compte tenu du réseau d'un lieu de mariage (D4).

## Travail en parallèle (lots 43, 45 et 51)

- **Avec le lot 45** : les deux touchent `packages/db/src/schema/events.ts`, sur des tables
  différentes. Conflits de texte dans le schéma, le journal des migrations et les traductions.
- **Avec le lot 43** : les deux touchent `packages/db/src/schema/budget.ts` (payeurs pour le 43,
  remises pour le 51), sur des colonnes différentes. Même règle.
- Aucune migration `hub` dans ce lot.
- `gap.csv`, traductions, `globals.css` : garder tout, accolades équilibrées.
