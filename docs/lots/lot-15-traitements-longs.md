# Lot 15 — Traitements longs de l'import, accessibilité de la carte, migrations annulables

Lot court, à faire **avant l'essai de la reprise sur staging** (décision de Julien, 07/11/2026).
Il corrige les trois limites relevées à la fin du lot 14 et ajoute ce qui manquait pour les
imports volumineux :

1. **Placement sur la carte à la confirmation d'un import de prestataires** : un appel à l'API
   de géocodage par fiche, l'un après l'autre, pendant que la planner attend. Pour les
   201 prestataires de l'export actuel : environ 200 appels et un écran bloqué.
2. **Aucun avancement visible** pendant les traitements longs : lecture de 50 fiches PDF
   (jusqu'à 10 s par fiche au pire), placement de 200 fiches sur la carte. Seul le bouton grisé
   (« Lecture… ») indique que quelque chose se passe.
3. **Carte du carnet** : la zone de carte est déclarée comme une image (`role="img"`) alors
   qu'elle contient les boutons de zoom. Défaut d'accessibilité réel (des contrôles cachés dans
   une image), contourné depuis le lot 11 en excluant la carte des contrôles axe-core.
4. **Migrations 0070 et 0072** : elles ajoutent une valeur à un type énuméré PostgreSQL
   (`hub.import_entity_type`), ce qu'on ne peut pas annuler par une simple migration inverse.
   Écart à la règle « chaque migration est réversible » (CLAUDE.md § 5).

## Ce que dit le service de géocodage (vérifié le 07/11/2026)

- L'API de géocodage de la Géoplateforme (IGN) a deux formes : un appel par adresse (`GET
  /geocodage/search`, ce que fait l'app aujourd'hui) et un **géocodage en masse d'un fichier
  CSV en une seule requête** (`POST`), plus un mode asynchrone pour les très gros fichiers
  (jusqu'à 1 Go) ([documentation IGN](https://geoservices.ign.fr/node/1408)).
- Limite d'usage : **50 requêtes par seconde et par adresse IP** ; au-delà, refus (HTTP 429)
  pendant 5 s ([limites d'usage](https://geoservices.ign.fr/node/1551)).
- **Essai réel (07/11/2026, depuis l'environnement de Claude, adresses fictives ou publiques)** :
  `POST https://data.geopf.fr/geocodage/search/csv`, formulaire avec le fichier (`data`) et
  les colonnes à lire (`columns`, répétable). La réponse est le même CSV augmenté de
  `longitude`, `latitude`, `result_score`, `result_status`… **301 adresses en une requête,
  en 1 seconde.** Une adresse introuvable revient avec un score bas (0,36), donc écartée par
  le seuil actuel (0,5).
- **Précision** : en texte libre, « 20 rue de la République Lille » est sorti aux Lilas (93)
  avec un score de 0,80. Le code postal est donc envoyé comme **filtre** (colonne
  `postcode`), jamais mêlé au texte de l'adresse ; sans code postal, la ville reste dans le
  texte.

## Décisions de Julien (07/11/2026)

Les quatre propositions ci-dessous sont **validées**. Pour P, Julien choisit le **stockage
temporaire chiffré** des fiches PDF pendant leur lecture.

- **O. Géocodage en lot, dédoublonné, en tâche de fond.** À la confirmation d'un import de
  prestataires, l'import s'écrit tout de suite et l'écran rend la main. Les adresses à placer
  sont ensuite **dédoublonnées** (deux fiches à la même adresse : un seul envoi), celles dont un
  point est déjà connu dans le carnet **de la même organisation** reprennent ce point, et les
  autres partent **en un seul fichier CSV** (découpé si le lot dépasse la taille maximale).
  Si l'envoi en lot échoue, repli sur des appels unitaires plafonnés à 40 par seconde. Une
  adresse introuvable laisse la fiche sans point, signalée « à placer » dans le carnet, comme
  aujourd'hui.
- **P. Avancement des traitements longs.** La lecture des fiches PDF et le placement sur la
  carte deviennent des **traitements de fond suivis** : la page montre une barre d'avancement
  réelle (« Lecture des fiches : 12 sur 50 », « Placement sur la carte : 80 sur 201 »),
  rafraîchie toutes les 2 secondes. Fermer la page ne perd rien : en la rouvrant, on retrouve
  l'avancement, ou le résultat. Les étapes rapides (tableau de quelques centaines de lignes)
  gardent leur indicateur actuel.
- **Q. Carte accessible.** La zone de carte cesse d'être une image : une **région nommée**
  (« Carte des prestataires ») contient la carte et ses boutons de zoom, et un **résumé
  textuel** accompagne la carte (nombre de prestataires placés, liste équivalente déjà
  présente à côté). Les parcours des lots 11, 13 et 14 ne l'excluent plus des contrôles
  axe-core.
- **R. Migrations des types énumérés.** Pour chaque ajout de valeur à un type énuméré (0070,
  0072 et les suivants), un **script d'annulation** est fourni à côté de la migration : il
  refuse de s'exécuter si une ligne utilise encore la valeur, sinon recrée le type sans elle.
  Testé en intégration (aller, retour, aller). Un ADR fixe la règle ; le runbook de
  restauration explique quand l'utiliser.

## Stories et critères d'acceptation

### GEO-01 — Placement sur la carte en lot, sans attendre

- **Étant donné** un import de 201 prestataires dont 150 ont une adresse, dont 20 en double et
  30 déjà placées dans le carnet, **quand** elle confirme, **alors** l'écran de résultat
  s'affiche sans attendre le placement, et au plus **un envoi en lot** part vers le service de
  géocodage pour les 100 adresses restantes (découpé seulement si le lot dépasse la taille
  maximale du service).
- Deux fiches à la même adresse (casse, accents et espaces près) reçoivent le même point ; une
  adresse déjà placée dans le carnet de l'organisation reprend ce point sans appel. **Jamais**
  le point d'une autre organisation.
- **Étant donné** que l'envoi en lot échoue (service indisponible, réponse illisible),
  **alors** les adresses partent une par une, au plus 40 par seconde ; une réponse « trop de
  requêtes » (429) suspend l'envoi 5 secondes puis le reprend.
- Une adresse introuvable ou trop incertaine (score sous le seuil actuel) laisse la fiche sans
  point, avec la mention « à placer » dans le carnet ; la planner place le point à la main
  comme aujourd'hui.
- Un point corrigé à la main pendant le traitement n'est jamais écrasé.
- **Annulation** de l'import pendant le placement : le traitement s'arrête, rien n'est écrit
  sur une fiche supprimée.
- La saisie d'une fiche à la main garde le géocodage immédiat (une seule adresse).

### IMP-10 — Voir l'avancement des traitements longs

- **Quand** elle dépose des fiches PDF, **alors** elle arrive tout de suite sur l'import en
  cours, qui montre « Lecture des fiches : N sur T » avec une barre d'avancement ; à la fin, la
  page passe d'elle-même à l'étape suivante (rapprochements).
- **Quand** elle confirme un import de prestataires, **alors** le journal de l'import montre
  « Placement sur la carte : N sur T », puis « K prestataires placés, M à placer à la main »,
  avec un lien vers le carnet filtré sur les fiches à placer.
- La barre est accessible : élément `progress` nommé, valeur texte « 12 sur 50 », annonce aux
  lecteurs d'écran à chaque quart et à la fin (pas à chaque fiche).
- Fermer la page, se déconnecter ou redémarrer le serveur ne perd rien : un traitement
  interrompu reprend là où il s'était arrêté au redémarrage, sans relire une fiche déjà lue ni
  regéocoder une adresse déjà placée.
- Un traitement en échec affiche un motif clair et propose de relancer.
- Isolation : l'avancement d'un import n'est visible que de son organisation ; un traitement ne
  lit ni n'écrit que les données de son organisation.

### A11Y-01 — Carte du carnet accessible

- La carte (fiche et carnet) est une région nommée, sans `role="img"` ; ses boutons de zoom
  sont atteignables au clavier et nommés en français et en anglais (traductions de l'app, pas
  celles de la bibliothèque).
- Un résumé textuel accompagne la carte : « 42 prestataires sur la carte, 3 à placer ».
- Les parcours Playwright des lots 11, 13 et 14 passent axe-core **sans exclure la carte**.

### DB-01 — Migrations des types énumérés annulables

- Pour 0070 et 0072, un script d'annulation existe et est documenté.
- **Étant donné** qu'aucun import n'utilise la valeur, **quand** on lance le script, **alors**
  le type est recréé sans elle et la migration peut être rejouée.
- **Étant donné** qu'un import l'utilise, **alors** le script refuse avec un message clair, sans
  rien modifier.
- Testé en intégration sur une base réelle ; ADR et runbook à jour.

## Technique

- **Interface du géocodeur** : `geocodeMany(addresses)` s'ajoute à `geocode(address)` dans
  `modules/vendors/geocoder.ts` ; implémentation IGN en lot (CSV en `POST`), repli unitaire
  plafonné, géocodeur simulé pour les tests. Le résultat garde le seuil de score actuel.
- **Traitements de fond** : une table `hub.import_jobs` (organisation, import, nature —
  lecture des fiches ou placement sur la carte —, total, fait, statut, motif, dates), protégée
  par RLS. Un traitement est découpé en petits pas idempotents ; le **worker continu** déjà
  lancé au démarrage du serveur (ADR 0014) les fait avancer. Pas de nouvelle dépendance. Un ADR
  décrit ce patron (traitement de fond suivi), réutilisable par d'autres modules.
- **Fiches PDF en attente** : pendant la lecture, les octets d'une fiche ne sont gardés que le
  temps du traitement (chiffrés au repos par le stockage privé, ADR 0027), puis supprimés ;
  l'ADR 0034 (« fichier jamais stocké ») est mis à jour en conséquence (choix de Julien
  plutôt qu'une lecture synchrone sans avancement).
- **Carte** : `app/prestataires/vendor-map.tsx` ; traduction des contrôles MapLibre par les
  fichiers de traduction de l'app.
- **Migrations** : scripts `packages/db/drizzle-rollback/<n>_*.sql`, commande
  `pnpm --filter @symbola/db rollback -- <n>`, réservée à l'opérateur (Julien) ; jamais lancée
  par l'app.

## Découpage proposé

1. **15a** — Traitements de fond suivis (table, worker, barre d'avancement) et géocodage en lot
   (GEO-01, IMP-10). Vérification préalable du service en lot depuis staging.
2. **15b** — Carte accessible (A11Y-01).
3. **15c** — Migrations des types énumérés annulables (DB-01).
4. **Déploiement sur staging** (Julien, runbook) : migrations 0069 à 0072 et celles du lot 15,
   nouvelle image, puis essai de la reprise avec les vrais exports.
