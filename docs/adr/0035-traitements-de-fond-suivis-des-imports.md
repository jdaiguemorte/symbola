# ADR 0035 — Traitements de fond suivis des imports

- Statut : accepté (07/11/2026, décisions O et P du lot 15 validées par Julien)
- Date : 2026-11-07
- Complète : [0014](0014-evenements-internes-pour-le-mvp.md), [0022](0022-import-lecteur-xlsx-et-orchestration.md), [0034](0034-lecture-des-pdf-pour-l-import.md)

## Contexte

Deux opérations de l'import dépassent ce qu'une planner peut attendre devant un bouton grisé
(`docs/lots/lot-15-traitements-longs.md`) :

- la **lecture de 50 fiches PDF** (antivirus et lecture, jusqu'à 10 s par fiche au pire) ;
- le **placement sur la carte de 200 prestataires**, qui faisait un appel au service de
  géocodage de l'IGN par fiche, l'un après l'autre, avant d'afficher le résultat.

Il faut que l'écran rende la main, que l'avancement soit visible, et que rien ne se perde si
la page est fermée ou si le serveur redémarre.

## Décision

1. **Une table `hub.import_jobs`** (organisation, import, nature, statut, total, fait,
   résultat, motif ; RLS forcée) décrit chaque traitement de fond : `read_sheets` (lecture des
   fiches déposées) ou `place_vendors` (placement des prestataires importés).
2. **Un worker dans le serveur** (`lib/import-jobs.ts`, lancé par `instrumentation.ts`, toutes
   les secondes, un passage à la fois par processus) fait avancer les traitements **pas à pas** :
   une fiche lue, ou un paquet de 50 prestataires placés. Pas de file de messages ni de
   dépendance : même patron que le worker des événements internes (ADR 0014). Un passage
   travaille au plus 2 secondes, pour que l'avancement se voie.
3. **Chaque pas est validé avec l'avancement, dans la même transaction**, à la condition que
   l'avancement n'ait pas bougé depuis sa lecture : deux passages simultanés n'écrivent jamais
   deux fois le même pas, et un traitement interrompu reprend au pas suivant.
4. **Fiches gardées chiffrées le temps de leur lecture** (choix de Julien, décision P) : au
   dépôt, chaque fiche est chiffrée par l'app en **AES-256-GCM** (bibliothèque standard de Node,
   clé aléatoire propre à chaque fiche), puis rangée dans le stockage privé (Garage, qui ne
   chiffre pas au repos). La clé est gardée en base, à part du fichier. Une fois la fiche lue
   (ou l'import abandonné, expiré, annulé), le fichier est supprimé du stockage et la clé de la
   base ; la liste des fiches (noms compris) est vidée à la fin de la lecture. Une fiche trop
   grosse ou qui n'est pas un PDF est refusée au dépôt, sans être gardée.
5. **Placement sur la carte en lot** (décision O) : adresses dédoublonnées, point déjà connu
   dans le carnet de l'organisation réutilisé, le reste en **un envoi CSV** au service de
   l'IGN (code postal en filtre, marque UTF-8 en tête, vérifiés sur le service réel le
   07/11/2026), repli adresse par adresse sous 40 requêtes par seconde. Un point placé à la
   main n'est jamais écrasé.
6. **Avancement à l'écran** : barre réelle (`progress`, « 12 sur 50 »), rafraîchie toutes les
   2 secondes, annoncée aux lecteurs d'écran à chaque quart et à la fin ; un traitement en
   échec se relance et reprend là où il s'était arrêté.

## Conséquences

- La confirmation d'un import de prestataires rend la main tout de suite ; la carte se remplit
  dans la minute. Pour l'export de la planner (201 prestataires), un ou deux envois au lieu de
  200 appels.
- Les fiches PDF existent quelques secondes à quelques minutes dans le stockage, chiffrées ;
  l'ADR 0034 est mis à jour en conséquence.
- Le worker tourne dans le processus de l'app : un seul serveur au MVP. Avec plusieurs
  instances, la règle du point 3 évite les doublons ; une vraie file (NATS, cible du cahier des
  charges) pourra remplacer le worker sans changer la table ni les écrans.
- Les tests font tourner les traitements jusqu'au bout pour leur seule organisation
  (`runImportJobsUntilIdle([organizationId])`), car les fichiers de tests tournent en parallèle.
