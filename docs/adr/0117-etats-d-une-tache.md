# ADR 0117 — Les états d'une tâche : sans « En cours », avec « Bientôt »

- Statut : accepté (lot 70a ; décision Q47-4 de Julien du 26/11/2026, « Oui, sans En cours »)
- Date : 2026-11-26
- Diverge de : `docs/CAHIER_DES_CHARGES.md`, patrons d'interface (« Statuts : À faire, En cours, En
  attente d'un tiers, Fait, En retard »).
- Exigences : UX-06, UX-14, CHR-05, UX-01 ; maquettes du volet 1 (page 5, M10) ; spécification
  `docs/lots/lot-70-taches-et-transverse.md` (§ 9 point 4, critère 6 du paquet 70a).

## Contexte

Le cahier des charges cite cinq statuts de tâche. Les maquettes validées par la planner n'ont pas
« En cours » : une tâche de wedding planner se fait ou ne se fait pas, et un état intermédiaire saisi à
la main n'est jamais tenu à jour. Elles ajoutent « Bientôt » (« Dans 4 jours ») et disent l'attente
d'un tiers par la personne qui s'en charge (« Les mariés », un prestataire) plutôt que par un statut.
L'app calculait « en retard » à trois endroits (service, tableau, compteurs), chacun à sa façon.

## Décision

1. Une tâche est **à faire** ou **faite** (`done_at`, avec qui l'a cochée). Pas d'« En cours ».
2. L'état d'échéance d'une tâche à faire est **calculé**, jamais saisi : en retard (avant aujourd'hui,
   avec le nombre de jours), aujourd'hui, demain, **bientôt** (jusqu'au seuil de l'organisation,
   7 jours au départ, `events.planning_health_settings.soon_days`, de 1 à 30), plus tard. Une tâche
   faite n'a pas d'état d'échéance.
3. « Aujourd'hui » est le jour à Paris (`Europe/Paris`) ; les écarts se comptent en jours de
   calendrier, si bien qu'un changement d'heure ne fait ni gagner ni perdre un jour.
4. **Un seul calcul** (`modules/events/due-state.ts`, exposé par le service) lu par la liste des
   tâches, le tableau, les compteurs, et demain la ligne type (paquet 70c) et le téléphone (70f).
5. « En attente d'un tiers » se lit dans « Qui s'en charge » (les clients, un prestataire), pas dans un
   statut.
6. Chaque état se dit par un mot et une icône, jamais la couleur seule (inchangé, UX-14).

## Conséquences

- Écart assumé avec la liste des statuts du cahier des charges, noté dans `docs/gap.csv` (UX-14,
  CHR-05).
- Le seuil « Bientôt » est gardé et lu dès ce lot ; l'écran qui le règle attend le volet
  « Paramètres ». Sa valeur de départ est une donnée (`planning-health.json`, `soonDays`).
- L'horizon d'« Aujourd'hui » (14 jours) reste une autre règle (volet « Aujourd'hui »).
