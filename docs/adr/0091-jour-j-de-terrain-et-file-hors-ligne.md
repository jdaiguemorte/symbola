# ADR 0091 — Jour J de terrain : un chrono par temps fort, pointages ajoutés, file d'actions hors ligne écrite à la main

- Statut : accepté (spécification du lot 51 validée par Julien le 18/11/2026, décisions D1 à D8
  dans leur option a)
- Date : 2026-11-18
- Complète : [0064](0064-jour-j-hors-ligne.md) (jour J hors ligne en lecture, service
  worker écrit à la main), [0071](0071-programme-diffuse-et-releve-de-stockage.md) (versions diffusées du
  programme), [0027](0027-telechargements-servis-par-l-app.md) (fichiers servis par l'app après contrôle des
  droits), [0076](0076-file-des-taches-et-adaptateur-e-mail.md) (file des tâches), [0012](0012-base-unique-schemas-logiques-pour-le-mvp.md)
  (un schéma par module).
- Exigences : EVT-04, CHR-08, JRJ-05 à JRJ-09, ARC-09 (file d'actions), NFR-09 ; parcours PAR-08
  (étapes 4 à 7), scénario SC-08 ; `docs/lots/lot-51-jour-j-de-terrain.md`. Point ouvert DPO-9
  (fiche de la DPO, question 16).

## Contexte

Les lots 29 et 30 ont livré le jour J en lecture, même sans réseau. Le terrain demande d'écrire :
pointer, décaler la suite quand une séquence prend du retard et prévenir les prestataires, noter un
incident en dix secondes, cocher des listes, pointer les remises, puis disposer d'un bilan le
lendemain. Le réseau d'un lieu de mariage va et vient : toute écriture doit marcher sans lui, et
plusieurs membres de l'équipe écrivent en même temps.

## Décision

1. **Un chrono par temps fort** (D1) : `events.program_items.key_moment_id`, donc un jour par
   séquence. La colonne reste facultative en base (ancien code compatible, ARC-14) ; l'app rattache
   toute séquence nouvelle au premier temps fort du jour de l'évènement, créé de lui-même s'il n'y en
   a pas (`key_moments.auto_created`, nom des données de départ `day-of.json`). La migration 0165 fait
   de même pour les évènements datés qui ont un programme ; un évènement sans date garde ses
   séquences sans temps fort. Le temps fort créé de lui-même n'est pas proposé aux invités tant que
   la planner ne l'a pas modifié : rien ne change pour eux. L'annulation de 0165 est refusée tant que
   le jour J a une trace ou qu'une séquence vit sur un autre jour que celui de l'évènement. Les modèles
   de programme portent un temps fort et un décalage de jour par ligne (week-end de mariage).
2. **Import d'un chrono** (CHR-08) dans le module Évènements, sans la file d'import du hub (aucune
   migration `hub`) : moteur d'import commun (cellules = + - @ neutralisées), intitulés reconnus dans
   `program-import-columns.json`, aperçu recalculé du même fichier avant d'écrire (comme l'import
   des invités, lot 49), temps forts manquants créés.
3. **Pointages ajoutés, jamais écrasés** (JRJ-08) : `day_checkpoints` garde chaque pointage (qui,
   séquence, commencé ou terminé, heure de l'appareil, identifiant d'action). L'écran retient le
   premier de chaque nature ; deux pointages simultanés restent tous les deux.
4. **Décalage validé** (JRJ-05, D3) : le retard se constate sur le téléphone (règle pure
   `lib/day-of/rules.ts`, seuil `day-of.json`) ; la planner choisit les séquences et les
   prestataires, puis valide ou refuse. **Seule une validation est envoyée** (`day_shifts`) ; à
   l'arrivée, le programme est décalé dans la même transaction que l'enregistrement, une version est
   diffusée (CHR-07), puis chaque prestataire concerné (lien actif de son poste) reçoit l'e-mail du
   programme diffusé (nature `program_published` existante, PDF de son poste) ; son espace affiche le
   décalage en tête. La ligne est réservée avant l'envoi et chaque e-mail a sa clé dans la file des
   tâches (`day-shift:<décalage>:<lien>`) : une validation rejouée ne renvoie rien. Un décalage qui
   sortirait du jour, ou dont une séquence a disparu, est gardé pour le bilan sans être appliqué.
5. **File d'actions hors ligne écrite à la main** (ARC-09, D7) : IndexedDB
   (`lib/offline/action-queue.ts`, base `symbola-jour-j-file`), sans dépendance. Chaque action a un
   identifiant créé sur le téléphone, unique par organisation en base : le serveur ignore une action
   déjà reçue (« duplicate »), si bien qu'un lot dont la réponse s'est perdue se rejoue sans risque.
   Envoi dans l'ordre, par lots, dès que le réseau revient et que l'écran est ouvert ; un seul envoi à
   la fois. Une session expirée garde la file (réponse 401) ; seule l'action de son auteur part, avec
   sa session. Une action refusée pour de bon sort de la file et se signale. Après chaque envoi
   réussi, la copie de lecture du lot 29 se met à jour. Le service worker est inchangé : il ne touche
   pas aux requêtes POST.
6. **Photos** (JRJ-06, JRJ-07, JRJ-09) : réduites sur le téléphone (2 000 px, JPEG), mises en file,
   puis contrôlées à l'arrivée (taille, antivirus, type par le contenu) et rangées dans le stockage
   privé ; servies par l'app à l'équipe seulement (ADR 0027). Une photo refusée garde une ligne sans
   fichier (`day_photos.state = rejected`), l'écran le dit, l'incident ou la case restent. « Photo »
   est un champ fichier avec `capture` : un toucher ouvre l'appareil, le déclencheur la joint.
7. **Dictée par le clavier du téléphone** (D2) : le champ de l'incident s'ouvre avec le clavier,
   dont le micro dicte ; ni Web Speech API ni donnée vocale chez Symbola.
8. **Rafraîchissement** (D4) : l'état partagé (`/jour-j/<évènement>/etat`) se relit toutes les 15 s en
   ligne et au retour au premier plan, en JSON ; pas de connexion permanente.
9. **Remises dans le budget** (D8) : `budget.vendor_payments` porte la marque « à remettre le jour
   J », le moyen (texte libre, comme le moyen d'un règlement déclaré) et la personne qui remet ; la
   remise pointée règle l'échéance au jour de la remise dans le fuseau de l'évènement, par le service
   du budget. La photo du reçu est une photo du jour J (`handover_receipt_photo_id`, identifiant
   d'une ligne de `events.day_photos`), plutôt qu'une clé de fichier tenue par le budget : les photos
   du jour J se purgent ensemble.
10. **Bilan du lendemain** (PAR-08, étape 7) : calculé à la demande, prêt le lendemain du dernier jour
    de l'évènement à minuit dans son fuseau ; la dernière synthèse se garde (`day_reports`) et se
    refait tant que des actions arrivent. L'heure prévue d'origine se retrouve en retirant les
    décalages appliqués. Export PDF côté serveur ; interne à l'organisation.
11. **Qui** (D5) : les membres de l'organisation qui ouvrent le jour J ; les renforts sans compte
    viendront au lot 52. Les notifications push viendront au lot 53 (D6).

## Conséquences

- Écarts assumés avec la prévision de la spécification : une table `day_photos` commune (plutôt
  qu'une colonne photo par table), `handover_receipt_photo_id` au lieu de `handover_receipt_key`,
  pas de colonne `handover_on_day` sur un autre objet que l'échéance. Le texte de l'e-mail du
  décalage est le modèle « programme diffusé » de l'organisation ; la phrase « Décalage de 20 min »
  est en tête de l'espace du prestataire et l'horaire à jour dans son PDF.
- La file reste sur le téléphone tant qu'elle n'est pas envoyée, déconnexion comprise (rien ne se
  perd) ; elle n'est pas chiffrée par l'application (verrouillage du téléphone), comme la copie de
  lecture. Registre RGPD et fiche de la DPO (DPO-9) à jour.
- Hors périmètre : SMS aux prestataires (avec le fournisseur de SMS, Q34), notifications push
  (lot 53), renforts sans compte (lot 52), plan de salle (lot 60).
