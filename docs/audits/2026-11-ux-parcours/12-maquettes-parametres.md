# Maquettes du volet 6 : « Paramètres » (lot 68, phase 5)

Date : 26/11/2026, par Claude Code. Sixième et dernier volet de l'ordre validé à la porte 2
([06-decisions-porte-2.md](06-decisions-porte-2.md), § 3), après les volets 1 à 5 (notes
[07](07-maquettes-transverse-taches.md) à [11](11-maquettes-premiers-pas-aide.md)). Cette note dit ce
qui est proposé (§ 2), les choix retenus par défaut (§ 3), l'inventaire des fonctions gardées (§ 3 bis),
ce que les maquettes supposent de l'app (§ 4), ce qui a été vérifié et ce qui ne l'a pas été (§ 5), et
les constats non traités (§ 6). Aucun écran de l'app n'est modifié ; `DESIGN.md` n'est pas touché.

## 1. Les livrables

Cinq pages HTML autonomes dans [`docs/maquette/lot-68/`](../../maquette/lot-68/index.html), au gabarit
des pages 22 à 28 (même feuille de style et mêmes icônes que la page 28, octet pour octet ; un bloc
« Volet 6 » ajouté en fin de feuille), ajoutées au sommaire :

| Page | Contenu | Constats |
| --- | --- | --- |
| [29. Le menu](../../maquette/lot-68/29-parametres-menu.html) | L'accueil des Paramètres (1 440, 375) ; les rubriques jumelles et leur renvoi ; « Vos données », à part ; le menu entier, rubrique par rubrique | C-71, C-72, C-73 ; P-22 |
| [30. Le patron d'un écran de réglage](../../maquette/lot-68/30-parametres-ecran-reglage.html) | Un réglage isolé (« Tâches : catégories et échéances », le seuil de « Bientôt ») ; des champs liés (la fiche de l'entreprise : modifiée, vide, reprise) ; les automatismes et le radar coupé ; le patron en une table | C-75 ; D7, M10, A6 |
| [31. Le téléphone et le zoom à 150 %](../../maquette/lot-68/31-parametres-telephone-zoom.html) | « Plus », la liste, une rubrique seule (375) ; à 911 × 512 : le menu latéral (mesuré avant et après), une rubrique et sa barre, le panneau d'aide | C-79, C-82 |
| [32. La recherche dans les réglages](../../maquette/lot-68/32-parametres-recherche.html) | Une seule recherche, « copie de mes données » et « assurance » ; aucune réponse ; les quinze demandes de PC-07 | C-74 ; M9 |
| [33. Le bouton « Réglages » des écrans](../../maquette/lot-68/33-parametres-bouton-reglages.html) | La section « Réglages » du menu « ⋯ » ; le panneau « Pour cet écran » (1 440, 375) ; « ce mariage » ou « vos futurs mariages » ; écran par écran | C-11 ; P-12, P-22 |

Chaque maquette met l'écran d'aujourd'hui à côté de l'écran proposé. Le relevé n'avait qu'une capture
des Paramètres (`parametres-notifications-375.jpg`) : sept captures ont été prises le 26/11/2026 sur
l'app du relevé (lot 67, jeu fictif, port 3068, Chromium sans écran) et ajoutées à `preuves/` :
`parametres-menu-1440.jpg`, `parametres-menu-911.jpg`, `parametres-notifications-911.jpg`,
`parametres-recherche-1440.jpg`, `parametres-categories-taches-1440.jpg`, `taches-reglages-1440.jpg`,
`aide-ecran-taches-911.jpg`. Elles ne montrent que des données fictives (adresse `@exemple.test`).
Ailleurs, l'avant est décrit d'après le code et les journaux PC-07.

Formes reprises telles quelles : la barre du haut et le menu du compte (page 3), la recherche typée
(page 3), la barre du bas et « Plus » (D4), le message de retour, le danger et l'erreur de saisie
(page 4), la ligne de tâche (volet 1), l'en-tête de la fiche (volet 3), le menu « ⋯ » (volets 3 et 4),
le panneau d'aide (page 26), la lecture d'une phrase (page 27), la liste de réglages (lot 61), la liste
éditable et le formulaire en grille (lot 62), le panneau latéral (ADR 0107). Formes nouvelles :
l'accueil des Paramètres en cartes, le menu d'un groupe à gauche d'une rubrique, la page « Vos
données », « ✓ Enregistré » à côté d'un réglage, la barre d'enregistrement d'un formulaire lié, la
portée dans l'en-tête, le menu latéral à pied tenu, la section « Réglages » d'un menu « ⋯ ».

Données fictives : l'Atelier Roussel de Camille Roussel (titulaire) et de Bastien (Planner), le mercredi
25 novembre 2026 ; « Léa & Maxime », samedi 12 juin 2027 ; « Studio Lumière », photographe du carnet.
Couleurs : jetons actuels, répartition A en rôles ; aucune teinte du futur trio.

## 2. Ce qui est proposé

**Le menu (page 29).**

- « Paramètres » ouvre une page d'accueil : huit groupes, tous ouverts, de deux à sept rubriques,
  chacune avec une phrase qui dit ce qu'elle règle ; deux écrans de haut à 1 440 px. Plus de groupes à
  déplier ni de groupe à dix-huit rubriques. 38 rubriques au lieu de 53 entrées.
- Les groupes suivent le travail : Votre entreprise ; Vous ; Évènements ; Tâches, programme et jour J ;
  Budget et prestataires ; Devis et factures ; Messages et automatismes ; Rendez-vous. Un groupe d'un
  module non souscrit disparaît ; une rubrique réservée à la titulaire reste lisible par l'équipe et le
  dit (« titulaire »).
- Les libellés commencent par ce qui les distingue (« Prestataires : … », « Messages types : ce que vous
  envoyez », « E-mails automatiques : ce que Symbola envoie »). Les jumelles se fondent (« Budget :
  postes de départ et répartition », « Types d'évènements et termes des clients ») ou se renomment ; une
  jumelle renvoie à l'autre en tête.
- Une rubrique ouverte garde à gauche le menu de son groupe (sept lignes au plus), puis les autres
  groupes en une ligne chacun, et « Tous les paramètres » ; ce menu tient dans l'écran et ne défile pas
  avec la page. Le titre de la rubrique est son libellé du menu.
- Ce qui n'est pas un réglage quitte les Paramètres pour une page « Vos données », ouverte par une ligne
  à part en bas de l'accueil et par le menu du compte : copie de toutes vos données, reprise d'une copie
  Symbola, corbeille, historique des actions, historique des e-mails envoyés, demandes sur les données
  personnelles, stockage, comptabilité ; « Fermer l'espace » seul, en bas, dans la forme du danger.
  « Importer » rejoint « Reprendre et importer » (volet 2).

**Le patron d'un écran de réglage (page 30), selon D7.**

- Un en-tête commun : le libellé du menu, une phrase (ce que la rubrique règle et où cela se voit), la
  portée (« Pour toute l'agence » ou « Pour vous seule ») et qui la change.
- Quatre formes : liste de réglages (chaque réglage s'enregistre seul ; « ✓ Enregistré » à côté de
  lui) ; liste éditable (une ligne s'ouvre en place et s'enregistre seule ; « Monter », « Descendre »,
  « Supprimer… » au menu « ⋯ » de la ligne) ; formulaire à champs liés (un seul « Enregistrer … »,
  dans une barre collée en bas, qui dit l'état en mots et les champs modifiés ; jamais grisé) ; modèles
  (liste et fenêtre, règle du lot 63). Un bouton plein au plus par écran.
- Le seuil de « Bientôt » (M10) est la première ligne de « Tâches : catégories et échéances » : sept
  jours au départ, de 1 à 30, pour toute l'agence.
- La fiche de l'entreprise : identité ; adresse et coordonnées dans un même bloc ; activité (métier,
  mariages par an, venus de l'assistant de démarrage) ; la TVA, datée, en ligne à part avec sa fenêtre.
  Vide (espace neuf), elle dit en tête ce qui manque avant le premier devis.
- Les automatismes disent leur état en mots (« En marche », « Coupé »). Le radar coupé dit depuis quand,
  par qui et ce que cela change (« aucune alerte n'arrive dans « À traiter en premier » ») ; sa rubrique
  de règles le redit en tête, avec « Remettre le radar en marche » (A6).

**Le téléphone et le zoom (page 31).**

- Sur téléphone, « Plus › Paramètres » ouvre la liste ; une rubrique s'ouvre seule, avec
  « ‹ Paramètres » ; son premier réglage est à 150 px du haut au lieu de 1 200. « PUSH » devient « Ce
  téléphone ».
- Le menu latéral de l'app : les modules souscrits, un filet, « Paramètres » et « Aide » tenus en bas.
  « Tous les modules » passe dans « Abonnement et modules » et le menu du compte ; « Tutoriels » dans
  « Aide ». Sous 640 px de haut, les lignes se resserrent (44 px, sans espace). À 911 × 512, toutes les
  entrées sont dans la fenêtre : « Aide » finit à 506 px (aujourd'hui à 701).
- Sous 1 100 px de large, une rubrique s'ouvre sans le menu à gauche, avec « ‹ Paramètres · groupe » ;
  la barre d'enregistrement reste dans la fenêtre. Le panneau d'aide se pose sur la droite, de toute la
  hauteur, avec son défilement (règle du volet 5, mesurée ici). Une fenêtre fait au plus la hauteur de
  l'écran moins 32 px ; son contenu défile entre l'en-tête et les boutons.

**La recherche (page 32).** Le champ « Chercher un réglage » disparaît ; la recherche du haut trouve aussi
les réglages, par leur nom, leur phrase, les réglages qu'ils contiennent et des synonymes (données
traduisibles). Elle dit ce qu'elle a compris, le chemin de chaque réglage et la ligne qui répond ; sur
une page des Paramètres, les réglages viennent en tête ; aucune réponse propose des mots voisins et la
liste entière. Les quinze demandes de PC-07 trouvent leur rubrique, dont les deux où le panel a buté.

**Le bouton « Réglages » (page 33).** La roue quitte les en-têtes ; le menu « ⋯ » de l'écran a une
section « Réglages », en dernier, dont chaque ligne nomme ce qu'elle règle et sa portée (« Régler les
tâches… », « Postes de départ de vos futurs mariages… · Ne change pas les postes de « Léa &
Maxime » »). Elle ouvre le panneau latéral « Réglages de « Tâches » » : « Pour cet écran » nomme les
rubriques qui le concernent ; la rubrique s'y règle comme dans les Paramètres ; « Voir dans les
Paramètres » garde « ‹ Retour à Tâches ».

## 3. Les choix, retenus par défaut

**Règle de Julien du 26/11/2026** (rappelée en [09, § 3](09-maquettes-aujourdhui-evenements.md)) : les
propositions des nouvelles maquettes sont retenues par défaut et priment sur les décisions antérieures
qu'elles contredisent ; on vérifie qu'aucune fonction majeure ne disparaît (§ 3 bis) ; l'ergonomie
cible est celle des maquettes. Les seize choix ci-dessous sont donc **retenus tels que proposés**, sauf
avis contraire de Julien. L'autre voie est donnée pour mémoire. Ils sont numérotés G1 à G16 (les
lettres M, R, A, E, V, B servent aux volets 1 à 5 ; P aux principes).

Décisions antérieures que ce volet contredit ou complète, la maquette l'emportant :

- **Page 3 (volet 1, M7) et note 11 (§ 3 bis, ligne « Menu »)** : « Tous les modules » et « Tutoriels »
  restaient au menu latéral. Ils en sortent (G11) ; la page « Tous les modules » et les tutoriels
  restent, par d'autres portes (§ 3 bis).
- **Page 3 (volet 1)** : l'exemple de recherche nommait « Relances automatiques · Paramètres ›
  Messages » ; les rubriques ont désormais les noms de la page 29.
- **Lot 62b (D2)** : les groupes repliables et « Chercher un réglage » du menu des Paramètres sont
  remplacés par l'accueil (G1), le menu du groupe (G7) et la recherche du haut (G13).
- **R18 (volet 2)** : gardé ; seule la porte change (G6).

| # | Question | Où regarder | Proposition retenue | L'autre voie |
| --- | --- | --- | --- | --- |
| G1 | Où mène « Paramètres » ? (C-72) | Page 29, « L'accueil » | Une page d'accueil : huit groupes ouverts, une phrase par rubrique | Garder l'arrivée sur « Entreprise et TVA », avec le menu replié |
| G2 | Comment ranger 53 entrées ? (C-72, P-22) | Page 29, table | Huit groupes, sept rubriques au plus, libellés distinctifs en tête ; 38 rubriques | Cinq groupes d'aujourd'hui, coupés en sous-groupes |
| G3 | Les jumelles qui règlent la même chose (C-71) | Page 29, « Les rubriques jumelles » | Fondues : lignes et répartition du budget ; types et termes ; étapes et formulaire de contact ; régimes et repas | Gardées à part, chacune avec un renvoi |
| G4 | Les jumelles qui diffèrent (C-71) | Page 29, table des jumelles | Renommées, la différence en tête ; « métier » pour « type » ; « assurances et pièces » ; un renvoi en tête | Garder les noms et ajouter une phrase sous chacun dans le menu |
| G5 | Ce qui n'est pas un réglage (C-73) | Page 29, « Vos données » | Une page « Vos données », ouverte par l'accueil des Paramètres et le menu du compte ; « Fermer l'espace » seul, en bas, en danger | Un dernier groupe « Vos données » dans les Paramètres, la fermeture à part |
| G6 | « Importer » (C-73, C-59) | Page 29, « Vos données » | Quitte les Paramètres pour « Reprendre et importer » (volet 2), ouvert par « Vos données », les menus « ⋯ » des listes et la recherche | Le garder dans les Paramètres, renommé « Reprendre et importer » |
| G7 | Le menu dans une rubrique (C-72, C-79) | Pages 29 et 30 | À 1 100 px et plus : le groupe ouvert, les autres groupes en une ligne ; en dessous et sur téléphone : la rubrique seule, « ‹ Paramètres » | Le menu entier, groupes repliés, comme aujourd'hui |
| G8 | Le patron et l'enregistrement (C-75, D7) | Page 30 | Quatre formes ; « ✓ Enregistré » à côté d'un réglage isolé ; une barre collée en bas pour un formulaire lié, l'état en mots, jamais grisée | Un message de retour (bandeau sombre) à chaque réglage enregistré |
| G9 | La rubrique du seuil de « Bientôt » (M10) | Page 30, « Un réglage isolé » | « Tâches : catégories et échéances », première ligne | « Radar des risques », à côté des seuils de la santé du planning |
| G10 | L'état du radar coupé (A6) | Page 30, « Automatismes » | Dans « Automatismes » (date, personne, conséquence) et en tête de ses règles | Une ligne discrète sur l'accueil, « Le radar est coupé » |
| G11 | Le menu latéral à 911 × 512 (C-82) | Page 31, « 911 × 512 : le menu » | « Paramètres » et « Aide » tenus en bas ; « Tous les modules » et « Tutoriels » sortent ; lignes resserrées sous 640 px | Garder les quatre entrées, tenues en bas, et faire défiler la liste des modules |
| G12 | Une rubrique sur téléphone et à 150 % (C-79) | Page 31 | Seule, en page entière, son premier réglage dans le premier écran | Le menu en liste déroulante au-dessus de la rubrique |
| G13 | La recherche des réglages (C-74, M9) | Page 32 | Un seul champ, celui du haut, qui lit le contenu des rubriques et des synonymes | Garder « Chercher un réglage » dans les Paramètres, mais lui faire lire le contenu |
| G14 | Le bouton « Réglages » (C-11) | Page 33 | Une section « Réglages » du menu « ⋯ », lignes nommées avec leur portée ; panneau « Pour cet écran » ; retour gardé | Garder la roue, corriger sa destination, et nommer le panneau |
| G15 | « Mariages par an » (volet 5, B2) | Page 30, « Des champs liés » | Dans la fiche de l'entreprise, bloc « Activité », avec le métier | Dans « Abonnement et modules » |
| G16 | « Mon compte » et « Notifications » | Pages 29 et 31 | Un groupe « Vous » ; « Ce téléphone » pour « PUSH » | Les laisser dans le groupe de l'entreprise |

## 3 bis. Aucune fonction majeure ne disparaît

Inventaire lu dans le code (`apps/symbola/app/settings-menu.ts`, `settings-nav.tsx`, `settings-search.ts`,
`app-shell.tsx`, `reglages/panels.ts`, `@panel/(.)reglages/[key]/page.tsx`, `settings-link.tsx`, les pages de
`app/parametres/`), toutes options ouvertes (tous modules, titulaire, libre-service). Les 53 entrées du
menu d'aujourd'hui, groupe par groupe, et leur place (« Entreprise et TVA » sur deux lignes, une par onglet).

| Aujourd'hui (groupe › entrée, adresse) | Dans les maquettes |
| --- | --- |
| Mon entreprise › Entreprise et TVA (`/parametres`, onglet « Fiche et TVA » : identité, adresse, coordonnées imprimées, TVA, TVA sur les débits) | Votre entreprise › **Fiche de l'entreprise** ; TVA et TVA sur les débits dans la ligne « TVA » et sa fenêtre (page 30) |
| Mon entreprise › Entreprise et TVA (onglet « Mentions et logo » : assurance, médiateur, conditions générales, logo) | Votre entreprise › **Mentions et logo des documents** |
| Mon entreprise › Mon compte (`/profil`) | Vous › **Votre profil et votre connexion** ; aussi au menu du compte (M7) |
| Mon entreprise › Notifications | Vous › **Vos notifications** (page 31) |
| Mon entreprise › Mon abonnement (titulaire, libre-service) | Votre entreprise › **Abonnement et modules** |
| Mon entreprise › Automatisations (et `automatisations/rappel-jour-j`) | Messages et automatismes › **Automatismes : en marche ou coupés** ; « Régler le rappel du jour J » gardé (page 30) |
| Mon entreprise › Radar des risques (règles, seuils, santé du planning) | Messages et automatismes › **Radar des risques : règles et seuils**, santé du planning comprise |
| Mon entreprise › Équipe (titulaire) | Votre entreprise › **Équipe et accès** |
| Mon entreprise › Modèles d'e-mails (et `emails/[kind]`, `emails/marque`) | Messages et automatismes › **E-mails automatiques : ce que Symbola envoie**, sous-pages gardées |
| Mon entreprise › Adresse d'envoi | Messages et automatismes › **Adresse d'envoi et réponses** |
| Mon entreprise › Journal des envois | Vos données › **Historique des e-mails envoyés** (filtres par évènement et contact gardés) |
| Mon entreprise › Modèles de messages (et `messages/[id]`) | Messages et automatismes › **Messages types : ce que vous envoyez** |
| Mon entreprise › Corbeille | Vos données › **Corbeille** ; aussi par la recherche et la palette (comme aujourd'hui) |
| Événements › Lignes du budget (`/events/parametres`) | Budget et prestataires › **Budget : postes de départ et répartition**, bloc 1 |
| Événements › Sources et motifs | Évènements › **Sources et motifs** |
| Événements › Types d'évènements | Évènements › **Types d'évènements et termes des clients** |
| Événements › Plages occupées | Évènements › **Plages occupées dans l'agenda** |
| Événements › Termes des clients | Fondu dans **Types d'évènements et termes des clients** (le terme sur la ligne de son type) |
| Événements › Étapes du pipeline (titulaire) | Évènements › **Demandes : étapes et formulaire de contact**, bloc 1 |
| Événements › Formulaire de contact (titulaire) | Même rubrique, bloc 2 |
| Événements › Questionnaires | Évènements › **Questionnaires des clients** |
| Événements › Rétroplanning (`/events/modeles`) | Tâches, programme et jour J › **Rétroplanning : modèles** |
| Événements › Catégories des tâches | Tâches, programme et jour J › **Tâches : catégories et échéances** (et le seuil de « Bientôt ») |
| Événements › Programme du jour J (`/events/modeles-programme`) | Tâches, programme et jour J › **Programme du jour J : modèles** |
| Événements › Modèles d'évènement | Évènements › **Modèles d'évènement** |
| Événements › Listes du jour J | Tâches, programme et jour J › **Jour J : listes de contrôle** |
| Événements › Régimes et allergies | Évènements › **Invités : régimes et repas**, bloc 1 |
| Événements › Types de repas | Même rubrique, bloc 2 |
| Événements › Prestataires par lien (titulaire) | Budget et prestataires › **Prestataires par lien** |
| Événements › Répartition du budget (`/budget/parametres`) | Fondu dans **Budget : postes de départ et répartition**, bloc 2 |
| Événements › Relances des prospects | Messages et automatismes › **Prospects : délai avant relance** |
| Rendez-vous › Types et page de réservation | Rendez-vous › **Rendez-vous : types et page de réservation** |
| Rendez-vous › Mes disponibilités et agendas | Rendez-vous › **Disponibilités et agendas** |
| Ventes › Catalogue | Devis et factures › **Catalogue des prestations** |
| Ventes › Modèles de devis | Devis et factures › **Modèles de devis** |
| Ventes › Modèles de contrat | Devis et factures › **Modèles de contrat** |
| Ventes › Modèles de proposition | Devis et factures › **Modèles de proposition** |
| Ventes › Relances de devis et de paiement | Messages et automatismes › **Paiements et propositions : relances** |
| Ventes › Devis et factures (`/devis/parametres`) | Devis et factures › **Numérotation, échéances et paiement** |
| Ventes › Documents (`/devis/parametres/documents`) | Devis et factures › **Apparence des devis et factures** (le logo y reste lié à « Mentions et logo ») |
| Ventes › E-reporting | Vos données › **Comptabilité** ; menu « ⋯ » de « Devis et factures » ; menu du rôle Comptable inchangé |
| Ventes › Exports comptables | Idem |
| Ventes › Archive comptable (titulaire) | Idem |
| Prestataires et données › Types de prestataires | Budget et prestataires › **Prestataires : métiers et familles** |
| Prestataires et données › Étiquettes | Budget et prestataires › **Prestataires : étiquettes** |
| Prestataires et données › Estimation des trajets | Budget et prestataires › **Prestataires : trajets** |
| Prestataires et données › Pièces des prestataires | Budget et prestataires › **Prestataires : assurances et pièces** |
| Prestataires et données › Importer (`/import`) | **Reprendre et importer** (volet 2), par « Vos données », les menus « ⋯ » des listes, la recherche et la palette |
| Prestataires et données › Données personnelles (`/rgpd`, titulaire) | Vos données › **Demandes sur les données personnelles** |
| Prestataires et données › Journal d'activité (titulaire) | Vos données › **Historique des actions** |
| Prestataires et données › Exporter mes données (titulaire) | Vos données › **Copie de toutes vos données** |
| Prestataires et données › Reprendre un export (titulaire) | Vos données › **Reprendre une copie Symbola** |
| Prestataires et données › Fermer l'espace (titulaire) | Vos données › zone de danger **Fermer l'espace** |
| Prestataires et données › Stockage (titulaire) | Vos données › **Stockage** |

Autour du menu :

| Fonction d'aujourd'hui | Dans les maquettes |
| --- | --- |
| Rubriques filtrées par modules souscrits et par rôle (`settingsMenu`) ; groupe vide masqué | Gardé (accueil, menu du groupe, « Vos données ») |
| « Chercher un réglage » (filtre des noms, sans accents) | Remplacé par la recherche du haut, qui cherche aussi le contenu (G13) |
| Groupes repliables, celui de la rubrique ouverte déplié ; rubrique ouverte gardée en vue | Remplacés par l'accueil et le menu du groupe, qui tient dans l'écran (G1, G7) |
| Repère « n demandes RGPD en alerte » sur « Paramètres », sur le groupe replié et sur « Données personnelles » | Gardé sur la ligne « Vos données » de l'accueil, sur « Demandes sur les données personnelles » et dans le menu du compte (non dessiné) |
| « Paramètres » au menu latéral, « Apps » (titulaire), « Tutoriels » et sa pastille, « Aide » | « Paramètres » et « Aide » tenus en bas ; « Tous les modules » dans « Abonnement et modules » et le menu du compte ; « Tutoriels » dans « Aide » (page 27) ; la pastille retirée au volet 5 (G11) |
| Panneau des réglages d'un écran (`/reglages/<clé>` : evenements, modeles, modeles-programme, devis, prestataires) ; « Retour à … » sur téléphone ; « Ouvrir tous les réglages » | Gardé, avec « Pour cet écran » (plusieurs rubriques par clé) et « Voir dans les Paramètres » qui garde le retour (G14) |
| Bouton `SettingsLink` (neuf usages : Devis, Encaissements, Tâches, Évènements, fiche ×5, carnet) | Section « Réglages » du menu « ⋯ » (page 33, table) |
| Liens de réglage dans une phrase (rendez-vous, plages occupées, rappel du jour J, RGPD) | Gardés |
| Palette (⌘K) : « Paramètres », « Corbeille », « Importer », « Aide » | Gardée ; « Corbeille » mène à « Vos données › Corbeille » |
| Aide de chaque écran de réglage (`ScreenHelp`) ; visite des paramètres du budget | Gardées (aide restructurée au volet 5 ; visite raccourcie) |
| Lecture seule pour l'équipe sur les rubriques de la titulaire (« Seule la Propriétaire modifie… ») | Gardée, dite dans la portée de l'en-tête (page 30) |
| Préférence des visites (cookie) | Gardée dans la page « Aide » (volet 5, page 27) |

## 4. Ce que les maquettes supposent du comportement de l'app

À spécifier au lot de réalisation, pas à décider ici. Entre parenthèses, l'état actuel lu dans le code.

- **Une page d'accueil des Paramètres** à `/parametres` (aujourd'hui « Entreprise et TVA ») ; la fiche
  passe à sa propre adresse, en gardant les ancres `#fiche`, `#documents`,
  `#informations-professionnel` citées par les devis.
- **Un nouveau `settingsMenu`** : huit groupes, phrases par rubrique dans les fichiers de traduction,
  drapeau « titulaire » ; `SETTINGS_MENU_HREFS` et `isSettingsPath` suivent (aujourd'hui cinq groupes).
- **Quatre fusions d'écrans** : lignes du budget et répartition ; types et termes ; étapes et
  formulaire de contact ; régimes et types de repas. Les adresses d'aujourd'hui redirigent vers la
  rubrique fusionnée, à son bloc.
- **Une page « Vos données »** (adresse à choisir) et une ligne « Vos données » au menu du compte ;
  la comptabilité y a une ligne, et une ligne dans le menu « ⋯ » de « Devis et factures ».
- **Un indicateur « ✓ Enregistré »** pour les formulaires qui s'enregistrent seuls (`autosave-form.tsx`,
  `autosave-list.tsx` existent) et **une barre d'enregistrement** pour les formulaires liés, avec la
  liste des champs modifiés et la question à la sortie (comme M1).
- **Un réglage par organisation pour « Bientôt »** (nouveau ; aucun seuil de « Bientôt » n'existe
  aujourd'hui dans le code des tâches : l'état vient du volet 1), lu par « Aujourd'hui », « Tâches » et le
  rétroplanning ; de 1 à 30 jours, 7 au départ.
- **L'état des automatismes** : date et auteur de la coupure (la table garde aujourd'hui `resumedAt`,
  pas l'auteur ni la date de coupure : à vérifier) ; un bandeau en tête des règles du radar.
- **`annualEventVolume`** affiché et modifiable dans la fiche (aujourd'hui enregistré par l'assistant,
  lu nulle part, note 11).
- **La recherche du haut** indexe les rubriques (nom, phrase, libellés des réglages qu'elles
  contiennent) et un fichier de synonymes traduisible ; une rubrique s'ouvre à la ligne trouvée,
  mise en évidence (aujourd'hui `filterSettingsGroups` ne compare que les noms).
- **Le menu latéral** : un pied tenu (Paramètres, Aide), la liste des modules qui défile seule si
  besoin, une règle de hauteur (`max-height: 640px`) qui resserre les lignes ; « Apps » et « Tutoriels »
  quittent le menu (aujourd'hui `app-nav-secondary`).
- **Sous 1 100 px de large** : les rubriques sans menu à gauche ; le panneau d'aide posé à droite (au
  lieu du bandeau du bas mesuré à 911 × 512) ; la hauteur maximale des fenêtres.
- **Le panneau des réglages d'un écran** : une clé ouvre plusieurs rubriques (« Pour cet écran ») ;
  « Voir dans les Paramètres » passe le retour (une clé d'écran, jamais un nom, comme `SETTINGS_BACK_KEYS`).
- **Le menu « ⋯ »** des écrans reçoit une section « Réglages » ; `SettingsLink` disparaît des en-têtes.

## 5. Ce qui a été vérifié dans le code, et ce qui ne l'a pas été

Lu dans la branche du volet 5 (`35371ca2`, au-dessus des volets 3 et 4).

| Affirmation des maquettes | Vérifié | Où |
| --- | --- | --- |
| 53 entrées en cinq groupes, toutes options ouvertes ; libellés français | Oui, relu | `app/settings-menu.ts`, `packages/i18n/src/messages/fr.json` (`SettingsMenu`) |
| Groupes repliables, « Chercher un réglage » ne compare que les noms | Oui, relu | `app/settings-nav.tsx`, `app/settings-search.ts` |
| Neuf usages du bouton « Réglages » et leurs destinations | Oui, relu | `app/settings-link.tsx`, `app/reglages/panels.ts`, `taches/page.tsx`, `events/events-header.tsx`, `events/[id]/page.tsx`, `prestataires/page.tsx`, `devis/page.tsx`, `devis/encaissements/page.tsx` |
| Panneau : « Ouvrir tous les réglages », « Fermer le panneau », « Retour à … » sur téléphone | Oui, relu | `app/ui/settings-panel.tsx`, `@panel/(.)reglages/[key]/page.tsx`, `fr.json` (`Common`) |
| « Entreprise et TVA » en deux onglets, TVA sur les débits, mentions, logo | Oui, relu | `app/parametres/page.tsx`, `company-tabs.tsx` |
| Automatismes : dix, état, interrupteur, heure, journal, radar compris ; rappel du jour J à part | Oui, relu | `app/parametres/automatisations/page.tsx`, `fr.json` (`Automations`) |
| Radar : règles, seuils et santé du planning dans une autre rubrique, sans l'état de marche | Oui, relu | `app/parametres/radar/page.tsx` |
| Catégories des tâches et priorité ; aucun seuil de « Bientôt » dans le code | Oui (recherche par mots, pas exhaustive) | `app/events/parametres/taches/page.tsx` |
| Menu latéral : « Apps » (titulaire), « Paramètres » et son repère RGPD, « Tutoriels » et sa pastille, « Aide » ; palette | Oui, relu | `app/app-shell.tsx` |
| Le rôle Comptable a son propre menu (exports, archive, e-reporting) | Oui | `app/app-shell.tsx` |

**Mesuré dans l'app** (lot 67, port 3068, jeu fictif, Chromium sans écran, facteur 1, 26/11/2026) : à
911 × 512 sur `/parametres`, « Apps » 513 → 557, « Paramètres » 561 → 605, « Tutoriels » 609 → 653, « Aide »
657 → 701, comme à la porte 2 ; le titre de « Notifications » à 1 118 px ; l'aide de « Tâches » en bandeau
de 343 à 512 px (169 px), son texte y tenant juste (168 px pour 168). Vu à cette occasion, hors mesure :
dans « Catégories des tâches » à 1 440 px, « aucune tâche », « Monter » et « Descendre » se chevauchent
dans la colonne « Tâches » (capture `parametres-categories-taches-1440.jpg`) ; non vérifié après le lot 69.
**Mesuré sur les maquettes** (même méthode) : à 911 × 512, « Encaissements » 362 → 406, « Paramètres »
418 → 462, « Aide » 462 → 506 ; le titre d'une rubrique à 114 px ; sa barre d'enregistrement de 446 à
512 px ; le panneau d'aide de 0 à 512 px, 400 px de large, 287 px de liste visibles à côté.

**Non vérifié** : les écrans des rubriques ouverts un à un (deux lus dans l'app, une dizaine dans le
code) ; le contenu des écrans à fusionner (lignes et répartition du budget, régimes et repas) au-delà de
leur titre ; si l'app garde la date et l'auteur d'une coupure d'automatisme ; le texte exact de
« E-reporting » et s'il porte un réglage ; le comportement de la palette (⌘K) sur les synonymes ; le
rendu du menu latéral avec plus de huit modules. Les phrases des rubriques et les synonymes sont des
exemples à écrire au lot de réalisation.

**Contrôlé dans le navigateur** (serveur local, Chromium du volet d'aperçu et Chromium sans écran à
1 600 × 1 000 en taille réelle) : chaque cadre « Proposé » regardé à 1 440, 911 × 512 et 375 px. Par
script, sur les cinq pages et le sommaire : toutes les captures chargées, aucun débordement de côté
dans les cadres de 375 px, aucune commande de moins de 44 px dans ces cadres, aucun libellé de bouton
coupé, aucune espace simple dans les guillemets ou devant « : ; ? ! ». La feuille de style et les icônes
de la page 28 sont reprises octet pour octet (contrôle par script), le bloc du volet 6 ajouté à la fin.
Corrigé après ces contrôles : la mention « titulaire » soulignée avec le lien, le menu latéral qui
s'allongeait avec la page, la barre de la page dans les captures, l'astérisque seul sur sa ligne
(« Nom commercial »), l'e-mail sur deux lignes dans la fiche, un menu « ⋯ » posé sur la mauvaise ligne,
les liens « Journal » et « Règles et seuils » de 16 px sur téléphone, « Voir dans les Paramètres » de
18 px, les titres de réglage en capitales dans le panneau.

## 6. Constats non traités, et pourquoi

| Constat | Pourquoi | Où il sera traité |
| --- | --- | --- |
| C-76 (« {{terme_clients}} », « Devis signéImmédiat », « PUSH », « ZIP », « JSON ») | « PUSH » traité (page 31) ; les autres sont des corrections de textes (lot 69 en partie) | Corrections simples |
| Chaque écran de réglage en détail (58 écrans) | Le patron est dessiné sur quatre rubriques ; les autres le suivent sans maquette | Lot de réalisation, rubrique par rubrique |
| « Glissez une ligne » dans « Lignes du budget » (Sophie) | Règle du glisser-déposer doublé d'un bouton (DESIGN.md) ; « Monter », « Descendre » au menu de la ligne (page 30) | Lot de réalisation |
| « Équipe » : action « inviter » sous le pli, liens coupés (C-75) | Le patron s'applique (« Inviter une personne » en bouton plein, liste éditable) ; écran non dessiné | Lot de réalisation |
| « Planner » pour une collègue (Sophie), « Propriétaire » et « titulaire » | Question de lexique des rôles | Lexique (P-15), Design System |
| Écran « Importer » vu depuis les Paramètres (C-59) | Traité au volet 2 (page 6) ; seule sa porte change ici | Volet 2 |
| Une visite qui surgit et masque le menu (PC-07/Valérie) | Traité au volet 5 (D2 : visites proposées) | Volet 5 |
| La page « Tous les modules » elle-même | Hors des Paramètres ; seule sa porte change | Module catalogue (lot 63g) |
| Le chevauchement vu dans « Catégories des tâches » à 1 440 px | Vu dans l'app du lot 67, pas revu après le lot 69 | À vérifier, puis correction simple |

## 7. Limites

- Maquettes statiques ; **aucun rejeu par le panel** (non demandé). Rien ne dit qu'une planner trouve
  plus vite par l'accueil en cartes que par le menu replié, ni qu'elle comprend « portée ».
- Les huit groupes et leurs 38 rubriques sont une proposition de rangement ; les phrases et les
  synonymes sont des exemples.
- Les cadres sont dessinés dans Chromium aux polices du système ; les hauteurs mesurées changent de
  quelques pixels avec d'autres polices.
- Les pages sont produites par un petit générateur hors du dépôt, qui reprend octet pour octet la
  feuille de style et les icônes de la page 28 et y ajoute les formes du volet 6 (bloc commenté en fin
  de feuille), toutes aux jetons de `DESIGN.md`. Les pages des volets 1 à 5 ne sont pas touchées ; seul
  le sommaire change.

## 8. La porte 3 de ce volet

Les seize choix G1 à G16 sont retenus par défaut selon la règle du 26/11/2026. Julien peut en
renverser un en citant son numéro ; les maquettes seront alors corrigées. Les formes de ce volet
rejoignent ensuite le Design System (phase 6) avec celles des volets 1 à 5.
