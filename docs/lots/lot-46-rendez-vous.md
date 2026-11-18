# Lot 46 — Rendez-vous : types, page publique de réservation, rappels, comptes rendus

**Statut** : spécification proposée le 18/11/2026, **validée par Julien le 18/11/2026** : toutes les décisions retenues dans leur option recommandée (a), dépendances comprises (accord donné, ADR à écrire dans la PR du lot).
Branche `lot-46-rendez-vous`, partie de `main` (85c655d, après la PR #131). Le lot crée un
module et son schéma (`appointments`) : validation explicite requise (CLAUDE.md § 8). Il propose
une dépendance hors pile (D3) : accord et ADR requis. Il touche l'accueil « Aujourd'hui » et
l'accueil du portail (HUB-08 et POR-02, deux exigences P0 dont les rendez-vous manquaient).

Aucune version intermédiaire n'est déployée (gel des déploiements). Le lot se rejoue en local.

Ce lot avance **en parallèle des lots 41 et 49** ; il partage avec le lot 49 un **préalable
commun** (section dédiée, D0) : voir aussi « Travail en parallèle » à la fin.

## Contexte

Symbola n'a pas d'app Rendez-vous. La planner propose ses rendez-vous par e-mail ou par
téléphone, et les note dans son agenda personnel. Le premier échange avec un couple (SC-02,
étape 2 : « Camille répond depuis un modèle et propose un rendez-vous ») se fait hors de l'outil.
Symbola publie déjà les évènements et le programme de chaque personne vers son agenda (flux ICS
du lot 38b, HUB-29), mais ne lit rien de cet agenda.

Exigences du lot (`docs/GAP_REPORT.md` § 7, tableau « Phase 2 » ; `docs/gap.csv`) :

| ID | Exigence | P | Critère d'acceptation | Écart aujourd'hui |
| --- | --- | --- | --- | --- |
| RDV-01 | Types de rendez-vous : durée, lieu ou visio, marge avant et après, questions préalables | P1 | Un type se crée en moins d'une minute. | Absent : pas d'app Rendez-vous |
| RDV-02 | Page publique de réservation alimentée par les disponibilités réelles des calendriers connectés | P1 | Aucun créneau proposé sur une plage occupée. | Absent |
| RDV-03 | Confirmation, rappels, report et annulation par lien | P1 | Le report ne demande aucun compte. | Absent |
| RDV-04 | Fonctionnement autonome ; si l'app Prospects est présente, le rendez-vous crée ou rattache le prospect | P1 | L'app s'utilise seule, sans erreur ni écran vide. | Absent |
| EVT-10 | Comptes rendus de rendez-vous liés à l'évènement ; les actions deviennent des tâches | P1 | Une action se convertit en tâche en un geste. | Absent |

Et deux restes P0 que ce lot ferme :

| ID | Reste | Où c'est noté |
| --- | --- | --- |
| HUB-08 | Les rendez-vous du jour dans « Aujourd'hui » | `docs/gap.csv` : « Les rendez-vous viendront avec leur module (lot 46) » |
| POR-02 | « Prochains rendez-vous » sur l'accueil du portail | `docs/gap.csv` : « lot 46 (décision D4 du lot 27) » |

Décisions et ADR qui s'appliquent : ADR 0011 et 0012 (un module, un schéma), ADR 0053 (liens
personnels), ADR 0062 (modules autonomes, preuve par combinaisons), ADR 0069 (contact dans le
noyau), ADR 0072 (e-mails à l'image de l'organisation, flux ICS), ADR 0076 (file des tâches,
e-mails sans doublon). Réponses de la DPO (Q35) : information à la collecte (RGP-03),
minimisation (RGP-04), durées (réponse 6).

## Ce qui existe aujourd'hui

- **Contacts** (`modules/hub/contacts.ts`, lot 36) : contact unique par adresse e-mail
  (`findContactByEmail`, `resolveContact`), notes, genre personne, foyer ou entreprise.
- **Prospects** : pas d'app Prospects (lot 44). Un « prospect » est aujourd'hui un évènement au
  statut Option, avec sa source (`events.prospect_sources`) et son motif de perte.
- **Tâches** : tâches d'évènement seulement (`addEventTask` dans `modules/events/service.ts`) ;
  les tâches hors évènement arrivent au lot 53 (CHR-10).
- **E-mails** : modèles en données (`packages/starter-templates/src/email-templates.json`,
  lot 38), envoi par la file `hub.jobs` (`queueAndSendEmail`, clé d'unicité, lot 40b).
- **Calendrier** : génération ICS (`lib/calendar/ics.ts`), flux par personne et par évènement
  (`lib/calendar/feeds.ts`, `modules/hub/calendar-feeds.ts`), agenda de l'app
  (`app/agenda`). Aucune lecture d'un agenda extérieur.
- **Pages publiques** : modèle des liens personnels (`/lien`, jeton après « # », retiré de
  l'adresse, session par cookie, `noindex`, `no-referrer`) ; piège à robots
  (`lib/honeypot.ts`) ; limitation de débit (`lib/rate-limit.ts`, `checkRateLimit`).
- **Tâches périodiques** : `instrumentation.ts`, sous le verrou en base (`lib/scheduler-lock.ts`,
  lot 40b).
- **Aujourd'hui** (`lib/today/load.ts`, `rank.ts`) et **portail** (`app/portail/portal-home.ts`,
  `portal-content.tsx`) : sources multiples, triées ; aucune source « rendez-vous ».
- **Modules** : `MODULE_KEYS = ["events", "budget", "quotes", "vendors"]`
  (`modules/hub/service.ts`) ; `isModuleEnabled` répond **oui** quand l'organisation n'a pas de
  ligne pour le module (un module nouveau serait donc ouvert à tous d'office).

## Préalable commun aux lots 46 et 49 (D0)

Les lots 46 et 49 créent chacun un module et ont trois besoins communs. Les écrire deux fois, en
parallèle, donnerait deux versions ou des conflits sur les mêmes lignes. Proposé : une **petite
PR préalable** (`socle-modules-46-49`, une demi-journée, sans migration), fusionnée avant de
lancer les deux sessions :

1. **Registre des modules** : `appointments` et `guests` ajoutés à `MODULE_KEYS`, avec une
   **valeur par défaut par module** : les deux nouveaux sont **fermés** tant que l'Admin ne les
   ouvre pas (RGP-05 ; pour les invités, la DPO demande une analyse d'impact avant la première
   donnée réelle) ; les quatre modules existants restent ouverts par défaut. Libellés FR et EN
   des deux modules, écran de l'Exploitation, `starter-kit.ts`, combinaisons de l'ADR 0062.
2. **Chiffrement de champ** (DAT-08, en partie) : `packages/auth/src/field-box.ts`, sur le
   modèle exact de `secret-box.ts` (AES-256-GCM de Node, ADR 0037), avec sa propre clé
   `DATA_ENCRYPTION_KEY` (validée par `packages/env`, ajoutée à `.env.example`, au guide
   d'installation et au Compose) et des données associées (table, colonne, identifiant de
   ligne). Le lot 46 y range l'adresse secrète de l'agenda extérieur ; le lot 49, les régimes ;
   le lot 48, plus tard, l'IBAN.
3. **Jeton de lien** : les fonctions pures `newLinkSecret`, `hashLinkSecret`, `formatLinkToken`,
   `parseLinkToken` passent de `modules/events/link-tokens.ts` à `packages/auth/src/link-token.ts`
   (le module `events` les réexporte) : les deux nouveaux modules en ont besoin sans franchir la
   frontière d'`events` (ARC-02).

## Une seule PR

Tout le lot vit dans un module neuf (`modules/appointments`, schéma `appointments`) et ses
écrans ; il appelle les services `hub` (contacts, e-mails, file) et `events` (tâches) sans les
modifier, sauf l'affichage d'« Aujourd'hui » et du portail.

## Partie A — Types de rendez-vous (RDV-01)

- Un type : nom, durée (15 min à 8 h), **lieu** (adresse, visio avec un lien saisi par la
  planner, ou téléphone), **marge avant et après** (0 par défaut), délai de prévenance minimal
  (24 h par défaut), horizon de réservation (60 jours), **questions préalables** (zéro à cinq :
  choix dans une liste ou réponse courte ; une réponse libre porte la mise en garde de RGP-04),
  personne de l'équipe qui reçoit (la titulaire par défaut), actif ou non.
- **Moins d'une minute** : le formulaire ne demande que le nom et la durée, tout le reste a une
  valeur par défaut ; trois modèles de départ en données (`appointment-types.json` : premier
  rendez-vous découverte 1 h en visio, visite de lieu 1 h 30, dégustation 2 h), traduisibles,
  jamais en dur (HUB-20).
- **Disponibilités** de la personne qui reçoit : plages hebdomadaires (lundi au vendredi,
  9 h-18 h par défaut), jours fermés, et les sources occupées de la partie B.

## Partie B — Page publique de réservation sur les disponibilités réelles (RDV-02 ; D2 à D6, D11)

- **Adresse** : `/reserver/<adresse>` (choisie par la planner, unique, proposée d'après le nom
  de l'organisation), puis un type, puis un créneau. Page publique : `noindex`, pas de cookie
  autre que strictement nécessaire (RGP-16), en-têtes de sécurité habituels, 375 px d'abord,
  WCAG 2.2 AA.
- **Créneaux** : une fonction pure calcule les créneaux libres d'après les plages, la durée, les
  marges, le délai de prévenance et l'horizon, moins les **plages occupées** :
  1. les rendez-vous déjà pris dans Symbola (avec leurs marges) ;
  2. les jours des évènements confirmés de la personne qui reçoit (D6) ;
  3. les **agendas extérieurs connectés** (D2) : l'adresse secrète ICS d'un agenda Google, Apple
     ou Outlook, relue toutes les 15 minutes, et à l'ouverture de la page si la dernière lecture
     a plus de 15 minutes. **Seules les plages occupées sont gardées** (début, fin) : ni titre,
     ni lieu, ni participants (minimisation, D4).
- **Réservation** : nom, e-mail, téléphone facultatif, réponses aux questions, mention
  d'information au nom de la planner (RGP-03, texte de départ en données, modifiable dans les
  réglages RGPD). **Contrôle au moment d'enregistrer** : le créneau est recalculé dans une
  transaction sous un verrou par personne qui reçoit (`pg_advisory_xact_lock`) ; s'il n'est plus
  libre, la page propose les créneaux voisins. Deux réservations simultanées du même créneau :
  une seule passe.
- **Confirmation immédiate** (D5) : e-mail de confirmation avec le fichier `.ics` de
  l'invitation (générateur existant) et le lien de gestion (partie C) ; la planner reçoit la
  nouvelle dans « Aujourd'hui » et dans son flux d'agenda (HUB-29).
- **Abus** : piège à robots ; limitation de débit par adresse IP et par adresse e-mail ; trois
  rendez-vous à venir au plus par adresse e-mail et par organisation ; aucune donnée personnelle
  dans les journaux ; une erreur ne dit jamais si une adresse est connue.
- **Agenda extérieur, côté sécurité** : l'adresse secrète est un justificatif : chiffrée au repos
  (préalable commun, point 2), jamais affichée en entier après l'enregistrement, jamais écrite
  dans un journal. La lecture refuse tout ce qui n'est pas `https` (un `webcal://` est lu en
  `https`), toute adresse qui se résout vers un réseau privé, local ou de métadonnées (contrôle
  après résolution DNS et à chaque redirection, trois redirections au plus), plus de 2 Mo,
  plus de 10 secondes. Trois échecs de suite : la source est marquée « en erreur » et la planner
  prévenue ; la page de réservation n'affiche alors **aucun** créneau du jour concerné tant que
  la source n'a pas été relue (mieux vaut ne rien proposer que proposer une plage occupée).

## Partie C — Confirmation, rappels, report et annulation par lien (RDV-03 ; D10)

- **Lien de gestion** : jeton aléatoire de 256 bits, haché en base (préalable commun, point 3),
  après « # » dans l'adresse et retiré dès l'ouverture, limité à ce rendez-vous ; il expire à la
  fin du rendez-vous. **Aucun compte** : la personne reporte (créneaux du même type) ou annule
  (motif facultatif choisi dans une liste) depuis ce lien ; la planner est prévenue.
- **Rappels** : par e-mail, 24 h avant par défaut, réglable par type (aucun, 24 h, 24 h et 2 h) ;
  envoyés par la file `hub.jobs` avec une clé d'unicité par rendez-vous et par rappel (un rappel
  rejoué ne part pas deux fois) ; jamais pour un rendez-vous annulé ou reporté.
- **Côté planner** : elle crée, déplace ou annule un rendez-vous depuis l'app ; la personne en
  est prévenue par e-mail. Un rendez-vous peut aussi être créé à la main, sans page publique
  (téléphone, salon).
- E-mails de départ en données (`email-templates.json`) : confirmation, rappel, report,
  annulation, côté personne et côté planner.

## Partie D — Une app autonome, reliée au reste quand il existe (RDV-04 ; D7)

- **Seule** : avec le seul module Rendez-vous (plus le hub), tout fonctionne : types, page
  publique, rappels, liste des rendez-vous, contacts. Aucun écran vide (états vides rédigés),
  aucune erreur (test de combinaison, ADR 0062).
- **Contact** : une réservation crée le contact ou le **rattache** au contact existant de même
  e-mail (DAT-12) ; la note du rendez-vous apparaît dans l'historique du contact (CRM-03).
- **Prospect** : l'app Prospects n'existe pas encore (lot 44). Le rendez-vous publie l'évènement
  interne `appointments.appointment.booked` (schéma versionné dans `packages/contracts`) : le
  lot 44 s'y abonnera pour créer ou rattacher le prospect. En attendant, si le module Évènements
  est ouvert, la planner peut **rattacher** le rendez-vous à un évènement existant, ou **créer
  une option** depuis le rendez-vous (nom, date souhaitée, contact repris : zéro ressaisie,
  UX-02).
- **Agenda** : les rendez-vous entrent dans le flux ICS de la personne qui reçoit et dans l'agenda
  de l'app (`app/agenda`).
- **Aujourd'hui** (HUB-08) : les rendez-vous du jour, et les nouveaux, reportés ou annulés depuis
  la veille. **Portail** (POR-02) : les prochains rendez-vous de l'évènement auxquels le client
  participe, seulement les siens (POR-10).

## Partie E — Comptes rendus et actions en tâches (EVT-10 ; D8, D9)

- Après un rendez-vous, la planner écrit son **compte rendu** : notes (texte libre avec la mise
  en garde de RGP-04) et **actions** (une ligne chacune : quoi, pour quand, qui).
- **Une action devient une tâche en un geste** (bouton « En faire une tâche ») : tâche de
  l'évènement lié, avec le titre, l'échéance et le responsable de l'action ; l'action garde le
  lien vers sa tâche et montre son état. Sans évènement lié, le bouton propose d'abord de
  rattacher le rendez-vous (les tâches hors évènement arrivent au lot 53).
- Le compte rendu se lit sur la fiche du rendez-vous, sur celle de l'évènement lié (section
  « Rendez-vous et comptes rendus », visible si le module est ouvert, ARC-07) et dans
  l'historique du contact. Il n'est **jamais partagé** au client par défaut (POR-10) ; le
  partage au portail reste hors périmètre.

## Décisions à prendre

- **D0 — Le préalable commun aux lots 46 et 49.**
  - (a) Petite PR préalable (registre des modules fermés par défaut, chiffrement de champ, jeton
    de lien partagé), fusionnée avant de lancer les sessions des lots 46 et 49.
  - (b) Pas de préalable : chaque lot écrit sa part ; la seconde PR fusionnée résout les
    conflits, et le lot 46 attend le chiffrement du lot 49 (ou garde l'adresse de l'agenda en
    clair d'ici là).

  **Recommandation : (a).** Une demi-journée évite deux chiffrements, deux copies du jeton et
  des conflits sur les mêmes lignes ; c'est aussi la condition pour que les deux sessions
  tournent vraiment en parallèle.
- **D1 — Le module.** Change le schéma de la base.
  - (a) Module neuf `modules/appointments`, schéma `appointments`, clé `appointments`, fermé
    par défaut, ouvert par l'Admin pour une organisation.
  - (b) Rendez-vous rangés dans le module `events`.

  **Recommandation : (a).** RDV-04 demande une app autonome ; un module à part le prouve
  (ADR 0062) et laisse `events` intact.
- **D2 — Les agendas connectés.**
  - (a) **Adresse secrète ICS** de l'agenda (Google, Apple et Outlook en donnent une), relue
    toutes les 15 minutes ; une ou plusieurs par personne.
  - (b) CalDAV avec un mot de passe d'application.
  - (c) Connexion OAuth à Google et Microsoft (lecture des disponibilités par leurs API).

  **Recommandation : (a).** Aucun nouveau sous-traitant, aucun compte d'application à faire
  vérifier chez Google, en lecture seule ; le délai de 15 minutes est la limite connue (un
  rendez-vous pris ailleurs il y a cinq minutes peut encore paraître libre : la page le dit, et
  la planner peut annuler). (c) relève de la V2 (synchronisation dans les deux sens).
- **D3 — Lire les fichiers ICS.** Dépendance hors pile possible.
  - (a) **`ical.js`** (Mozilla, licence MPL-2.0, sans dépendance, celle de Thunderbird) : lit
    les répétitions (règles, exceptions, occurrences déplacées) et les fuseaux décrits dans le
    fichier.
  - (b) **Sans dépendance** : un lecteur maison qui couvre les cas courants (évènements simples,
    journées entières, répétitions quotidiennes, hebdomadaires et mensuelles avec fin, nombre et
    exceptions, fuseaux IANA), testé sur des exports réels de Google, Apple et Outlook.

  **Recommandation : (a).** Le critère est « aucun créneau sur une plage occupée » : une
  répétition mal lue (une exception, un fuseau Windows d'Outlook) proposerait exactement ce qu'il
  faut éviter. Écrire et tenir un lecteur complet coûte plus que la dépendance. MPL-2.0 est déjà
  admise à l'inventaire (axe-core, lightningcss), sans modification de la bibliothèque. Accord et
  ADR requis ; (b) est le repli si tu refuses.
- **D4 — Ce qu'on garde d'un agenda extérieur.**
  - (a) Seulement les plages occupées (début, fin), de la veille à l'horizon de réservation,
    remplacées à chaque lecture.
  - (b) Aussi les titres, pour les montrer à la planner.

  **Recommandation : (a).** L'agenda personnel de la planner contient des données de tiers
  (rendez-vous médicaux, noms) dont Symbola n'a pas besoin (RGP-04) ; la planner voit déjà son
  agenda chez elle.
- **D5 — La confirmation d'une réservation.**
  - (a) Immédiate, avec limitation de débit, piège à robots et plafond de trois rendez-vous à
    venir par adresse e-mail.
  - (b) « À confirmer » jusqu'au clic dans un e-mail de vérification.

  **Recommandation : (a).** Le prospect doit voir son rendez-vous pris tout de suite ; (b)
  enverrait de toute façon un e-mail à l'adresse saisie, et ajoute une étape où l'on perd des
  prospects. La planner annule en un geste une réservation douteuse.
- **D6 — Les jours d'évènement.**
  - (a) Le jour d'un évènement confirmé (et chaque jour d'un évènement sur plusieurs jours) est
    occupé toute la journée pour la personne qui reçoit ; réglable par type (« accepter les
    rendez-vous les jours d'évènement »).
  - (b) Seuls les agendas comptent.

  **Recommandation : (a).** Un samedi de mariage, la planner n'est pas disponible, même si son
  agenda personnel ne le dit pas.
- **D7 — Le prospect** (RDV-04).
  - (a) Contact créé ou rattaché, évènement interne `appointments.appointment.booked` pour le
    lot 44 ; en attendant, rattacher à un évènement ou créer une option, à la main, en un geste.
  - (b) Une option créée d'office à chaque réservation.

  **Recommandation : (a).** Toute réservation n'est pas un projet (un fournisseur, un rendez-vous
  de suivi) ; une option créée d'office remplirait le portefeuille de faux prospects.
- **D8 — Où vivent les comptes rendus** (EVT-10).
  - (a) Dans le module Rendez-vous, rattachés au rendez-vous et à l'évènement (identifiant opaque),
    affichés sur la fiche de l'évènement quand le module est ouvert.
  - (b) Dans le module `events`, sans dépendre de l'app Rendez-vous.

  **Recommandation : (a).** EVT-10 parle de comptes rendus « de rendez-vous » : sans l'app, il
  n'y a pas de rendez-vous ; le schéma `events` reste intact, ce qui laisse le lot 49 seul à y
  toucher (temps forts) pendant le travail en parallèle. Un rendez-vous peut être saisi à la main
  pour tout échange (dégustation, visite), sans page publique.
- **D9 — Une action sans évènement.**
  - (a) Le bouton propose de rattacher le rendez-vous à un évènement (ou d'en créer une option),
    puis crée la tâche ; les tâches hors évènement arrivent au lot 53.
  - (b) Une tâche hors évènement dès ce lot.

  **Recommandation : (a).** (b) anticiperait le lot 53 (CHR-10) et toucherait le modèle des
  tâches.
- **D10 — Les rappels.**
  - (a) Par e-mail, 24 h avant par défaut, réglables par type (aucun, 24 h, 24 h et 2 h).
  - (b) E-mail et SMS.

  **Recommandation : (a).** Le SMS demande un nouveau sous-traitant (choix ouvert depuis la
  réponse 5 de l'avocat) ; il pourra s'ajouter derrière l'interface d'envoi.
- **D11 — L'adresse de la page publique.**
  - (a) Une adresse choisie par la planner (`/reserver/atelier-camille`), unique, modifiable
    (l'ancienne cesse de répondre).
  - (b) Un identifiant aléatoire.

  **Recommandation : (a).** La page est publique et faite pour être donnée (signature d'e-mail,
  site, réseaux) ; une adresse lisible inspire confiance. L'intégration dans le site du planner
  (cadre `iframe`) reste hors périmètre (`X-Frame-Options: DENY`).

## Points pour les conseils

**DPO** (question 13 de sa fiche) :

- **DPO-1** : la lecture de l'agenda personnel de la planner, réduite aux plages occupées
  (D4) : une information particulière à prévoir pour la planner elle-même ? Rien sur les tiers de
  son agenda n'est gardé.
- **DPO-2** : durée de conservation d'une personne qui a seulement pris rendez-vous, sans suite :
  la règle des prospects (3 ans après le dernier contact venu d'elle) convient-elle, ou faut-il
  plus court ?
- **DPO-3** : texte de départ de la mention d'information de la page de réservation (au nom de la
  planner : finalité, base, durée, droits, réclamation).

**Avocat** (question 15 de sa fiche ; la 14 vient du lot 41) :

- **AV-3** : la page publique de réservation, éditée au nom de la planner sur le domaine de
  Symbola : faut-il y faire figurer ses mentions légales (identité, immatriculation, hébergeur) ?

## Migrations (prévision)

- **`appointments`** (nouveau schéma ; une migration de création et une de droits et RLS, sur le
  modèle de 0062 et 0063, avec leurs annulations) :
  - `booking_pages` (organisation, adresse publique unique, réglages, active) ;
  - `appointment_types` (nom, durée, lieu, lien de visio, marges, prévenance, horizon, rappels,
    questions en `jsonb`, personne qui reçoit, actif, position) ;
  - `availability_rules` (personne, jour de la semaine, début, fin) et `availability_closures`
    (personne, début, fin, motif court) ;
  - `calendar_sources` (personne, adresse chiffrée, dernière lecture, état, échecs) et
    `busy_intervals` (source, début, fin) ;
  - `appointments` (type, personne qui reçoit, début, fin, statut, contact, évènement lié, nom
    et e-mail figés, réponses, empreinte du jeton de gestion, motif d'annulation, `is_demo`) ;
  - `appointment_reports` (rendez-vous, évènement, notes) et `appointment_report_actions`
    (compte rendu, texte, échéance, responsable, tâche créée) ;
  - colonnes habituelles : `organization_id` indexé, RLS forcée, auteur et dates (DAT-06),
    suppression logique (ADR 0073).
- Numéros : à partir de 0150 ; la deuxième PR fusionnée renumérote (voir « Travail en
  parallèle »).

## Fichiers touchés (prévision)

- `packages/db/src/schema/appointments.ts` (nouveau), migrations et annulations,
  `appointments-isolation.integration.test.ts`, listes du test d'annulation.
- `packages/contracts/src/appointments/` (contrat du service, évènement
  `appointments.appointment.booked` versionné).
- `apps/symbola/modules/appointments/` : `service.ts`, `repository.ts`, `slots.ts` (calcul pur),
  `ics-reader.ts` (lecture et garde réseau), `reminders.ts`, `privacy.ts` (`privacy/v1`),
  `export.ts` (`export/v1`), `trash.ts`.
- `apps/symbola/app/rendez-vous/` (liste, fiche, compte rendu, types, disponibilités, agendas
  connectés), `app/reserver/[adresse]/` (page publique), `app/rdv/` (lien de gestion).
- `apps/symbola/lib/today/load.ts`, `rank.ts` ; `app/portail/portal-home.ts`,
  `portal-content.tsx` ; `app/agenda/calendar.ts` ; `lib/calendar/feeds.ts` ;
  `app/events/[id]/page.tsx` (section « Rendez-vous et comptes rendus »).
- `lib/privacy/search.ts`, `erasure.ts`, `purge.ts` (participant `appointments`) ;
  `lib/export/organization-export.ts` et `ORGANIZATION_EXPORT_MODULES` ;
  `lib/rate-limit.ts` (actions `appointment_booking`, `appointment_manage`).
- `instrumentation.ts` (lecture des agendas, rappels).
- `apps/symbola/app/app-shell.tsx` (entrée « Rendez-vous » du menu principal, juste après
  « Contacts » ; rubrique de réglages) ; palette ⌘K.
- `packages/starter-templates/src/` : `appointment-types.json`, textes de la mention
  d'information, e-mails dans `email-templates.json`.
- `packages/i18n/src/messages/fr.json`, `en.json` : nouvel espace `Appointments` placé juste
  après `Calendar` ; clés ajoutées à `Today`, `LinkPortal`, `SettingsMenu`, `Palette`, `Help`.
- `privacy.registry.yaml` ; `lib/help/screens.ts` et aide des écrans ; ADR (module Rendez-vous
  et agendas connectés ; `ical.js` si D3 en a) ; `docs/conformite/licences.md` ;
  `docs/conformite/sous-traitants.md` (inchangé si D2 en a : aucun sous-traitant) ;
  `docs/gap.csv` ; bilan ; rejeu `docs/recette/SC-02-rdv.md`.

## Tests

- **Chaque critère devient un `it`** sous son identifiant (`RDV-01` à `RDV-04`, `EVT-10`,
  `HUB-08`, `POR-02`).
- **RDV-01** : un type se crée avec deux champs ; parcours Playwright chronométré sous une minute
  (ordinateur et 375 px).
- **RDV-02** (horloge simulée) : aucun créneau ne chevauche une plage occupée, marges comprises
  (test par propriétés sur des plages tirées au hasard) ; délai de prévenance et horizon ;
  journées entières ; jours d'évènement (D6) ; répétitions avec exception et occurrence déplacée,
  fuseau décrit dans le fichier, passage à l'heure d'été et à l'heure d'hiver ; source en erreur
  → aucun créneau proposé sur la période concernée ; deux réservations simultanées du même
  créneau → une seule passe ; la lecture ne garde ni titre ni lieu (contrôle en base).
- **Garde réseau** : `http://`, adresse privée, `localhost`, adresse de métadonnées, redirection
  vers une adresse privée, fichier de plus de 2 Mo, délai dépassé : refusés, sans que l'adresse
  apparaisse dans un journal.
- **RDV-03** : report et annulation sans compte depuis le lien ; lien d'un autre rendez-vous ou
  d'une autre organisation refusé (même réponse qu'un lien inconnu) ; lien expiré après la fin
  du rendez-vous ; jeton absent de l'adresse après l'ouverture et des journaux ; un rappel rejoué
  ne part qu'une fois ; aucun rappel pour un rendez-vous annulé ou reporté.
- **RDV-04** : organisation avec le seul module Rendez-vous : aucun écran vide ni erreur, pas de
  bouton vers les évènements ; avec Évènements, rattachement et création d'option sans
  ressaisie ; contact rattaché par son e-mail ; évènement interne publié une fois.
- **EVT-10** : une action devient une tâche en un clic, avec son échéance et son responsable ;
  sans évènement, rattachement proposé d'abord ; module fermé → section absente de la fiche de
  l'évènement.
- **HUB-08, POR-02** : rendez-vous du jour dans « Aujourd'hui » ; au portail, seulement ceux de
  l'évènement auxquels la personne du lien participe.
- **Isolation et abus** : l'organisation A ne lit ni ne modifie les types, rendez-vous, sources
  et comptes rendus de B ; l'Admin n'en lit aucun ; la page publique d'une organisation ne montre
  jamais les rendez-vous d'une autre ; limitation de débit (IP, adresse e-mail) ; piège à robots ;
  plafond de trois rendez-vous à venir ; une personne de l'équipe ne voit pas l'adresse secrète
  d'un agenda d'une autre ; adresse secrète chiffrée en base (valeur brute illisible).
- **RGPD** : `privacy/v1` du module (trouver, exporter, anonymiser, effacer une personne qui a
  pris rendez-vous) ; purge selon la règle retenue (DPO-2), horloge simulée.
- **Bout en bout** : planner crée un type et sa page ; une personne réserve sur téléphone ;
  e-mail de confirmation dans Mailpit avec `.ics` ; report par le lien ; compte rendu et action
  en tâche. Ordinateur et 375 px, axe WCAG 2.2, parcours au clavier de la page publique.
- **Rejeu** : SC-02, étapes 2 et 3, sur le jeu fictif : Camille envoie l'adresse de sa page,
  Léa réserve un premier rendez-vous depuis son téléphone, Camille écrit le compte rendu et en
  tire une tâche du mariage (`docs/recette/SC-02-rdv.md`).

## Hors périmètre

- Fuseaux de chaque participant et rendez-vous à plusieurs (RDV-05, P2).
- Synchronisation dans les deux sens et connexion OAuth aux agendas (D2 c, V2).
- SMS (D10) ; paiement d'arrhes à la réservation.
- Intégration de la page dans le site de la planner (`iframe`) ; formulaire de contact (CRM-01,
  lot 44) ; modèles de réponse proposant un rendez-vous (CRM-05, lot 45).
- Partage d'un compte rendu au portail du client ; compte rendu dicté et résumé par l'IA (GC-05,
  V2).
- Tâches hors évènement (CHR-10, lot 53).

## Ambiguïtés relevées

- **« Calendriers connectés »** (RDV-02) : lu comme des agendas lus en continu ; une lecture
  toutes les 15 minutes satisfait « disponibilités réelles » au sens courant, pas à la seconde.
- **« Lieu ou visio »** : lien de visio saisi par la planner, sans création automatique de
  réunion.
- **« Si l'app Prospects est présente »** : elle n'existe pas encore ; lu comme un évènement
  interne auquel le lot 44 s'abonnera.
- **Plusieurs personnes dans l'équipe** : chaque type a une personne qui reçoit ; la répartition
  entre plusieurs (tour de rôle) n'est pas demandée.

## Travail en parallèle (lots 41, 46 et 49)

Si D0 est retenue (préalable commun), il reste ces points communs, tous des **ajouts** :

| Fichier ou zone | Lot 46 | Lot 49 | Règle |
| --- | --- | --- | --- |
| Numéros de migration | `appointments` | `guests`, `events`, `hub` | La deuxième PR fusionnée renumérote et regénère ses instantanés |
| `app/events/[id]/page.tsx` | section « Rendez-vous et comptes rendus » (onglet Synthèse) | onglet « Invités » | Le lot 46 n'ajoute pas d'onglet ; conflit limité à l'import et au chargement |
| `app/portail/portal-home.ts`, `portal-content.tsx` | prochains rendez-vous | rubrique « Invités » | Ajouts distincts ; la seconde PR résout |
| `lib/privacy/search.ts`, `erasure.ts`, `purge.ts`, `lib/export/organization-export.ts` | participant `appointments` | participant `guests` | Une ligne chacun |
| `lib/rate-limit.ts` | `appointment_*` | `rsvp_*` | Une ligne chacun |
| `instrumentation.ts` | après `scheduleClientTaskReminders` | à la fin du bloc | Insertion à ces endroits |
| `email-templates.json` | après `task_reminder` (FR et EN) | après `program_published` (FR et EN) | Insertion à ces endroits |
| `fr.json`, `en.json` | `Appointments` après `Calendar` | `Guests` à la fin | Clés ajoutées aux espaces communs (`Today`, `LinkPortal`, `SettingsMenu`, `Help`) : la seconde PR résout |
| `privacy.registry.yaml` | bloc juste avant la première entrée `core` | bloc à la fin | Insertion à ces endroits |
| `app-shell.tsx` | menu principal après « Contacts » ; rubrique de réglages | rubrique dans le groupe Évènements | Zones différentes |
| `lib/help/screens.ts` | écrans « Rendez-vous » | écrans « Invités » | Ajouts ; la seconde PR résout |

Le lot 41 ne touche aucun de ces fichiers. Sans D0, s'y ajoutent `modules/hub/service.ts`
(clés des modules), `starter-kit.ts`, l'écran de l'Exploitation, `packages/env`, `.env.example`
et `packages/auth` : conflits sur les mêmes lignes, et le lot 46 dépendrait du chiffrement écrit
par le lot 49.

## Bilan (18/11/2026)

Fait, dans une seule PR (ADR 0080) :

- Module `appointments` (schéma et migrations 0150, 0151, annulables ; RLS forcée sur les neuf
  tables, lecture publique de la seule adresse de page) ; contrat et évènement interne
  `appointments.appointment.booked` (v1) dans `packages/contracts`.
- RDV-01 : types en deux champs, trois types de départ (`appointment-types.json`), réglages par
  type. RDV-02 : page publique `/reserver/<adresse>`, créneaux calculés (`slots.ts`, test par
  propriétés, heure d'été et d'hiver), agendas ICS chiffrés et lus par `ical.js` avec garde réseau,
  verrou à la réservation, plafond de trois rendez-vous, débit limité. RDV-03 : confirmation avec
  `.ics`, lien de gestion `/rdv#…`, report et annulation sans compte, rappels par la file des tâches.
  RDV-04 : app autonome (combinaisons ARC-07), contact rattaché, rattachement à un évènement ou
  option sans ressaisie. EVT-10 : comptes rendus, action devenue tâche en un geste, section de la
  synthèse de l'évènement, historique du contact. HUB-08 et POR-02 : rendez-vous dans
  « Aujourd'hui » et sur l'accueil du portail.
- RGPD : registre, `privacy/v1`, purge selon la règle des prospects (DPO-2, défaut prudent),
  export complet (sans l'adresse secrète ni le jeton), corbeille ; questions DPO-1 à DPO-3 et AV-3
  versées aux fiches des conseils.
- Aide de six écrans, menu (après Contacts), réglages, palette, recherche ; textes FR et EN.

Reste ou écart :

- **Modèles d'e-mails de rendez-vous** : personnalisables dans Paramètres › Modèles d'e-mails grâce
  à la migration **0152**, dans le schéma `hub` (accord de Julien du 18/11 : seule la contrainte
  `email_templates_kind_check` est élargie ; une nature inconnue reste refusée). Le lot 49 élargit
  la même contrainte pour ses natures : la seconde PR fusionnée réunit les deux listes.
- **Agenda de l'app** (`app/agenda`, calendrier des mois de l'écran Évènements) : les rendez-vous
  n'y sont pas dessinés ; ils sont dans le flux ICS de la personne qui reçoit (HUB-29),
  dans « Aujourd'hui » et dans la liste du module.
- **Parcours Playwright** non joués en local (port et fournisseur d'identité pris par les sessions
  des lots 41 et 49) : ils tournent en CI.
- Déploiement : migrations 0150 à 0152, compatibles avec la version précédente (sans arrêt de
  l'app, `migrate:plan`) ; le module reste fermé tant que l'Exploitation ne l'ouvre pas.
