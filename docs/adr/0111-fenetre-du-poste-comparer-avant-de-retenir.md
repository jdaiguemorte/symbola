# ADR 0111 — La fenêtre du poste ; comparer avant de retenir

- Statut : accepté. Spécification du lot 65 validée par Julien le 22/11/2026 ; maquette M14
  (`docs/maquette/Recette-staging-22-11.html`).
- Date : 2026-11-22
- Complète : [0107](0107-fenetre-pour-modifier-panneau-pour-les-reglages.md) (fenêtre pour modifier) ;
  reprend la décision D6 du lot 47 ([0085](0085-prestataires-par-lien-et-choix-qui-engage.md)) pour changer de prestataire
  retenu.
- Exigences : PRE-02, BUD-04, BUD-05, UX-03 de `docs/CAHIER_DES_CHARGES.md` ; spécification
  `docs/lots/lot-65-retours-staging.md`, paquet 65b.

## Contexte

Recette staging du 22/11/2026, retours de la wedding planner sur le budget :

- dans « Choisir un prestataire… » (lot 63c), cliquer un nom **retenait d'office** le prestataire ;
- la comparaison n'était qu'un lien discret, et sans taper un nom on ne voyait que peu de fiches ;
- une fois un prestataire retenu, rien ne permettait de changer d'avis sans supprimer la ligne ;
- un clic sur la ligne ouvrait, **en bas de la page**, un bloc où le statut, l'icône, les champs
  importés et les prestataires consultés étaient empilés : on perdait sa place.

## Décision

1. **Deux gestes, jamais d'office.** « + Ajouter des prestataires » montre tout le carnet du métier
   du poste sans rien taper, avec « Voir tout le carnet (N) ». Chaque fiche propose « Comparer »,
   qui l'ajoute à la comparaison au statut « Pressenti », ou « Retenir ». Une fiche créée sur place
   entre dans la comparaison ; « Créer et retenir » reste possible.
2. **La fenêtre du poste** (ADR 0107) remplace le bloc du bas de page. Elle s'ouvre par « Ouvrir »
   ou par un clic sur la ligne, et `?poste=<id>` l'ouvre d'emblée (liens des autres écrans,
   tutoriels). Elle a cinq rubriques numérotées : Prestataires, Montants, Échéancier, Documents,
   Réglages du poste. « Poste précédent » et « Poste suivant » enchaînent les postes. Sur téléphone,
   elle prend la page entière.
3. **La comparaison côte à côte** montre, pour chaque prestataire : où on en est, le devis (montant
   et PDF), la disponibilité le jour J, « Déjà travaillé ensemble » (nombre d'évènements où il a été
   retenu), la dernière relance et la dernière note interne. Le retenu passe en tête, les écartés
   restent visibles, grisés.
4. **Changer d'avis sans supprimer.** Une fois un prestataire retenu, ses gestes sont « Changer de
   prestataire » (les autres proposent alors « Retenir à la place ») et « Ne plus retenir ». Les deux
   reprennent le changement de retenu du lot 47 (D6) : l'engagé de l'ancien retenu est libéré par
   l'événement interne `events.vendor_retention.released`, ses tâches de suivi non commencées sont
   retirées. Un écarté peut être « Remis en comparaison ».
5. **Seuil d'alerte** : retenir au-delà du seuil d'alerte du budget demande toujours une
   confirmation (BUD-02), quel que soit le geste.
6. Le détail de chaque prestataire (statut, devis à joindre, notes) reste le composant du lot 63d.
   Il est replié sous la comparaison, dans la rubrique Prestataires. La demande de devis (brief,
   envoi) garde son écran, ouvert par un lien de la rubrique.

## Conséquences

- Aucune migration : statuts, comparaison et changement de retenu existaient (lots 28a, 47).
- La ligne du tableau dit où en est le choix : « Retenu », « N en comparaison · K devis reçus »,
  ou « À trouver » avec « + Ajouter des prestataires ».
- Sans le module Budget, l'ancienne vue en deux colonnes reste (dégradation propre, ARC-06).
- Les parcours e2e qui passaient par le bloc du bas de page ouvrent désormais la fenêtre du poste
  (`openSlotWindow`, `openSlotDetails` dans `e2e/helpers.ts`).
