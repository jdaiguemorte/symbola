# ADR 0109 — Plages occupées par type et par évènement ; réservation à la manière des outils du marché

- Statut : accepté. Spécification du lot 64 validée par Julien le 21/11/2026 : décisions D1 à D9
  retenues dans leur option recommandée (a) ; maquettes M1 à M10.
- Date : 2026-11-21
- Complète : [0072](0072-emails-a-l-image-de-l-organisation.md) (flux ICS),
  [0082](0082-module-rendez-vous-et-agendas-connectes.md) (module Rendez-vous ; revoit sa décision D6,
  « jours d'évènement confirmé »), [0094](0094-equipe-et-acces.md) (équipe de
  l'évènement).
- Exigences : HUB-29, RDV-01, RDV-02, RDV-03 de `docs/CAHIER_DES_CHARGES.md` ; spécification
  `docs/lots/lot-64-plages-occupees.md`.

## Contexte

Recette du 21/11/2026 : la planner prend ses rendez-vous avec un outil extérieur (TidyCal). Abonnée à
son agenda Symbola, elle voit pourtant TidyCal proposer des rendez-vous le jour d'un mariage. Deux
raisons :

1. Le flux exportait chaque évènement en journée entière, sans `TRANSP`. Les agendas l'affichent
   souvent comme « disponible », et une journée entière ne dit pas « de 8 h à 22 h ».
2. Un agenda abonné n'est qu'une copie affichée. Les outils de réservation lisent l'agenda principal
   du compte relié, et souvent ne lisent pas les agendas ajoutés par adresse.

Écrire directement dans Google ou Outlook (OAuth) réglerait le second point. Cela demande la
validation de l'application par Google et des jetons à garder ; Julien l'a écarté pour l'instant.

## Décision

1. **Une plage occupée par type d'évènement** (D1), réglée dans Paramètres › Évènements › Plages
   occupées.
   - Début et fin : chacun un jour relatif à la date de l'évènement, de sept jours avant à sept jours
     après (D6), et une heure locale, dans le fuseau de l'évènement.
   - Colonnes nulles sur `events.event_types` = la règle de départ de la clé du type, lue dans
     `event-types.json` (aucune valeur en dur).
   - Les types créés par l'organisation et les évènements sans type suivent la règle de repli,
     réglable (`events.busy_settings`).
2. **Un réglage propre à un évènement** (colonnes nulles sur `events.events` = la règle du type).
   Les jours étant relatifs, un report garde le réglage : la veille et le lendemain de la nouvelle
   date.
3. **Ce qui bloque** (D2) :
   - toujours : confirmé, en préparation, clôturé ;
   - une option ou un report en cours seulement si l'organisation l'a réglé (désactivé au départ) ;
   - jamais : annulé, essai, évènement sans date.
4. **Qui est bloqué** (D3) : l'équipe de l'évènement si elle est désignée, sinon toute l'organisation.
5. **Flux d'agenda** (D4) : un évènement de la personne est sa plage, aux heures locales en UTC.
   - Il est marqué `TRANSP:OPAQUE` s'il bloque, `STATUS:TENTATIVE` et `TRANSP:TRANSPARENT` sinon.
   - L'évènement d'une autre équipe reste une journée entière, libre.
6. **Fichier à importer** (D5) : « Ajouter à mon agenda », sur la fiche, télécharge un fichier
   iCalendar d'un seul évènement, sa plage occupée. Importé dans l'agenda principal, il est vu par
   l'outil de réservation extérieur. L'écran dit qu'il ne suit pas les changements.
7. **Page de rendez-vous** : les plages qui bloquent s'ajoutent aux plages occupées du calcul des
   créneaux (`slots.ts`), à la place du jour entier de l'ADR 0082 (D6). Le reste du jour reste
   réservable. « Accepter ce rendez-vous pendant une plage occupée » garde le sens de
   `allow_event_days`.
8. **Réservation à la manière du marché** (D9, une seule PR) :
   - une fenêtre en colonnes (le rendez-vous, le mois, les heures du jour choisi, « 10:00 |
     Suivant ») ;
   - puis une étape à la fois : coordonnées, une question par écran, récapitulatif ;
   - le même sélecteur sert au déplacement par lien (`/rdv`) ;
   - une question peut être obligatoire (D7 : champ facultatif `required` dans le JSON des questions,
     sans migration) ;
   - un type peut porter une courte description (D8, migration 0203).

## Conséquences

- Migrations **0202** (`events` : colonnes de règle, `busy_settings` sous RLS) et **0203**
  (`appointments` : description d'un type). Ajouts seuls, annulables ; l'annulation est refusée tant
  qu'un réglage ou une description existe. Numéros pris après ceux du lot 63 (0196 à
  0201, 0201 pour le lot 63b) ; le lot 64 est fusionné après lui et ses migrations s'appliquent en
  dernier.
- **Aucun nouveau sous-traitant**, aucune dépendance. La frise de l'aperçu et la barre d'avancement
  sont en SVG, parce que la CSP refuse les attributs `style`.
- `/rendez-vous/nouveau` garde sa saisie libre de l'heure : l'équipe peut poser un rendez-vous hors
  des créneaux proposés. C'est un écart assumé à la maquette M8.
- **Hors périmètre** :
  - écrire dans Google, Apple ou Outlook (OAuth, CalDAV) ;
  - plusieurs plages pour un même évènement ;
  - le choix du fuseau par le client (RDV-05).
