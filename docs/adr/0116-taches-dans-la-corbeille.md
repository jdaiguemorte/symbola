# ADR 0116 — Les tâches vont à la Corbeille (avenant à l'ADR 0073)

- Statut : accepté (lot 70a ; décision A5 de Julien du 26/11/2026, « Oui, Corbeille »)
- Date : 2026-11-26
- Modifie : [0073](0073-suppression-logique-corbeille-et-annuler.md), point 6 (« éléments d'une fiche »).
- Exigences : HUB-17 (corbeille de 30 jours), UX-07 (« Annuler » pendant dix secondes), DAT-03 ;
  spécification `docs/lots/lot-70-taches-et-transverse.md` (§ 3.2, critère 7 du paquet 70a).

## Contexte

L'ADR 0073 (D6) rangeait la tâche parmi les « éléments d'une fiche » : la suppression la marque,
« Annuler » la rend pendant dix secondes, puis la purge l'efface dix minutes après ; elle ne paraît pas
dans la Corbeille. La maquette validée par la planner (volet 1 de l'audit UX, page 4) dit au contraire
« Tâche supprimée … Elle reste dans la Corbeille des Paramètres », et une sélection de plusieurs tâches
supprimées d'un geste y fait une seule ligne. Une tâche porte du travail (note, pièces jointes,
commentaires, échéance relative au jour J) : la perdre dix minutes après un geste malheureux n'est pas
le sens d'UX-07 ni de HUB-17.

## Décision

1. Une tâche supprimée (d'un évènement ou hors évènement) reste **trente jours** à la Corbeille, comme
   un objet (`TRASH_KINDS` gagne `task`), puis la purge horaire l'efface, pièces jointes comprises
   (fichiers dans Garage). « Annuler » pendant dix secondes reste offert, comme avant.
2. **Un geste, une ligne** : les tâches supprimées d'un même geste (même date de suppression à la
   microseconde et même auteur, la règle de « Annuler » d'un lot depuis le lot 63d) forment une seule
   ligne, dite par leur évènement (« 3 tâches de Léa & Maxime »). La restaurer les rend toutes, à leur
   place ; « Supprimer définitivement » (titulaire seule) les efface toutes.
3. Les tâches d'un évènement à la corbeille n'y paraissent pas une à une : elles suivent l'évènement.
4. Aucune migration : `deleted_at` et `deleted_by` existent (lot 39a). Seuls changent le délai de purge
   des tâches et la liste de la Corbeille. Les autres éléments d'une fiche (séquence, lieu, commentaire,
   note de contact, lignes de budget et de devis) gardent la règle de l'ADR 0073.

## Conséquences

- La Corbeille montre plus de lignes ; le lot les regroupe pour qu'elle reste lisible.
- Un bandeau « Annuler » posé avant ce lot (cookie de nature `task` ou `taskBatch`) reste compris.
- Le paquet 70b met « Supprimer définitivement » au niveau 3 des dangers (case « Je comprends… ») sur la
  même page ; ce paquet ne change que ce qui y entre et le libellé d'une ligne de tâches.
