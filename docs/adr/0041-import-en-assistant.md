# ADR 0041 — Import en assistant linéaire ; types de l'import rangés par famille

- Statut : accepté
- Date : 2026-11-08
- Précise : ADR 0022 (import de données) et [0040](0040-familles-de-types-de-prestataires.md) (familles de types)
- Stories : IMP-11 et IMP-12 (lot 16, spécification `docs/lots/lot-16-reprise-ux.md`, décision E
  validée par Julien le 08/11/2026)

## Contexte

Audit du 08/11/2026 (`docs/audits/2026-11-08-audit-complet.md`, U1 et U2). L'import obligeait à
revenir à une page de synthèse entre chaque étape. Il affichait toutes les colonnes, même
reconnues, et décidait des colonnes sans équivalent à part, dans un « rapport des écarts ». Il
proposait un type par libellé du fichier : 45 listes déroulantes pour un vrai export.

## Décision

1. **Un service décide de l'étape suivante.** `lib/import/wizard.ts` (`importWizardSteps`,
   `nextImportStep`, `getImportWizard`) calcule l'état de chaque étape :
   - Fichier ;
   - Colonnes ;
   - Types (prestataires seulement) ;
   - Doublons ;
   - Vérifier et confirmer.

   Une étape sans rien à décider est faite d'office et franchie. Une étape qui attend la
   planner (types à créer, doublons proposés, fiches du même événement) l'est quand elle clique
   « Continuer » (`matching.reviewed`). Les écrans ne recalculent plus l'enchaînement.
   `/import/<id>` reprend un brouillon là où il s'était arrêté.
2. **Frise et barre d'action communes.**
   - `app/ui/stepper.tsx` : étape faite, avec coche, résumé et lien pour y revenir ; étape en
     cours (`aria-current="step"`) ; étape à venir.
   - `app/ui/action-bar.tsx` : « Retour », puis « Continuer », qui enregistre, dans une barre
     fixe en bas.
   - « Abandonner l'import » : un lien discret dans l'en-tête, avec confirmation.
   - L'assistant s'ouvre en plein écran, sans le menu des rubriques des Paramètres
     (décision E), mais son point d'entrée reste Paramètres › Importer.
3. **Départ en trois tuiles** : « Reprendre mes prestataires », « Reprendre mes événements »,
   « Un autre fichier ». Le choix détaillé des contenus n'apparaît que pour la troisième.
4. **Colonnes : seulement celles qui demandent un choix**, en tableau (Colonne du fichier ·
   Exemples · Devient · Confiance). Les autres se résument en une ligne, « Voir le détail ».
   - Une colonne devient un champ, un champ libre ou rien, dans la même étape : l'ancien
     rapport des écarts pour les colonnes disparaît.
   - Une proposition sous le seuil de confiance n'est jamais présélectionnée : IMP-02 reste
     tenu, et la confirmation devient un choix explicite.
   - Le profil d'un export reconnu décide aussi de ses colonnes annexes, en données
     (`import-profiles.json`, `annexColumns`) : département ignoré, TVA, APE et statut gardés
     en champ libre.
   - Rien à décider : la correspondance s'enregistre à l'ouverture de l'import.
   - Ce que l'app a reconnu du fichier (encodage, séparateur, en-tête, aperçu) reste visible
     à la demande (IMP-01).
5. **Doublons : un tableau filtrable** (« À vérifier », « Nouveaux », « Mises à jour »),
   20 lignes par page, avec une décision par ligne et le rapprochement à la main. « Tout
   accepter » vaut pour les propositions sûres, à partir de 90 % de ressemblance
   (`SAFE_MATCH_SCORE`).
6. **Vérifier et confirmer** : le bilan des effets, avec un aperçu des valeurs **après**
   correction.
   - Le bilan compte les fiches créées et mises à jour, les types et étiquettes créés, les
     colonnes gardées en champ libre et les lignes rejetées, avec leur motif et leur CSV.
   - Le bouton principal dit ce qui sera importé : « Importer 25 prestataires ».
   - La fin propose la prochaine action, « Voir les 25 prestataires », avec l'avancement du
     placement sur la carte et l'annulation.
7. **IMP-12 — chaque libellé de type a une cible** (`ImportVendorTypeTarget`, dans le JSON du
   brouillon). Par défaut, et dans l'ordre :
   - un type du carnet (synonyme ou ressemblance) ;
   - sinon un type de départ de la même famille, créé une seule fois pour tous ses synonymes
     (« & » vaut « et ») ;
   - sinon aucun type : la fiche est « à classer » et le libellé du fichier est gardé en
     champ importé.

   Jamais un type par libellé par défaut. La planner peut choisir un autre type, en créer un
   dans une famille, ou laisser « à classer ». L'étape « Types » les présente regroupés par
   famille. Une organisation d'avant le lot 16 reçoit ses familles avant le rangement
   (ADR 0040).

## Conséquences

- Les choix de types d'un brouillon antérieur (sans `target`) restent lus : un type du carnet,
  ou un type créé sous le libellé.
- Sur le corpus fictif (22 libellés), une wedding planner qui a ses types de départ crée au
  plus 12 types (test d'intégration), et « Coiffeur(se) » et « Maquillage » rejoignent
  « Coiffure et maquillage ».
- L'adresse `/import/<id>/ecarts` renvoie vers l'étape en cours. Le CSV des lignes rejetées
  reste servi par `/import/<id>/ecarts/csv`.
- Les parcours e2e IMP-01 à IMP-09 suivent l'assistant. Ceux qui attendent un traitement de
  fond (lecture des PDF, placement sur la carte) restent lents sur une base de développement
  chargée : le traitement parcourt toutes les organisations (à revoir dans L16-ARC-01).
