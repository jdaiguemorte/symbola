# Lot 60 — Plans de salle des lieux : configurations, prestataires et installations

**Statut** : spécification proposée le 18/11/2026, **à valider par Julien**. Demande de Julien du
18/11/2026, qui dépasse le cahier des charges : ADR à écrire. Le lot crée un module et son
schéma (D1) : validation explicite requise (CLAUDE.md § 8). Aucune dépendance nouvelle (D3).

Branche `lot-60-plans-de-salle`, partie de `main`. Place dans le plan : D9.

## Contexte

Julien, le 18/11/2026 : la wedding planner doit pouvoir **enregistrer des configurations pour les
lieux de son catalogue**. Le plan doit faciliter la mise en place :

- **placer** les prestataires, le DJ, l'animation, les bars ;
- **noter** les installations du lieu, comme les prises électriques disponibles ;
- **poser** des tables de toutes formes (rectangulaires, rondes…).

Le placement aide à **visualiser le lieu**. C'est une aide à l'installation, **pas** le plan de
table : qui est assis à côté de qui reste au lot 50.

Aujourd'hui, la planner dessine ce plan à la main, ou l'annote sur le PDF du lieu. Elle le refait à
chaque mariage dans le même lieu. Elle l'envoie au traiteur, au DJ et au loueur de mobilier par
e-mail, et chacun l'imprime.

Les outils grand public, comme planning.wedding avec son « plan de cérémonie », proposent un plan
libre par évènement. Ce lot vise l'usage professionnel :

- un plan **par lieu, réutilisable** ;
- des **installations** notées une fois (prises, points d'eau, issues) ;
- un plan **partagé à chaque prestataire** avec son emplacement.

## Exigences rattachées

Le cahier des charges ne nomme pas cette fonction ; elle prolonge :

- **PRE-06** (P1, lot 48) : « Fiche lieu : capacités, **plans**, contraintes d'horaires et de
  bruit… ». Ce lot porte la partie « plans » ; le lot 48 garde le reste de la fiche.
- **INV-05** (P1, lot 50) : « formes de tables, capacité ». Les tables du plan de salle peuvent
  servir de départ au plan de table (D7).

Les exigences propres au lot, préfixées par le lot (Q1) :

- **L60-PLA-01** — Configurations d'un lieu du catalogue : espaces, dimensions, fond de plan,
  installations fixes, et plusieurs configurations nommées (« Dîner 120 », « Cocktail »).
- **L60-PLA-02** — Éditeur de plan à l'échelle : tables de toutes formes, éléments
  d'installation, prestataires, annotations.
  *Critère* : utilisable à la souris, au doigt sur tablette **et** au clavier ; liste des
  éléments équivalente au dessin.
- **L60-PLA-03** — Installations : prises électriques (nombre, ampérage), points d'eau, issues de
  secours, accès de livraison. Un prestataire qui a un **besoin** électrique se relie à une prise.
- **L60-PLA-04** — Plan de l'évènement : copie d'une configuration du lieu, ajustée pour
  l'évènement, rattachée à ses lieux (`events.event_places`) et à ses prestataires retenus.
- **L60-PLA-05** — Partage :
  - chaque prestataire voit le plan **avec son emplacement en évidence**, et ses besoins et sa
    prise, par son lien (lot 47) ;
  - le client le voit en lecture dans son portail ;
  - export PDF à l'échelle.

## Ce qui existe aujourd'hui

- **Lieux du catalogue** : fiches du module `vendors` de type `venue` (`vendor-types.json`).
- **Lieux d'un évènement** : `events.event_places`, qui peuvent désigner une fiche du catalogue
  (`vendor_id`).
- **Prestataires retenus** : `events.event_vendor_candidates`.
- **Lien prestataire** : espace `/prestataire` (lot 26b, complété par le lot 47).
- **Plan de table** : lot 50 (PR #140), avec des tables en cartes sans dessin (sa D2).
- **Fichiers** : dépôt contrôlé (type, taille, antivirus), servis après contrôle des droits
  (ADR 0027).
- **PDF** côté serveur (`@react-pdf/renderer`, ADR 0019), qui sait dessiner des formes (SVG).

## Une seule PR

Le lot tient en une PR : un module neuf, un éditeur, et trois lieux d'affichage (planner,
prestataire, client).

## Partie A — Les configurations d'un lieu (L60-PLA-01, L60-PLA-03)

- Sur la fiche d'un lieu du catalogue, l'onglet « Plans » contient les **espaces** du lieu :
  salle, jardin, chapiteau, terrasse. Chacun a un nom, des dimensions en mètres (rectangle par
  défaut) et un **fond de plan** facultatif.
- **Fond de plan** (D4) : une image (PNG, JPEG ou WebP), le plan fourni par le lieu. Elle est
  **calibrée** par deux points et la distance réelle qui les sépare. Le plan devient alors à
  l'échelle.
- **Installations fixes**, posées une fois pour toutes :
  - prises électriques : nombre, ampérage (16 A, 32 A), triphasé ou non, note ;
  - points d'eau ;
  - portes ;
  - issues de secours ;
  - accès de livraison ;
  - piliers et obstacles ;
  - scène fixe.
- **Configurations nommées** : chaque espace a une ou plusieurs dispositions (« Dîner 120 en
  rondes », « Cocktail debout »). Chacune porte ses tables et ses éléments, et affiche sa capacité
  (places assises) calculée.
- Les configurations appartiennent à l'organisation : c'est le savoir-faire de la planner. Elles
  ne sont jamais partagées avec une autre organisation, ni avec le lieu.

## Partie B — L'éditeur (L60-PLA-02 ; D2, D3, D5)

- **Bibliothèque d'éléments**, en données de départ (`floorplan-elements.json`, FR et EN, HUB-20).
  La planner masque des éléments, en ajoute, et règle leurs dimensions par défaut. Au départ :
  - **tables** : ronde (diamètre), rectangulaire (longueur × largeur), ovale, carrée, impériale,
    table d'honneur, mange-debout. Le nombre de places est **proposé** par la forme et la taille,
    puis modifiable ;
  - **installations de soirée** : piste de danse, scène, DJ, groupe, bar, buffet, photobooth,
    espace enfants, vestiaire, régie, cocktail, cérémonie (chaises en rangées et allée).
- **Manipulation** :
  - glisser, tourner, redimensionner, à la souris et au doigt (événements « pointeur », qui
    marchent aussi au toucher) ;
  - aimantation sur une grille de 50 cm, désactivable ;
  - copier et coller, sélection multiple, alignement ;
  - zoom ;
  - annuler et rétablir.
- **Clavier** (critère L60-PLA-02) :
  - Tab passe d'un élément à l'autre ;
  - les flèches déplacent de 10 cm, de 1 m avec Maj ;
  - R tourne de 15° ;
  - Suppr retire l'élément ;
  - chaque action est annoncée (`role="status"`).
- **Panneau des propriétés** : nom ou numéro, position x et y, angle, dimensions, places, couleur
  parmi les jetons de design, note. C'est aussi la voie du lecteur d'écran et du téléphone.
- **Liste des éléments**, équivalente au dessin : chaque élément avec sa position, ses places et
  son prestataire. Elle se lit, se trie et se modifie sans le dessin.
- **Contrôles**, signalés et jamais bloquants :
  - éléments qui se chevauchent ;
  - élément hors de l'espace ;
  - places assises inférieures au nombre d'invités attendus ;
  - prestataire sans prise alors qu'il a un besoin électrique.
- **375 px** (D5) : consultation du plan, zoom et liste des éléments ; la modification passe par
  le panneau des propriétés. Le glisser fin se fait sur tablette ou ordinateur.

## Partie C — Prestataires et électricité (L60-PLA-03)

- Un élément du plan peut désigner un **prestataire retenu** de l'évènement (« DJ : Studio
  Lumière », « Bar : Les Cocktails de Léo »). Sur le plan de l'évènement, le nom du prestataire
  s'affiche ; sur la configuration du lieu, seulement le type.
- **Besoins** de l'élément : nombre de prises, ampérage, eau, distance maximale à la prise. Le
  catalogue en propose (DJ : 2 prises 16 A), la planner les ajuste.
- **Relier** un besoin à une prise du lieu : une ligne pointillée sur le plan, et le tableau
  « Électricité » qui liste les prises, leur charge, et qui s'y branche. Une prise surchargée
  (somme des besoins supérieure à sa capacité déclarée) est signalée. **Symbola ne calcule pas une
  installation électrique** : c'est une aide de repérage, et l'écran le dit (D6).

## Partie D — Le plan de l'évènement et son partage (L60-PLA-04, L60-PLA-05 ; D7, D8)

- **Copier** : sur la fiche de l'évènement, pour un lieu du catalogue, choisir une configuration.
  Elle est **copiée** dans l'évènement, puis ajustée sans modifier le lieu. « Enregistrer comme
  configuration du lieu » fait l'inverse.
- Pour un lieu hors catalogue, le plan part d'un espace vide, aux dimensions saisies.
- **Prestataires** : chacun voit, par son lien, le plan de l'évènement avec **son** emplacement en
  évidence, sa prise et ses besoins, l'accès de livraison et les issues. Il ne voit que les noms
  des prestataires que la planner choisit de montrer (D8).
- **Client** : lecture du plan dans son portail (rubrique « Plan de salle », fermée par défaut,
  POR-10), sans les notes internes.
- **Export PDF** à l'échelle :
  - une page de plan avec cartouche (lieu, espace, échelle, date, version) ;
  - le tableau des éléments ;
  - le tableau « Électricité ».
- **Versions** : le plan partagé porte un numéro de version ; une nouvelle version est signalée
  aux prestataires, comme le programme (CHR-07).
- **Lien avec le plan de table** (D7) : un bouton « Créer les tables du plan de table » copie les
  tables du plan de salle (numéro ou nom, forme, places) dans le plan de table du lot 50. La copie
  se fait une fois, sans synchronisation. Qui s'assoit où reste au lot 50.

## Décisions à prendre

- **D1 — Où vit la fonction.** Change le schéma de la base.
  - (a) Module neuf `floorplans`, schéma `floorplans`, **fermé par défaut** (comme les modules
    Rendez-vous et Invités, ADR 0079). Il contient les configurations des lieux (désignés par
    `vendor_id`) et les plans d'évènement (désignés par `event_id`), sans clé étrangère entre
    schémas.
  - (b) Configurations dans le module `vendors`, plans d'évènement dans `events`.

  **Recommandation : (a).** C'est une fonction « en plus », que l'on ouvre ou vend à part (HUB-27,
  lot 54). Un module se ferme, s'exporte et se teste seul ; (b) éparpillerait l'éditeur dans deux
  modules.
- **D2 — Un plan dessiné à l'échelle.**
  - (a) Plan en 2D à l'échelle (mètres), avec formes et positions.
  - (b) Liste d'éléments sans dessin.

  **Recommandation : (a).** C'est l'objet du lot : visualiser le lieu. La liste équivalente garde
  l'accès au clavier et au lecteur d'écran.
- **D3 — La technique de dessin.**
  - (a) SVG dessiné par React, événements « pointeur », sans dépendance.
  - (b) Une bibliothèque de dessin (Konva, Fabric.js) : dépendance hors stack, ADR.

  **Recommandation : (a).** Quelques centaines d'éléments au plus : le SVG suffit. Il se lit au
  lecteur d'écran, il s'imprime, et `@react-pdf/renderer` sait le reproduire dans le PDF.
- **D4 — Le fond de plan.**
  - (a) Image (PNG, JPEG, WebP) calibrée par deux points.
  - (b) Accepter aussi le PDF du lieu : il faut le convertir en image (dépendance de type
    pdf.js, ADR).

  **Recommandation : (a).** La planner fait une capture du PDF du lieu ; (b) pourra venir si la
  pilote le demande.
- **D5 — Le téléphone.**
  - (a) Consultation, zoom, liste et modification par le panneau des propriétés ; le glisser fin
    sur tablette ou ordinateur.
  - (b) Éditeur complet au doigt sur 375 px.

  **Recommandation : (a).** Un plan de 30 m sur un écran de 375 px ne se manipule pas au doigt
  sans erreur. Aucune fonction n'est perdue : tout se fait aussi par le panneau.
- **D6 — L'électricité.**
  - (a) Repérage : prises, besoins, liaisons, alerte de surcharge déclarée ; l'écran rappelle que
    ce n'est pas une étude électrique.
  - (b) Rien sur l'électricité.

  **Recommandation : (a).** C'est ta demande (« en notant les prises dispos »), et l'oubli le plus
  fréquent le jour J. Un calcul réglementaire reste hors de Symbola.
- **D7 — Le lien avec le plan de table.**
  - (a) Copie ponctuelle des tables vers le plan de table du lot 50.
  - (b) Synchronisation permanente des deux plans.
  - (c) Aucun lien.

  **Recommandation : (a).** Tu as séparé les deux usages ; la copie évite de ressaisir les tables
  sans attacher les deux écrans l'un à l'autre.
- **D8 — Ce qu'un prestataire voit.**
  - (a) Tout le plan, son emplacement en évidence ; les autres prestataires désignés par leur
    type, et par leur nom seulement si la planner le coche.
  - (b) Seulement son emplacement.

  **Recommandation : (a).** Le DJ doit savoir où sont la piste et le bar ; nommer les autres reste
  un choix de la planner.
- **D9 — Sa place dans le plan des lots.**
  - (a) Après le lot 48 (fiche lieu, PRE-06) et le lot 51 (Jour J de terrain).
  - (b) Juste après les lots 44, 47 et 50.

  **Recommandation : (a).** Le lot 48 pose la fiche lieu que ce lot prolonge ; le lot 51 ferme les
  parcours P0 restants. À avancer si la pilote le demande.

## Points pour les conseils

- **DPO** : rien de personnel dans un plan, hormis le nom d'un prestataire (déjà au registre). Le
  fond de plan peut montrer des noms ou des adresses : même règle que les fichiers d'un lieu.
- **Avocat** : rien. Le plan d'un lieu fourni par le lieu peut être protégé. La planner l'emploie
  pour son travail et ne le diffuse qu'aux prestataires de l'évènement : une phrase d'aide le
  rappelle.

## Migrations (prévision)

- **`floorplans`** (création, puis droits et RLS, avec leurs annulations) :
  - `element_types` (bibliothèque de l'organisation) ;
  - `venue_spaces` (lieu, nom, dimensions, fond de plan et calibration) ;
  - `space_fixtures` (installations fixes) ;
  - `layouts` (configuration nommée d'un espace, ou plan d'un évènement : `event_id`, version,
    publié) ;
  - `layout_elements` (type, position et angle en centimètres et degrés, dimensions, places,
    prestataire retenu, besoins) ;
  - `power_links` (élément, prise) ;
  - RLS et index sur `organization_id` partout.
- **`events`** : rubrique « Plan de salle » ajoutée à `event_links_rubrics_check`. Petite migration,
  accord à demander, comme pour la rubrique « Invités » du lot 49.
- Données de départ : `floorplan-elements.json` ; clé de module `floorplans` fermée par défaut.

## Tests (prévision)

- **L60-PLA-01 à 05** (intégration) :
  - configurations par lieu ;
  - calibration ;
  - copie vers un évènement sans toucher au lieu ;
  - capacité calculée ;
  - contrôles (chevauchement, hors espace, places, prise surchargée) ;
  - versions.
- **Clavier et liste** (Playwright, ordinateur et 375 px, axe-core) :
  - placer, déplacer et tourner une table **au clavier seul** ;
  - la liste équivalente au dessin ;
  - à 375 px, modification par le panneau, sans défilement horizontal.
- **Partage** :
  - le lien d'un prestataire ne montre que son évènement, avec son emplacement en évidence ;
  - les noms des autres prestataires seulement si la planner le coche ;
  - le client en lecture, rubrique fermée par défaut ;
  - l'Admin ne voit rien ;
  - organisation A ne lit pas les configurations de B.
- **PDF** : échelle, cartouche, tableau « Électricité ».
- **ARC-07** : module fermé, onglet absent, jamais d'erreur.
- **Rejeu** : à écrire (pas de scénario du cahier des charges). Proposition : un SC-60 sur le jeu
  fictif, où Camille prépare le dîner au château et Karim, le traiteur, voit son emplacement et sa
  prise.

## Hors périmètre

- Plan de table nominatif (lot 50) ; aide au placement automatique des invités (INV-11).
- Plan en 3D, vues en perspective ; import de plans DWG ou PDF (D4 b).
- Étude électrique réglementaire, calcul de charge réel.
- Partage des configurations entre organisations ou avec le lieu lui-même.
- Commande du mobilier au loueur depuis le plan.

## Ambiguïtés relevées

- « Enregistrer des configurations pour les lieux qu'elle a en catalogue » : une configuration
  appartient à la planner, pas au lieu ; deux planners qui travaillent dans le même château ont
  chacune la leur.
- « Placer les prestataires » : sur la configuration du lieu, on place des **types** (un DJ, un
  bar) ; les **noms** n'arrivent qu'avec le plan d'un évènement.
