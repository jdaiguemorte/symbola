# Audit complet de Symbola — UX, accessibilité, sécurité, architecture

- Date : 8 novembre 2026
- Version auditée : `main` à `480d1a6` (lots 0 à 15)
- Demande de Julien : « l'enchaînement des menus d'import n'est pas au rendez-vous, les boutons
  d'aide ne sont pas toujours au même endroit, les types de prestataires acceptés à l'import sont
  devenus illisibles ; la solution doit pouvoir être revendue à d'autres prestataires de
  l'événementiel, elle doit les aider et rester simple. »
- Suite proposée : `docs/lots/lot-16-reprise-ux.md`

## Méthode

1. **Parcours réel** : l'app compilée (`next build`, puis `next start`, comme la CI) tourne sur le
   socle de dev, avec un compte et une organisation fictifs (« Atelier Audit »). L'audit a
   suivi l'assistant de démarrage « Wedding planner », puis importé
   `packages/testing/import-corpus/files/logiciel-tiers/prestataires.xlsx`, un export fictif de
   25 prestataires répartis sur 22 types. Chaque étape a été vue en 1 440 px et en 375 px.
2. **Captures réelles** du centre d'aide (`apps/symbola/public/aide/captures/`), pour les écrans
   qui demandent des données (devis, budget, fiche événement).
3. **Lecture du code** : composants d'écran, import (`app/import`, `lib/import`), carnet
   (`app/prestataires`, `modules/vendors`), aide (`app/screen-help.tsx`, `app/page-tour.tsx`,
   `packages/ui/src/landmarks.tsx`), authentification (`packages/auth`), en-têtes et routes de
   fichiers.

Les mesures ci-dessous (hauteurs de page, nombres de titres) ont été relevées dans le
navigateur sur ce jeu fictif. Avec les 200 prestataires de la capture de Julien, tout ce qui
est proportionnel au nombre de lignes est environ huit fois plus long.

## Ce qui fonctionne bien

Il faut le garder :

- **Isolation des données.** RLS sur chaque table, avec un contexte transactionnel
  (`set_config(…, true)`, `packages/db/src/with-organization.ts:17`). Le rôle applicatif n'a pas
  `BYPASSRLS`. L'Admin n'a aucun accès aux données métier (ADR 0029).
- **Socle de sécurité.** CSP à nonce, fichiers servis par l'app après contrôle des droits,
  route des tuiles protégée contre la traversée de dossiers (`lib/map/tiles.ts:18`),
  neutralisation des formules à l'import, antivirus, webhook signé, fiches PDF chiffrées en
  attente de lecture, argon2id, verrouillage après 5 mots de passe faux. Chaîne de CI
  complète.
- **Moteur d'import.** Il détecte l'encodage, le séparateur et les colonnes inversées, et
  reconnaît l'export du logiciel tiers. Le moteur est bon ; c'est **l'écran** qui le dessert.
- **Assistant de démarrage.** Six étapes visibles, une décision par écran, des valeurs
  pré-remplies : c'est le modèle à reproduire pour l'import.
- **Fiche événement.** La frise du statut et le bandeau « Prochaine étape » sont clairs.
- **Tests.** Un `describe` par story, des tests d'isolation, des parcours e2e avec axe-core.

## Synthèse : 5 chantiers par ordre d'impact

| # | Chantier | Gravité | Pourquoi d'abord |
| --- | --- | --- | --- |
| 1 | Import en assistant linéaire | Bloquant pour la revente | Premier contact de tout nouveau client (reprise de ses données) |
| 2 | Familles de types de prestataires, fusion et renommage | Bloquant pour la revente | Un import ordinaire rend le carnet illisible, sans moyen de réparer |
| 3 | Une seule structure d'écran, le « ? » toujours au même endroit | Élevée | Incohérence visible sur ~50 écrans |
| 4 | Double authentification protégée contre la force brute, limitation de débit | Élevée (sécurité) | Seul vrai trou de sécurité trouvé |
| 5 | Pool de connexions, garde d'accès factorisée, kit d'écran partagé | Moyenne (architecture) | Tenue à plusieurs clients, coût de chaque nouvel écran |

---

## 1. UX

### U1 — L'import est un aller-retour, pas un parcours (bloquant)

Ce qui se passe aujourd'hui, étape par étape (`apps/symbola/app/import/`) :

| Étape | Constat mesuré |
| --- | --- |
| Départ (`/import`) | 2 cartes « Reprendre depuis votre outil actuel », puis une liste d'étapes non stylée (« 1. Étape 1 sur 5 : fichier » : la numérotation apparaît deux fois), puis **10 boutons radio**, dont 2 font doublon avec les cartes. Le formulaire est sous la ligne de flottaison. Une pastille « Commencer le tutoriel » recouvre le bas de l'écran. |
| Fichier lu (`/import/[id]`) | Page récapitulative : ce qui a été reconnu, puis un aperçu de 22 colonnes écrasé par la 3ᵉ colonne du menu Paramètres. Les entités HTML brutes (« Ch&acirc;teau ») restent visibles, alors qu'elles seront corrigées à l'enregistrement. **L'étape suivante est un lien texte en bas de page ; « Abandonner l'import » est un bouton**, donc plus visible que l'action qui fait avancer. |
| Colonnes | 22 cartes empilées, chacune avec sa liste de 20 champs. **Page de 7 669 px, soit 8,5 hauteurs d'écran** (la règle du lot 13 en fixe 2 au maximum), pour un fichier dont 18 colonnes sont reconnues à 95 %. Un seul bouton, tout en bas. Après « Enregistrer », **retour au récapitulatif**, pas à l'étape suivante. |
| Rapprochements | Une section de 22 listes déroulantes « Type de carnet pour X », puis **une section par ligne du fichier** (26 titres `h2` pour 25 lignes), qui répète 25 fois « À la confirmation, cette ligne créera un nouvel élément ». Page de 5 641 px. |
| Écarts | Le profil « logiciel tiers » est reconnu, et pourtant 4 colonnes restent « à décider » : Département, TVA intracommunautaire, Code APE, Statut juridique. |
| Confirmation | « 25 créations » : **les 15 types de prestataires qui vont être créés ne sont pas annoncés**. Le bouton « Confirmer l'import » a le style d'une action secondaire. |
| Fin | Page « journal » : aucun lien « Voir mes prestataires ». |

**Piège de perte de saisie.** Sur « Rapprochements » et « Écarts », les choix s'enregistrent par
un bouton intermédiaire (« Enregistrer les types », « Enregistrer les choix »). La suite est un
simple lien (« Continuer : … »). Quand on clique « Continuer » sans avoir enregistré, **les choix
sont perdus en silence** (`[importId]/rapprochements/page.tsx` : le formulaire des types et le
lien de suite sont séparés).

**Cause.** Chaque étape est une page autonome qui renvoie au récapitulatif. L'étape courante
est recalculée dans chaque page (`[importId]/page.tsx:47`) ; aucun service ne dit « voici
l'étape suivante, et celle-ci peut être sautée ».

**Recommandation** (maquette : écran « Import » de l'artefact) :

- Un **assistant linéaire en plein écran**, sorti des Paramètres, sur le modèle de l'assistant
  de démarrage : étapes en frise, une décision par écran, et une barre fixe en bas
  « ← Retour · Continuer → » qui **enregistre en continuant**.
- **Départ en une question** : « Que voulez-vous reprendre ? » avec 3 grandes tuiles
  (Prestataires · Fiches événement · Autre fichier). Le choix détaillé du contenu n'apparaît
  que pour « Autre fichier ».
- **Étapes sautées quand il n'y a rien à décider** : « 18 colonnes reconnues ✓ » se replie en une
  ligne (« Voir le détail »). Seules les colonnes qui demandent un choix sont affichées, dans
  un tableau à 4 colonnes (Colonne du fichier · Exemples · Devient · Confiance).
- **Étape « Types » dédiée** pour un fichier de prestataires (voir U2) : regroupement proposé par
  famille, et non un type créé par libellé.
- **Rapprochements en tableau filtrable** (« À vérifier · n », « Nouveaux · n », « Mises à jour
  · n ») : les 25 « nouvel élément » se résument en un chiffre.
- **Confirmation = bilan des effets** : fiches créées et mises à jour, types et étiquettes
  créés, colonnes gardées en champ libre. Le bouton principal est en style principal.
- **Fin = prochaine action** : « Voir les 25 prestataires », « Placer sur la carte : 12/16 ».

### U2 — Les types de prestataires éclatent à l'import (bloquant)

**Cause, dans le code.** `computeVendorTypeChoices` (`apps/symbola/lib/import/matching.ts:135`) ne
rapproche un libellé du fichier que d'un type **déjà présent** dans l'organisation. Le
dictionnaire `packages/starter-templates/src/vendor-type-synonyms.json` sait pourtant que
« Coiffeur(se) », « Maquillage » et « Coiffeur(se) - Maquilleur(se) » sont une même famille
(`hair_makeup`). Mais une wedding planner démarre avec **6 types seulement**
(`vendor-types.json`). Tout ce qui n'est pas l'un de ces 6 types est donc proposé, par défaut,
en « Créer le type « X » », un type par libellé.

**Reproduit.** Sur 22 libellés, 15 créations sont proposées par défaut. « Coiffeur(se) » et
« Maquillage » y sont séparés. « Vidéaste » y figure aussi, alors que c'est un synonyme
connu. Une fois l'import accepté tel quel, le carnet affiche 22 pastilles pour 25 fiches.
Sur la capture de Julien : **45 pastilles pour 200 fiches**.

**Ce qui aggrave :**

- **Rien ne permet de réparer.** Paramètres › Types de prestataires ne propose que
  « Supprimer » : ni renommer, ni fusionner, ni ranger. Supprimer un type **vide la catégorie**
  de ses fiches (`onDelete: "set null"`, `packages/db/src/schema/vendors.ts:62`). La page de
  réglage fait 8 262 px.
- **Une couleur par type.** Au-delà de 8 à 10 couleurs, les points de la carte ne se
  distinguent plus.
- **Pastilles vides affichées** (« Hôtel / hébergement · 0 »).
- **Sur téléphone**, les pastilles occupent plus d'un écran avant le premier résultat.
- **Doublons de sens** dans les vrais exports : « Décorateur » / « Décorateurs de mariage »,
  « Lieu de réception » / « Salle de mariage », « Tenues de mariés » / « Costume du marié ».

**Recommandation : deux niveaux, familles et types** (maquette : écran « Carnet »).

- **Familles** : une dizaine, fournies en données de départ traduisibles par métier (ADR 0007,
  aucun libellé dans le code), modifiables par l'organisation. Proposition à valider pour un
  wedding planner :

  | Famille | Types rangés dedans (exemples de l'export réel) |
  | --- | --- |
  | Lieux et hébergement | Lieu de réception, Salle de mariage, Hôtel / hébergement, Église, Location de tentes |
  | Traiteur et boissons | Traiteur, Food truck, Brunch, Boulangerie, Cake designer, Dessert de mariage, Vins et boissons |
  | Photo et vidéo | Photographe, Vidéaste, Photobooth |
  | Musique et son | DJ / musiciens, Live band, Sonorisation et lumière |
  | Fleurs et décoration | Fleuriste, Décorateur, Location de mobilier et vaisselle, Location de nappes, Art |
  | Beauté et tenues | Coiffure et maquillage, Robe de mariée, Tenues des mariés, Bijoux, Bien-être |
  | Cérémonie et organisation | Officiant, Wedding planner, Event planner |
  | Papeterie | Faire-part, Tampons et gravures |
  | Animation et enfants | Animation, Escape game, Location de jeux, Baby-sitter |
  | Transport | Location de voitures |

  Les libellés que rien ne permet de classer (« Mannequin ») vont dans « À classer », jamais
  dans un type créé en silence.

- **Carnet** : les pastilles portent les **familles** (10 au plus, sans les familles vides) ;
  les types de la famille choisie s'affichent en second rang. La couleur de la carte est celle
  de la famille.
- **Import** : chaque libellé est rattaché à une famille (par les synonymes), puis à un type
  existant de cette famille s'il y en a un. Sinon, un seul type est créé par groupe de
  synonymes, et non un par libellé. L'écran présente **10 familles à vérifier**, pas
  45 listes déroulantes.
- **Paramètres › Types** : renommer ; **fusionner** (les fiches passent au type gardé, l'import
  reste annulable) ; changer de famille ; ordre par glisser-déposer ; tableau aligné avec
  panneau latéral (motif du lot 13).
- **Données de départ enrichies** : 25 à 30 types par métier, rangés en familles. C'est le
  levier qui sert le plus la revente : une nouvelle cliente retrouve ses catégories.

### U3 — Le « ? » change de place d'un écran à l'autre (élevé)

**Constat.** Deux motifs d'en-tête coexistent :

- **7 écrans** (carnet, devis, tâches, Admin…) utilisent `div.page-header` : titre à gauche ;
  à droite, « ? », roue crantée et action principale.
- **Une quarantaine d'écrans** posent `<h1>`, puis `<ScreenHelp>` seul, **sous le titre, à
  gauche** (import et ses 5 étapes, fiche devis, budget, paramètres, RGPD, profil…).
- La liste des événements, qui a pourtant des repères, place aussi « ? » sous le titre.

À cela s'ajoutent :

- Le panneau de repères **s'ouvre d'office et recouvre** la carte, le formulaire ou la liste.
  Ses repères numérotés masquent les libellés (sur la capture du carnet, « Nom ou ville » est
  caché par le repère 2).
- La pastille « Découvrir en 4 minutes · Commencer le tutoriel » s'affiche **par-dessus le
  contenu** sur plusieurs écrans ; en 375 px, au milieu de l'écran.

**Recommandation** (maquette : « Structure d'écran ») :

- **Un composant `PageHeader`** pour tous les écrans : fil d'Ariane facultatif, titre,
  sous-titre ; à droite, les actions dans un ordre fixe (action principale, puis « ⋯ »).
- **Le « ? » quitte la page pour la barre du haut**, à droite de la recherche, au même pixel
  sur tous les écrans. L'écran déclare son aide (titre, texte, repères) par le `HelpContext`
  qui existe déjà (`app/help-context.tsx`). La roue crantée rejoint le menu « ⋯ ».
- **Le panneau d'aide devient un tiroir** qui pousse le contenu au lieu de le recouvrir.
  À la fermeture, il rend le focus au « ? ».
- **Une seule suggestion de tutoriel**, sur l'accueil ou dans le centre d'aide, jamais en
  surimpression sur un écran de travail.

### U4 — Écrans restés à l'ancien motif (élevé)

- **Fiche devis** (`app/devis/[quoteId]`). Statut en texte (« Statut : Envoyé — Version 1 »),
  PDF en lien, aucune barre d'actions. C'est l'écran que la cliente montre le plus : il doit
  avoir son en-tête, son statut en badge et ses actions groupées (Envoyer, Télécharger,
  Nouvelle version).
- **Budget détaillé** (`app/budget/[eventId]`). Formulaire empilé ; montants en saisie brute
  (« 2929.5 » au lieu de « 2 929,50 € »). À vérifier : cet écran fait-il doublon avec l'onglet
  Budget de la fiche événement (ADR 0032) ?
- **Encaissements, e-reporting, RGPD, profil** : même ancien motif.
- **Paramètres** :
  - le titre reste « Paramètres » quelle que soit la rubrique ouverte (« Entreprise et
    TVA »…) ;
  - le menu des rubriques est dans le contenu : la barre de recherche se décale de 260 px
    entre un écran métier et un écran de réglage, et les tableaux larges (aperçu d'import) sont
    écrasés.
- **Accueil** :
  - sur-titre « Bonjour depuis Symbola », hérité du module témoin `hello` du lot 0 ;
  - agenda de 12 mois complets en tête de page.
- **Liste des événements** : le bloc « Essai guidé » occupe le haut de l'écran, au-dessus de la
  liste.
- **Hiérarchie des boutons** :
  - l'action principale prend parfois le style secondaire (« Confirmer l'import »,
    « Démarrer l'essai ») ou devient un lien (« Continuer : … ») ;
  - une action d'abandon prend le style d'un bouton.

### U5 — Pour une solution revendable (moyen)

- **Vocabulaire du mariage.** « mariés » apparaît 24 fois dans
  `packages/i18n/src/messages/fr.json`, alors que le métier « agence événementielle » existe
  depuis le lot 12. Pour une agence, il faut dire « clients » ou « organisateurs » : faire
  dépendre ces libellés du métier.
- **Données de départ minces.** 6 types de prestataires pour un wedding planner : l'import en
  crée 15 à 40. Voir U2.
- **Marque blanche** (logo, couleur d'accent par organisation) : pas demandé, mais facile à
  préparer si la charte passe par des variables (ADR 0025). À garder pour la V2.

---

## 2. Accessibilité

axe-core passe dans les parcours e2e : les contrôles automatiques sont au vert. Les points
ci-dessous sont des défauts d'usage qu'axe ne voit pas.

| # | Constat | Critère | Correctif |
| --- | --- | --- | --- |
| A1 | Le panneau d'aide ne rend pas le focus au « ? » quand on le ferme (`packages/ui/src/landmarks.tsx`). Il recouvre les champs, et ses repères masquent des libellés. | WCAG 2.4.3, 2.4.11 (2.2) | Tiroir qui pousse le contenu ; focus rendu au déclencheur ; repères placés en marge, pas sur le libellé |
| A2 | Étapes de l'import en liste ordonnée qui répète « Étape 1 sur 5 » : un lecteur d'écran annonce « 1. Étape 1 sur 5 ». | 1.3.1 | Composant `Stepper` commun (déjà dessiné pour le démarrage) |
| A3 | Rapprochements : un titre `h2` par ligne du fichier (26 pour 25 lignes, 200 et plus en réel). La navigation par titres devient inutilisable. | 2.4.6, 2.4.10 | Tableau ; titres réservés aux sections |
| A4 | Choix des types : 22 à 45 listes déroulantes à la suite, dont chaque libellé répète le type. | 3.3.2 | 10 familles, une ligne par famille |
| A5 | Carte : le type n'est porté que par la couleur du point, avec une couleur par type. | 1.4.1, 1.4.11 | Couleur par famille (10 au plus) et pictogramme dans le point |
| A6 | 375 px : les pastilles de types occupent plus d'un écran ; la pastille de tutoriel recouvre le contenu. | 1.4.10 | Familles repliables en une ligne défilante ; suggestion de tutoriel sans recouvrement |
| A7 | Choix enregistrés par un bouton intermédiaire, puis lien de suite qui les perd sans prévenir (U1). | 3.3.4, 3.3.7 | Enregistrer en continuant |

---

## 3. Sécurité

| # | Gravité | Constat | Correctif |
| --- | --- | --- | --- |
| S1 | **Élevée** | **Code de double authentification sans limite d'essais.** `confirmTotp` (`packages/auth/src/service.ts:154`) ne compte pas les échecs, et aucune limitation de débit n'existe : la page `/mfa` se rejoue sans fin. Avec un mot de passe connu (réutilisé, hameçonné), le code à 6 chiffres se devine par force brute : 3 codes valides à chaque instant (`window: 1`), donc quelques heures à 50 requêtes par seconde. Le verrouillage après 5 essais ne protège que le mot de passe. | Compteur d'échecs de double authentification (5 essais, puis verrouillage de 15 min et journal), comme pour le mot de passe ; refus d'un code déjà utilisé (anti-rejeu) ; test d'intégration |
| S2 | Moyenne | **Aucune limitation de débit**, ni dans l'app ni au proxy (reportée par l'ADR 0018). Exposés : connexion, mot de passe oublié (envoi d'e-mails), double authentification, recherche instantanée, import. Le verrouillage par compte freine une attaque ciblée, mais permet de bloquer à volonté le compte d'une utilisatrice connue, et ne freine pas le bourrage d'identifiants sur de nombreux comptes. | Limitation par IP et par compte : table PostgreSQL à fenêtre glissante, sans nouvelle dépendance, ou module de limitation de Caddy. Nouvel ADR. Indispensable avant d'ouvrir à d'autres clients. |
| S3 | Moyenne | **Secret de double authentification stocké en clair** (`users.totp_secret`). Une fuite de la base (copie, sauvegarde mal rangée) livre le second facteur. | Chiffrer au repos (AES-256-GCM, clé d'environnement), sur le modèle des fiches PDF du lot 15 (ADR 0035) ; migration qui chiffre l'existant |
| S4 | Faible | **Jeton de session inchangé après la double authentification** (`service.ts:168`). Il passe à `mfaVerified = true` sans être renouvelé. Le risque est limité (cookie httpOnly, SameSite=Lax). | Émettre un nouveau jeton à la validation et révoquer l'ancien |
| S5 | Faible | **Limite de 21 Mo pour toutes les Server Actions** (`next.config.ts`, prévue pour les devis joints du PRD-BUD-03). N'importe quelle action accepte 21 Mo, avant même le contrôle de session. | Limite par défaut (1 Mo) ; envois de fichiers par des routes dédiées, en flux, avec la session contrôlée avant la lecture du corps |
| S6 | Faible | Ni `Permissions-Policy` ni `Cross-Origin-Opener-Policy` dans les en-têtes. | Ajouter : `camera=(), microphone=(), geolocation=()` et `same-origin` |
| S7 | Info | Disponibilité : une connexion PostgreSQL ouverte par requête (voir R1). | Voir R1 |

---

## 4. Architecture

| # | Gravité | Constat | Recommandation |
| --- | --- | --- | --- |
| R1 | **Moyenne-élevée** | **Une connexion PostgreSQL neuve à chaque requête** : 315 appels à `createAppConnection()` dans 152 fichiers. Chacun crée un pool `postgres()` puis le ferme (`sql.end()`). Chaque page paie l'ouverture d'une connexion et son authentification ; sous charge, on approche vite `max_connections` (100). | **Un pool unique par processus** (singleton dans `packages/db`). Le contexte RLS est déjà limité à la transaction (`set_config(…, true)`), donc le partage est sûr. Migration mécanique ; test d'isolation inchangé. |
| R2 | Moyenne | **Garde d'accès recopiée** dans 85 pages : 5 lignes `getPlannerAuthContext()` puis 4 redirections. Un oubli sur un nouvel écran ouvre une page sans contrôle de rôle (la RLS protège les données, pas l'écran). | `requirePlanner()` / `requireOwner()` qui renvoient le contexte ou redirigent ; à terme, un layout par groupe de routes |
| R3 | Moyenne | **Pas de kit d'écran partagé** : `packages/ui` ne contient que `landmarks.tsx`. Sans `PageHeader`, `Stepper`, `ActionBar`, `EmptyState` ni `StatusBadge`, chaque écran réinvente son en-tête (origine de U3 et U4). | Créer ces composants dans `app/ui/` (motif de l'ADR 0033), puis migrer écran par écran |
| R4 | Moyenne | **Assistant d'import sans état central** : chaque page recalcule l'étape et rien ne décide de l'étape suivante (origine de U1). | Un service `importWizard.next(importId)` : étape suivante, étapes sautées, ce qui reste à décider. Les écrans ne font que l'afficher. |
| R5 | Faible | **Gros fichiers** : `events/repository.ts` (1 917 lignes), `quotes/repository.ts` (1 771), `quotes/service.ts` (1 711), `events/service.ts` (1 509), `app/events/[id]/page.tsx` (842). | Découper par sous-domaine (devis / factures / avoirs ; événement / rétroplanning / programme) quand on y touche, pas en chantier dédié |
| R6 | Faible | **Module témoin `hello` toujours branché** sur l'accueil (« Bonjour depuis Symbola », `app/page.tsx:7`). | Le retirer, avec ses tests et son entrée de module |
| R7 | Faible | **Mode dev** : `pnpm dev` a affiché une page blanche qui se recharge en boucle sur `/demarrage` (environ 7 requêtes par seconde) ; la version compilée fonctionne. Cause non établie (piste : CSP `style-src` à nonce et styles injectés par Next en dev). | À reproduire sur le poste de Julien ; sans effet sur le staging ni la production |

---

## 5. Ordre de traitement proposé

Le détail est dans `docs/lots/lot-16-reprise-ux.md`. Chaque étape fait l'objet d'une PR et d'une
recette sur le staging.

1. **Sécurité S1, S3 et S4** : une petite PR, à faire avant la mise en production des lots 13 à 15.
2. **Kit d'écran et « ? » unique** (R3, U3, A1) : base de tout le reste.
3. **Familles de types** (U2, A4, A5) : migration, données de départ, carnet, réglages
   (fusion, renommage).
4. **Import en assistant** (U1, R4, A2, A3, A7) : s'appuie sur 2 et 3.
5. **Écrans restants** (U4) et vocabulaire par métier (U5).
6. **Architecture** : R1 (pool), R2 (garde), R6 (`hello`), et S2 (limitation de débit, avec un
   ADR).
