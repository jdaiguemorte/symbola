# ADR 0106 — Rétroplanning proposé à la création, jamais posé d'office

- Statut : accepté (décision de Julien du 21/11/2026, retour #26 de la recette de la planner).
- Date : 2026-11-21
- Remplace, pour EVT-01 : la décision D8 du lot 34a, inscrite dans l'ADR
  [0055](0055-statuts-d-evenement-et-retroplanning-a-la-creation.md) (« le rétroplanning du type naît
  avec l'évènement, Option comprise »).
- Exigences : EVT-01, CHR-01, HUB-21 ; spécification `docs/lots/lot-63-retours-recette-planner.md`
  (paquet 63c), analyse `docs/audits/2026-11-21-recette-planner.md` (§ 5), maquette M7.

## Contexte

Depuis le lot 34a, un évènement recevait à sa création le modèle de rétroplanning de son type, et,
faute de modèle pour ce type, le **premier modèle créé** de l'organisation (`findDefaultTaskTemplateId`).
En pratique, ce premier modèle est celui du mariage : un prospect de type « Autres » ou un shooting
photo recevait des tâches de mariage. La même règle s'appliquait à la première date posée sur un
évènement sans tâches, et aux demandes reçues par le formulaire de contact public.

## Décision

1. **Aucun rétroplanning d'office.** Ni à la création (fiche, création rapide, import, formulaire de
   contact, modèle d'évènement), ni à la première date. `createProspect` n'applique qu'un modèle
   **choisi** (`taskTemplateId`), et seulement si l'évènement a une date : les tâches en sont datées.
   Un modèle d'une autre organisation n'est pas lu (RLS) et refuse la création.
2. **Proposé à la création**, dans le formulaire « Nouveau » (M7) :
   - si le type a un modèle rattaché (le premier créé s'il y en a plusieurs,
     `findTaskTemplateForEventType`) : une case « Partir du rétroplanning « <modèle> » (N tâches) »,
     **cochée** pour un évènement confirmé, **décochée** pour un prospect, avec « Voir les tâches » ;
     sans date, la case attend la date ;
   - si le type n'a pas de modèle : une astuce, et « Créer un modèle pour « <type> » » dans le panneau
     latéral, sans quitter le formulaire ; le modèle créé est rattaché au type et proposé aussitôt.
3. **Plus jamais le modèle d'un autre type** : le serveur refuse un modèle qui n'est pas celui du type
   choisi. Un modèle s'applique plus tard depuis l'onglet Rétroplanning (inchangé, « prochaine étape »
   de la fiche).
4. Inchangé : les tâches déjà faites ne bougent pas quand la date change (CHR-01) ; le recalcul des
   autres est proposé, jamais imposé.

## Conséquences

- Le contrat interne `CreateProspectInput` perd `applyTemplate` (le défaut s'inverse) et gagne
  `taskTemplateId` ; `prospectSourceId` devient facultatif pour un évènement confirmé (changement
  compatible : un champ requis devient facultatif). Les appelants qui passaient `applyTemplate: false`
  n'ont plus rien à passer.
- Les demandes reçues par le formulaire de contact restent des prospects sans tâches.
- Le repli `findDefaultTaskTemplateId` n'est plus appelé ; le paquet 63a le corrige de son côté (plus
  de repli sur le premier modèle), sans effet sur ce qui précède.
- SC-01, étape 5 : un mariage confirmé a bien son rétroplanning, la case étant cochée par défaut.
- Tests : `modules/events/lifecycle.integration.test.ts` (« EVT-01, CHR-01, HUB-21 — Le rétroplanning
  proposé à la création, jamais d'office »), `app/events/new/new-event-mode.test.ts`.
