# ADR 0031 — Prestataires consultés, carnet de prestataires et carte

- Statut : accepté
- Date : 2026-11-04
- Avance : l'app « Prestataires et carte interactive » du cahier des charges (§ 5.5), prévue en V2
- Précise : EVT-03 (postes prestataires), ADR 0011 (modules), ADR 0027 (fichiers servis par l'app)

## Contexte

En recette, la planner pilote ne pouvait indiquer qu'un prestataire par poste, en texte libre,
alors qu'elle en consulte souvent plusieurs, reçoit leurs devis et prend des notes, dont
certaines sont à montrer aux clients. Elle veut aussi un carnet de prestataires réutilisable,
avec une carte. Spécification : `docs/lots/lot-11-prestataires.md`.

## Décision

1. **Deux modules, une frontière.** Le carnet est un nouveau module `vendors` (schéma
   `vendors`, clé de module désactivable). Les prestataires consultés appartiennent au poste
   d'un événement, donc au module `events` (`event_vendor_candidates` et leurs notes). Un
   consulté garde le **nom en clair** et, s'il vient du carnet, l'identifiant opaque de la
   fiche (pas de clé étrangère entre schémas). Sans le module `vendors`, la saisie libre reste
   possible ; l'historique d'une fiche est demandé au `service.ts` d'events, le prix final à
   celui de budget.
2. **Retenir = réserver.** « Retenir » appelle la mise à jour de poste existante (statut
   Réservé, nom, montant) : le contrat `events.vendor_slot.booked` et le budget ne changent pas.
3. **Champs par type en JSON validé.** Les types et leurs champs (nombre, texte, heure,
   montant, liste de choix, oui/non) sont des données de l'organisation ; les valeurs d'une
   fiche sont un objet `{ idDuChamp: valeur }` validé par Zod selon le format du champ. Les
   filtres sont appliqués par la base (`jsonb`, conversions typées), pas en mémoire.
4. **Pas de PostGIS.** Latitude et longitude en `double precision` ; la distance « à moins de
   N km » est calculée par la base (formule de haversine) et triée par elle. Suffisant pour
   quelques centaines ou milliers de fiches par organisation, et évite de changer l'image
   PostgreSQL du staging et de la production. PostGIS reste possible plus tard (isochrones).
5. **Trajet estimé** : distance × coefficient de détour (1,3) ÷ vitesse moyenne (60 km/h),
   paramétrables par organisation, toujours affiché « estimation » (cahier des charges).
6. **Géocodage derrière une interface** (`Geocoder`) : `ign` (API Géocodage de la Géoplateforme,
   gratuite, sans clé ; seule l'adresse est envoyée, jamais le nom ni le contact) et `fake`
   (tests, développement hors ligne), choisi par `GEOCODER` (valeur par défaut `ign`). Un échec
   n'empêche pas d'enregistrer la fiche ; le point se corrige à la main.
7. **Carte sans service payant** : `maplibre-gl` 6.15.0 et `pmtiles` 4.5.0 (dépendances
   acceptées par Julien le 04/11/2026), chargés seulement sur l'écran carte. Le fond de carte
   est un fichier PMTiles (extrait France de Protomaps) plus ses polices, posé par Julien dans
   un volume du VPS (`MAP_TILES_DIR`) et servi par l'app en lecture par plages (`Range`), avec
   contrôle de session : aucune requête vers un service tiers depuis le navigateur. Le style est
   écrit dans le code (couches d'un fond de carte, pas une donnée métier). Sans fond de carte
   installé, la liste, les filtres et les distances fonctionnent ; la carte l'indique.
8. **Fichiers** (devis d'un consulté, plaquettes, RIB) : mêmes règles que les devis du budget
   (PDF ou image, 20 Mo, antivirus, stockage privé, servis par l'app). Le RIB est un fichier
   privé et non une valeur saisie : pas de chiffrement maison (CLAUDE.md § 2.6) ; le stockage et
   les sauvegardes sont déjà privés et chiffrés (restic).
9. **Ce que voient les clients** : seulement les consultés « montrés aux clients » de leur
   événement, avec les notes cochées « Clients » et le devis ; jamais les notes internes, les
   consultés non montrés, ni le carnet.

## Conséquences

- Nouvelles variables : `GEOCODER` (facultative) et `MAP_TILES_DIR` (facultative) ; volume du
  fond de carte et script d'installation documentés dans le runbook de déploiement. La taille
  du fichier PMTiles est mesurée avant téléchargement sur le VPS.
- `MODULE_KEYS` gagne `vendors` ; un nouveau module est actif tant que l'Admin ne l'a pas
  désactivé (dégradation propre si désactivé : saisie libre).
- Si le carnet devient une app autonome (cahier des charges), `modules/vendors` devient
  `apps/vendors` sans toucher aux consultés, qui ne connaissent que l'identifiant de la fiche.
