# ADR 0119 — Le panneau d'une tâche s'enregistre d'un bouton, et demande avant de fermer

- Statut : accepté (lot 70c ; décision M1 de la porte 3 du lot 68, confirmée par Julien le 26/11/2026,
  « Oui, l'ADR »)
- Date : 2026-11-27
- Diverge de : `docs/CAHIER_DES_CHARGES.md`, patrons d'interface (« Fermer le panneau enregistre »),
  UX-09 (« Enregistrement automatique ») et l'anti-patron « Un bouton « Enregistrer » dont l'oubli
  fait perdre le travail ».
- Complète : ADR 0074 (brouillon gardé, `DraftKeeper`), ADR 0107 (la tâche s'ouvre dans une fenêtre,
  sur l'écran d'où l'on vient).
- Exigences : CHR-02, UX-09, UX-10 ; maquettes du volet 1 (page 1, M1) ; spécification
  `docs/lots/lot-70-taches-et-transverse.md` (§ 5.3, critère 5 ; § 9 point 1).

## Contexte

Le cahier des charges veut qu'un panneau s'enregistre en se fermant, ou champ par champ. Les maquettes
validées par la planner (porte 3) gardent un bouton « Enregistrer » pour la tâche : une tâche se
modifie en plusieurs champs liés (échéance, personne, note), et la planner veut décider quand ses
changements partent, surtout quand la tâche est vue des mariés ou d'un prestataire. Le risque connu
d'un bouton « Enregistrer », c'est la saisie perdue en fermant sans y penser.

## Décision

1. Le panneau unique d'une tâche (`app/ui/task-panel.tsx`), en édition comme en création, s'enregistre
   **d'un bouton** : « Enregistrer » (« Créer la tâche » en création), le seul bouton plein du panneau.
   Tous les changements partent d'un coup, jamais champ par champ.
2. **« Fait » enregistre aussi** les changements en cours, dans la même écriture que la coche (une
   tâche d'évènement), ou juste avant elle (une tâche hors évènement, pour que sa répétition fasse
   naître la suivante).
3. **Fermer sans perdre** : « Fermer », la croix, la touche Échap et « ← {écran} » sur téléphone
   ferment tout de suite s'il n'y a rien de changé. S'il reste des changements, le **pied du panneau**
   demande « Fermer sans enregistrer ? » en nommant les champs changés (« La note de « Choisir le
   fleuriste » a changé ») avec « Revenir à la tâche », « Fermer sans enregistrer » et « Enregistrer et
   fermer ». Jamais de seconde fenêtre par-dessus (règle « jamais deux fenêtres empilées » de
   `DESIGN.md`).
4. Ce qui compte comme changé se calcule sans React (`lib/tasks/task-panel-model.ts`) : des espaces
   autour du titre ou de la note ne comptent pas.
5. Les gestes rapides de la ligne (« Fait », « Changer la date », « Confier à ») ne passent pas par le
   panneau : ils s'appliquent tout de suite, avec « Annuler » dans le message de retour (UX-07).

## Conséquences

- Écart assumé avec le cahier des charges, noté dans `docs/gap.csv` (UX-09, CHR-02).
- La garde « Fermer sans enregistrer ? » empêche la perte silencieuse dans l'app. Si l'onglet du
  navigateur se ferme, la saisie du panneau n'est pas gardée en brouillon dans ce lot (`DraftKeeper`
  n'y est pas branché) : à reprendre si la planner le demande.
- Les rubriques de la colonne de droite (pièces jointes, commentaires, place dans le rétroplanning)
  gardent leurs propres boutons, qui agissent tout de suite comme avant : elles ne font pas partie du
  brouillon du panneau.
