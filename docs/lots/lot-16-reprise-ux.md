# Lot 16 — Reprise UX : un import qui guide, un carnet lisible, une aide toujours au même endroit

**Statut : validé par Julien le 08/11/2026** (décisions A à F et maquettes). Seule réserve,
sur D : une organisation doit pouvoir renommer « Beauté et tenues » ou la scinder en deux
familles (par exemple « Beauté » et « Tenues ») ; voir PRE-15.

**Avancement (08/11/2026)** : SEC-01 et SEC-03 fusionnés (PR n° 75, ADR 0037 et 0038) ; HUB-19
fusionné (PR n° 76, ADR 0039, écarts notés dans l'ADR) ; PRE-14 et PRE-15 fusionnés (PR n° 77,
ADR 0040) ; IMP-11 et IMP-12 fusionnés (PR n° 78, ADR 0041) ; HUB-20 et HUB-21 fusionnés (PR n° 79, ADR 0042) ; ARC-01 fusionné (PR n° 80, ADR 0043) ; SEC-02 sur la branche `lot-16g-limitation-debit` (ADR 0044, migration 0078). Familles de l'agence événementielle proposées dans
`vendor-families.event-agency.json`, à corriger par Julien.

## Contexte

Retours de Julien du 08/11/2026, après la reprise de ses vrais exports en staging :

- « L'enchaînement des menus d'import : la lecture et l'ergonomie ne sont pas au rendez-vous. »
- « Les boutons d'aide ne sont pas toujours placés au même endroit. »
- « J'ai accepté globalement les types de prestataires… c'est devenu illisible. »
- La solution doit pouvoir être revendue à d'autres prestataires de l'événementiel : elle doit
  les aider et rester simple.

Constats détaillés, mesures et causes : `docs/audits/2026-11-08-audit-complet.md`.
Maquettes : artefact « Lot 16 — Reprise UX Symbola »
(<https://claude.ai/artifact/5Yx1EvSwamUnTvU4LT8Trh>).

## Décisions à prendre (Julien)

| | Question | Proposition |
| --- | --- | --- |
| **A** | Où vit le bouton « ? » ? | Dans la **barre du haut**, à droite de la recherche, au même endroit sur tous les écrans. La page ne porte plus de « ? ». |
| **B** | Le panneau d'aide recouvre-t-il l'écran ? | Non : c'est un **tiroir** qui pousse le contenu. Il s'ouvre d'office une seule fois par écran (décision C du lot 13, inchangée). |
| **C** | Combien de niveaux pour classer les prestataires ? | **Deux : familles (une dizaine) et types.** Les pastilles du carnet montrent les familles ; les types apparaissent quand une famille est choisie. |
| **D** | Les familles proposées (audit, U2) conviennent-elles ? | Liste à corriger par Julien et sa femme ; même travail pour l'agence événementielle. |
| **E** | L'import reste-t-il dans Paramètres ? | Le **point d'entrée** reste dans Paramètres › Données (décision F du lot 13). **L'assistant s'ouvre en plein écran**, sans le menu des rubriques, comme l'assistant de démarrage. |
| **F** | Que faire d'un libellé comme « Mannequin », qu'aucun synonyme ne range ? | Une famille **« À classer »**, visible seulement si elle n'est pas vide, avec un bandeau « 3 prestataires à classer ». Jamais un type créé en silence. |

## Règles communes

Les règles du lot 13 restent valables. S'y ajoutent :

1. **Un en-tête d'écran unique** (`PageHeader`) : titre, sous-titre, actions à droite. L'action
   principale est le seul bouton plein ; les autres actions passent dans le menu « ⋯ ».
2. **Un assistant = une décision par écran**, avec une barre d'action fixe en bas
   (« Retour », « Continuer »). « Continuer » enregistre : plus de bouton « Enregistrer »
   intermédiaire.
3. **Ne montrer que ce qui demande une décision** : ce que l'app a reconnu avec certitude se
   résume en une ligne, avec un lien « Voir le détail ».
4. **Aucune liste ne grandit avec le fichier** : au-delà de 20 lignes, un tableau paginé et
   filtrable, jamais une section par ligne.

## Étape 1 — Sécurité de la double authentification (avant la mise en production)

### SEC-01 — Code de double authentification protégé

- **Étant donné** une session qui attend la double authentification, **quand** 5 codes faux
  sont saisis, **alors** la double authentification est verrouillée 15 minutes pour ce compte,
  le verrouillage est journalisé sans donnée personnelle et le titulaire reçoit un e-mail (à ce
  stade, son mot de passe est connu d'un tiers : il doit le changer). Pendant le verrouillage,
  même un code juste est refusé, avec le message « verrouillé », comme pour le mot de passe
  (HUB-01).
- **Quand** un code déjà accepté est saisi à nouveau dans sa période de validité, **alors** il
  est refusé (anti-rejeu).
- **Quand** la double authentification réussit, **alors** un nouveau jeton de session est émis
  et l'ancien est révoqué.
- **Le secret de double authentification est chiffré au repos** (AES-256-GCM, clé
  d'environnement validée au démarrage) ; une migration chiffre les secrets existants.
  Prévoir un ADR et un script d'annulation (ADR 0036).
- Tests d'intégration : verrouillage avec horloge simulée (veille, fin du verrouillage), rejeu,
  rotation du jeton, lecture d'un secret chiffré.

### SEC-03 — Appareil de confiance (90 jours)

Question de Julien du 08/11/2026 : la double authentification n'est pas une obligation légale
(choix de l'ADR 0013, maintenu), et il n'est pas utile de la demander à chaque connexion sur un
appareil connu. Durée retenue : **90 jours** (ADR 0038).

- **Étant donné** l'écran du code, **alors** une case « Se souvenir de cet appareil pendant
  90 jours » est proposée, décochée, avec un rappel de ne pas la cocher sur un ordinateur
  partagé ; jamais à l'Admin.
- **Quand** elle valide son code en la cochant, **alors** les connexions suivantes sur ce
  navigateur ne demandent que le mot de passe, pendant 90 jours (échéance fixe : dispensée la
  veille, code redemandé le lendemain).
- Un appareil retenu par un compte ne dispense jamais un autre compte.
- **Quand** elle réinitialise son mot de passe, que l'Admin réinitialise sa double
  authentification, ou qu'elle clique « Oublier tous mes appareils » (profil ; sécurité de
  l'espace pour un marié), **alors** le code est redemandé partout.
- Le profil indique le nombre d'appareils de confiance.

## Étape 2 — Structure d'écran commune

### HUB-19 — En-tête d'écran et aide au même endroit

- **Quand** elle ouvre n'importe quel écran de l'équipe, **alors** le « ? » est dans la barre du
  haut, au même endroit (test e2e : même position sur 10 écrans représentatifs, en ordinateur
  et en 375 px).
- L'écran déclare son aide (titre, texte, repères) au `HelpContext` ; un écran sans aide
  déclarée affiche le « ? » vers le centre d'aide.
- **Quand** elle ouvre l'aide, **alors** un tiroir s'ouvre à droite et le contenu se décale
  sans être recouvert ; sur téléphone, le tiroir est en plein écran.
- **Quand** elle ferme l'aide (bouton, Échap), **alors** le focus revient au « ? ».
- Les repères se posent **en marge** de l'élément, jamais sur son libellé.
- La suggestion de tutoriel ne s'affiche plus en surimpression : elle est sur l'accueil
  (bloc « Pour bien démarrer ») et dans Tutoriels.
- `PageHeader`, `ActionBar`, `Stepper`, `StatusBadge` et `EmptyState` sont créés dans
  `apps/symbola/app/ui/`. `ScreenHelp` et `PageTour` disparaissent des pages.
- Tous les écrans de l'équipe passent à `PageHeader` (environ 50 écrans, migration
  mécanique). Captures du centre d'aide régénérées.

## Étape 3 — Familles de types de prestataires

### PRE-14 — Familles et types

- Nouvelle table `vendors.vendor_families` (organisation, libellé, couleur, position), sous
  RLS, avec tests d'isolation ; `vendor_types.family_id` peut être nul (famille « À classer »).
- Données de départ par métier (`vendor-families.json`, FR et EN) : familles, types rangés
  dedans, synonymes. Une wedding planner démarre avec environ 25 types répartis en 10 familles.
- Migration des organisations existantes : chaque type est rangé dans sa famille par les
  synonymes, le reste dans « À classer ». Aucune fiche ne change de type.
- **Carnet** :
  - **quand** elle ouvre le carnet, **alors** les pastilles montrent les familles non vides,
    avec leur nombre ;
  - **quand** elle choisit une famille, **alors** les types de cette famille s'affichent en
    second rang, et « Tous » reste sélectionnable ;
  - sur téléphone, les familles tiennent sur une ligne défilante.
- **Carte** : la couleur du point est celle de la famille, avec un pictogramme par famille dans
  le point (critère 1.4.1).

### PRE-15 — Renommer, fusionner, ranger les types

- Paramètres › Types de prestataires : tableau aligné (famille, type, nombre de fiches) ;
  détail et champs dans le panneau latéral (motif du lot 13).
- **Quand** elle renomme un type, **alors** toutes les fiches suivent.
- **Quand** elle fusionne « Coiffeur(se) » dans « Coiffure et maquillage », **alors** les fiches
  passent au type gardé, les champs propres sont repris s'ils n'existent pas déjà, et le type
  fusionné disparaît. L'opération est journalisée ; un import qui avait créé ce type reste
  annulable.
- **Quand** elle supprime un type qui a des fiches, **alors** l'écran demande vers quel type les
  déplacer : plus de fiches qui perdent leur type en silence.
- **Quand** elle change la famille d'un type, **alors** le carnet et la carte suivent.
- **Les familles appartiennent à l'organisation** (décision D, réserve de Julien) : elle peut
  les renommer, en créer, en supprimer une vide, et changer leur ordre et leur couleur.
  **Quand** elle crée la famille « Tenues » et y déplace Robe de mariée, Tenues du marié et
  Bijoux, **alors** « Beauté et tenues », renommée « Beauté », ne garde que ses autres types ;
  le carnet affiche les deux familles et la carte leurs deux couleurs. Les données de départ
  ne sont qu'un point de départ, jamais rétablies d'office.

## Étape 4 — Import en assistant

### IMP-11 — Assistant linéaire

- **Départ** : « Que voulez-vous reprendre ? » en trois tuiles (Mes prestataires · Mes fiches
  événement · Un autre fichier). Le choix détaillé (10 contenus possibles) n'apparaît que pour
  « Un autre fichier ».
- **Étapes en frise** (`Stepper`) : Fichier, Colonnes, Types (prestataires seulement),
  Doublons, Vérifier et confirmer. **Quand** une étape n'a rien à décider, **alors** elle est
  marquée faite et franchie automatiquement, avec son résumé (« 18 colonnes reconnues »).
- **Barre fixe en bas** : « Retour », puis « Continuer », qui enregistre. « Abandonner
  l'import » est un lien discret dans l'en-tête et demande confirmation.
- **Colonnes** : seules les colonnes qui demandent un choix sont affichées, en tableau
  (Colonne du fichier · Exemples · Devient · Confiance) ; les autres se résument en une ligne.
  Un profil reconnu (export du logiciel tiers) décide aussi des colonnes annexes : Département
  ignoré, car tiré du code postal ; TVA, APE et statut gardés en champs libres.
- **Doublons** : tableau filtrable (« À vérifier », « Nouveaux », « Mises à jour »), 20 lignes
  par page, et « Tout accepter » pour les propositions sûres.
- **Aperçu** : les valeurs sont montrées **après** correction (accents, entités HTML, codes
  postaux).
- **Vérifier et confirmer** : bilan des effets (fiches créées et mises à jour, types créés,
  étiquettes créées, colonnes en champ libre, lignes rejetées). Le bouton principal est
  « Importer 25 prestataires ».
- **Fin** : « Voir les 25 prestataires », avancement du placement sur la carte et lien vers le
  journal.
- Un service unique décide de l'étape suivante (`nextImportStep`) ; les écrans ne le
  recalculent plus.
- Un brouillon d'import reprend là où il s'était arrêté (journal → « Reprendre »).

### IMP-12 — Types à l'import par familles

- **Quand** le fichier contient des types, **alors** l'étape « Types » les présente **regroupés
  par famille** : une ligne par famille, avec ses libellés du fichier et ce qu'ils deviennent.
- Chaque libellé est rattaché, dans l'ordre : à un type existant (synonyme ou ressemblance) ; à
  un type de départ de la même famille, créé une seule fois pour tous ses synonymes ; sinon à
  « À classer ». **Jamais un type par libellé par défaut.**
- Elle peut, pour chaque libellé, choisir un autre type, en créer un, ou le ranger dans une
  autre famille.
- Test, avec le corpus fictif (22 libellés) : au plus 12 types créés par défaut, et
  « Coiffeur(se) » et « Maquillage » réunis dans « Coiffure et maquillage ».

## Étape 5 — Écrans restants et vocabulaire

### HUB-20 — Écrans restés à l'ancien motif

- Fiche devis : en-tête avec statut en badge ; actions groupées (Envoyer, Télécharger le PDF,
  Nouvelle version) ; échéancier en tableau.
- Budget détaillé (`/budget/[eventId]`) : à fusionner dans l'onglet Budget de la fiche
  événement si c'est un doublon (ADR 0032), sinon à mettre au motif commun. Montants saisis et
  affichés au format français.
- Encaissements, e-reporting, RGPD, profil : `PageHeader` et tableaux alignés.
- Paramètres : le titre de page est la rubrique ouverte ; le menu des rubriques fait partie de
  la structure d'écran, pas du contenu.
- Accueil : retirer « Bonjour depuis Symbola » ; agenda réduit à 3 mois, avec « Voir l'année ».
- Liste des événements : « Essai guidé » quitte le haut de la liste (menu « ⋯ » et centre
  d'aide).

### HUB-21 — Vocabulaire selon le métier

- Les libellés qui nomment les clients (« mariés », 24 occurrences en FR) dépendent du métier
  de l'organisation : « les mariés » pour un wedding planner, « le client » pour une agence
  événementielle. Messages ICU `select` sur le métier, en FR et en EN.

## Étape 6 — Architecture et limitation de débit

### ARC-01 — Une connexion partagée et une garde d'accès unique

- `packages/db` expose un pool unique par processus ; les 315 appels à
  `createAppConnection()` / `sql.end()` sont remplacés. Les tests d'isolation RLS restent
  inchangés et passent.
- `requirePlanner()` / `requireOwner()` / `requireAdmin()` remplacent les gardes recopiées dans
  85 pages. Un test vérifie que chaque `page.tsx` hors des écrans publics appelle une garde.
- Le module témoin `hello` est retiré (code, tests, entrée de module, appel sur l'accueil).

### SEC-02 — Limitation de débit

- Nouvel ADR : table PostgreSQL à fenêtre glissante (sans dépendance) ou module de limitation
  de Caddy.
- Connexion, double authentification, mot de passe oublié, recherche instantanée et envoi de
  fichier : limites par IP et par compte, réponse 429 avec un message traduit.
- La limite par défaut des Server Actions revient à 1 Mo ; les envois de fichiers passent par
  des routes dédiées.
- En-têtes `Permissions-Policy` et `Cross-Origin-Opener-Policy` ajoutés.

## Tests

- Un fichier de tests par story (`describe('IMP-11 — …')`), un `it` par critère.
- e2e (ordinateur et 375 px, axe-core) pour chaque étape. Le parcours d'import complet avec
  le corpus du logiciel tiers vérifie : aucun lien « Continuer » qui perd des choix, au plus
  2 hauteurs d'écran par étape, et un nombre de types créés borné.
- Isolation : `vendor_families` (organisation A ↔ B), fusion de types (un type de B n'est pas
  visible depuis A), compteurs de double authentification.

## Définition de « terminé »

Elle reste celle de `CLAUDE.md` § 7, avec en plus : captures du centre d'aide régénérées,
puis recette de Julien sur le staging **avec ses vrais exports** (nombre de types après import,
durée de l'import, nombre d'écrans franchis).
