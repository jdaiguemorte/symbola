# Correspondance des anciens identifiants

Décision Q1 de Julien (11/11/2026, `docs/QUESTIONS.md`) : un identifiant **sans préfixe** désigne
désormais une exigence de `docs/CAHIER_DES_CHARGES.md`. Les anciens identifiants qui portent le
même nom (familles EVT, HUB, BUD, PRE, SEC, ARC : décision D1 du lot 25) sont préfixés par leur
origine : `PRD-` pour le PRD du MVP (`docs/archive/PRD-MVP.md`), `L<n>-` pour la spécification
du lot n (`docs/lots/`). Les autres familles anciennes (SOC, DEV, IMP, RGPD, AIDE, ONB, GEO, DB)
n'existent pas dans le cahier des charges et gardent leur forme.

Cette table est lue par `tools/referentiel/prefix-legacy-ids.mjs`, qui a appliqué le préfixe au
lot 25 (code, tests, documents) et vérifie qu'aucun ancien identifiant ne reste sans préfixe.
Ne sont pas touchés : `docs/archive/` (textes d'origine), les migrations SQL déjà appliquées,
l'historique Git, et les documents écrits avec les nouveaux identifiants (cahier des charges,
rapport d'écart, `CLAUDE.md`, lots 22 et 25, ADR 0051 et suivants).

| Ancien | Nouveau nom | Origine | Titre |
| --- | --- | --- | --- |
| EVT-01 | PRD-EVT-01 | `docs/archive/PRD-MVP.md` | Liste des événements |
| EVT-02 | PRD-EVT-02 | `docs/archive/PRD-MVP.md` | Étapes d'un événement |
| EVT-03 | PRD-EVT-03 | `docs/archive/PRD-MVP.md` | Statut des postes prestataires |
| EVT-04 | PRD-EVT-04 | `docs/archive/PRD-MVP.md` | Rétroplanning |
| EVT-05 | PRD-EVT-05 | `docs/archive/PRD-MVP.md` | Programme du jour J |
| EVT-06 | PRD-EVT-06 | `docs/archive/PRD-MVP.md` | Accès des mariés |
| EVT-07 | PRD-EVT-07 | `docs/archive/PRD-MVP.md` | Source du prospect |
| EVT-10 | L11-EVT-10 | `docs/lots/lot-11-prestataires.md` | Plusieurs prestataires consultés par poste |
| EVT-11 | L11-EVT-11 | `docs/lots/lot-11-prestataires.md` | Notes et options montrées aux clients |
| EVT-12 | L12-EVT-12 | `docs/lots/lot-12-demarrage.md` | Statut de l'événement en boutons |
| EVT-13 | L12-EVT-13 | `docs/lots/lot-12-demarrage.md` | Rétroplanning seulement pour un événement confirmé |
| EVT-14 | L12-EVT-14 | `docs/lots/lot-12-demarrage.md` | Programme du jour J lisible |
| EVT-15 | L12-EVT-15 | `docs/lots/lot-12-demarrage.md` | Lieux enregistrés une fois |
| EVT-16 | L12-EVT-16 | `docs/lots/lot-12-demarrage.md` | RIB d'un prestataire partagé aux clients |
| EVT-17 | L12-EVT-17 | `docs/lots/lot-12-demarrage.md` | Un seul onglet « Budget » (les « postes » disparaissent) |
| EVT-18 | L13-EVT-18 | `docs/lots/lot-13-ux.md` | Liste des événements |
| EVT-19 | L13-EVT-19 | `docs/lots/lot-13-ux.md` | Frise du statut et prochaine étape |
| EVT-20 | L20-EVT-20 | `docs/lots/lot-20-retours-recette.md` | Rétroplanning : cartes alignées |
| EVT-21 | L21-EVT-21 | `docs/lots/lot-21-etiquettes-et-reglages.md` | Programme du jour J en liste, puis le détail d'un modèle |
| EVT-22 | L21-EVT-22 | `docs/lots/lot-21-etiquettes-et-reglages.md` | Rétroplanning sur le même modèle |
| HUB-01 | PRD-HUB-01 | `docs/archive/PRD-MVP.md` | Connexion unique et double authentification |
| HUB-02 | PRD-HUB-02 | `docs/archive/PRD-MVP.md` | Tableau de bord |
| HUB-03 | PRD-HUB-03 | `docs/archive/PRD-MVP.md` | Administration de la suite |
| HUB-04 | PRD-HUB-04 | `docs/archive/PRD-MVP.md` | Langue |
| HUB-11 | L10-HUB-11 | `docs/lots/lot-10-aide-recherche.md` | Suivi de la prise en main dans l'Administration |
| HUB-12 | L11-HUB-12 | `docs/lots/lot-11-prestataires.md` | Paramètres en pastilles |
| HUB-13 | L12-HUB-13 | `docs/lots/lot-12-demarrage.md` | Agenda cliquable |
| HUB-14 | L13-HUB-14 | `docs/lots/lot-13-ux.md` | Composants communs |
| HUB-15 | L13-HUB-15 | `docs/lots/lot-13-ux.md` | Accueil : l'agenda et ce qui attend |
| HUB-16 | L13-HUB-16 | `docs/lots/lot-13-ux.md` | Paramètres en rubriques |
| HUB-17 | L13-HUB-17 | `docs/lots/lot-13-ux.md` | Console d'Administration |
| HUB-18 | L13-HUB-18 | `docs/lots/lot-13-ux.md` | Dernière sauvegarde signalée |
| HUB-19 | L16-HUB-19 | `docs/lots/lot-16-reprise-ux.md` | En-tête d'écran et aide au même endroit |
| HUB-20 | L16-HUB-20 | `docs/lots/lot-16-reprise-ux.md` | Écrans restés à l'ancien motif |
| HUB-21 | L16-HUB-21 | `docs/lots/lot-16-reprise-ux.md` | Vocabulaire selon le métier |
| HUB-22 | L18-HUB-22 | `docs/lots/lot-18-retours-recette.md` | Un seul lien du menu principal allumé |
| HUB-23 | L18-HUB-23 | `docs/lots/lot-18-retours-recette.md` | Pastille « Reprendre » sur l'onglet Tutoriels seulement |
| HUB-24 | L18-HUB-24 | `docs/lots/lot-18-retours-recette.md` | « Plus d'options » sans déformer la barre d'outils |
| HUB-25 | L20-HUB-25 | `docs/lots/lot-20-retours-recette.md` | En-tête de l'agenda aligné (fait) |
| HUB-26 | L20-HUB-26 | `docs/lots/lot-20-retours-recette.md` | « Voir le parcours des tutoriels » à sa place |
| HUB-27 | L20-HUB-27 | `docs/lots/lot-20-retours-recette.md` | Une seule barre de recherche |
| HUB-28 | L21-HUB-28 | `docs/lots/lot-21-etiquettes-et-reglages.md` | Le menu des réglages défile seul |
| HUB-29 | L21-HUB-29 | `docs/lots/lot-21-etiquettes-et-reglages.md` | des groupes lisibles dans le menu des réglages |
| BUD-01 | PRD-BUD-01 | `docs/archive/PRD-MVP.md` | Simulation pour un prospect |
| BUD-02 | PRD-BUD-02 | `docs/archive/PRD-MVP.md` | Prévu, réel, écart |
| BUD-03 | PRD-BUD-03 | `docs/archive/PRD-MVP.md` | Devis prestataire joint |
| BUD-04 | PRD-BUD-04 | `docs/archive/PRD-MVP.md` | Budget visible par les mariés |
| PRE-01 | L11-PRE-01 | `docs/lots/lot-11-prestataires.md` | Fiche d'un prestataire (carnet) |
| PRE-02 | L11-PRE-02 | `docs/lots/lot-11-prestataires.md` | Types, champs et filtres |
| PRE-03 | L11-PRE-03 | `docs/lots/lot-11-prestataires.md` | Adresse placée sur la carte |
| PRE-04 | L11-PRE-04 | `docs/lots/lot-11-prestataires.md` | Carte, filtres, cercle |
| PRE-05 | L11-PRE-05 | `docs/lots/lot-11-prestataires.md` | Carte, filtres, cercle |
| PRE-06 | L11-PRE-06 | `docs/lots/lot-11-prestataires.md` | Carte, filtres, cercle |
| PRE-07 | L11-PRE-07 | `docs/lots/lot-11-prestataires.md` | Trajet estimé |
| PRE-09 | L11-PRE-09 | `docs/lots/lot-11-prestataires.md` | Historique avec la planner |
| PRE-10 | L11-PRE-10 | `docs/lots/lot-11-prestataires.md` | Du carnet vers le poste |
| PRE-11 | L11-PRE-11 | `docs/lots/lot-11-prestataires.md` | Exporter une sélection |
| PRE-12 | L13-PRE-12 | `docs/lots/lot-13-ux.md` | Liste et carte côte à côte |
| PRE-14 | L16-PRE-14 | `docs/lots/lot-16-reprise-ux.md` | Familles et types |
| PRE-15 | L16-PRE-15 | `docs/lots/lot-16-reprise-ux.md` | Renommer, fusionner, ranger les types |
| PRE-16 | L18-PRE-16 | `docs/lots/lot-18-retours-recette.md` | Estimation des trajets expliquée |
| PRE-17 | L20-PRE-17 | `docs/lots/lot-20-retours-recette.md` | Retirer un prestataire depuis le carnet |
| PRE-18 | L21-PRE-18 | `docs/lots/lot-21-etiquettes-et-reglages.md` | des étiquettes de départ, rangées par famille |
| PRE-19 | L21-PRE-19 | `docs/lots/lot-21-etiquettes-et-reglages.md` | les étiquettes importées se rangent toutes seules |
| PRE-20 | L21-PRE-20 | `docs/lots/lot-21-etiquettes-et-reglages.md` | Pastilles sur toute la largeur de la fiche |
| SEC-01 | L16-SEC-01 | `docs/lots/lot-16-reprise-ux.md` | Code de double authentification protégé |
| SEC-02 | L16-SEC-02 | `docs/lots/lot-16-reprise-ux.md` | Limitation de débit |
| SEC-03 | L16-SEC-03 | `docs/lots/lot-16-reprise-ux.md` | Appareil de confiance (90 jours) |
| ARC-01 | L16-ARC-01 | `docs/lots/lot-16-reprise-ux.md` | Une connexion partagée et une garde d'accès unique |

## Cas particuliers (corrigés à la main au lot 25)

- **Anciens numéros des lots 10 et 11**, déjà renumérotés au lot 12 : `L10-HUB-05` (devenu
  L10-HUB-11), `L11-HUB-06` (L11-HUB-12), `L11-EVT-08` (L11-EVT-10), `L11-EVT-09` (L11-EVT-11).
  Ils ne restent que dans la table de renumérotation de `docs/lots/lot-12-demarrage.md`.
- **Renvois du lot 11 vers l'ancien cahier des charges** (PRE-01 à PRE-13 de
  `docs/archive/cahier-des-charges-v1.md`, § 5.5) : réécrits sans identifiant, pour ne pas les
  confondre avec les stories du lot 11 ni avec L13-PRE-12.
- **ARC-04, ARC-11 et NFR-xx** : ce sont déjà des identifiants du nouveau cahier des charges
  (lot 22 et avenants du lot 25) ; ils restent sans préfixe.
