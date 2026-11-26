# Maquettes du volet 5 : « Premiers pas et aide » (lot 68, phase 5)

Date : 26/11/2026, par Claude Code. Cinquième volet de l'ordre validé à la porte 2
([06-decisions-porte-2.md](06-decisions-porte-2.md), § 3), après les volets 1 à 4 (notes
[07](07-maquettes-transverse-taches.md), [08](08-maquettes-reprise-import.md),
[09](09-maquettes-aujourdhui-evenements.md), [10](10-maquettes-prestataires.md)). Cette note dit ce qui
est proposé (§ 2), les choix retenus par défaut (§ 3), l'inventaire des fonctions gardées (§ 3 bis), ce
que les maquettes supposent de l'app (§ 4), ce qui a été vérifié dans le code et ce qui ne l'a pas été
(§ 5), et les constats non traités (§ 6). Aucun écran de l'app n'est modifié ; `DESIGN.md` n'est pas
touché.

## 1. Les livrables

Sept pages HTML autonomes dans [`docs/maquette/lot-68/`](../../maquette/lot-68/index.html), au gabarit
des pages 13 à 21 (même feuille de style et mêmes icônes que la page 21, octet pour octet ; un bloc
« Volet 5 » ajouté en fin de feuille), ajoutées au sommaire :

| Page | Contenu | Constats |
| --- | --- | --- |
| [22. L'assistant de démarrage et sa fin](../../maquette/lot-68/22-premiers-pas-assistant.html) | L'assistant d'abord, une question par écran ; la question des mariages en cours ; la table des questions ; « Votre espace est prêt » selon la réponse ; l'assistant interrompu puis repris | C-68 ; D6, R3 |
| [23. Le premier mariage, à l'heure](../../maquette/lot-68/23-premiers-pas-premier-mariage.html) | « Nouvel évènement » depuis la fin de l'assistant ; les échéances déjà passées (déjà fait, à faire, à dater) ; la fiche dix secondes après ; la table des règles | C-67 ; D8, M12, M13 |
| [24. L'état vide type](../../maquette/lot-68/24-premiers-pas-etat-vide.html) | Le gabarit annoté ; rien encore, rien avec ces filtres, tout est passé ; les écrans vides d'un espace neuf, dont « Devis et factures » | C-69, C-15 ; P-05 |
| [25. Les visites](../../maquette/lot-68/25-aide-visites.html) | La visite automatique de l'accueil, posée sur l'état vide ; la ligne « Découvrir cet écran en 1 minute » ; une visite ouverte ; « Revoir la visite » et la table des visites | C-01, C-02, C-06 ; D2 |
| [26. L'aide de l'écran](../../maquette/lot-68/26-aide-ecran.html) | Le panneau du « ? » en blocs ; l'aide d'un formulaire (SIRET) ; l'aide d'un écran vide | C-05, C-06 |
| [27. Le centre d'aide](../../maquette/lot-68/27-aide-centre.html) | La page « Aide » en deux écrans ; une phrase comprise, « importer mes contacts » ; aucune réponse ; les mots de l'aide | C-07, C-10 ; P-15 |
| [28. Les tutoriels et « Pour bien démarrer »](../../maquette/lot-68/28-aide-tutoriels.html) | Les deux parcours de D6 ; un tutoriel en cours ; changer de parcours ; la ligne de l'accueil | C-70, C-10 ; D6 |

Chaque maquette met l'écran d'aujourd'hui (capture du relevé, ou description tirée des journaux PC-01 et
PC-08 et du code quand le relevé n'a pas de capture) à côté de l'écran proposé, en 1 440 et en 375 px,
avec les états vide, rempli et repris là où ils diffèrent. Sous chaque maquette : les constats traités et
les règles de forme de D10.

Formes reprises telles quelles : « Nouvel évènement » et « Où en est-il ? » (page 3, D8, M12, M13), la
fin de l'assistant pour une reprise (page 6, R3), l'état vide de l'accueil (page 13), la liste des
évènements (page 17), le formulaire de création d'une fiche (page 20, V10), la ligne de tâche (volet 1),
les bascules en encre (M8), le message de retour (M5), « non renseigné » (volet 2), les lignes de la page
de reprise (page 6) pour le parcours des tutoriels, la barre du bas du téléphone (D4). Formes nouvelles :
la bulle de visite et son repère encadré, la ligne « Découvrir cet écran », le panneau d'aide rangé à
droite et ses questions qui s'ouvrent en place, la recherche du centre d'aide et sa meilleure réponse.

Données fictives : Camille Roussel, titulaire d'un espace neuf, le mercredi 25 novembre 2026 ;
« Léa & Maxime », samedi 12 juin 2027 (dans 199 jours) ; le rétroplanning de départ des mariages de
`packages/starter-templates/src/retroplanning.json` (18 tâches, de J-365 à J+30), dont huit tombent avant
le 25 novembre (12 juin, 17 juillet, 16 août, 15 octobre et 14 novembre 2026) ; « Juliette & Romain »,
repris d'un tableur (volet 2) ; « Atelier Mimosa », le fleuriste de PC-08. Couleurs : jetons actuels,
répartition A en rôles ; la visite n'emploie aucune teinte de marque (anneau d'encre, fond assombri).

## 2. Ce qui est proposé

**L'assistant de démarrage (page 22).**

- Il s'ouvre seul à la première connexion de la titulaire, avant tout écran et toute visite ; plus de
  bandeau « Reprendre le questionnaire » avant de l'avoir commencé. Interrompu, l'accueil vide le dit d'une
  ligne : « Votre espace n'est pas tout à fait prêt · 2 questions sur 5 restent, environ 1 minute ·
  Continuer les questions ».
- Cinq questions au plus, une par écran, un seul bouton « Continuer » (collé en bas sur téléphone et sur
  un ordinateur bas). « Passer » disparaît.
- Une question nouvelle (D6) : « Avez-vous déjà des mariages en cours ? » (oui ; non, je pars de zéro).
  La question des outils ne se pose qu'après « Oui » et devient « Où les suivez-vous aujourd'hui ? » (les
  mêmes cinq cases, la même colonne en base). Le volume annuel quitte l'assistant (il n'est lu nulle part
  aujourd'hui) et reste un champ des Paramètres.
- La TVA se demande avec les mots des devis : « Vos devis portent-ils la TVA ? » (non ; oui ; je ne sais
  pas encore). Aucune réponse n'est cochée d'avance sur un fait (TVA, mariages en cours, outils) ; le
  métier et les types du métier restent cochés.
- « Votre espace est prêt » : un premier pas, un seul bouton plein, selon les questions 3 et 4 (zéro :
  « Créer votre premier mariage » ; un tableur ou un logiciel : « Reprendre un mariage en cours », page 6 ;
  papier seulement : « Entrer un mariage en cours ») ; dessous, les réponses et ce qu'elles ont préparé,
  chacun avec son lien (« Voir les tâches », « Voir les postes ») ; « Ouvrir un mariage d'exemple » en
  second ; « Modifier mes réponses », « Voir l'accueil ».

**Le premier mariage (page 23).**

- « Créer votre premier mariage » ouvre « Nouvel évènement » (page 3), la seule entrée ; le formulaire en
  ligne et sa case « Partir du rétroplanning » cochée d'avance disparaissent de la fin de l'assistant.
- Pour « Signé, en préparation », la fenêtre annonce le rétroplanning et son compte (« 8 tâches tombent
  avant aujourd'hui »), avec « Changer » (autre modèle, ou aucun). Une étape 2 liste ces huit tâches :
  pour chacune « Déjà fait » ou « À faire », rien de coché, deux liens pour répondre pour toutes ; les
  tâches à faire sont réparties d'ici 2, 4 ou 8 semaines dans l'ordre du modèle, ou laissées à dater ;
  une tâche sans réponse est créée « à dater ». Aucune tâche n'est en retard à sa création.
- Plus de statut ni de source posés d'office ; « Venu par » reste « non renseigné ». Les tâches que le
  modèle donne aux mariés se lisent « Avec les mariés » et ne passent « Attend les mariés » qu'une fois
  leur espace ouvert.
- Pour « Une demande en cours », ni rétroplanning ni étape 2 : la suite dit « Envoyer le devis »
  (page 16) ; le rétroplanning se pose à la signature, avec la même étape.

**L'état vide type (page 24).** Un gabarit, dans cet ordre : un titre qui dit ce qui viendra, une phrase
et un exemple, la seule action principale, l'autre voie (la reprise) en ligne à part, l'aide (le mariage
d'exemple, l'aide de l'écran). Tant que l'écran est vide : ni filtres, ni vues, ni exports, ni charge ;
les commandes de l'en-tête passent au menu « ⋯ » ; aucune visite ni invitation à un tutoriel. Trois
textes distincts : rien encore, rien avec ces filtres (« 0 évènement sur 6 avec ces filtres »), tout est
passé ou fait. Un prérequis manquant devient l'action : « Devis et factures » commence par « Compléter
votre fiche entreprise », qui quitte le bandeau de l'accueil.

**Les visites (page 25), selon D2.**

- Seule la visite de l'accueil se lance seule : une fois, quand l'assistant est fini. Trois bulles au lieu
  de quatre, posées sur l'état vide le premier jour (ou sur l'écran rempli si le premier mariage existe
  déjà) : « Votre journée, ici », « Commencez ici », « L'aide de chaque écran ».
- Sur les autres écrans qui ont une visite : une ligne « Découvrir cet écran en 1 minute », sous
  l'en-tête, aux trois premières venues ou jusqu'à ce qu'elle soit ouverte ou fermée ; jamais sur un
  écran vide ; aucun bouton plein. La carte « Découvrir en N minutes » et son « Commencer le tutoriel »
  disparaissent des écrans.
- Une bulle encadre un élément visible, en dit l'usage en deux phrases, avec les mots de l'appareil
  (« Touchez » sur téléphone) ; trois ou quatre bulles par visite ; « Précédent », « Suivant », «
  Terminer » à la dernière ; une croix « Fermer la visite » à chaque bulle remplace « Passer la visite ».
  Sur téléphone, la bulle se colle en bas et l'élément encadré reste visible.
- « Revoir la visite de cet écran » est la première ligne du « ? » de chaque écran qui a une visite.
  « Tâches » en reçoit une ; un formulaire n'en a pas et ne la promet nulle part.

**L'aide de l'écran (page 26).** Un panneau de 420 px rangé à droite, l'écran resserré à côté (sous
1 100 px, posé par-dessus, hauteur de la fenêtre, jamais coupé ; sur téléphone, plein écran défilable).
Titre : « Aide · » et le nom de l'écran. Dans cet ordre : la visite, « Sur cet écran » (ou « Pour
commencer » à l'écran vide), les questions fréquentes qui s'ouvrent en place, « Une autre question ? »
qui cherche dans le centre d'aide sans quitter l'écran, puis les liens (l'article, le tutoriel). Le « ? »
d'une fenêtre ouvre l'aide de la fenêtre : une question par champ difficile (« Qu'est-ce que le SIRET ?
Faut-il le remplir ? »), et la saisie reste intacte.

**Le centre d'aide (page 27).** La recherche en tête ; « Pour bien démarrer » où la planner en est ;
« Pour découvrir » (les visites, le mariage d'exemple, les tutoriels) ; les sujets, une ligne chacun avec
leur nombre d'articles ; l'interrupteur « Proposer la visite d'un écran à sa première ouverture » ; les
raccourcis clavier derrière un lien. Deux écrans au lieu de 12 000 px. La recherche lit une phrase (mots
vides écartés, synonymes de la planner), dit ce qu'elle a compris, rend une meilleure réponse lisible sans
l'ouvrir, avec le bouton de l'écran concerné, puis quatre autres au plus. Un seul mot : « article ».
Quatre mots pour l'aide : visite, tutoriel, mariage d'exemple, aide.

**Les tutoriels (page 28), selon D6.** Deux parcours choisis par la question 3 de l'assistant, la page
gardée dans sa forme (étapes numérotées, durées, états). « Je reprends mes mariages en cours » : reprendre
un mariage, compléter un mariage repris, vos prestataires, le rétroplanning et le programme, devis et
factures. « Je pars de zéro » : créer votre premier mariage, son rétroplanning, ses prestataires, devis et
factures. Les onze tutoriels d'aujourd'hui sont tous rangés ; les autres sous « Autres tutoriels ». « Pour
bien démarrer » (accueil, « Aide ») et ce parcours ne font qu'une liste. Plus de pastille « 0/11 » au
menu ; « Conseillé ensuite » devient « Ensuite ». « Changer de parcours » dans un panneau.

## 3. Les choix, retenus par défaut

**Règle de Julien du 26/11/2026** (rappelée en [09, § 3](09-maquettes-aujourdhui-evenements.md)) : les
propositions des nouvelles maquettes sont retenues par défaut et priment sur les décisions antérieures
qu'elles contredisent ; on vérifie qu'aucune fonction majeure ne disparaît (§ 3 bis) ; l'ergonomie cible
est celle des maquettes. Les dix-sept choix ci-dessous sont donc **retenus tels que proposés**, sauf avis
contraire de Julien. L'autre voie est donnée pour mémoire.

Décisions antérieures que ce volet contredit ou complète, la maquette l'emportant :

- **Page 13 (volet 3)** : « Pour bien démarrer · 0 sur 3 » (créer un mariage, prestataires, fiche
  entreprise) devient le parcours de D6, en quatre ou cinq étapes selon la réponse (B15) ; la fiche
  entreprise y devient la première marche de « Devis et factures ».
- **R3 (volet 2)** : complété, pas renversé. La fin de l'assistant suit d'abord la question nouvelle
  (B3) ; R3 s'applique ensuite (tableur ou logiciel : reprise), et une troisième issue s'ajoute pour des
  mariages suivis sur papier seulement (« Entrer un mariage en cours »).
- **Page 6 (volet 2)** : la fin de l'assistant pour une reprise est gardée ; elle reçoit, comme la
  variante « zéro », le récapitulatif des réponses et « Ouvrir un mariage d'exemple » en second (B6, B13).
- **§ 6 de la synthèse** (« une réponse cochée d'avance » est aimée) : gardé pour le métier et les types,
  abandonné pour les faits sur la planner (B4), dans la ligne de M13.

| # | Question | Où regarder | Proposition retenue | L'autre voie |
| --- | --- | --- | --- | --- |
| B1 | Quand l'assistant de démarrage s'ouvre-t-il ? (C-68) | Page 22, « Les questions » et « Interrompu » | Seul, à la première connexion, avant tout écran ; interrompu, une ligne sur l'accueil, « Continuer les questions » | Garder l'arrivée sur l'accueil et le bandeau, renommé « Préparer votre espace » |
| B2 | Quelles questions ? (C-68, D6) | Page 22, table | Métier, évènements, mariages en cours, outils (après « Oui »), TVA ; le volume sort | Garder les cinq d'aujourd'hui et ajouter la question des mariages en cours (six) |
| B3 | Comment choisir le parcours de D6 ? | Page 22 ; page 28 | Une question explicite, « Avez-vous déjà des mariages en cours ? » | Le déduire de la réponse aux outils (R3 seul), sans question de plus |
| B4 | Des réponses cochées d'avance ? (C-68) | Page 22 | Oui pour le métier et les types ; non pour la TVA, les mariages en cours, les outils | Garder les valeurs proposées d'aujourd'hui (franchise, « De 11 à 25 ») |
| B5 | « Continuer » et « Passer » (C-68) | Page 22 | Un seul bouton ; « Je ne sais pas encore » comme réponse à la TVA, qui garde la franchise et redemande avant le premier devis | Garder « Passer » seulement quand rien n'est coché |
| B6 | La fin de l'assistant (C-68, C-67) | Page 22, « La fin » | Un premier pas, les réponses et ce qu'elles ont préparé avec leurs liens ; plus de formulaire en ligne, la fenêtre « Nouvel évènement » | Garder le formulaire en ligne, sans case cochée d'avance |
| B7 | Les échéances déjà passées d'un mariage créé (C-67) | Page 23, « Les échéances passées » | Une étape 2 : déjà fait ou à faire, rien de coché ; à faire redaté d'ici 4 semaines (2 ou 8, ou à dater) ; sans réponse, « à dater » | Toutes créées « à dater » sans question ; ou toutes redatées d'office |
| B8 | Les tâches des mariés (C-67) | Page 23, « La fiche » et table | « Avec les mariés » ; « Attend les mariés » seulement une fois leur espace ouvert | Garder « Tâche confiée au client », sans « Attend le client » à la création |
| B9 | Ce qui entoure un écran vide (C-69) | Page 24, « Le gabarit » | Ni filtres, ni vues, ni exports ; commandes de l'en-tête au menu « ⋯ » ; un seul bouton plein | Les garder, désactivés, avec une bulle « disponible avec le premier évènement » |
| B10 | La visite de l'accueil (D2, C-02) | Page 25, « L'accueil » | Trois bulles, le texte selon l'état (vide ou rempli), après l'assistant | Garder les quatre bulles d'aujourd'hui, corrigées |
| B11 | La ligne « Découvrir cet écran » (D2, C-01) | Page 25, « La ligne » | Aux trois premières venues, ou jusqu'à ouverture ou fermeture ; jamais sur un écran vide | Une seule fois, à la première venue |
| B12 | « Passer la visite » (C-02) | Page 25, la bulle | Remplacé par la croix « Fermer la visite » à chaque bulle | Garder « Passer la visite » sur les bulles qui ne sont pas les dernières (lot 69) |
| B13 | Essai guidé et exemple (C-10) | Pages 22, 24, 27 | Un seul « mariage d'exemple », 30 jours, supprimable ; « Essai guidé » (24 h) disparaît | Garder les deux, renommés « essai de 24 heures » et « exemple de 30 jours » |
| B14 | L'aide de l'écran (C-05) | Page 26 | Panneau en blocs, questions qui s'ouvrent, recherche intégrée ; aide propre aux fenêtres | Garder le paragraphe, raccourci, et ajouter en dessous les liens et « Revoir la visite » |
| B15 | « Pour bien démarrer » et les tutoriels (C-10, C-70) | Page 28 | Une seule liste : le parcours de D6, sur l'accueil, dans « Aide » et dans « Tutoriels » ; plus de compteur au menu | Garder la liste de l'accueil à part (trois actions) et le parcours dans « Tutoriels » |
| B16 | Le centre d'aide (C-07) | Page 27 | Recherche par phrase et synonymes, meilleure réponse ; sujets en lignes ; vignettes retirées ; « article » | Garder les vignettes, repliées par rubrique, et corriger seulement la recherche |
| B17 | Une visite pour « Tâches » (C-06) | Page 25, table | Oui, trois bulles, proposée par la ligne | Pas de visite ; son « ? » ne la promet pas |

## 3 bis. Aucune fonction majeure ne disparaît

Inventaire, écran par écran, de ce que l'app fait aujourd'hui (lu dans le code, § 5) et de l'endroit où
les maquettes le placent.

| Écran | Fonction d'aujourd'hui | Dans les maquettes |
| --- | --- | --- |
| Assistant (`app/demarrage/`) | Réservé à la titulaire ; message « La Propriétaire du compte prépare votre espace » pour une collègue | Gardé (page 22, règles ; non dessiné) |
| Assistant | Fil d'étapes cliquable en arrière, « Question n sur 5 », « Question précédente » | « Question n sur 5 » et barre d'avancement ; « Question précédente » ; le retour à une question passe par « Modifier mes réponses » à la fin |
| Assistant | Métier (et « Précisez votre métier »), types d'évènements, TVA, volume, outils | Métier, types, TVA, outils gardés ; volume aux Paramètres (B2) ; question des mariages en cours ajoutée |
| Assistant | Effets : modèles de départ, types, régime de TVA à la date du jour, modèle de devis | Inchangés ; listés à la fin (« Préparé pour vous ») |
| Reprise de l'assistant | Bandeau « Terminez la préparation… Reprendre le questionnaire » | Ligne « Votre espace n'est pas tout à fait prêt · Continuer les questions » (page 22) |
| « Votre espace est prêt » | Récapitulatif (types, tâches, postes, TVA), « Ouvrir les Paramètres » | Récapitulatif complété, avec liens ; « Modifier mes réponses » ; la phrase sur les Paramètres gardée |
| « Votre espace est prêt » | Formulaire « Créer mon premier évènement » (type, prénoms, date, case du rétroplanning) | « Créer votre premier mariage » ouvre « Nouvel évènement » (page 23) : type, nom, date, client, rétroplanning annoncé |
| « Votre espace est prêt » | « Explorer avec un exemple », « Ouvrir l'exemple » / « Revoir l'exemple » | « Ouvrir un mariage d'exemple » (B13) ; « Revoir l'exemple » quand il existe (non dessiné) |
| « Votre espace est prêt » | Sans module Évènements : « … liste de prise en main de l'accueil », « Aller à l'accueil » | Gardé (non dessiné) |
| Assistant « L'essentiel » (`demarrage/essentiel`) | Six étapes (société, adresse, logo, TVA, banque, numérotation), « Finir plus tard » | Gardé tel quel ; ouvert depuis l'étape « Devis et factures » et l'état vide de « Devis et factures » (pages 24, 28) |
| Création d'un évènement | Trois modes (prospect, évènement, client existant) ; case du rétroplanning ; « Voir les tâches » (J-n) ; modèle à créer si absent ; brouillon gardé ; alerte « même jour » | Une fenêtre (D8, page 3) ; rétroplanning annoncé, « Changer » ; étape 2 des échéances passées ; « Voir les tâches » dans « Changer » ; brouillon et alerte gardés (non dessinés) |
| Fiche après le premier évènement | Proposition de supprimer l'exemple (« Supprimer l'exemple », « Le garder pour l'instant ») | Gardée (page 23, règles ; non dessinée) |
| Visites (`page-tour.tsx`, `lib/help/`, `guided-tour.tsx`, `tours.json`) | Six visites (accueil 4, liste 5, fiche 5, carnet 4, catalogue 3, paramètres du budget 3), automatiques à la première venue | Les six gardées, raccourcies ; accueil seul automatique ; « Tâches » en reçoit une (B10, B11, B17) |
| Visites | Bulle : « n sur N », Précédent, Suivant, Terminer, Passer ; Échap ; zone éclairée ; bulle en bas sur téléphone | Gardés ; « Passer » devient la croix (B12) |
| Visites | Visites vues en base par personne ; préférence par cookie ; `?visite=revoir` | Gardés ; la préférence devient « Proposer la visite d'un écran à sa première ouverture » (page 27) |
| Invitation aux tutoriels (`help-bar.tsx`) | Carte « Découvrir en N minutes », « Commencer le tutoriel », « Plus tard » | Retirée des écrans (B11) ; les tutoriels restent dans « Tutoriels », « Aide » et les liens du « ? » de l'écran concerné |
| Aide de l'écran (`help-button.tsx`, `screen-help.tsx`, `help-drawer.tsx`) | « ? » et touche « ? », titre, paragraphe, « Revoir la visite », bloc propre à l'écran (« Essai guidé » sur `/events`), Échap, renvoi au centre d'aide sans aide propre | Gardés et restructurés (B14) ; le bloc « Essai guidé » devient « Ouvrir un mariage d'exemple » |
| Centre d'aide (`app/aide/`) | Recherche ; rubriques et 125 fiches (capture, titre, texte, « Visite faite » / « À découvrir ») ; carte de progression ; case des visites ; raccourcis clavier | Recherche refaite (B16) ; rubriques en sujets ; les fiches deviennent des articles, ouverts depuis la recherche ou un sujet ; progression dans « Pour bien démarrer » ; case et raccourcis gardés |
| Fiche d'écran du centre d'aide | Capture, texte, « Ouvrir cet écran », « Revoir la visite sur l'écran », étapes de la visite, questions fréquentes | Gardée comme page d'article (non redessinée) ; ses questions fréquentes nourrissent le « ? » de l'écran |
| Recherche du haut et palette | Groupe « help » (tutoriels, écrans) ; action « Aide » | Gardés ; même moteur que le centre d'aide |
| Tutoriels (`app/tutoriels/`, `lib/help/catalog.ts`, `journey.ts`, `tutorials.ts`) | Onze tutoriels en cinq étapes et « Autres » ; tuiles Fait, En cours, Conseillé ensuite, À faire ; « Tutoriels faits », minutes restantes | Les onze gardés, rangés en deux parcours (B15) ; états gardés, « Ensuite » ; minutes restantes gardées |
| Déroulé d'un tutoriel et panneau latéral | Exemple « Essai » effacé à la fin ou après 24 h ; un seul en cours ; « Reprendre », « Quitter le tutoriel (l'exemple est supprimé) » ; « Prochain tutoriel conseillé » ; retour à l'écran d'origine | Gardés (page 28, « En cours » ; déroulé non redessiné) ; « Prochain tutoriel conseillé » suit le parcours |
| Menu | « Tutoriels » avec pastille « n/11 », « Aide », « Apps » | « Tutoriels » et « Aide » gardés, sans pastille ; « Tous les modules » |
| Accueil, « Pour bien démarrer » (`onboarding-checklist.tsx`) | Deux éléments (« Régler l'essentiel », « Ajouter un premier prestataire »), coche, disparaît une fois fini | Le parcours de D6, même règle de coche par le geste fait ; les deux éléments en deviennent des marches (page 28) |
| Accueil | Bandeau « Votre fiche entreprise n'est pas encore complète. La compléter » | Retiré ; la fiche est l'action de l'état vide de « Devis et factures » et une marche du parcours (pages 24, 28) |
| Essai guidé (`events/page.tsx`) | Carte sous la liste vide et bloc du « ? » ; « Démarrer l'essai », « Reprendre l'essai en cours » ; 24 h | Fondu dans le mariage d'exemple (B13) : même contenu (budget, rétroplanning, programme), même bannière |
| Exemple | Bannière « Exemple — données fictives », « À essayer », « Supprimer l'exemple et ses données », « Essayer un devis fictif » ; étiquette « Exemple » ; filigrane « Document fictif » ; série DEMO | Gardés ; « Ouvrir un devis d'exemple » sur l'état vide de « Devis et factures » |
| États vides (`ui/empty-state.tsx`) | Évènements et carnet : titre, texte, exemple, « Créer… », « Lire l'aide » ; carnet : variante sans types | Gabarit gardé et généralisé (page 24) ; la variante sans types reste (page 18) |
| Exploitation | `/exploitation/prise-en-main` : avancement des visites et tutoriels par compte | Non touchée |

## 4. Ce que les maquettes supposent du comportement de l'app

À spécifier au lot de réalisation, pas à décider ici. Entre parenthèses, l'état actuel lu dans le code.

- **L'assistant d'abord** : la première connexion de la titulaire mène à `/demarrage` (aujourd'hui à
  l'accueil, avec la visite et le bandeau) ; la visite de l'accueil attend la fin de l'assistant.
- **Une réponse « mariages en cours »** enregistrée dans le profil de l'organisation (nouveau champ) ; la
  question des outils conditionnée à « Oui » ; `annualEventVolume` déplacé dans les Paramètres (aujourd'hui
  enregistré, lu nulle part).
- **Des réponses sans valeur par défaut** pour la TVA (aujourd'hui `vatRegime: franchise` dans
  `onboarding.json`) ; « Je ne sais pas encore » garde la franchise et pose un drapeau que l'étape « Devis et
  factures » et l'assistant « L'essentiel » relisent.
- **La fin de l'assistant** : son bouton ouvre la fenêtre de création (aujourd'hui `first-event-form.tsx`,
  qui confirme toujours l'évènement et prend la première source de la liste) ; `replacedTools` sert enfin
  (aujourd'hui il ordonne une liste dont les règles sont vides).
- **Les échéances passées** : à la création (ou à l'application d'un modèle), calcul des tâches dont
  `dueDateFor` tombe avant aujourd'hui ; une étape qui les demande ; pour « déjà fait », une tâche faite
  sans date de fin ; pour « à faire », une date redistribuée (jours de semaine, ordre du modèle, avant la
  tâche suivante) ; pour « sans réponse », une tâche sans échéance (le modèle permet déjà `offsetDays`
  nul, donc une échéance nulle) affichée « à dater », comptée à part et jamais en retard.
- **Les tâches des mariés** : « Attend les mariés » seulement si leur espace est ouvert ; avant, « Avec
  les mariés » (aujourd'hui `Today.words.clientTask`, « Tâche confiée au client », dès la création).
- **Les visites** : un drapeau par visite (`automatique` pour l'accueil seulement) ; une ligne proposée
  avec un compteur de venues par personne et par écran (trois) ; une condition « écran non vide » ; des
  textes par état (vide, rempli) et par appareil (tactile ou non) ; une visite pour « Tâches » ; bulles
  ramenées à trois ou quatre dans `tours.json`.
- **L'invitation aux tutoriels** (`HelpBar`) retirée des écrans ; ses liens passent dans le bloc « Liens »
  du « ? » et dans le parcours.
- **L'aide de l'écran** : un panneau structuré (visite, lignes, questions fréquentes, recherche, liens)
  alimenté par les fiches d'écran du centre d'aide (`Help.<clé>.faq`) ; une aide propre aux fenêtres (un
  « ? » dans leur en-tête) ; des textes « Pour commencer » pour les écrans vides ; un comportement sous
  1 100 px qui ne coupe jamais le panneau.
- **La recherche** : mots vides écartés, synonymes en données traduisibles (comme
  `import-synonyms.json`), classement par titre puis texte, « compris : … », une meilleure réponse avec un
  résumé en étapes et le lien de l'écran (aujourd'hui `foldSearchText` et une recherche par sous-chaîne
  côté client). Aucun service extérieur.
- **Les parcours** : deux listes `JOURNEY` choisies par la réponse « mariages en cours », et un choix
  modifiable ; une étape cochée par le geste fait dans l'espace (comme `checklist.ts` aujourd'hui) ; la
  liste de l'accueil fondue dans le parcours ; la pastille du menu retirée.
- **Un seul mariage d'exemple** de 30 jours, au contenu de l'essai guidé (`demo-event.json`,
  `example-event.json` à fondre).
- **Le tutoriel « Compléter un mariage repris »** : à écrire, ou la fiche d'un évènement jouée sur un
  exemple repris.
- **« Nouveau devis » sans fiche entreprise complète** : la maquette suppose qu'un devis s'enregistre et ne
  part qu'une fois la fiche complète ; non vérifié dans le code.

## 5. Ce qui a été vérifié dans le code, et ce qui ne l'a pas été

Lu dans la branche du volet 4 (`dae41e44`, au-dessus des volets 3 et 4), sans lancer l'app. L'inventaire
a été fait par lecture de code (un agent d'exploration, puis des contrôles directs pour les lignes
marquées « relu »).

| Affirmation des maquettes | Vérifié | Où |
| --- | --- | --- |
| Cinq questions, valeurs proposées `wedding_planner`, `franchise`, `11_to_25`, aucun outil | Oui, relu | `packages/starter-templates/src/onboarding.json` (`defaults`) |
| « Passer » garde la réponse proposée ; bouton « Voir mon espace » à la fin | Oui | `app/demarrage/question-forms.tsx`, `fr.json` (`Onboarding`) |
| `annualEventVolume` n'est lu qu'à l'assistant et dans le profil | Oui, relu | `app/demarrage/page.tsx`, `actions.ts`, `modules/hub/service.ts`, `packages/db/src/schema/hub.ts` |
| Bandeau « Reprendre le questionnaire » et bandeau « fiche entreprise » sur l'accueil | Oui | `app/page.tsx` |
| Fin de l'assistant : récapitulatif, formulaire, case cochée, exemple de 30 jours ; évènement toujours confirmé, première source | Oui | `app/demarrage/pret/page.tsx`, `first-event-form.tsx`, `actions.ts` |
| Échéance = date de l'évènement + décalage ; décalage nul possible | Oui, relu | `modules/events/template-rules.ts` (l. 16 et 69) |
| Rétroplanning de départ : 18 tâches, 9 aux mariés, de J-365 à J+30 | Oui, relu | `packages/starter-templates/src/retroplanning.json` |
| Six visites : accueil, liste, fiche, carnet, catalogue, paramètres du budget | Oui, relu | `packages/starter-templates/src/tours.json` |
| Visite automatique à la première venue ; préférence par le cookie `symbola_visites_auto` | Oui, relu | `app/page-tour.tsx`, `lib/help/preferences.ts` |
| Bulle : Précédent, Suivant, Terminer, Passer la visite | Oui, relu | `packages/ui/src/guided-tour.tsx` |
| Carte « Découvrir en N minutes » et « Commencer le tutoriel » | Oui | `app/help-bar.tsx` |
| Tiroir d'aide : titre, paragraphe, « Revoir la visite » si visite, bloc propre ; pas de questions fréquentes | Oui | `app/help-button.tsx`, `app/screen-help.tsx`, `packages/ui/src/help-drawer.tsx` |
| Centre d'aide : recherche par sous-chaîne sans accents ; 125 fiches ; « Écrans trouvés » ; carte de progression | Oui | `app/aide/page.tsx`, `aide-search.tsx`, `lib/help/screens.ts` |
| Onze tutoriels, cinq étapes et « Autres tutoriels », import en dernier ; aucun lien avec l'assistant | Oui, relu (`JOURNEY`) | `lib/help/catalog.ts`, `lib/help/journey.ts` |
| Pastille « n/11 » de « Tutoriels » au menu | Oui | `app/app-shell.tsx` |
| « Pour bien démarrer » : deux éléments | Oui | `app/accueil/onboarding-checklist.tsx`, `lib/onboarding/checklist.ts` |
| Essai guidé de 24 h sur « Évènements » ; exemple de 30 jours | Oui | `app/events/page.tsx`, `demo-event.json`, `example-event.json` |
| États vides d'« Évènements » et du carnet (textes) | Oui | `app/ui/empty-state.tsx`, `app/prestataires/page.tsx` |

**Non vérifié** : rien n'a été vu dans l'app en marche ; les captures « aujourd'hui » sont celles du
relevé, d'avant le lot 69. Le rendu du tiroir d'aide sur téléphone et à 150 % (lu dans les journaux de
PC-08, pas dans le CSS). Le contenu des questions fréquentes de chaque fiche d'écran : la maquette en donne
des exemples. Le texte des étapes de chaque tutoriel. Si un devis peut s'enregistrer sans fiche
entreprise complète. Les nombres d'articles par sujet de la page 27 regroupent les rubriques d'aujourd'hui
(« Évènements » 36 partagé entre « Évènements et programme » et « Tâches », « Import et données
personnelles » 21 partagé en deux) : ce sont des exemples. Les titres de deux tutoriels sont écrits avec
le lexique des maquettes (« poste » pour « ligne du budget », « mariés » pour « clients »). Le lot 69 a
déjà ôté « Passer la visite » de la dernière bulle.

**Contrôlé dans le navigateur** (serveur local, Chromium du volet d'aperçu à 1 600 × 1 000 et à 375 px,
plus des captures en taille réelle de chaque cadre « Proposé » par Chromium sans écran) : chaque cadre
regardé à 1 440 et à 375 px. Par script, sur les sept pages et le sommaire : toutes les captures chargées,
aucun débordement de côté dans les cadres de 375 px, aucune commande de moins de 44 px dans ces cadres,
aucun libellé de bouton coupé, aucune espace simple dans les guillemets ou devant « : ; ? ! ». La feuille
de style et les icônes de la page 21 sont reprises octet pour octet (contrôle par script), le bloc du
volet 5 ajouté à la fin. Corrigé après ces contrôles : une bulle de l'accueil qui cachait « Pour bien
démarrer » (le défaut même de C-02), une classe du volet 5 qui en recouvrait une existante (le champ de
recherche décalé), les onglets d'une fiche qui débordaient à 375 px, les bascules « Déjà fait » / « À
faire » à 40 px, les titres des tâches soulignés dans l'étape 2, la liste des prochaines actions trop
étroite, un exemple « aucune réponse » qui citait un article, les sujets non reconnaissables comme liens.

## 6. Constats non traités, et pourquoi

| Constat | Pourquoi | Où il sera traité |
| --- | --- | --- |
| C-82 (menu coupé à 911 × 512 : « Aide », « Tutoriels » hors de la fenêtre) | Question du menu entier | Volet « Paramètres » (menu, téléphone, zoom) |
| C-11 (bouton « Réglages » des écrans) | Hors aide | Volet « Paramètres » |
| C-81 (« ⌘K » sur téléphone) | Corrigé ou à corriger hors maquette ; les raccourcis restent derrière un lien, ordinateur seulement | Corrections simples |
| C-89 (deux graphies d'« évènement ») | Correction simple ; les maquettes n'emploient que « évènement » | Lot 69 |
| Brouillon retrouvé seulement en revenant en arrière (PC-08/Sophie) ; saisie perdue (PC-08/Clémence, coupure technique en partie) | Comportement des brouillons, pas de l'aide ; la maquette dit seulement que l'aide ne fait rien perdre | Lot de réalisation, si le Design System le demande |
| « Prénom du premier marié » pour une mariée, pas de nom de famille (PC-01) | Réglé par la fenêtre de D8 (« Nom de l'évènement ») et la fiche des mariés ; la fiche des mariés n'est pas redessinée | Volet 3 (page 16) |
| Champs de date à l'américaine (« mm/dd/yyyy ») | À vérifier sur un vrai navigateur français (§ 9 de la synthèse) | Hors maquette |
| Le déroulé d'un tutoriel et son panneau latéral | Aucun constat du panel ; non redessinés | — |
| Un contact du support dans le centre d'aide | L'app n'en a pas ; en ajouter un est une décision d'exploitation, pas une forme | Question ouverte pour Julien |
| Paramètres du budget et catalogue des devis (leurs visites) | Gardées, raccourcies ; écrans hors de ce volet | Volet « Paramètres » ; module devis |

## 7. Limites

- Maquettes statiques ; **aucun rejeu par le panel** (non demandé). Rien ne dit qu'une planner comprend
  « à dater » sans aide, ni qu'elle répond aux huit échéances passées sans hésiter ; la question « Avez-vous
  déjà des mariages en cours ? » n'a été lue par aucun profil.
- Les cadres sont dessinés dans un navigateur Chromium aux polices du système (Inter et Space Grotesk si
  installées) ; les hauteurs mesurées changent de quelques pixels avec d'autres polices.
- Les pages sont produites par un petit générateur hors du dépôt, qui reprend octet pour octet la feuille
  de style et les icônes de la page 21 et y ajoute les formes du volet 5 (bloc commenté en fin de feuille),
  toutes aux jetons de `DESIGN.md`. Les pages des volets 1 à 4 ne sont pas touchées ; seul le sommaire
  change.

## 8. La porte 3 de ce volet

Les dix-sept choix B1 à B17 sont retenus par défaut selon la règle du 26/11/2026. Julien peut en
renverser un en citant son numéro ; les maquettes seront alors corrigées. Les formes de ce volet
rejoignent ensuite le Design System (phase 6) avec celles des volets 1 à 4.
