# Synthèse de l'audit UX des parcours (lot 68, phase 4)

Date : 25/11/2026, par Claude Code. Ce document confronte les 255 hypothèses des six spécialistes
([02-hypotheses/](02-hypotheses/)) aux 24 passages du panel ([03-panel/](03-panel/)) et aux mesures du
[relevé](01-releve.md), selon la règle du [cadrage](../../lots/lot-68-audit-ux-parcours.md). Il ne
propose aucune maquette : il dit ce qui est établi, ce qui ne l'est pas, et ce qui reste à trancher
à la porte 2. La matrice « repris ou créé » est dans [05-matrice-repris-cree.md](05-matrice-repris-cree.md).

## 1. L'essentiel

**90 constats** : 76 confirmés, 11 à trancher, 3 non testés ; 12 bloquent, 42 freinent, 34 gênent, 2 sont des détails. Les douze qui comptent le plus :

1. **La reprise d'un mariage en cours n'a pas de porte.** L'assistant demande ce que l'on remplace, puis ne propose que de créer ; l'import est au troisième niveau des Paramètres ; quatre fichiers, quatre endroits (C-51).
2. **Un import fabrique de fausses urgences.** Acomptes versés affichés « En retard », contrats déjà signés « à faire signer » : c'est la raison de l'abandon de Martine (C-53).
3. **Le budget d'un tableur est rejeté en entier** si le mariage n'existe pas, sans que l'écran demande lequel (C-52).
4. **Le premier mariage naît « en retard de 166 jours »**, sur la fiche, l'accueil, le menu et les tâches (C-67).
5. **Un mariage repris dit « Bon » et « tout est à jour » là où il n'y a rien**, et aucun écran ne liste ce qui reste à compléter (C-55, C-56).
6. **Dans « Tâches », créer une tâche sans évènement ne se trouve pas (le formulaire est tout en bas de la page), on ne filtre pas par évènement et on ne peut pas nommer un collègue** : trois abandons, et l'agence n'a aucune vue d'ensemble (C-31, C-33, C-32, C-14).
7. **Le carnet ne rattache pas un prestataire à un mariage et ne montre aucune pièce manquante** : six abandons sur trois passages (C-41, C-42) ; sa ligne ne dit ni métier ni ville (C-44) et son filtre « Où ? » est cassé (C-43).
8. **Sur téléphone, les tâches n'ont pas de date et le budget pas de montants** (C-77, C-78) ; chaque réglage s'ouvre sous le menu des Paramètres (C-79).
9. **La fiche d'un évènement fait attendre son contenu** : dix zones d'action, des onglets coupés, deux blocs « prochaine » qui se contredisent (C-22, C-23, C-24).
10. **Les aides s'imposent et ne répondent pas** : une visite par écran, relevée dans les 24 passages (C-01, C-02) ; une aide d'écran en pavé (C-05) ; « Revoir la visite » introuvable, deux abandons (C-06).
11. **Les mots ne tiennent pas** : trois verbes pour créer (C-03), « Reprendre » à cinq sens (C-88), « poste » ou « ligne » (C-86), deux orthographes d'« évènement » (C-89).
12. **Les Paramètres se trouvent** (13 ou 14 réglages sur 15 au premier essai chez les quatre profils), sauf quand deux rubriques se ressemblent (C-71).

Ce qui marche est au § 6 : « À traiter en premier », la création d'un mariage en trois saisies, la
reconnaissance des colonnes à l'import, « Abandonner cet import ? », les actions groupées.

## 2. Méthode et limites

### Ce qui a été fait

- **Relevé** (phase 1) : 294 relevés d'écran aux trois tailles, dans quatre espaces (rempli, vide, repris, agence).
- **Six spécialistes** (phase 2), sans se lire : navigation (44 hypothèses), interaction (45), hiérarchie visuelle (45), textes et aide (43), reprise (41), mobile et accessibilité (37). Soit **255 hypothèses** et 60 principes proposés.
- **Panel** (phase 3) : huit profils, neuf parcours, **24 passages**. Chaque agent ne recevait que la fiche du profil, le départ et un navigateur.
- **Tailles jouées** : 1 280 × 800 (Camille), 1 366 × 768 (Martine), 1 512 × 982 (Inès), 1 920 × 1 080 (Nadia, Valérie), 911 × 512 soit 150 % (Sophie), 375 × 812 et 390 × 844 (Camille, Clémence), 360 × 780 (Hugo).
- **Espaces** : comptes neufs passés par l'assistant (PC-01, PC-02, spécialistes TX et MI) ; copies de l'atelier de Camille (PC-03 à PC-08) ; agence de 65 évènements, complétée de trois mariages détaillés (Nadia, Hugo, Valérie) ; espace à deux mariages, « Léa & Maxime » créé et « Léa & Hugo » repris (PC-09).

### Comment un verdict est rendu

| Verdict | Règle appliquée |
| --- | --- |
| Confirmé | Vu chez deux profils au moins, ou cause d'un abandon (note 0), ou établi par une mesure du relevé |
| À trancher | Un seul profil, ou désaccord entre profils, ou entre panel et spécialistes |
| Non testé | Posé par un spécialiste, qu'aucun parcours n'a mis à l'épreuve et qu'aucune mesure ne couvre |
| Infirmé | Aucun profil ne bute, ou des profils réussissent là où un blocage était prévu |

Un constat regroupe plusieurs hypothèses. Quand il est « confirmé », c'est son cœur qui l'est : les
détails ajoutés par un seul spécialiste restent des détails de spécialiste. Les frictions que le
panel a rencontrées sans qu'aucun spécialiste les ait prévues sont des constats au même titre ;
la colonne « Sources » le dit.

### Limites

- **Des agents, pas des planners.** Spécialistes et utilisatrices sont des agents. Les spécialistes et la première vague du panel tournaient sur un modèle, les vagues 2 à 4 sur un autre. Leurs jugements ne valent pas ceux de vraies planners : la méthode repère bien les incohérences, les libellés obscurs, les chemins longs et les écarts mesurables ; elle ne dit pas ce qu'une planner préférera.
- **Interruptions.** Le navigateur a été coupé en cours de route chez cinq spécialistes sur six et dans neuf passages au moins ; les captures ont été renumérotées. Cinq passages ont atteint leur plafond de commandes : Inès n'a pas confirmé l'import du programme (PC-02), Martine n'a repris ni ses prestataires ni sa liste à faire (PC-02), Sophie n'a joué ni l'étape 5 ni l'étape 7 jusqu'au bout (PC-02), Inès et Camille n'ont pas vérifié la fin de PC-04.
- **Artefacts écartés** (ils ne comptent pas comme défauts de l'app) :
  1. dates « mm/dd/yyyy » et « 11/25/2026 », bulles « Please select an item in the list. », « Choose File » : navigateur d'essai (liste « à vérifier », § 9) ;
  2. le questionnaire de démarrage qui « ne s'ouvre pas seul » : l'outil ouvrait l'accueil directement (H-MI-39 écartée) ;
  3. « Aucun modèle de rétroplanning » et rétroplanning vide dans les espaces copiés et dans l'espace repris du relevé : ils n'ont pas les modèles qu'installe l'assistant ;
  4. le carnet sans métier (« À classer ») : les fiches du jeu fictif n'en ont pas ;
  5. saisies perdues à la fermeture du navigateur, captures renumérotées ;
  6. menus « ouverts vides » ou clics manqués vus une seule fois : rangés dans « à vérifier dans l'app » ;
  7. agence : ses trois mariages détaillés sont des copies du mariage de référence ; le fond de carte n'est pas installé dans l'environnement.
- **Non couvert.** Par le panel : l'annulation d'un import terminé, toute suppression, l'annulation d'un évènement, la reprise des tâches d'un tableur, la recherche du haut, les erreurs de formulaire sur téléphone, le suivi d'une fiche à J-90, J-30 et J-7 avec une horloge simulée (PC-04 a regardé deux autres mariages à la place). Par les spécialistes : le fichier de 600 contacts, un vrai lecteur d'écran, le survol, un vrai pouce, la taille 911 × 512 dans l'app, les Paramètres écran par écran (58 écrans mesurés, deux lus). Par tous : de vrais jumeaux pour PC-09 (le mariage repris n'est pas la copie du mariage créé), les vues Colonnes et Calendrier des évènements, la tablette de Nadia.

## 3. Notes du panel

Notes de 0 à 3 par étape, dans l'ordre des étapes du parcours. « Abandons » : étapes notées 0, ou
arrêt déclaré par le profil. « — » : étape non jouée.

| Parcours | Profil | Taille | Notes des étapes | Abandons | Mesures du parcours |
| --- | --- | --- | --- | --- | --- |
| PC-01 Premier quart d'heure | Camille (SU-01) | 1 280, puis 375 | 2 · 2 · 1 · 2 · 2 · 1 · 2 · 2 | Aucun (visites passées dès la deuxième) | Écran vide : non tenue pour l'accueil ; champs : tenue ; retour : tenue |
| PC-01 | Clémence (L68-SU-D) | 390 | 2 · 2 · 1 · 2 · 2, 1, 1 · 1 puis 2 · 2 · 3 | Aucun (limite dépassée deux fois pendant une visite) | Écran vide : non tenue ; champs : tenue ; retour : tenue |
| PC-02 Reprise | Inès (L68-SU-A) | 1 512 | 3 · 2 · 1 · 1 · 2 · 1 · 2 | Aucun ; arrêt au plafond (programme non confirmé) | Tout pris : presque ; chiffres : non tenue ; annuler : tenue ; trois choses : tenue, par sa lecture |
| PC-02 | Martine (L68-SU-B) | 1 366 | 2 · 1 · 1 · 2 · 1 · 1 · 1 | 1 (total « reste à payer » faux, étape 6) | Tout pris : non tenue ; chiffres : non tenue ; annuler : tenue avant confirmation ; trois choses : de mémoire |
| PC-02 | Sophie (SU-04) | 911 | 3 · 2 · 2 et 0 · 1 · 0 · 2 · 0 | 1 (budget rejeté) ; étapes 5 et 7 arrêtées au plafond | Tout pris : à moitié ; chiffres : non tenue ; annuler : tenue avant confirmation ; trois choses : non tenue |
| PC-03 Lundi matin | Camille (SU-01) | 375 | 2 · 3 · 1 · 1 · 2 · 2 | Aucun | Un écran : à moitié ; deux gestes : tenue pour cocher, non pour le reste ; annulation : tenue |
| PC-03 | Nadia (SU-02) | 1 920 | 2 · 1 · 2 · 2 · 3 · 0 | 1 (vue d'ensemble de l'agence) | Un écran : tenue ; deux gestes : non tenue ; annulation : non tenue de façon visible |
| PC-03 | Hugo (SU-03) | 360 | 2 · 1 · 1 · 1 · 2 · 2 | 1 (onglet du budget, défilement de côté) | Un écran : tenue ; deux gestes : non tenue ; annulation : en partie |
| PC-04 Un mariage de A à Z | Camille (SU-01) | 1 280 | 1 · 1 · 1 · 2 · 2 · 2 | 2 renoncements (déplacer une tâche, comparer) | Prochaine action : tenue sur deux fiches ; aucune ressaisie : non tenue |
| PC-04 | Inès (L68-SU-A) | 1 512 | 2 · 1 · 0 · 2 · 2 · 2 | 1 (comparer et retenir un photographe) | Prochaine action : tenue pour une fiche sur trois ; aucune ressaisie : non tenue |
| PC-05 Prestataires | Inès (L68-SU-A) | 1 512 | 1 · 2 · 0 · 2 · 0 · 2 · 1 | 2 (rattacher, pièces) | Trouvé et rattaché : non ; même geste des deux côtés : non |
| PC-05 | Martine (L68-SU-B) | 1 366 | 1 · 1 · 0 · 2 · 0 · 2 · — | 2 (rattacher, pièces) | Non tenue ; non tenue |
| PC-05 | Valérie (L68-SU-C) | 1 920 | 1 · 2 · 0 · 2 · 0 · 2 · 0 | 3 (rattacher, pièces, tri et lot) | Non tenue ; non tenue |
| PC-06 Tâches | Camille (SU-01) | 375, puis 1 280 | 1 · 1 · 2 · 2 · 3 · 0 · 2 | 1 (tâche sans évènement) | Liste d'une personne : tenue pour « Mariés » ; même forme : tenue |
| PC-06 | Hugo (SU-03) | 360 | 2 · 1 · 2 · 2 · 3 · 2 · 2 | Aucune note 0 ; renonce aux filtres et aux colonnes de droite | Liste d'une personne : tenue (pas « moi ») ; même forme : non |
| PC-06 | Valérie (L68-SU-C) | 1 920 | 1 · 0 · 2 · 3 · 3 · 0 · 2 | 2 (filtres, tâche sans évènement) | Non tenue ; non tenue |
| PC-07 Paramètres | Sophie (SU-04) | 911 | 3 · 3 · 3 · 2 · 3 · 3 · 3 · 3 · 3 · 2 · 3 · 1 · 3 · 2 · 1 | Aucun | 13 sur 15 au premier essai : tenue ; aucun introuvable : tenue (un par la recherche) |
| PC-07 | Nadia (SU-02) | 1 920 | 3 · 2 · 3 · 2 · 3 · 2 · 3 · 3 · 2 · 3 · 3 · 2 · 2 · 1 · 3 | Aucun | 14 sur 15 : tenue ; tenue |
| PC-07 | Clémence (L68-SU-D) | 390 | 3 · 3 · 2 · 2 · 3 · 2 · 3 · 3 · 2 · 2 · 3 · 2 · 3 · 2 · 3 | Aucun | 13 sur 15 : tenue ; tenue |
| PC-07 | Valérie (L68-SU-C) | 1 920 | 3 · 3 · 3 · 2 · 3 · 2 · 2 · 3 · 3 · 3 · 3 · 2 · 2 · 2 · 3 | Aucun | 13 sur 15 : tenue ; tenue |
| PC-08 Bloquée sur un écran | Sophie (SU-04) | 911 | 2 · 1 · 0 · 1 · 3 · 3 | 1 (« Revoir la visite ») | Un geste : tenue ; répond : non ; saisie intacte : tenue (brouillon) |
| PC-08 | Clémence (L68-SU-D) | 390 | 2 · 2 · 1 · 0 · 1 · 1 · 3 | 1 (« Revoir la visite ») | Un geste : tenue ; répond : non ; saisie intacte : non (coupure technique en partie) |
| PC-09 Parité | Inès (L68-SU-A) | 1 512 | 2 · 2 · 2 · 3 · 1 · 1 | Aucun ; deux motifs de départ touchés | Manques expliqués : non tenue ; quoi compléter : non tenue |
| PC-09 | Martine (L68-SU-B) | 1 366 | 2 · 1 · 1 · 2 · 2 · 1 | Aucun ; cesse de chercher à l'étape 3 | Non tenue ; non tenue |

Lecture :

- **Dix-sept étapes notées 0** : sept dans « Prestataires » (rattacher depuis le carnet, repérer une pièce), trois dans « Tâches », trois chez Sophie pendant la reprise (dont deux dues au plafond du test), deux sur « Revoir la visite », une pour la vue d'ensemble de l'agence, une pour comparer des photographes. S'y ajoutent l'abandon de Martine sur son total et celui de Hugo dans le budget du téléphone.
- **Un seul parcours tient ses mesures : les Paramètres** (PC-07, quatre profils sur quatre). Les parcours de reprise (PC-02, PC-09) et de prestataires (PC-05) n'en tiennent aucune en entier.
- **Les notes 3 vont aux gestes courts** : cocher et annuler, décaler en lot, passer au calendrier, retrouver un brouillon, ouvrir un tutoriel, retrouver son travail au retour.

## 4. Constats

90 constats, classés par zone, puis par gravité et par verdict. « L1 » à « L10 » renvoient aux
premières lectures du relevé (§ 3). « PC-03/Camille (1) » : passage et note de l'étape concernée.
« P-nn » renvoie aux principes candidats du § 7.

### Transverse (menu, barre du haut, visites guidées, aide)

| # | Constat | Gravité | Verdict | Sources | Principe candidat |
| --- | --- | --- | --- | --- | --- |
| C-01 | Une visite guidée s'ouvre seule à la première venue sur chaque écran (accueil, liste, fiche, carnet : 18 bulles), par-dessus le contenu, parfois sur le résultat d'une action ; la page arrive alors défilée au milieu. La visite passée, une carte « Découvrir en N minutes » s'insère au-dessus du titre avec un second bouton plein, « Commencer le tutoriel », souvent hors sujet (« Comparer plusieurs devis pour une ligne du budget » sur un carnet vide). Des clics tombent à côté. | freine | confirmé | H-TX-10, H-TX-34, H-IA-34, H-IA-44, H-VI-24, H-MI-26 ; relevée dans les 24 passages ; PC-01/Camille (1 à l'étape des visites), PC-01/Clémence (1), PC-02/Martine, PC-02/Sophie, PC-03/Nadia, PC-05/Valérie, PC-07/Nadia (clics manqués). [preuve](preuves/premier-mariage-visite-1280.jpg) | P-19, P-08 |
| C-02 | Les visites décrivent ce que l'écran ne montre pas : espace vide (« Une pastille par famille » devant « Tous · 0 »), étape « 2 sur 4 — Le reste, par urgence » sans rien d'encadré, cadre caché sous la bulle, « Les trois points les plus urgents » devant sept lignes, « Survolez une fiche » et « cliquez une ligne » sur un téléphone. À la dernière bulle, « Passer la visite » reste à côté de « Terminer ». | freine | confirmé | H-TX-09, H-TX-35, H-TX-41, H-MA-16, H-MA-26, H-MA-36 ; PC-01/Clémence (1), PC-01/Camille (1), PC-02/Sophie. [preuve](preuves/visite-etape-sans-cadre-375.jpg) | P-19 |
| C-03 | « + Créer », seul bouton de création présent partout, propose « Prospect », « Tâche », « Dépense », « Devis » : ni évènement, ni prestataire, ni contact. Les écrans disent « Nouveau », « Nouveau prestataire », les états vides « Créer un évènement », « Ajouter un prestataire ». Le relevé compte « Ajouter » sur 36 écrans, « Créer » sur 17, « Nouveau » sur 10. | freine | confirmé | H-IA-12, H-IX-20, H-TX-21, H-TX-22 ; mesure du relevé (verbes) ; PC-02/Sophie (0 : mariage créé comme « Prospect », un seul prénom), PC-08/Clémence (2), PC-01/Camille, PC-02/Martine. [preuve](preuves/menu-creer-1440.jpg) | P-15, P-08 |
| C-04 | Un formulaire envoyé avec un champ vide ne reçoit aucun message de Symbola : seule la bulle du navigateur parle. Des champs obligatoires ne le disent pas avant l'envoi (« Source pour les événements sans source », « Source du contact », « Évènement » d'une nouvelle tâche) ; ailleurs « * », « (facultatif) » ou rien. Dans la fenêtre d'une tâche, l'erreur « Le libellé est obligatoire. » est à 280 px du champ « Tâche ». La langue de la bulle, elle, tient au navigateur d'essai. | freine | confirmé | H-IX-05, H-IX-22, H-IX-28, H-TX-26, H-MI-20, H-VI-25 ; PC-02/Inès, PC-02/Sophie, PC-03/Camille, PC-03/Hugo (bouton grisé sans raison), PC-06/Valérie (0), PC-06/Camille (0) | P-18 |
| C-05 | Le « ? » ouvre bien l'aide de l'écran en un geste, mais c'est un seul paragraphe gris (95 à 484 mots) qui énumère les commandes. Il ne répond pas à la question posée (« N° SIRET », « comment faire entrer mon tableur », « pourquoi huit retards »), parle de ce que l'écran ne montre pas (carnet vide, téléphone), n'a ni lien ni suite, et rogne ou cache l'écran qu'il explique. Son titre n'est pas celui de l'écran (« Les tâches de tous vos mariages »). | freine | confirmé | H-TX-12, H-TX-36, H-TX-37, H-MA-25, H-MA-33 ; PC-08/Clémence (1), PC-08/Sophie (1), PC-01/Camille (2), PC-01/Clémence (2). [preuve](preuves/aide-ecran-taches-1440.jpg), [téléphone](preuves/aide-ecran-taches-375.jpg) | P-19 |
| C-06 | « Revoir la visite » est promis par la visite d'accueil et par la page Aide (« ? › Revoir la visite »), mais le panneau d'aide de « Nouveau prestataire » ne le porte pas. « Tâches » n'a pas de visite du tout. | freine | confirmé | H-TX-33 ; PC-08/Clémence (0, abandon), PC-08/Sophie (0, abandon) | P-19 |
| C-07 | La recherche du centre d'aide ne comprend pas une phrase : « importer mes contacts », « importer contacts », « reprendre mon tableau excel » rendent « Aucun article ne correspond à votre recherche. » ; « import » rend onze fiches où la bonne est noyée. La page fait plus de 12 000 px, chaque carte coupe son texte (115 libellés coupés au relevé), et nomme son objet « fiche », « écran » ou « article ». | freine | confirmé | H-TX-17 ; mesure du relevé (`/aide`) ; PC-08/Clémence (1), PC-08/Sophie (1) | P-19 |
| C-08 | Le danger et la confirmation n'ont pas de forme stable. Une tâche hors évènement se supprime sans question, sans « Annuler », sans corbeille. « Annuler l'évènement » s'exécute par un bouton vert plein, sans bouton de renoncement. Quatre façons de demander confirmation, trois façons de fermer un panneau, « Supprimer la tâche » à 14 px d'« Enregistrer ». | freine | non testé | H-IX-01 (présumée « bloque »), H-IX-11, H-IX-17, H-IX-27, H-IX-35, H-IA-39, H-MA-24 ; aucun profil n'a supprimé ni annulé d'évènement ; PC-03/Hugo relève seulement « Supprimer la tâche » près d'« Enregistrer » | P-17, P-16 |
| C-09 | Le retour après une action n'a ni place ni forme stables. Rien après « Créer l'évènement », après la création d'un prestataire, après « Comparer », après « Copier le message », après « Oui, abandonner ». Le message noir d'annulation se pose sur la liste ou sur le calendrier ; « Annuler » y est un petit mot souligné. La pastille « Tâche ajoutée. » reste après l'action suivante. « 2 tâches décalées de 7 jours. » n'offre pas d'annulation. | gêne | confirmé | H-IX-25, H-IX-31, H-IX-41, H-TX-27 ; PC-03/Camille, PC-03/Nadia, PC-03/Hugo, PC-05/Martine, PC-02/Martine, PC-02/Sophie, PC-06/Valérie | P-16 |
| C-10 | Six dispositifs d'aide aux noms voisins : visite, tutoriel, essai guidé, exemple, aide de l'écran, « Aide ». Le menu ajoute « Apps » (mot anglais, plan du site de fait) et « Tutoriels 0/11 », pastille permanente. | gêne | confirmé | H-TX-11, H-TX-40, H-IA-38 ; PC-08/Sophie (« Aide » ou « Tutoriels » ?, « Apps »), PC-01/Clémence (onze tutoriels en plus de quatre visites), PC-02/Sophie | P-19, P-15 |
| C-11 | Le bouton « Réglages » d'un écran n'ouvre pas les réglages de cet écran. Sur « Tâches » et le Rétroplanning, il ouvre « Modèles de rétroplanning » ; sur le budget d'un mariage, « Lignes du budget par défaut » (tous les futurs évènements) ; sur le carnet, les seuls types. « Ouvrir tous les réglages » fait perdre le mariage. | gêne | à trancher | H-IA-07, H-IA-18, H-IA-19, H-TX-25 ; un seul profil : PC-06/Valérie (« un mot trompeur ») | P-22, P-12 |
| C-12 | La barre du haut (recherche, « Créer », cloche, « ? ») part avec la page : au milieu d'une fiche, il faut tout remonter pour créer une tâche. La recherche ne trouve aucun réglage (« relance », « reprendre »), ne dit pas le type de ses résultats et en répète ; la touche Entrée ouvre la page de résultats, pas l'action proposée. | gêne | à trancher | H-IA-29, H-IA-08, H-IA-30, H-MI-40, H-MA-31 ; un seul profil pour le défilement : PC-03/Camille ; la recherche du haut n'a été essayée par aucun profil | P-12, P-11 |
| C-13 | Dans le menu latéral, la pastille « 2 en retard » de « Tâches » passe sur deux lignes (94 écrans au relevé) ; « Créer une autre organisation » aussi ; l'adresse du compte est coupée sans moyen de la lire. | détail | confirmé | H-IA-40, H-VI-21, L6 ; mesure du relevé ; PC-01/Camille, PC-03/Nadia, PC-06/Valérie | P-21 |

### Aujourd'hui

| # | Constat | Gravité | Verdict | Sources | Principe candidat |
| --- | --- | --- | --- | --- | --- |
| C-14 | Pour une agence, aucun écran ne dit où en est chaque évènement ni qui est en retard sans ouvrir chaque dossier : la liste des évènements ne montre que date, statut et lieu ; « 32 tâches faites sur 42 · 4 en retard » ne se lit que dans la fiche. Avec 65 évènements, « Aujourd'hui » fait 5,7 hauteurs d'écran. | bloque | confirmé | PC-03/Nadia (0, abandon), PC-06/Valérie (1) ; mesure du relevé (longueur) ; non prévu par les spécialistes | P-13 |
| C-15 | Un espace neuf lit « aucun évènement en cours · rien ne presse » puis « Rien ne presse : tout est à jour. », au-dessus d'un calendrier vide. Aucune invitation à créer ni à reprendre. « Pour bien démarrer » est sous le calendrier et « Risques », et ne cite ni l'évènement ni la reprise. | freine | confirmé | H-IA-04, H-TX-05, H-TX-14, H-VI-17, L9 ; mesure du relevé (pas d'état vide) ; PC-01/Camille (1), PC-01/Clémence (1). [preuve](preuves/aujourdhui-vide-1440.jpg) | P-05, P-04 |
| C-16 | Dans « À traiter en premier », toucher le titre d'une tâche n'ouvre pas le mariage mais la fenêtre « Modifier la tâche », posée sur le Rétroplanning de la fiche ; le nom du mariage, sous le titre, n'est pas un lien. « Fermer » laisse dans la fiche, sans retour vers « Aujourd'hui ». | freine | confirmé | H-IA-09, H-IA-10 ; PC-03/Camille (1), PC-03/Hugo (1), PC-03/Nadia (2) | P-12, P-11 |
| C-17 | Annuler un « Fait » donné par erreur : la tâche revient chez Camille ; dans l'agence, elle ne revient pas à sa place (Nadia ne la retrouve ni sur l'accueil ni dans « Tâches », Hugo la retrouve sous un autre mariage) et un message technique passe : « Une partie des urgences ne répond pas pour le moment (Today.source.vendors) ». | freine | à trancher | PC-03/Camille (3) contre PC-03/Nadia (1) et PC-03/Hugo (1) ; l'agence est faite de copies du mariage de référence : à vérifier dans l'app | P-16 |
| C-18 | Ce qui n'est pas le travail du jour passe avant ou autour de lui : le bandeau « Votre fiche entreprise n'est pas encore complète. La compléter » au-dessus des urgences, « Risques — Aucun risque détecté ce matin. » sous des retards (« le radar » n'est pas expliqué), « Pour bien démarrer » après des mois d'usage, trois jours « Rien de prévu. ». L'écran n'a aucun bouton principal. | gêne | confirmé | H-VI-07, H-TX-29, H-TX-31 ; mesure du relevé (0 bouton principal) ; PC-03/Camille, PC-03/Nadia, PC-03/Hugo, PC-01/Camille, PC-01/Clémence. [preuve](preuves/aujourdhui-1440.jpg) | P-08, P-19 |
| C-19 | La carte « À traiter en premier » porte, pour sept lignes, sept titres en lien, sept boutons de trois libellés et de trois tailles (« Fait », « Ouvrir », « Noter une relance ») et trois liens « Voir… » : six zones d'action au relevé. Deux tâches qui « attendent le client » passent avant des urgences de la planner ; l'ordre n'est pas celui des dates. | gêne | confirmé | H-VI-08, H-VI-43, H-IX-26, L5 ; mesure du relevé (6 zones) ; PC-01/Clémence, PC-03/Camille, PC-03/Nadia | P-10 |
| C-20 | Les compteurs ne comptent pas ce que l'écran montre : « 6 points demandent votre attention » pour sept lignes, « Tâches (8) » pour sept lignes, puis « 18 tâches à faire · 8 en retard » dans « Tâches ». | gêne | confirmé | H-IX-45, H-IA-17 ; PC-03/Camille, PC-01/Camille, PC-01/Clémence | P-07 |
| C-21 | « Aujourd'hui » dit quoi faire, pas qui appeler : « Attend Maison Haddad », sans nom de contact ni téléphone. | gêne | confirmé | PC-03/Hugo (2), PC-03/Camille ; non prévu par les spécialistes (voir H-IA-13) | P-11 |

### Évènements (liste et fiche)

| # | Constat | Gravité | Verdict | Sources | Principe candidat |
| --- | --- | --- | --- | --- | --- |
| C-22 | La fiche d'un évènement empile avant son contenu : lien de retour, titre, faits, « Type d'événement » et « Changer le type », quatre boutons égaux (« Messages », « Écrire au client », « Voir comme… », « Jour J »), frise, « Reporter l'évènement… », « Annuler l'évènement… », onglets. Dix zones d'action, aucun bouton principal, première ligne utile à 552 px sur 900. « Jour J » y nomme un bouton, une étape et un onglet. | freine | confirmé | H-IA-14, H-IA-31, H-IX-03, H-VI-04, H-VI-26, H-VI-27, L3 ; mesure du relevé (10 zones) ; PC-03/Camille, PC-03/Hugo, PC-01/Camille, PC-04/Inès, PC-02/Inès. [preuve](preuves/fiche-evenement-1440.jpg) | P-09, P-08 |
| C-23 | La barre d'onglets ne tient pas en 1 440 px : le septième se lit « Documen », « Invités » est hors de vue, sans flèche ni fondu. Sur l'onglet Documents, aucun onglet n'est marqué ouvert. | freine | confirmé | H-IA-01 (présumée « bloque »), H-IX-34, H-VI-13 ; PC-02/Inès, PC-02/Martine, PC-09/Inès, PC-09/Martine. [preuve](preuves/fiche-reprise-synthese-1440.jpg) | P-09 |
| C-24 | Deux blocs répondent à « que faire maintenant ? » : « Prochaine action » (une liste, ou « Rien à faire pour le moment : tout est à jour. ») et, dessous, le bandeau « Prochaine étape : … » avec un bouton plein de 909 px. Ils se contredisent. Dans la liste, « Reporter » est posé seul à gauche, sans dire quelle tâche il reporte. | freine | confirmé | H-IX-32, H-IX-07, H-TX-30, H-VI-06, H-VI-41, H-MI-23, L4 ; PC-04/Inès, PC-04/Camille, PC-09/Inès, PC-09/Martine (1), PC-02/Inès, PC-02/Martine, PC-01/Camille (« Reporter ») | P-08, P-10 |
| C-25 | Créer un mariage déjà signé n'a pas de chemin clair : « Nouveau » propose « Prospect », « Évènement confirmé — Directement en préparation » (alors que la frise distingue « Confirmé » et « En préparation ») et « Pour un client existant ». Le formulaire n'a pas de champ pour le nombre d'invités ni le budget de la demande ; l'astérisque de « Type d'événement » tombe seul sur une ligne ; « Créer le prospect » est à 1 610 px, sans « Annuler ». | freine | confirmé | H-IX-15, H-IX-29, H-TX-32, H-VI-25 ; PC-04/Camille (1), PC-04/Inès (2), PC-02/Martine, PC-02/Sophie (0) | P-15, P-18 |
| C-26 | « Modifier les informations » est à 2 160 px de défilement et ouvre un panneau où chaque champ a son bouton plein : « Changer la date », « Enregistrer le fuseau », « Enregistrer le budget souhaité », « Enregistrer le lieu », « Enregistrer la fiche », « Enregistrer les notes ». Douze boutons principaux au relevé. « Changer la date » double « Reporter l'évènement… ». | freine | confirmé | H-IX-04, H-VI-14, H-TX-23 ; mesure du relevé (12 boutons principaux) ; aucun profil n'a ouvert ce panneau. [preuve](preuves/fiche-modifier-informations-1440.jpg) | P-08, P-09 |
| C-27 | Les ronds de la frise changent le statut sans en avoir l'air ; la question s'ouvre loin du clic. Deux profils se demandent si « Clôturé » se clique. Le statut est dit deux fois (pastille et frise). | gêne | confirmé | H-IX-33, H-VI-27 ; PC-04/Inès, PC-04/Camille (question 9) | P-09, P-17 |
| C-28 | La Synthèse empile onze blocs sur 3 700 px et parle la langue de l'outil : « Santé de l'évènement », « Plage occupée — Bloque l'agenda de toute l'équipe », « Planner principal : Aucun » pour une planner seule, « Aucune ligne pourvue sur 12 », trois cartes dans une carte. | gêne | confirmé | H-IA-32, H-TX-15, H-VI-32 ; PC-02/Martine, PC-02/Inès, PC-09/Martine | P-09, P-15 |
| C-29 | La liste des évènements montre quatre aplats verts (« Nouveau », « Liste », « À venir · 4 » comptés boutons principaux), filtres, bascule et tableau collés, une ligne qui ouvre la fiche sans le montrer, une colonne « Mariés » pour un baptême, « Charge des douze prochains mois » pleine de zéros, et, pour l'agence, une pastille « Même jour : … » sur chaque ligne. | gêne | confirmé | H-VI-19, H-VI-36, H-VI-37, H-IX-24, H-TX-42 ; mesure du relevé (4 boutons principaux, liens sans signe) ; PC-01/Clémence, PC-03/Nadia | P-08, P-10, P-21 |
| C-30 | Le Programme du jour J porte sept commandes avant la première séquence et, par ligne, « Modifier » et « Retirer » (28 liens rouges). « Ajouter une séquence » est tout en bas ; la ligne s'ouvre hors de l'écran. | gêne | confirmé | H-VI-34 ; PC-04/Inès (2), PC-04/Camille (2) | P-10, P-08 |

### Tâches

| # | Constat | Gravité | Verdict | Sources | Principe candidat |
| --- | --- | --- | --- | --- | --- |
| C-31 | L'écran « Tâches » n'a pas de bouton de création en haut. « Créer › Tâche » exige un évènement (« Choisir un évènement »), sans le dire ; le formulaire « Tâches hors évènement » est tout en bas de la page ; un troisième vit dans le Rétroplanning. Deux profils sur trois n'ont pas pu créer « Déclaration de TVA ». | bloque | confirmé | H-IX-06 ; PC-06/Valérie (0, abandon), PC-06/Camille (0, abandon), PC-06/Hugo (2 : trouvé en bas de page) | P-08, P-11 |
| C-32 | Une tâche n'a pour responsable que « Planner », « Mariés » ou un prestataire : aucun collègue. Le filtre « Tout le monde / Planner / Mariés » ne donne donc ni « mes tâches » ni la charge de chacun. « Planner » : un rôle ou une personne ? | bloque | confirmé | PC-06/Valérie (critère d'abandon atteint), PC-06/Hugo, PC-03/Nadia (0) ; non prévu par les spécialistes (voir H-IX-43). [preuve](preuves/taches-agence-1920.jpg) | P-13 |
| C-33 | « Tâches » ne se filtre ni par évènement, ni par catégorie, ni par semaine, ne se trie pas et ne se groupe que par mois ; le nom du mariage, répété en gris sous chaque titre, n'est ni lien ni filtre. Les deux rangées de pastilles (« À faire / En retard / Toutes », « Tout le monde / Planner / Mariés ») n'ont pas de nom et se confondent. | freine | confirmé | H-IA-10, H-IX-23, H-VI-30, H-MA-19 ; PC-06/Valérie (0 à l'étape des filtres), PC-06/Camille (1), PC-06/Hugo (1), PC-01/Clémence | P-13 |
| C-34 | La ligne d'une tâche donne 17 % de sa largeur au titre (9 titres sur 11 sur deux lignes, 32 sur 42 dans « Toutes ») et 27 % à trois boutons (« Modifier », « Reporter », « Supprimer » cerclé de rouge). La colonne « Catégorie » n'affiche que « — » ; l'en-tête « Qui la réalise » tient sur deux lignes ; le rouge, onze fois, ne distingue plus les deux vrais retards. | freine | confirmé | H-VI-05, H-VI-10, H-VI-29, H-VI-44, H-IX-08, L1 ; mesure du relevé ; PC-01/Camille, PC-06/Valérie. [preuve](preuves/taches-1440.jpg) | P-10, P-21 |
| C-35 | Chaque ligne commence par deux cases voisines : un carré sans libellé (sélection) et un rond sous « Fait ». Laquelle veut dire « c'est fait » ? Dans le Rétroplanning, la case « Fait » d'une tâche faite devient un carré. | freine | confirmé | H-VI-11, H-MA-15, H-IX-42 ; PC-01/Clémence (1), PC-01/Camille, PC-04/Inès, PC-06/Camille | P-10 |
| C-36 | Changer une échéance a trois chemins (« Reporter ▾ », « Modifier », un clic sur la date) et, en lot, un quatrième nom : « Décaler de… ». Le menu « Reporter » s'ouvre coupé ou vide dans le Rétroplanning et ne se referme ni par Échap ni par un clic dehors. | freine | confirmé | H-IX-10, H-IX-19, H-IX-21 ; PC-04/Inès (1), PC-04/Camille (1, renonce à déplacer la tâche), PC-06/Valérie, PC-06/Camille, PC-06/Hugo ; le menu coupé est à revérifier dans l'app | P-15, P-16 |
| C-37 | « Aucune tâche à faire : tout est à jour. » s'affiche pour un espace sans rien, et pour un mariage repris dont les tâches sont restées dans l'ancien outil. L'action proposée, « Voir les évènements », est un bouton secondaire ; le seul bouton plein est « Ajouter la tâche » des tâches hors évènement. | freine | non testé | H-TX-05, H-MI-21, H-VI-17, L10 ; capture du relevé ; aucun profil n'a vu « Tâches » vide (PC-01 : l'écran n'était plus vide) ; PC-09/Inès et PC-09/Martine notent seulement que le mariage repris n'y figure pas. [preuve](preuves/taches-vide-1440.jpg) | P-05 |
| C-38 | La même tâche a cinq formes et deux panneaux : lien vert souligné sur « Aujourd'hui », texte noir dans « Tâches » ; fenêtre de 576 px à quatre champs depuis « Tâches », fenêtre de 860 px à quatre sections (« Rang et jalon », pièces jointes, commentaires) depuis la fiche. Les mots changent : « Qui la réalise », « Responsable », « Qui s'en charge » ; « Mariés », « Le client », « Tâche confiée au client ». | gêne | confirmé | H-IA-16, H-VI-20, H-IX-43, H-MA-28 ; PC-06/Valérie (2), PC-06/Hugo (2), PC-03/Camille ; Camille juge au contraire la forme « tenue » (PC-06) | P-11, P-15 |
| C-39 | Les tâches d'un mariage s'appellent « Rétroplanning » dans la fiche et « Tâches » dans le menu. Sous « 31 tâches faites sur 42 », la fiche écrit « Aucun modèle de rétroplanning pour l'instant. », qui parle des réglages de l'espace. | gêne | confirmé | H-IA-17, H-IA-33, H-IA-42 ; PC-06/Camille (cherche le mot « tâches »), PC-03/Camille, PC-01/Clémence (mot non compris) | P-11, P-15 |
| C-40 | Cocher une première case insère la barre « 1 tâche sélectionnée » au-dessus du tableau : la liste descend de 74 px et le clic suivant tombe à côté. Sur téléphone, le panneau « Responsable » sort de l'écran. | gêne | confirmé | H-IX-09 ; PC-06/Camille (2), PC-06/Hugo (2) | P-16, P-20 |

### Prestataires

| # | Constat | Gravité | Verdict | Sources | Principe candidat |
| --- | --- | --- | --- | --- | --- |
| C-41 | Depuis le carnet, on ne peut pas rattacher un prestataire à un mariage : la seule action d'une ligne est « Archiver », la fiche n'offre que « Modifier la fiche » et « Archiver ». Le geste n'existe que dans le mariage. | bloque | confirmé | PC-05/Inès (0, abandon), PC-05/Martine (0, abandon), PC-05/Valérie (0, abandon) ; non prévu par les spécialistes | P-14 |
| C-42 | Aucun voyant ne dit qu'une pièce manque ou expire : ni dans le carnet, ni dans le tableau du mariage, dont l'en-tête dit pourtant « Poste, prestataire et pièces ». Il faut ouvrir chaque fiche, et descendre au cinquième bloc. | bloque | confirmé | PC-05/Inès (0, abandon), PC-05/Martine (0, abandon), PC-05/Valérie (0, abandon) ; non prévu par les spécialistes (voir H-IA-35) | P-06, P-10 |
| C-43 | Dans les filtres du carnet, le champ « Où ? » est un carré de 26 px où la saisie ne se voit pas ; « dans un rayon de » flotte sur un pavé blanc. Personne n'a pu chercher par lieu. | freine | confirmé | H-VI-01 (présumée « bloque »), H-MA-09, H-IX-37, L7 ; PC-01/Camille, PC-01/Clémence, PC-05/Inès, PC-05/Martine, PC-05/Valérie. [preuve](preuves/carnet-filtre-ou.jpg) | P-20 |
| C-44 | Une ligne du carnet prend 138 px pour un nom, « Non placé sur la carte » (douze fois sur douze) et un lien noir « Archiver » : ni métier, ni ville, ni téléphone. « 12 » est écrit cinq fois, « À classer » deux fois. La carte, vide, occupe la moitié de l'écran (dans l'environnement d'essai, le fond de carte n'est pas installé). | freine | confirmé | H-VI-12, H-VI-22, H-VI-23, H-MA-08, H-IA-28, L7 ; PC-05/Inès (1), PC-05/Martine (1), PC-05/Valérie (1), PC-04/Camille. [preuve](preuves/prestataires-1440.jpg), [recherche](preuves/carnet-recherche-1512.jpg) | P-10, P-06 |
| C-45 | Le carnet ne se trie pas et n'a ni case à cocher ni action sur plusieurs fiches ; seuls « Exporter en CSV » et « Exporter en PDF » agissent sur la liste. | freine | confirmé | PC-05/Inès (1), PC-05/Valérie (0) ; non prévu par les spécialistes | P-13 |
| C-46 | Créer un prestataire a deux formulaires sans rapport. Par le carnet : quatre rubriques, six réseaux sociaux avant le métier et le téléphone, « N° SIRET » sans explication, une rubrique « Métiers et étiquettes » vide sans moyen d'ajouter, puis une fenêtre titrée « … : modifier ». Depuis un poste du mariage : quatre champs, sans métier (« Les Calèches du Lac » finit sous « Imprévus »). | freine | confirmé | H-IX-14, H-IX-36 ; PC-08/Clémence (2), PC-08/Sophie (2), PC-05/Inès, PC-05/Martine, PC-05/Valérie | P-14, P-11 |
| C-47 | Le carnet n'offre aucun filtre par métier ni par étiquette : seulement « Tous · 12 » et « À classer · 12 ». Les fiches du jeu fictif n'ont pas de métier ; un carnet classé montrerait une pastille par famille. Reste à voir si l'on filtre alors par métier et par étiquette. | freine | à trancher | PC-05/Inès (1), PC-05/Martine (1), PC-05/Valérie (1) ; réserve : jeu fictif sans métier ; la visite annonce « Une pastille par famille » (H-TX-09) | P-13 |
| C-48 | La fiche d'un prestataire fait 3 830 px en neuf blocs, dont deux « Historique », avec six boutons pleins (un par bloc). On y arrive en deux clics (aperçu, puis « Ouvrir la fiche complète »). « Métier — », « Évaluation — », « Tarifs indicatifs — » ne disent pas quoi faire. Une fiche affiche « Prix réel 9 600,00 € » et « Prix final 600,00 € » (vu une fois, à vérifier). | gêne | confirmé | H-IA-35, H-VI-14, H-VI-45 ; mesure du relevé (6 boutons principaux) ; PC-05/Inès (2), PC-05/Martine (1), PC-05/Valérie (2) | P-09, P-06, P-08 |
| C-49 | Dans « Budget et prestataires » : « Comparer » ou « Retenir » (lequel veut dire proposer ?), un menu « + Ajouter des prestataires » étroit qui coupe « Déjà travaillé ensemble · 1 évènement » sur cinq lignes et ne dit pas le métier, un champ qui garde la saisie précédente, « Supprimer » coupé à 1 280 et 1 366 px, des pastilles toutes vertes (« Contrat signé », « Engagé », « Retenu »), « À trouver » en rouge. Le nom du prestataire n'ouvre pas sa fiche. « Voir tout le carnet » pose un filtre de lieu que l'on n'a pas demandé et qui ne s'enlève pas (vu une fois). | gêne | confirmé | H-IA-13, H-VI-33 ; PC-05/Inès (2), PC-05/Martine (2), PC-05/Valérie (2), PC-04/Camille (1), PC-04/Inès (0, abandon sur le filtre : à vérifier dans l'app), PC-02/Martine | P-11, P-15, P-21 |
| C-50 | Relancer un prestataire depuis la fiche du mariage demande cinq à six gestes sur trois écrans. « Noter une relance » suppose qu'elle est déjà faite ; le message à copier est derrière un bouton ; après « Relance notée. », le tableau affiche encore « Dernière relance : — ». Depuis « Aujourd'hui », le même geste est à un clic. | gêne | confirmé | PC-03/Camille (1), PC-03/Nadia (2) ; non prévu par les spécialistes | P-14, P-16 |

### Reprise et import

| # | Constat | Gravité | Verdict | Sources | Principe candidat |
| --- | --- | --- | --- | --- | --- |
| C-51 | Rien ne dit par où reprendre un mariage en cours. L'assistant demande « Que voulez-vous remplacer par Symbola ? », puis « Votre espace est prêt » n'offre que « Créer mon premier évènement » et « Explorer avec un exemple ». L'import est dans Paramètres › « Prestataires et données » › « Importer ». Quatre fichiers d'un même mariage ont quatre portes (deux tuiles de `/import`, l'onglet du budget, l'onglet du programme), sans ordre affiché ; `/import` cite « Deux PDF repris ailleurs » et oublie celui des prestataires retenus. | bloque | confirmé | H-IA-02, H-IA-03, H-TX-02, H-TX-04, H-MI-04, H-MI-05, H-MI-08 ; PC-02/Martine (1), PC-02/Inès (2), PC-02/Sophie (mariage jamais trouvé). [preuve](preuves/demarrage-et-maintenant-1440.jpg) | P-04 |
| C-52 | Le budget d'un tableur, importé par `/import` › « Un autre fichier » › « Lignes de budget », est rejeté en entier au quatrième écran : « 14 lignes sur 14 ne seront pas importées. Téléchargez le rapport pour les corriger dans votre tableur », quatorze fois « événement introuvable ou ambigu ». Aucun écran n'a demandé pour quel mariage. La voie qui marche (bouton « Importer » de l'onglet du budget) n'est pas citée, et suppose d'avoir créé le mariage à la main. | bloque | confirmé | H-MI-01 ; PC-02/Sophie (0, abandon), PC-02/Martine (1). [preuve](preuves/import-budget-rejete-1440.jpg) | P-03 |
| C-53 | Un import crée de fausses urgences. La colonne « Acompte versé » devient une échéance : « Réglé 0,00 € », six « En retard », « Reste à payer 27 502,00 € » au lieu de 18 775. Les prestataires « retenus » repris d'un PDF deviennent douze « Contrat de … à faire signer · Depuis le [jour de l'import] » sur « Aujourd'hui » et sur la fiche. | bloque | confirmé | H-MI-02, H-MI-03, H-MI-33, H-IA-05 ; PC-02/Martine (abandon à l'étape du total), PC-09/Inès (1). [preuve](preuves/budget-acompte-en-retard-1366.jpg), [Aujourd'hui](preuves/aujourdhui-apres-reprise-1440.jpg) | P-01, P-03 |
| C-54 | La liste « à faire » d'un tableur n'a pas de porte dans le mariage : l'onglet Rétroplanning n'a pas de bouton « Importer ». Par l'adresse, « Quoi » et « Pour quand » (le titre et l'échéance) ne sont pas reconnus. | bloque | à trancher | H-MI-07 (non rejouée jusqu'au bout) ; un seul profil : PC-02/Martine (vu, non importé, plafond du test) | P-04, P-03 |
| C-55 | Un mariage repris dit que tout va bien là où il n'y a rien : « Planning · 0 sur 0 tâches faites · Bon », « Rien à faire pour le moment : tout est à jour. », lignes de budget à « — » comptées « 11 lignes pourvues sur 11 » sous une barre pleine. Aucun écran ne liste ce qui reste à compléter, rien ne marque le mariage repris dans la liste ni ne relie la fiche à son import. | freine | confirmé | H-MI-11, H-MI-21, H-MI-23, H-MI-36, H-TX-19 ; PC-09/Inès (1), PC-09/Martine (1), PC-02/Inès (2), PC-02/Martine (1) ; mesures de PC-09 non tenues chez les deux profils. [preuve](preuves/fiche-reprise-synthese-1440.jpg) | P-06, P-05 |
| C-56 | Les sommes de la fiche d'origine finissent hors calcul, tout en bas, dans « Champs importés » : « Total 21650,50 € », « Total Payé 3200,00 € » (sans espace des milliers), pendant que la tête de fiche dit « 0,00 € engagés sur une enveloppe de 25 000,00 € ». L'assistant promettait la rubrique « Notes » ; elle affiche « — ». | freine | confirmé | H-MI-09, H-MI-10, H-VI-42 ; PC-09/Inès, PC-09/Martine, PC-02/Inès | P-06, P-07 |
| C-57 | L'écran « Doublons » parle de « rapprochements », « à vérifier », « propositions sûres », « ressemblance 63 % », « vos modules ». Trois boutons de lot de même poids (« Valider les N rapprochements proposés », « Créer les N lignes comme nouvelles », « Tout accepter (N propositions sûres) ») ; « Continuer », plein, ne répond rien tant qu'il reste une décision. « Valider » fond trois lignes « Traiteur » en une (17 100,00 €, écart faux), ce que l'écran ne montrait pas. | freine | confirmé | H-IX-02, H-IX-12, H-VI-18, H-TX-08, H-MI-13, H-MI-30 ; PC-02/Martine (1), PC-02/Sophie (2). [preuve](preuves/import-rapprochements-1440.jpg) | P-08, P-03, P-16 |
| C-58 | Les nombres changent entre l'annonce et le bilan : « Fiches créées 6 · Fiches mises à jour 8 » devient « 14 créés · 0 mis à jour » ; 48 doublons sont « à vérifier », « mises à jour », « ignorées (vides, en erreur ou inchangées) » puis « sans changement (déjà à jour) » ; « 16 prestataires placés » pour 25 fiches. L'écran de confirmation ne donne ni total de contrôle ni fiche telle qu'elle sera. | freine | confirmé | H-MI-14, H-MI-25 ; PC-02/Martine, PC-02/Sophie, PC-02/Inès ; mesure « aucun chiffre ne diffère sans explication » non tenue chez les trois | P-07 |
| C-59 | `/import` : quatre cartes « Reprendre mes… » sans air de bouton ; arrivée en bas de page ou dans le menu des Paramètres, à côté de « Fermer l'espace » ; la tuile « Reprendre mes contacts » encadrée quand on importe autre chose ; aucun retour vers le mariage d'où l'on vient ; un import en cours ne se retrouve que par le mot « Reprendre » au bas du journal ; « Que contient le fichier ? » offre huit choix sans proposer (« Lignes de budget » ou « Lignes du budget par défaut » ?) ; « JSON », « encodage », « séparateur ». « Abandonner l'import » a l'air d'un lien. | freine | confirmé | H-IA-06, H-IX-13, H-IX-38, H-MI-28, H-MI-29, H-MI-31 ; PC-02/Martine, PC-02/Sophie (1 après l'abandon), PC-02/Inès, PC-07/Valérie, PC-07/Nadia. [preuve](preuves/import-accueil-1440.jpg) | P-04, P-12, P-22 |
| C-60 | Devant un mauvais fichier ou une erreur, l'assistant ne dit pas où aller : un PDF de programme déposé comme fiche donne « trop de pages pour une fiche » et « corrigez dans votre tableur » ; un budget déposé comme contacts, « reconnu 0 sur 9 » ; une erreur de colonne s'affiche hors de vue pendant que tous les menus montrent « Nom du prestata… ». Un PDF est décrit en « lignes » et « colonnes », avec des valeurs brutes (« Statut : confirmed », « 2027-06-12 », « Ch&acirc;teau »). | freine | confirmé | H-TX-03, H-MI-24, H-MI-41 ; PC-02/Inès (1), PC-02/Sophie (1), PC-02/Martine | P-18, P-03 |
| C-61 | L'import ne range pas dans le vocabulaire de l'espace : les postes du tableur (« Lieu », « Musique ») s'ajoutent aux postes de départ (« Lieu de réception — À trouver »), d'où « 6 lignes pourvues sur 18 » et douze « À trouver » dont trois vrais ; les mots de l'ancien outil restent (« Baby-Sitter », « Coiffeur(se) - Maquilleur(se) » à côté de « Coiffure et maquillage », « Léa MARTIN », « POITIERS »). | freine | confirmé | H-MI-12, H-MI-34, H-MI-38 ; PC-02/Martine (1), PC-02/Inès, PC-09/Inès | P-01, P-15 |
| C-62 | L'aperçu des prestataires retenus tient dans 620 px sur 1 056 : la colonne « Ligne du budget » ne montre qu'une lettre par menu (« N », « T »). On ne lit le poste proposé qu'en ouvrant douze menus ; un brunch part sous « Traiteur ». « Fichier de : Clémence MARTIN, Bastien LEROY » s'affiche sans alerte sur la fiche de « Léa & Hugo ». | freine | à trancher | H-MI-17, H-MI-37, H-MI-38 ; un seul profil : PC-02/Inès (1). [preuve](preuves/reprise-prestataires-apercu-1512.jpg) | P-03, P-06 |
| C-63 | Le programme repris d'un PDF invente des heures de fin (« 00:30 – 11:00 · 10 h 30 »), nomme trois journées « Jour J », perd l'annuaire des contacts et laisse la colonne « Lieu » vide. Inès le juge pourtant « bien repris » ; Martine, dans un espace sans programme repris, lit deux séquences nommées comme des lieux. | freine | à trancher | H-MI-16, H-MI-18, H-MI-19 contre PC-09/Inès (programme parmi les trois choses aimées) ; PC-09/Martine, PC-02/Inès (deux « Jour J » à l'aperçu) | P-06, P-01 |
| C-64 | Un mariage repris affiche « Type d'événement : Type à préciser », une frise « Confirmé » datée du jour de l'import, « Source du prospect : Outil actuel » ; l'import exige une source que le fichier n'a pas. (Le mariage créé du jeu fictif affiche lui aussi « Type à préciser ».) | gêne | confirmé | H-MI-15, H-MI-20, H-MI-22, H-MI-35, H-TX-19 ; PC-02/Inès, PC-02/Martine, PC-09/Inès, PC-09/Martine. [preuve](preuves/fiche-reprise-retroplanning-1440.jpg) | P-03, P-06 |
| C-65 | Après la reprise de 600 contacts : téléphones laissés en trois écritures, doublons par nom non signalés (seul l'e-mail est comparé), « Catégorie » gardée en note, sans colonne ni filtre. | gêne | à trancher | un seul profil : PC-02/Sophie (2) ; les spécialistes n'ont pas rejoué ce fichier | P-06, P-13 |
| C-66 | L'annulation d'un import terminé existe (90 jours) mais se présente comme un détail à déplier, parmi trois pastilles vertes ; son texte se relit (« … et remet rien d'autre. ») ; on ne la retrouve qu'en bas de `/import`. Les prestataires retenus, eux, ne se défont que poste par poste. | gêne | non testé | H-IX-39, H-MI-32 (annulation vérifiée par le spécialiste) ; aucun profil ne l'a essayée (vue par Inès, Martine, Sophie) | P-16, P-17 |

### Premiers pas

| # | Constat | Gravité | Verdict | Sources | Principe candidat |
| --- | --- | --- | --- | --- | --- |
| C-67 | Le premier mariage naît en retard : la case « Partir du rétroplanning … (18 tâches) », cochée d'avance, date les tâches depuis le jour J. Dix secondes après la création : « En retard de 166 jours », « Tâches · 8 en retard » au menu, « 8 points demandent votre attention », « Tâche confiée au client » sans avoir rien confié, « Source du prospect : Instagram » et « Confirmé » que personne n'a saisis. Sur un mariage repris, le bandeau pousse au même geste. | bloque | confirmé | H-TX-01 (« bloque »), H-TX-28, H-MI-06, H-MI-35 ; PC-01/Camille (première gêne citée), PC-01/Clémence (première gêne citée), PC-02/Martine (décoche la case). [preuve](preuves/premier-mariage-retards-1440.jpg) | P-02, P-01 |
| C-68 | L'assistant de démarrage est apprécié, mais : « Reprendre le questionnaire » avant de l'avoir commencé ; « Continuer » et « Passer » font la même chose ; « Franchise en base », « Assujettie » ; « De 11 à 25 » coché d'avance ; « Continuer » sous le pli à la question 2. « Votre espace est prêt » ne reprend ni le volume ni les outils déclarés, puis l'accueil répond « Votre fiche entreprise n'est pas encore complète » et « 0 sur 2 faits ». | gêne | confirmé | H-TX-29, H-TX-38, H-TX-39, H-VI-40 ; PC-01/Camille (2), PC-01/Clémence (2), PC-02/Martine, PC-02/Sophie, PC-02/Inès | P-04, P-15 |
| C-69 | Les états vides d'« Évènements » et du carnet ont le bon gabarit (titre, phrase, exemple, action, aide), mais leur action est un bouton secondaire à côté d'un autre bouton plein ; le carnet vide écrit « Aucun prestataire ne correspond à ces filtres. » sans filtre posé, garde sept filtres, une carte et deux exports pour zéro fiche. Au relevé, 7 écrans vides sur 22 portent un état vide. | gêne | confirmé | H-TX-42, H-IA-41 ; mesure du relevé ; PC-01/Camille (2), PC-01/Clémence (1), PC-02/Inès | P-05, P-08 |
| C-70 | Le parcours des tutoriels commence par les devis et les factures et range « Importer ses événements existants » en dernier, sous « Autres tutoriels ». Les deux profils qui l'ont ouvert l'ont trouvé clair (étapes, durées) ; aucun n'y cherchait la reprise. | gêne | à trancher | H-IA-36, H-TX-16 contre PC-08/Clémence (3), PC-08/Sophie (3) | P-04, P-19 |

### Paramètres

| # | Constat | Gravité | Verdict | Sources | Principe candidat |
| --- | --- | --- | --- | --- | --- |
| C-71 | Des rubriques voisines se ressemblent trop : « Lignes du budget » et « Répartition du budget » (trois profils ouvrent ou hésitent sur la mauvaise), « Modèles d'e-mails » et « Modèles de messages » (quatre profils), « Radar des risques », « Pièces des prestataires » et « Notifications » pour une alerte d'assurance (trois profils). « Métier » se dit « type », rangé dans une « famille ». | freine | confirmé | H-IA-24 (modèles) ; les autres paires n'étaient pas prévues ; PC-07/Sophie, PC-07/Nadia, PC-07/Clémence, PC-07/Valérie (demandes 4, 6, 12, 14 : notes 1 ou 2) | P-22, P-15 |
| C-72 | Le menu des Paramètres a cinq groupes à déplier ; « Événements » aligne dix-huit rubriques de six natures et dépasse l'écran ; le menu défile avec la page. Le titre de l'écran n'est pas toujours le libellé du menu (« Rétroplanning » ouvre « Modèles de rétroplanning »). | gêne | confirmé | H-IA-11, H-IA-20 ; PC-07/Valérie, PC-07/Nadia, PC-07/Sophie, PC-07/Clémence | P-22 |
| C-73 | « Prestataires et données » réunit le carnet, « Importer », « Données personnelles », « Exporter mes données », « Reprendre un export », « Fermer l'espace ». Les quatre profils hésitent à y chercher l'import de contacts ; « Importer » fait sortir des Paramètres ; « Fermer l'espace » fait peur à côté de l'import. | gêne | confirmé | H-IA-22, H-IA-25 ; PC-07/Sophie, PC-07/Nadia, PC-07/Clémence, PC-07/Valérie, PC-02/Sophie | P-22 |
| C-74 | « Chercher un réglage » ne cherche que le nom des rubriques : « copie de mes données » rend « Aucun réglage ne porte ce nom. », « logo » vide le menu. Il voisine avec la recherche du haut : deux champs côte à côte. | gêne | confirmé | H-IA-26, H-VI-15 ; PC-07/Sophie (1 à la demande 15), PC-07/Nadia | P-22, P-11 |
| C-75 | Les écrans de réglage n'ont pas de patron commun : au relevé, 16 sur 58 n'ont aucun bouton principal et 12 en ont plusieurs. « Chaque modification s'enregistre quand vous quittez le champ » laisse deux profils dans le doute ; « Enregistrer la fiche » est sous le pli ; adresse et téléphone sont dans deux cartes ; sur « Équipe », des liens sont coupés (« Retirer l'accè… »). | gêne | confirmé | mesure du relevé ; PC-07/Valérie, PC-07/Nadia ; Clémence comprend l'enregistrement à la sortie du champ | P-08, P-16 |
| C-76 | Des libellés bruts s'affichent : « {{terme_clients}} » dans le texte de « Termes des clients » ; « Devis signéImmédiat » sans espace dans Notifications (vu une fois) ; « PUSH », « E-reporting », « ZIP », « JSON ». | détail | confirmé | PC-07/Clémence, PC-07/Sophie (« {{terme_clients}} ») ; PC-07/Valérie (« Devis signéImmédiat ») ; non prévu par les spécialistes | P-15 |

### Téléphone et zoom

| # | Constat | Gravité | Verdict | Sources | Principe candidat |
| --- | --- | --- | --- | --- | --- |
| C-77 | Sur téléphone, le tableau des tâches (et le Rétroplanning) montre la case, le rond et un titre sur trois à cinq lignes ; la quatrième colonne est coupée à « CA ». L'échéance, la personne et les trois actions sont hors de l'écran, sans signe. 40 cibles de moins de 44 px, 133 dans « Toutes ». La première tâche arrive à 720 px. | bloque | confirmé | H-VI-03 (« bloque »), H-MA-02 (« bloque »), H-MA-14, H-MA-15, H-IX-16, L2 ; mesure du relevé ; PC-06/Camille (1), PC-06/Hugo (abandon de la lecture), PC-01/Clémence. [preuve](preuves/taches-375.jpg) | P-20, P-10 |
| C-78 | Sur téléphone, « Budget et prestataires » montre « Prévu », « Réel », « Écart », « Réglé », « Reste à payer », « Prochaine échéance » sans aucun montant : valeurs, statut et « Ouvrir » sont hors du cadre à droite. | bloque | confirmé | H-MA-01 (« bloque ») ; PC-03/Hugo (abandon de l'onglet), PC-03/Camille (1). [preuve](preuves/budget-prestataires-375.jpg) | P-20 |
| C-79 | Sur téléphone comme à 150 %, chaque réglage s'ouvre sous le menu des Paramètres : 55 écrans sur 58 n'ont aucune commande du réglage dans le premier écran ; le titre « Notifications » est à 1 200 px. Par « Menu › Paramètres », la page arrive défilée sur un formulaire. Clémence trouve quand même 13 réglages sur 15 au premier essai. | freine | confirmé | H-IA-15, H-VI-15, H-MA-03 (présumée « bloque »), H-MA-12, L8 ; mesure du relevé ; PC-07/Clémence, PC-07/Sophie. [preuve](preuves/parametres-notifications-375.jpg) | P-20, P-22 |
| C-80 | Sur téléphone, la fiche d'un évènement a 800 px d'en-tête avant ses onglets ; la barre n'en montre que deux sur huit et pas celui qui est ouvert ; changer d'onglet renvoie en haut. La frise s'écrit sur trois ou quatre lignes par étape ; « Noter une relance » recouvre la pastille de date ; « Reporter l'évènement… » et « Annuler l'évènement… » sont deux petits liens voisins. | freine | confirmé | H-VI-02 (« bloque »), H-VI-28, H-MA-04, H-MA-05, H-MA-20, H-MA-21 ; PC-03/Camille, PC-03/Hugo, PC-01/Clémence. [preuve](preuves/fiche-evenement-375.jpg), [onglets](preuves/fiche-onglets-375.jpg) | P-20, P-09 |
| C-81 | Sur téléphone, les listes commencent par leurs filtres : premier prestataire à 1 276 px, premier évènement à 835 px (statut coupé, lieu hors cadre). Les formulaires mettent le sommaire avant le premier champ et le bouton final tout en bas. La barre du haut prend 160 px, avec une recherche coupée à « Recher » et la pastille « ⌘K » ; « Créer » annonce « Raccourci : touche N ». | freine | confirmé | H-MA-07, H-MA-10, H-MA-22, H-MA-23, H-IX-40, H-IA-43, H-VI-35, H-TX-43 ; mesure du relevé (cibles) ; PC-01/Camille, PC-01/Clémence, PC-03/Camille, PC-08/Clémence | P-20 |
| C-82 | À 911 × 512 (portable à 150 %), le menu latéral est coupé : « Apps », « Paramètres », « Tutoriels », « Aide » sont sous le bas de la fenêtre et ne se voient qu'en faisant défiler le menu. Le panneau d'aide et le message de la fenêtre « Nouveau prospect » sont coupés par le bas. | freine | à trancher | un seul profil (Sophie), trois passages : PC-07, PC-08, PC-02 ; non prévu par les spécialistes (H-MA-11 à H-MA-13 regardent le contenu) | P-20 |
| C-83 | Des états ne tiennent qu'à la couleur : l'option active d'un filtre est un fond vert pâle (rapport 1,16) ; les titres de tâche sont des liens noirs non soulignés (11 par écran au relevé) quand la même tâche est un lien vert souligné sur « Aujourd'hui » ; l'ambre sert à une date proche, à « À surveiller », à « Mariés » et à « Priorité haute » ; le vert porte huit rôles. | gêne | confirmé | H-MA-19, H-MA-27, H-MA-28, H-MA-29, H-VI-39 ; mesure du relevé (liens sans signe, cliquable sans rôle) ; aucun profil n'a buté sur un contraste | P-21 |
| C-84 | Le menu du téléphone se déplie au-dessus de la page et la pousse de 788 px, ne se ferme pas à Échap, perd son bouton de fermeture au défilement, et finit par « Se déconnecter ». Camille le trouve « propre » ; Clémence a cherché le menu en bas avant de voir « Menu » en haut. | gêne | à trancher | H-MA-06, H-MA-30 contre PC-01/Camille ; PC-08/Clémence | P-20 |

### Textes

| # | Constat | Gravité | Verdict | Sources | Principe candidat |
| --- | --- | --- | --- | --- | --- |
| C-85 | Cinq mots pour le couple (« Mariés », « le client », « le contact », « Interlocuteurs », « Tâche confiée au client ») et trois pour la planner (« Vous », « Planner », « Planner principal »). La colonne « Mariés » coiffe un baptême et un évènement d'entreprise ; « Prénom du premier marié » pour une mariée. | freine | confirmé | H-TX-06 ; PC-06/Valérie, PC-01/Camille, PC-01/Clémence, PC-03/Nadia, PC-06/Hugo | P-15 |
| C-86 | « Poste », « ligne du budget », « ligne », « prestation » nomment le même objet ; « Aucune ligne pourvue sur 12 » ne se comprend pas ; « Retenu », « Engagé », « Pressenti », « en comparaison » ne se distinguent pas. | freine | confirmé | H-TX-07 ; PC-02/Martine, PC-03/Camille, PC-03/Hugo, PC-03/Nadia, PC-05/Inès, PC-05/Martine, PC-05/Valérie, PC-09/Martine | P-15 |
| C-87 | Un même verbe a plusieurs sens. « Annuler » : défaire, sortir sans enregistrer, annuler un mariage, retirer un import. « Reporter » : une tâche, tout l'évènement ; et « Décaler de… » en lot. « Supprimer », « Retirer », « Archiver » ne disent pas ce qui reste (« Archiver » fait peur). « Modifier », « Changer » (16 écrans), « Renommer ». « Réglages » ouvre les « Paramètres ». | gêne | confirmé | H-IX-18, H-IX-19, H-TX-13, H-TX-23, H-TX-24, H-TX-25 ; mesure du relevé (verbes) ; PC-06/Valérie, PC-06/Camille, PC-06/Hugo (« Décaler » / « Reporter »), PC-05/Martine (« Archiver »), PC-07/Sophie (« Paramètres », pas « Réglages ») | P-15, P-17 |
| C-88 | « Reprendre » a cinq sens : « Reprendre mes événements » (importer), « en cours · Reprendre » (continuer), « Reprendre un export » (restaurer une archive Symbola), « Reprendre le questionnaire » (le commencer), « Reprendre les prestataires retenus (PDF) », à 150 px d'« Importer ». La page s'appelle « Importer », « Importer des données », « Importer un fichier ». | gêne | confirmé | H-IA-23, H-TX-20, H-TX-38, H-MI-27 ; PC-02/Inès (« mes fichiers sont justement des exports »), PC-07/Valérie, PC-07/Nadia, PC-01/Camille, PC-01/Clémence, PC-02/Martine, PC-02/Sophie | P-15 |
| C-89 | « Évènement » et « événement » sur le même écran, partout : « Créer mon premier évènement » au-dessus de « Type d'événement » ; « Date de l'événement » à 60 px de « Reporter l'évènement… ». | gêne | confirmé | H-TX-18 ; PC-01/Camille, PC-01/Clémence, PC-02/Martine, PC-02/Sophie, PC-02/Inès, PC-03/Camille, PC-06/Camille | P-15 |
| C-90 | Des mots que les profils disent ne pas comprendre : « Rang et jalon », « le radar », « Plage occupée », « chrono » (pour programme), « Apps », « rapport des écarts », « rapprochement », « vos modules », « JSON », « un seul exemplaire de chacun », « famille » de prestataires. | gêne | confirmé | H-TX-15, H-TX-08 ; PC-03/Camille, PC-06/Hugo, PC-01/Camille, PC-01/Clémence, PC-02/Inès, PC-02/Martine, PC-02/Sophie, PC-08/Sophie, PC-08/Clémence | P-15 |

### Hypothèses non testées, hors constats

Ces hypothèses n'ont été ni vues par le panel ni mesurées par le relevé. Elles restent des
observations d'un spécialiste, à garder pour les maquettes.

| Hypothèse | Objet | Pourquoi non testée |
| --- | --- | --- |
| H-IA-37 | « Contacts » et « Prestataires », deux carnets séparés dans le menu | Aucun parcours ne passe de l'un à l'autre |
| H-IX-44 | « Retour / Continuer » ici, « Précédent / Suivant » là ; « Journal » et « Historique » des imports | Aucun profil ne le relève |
| H-VI-09 | Dix-neuf formes de commande | Compte de spécialiste ; le panel bute sur des cas (C-19, C-34), pas sur le nombre |
| H-VI-31 | Barres d'avancement hors jetons, le zéro pèse plus que la valeur | Aucun profil ne le relève |
| H-VI-38 | Calendrier d'« Aujourd'hui » : titres coupés, familles dites par la couleur seule | Aucun profil n'a lu le calendrier |
| H-MA-18 | Sept arrêts de tabulation par tâche | Aucun parcours au clavier seul |
| H-MA-11, H-MA-13 | À 150 %, colonnes des tâches hors cadre, premier écran sans ligne | Sophie n'a joué ni « Tâches » ni la fiche ; captures du relevé seulement |
| H-MA-32, H-MA-34, H-MA-35 | Notifications, carte du carnet et « Type d'événement » sur téléphone | Écrans non ouverts à cette taille par le panel |
| H-IA-27 | Le panneau d'un poste du budget n'a pas d'adresse | Aucun profil ne recharge ni ne partage un lien |

## 5. Hypothèses infirmées ou contredites, désaccords à trancher

### Infirmées, ou ramenées à moins

| Hypothèse | Ce qu'elle prévoyait | Ce qui la contredit |
| --- | --- | --- |
| H-IA-11, H-IA-22, H-IA-25 | Réglages difficiles à trouver dans un menu de cinquante rubriques | PC-07 : 13 ou 14 réglages sur 15 trouvés au premier essai par les quatre profils, sans la recherche, téléphone compris. La gêne tient aux rubriques jumelles (C-71) et à la longueur du menu (C-72), pas à l'introuvable |
| H-IA-21 | « Relances des prospects » et « Relances de devis et de paiement » : on ouvre la mauvaise | Les quatre profils trouvent au premier essai ; le renvoi d'un écran à l'autre « rassure » Sophie. Valérie reste gênée par deux écrans voisins |
| H-MA-03 (gravité) | Paramètres sur téléphone : « bloque » | Clémence, sur téléphone, trouve 13 réglages sur 15. Le défaut est confirmé (C-79), sa gravité ramenée à « freine » |
| H-IA-01, H-VI-02 (gravité) | Onglets hors de vue : « bloque » | Personne n'a cherché « Invités » ; la coupure est vue par quatre profils (C-23). Gravité ramenée à « freine » |
| H-VI-01 (gravité) | Champ « Où ? » : « bloque » | Les cinq profils qui le voient cherchent par « Nom ou ville ». Gravité ramenée à « freine » (C-43) |
| H-IX-30 | Le brouillon retrouvé : « Reprendre » n'a pas l'air d'un bouton, la planner retape | PC-08/Sophie (3) : elle clique « Reprendre » et retrouve sa saisie. Seul « Effacer le brouillon », voisin, l'inquiète |
| H-TX-33 | L'absence de visite sur « Tâches » manquera | Clémence note « ici, pas de visite guidée » sans gêne ; les autres profils passent les visites, ou les lisent sans rien en retenir (Sophie). Le manque réel est « Revoir la visite » (C-06) |
| H-IX-13 (en partie) | Un import en cours ne se retrouve pas | PC-02/Sophie le retrouve par « en cours · Reprendre » et reprend au même écran (aimé). Reste vrai : l'accueil n'en dit rien |
| H-MI-39 | Un compte neuf arrive sur « Aujourd'hui », pas sur l'assistant | Artefact : l'outil ouvrait l'accueil. Écartée |
| H-IX-05, H-TX-26 (langue) | Les bulles d'erreur sont en anglais | Navigateur d'essai. Reste vrai : Symbola n'écrit aucun message (C-04) |

### Désaccords à trancher par Julien

**Tranchés le 25/11/2026 (porte 2)** : voir [06-decisions-porte-2.md](06-decisions-porte-2.md), qui fait foi.
D1 et D9 sont réglés par vérification dans l'app, C-82 est confirmé par une mesure.

| # | Question | D'un côté | De l'autre | Constat |
| --- | --- | --- | --- | --- |
| D1 | L'annulation de « Fait » rend-elle toujours la tâche à sa place ? | Camille : oui, immédiat (note 3) | Nadia et Hugo, dans l'agence : la tâche ne revient pas, ou sous un autre mariage ; message « Today.source.vendors » | C-17 |
| D2 | Faut-il garder des visites guidées qui s'ouvrent seules ? | Clémence les suit jusqu'au bout et cite « les visites guidées claires » parmi ce qu'elle aime (PC-08) ; elle y apprend le « ? » | Six profils les passent, Sophie les lit sans rien en retenir ; Clémence elle-même dit n'avoir « rien retenu » de deux d'entre elles (PC-01) | C-01 |
| D3 | Une tâche a-t-elle « la même forme partout » ? | Camille : mesure « tenue » (PC-06) | Valérie et Hugo : non (boutons, ordre, mots, panneau différents) ; spécialistes IA et VI | C-38 |
| D4 | Le menu du téléphone est-il à refaire ? | Camille : « propre » | Spécialiste MA : il pousse la page, ne se ferme pas à Échap ; Clémence a cherché le menu | C-84 |
| D5 | Le programme repris d'un PDF est-il bon à diffuser ? | Inès : « repris en entier », parmi ce qu'elle aime | Spécialiste MI : heures de fin inventées, annuaire perdu, trois « Jour J » | C-63 |
| D6 | L'ordre des tutoriels est-il à revoir ? | Clémence et Sophie : clair, note 3 | Spécialistes IA et TX : la reprise est en dernier, hors parcours | C-70 |
| D7 | « Chaque modification s'enregistre quand vous quittez le champ » : garder ? | Clémence comprend | Valérie et Nadia doutent, cherchent un bouton | C-75 |
| D8 | Créer un mariage déjà signé : « Prospect » ou « Évènement confirmé » ? | Martine et Inès prennent « Évènement confirmé » | Camille hésite (« Prospect » dit « Pas de rétroplanning ») ; Sophie, par « Créer », n'a que « Prospect » | C-25, C-03 |
| D9 | Le carnet se filtre-t-il par métier une fois les fiches classées ? | Trois profils : aucun filtre par métier | Jeu fictif sans métier ; la visite annonce « Une pastille par famille » | C-47 |
| D10 | Le seuil de trois zones d'action (A2 du cadrage) tient-il ? | 28 écrans sur 31 le dépassent au relevé | Le panel bute sur la fiche (10 zones), « Aujourd'hui » et le carnet (6), pas sur la liste des évènements (4) ni sur les formulaires (1 ou 2). Le seuil vaut comme cible de maquette, pas comme règle de contrôle | C-22, C-19 |
| D11 | Quatre constats ne reposent que sur un profil : les instruire ou les laisser ? | — | — | C-62, C-54, C-65, C-82 |

## 6. Ce qui marche et qu'il faut garder

Ce que les utilisatrices ont aimé ou réussi sans friction, puis les acquis relevés par les spécialistes.

| Acquis | Qui le dit |
| --- | --- |
| « À traiter en premier » : les retards en tête, « En retard de 5 jours », et sur chaque ligne « Vous » ou « Attend le client » ; « Fait » en un geste | PC-03/Camille, Nadia, Hugo ; PC-06/Hugo ; PC-04 (la « Prochaine action » de « Léa & Maxime ») |
| « Fait » puis « Annuler » pendant dix secondes, quand la tâche revient | PC-03/Camille (3) ; H-MA-37 |
| « Mes évènements » sur l'accueil : « À jour » ou « 5 points à traiter » par évènement | PC-03/Camille |
| « Aujourd'hui » sur téléphone : des cartes, un bouton sous le pouce | H-MA-37 ; PC-03/Camille (« je vais tout faire depuis l'accueil ») |
| L'assistant de démarrage : une question par écran, une réponse cochée d'avance, « Tout reste modifiable ensuite dans les Paramètres » | PC-01/Camille, Clémence ; PC-02/Inès (3), Sophie (3) |
| Créer le premier mariage en trois saisies ; le rétroplanning et le budget arrivent avec | PC-01/Camille, Clémence |
| Rien n'est perdu au retour : rechargement, autre appareil, fermeture du navigateur ; brouillon « retrouvé » | PC-01/Camille (2), Clémence (3) ; PC-08/Sophie (3) ; H-IX-30 |
| Le « ? » ouvre l'aide de l'écran en un geste, sans quitter l'écran (96 écrans sur 99 au relevé) | PC-01/Camille, Clémence ; PC-08 (mesure tenue) |
| Les tutoriels rangés par étape, avec leur durée | PC-08/Clémence (3), Sophie (3) |
| L'import reconnaît les colonnes de la planner (« NOM Prénom », « tel portable », « 8 sur 9 ») et montre un aperçu de la première ligne | PC-02/Martine, Sophie |
| L'import connaît l'ancien outil : colonnes croisées remises à l'endroit, « Ligne non reprise, c'est vous », « (poste repris de la ligne 4) », séquence « Cachée des mariés » | PC-02/Inès, Martine |
| Les totaux repris tombent juste : « 36 450,00 € » de prévu, « 27 502,00 € » de réel | PC-02/Martine ; H-MI (réponses aux questions) |
| « Rien n'est écrit avant votre accord » et « Abandonner cet import ? Le fichier et vos choix sont effacés ; rien n'a encore été importé. » | PC-02/Inès, Martine, Sophie ; H-TX-13 |
| Un import interrompu se reprend au même écran (« en cours · Reprendre ») | PC-02/Sophie |
| Depuis la fiche : « Les lignes iront dans l'évènement « Juliette & Romain » » ; prestataires retrouvés dans le carnet au lieu d'être doublés | PC-02/Martine, Inès |
| Les actions groupées de « Tâches » (« Décaler de… » déjà à 7, « Responsable », « Catégorie ») et le message « 2 tâches décalées de 7 jours. » | PC-06/Valérie (3), Camille, Hugo |
| « Liste / Calendrier » garde les filtres ; le calendrier en liste par jour sur téléphone | PC-06/Valérie (3), Camille (3), Hugo (3) |
| « + Créer › Tâche » depuis une fiche : le bon mariage est déjà choisi | PC-03/Nadia (3), Camille |
| La relance : valeurs par défaut justes, rappel posé à trois jours, message type à copier | PC-03/Nadia, Camille, Hugo |
| Créer un prestataire sans quitter le mariage (« Créer et comparer ») ; « Historique avec vous » en tête de fiche | PC-05/Inès, Martine, Valérie |
| La recherche du carnet filtre sans cliquer ; « 1 filtre actif », « Effacer les filtres » | PC-05/Inès, Valérie |
| Le tableau des postes : « À trouver », « 6 lignes pourvues sur 9 », la prochaine échéance | PC-05/Martine ; PC-09/Martine |
| Paramètres : des noms de rubrique presque tous parlants, une phrase d'explication en tête de chaque écran, « Exporter mes données », la Corbeille « prête à revenir », des notifications par personne | PC-07/Sophie, Nadia, Clémence, Valérie |
| Les états vides d'« Évènements » et du carnet suivent le bon gabarit (titre, phrase, exemple, action, aide) | H-TX-42 |
| Au clavier et pour un lecteur d'écran : lien d'évitement, anneau de focus net, Échap ferme panneau, aide et visite ; tableau des tâches étiqueté, chaque bouton nomme sa tâche ; un état a toujours un mot | H-MA-37, H-VI-39 |
| Contrastes des textes : tous au-dessus de 4,5:1 avec les jetons actuels | H-MA-27 |

## 7. Principes candidats pour le Design System

Les 60 principes des spécialistes, fusionnés. Ce sont des **candidats** : le Design System ne
s'écrit qu'après la validation des maquettes (porte 3).

| # | Principe | Constats qui le fondent |
| --- | --- | --- |
| P-01 | Fais arriver un import dans l'état du fichier : ce qui était payé, signé ou fait le reste ; un import ne crée ni retard ni relance. | C-53, C-61, C-63, C-67 |
| P-02 | Ne mets jamais « en retard » ce qui vient d'être créé, et n'invente aucune donnée métier : une valeur non saisie se dit « non renseigné ». | C-67 |
| P-03 | Demande à l'écran ce qui manque (le mariage visé, le statut d'un paiement, le type) ; ne renvoie jamais au fichier. | C-52, C-53, C-54, C-57, C-60, C-62, C-64 |
| P-04 | Donne à chaque parcours central une porte unique, au premier niveau, qui liste ses étapes, leur ordre et leur état. | C-15, C-51, C-54, C-59, C-68, C-70 |
| P-05 | Distingue « rien encore » et « tout est fait » : deux textes, et l'état vide porte la seule action principale de l'écran. | C-15, C-37, C-55, C-69 |
| P-06 | Fais dire à toute valeur absente ou déduite pourquoi elle l'est et quoi faire ; ne compte comme complet que ce qui l'est. | C-42, C-44, C-48, C-55, C-56, C-62, C-63, C-64, C-65 |
| P-07 | Annonce avant une action les nombres que le compte rendu redira après ; un compteur compte ce que l'écran montre. | C-20, C-56, C-58 |
| P-08 | Garde une seule action principale par écran, et que ce soit la tâche de l'écran : jamais un tutoriel, jamais une bascule de vue. | C-01, C-03, C-18, C-22, C-24, C-26, C-29, C-30, C-31, C-48, C-57, C-69, C-75 |
| P-09 | Tiens l'en-tête d'un objet en 200 px (nom, statut dit une fois, une action, un menu) ; montre tous les onglets et marque l'onglet ouvert. | C-22, C-23, C-26, C-27, C-28, C-48, C-80 |
| P-10 | Donne à une ligne de liste une cible, une action rapide et un menu ; une seule case ; rien de destructeur répété à chaque ligne. | C-19, C-24, C-29, C-30, C-34, C-35, C-42, C-44, C-77 |
| P-11 | Donne à chaque objet un nom, une ligne type et un seul panneau, les mêmes partout ; son nom est un lien vers sa fiche, dans les deux sens. | C-12, C-16, C-21, C-31, C-38, C-39, C-46, C-49, C-74 |
| P-12 | Ramène d'où l'on vient : fermer un panneau rend l'écran d'origine, à sa place ; un écran ouvert depuis un objet garde « ← son nom ». | C-11, C-12, C-16, C-59 |
| P-13 | Dote toute liste de filtres nommés (objet parent, personne, période), d'un tri, et dis combien de lignes elle montre sur combien. | C-14, C-32, C-33, C-45, C-47, C-65 |
| P-14 | Offre le même geste des deux côtés d'un lien (le carnet et le mariage), avec le même formulaire. | C-41, C-46, C-50 |
| P-15 | Tiens un lexique : un mot par objet, une graphie, un verbe par geste, vérifiés par un contrôle automatique des textes. | C-03, C-10, C-25, C-28, C-36, C-38, C-39, C-49, C-61, C-68, C-71, C-76, C-85, C-86, C-87, C-88, C-89, C-90 |
| P-16 | Confirme toute action au même endroit, avec « Annuler » pendant dix secondes, suppression comprise ; un bouton répond toujours, ou dit pourquoi il ne peut pas. | C-08, C-09, C-17, C-36, C-40, C-50, C-57, C-66, C-75 |
| P-17 | Donne au danger une forme unique, à la mesure du risque, avec sa conséquence et un bouton de renoncement. | C-08, C-27, C-66, C-87 |
| P-18 | Écris les erreurs toi-même : en français, sous le champ, avec le mot du libellé, en disant où aller ; marque l'obligatoire avant l'envoi. | C-04, C-25, C-60 |
| P-19 | Propose une aide à la fois, sans l'imposer ni couvrir un résultat ; qu'elle décrive ce que l'écran montre et réponde à des questions. | C-01, C-02, C-05, C-06, C-07, C-10, C-18, C-70 |
| P-20 | Sur téléphone et à 150 %, supprime tout défilement de côté : un tableau devient des cartes, le contenu passe avant la navigation, rien ne se superpose. | C-40, C-43, C-77, C-78, C-79, C-80, C-81, C-82, C-84 |
| P-21 | Donne un seul sens à chaque teinte ; fais lire un état sans la couleur ; rends tout lien reconnaissable sans survol. | C-13, C-29, C-34, C-49, C-83 |
| P-22 | Ne range dans les Paramètres que des réglages, sept rubriques au plus par groupe, aux libellés qui commencent par ce qui les distingue ; un bouton dit sa portée (ce mariage, ou tous). | C-11, C-59, C-71, C-72, C-73, C-74, C-79 |

## 8. Couleurs à venir

La marque passera à un trio **bleu vif, orange, crème**. Les valeurs exactes ne sont pas connues :
ce qui suit ne fixe aucune teinte. Les rapports de contraste cités viennent de calculs du
spécialiste MA sur des teintes « types », non sur les couleurs de la marque ; ils donnent un ordre
de grandeur, à refaire sur les vraies valeurs.

### Ce que disent les spécialistes

| Point | Source |
| --- | --- |
| Un orange vif ne porte pas de texte : ni blanc sur orange, ni orange sur crème n'atteignent 3:1 dans les calculs types. Seule une encre foncée sur orange passe | H-MA-17, H-VI-16 |
| Un bleu « vif » clair ne passe pas non plus en texte sur crème ni sous du texte blanc ; il faudra une nuance plus sombre pour les boutons et les liens (4,5:1 au moins) | H-MA-17 |
| L'app emploie déjà un ambre pour « attention » : dates proches, « Depuis le… », « À surveiller », « Même jour », le bandeau « rapprochements attendent votre décision ». Il sert aussi à « Mariés » et à « Priorité haute » | H-VI-16, H-MA-29, H-TX-08, H-MI-30 |
| Le rouge dit le retard, mais aussi « Supprimer » sur chaque ligne, « Retirer », « À trouver », « Annuler l'évènement… » | H-VI-10, H-IX-08, H-IX-27, H-VI-33 |
| Le vert porte huit rôles (action, liens, entrée active, bascule active, statuts positifs, bandeau, avancement, mise en valeur) : le passage au bleu reporterait les huit sur le bleu | H-VI-39, H-IX-24, H-VI-19 |
| Une barre verte pleine dit « terminé » pour « 11 lignes pourvues sur 11 » sans montant | H-MI-11 |
| Les pastilles du menu (« 2 en retard », « 0/11 ») se liraient comme des alertes dans une teinte de marque | H-IA-40, H-TX-40 |
| Un fond crème se confondra avec le fond clair des pastilles d'attention ; l'état actif ne tient aujourd'hui qu'à un fond presque blanc | H-MA-17, H-MA-27 |

Côté panel : aucun profil n'a buté sur une couleur en tant que telle. Deux remarques s'en
approchent : « un mur rouge » pour les retards du premier mariage (PC-01/Camille) et le « Supprimer »
rouge sur chaque ligne (PC-01/Camille, PC-06/Valérie). Ce chapitre repose donc sur les spécialistes.

### Trois répartitions à étudier en maquette

| | Action et liens | Orange | Crème | États (attente, retard, réussite) | Risques |
| --- | --- | --- | --- | --- | --- |
| **A. Orange de marque seulement** | Bleu | Logo, illustrations, écrans vides ; jamais dans une liste ni sur un bouton | Fond de page et des bandeaux d'information | L'attente quitte l'ambre pour une teinte ou une pastille neutre avec icône ; le rouge reste le retard | La plus sûre pour la lecture ; l'orange se voit peu dans l'app ; tous les ambres actuels sont à recaler |
| **B. Orange = « à traiter »** | Bleu | Remplace l'ambre : attente, échéance proche ; interdit aux boutons | Fond | Orange pour l'attente, rouge pour le retard, une teinte à part pour la réussite | Orange et rouge voisins dans les listes (daltonisme) : chaque état doit garder son mot ; un texte orange sur clair ne passe pas, il faut une encre foncée sur fond orangé |
| **C. Orange d'accent, un par écran** | Bleu | Un seul élément par écran (compteur du jour, étape en cours), en texte foncé sur orange | Cartes mises en avant | L'attente devient neutre avec icône ; le rouge reste le retard | Règle difficile à tenir d'un écran à l'autre ; l'accent peut se lire comme l'action principale |

Dans les trois cas, à décider avant tout nuancier : le bleu porte l'action et rien d'autre (ni
statut positif, ni avancement, ni bandeau) ; une teinte n'a qu'un sens (C-83) ; le rouge
n'habille plus une commande répétée (C-34) ; un état se lit sans la couleur ; le crème
ne sert pas à la fois de fond de page et de fond d'alerte.

## 9. Ce qui part en maquette (proposition pour la porte 2)

Dans l'ordre du cadrage. Chaque maquette montre l'écran d'aujourd'hui et l'écran proposé, en
1 440 et en 375 px, vide, rempli et repris.

| Module | À traiter en maquette | Questions ouvertes |
| --- | --- | --- |
| **Aujourd'hui** | L'accueil d'un espace neuf et au lendemain d'une reprise (C-15, C-53) ; la ligne d'« À traiter en premier » et ce qu'elle ouvre (C-16, C-19, C-21) ; ce qui passe avant les urgences (C-18) ; les compteurs (C-20) ; la vue d'ensemble d'une agence (C-14) | D1, D10 |
| **Évènements** | L'en-tête de la fiche et sa barre d'onglets, téléphone compris (C-22, C-23, C-80) ; une seule « suite » par mariage, selon son origine et son avancement (C-24, C-55) ; le panneau « Modifier les informations » (C-26) ; la création, mariage déjà signé compris (C-25, C-03) ; la Synthèse (C-28) ; la liste (C-29) ; le programme (C-30) ; la frise (C-27) | D8 |
| **Tâches** | La ligne type d'une tâche, reprise sur « Aujourd'hui », « Tâches », le Rétroplanning et le téléphone (C-34, C-35, C-38, C-77) ; créer depuis la liste, avec ou sans évènement (C-31) ; filtres par évènement, personne, période (C-33, C-32) ; un seul geste pour changer une date (C-36) ; la sélection en lot (C-40) ; l'écran vide (C-37) ; le nom de l'onglet (C-39) | D3 |
| **Prestataires** | La ligne du carnet et ses filtres (C-44, C-43, C-45, C-47) ; rattacher depuis le carnet (C-41) ; les pièces visibles dans la liste et au poste (C-42) ; un seul formulaire de création (C-46) ; la fiche (C-48) ; le poste du budget, téléphone compris (C-49, C-78) ; la relance (C-50) | D9 |
| **Reprise et import** | Une page « reprendre un mariage en cours » : fichiers attendus, ordre, état (C-51, C-59, C-54) ; ce que l'assistant demande au lieu de rejeter (C-52, C-53, C-64) ; l'écran des doublons (C-57) ; la confirmation et le bilan (C-58, C-66) ; la fiche d'un mariage repris : ce qui manque, d'où vient chaque valeur (C-55, C-56, C-61) ; l'aperçu des prestataires retenus (C-62) ; les messages d'erreur (C-60) | D5, D11 |
| **Premiers pas et aide** | La fin de l'assistant et le premier mariage (C-67, C-68) ; l'état vide type (C-69, C-15) ; les visites : quand, sur quoi, comment y revenir (C-01, C-02, C-06) ; l'aide d'écran (C-05) ; le centre d'aide et les tutoriels (C-07, C-10, C-70) | D2, D6 |
| **Paramètres** | Le menu : groupes, rubriques jumelles, ce qui n'est pas un réglage (C-72, C-71, C-73) ; le patron d'un écran de réglage (C-75) ; le téléphone et le zoom (C-79, C-82) ; la recherche (C-74) ; le bouton « Réglages » des écrans (C-11) | D7 |
| **Transverse** (à traiter avec le premier module) | La barre du haut et « Créer » (C-03, C-12, C-81) ; le retour après action et la confirmation (C-09, C-08) ; l'erreur de saisie (C-04) ; le lexique (C-87, C-85, C-86, C-88, C-90) ; les états et les couleurs (C-83, § 8) ; le menu du téléphone (C-84) | D4 |

### Corrections simples, sans maquette

À ranger dans un lot de corrections, sans attendre le Design System.

| Correction | Constat |
| --- | --- |
| Rendre sa largeur au champ « Où ? » du carnet | C-43 |
| « {{terme_clients}} » affiché tel quel dans « Termes des clients » | C-76 |
| Une seule graphie pour « évènement » dans les textes | C-89 |
| « Dernière relance : — » après « Relance notée. » | C-50 |
| « Aucun prestataire ne correspond à ces filtres. » quand aucun filtre n'est posé | C-69 |
| « Aucun modèle de rétroplanning pour l'instant. » sur un mariage qui a ses tâches | C-39 |
| `/import` : citer aussi le PDF des prestataires retenus ; ne pas encadrer « Reprendre mes contacts » quand on importe autre chose | C-51, C-59 |
| Valeurs brutes de l'assistant d'import : « Statut : confirmed », « 2027-06-12 », « Ch&acirc;teau » ; montants de « Champs importés » sans espace des milliers | C-60, C-56 |
| « … et remet rien d'autre. » dans l'annulation d'un import | C-66 |
| Message « (Today.source.vendors) » | C-17 |
| « 6 points » pour sept lignes | C-20 |
| Pastille « 2 en retard » sur deux lignes dans le menu ; adresse du compte coupée | C-13 |
| « Supprimer » coupé au bord du tableau du budget à 1 280 et 1 366 px ; liens coupés sur « Équipe » | C-49, C-75 |
| Astérisque seul sur sa ligne sous « Type d'événement » | C-25 |
| « ⌘K » et « Raccourci : touche N » affichés sur téléphone | C-81 |
| « Revoir la visite » absent du panneau d'aide de « Nouveau prestataire » | C-06 |
| « Survolez », « cliquez » dans les visites lues sur téléphone ; étape de visite sans zone | C-02 |
| Montants hors cadre dans les cartes du budget sur téléphone | C-78 |

### À vérifier dans l'app avant maquette

| Point | Vu par |
| --- | --- |
| Après « Annuler », la tâche cochée revient-elle à sa place dans l'agence ? | PC-03/Nadia, PC-03/Hugo |
| Le menu « Reporter » s'ouvre-t-il vide ou coupé dans le Rétroplanning ? Se ferme-t-il par Échap ? | PC-04/Inès, PC-04/Camille, H-IX-10 |
| « Voir tout le carnet », depuis un poste, pose-t-il un filtre de lieu que « Effacer les filtres » n'enlève pas ? | PC-04/Inès |
| « Modifier » une tâche du Rétroplanning : fenêtre qui n'apparaît qu'après rechargement, date non prise | PC-04/Camille |
| « Prix réel 9 600,00 € » et « Prix final 600,00 € » sur la fiche d'un prestataire | PC-05/Martine |
| Un champ de recherche garde la saisie précédente et la colle à la nouvelle (menu « Ajouter des prestataires », aide) | PC-05/Inès, PC-05/Valérie, PC-08/Clémence |
| Premier clic sans effet sur un onglet de la fiche ; « Suivant » d'une visite sans réaction ; « Fait » sans retour immédiat sur téléphone | PC-09/Inès, PC-07/Clémence, PC-03/Hugo |
| La liste « Choisir un évènement » s'ouvre-t-elle au pouce ? Option coupée (« 9 janvier 20 ») | PC-03/Hugo |
| « Devis signéImmédiat » dans Notifications | PC-07/Valérie |
| Même import daté « 00:27 » sur le bilan et « 00:26 » au journal ; « 16 prestataires placés » pour 25 ; « client » et « cliente » comptés à part | PC-02/Inès, PC-02/Sophie |
| Le carnet, une fois les fiches classées : pastilles par famille, filtre par métier et par étiquette | réserve 4 |
| Un espace né d'une vraie inscription : arrivée sur l'assistant, modèles de départ installés | réserves 2 et 3 |

### À vérifier sur un vrai navigateur français

- Champs de date : « mm/dd/yyyy », « 11/25/2026 », « 12/02/2026 » (lu « 12 février »).
- Bulles de validation : « Please fill out this field. », « Please select an item in the list. », « Please enter a URL. ».
- Champs de fichier : « Choose File », « No file chosen ».
- Calendrier ouvert par un clic sur une date : « January 2027 », « Today », « Clear ».
- Heures du programme : « 05:30 PM » dans le formulaire, « 19:15 » dans la liste.
