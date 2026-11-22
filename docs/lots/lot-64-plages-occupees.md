# Lot 64 — Plages occupées : une règle par type d'évènement, un réglage par évènement, vers l'agenda et les rendez-vous

**Statut** : spécification proposée le 21/11/2026, **validée par Julien le 21/11/2026** : les
décisions D1 à D6 retenues dans leur option recommandée (a). Le même jour, Julien a ajouté une
partie B, la remise à plat des écrans du module Rendez-vous ; maquettes M1 à M10
(`docs/maquette/Plages-et-reservation.html`) et décisions D7 à D9 (option a) **validées le
21/11/2026**. Migration 0203 (schéma `appointments`, D8) comprise. Le lot
change le schéma de données (`events`, migration 0202) : validation explicite requise (CLAUDE.md
§ 8). Aucune dépendance nouvelle. Un ADR à écrire dans la PR (0109 ; 0108 est celui du lot 63g).

Branche `lot-64-plages-occupees`, partie de `main` (3fda5a51). Numéros pris après ceux du lot 63
(migrations 0196 à 0201, ADR 0103 à 0107).

## Contexte

Retour de recette du 21/11/2026. La planner s'abonne à son agenda Symbola (flux ICS du lot 38b,
HUB-29), mais son outil de réservation (TidyCal) continue de proposer des rendez-vous **le jour
d'un mariage**. Une autre planner aurait le même problème avec Calendly ou un outil équivalent.

Pourquoi ça arrive :

1. **Le flux ne dit pas « occupée ».** Un évènement daté part en **journée entière**
   (`DTSTART;VALUE=DATE`, `lib/calendar/ics.ts`), sans `TRANSP`. Google et Outlook affichent
   volontiers une journée entière venue d'un flux comme « disponible ». Et une journée entière ne
   peut pas dire « de 8 h à 22 h ».
2. **S'abonner ne fait qu'afficher.** L'agenda abonné est une copie en lecture seule, relue quand
   l'agenda le décide (souvent plusieurs heures chez Google). Les outils de réservation lisent
   l'agenda principal du compte relié ; d'après plusieurs utilisateurs, Calendly ne vérifie pas
   les agendas ajoutés par adresse. La doc de TidyCal n'en parle pas.
3. **Côté Symbola**, la page de rendez-vous (lot 46, D6) bloque déjà tout le jour d'un évènement
   confirmé. Elle ne sait pas bloquer seulement certaines heures, ni la veille ou le lendemain.

Décision de Julien du 21/11/2026 : **pas de connexion à Google ni à Apple pour l'instant**
(l'option C, qui aurait demandé la validation de Google, est écartée). On associe deux réponses,
fondées sur **le même réglage** :

- **Sans le module Rendez-vous** (la planner garde son outil extérieur) : le flux d'agenda
  exporte de vraies plages horaires occupées, et un fichier à importer dans l'agenda principal
  permet à l'outil extérieur de les voir (D5).
- **Avec le module Rendez-vous** : la planner partage directement le lien de réservation de
  Symbola. Symbola rassemble les plages des évènements, ses propres rendez-vous et les agendas
  extérieurs déjà relus toutes les quinze minutes (ADR 0082). Il ne propose jamais un créneau
  pris.

Le réglage, en deux niveaux :

- **Une règle par défaut pour chaque type d'évènement**, dans les paramètres : Mariage, Séminaire,
  Anniversaire… et les types créés par l'organisation. Exemple : un mariage occupe le jour même de
  8 h à 22 h.
- **Un réglage propre à un évènement**, sur sa fiche. Exemple : pour le mariage de Kévin et
  Kévina, la planner bloque de la veille à 14 h au lendemain à 12 h.

## Exigences et critères

Le besoin précise deux exigences du cahier des charges, sans en créer une nouvelle (le cahier
reste la référence) :

| ID | Exigence | Ce que le lot ajoute |
| --- | --- | --- |
| HUB-29 | Calendrier : flux ICS puis synchronisation | Le flux exporte des plages occupées, aux heures du réglage. |
| RDV-02 | Page publique sur les disponibilités réelles ; aucun créneau sur une plage occupée | Les plages d'un évènement remplacent le « jour entier » de D6. |

Critères (chacun devient un `it` ; les `describe` portent `HUB-29` ou `RDV-02`) :

1. **Règle par type.** Chaque type d'évènement a une règle : début (jour relatif et heure), fin
   (jour relatif et heure). Le jour relatif va de « 7 jours avant » à « 7 jours après » ; la fin
   est après le début. Un type créé par l'organisation reçoit la règle de départ du fichier de
   données. Un type de départ reçoit la sienne.
2. **Évènement sans type.** Il suit la règle « sans type » de l'organisation, réglable au même
   endroit.
3. **Réglage propre.** Sur la fiche d'un évènement, la planner remplace la règle par un début et
   une fin propres (jour relatif et heure). Elle peut revenir à la règle du type en un geste.
4. **Report.** Un évènement reporté garde son réglage propre, recalé sur la nouvelle date : les
   jours sont relatifs à la date de l'évènement.
5. **Heure locale.** Les heures sont celles du fuseau de l'évènement (ARC-17), heure d'été
   comprise : 8 h reste 8 h le dernier dimanche de mars et le dernier dimanche d'octobre.
6. **Statuts qui bloquent.** Bloquent : confirmé, en préparation, clôturé (les statuts sûrs du
   cycle de vie ; un évènement clôturé le lendemain garde la fin de sa plage). Une option, ou un
   évènement au statut « reporté » dont la nouvelle date n'est pas confirmée, bloque selon un
   réglage de l'organisation (D2). Ne bloquent pas : annulé (perdu), essai (`is_demo`), évènement
   sans date.
7. **Flux d'agenda.** Pour chaque évènement qui bloque, le flux de la personne contient une plage
   horaire (`DTSTART`/`DTEND` en UTC) marquée `TRANSP:OPAQUE`. Une option qui ne bloque pas
   reste visible, marquée `STATUS:TENTATIVE` et `TRANSP:TRANSPARENT`.
8. **Rendez-vous.** La page de réservation ne propose aucun créneau qui touche une plage occupée,
   marges du type de rendez-vous comprises. En dehors de la plage, le jour reste réservable si
   les disponibilités le permettent. Le réglage « Autoriser les jours d'évènement » d'un type de
   rendez-vous (`allow_event_days`) garde son sens : il ignore les plages.
9. **Fichier à importer (D5).** Sur la fiche, « Ajouter à mon agenda » télécharge un fichier
   `.ics` d'un seul évènement : la plage occupée, `TRANSP:OPAQUE`. Importé dans l'agenda
   principal, il est vu par TidyCal ou Calendly comme n'importe quel rendez-vous.
10. **Modules autonomes (ARC-06, ADR 0062).** Le réglage vit dans le module Évènements et sert
    sans le module Rendez-vous. Sans le module Évènements, la page de rendez-vous ne bloque rien
    de ce côté, sans erreur.
11. **Isolation.** Une organisation ne lit ni ne modifie les règles ni les réglages d'une autre ;
    le flux d'une adresse ne montre que les plages de son organisation ; un rôle sans droit
    d'écriture sur l'évènement ne modifie pas son réglage.

## Ce qui existe aujourd'hui

- **Flux ICS** : `lib/calendar/ics.ts` (écriture, sans `TRANSP`), `lib/calendar/feeds.ts` (flux
  de la personne : évènements de l'organisation en journée entière, rendez-vous en heures).
- **Types d'évènement** : `events.event_types` (libellé, public, position, clé de départ) ;
  fichier de départ `packages/starter-templates/src/event-types.json` ; écran
  `app/events/parametres/types`.
- **Évènement** : `events.events` (date, fuseau `time_zone`, statut, type, report) ; équipe
  `events.event_team_members` (responsable, assistant).
- **Rendez-vous** : `modules/appointments/service.ts`, `eventDays()` renvoie les jours entiers
  des évènements confirmés ; `slots.ts` sait déjà retirer des plages occupées (`busy`).
- **Heure locale vers UTC** : `wallTimeToInstant` (lot 38b), heure d'été testée.

## Ce que le lot change

### Données (migration 0202, schéma `events` seulement, annulable)

- `events.event_types` : quatre colonnes de règle, `busy_start_day_offset` (entier, -7 à 7),
  `busy_start_time` (`time`), `busy_end_day_offset`, `busy_end_time`. Les types existants
  reçoivent la règle de départ de leur clé, ou la règle de repli du fichier.
- `events.events` : les quatre mêmes colonnes, **nulles** = suivre la règle du type.
- Réglages de l'organisation (règle « sans type », les options bloquent ou non) : dans la table de
  réglages du module Évènements si elle existe, sinon une petite table
  `events.busy_settings` (une ligne par organisation, RLS). À trancher au début du code, sans
  changer le comportement.
- Contraintes en base : jours entre -7 et 7 ; si la fin tombe le même jour que le début,
  l'heure de fin est après celle du début ; les quatre colonnes d'un évènement sont toutes
  nulles ou toutes remplies.

### Données de départ (aucune valeur en dur)

`packages/starter-templates/src/event-types.json` reçoit, pour chaque type, sa règle `busy`, plus
une règle de repli (`fallbackBusy`) pour les types créés par l'organisation et les évènements
sans type. Valeurs proposées, à corriger par Julien (D1) :

| Type | Début | Fin |
| --- | --- | --- |
| Mariage | jour même, 8 h | jour même, 22 h |
| Anniversaire, Baptême | jour même, 10 h | jour même, 20 h |
| Séminaire, Lancement de produit | jour même, 8 h | jour même, 19 h |
| Soirée d'entreprise | jour même, 14 h | jour même, 23 h 59 |
| Autre, et repli | jour même, 8 h | jour même, 22 h |

### Contrat interne

`modules/events/service.ts` expose `listBusyRanges(organizationId, { from, to, userId? })`, qui
renvoie `{ eventId, start, end, blocking }` en UTC. Il est calculé par une fonction pure
(`busy-ranges.ts`, testée avec une horloge simulée). Le flux d'agenda et le module Rendez-vous
l'appellent tous deux par le `service.ts` (ARC-01). `eventDays()` disparaît au profit des plages
ajoutées à `busy`.

### Écrans (maquettes à valider avant le code)

- **Paramètres › Évènements › Plages occupées** (nouvelle rubrique, à côté de « Types ») :
  - une ligne par type d'évènement (« Mariage : jour même 8 h → jour même 22 h »), modifiable en
    fenêtre ;
  - la ligne « Évènement sans type » ;
  - l'interrupteur « Les options bloquent aussi mon agenda ».
  - Le réglage d'une règle : deux couples « jour » (liste : 2 jours avant, la veille, le jour
    même, le lendemain…) et « heure ». Un aperçu en clair : « du vendredi 14 h au dimanche
    12 h ».
- **Fiche d'un évènement** : un bloc « Plage occupée » dans les informations clés, avec la règle
  appliquée en clair (« Samedi 12 juin, 8 h – 22 h, règle Mariage »). On y trouve aussi
  « Modifier pour cet évènement », « Revenir à la règle du type » et « Ajouter à mon agenda »
  (D5).
- **Écran « S'abonner à mon agenda »** : une phrase et un lien d'aide qui disent la limite :
  l'abonnement affiche, mais un outil de réservation extérieur ne le lit pas forcément ; d'où le
  fichier à importer, ou la page de rendez-vous de Symbola.
- **Aide contextuelle** : un article « Bloquer mon agenda les jours d'évènement », avec les deux
  chemins (outil extérieur, module Rendez-vous).

Textes en français et en anglais ; écran en 375 px ; axe-core.

Maquettes M1 à M5 : `docs/maquette/Plages-et-reservation.html`.

### Partie B — le module Rendez-vous remis d'aplomb (demande de Julien du 21/11/2026)

En regardant les écrans actuels, Julien a jugé ceux du module Rendez-vous « très moches ». Il
demande qu'on les reprenne dans ce lot, en suivant les bonnes pratiques du marché (Calendly pour
le choix du créneau, Typeform pour les questions). Maquettes M6 à M10, même fichier :

- **M6 — Ma semaine** (`app/rendez-vous/disponibilites`). Aujourd'hui, quatorze champs d'heure
  sont décalés du nom du jour. Proposé : une grille, une ligne par jour. Sur chaque ligne : un
  interrupteur ouvert ou fermé, les plages côte à côte avec leurs champs d'heure alignés en
  24 h, et « + Plage » (deux plages au plus, comme aujourd'hui). « Copier lundi sur les jours
  ouverts », un seul « Enregistrer ». Les jours fermés passent en liste éditable.
- **M7 — Réglage d'un type de rendez-vous** (`app/rendez-vous/reglages/types/[id]`).
  Aujourd'hui : une colonne de trente champs, dont les cinq questions possibles affichées même
  vides. Proposé :
  - un formulaire en grille (lot 62), en deux cartes : « Le rendez-vous » et « Quand on peut le
    réserver » ;
  - le lieu en choix segmenté ;
  - les questions en liste éditable, une ligne par question posée, ouverte en place. Les choix y
    deviennent des pastilles, et l'ordre se change par glisser-déposer. Un interrupteur dit si la
    question est obligatoire (D7).
- **M8 — Choisir un créneau** (`app/reserver/[adresse]`, et le même composant pour le
  déplacement par `/rdv` ; `/rendez-vous/nouveau` garde sa saisie libre de l'heure, l'équipe
  pouvant poser un rendez-vous hors des créneaux proposés, écart noté dans l'ADR 0109). Une fenêtre en trois colonnes : le
  rendez-vous, le mois, les heures du jour choisi.
  - Un jour sans créneau est barré et grisé, sans en dire la raison.
  - Un clic sur une heure la transforme en « 10:00 | Suivant ».
  - Sur téléphone, les colonnes deviennent des étapes, et l'action reste en bas, dans la zone du
    pouce.
- **M9 — Coordonnées, questions, confirmation.** Une étape à la fois (Typeform) : les
  coordonnées, puis une question par écran (touches A, B, C ; un choix passe à la suivante ;
  Entrée valide un texte), puis le récapitulatif et « Réserver ce rendez-vous ».
  - La confirmation propose « Ajouter à mon agenda » (fichier `.ics` pour le client) et
    « Déplacer ou annuler ».
  - La mention RGPD est résumée en une ligne, avec un lien vers le texte entier.
- **M10 — Téléphone (375 px)** : les trois mêmes étapes.

Ce qui ne change pas : le calcul des créneaux, la confirmation immédiate, la limitation de
débit, le piège à robots, le verrou par personne qui reçoit, le lien de gestion, les e-mails.
Les tests Playwright du module (`e2e/` du lot 46) suivent les nouveaux écrans, en taille
ordinateur et en 375 px. Clavier : chaque jour, chaque heure, chaque choix est atteignable et
annoncé (« jeudi 3 décembre, des créneaux libres » ; « vendredi 4 décembre, indisponible »).

## Décisions à prendre

- **D1 — Valeurs de départ.** (a) Le tableau ci-dessus. (b) Une seule règle, 8 h à 22 h, pour
  tous les types.
  *Recommandé : (a)*, chaque type a déjà sa clé de départ.
- **D2 — Les options bloquent-elles ?** (a) Non par défaut, réglable par l'organisation (une
  option n'est pas un engagement ; aujourd'hui elle ne bloque pas les rendez-vous). (b) Oui par
  défaut.
  *Recommandé : (a).*
- **D3 — Quel agenda est bloqué ?** (a) Si l'évènement a une équipe (responsable, assistants), le
  flux et les rendez-vous de ces personnes seulement ; sans équipe, toute l'organisation. C'est
  plus juste dès qu'il y a deux personnes. (b) Toute l'organisation, comme aujourd'hui.
  *Recommandé : (a).*
- **D4 — La plage dans le flux.** (a) Une seule entrée horaire, au titre actuel (« Mariage —
  Kévin et Kévina »), qui remplace la journée entière. (b) Deux entrées : la journée entière
  (pour l'affichage) et la plage occupée.
  *Recommandé : (a)*, sans doublon dans l'agenda.
- **D5 — Le fichier à importer.** (a) Oui, sur la fiche, avec une phrase claire : le fichier
  importé ne se met pas à jour seul, et il faut le réimporter après un changement de date ou
  d'heures. C'est le seul moyen, sans connexion à Google, pour que TidyCal voie la plage.
  (b) Non : le flux seul.
  *Recommandé : (a).*
- **D6 — Bornes des jours.** (a) De 7 jours avant à 7 jours après. (b) Sans borne.
  *Recommandé : (a)*, pour les calculs de fenêtre et l'erreur de saisie.

Décisions de la partie B (validées le 21/11/2026 : option a) :

- **D7 — Question obligatoire.** (a) Un interrupteur « Obligatoire » par question, désactivé par
  défaut. C'est un champ facultatif ajouté au JSON des questions (`required`), compatible avec
  l'existant, sans migration. (b) Toutes les questions restent facultatives, comme aujourd'hui.
  *Recommandé : (a).*
- **D8 — Une description du rendez-vous** (« Faisons connaissance : vos envies, votre date… »,
  colonne de gauche de M8). (a) Un champ de 300 caractères au plus sur le type de rendez-vous,
  donc une migration 0203 dans le schéma `appointments`. (b) Pas de description.
  *Recommandé : (a)*, c'est ce qui rassure le client avant de réserver.
- **D9 — Un lot ou deux.** (a) Une seule PR, en deux paquets de commits : les plages occupées,
  puis la réservation. Les deux touchent le calcul des créneaux et les mêmes écrans. (b) Un
  lot 65 à part pour la partie B.
  *Recommandé : (a).*

## Tests

- `busy-ranges.test.ts` : règle du type, règle « sans type », réglage propre, report recalé,
  veille et lendemain, fin à 23 h 59, passage à l'heure d'été et retour, statuts qui bloquent ou
  non, option selon le réglage, essai exclu.
- `ics.test.ts` : `TRANSP:OPAQUE` et `TRANSPARENT`, plage en UTC, fichier d'un seul évènement.
- `slots.test.ts` et intégration du module Rendez-vous : aucun créneau dans la plage ni dans
  ses marges ; créneau libre hors de la plage ; `allow_event_days` respecté ; module Évènements
  fermé sans erreur.
- Isolation (`packages/testing`) : organisation A contre B sur les règles, les réglages et le
  flux ; rôle en lecture seule refusé.
- Playwright, ordinateur et 375 px : régler la règle Mariage ; poser le réglage de Kévin et
  Kévina ; voir l'aperçu ; télécharger le fichier.
- Rejeu : SC-02 (prise de rendez-vous) sur le jeu fictif, avec un mariage confirmé le jour
  visé, puis `docs/recette/SC-02.md`.

## Fichiers touchés (prévision)

- `packages/db/src/schema/events.ts`, `packages/db/drizzle/0202_lot64_events_busy_ranges.sql`
  (et son annulation).
- `packages/starter-templates/src/event-types.json`.
- `apps/symbola/modules/events/` : `busy-ranges.ts` (neuf), `service.ts`, `repository.ts`.
- `apps/symbola/lib/calendar/ics.ts` (propriété `transparency`), `feeds.ts`.
- `apps/symbola/modules/appointments/service.ts` (plages au lieu de jours).
- `apps/symbola/app/events/parametres/plages-occupees/` (neuf), fiche
  `app/events/[id]/`, route du fichier `.ics` d'un évènement, écran d'abonnement.
- Traductions FR/EN, aide, `docs/gap.csv` (HUB-29, RDV-02), ADR 0109.
- Partie B : `app/rendez-vous/disponibilites`, `app/rendez-vous/reglages/types/[id]`,
  `app/reserver/[adresse]` (composant de choix du créneau, réemployé par `/rendez-vous/nouveau`
  et `/rdv`), questions une par une ; si D8 (a), migration 0203 dans `appointments`.

## Hors périmètre

- Écrire directement dans Google, Apple ou Outlook (OAuth, CalDAV) : écarté le 21/11/2026,
  à rouvrir par un ADR si le fichier à importer ne suffit pas.
- Plusieurs plages pour un même évènement (par exemple, un repérage la semaine d'avant) : la
  planner crée un rendez-vous ou un évènement à part.
- Les séquences du programme dans le flux d'un évènement : inchangées.
