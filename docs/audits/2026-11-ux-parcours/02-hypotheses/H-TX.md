# H-TX — Textes, aide et premiers pas (lot 68, phase 2)

Racine des preuves : `(captures hors dépôt)/`.
`nav/spec-TX/NNN.jpg` = capture de mon navigateur ; « texte après NNN » = texte visible rendu par la
commande `text` juste après cette capture ; `releve/<état>/shots/…` = capture du relevé ; `releve.json` =
mesures du relevé (`grid.commandLabels`) ; `fr.json` = `packages/i18n/src/messages/fr.json` ; `tours.json` =
`packages/starter-templates/src/tours.json` (textes des visites).

## 1. Ce que j'ai regardé

**Dans l'app, compte tout neuf `spec-TX-1@exemple.test`, 1 440 × 900** : l'accueil avant l'assistant (visite
ouverte, bandeau « il reste 5 questions »), les cinq questions de `/demarrage`, « Votre espace est prêt »,
le formulaire envoyé vide puis rempli, la fiche du premier évènement (visite de cinq étapes, texte entier de
la Synthèse), l'accueil après le démarrage, `/events` (visite, menu « Nouveau », bandeau de tutoriel, aide
« ? »), `/taches` (aide « ? »), `/aide` (une recherche). **En 375 × 812** : la visite du carnet de
prestataires (quatre étapes) et le haut du carnet. **Compte repris `martine.vasseur@exemple.test`,
1 440 px** : `/import`, la carte « Reprendre mes événements », l'envoi sans fichier, l'envoi d'un PDF qui
n'est pas une fiche d'évènement (bilan de l'assistant, abandon), la liste, la fiche du mariage repris,
l'onglet « Budget et prestataires » et son bloc « Reprendre les prestataires retenus (PDF) ».
**Captures du relevé lues** : espace vide (accueil, tâches, évènements, prestataires, tutoriels, aide),
espace repris (`/import`), assistant d'import (types, rapprochements). **Fichiers lus** : libellés de
commande des 294 relevés, `fr.json` (10 489 chaînes ; comptes de variantes ; 151 aides d'écran), `tours.json`.
En tout environ 35 captures lues et environ 80 commandes de navigateur (au-delà du budget : une sur trois est une lecture de texte, sans capture lue).

**Pas regardé** : les Paramètres écran par écran (je n'en ai que les libellés de commande) ; les étapes
« Colonnes » et « Lignes » de l'assistant d'import dans l'app ; la reprise d'un programme en PDF ; le
contenu d'un tutoriel ; les messages après modification ou suppression ; la taille 911 × 512 ; les visites
du catalogue et du budget. Mon navigateur s'ouvre déjà connecté sur `/` : je n'ai pas vu la redirection
d'une vraie inscription vers `/demarrage` (le code la prévoit, `app/auth/callback/route.ts`). Les bulles
d'erreur du navigateur s'affichent en anglais dans mon navigateur d'essai : leur langue n'est pas un constat.

## 2. Hypothèses

### H-TX-01 — Le premier mariage naît avec cinq tâches « en retard »
- Écran et taille : `/demarrage/pret` → `/events/[id]`, puis `/` et `/taches`, compte neuf, 1 440 px
- Constat : je crée « Inès & Théo », mariage du 18/09/2027, case « Partir du rétroplanning (18 tâches) » cochée par défaut. Deux secondes après, la fiche affiche « Définir le budget global — En retard de 68 jours — Attend le client », le menu « Tâches · 5 en retard », l'accueil « 5 points demandent votre attention », la santé « À surveiller ». Aucun texte ne dit que ces dates viennent du modèle.
- Preuve : `nav/spec-TX/031.jpg`, `nav/spec-TX/045.jpg` ; texte après `nav/spec-TX/037.jpg`
- Gravité présumée : bloque
- Qui bute : toute nouvelle planner, à sa première minute. Elle lit qu'elle est en faute dans un outil qu'elle n'a pas encore utilisé. Celle qui reprend un mariage en cours lit en plus des retards sur des choses déjà faites.
- Principe candidat : un objet que l'on vient de créer n'est jamais « en retard » ; une date calculée par un modèle et déjà passée se dit « à replacer », avec un geste pour tout replacer en une fois.

### H-TX-02 — L'assistant demande ce que l'on remplace, puis ne propose pas de le reprendre
- Écran et taille : `/demarrage` question 5, `/demarrage/pret`, `/` (liste « Pour bien démarrer »), 1 440 px
- Constat : je coche « Un tableur (Excel, Google Sheets…) » et « Un autre logiciel de gestion ». L'écran promet « Ce qui vous fera gagner le plus de temps passera en premier ». « Votre espace est prêt » offre ensuite deux choix : « Créer mon premier évènement » et « Explorer avec un exemple ». Aucun « Reprendre mes données ». La liste « Pour bien démarrer » de l'accueil n'en parle pas non plus.
- Preuve : `nav/spec-TX/021.jpg`, `nav/spec-TX/023.jpg`, `nav/spec-TX/024.jpg`
- Gravité présumée : bloque
- Qui bute : la planner qui arrive avec douze mariages en cours dans un autre outil : le parcours central du lot. Elle crée son mariage à la main, ou conclut que la reprise n'existe pas. L'entrée existe pourtant, dans Paramètres › Prestataires et données › Importer.
- Principe candidat : une question posée change la suite à l'écran ; si elle ne change rien, on ne la pose pas.

### H-TX-03 — Un PDF qui n'est pas le bon : « trop de pages pour une fiche », « corrigez dans votre tableur »
- Écran et taille : `/import?type=event_sheets` → `/import/[id]/confirmation`, compte repris, 1 440 px
- Constat : dans « Reprendre mes événements », je dépose le PDF du programme du jour J (erreur plausible : quatre PDF sortent du même logiciel). Aucun message au dépôt. J'arrive à l'étape 4 : « Colonnes — 19 colonnes reconnues, 4 en note sur la fiche, 2 ignorées », « Colonnes gardées en note : Note, Total Payé, Solde, Total », « Ligne rejetée (1) — Téléchargez le rapport pour les corriger dans votre tableur, puis réimportez-les », motif « trop de pages pour une fiche », puis en rouge « L'import ne peut pas encore être confirmé : aucune ligne à importer. » Seules sorties : « Retour » et « Abandonner l'import ».
- Preuve : `nav/spec-TX/065.jpg` ; texte après `nav/spec-TX/065.jpg`
- Gravité présumée : freine
- Qui bute : la planner peu à l'aise. Rien ne lui dit « ce PDF est un programme : il se reprend dans l'onglet Programme du mariage ». On lui parle de colonnes et de tableur pour un PDF. « Pas encore » laisse croire qu'il suffit d'attendre.
- Principe candidat : une erreur dit ce que l'app a reconnu, pourquoi elle ne peut rien en faire, et où aller à la place ; un message ne cite jamais un objet (colonne, tableur) que l'utilisatrice n'a pas manipulé.

### H-TX-04 — `/import` dit ce que devient une ligne, pas ce que devient un mariage en cours
- Écran et taille : `/import`, compte repris, 1 440 px
- Constat : quatre cartes : « Reprendre mes contacts », « mes prestataires », « mes événements », « Un autre fichier ». Chaque texte décrit un fichier (« Chaque ligne devient une fiche du carnet… les critères deviennent des étiquettes, les prestations vont dans la note. Les types sont rapprochés des vôtres ou créés »). Pour un mariage : « mariés et leurs coordonnées, date, lieux et horaires, budget souhaité ». Rien sur les tâches, les prestataires retenus, le programme, les montants : ils se reprennent ailleurs (deux onglets de la fiche), ce que l'écran ne dit pas. La consigne « Dans votre outil actuel, ouvrez chaque événement et téléchargez sa fiche en PDF » suppose un logiciel précis, jamais nommé ; la planner au tableur n'a que « Un autre fichier… ou un fichier JSON ». L'ordre conseillé (« Reprenez d'abord votre carnet de prestataires, puis vos événements », `fr.json`, `Import.takeoverIntro`) n'était pas affiché sur l'écran que j'ai vu.
- Preuve : `releve/repris/shots/import--1440.jpg` ; texte après `nav/spec-TX/061.jpg`
- Gravité présumée : freine
- Qui bute : celle qui veut « retrouver mon mariage Léa & Hugo tel qu'il est ». Elle ne sait ni combien d'étapes l'attendent, ni ce qui manquera à la fin.
- Principe candidat : une reprise s'annonce par son résultat (« votre mariage, avec ses prestataires retenus et son programme »), la liste de ce qu'il faut apporter, et ce qui ne sera pas repris.

### H-TX-05 — « Tout est à jour » dans un espace où rien n'existe
- Écran et taille : `/` et `/taches`, espace vide (Clémence), 1 440 px
- Constat : l'accueil vide dit « aucun évènement en cours · rien ne presse », puis « Rien ne presse : tout est à jour. », puis un calendrier vide de 700 px, « Aucun risque détecté ce matin », et seulement à 1 420 px « Pour bien démarrer ». Aucune action de création dans le premier écran. `/taches` titre son état vide « Aucune tâche à faire : tout est à jour. » ; son action « Voir les évènements » est un bouton à contour, le seul bouton plein est « Ajouter la tâche » des tâches hors évènement.
- Preuve : `releve/vide/shots/accueil--1440.jpg`, `releve/vide/shots/taches--1440-haut.jpg`
- Gravité présumée : freine
- Qui bute : la débutante, qui revient le lendemain de son inscription. L'écran la félicite au lieu de lui dire par où commencer.
- Principe candidat : « vide parce que rien n'est créé » et « vide parce que tout est fait » sont deux états, avec deux textes ; le premier porte l'action principale de l'écran.

### H-TX-06 — Cinq mots pour les mariés, trois pour la planner
- Écran et taille : `/events/[id]` Synthèse, `/`, `/taches`, 1 440 px
- Constat : sur la même fiche : onglet « Mariés », « liens des mariés », « Tâche confiée au client », « Attend le client », « Décisions du client », « Écrire au client », « Échanges avec le contact », « Interlocuteurs », « Aucune activité des mariés ». La planner est « Vous » sur l'accueil et la fiche, « Planner » dans la pastille et le filtre de `/taches`, « Planner principal : Aucun » dans l'équipe. Les tutoriels titrent « Avec les mariés » une étape dont l'unique tutoriel s'appelle « Ouvrir leur espace à vos clients ».
- Preuve : `nav/spec-TX/031.jpg`, `nav/spec-TX/045.jpg`, `nav/spec-TX/079.jpg`, `releve/vide/shots/tutoriels--1440.jpg` ; texte après `nav/spec-TX/036.jpg`
- Gravité présumée : freine
- Qui bute : la planner qui cherche « ce que j'attends de mes mariés » et se demande si « le contact » et « le client » sont la même personne. L'agence a de vrais clients qui ne sont pas des mariés : le mot doit suivre le type d'évènement, pas l'écran.
- Principe candidat : une personne, un mot ; le mot du couple vient du type d'évènement (« mariés » ou « client ») et s'emploie alors sur toute la fiche.

### H-TX-07 — « Poste », « ligne du budget », « ligne », « prestation » : quatre mots, un objet
- Écran et taille : `/demarrage`, `/demarrage/pret`, `/events/[id]` Synthèse et onglet Budget, visites, 1 440 px
- Constat : « postes de budget » (question 1), « 12 postes de budget » (espace prêt), « Aucune ligne pourvue sur 12 » (Synthèse), « Une ligne par prestation » (visite de la fiche, étape 4), « lignes du budget » (visite de la liste, étape 4). Dans l'onglet Budget, sur 250 px de haut : « 11 lignes pourvues sur 11 », « Réglages : Paramètres des lignes du budget par défaut », puis le titre « Budget et prestataires, par poste », la colonne « Poste, prestataire et pièces » et le bouton « Ouvrir le poste ». `fr.json` : 56 chaînes avec « poste », 18 avec « ligne du/de budget ».
- Preuve : `nav/spec-TX/010.jpg`, `nav/spec-TX/023.jpg`, `nav/spec-TX/079.jpg` ; texte après `nav/spec-TX/077.jpg` ; `tours.json`
- Gravité présumée : freine
- Qui bute : toutes. « Aucune ligne pourvue sur 12 » ne se comprend pas sans savoir que la ligne est le poste et que « pourvue » veut dire « prestataire retenu ».
- Principe candidat : le mot de la planner (« poste ») partout ; « ligne » reste un mot de tableau, jamais le nom d'un objet ; « pourvu » se dit « prestataire retenu ».

### H-TX-08 — Assistant d'import : l'étape s'appelle « Doublons », l'écran parle de « rapprochements »
- Écran et taille : `/import/[id]/types` et `/rapprochements`, import en cours, 1 440 px
- Constat : la frise dit « Doublons — 25 rapprochements à décider ». L'écran dit « Validez les rapprochements proposés un par un ou en lot, refusez-les, ou rapprochez une ligne à la main. Rien n'est encore enregistré dans vos modules. » Les mêmes 25 lignes sont « à vérifier » (filtre), « proposés » (premier bouton), « sûres » (« Tout accepter (25 propositions sûres) ») et « attendent votre décision » (bandeau). Trois boutons de lot aux libellés proches, aucun n'est le bouton plein. À l'étape « Types » : « 21 libellés, aucun type créé », colonnes « Libellé du fichier / Fiches / Devient », et quatre mots voisins sur deux écrans : type, famille, métier, libellé.
- Preuve : `releve/import/shots/import_importId_rapprochements--1440-haut.jpg`, `releve/import/shots/import_importId_types--1440-haut.jpg`
- Gravité présumée : freine
- Qui bute : la planner peu à l'aise, au moment où elle confie son carnet. Elle ne sait pas si « sûres » veut dire qu'elle peut cliquer sans lire. « Vos modules » n'est pas son mot. Le bandeau d'attente est orange : avec une marque orange, il ne se lira plus comme une alerte (dépend de la couleur).
- Principe candidat : une étape et son écran portent le même mot, celui de la question posée (« Est-ce le même prestataire ? ») ; une décision en lot a un choix recommandé, dit comme tel, et un seul.

### H-TX-09 — Les visites décrivent un écran rempli à un espace vide
- Écran et taille : visites de `/` et de `/prestataires`, compte neuf, 1 440 px et 375 px
- Constat : étape 2 de l'accueil, « Le reste, par urgence » : rien n'est encadré, la bulle flotte au milieu. Étape 3 : « avec le compte à rebours et ce qui reste à traiter » encadre « Aucun évènement en cours. ». Carnet, étape 1 : « Une pastille par famille… « À classer » réunit ceux qui n'ont pas encore de famille » encadre la seule pastille « Tous · 0 ». Étape 3 : « Survolez une fiche pour voir son repère » sur « Aucun résultat ».
- Preuve : `nav/spec-TX/003.jpg`, `nav/spec-TX/005.jpg`, `nav/spec-TX/048.jpg`, `nav/spec-TX/050.jpg`
- Gravité présumée : freine
- Qui bute : la débutante, seule cible de la visite. On lui montre ce qui n'est pas là, et pas la seule chose utile : le bouton pour commencer.
- Principe candidat : sur un écran vide, pas de visite : l'état vide fait le travail ; la visite attend le premier objet.

### H-TX-10 — Quatre sollicitations d'apprentissage en cinq minutes
- Écran et taille : `/`, `/events/[id]`, `/events`, `/prestataires`, compte neuf
- Constat : chaque module ouvre sa visite à la première visite (4 étapes, puis 5, puis 5, puis 4 : 18 bulles). Celle de la fiche s'ouvre à l'instant de la création et couvre le bandeau « Prochaine étape ». La visite passée, un bandeau « Découvrir en 2 minutes — Commencer le tutoriel » prend 160 px au-dessus du titre et ajoute un second bouton plein. Dans mon parcours, la visite de l'accueil s'est ouverte avant le questionnaire, par-dessus le bandeau « il reste 5 questions ». Dans l'espace repris, la bulle « cliquez une ligne pour ouvrir la fiche » était ouverte quand mon clic sur la ligne est resté sans effet (une fois ; possible limite de mon outil).
- Preuve : `nav/spec-TX/001.jpg`, `nav/spec-TX/030.jpg`, `nav/spec-TX/040.jpg`, `nav/spec-TX/042.jpg`, `nav/spec-TX/073.jpg`
- Gravité présumée : freine
- Qui bute : la planner pressée ferme tout sans lire et perd le seul message utile. La planner peu à l'aise lit tout et n'a encore rien fait au bout de dix minutes.
- Principe candidat : une seule aide à la fois, jamais par-dessus le résultat d'une action ; l'aide se propose, elle ne s'impose pas.

### H-TX-11 — Six dispositifs d'aide aux noms voisins
- Écran et taille : panneau « ? » de `/events`, `/demarrage/pret`, `/tutoriels`, `/aide`, 1 440 px
- Constat : « visite » (bulles), « tutoriel » (0/11, « crée un exemple fictif »), « essai guidé » (« mariage fictif… supprimé à la fin de l'essai (ou au bout de 24 h) »), « exemple » (« mariage fictif, étiqueté « Exemple »… disparaît seul au bout de 30 jours »), « aide de l'écran » (« ? »), « Aide » (centre). Trois mariages fictifs possibles, trois durées de vie.
- Preuve : `nav/spec-TX/044.jpg`, `nav/spec-TX/023.jpg`, `releve/vide/shots/tutoriels--1440.jpg`, `releve/vide/shots/aide--1440-haut.jpg`
- Gravité présumée : freine
- Qui bute : celle qui veut « essayer sans casser ». Elle ne sait pas lequel choisir, ni ce qui restera dans son espace.
- Principe candidat : trois niveaux d'aide, pas plus, chacun avec un nom et un rôle : l'aide de l'écran, un exemple à manipuler, le centre d'aide.

### H-TX-12 — L'aide d'écran est un pavé qui décrit les commandes
- Écran et taille : panneau « ? », `/events` et `/taches`, 1 440 px
- Constat : un seul paragraphe gris, en petit corps, sans intertitre, sans liste, sans lien. 94 mots pour la liste des évènements, 114 pour les tâches, 203 pour « Aujourd'hui », 484 pour la fiche d'un évènement (`fr.json` : 151 aides, médiane 54 mots, 36 au-dessus de 80). Le texte énumère les boutons (« « ‹ », « Aujourd'hui » et « › » le feuillettent ») ; il ne répond pas à « pourquoi cinq tâches en retard ? » ni à « comment reprendre mes mariages ? ».
- Preuve : `nav/spec-TX/044.jpg`, `nav/spec-TX/046.jpg` ; `fr.json`, section `Help`
- Gravité présumée : freine
- Qui bute : celle qui ouvre « ? » avec une question précise. 484 mots sans prise : elle referme.
- Principe candidat : l'aide d'écran tient en trente secondes : à quoi sert l'écran, les trois questions les plus posées, un lien « en savoir plus ».

### H-TX-13 — « Annuler » a quatre sens, « Fermer » en a trois, et il y a « Abandonner »
- Écran et taille : fiche d'un évènement, fenêtre d'une tâche, import, Paramètres
- Constat : « Annuler l'évènement… » (le mariage n'a pas lieu, lien rouge sous la frise), « Annuler » (quitter la fenêtre d'une tâche sans enregistrer), « Annuler » (défaire pendant dix secondes, cité par l'aide), « Annuler l'import » (retirer ce qui a été importé), « Annuler les modifications » (programme), et « Abandonner l'import » (quitter l'assistant). « Fermer » ferme un panneau, « Fermer l'autre session » déconnecte un appareil, « Fermer l'espace » supprime l'espace de l'entreprise. Le bon exemple existe : « Abandonner cet import ? Le fichier et vos choix sont effacés ; rien n'a encore été importé. — Oui, abandonner / Non, continuer ».
- Preuve : `releve.json`, `grid.commandLabels` ; `nav/spec-TX/032.jpg`, `nav/spec-TX/065.jpg` ; texte après `nav/spec-TX/067.jpg` ; `fr.json`, `Help.allTasks` et `Help.eventsDetail`
- Gravité présumée : freine
- Qui bute : la planner qui veut quitter une fenêtre sur la fiche et lit « Annuler l'évènement » en rouge juste au-dessus. Erreur rare, mais qui fait peur. Le rouge de ce lien dépend de la couleur d'alerte à venir.
- Principe candidat : « Annuler » = défaire ce que je viens de faire ; quitter se dit « Fermer » ; un geste métier grave porte son propre mot (« Déclarer annulé », « Supprimer l'espace ») et une confirmation écrite comme celle de l'abandon d'import.

### H-TX-14 — « Pour bien démarrer » est sous le calendrier, et ne dit ni « créer » ni « reprendre »
- Écran et taille : `/`, espace vide et compte neuf, 1 440 px
- Constat : la liste de démarrage commence à 1 420 px du haut, après « À traiter en premier », le calendrier et « Risques ». Elle a deux lignes : « Régler l'essentiel : société, adresse, TVA » et « Ajouter un premier prestataire ». Ni « créer votre premier évènement », ni « reprendre vos mariages en cours ».
- Preuve : `releve/vide/shots/accueil--1440.jpg`
- Gravité présumée : freine
- Qui bute : la planner qui a passé l'assistant (« Passer » cinq fois) et arrive sur l'accueil vide.
- Principe candidat : tant que l'espace est vide, la liste de démarrage est le premier bloc de l'accueil, et ses lignes sont les trois gestes qui donnent de la valeur.

### H-TX-15 — La Synthèse parle la langue de l'outil
- Écran et taille : `/events/[id]` Synthèse, compte neuf, 1 440 px
- Constat : « Santé de l'évènement », « À surveiller — Pourquoi ? », « 0,00 € engagés — Pas d'enveloppe fixée », « Aucune ligne pourvue sur 12 » (rangé sous « Décisions du client »), « Plage occupée — Règle du type Mariage — Bloque l'agenda de toute l'équipe de l'entreprise (l'évènement n'a pas d'équipe désignée) : agendas abonnés et page de réservation », « Planner principal : Aucun » pour une planner seule, « Fiche d'identité », « Fil d'activité ».
- Preuve : texte après `nav/spec-TX/036.jpg` ; `nav/spec-TX/031.jpg`
- Gravité présumée : freine
- Qui bute : la planner indépendante. « Bloque l'agenda de toute l'équipe de l'entreprise » ne la concerne pas et l'inquiète.
- Principe candidat : un texte se lit sans connaître le réglage qui l'a produit ; ce qui ne concerne pas une planner seule ne lui est pas montré.

### H-TX-16 — Le parcours des tutoriels commence par les factures et finit par la reprise
- Écran et taille : `/tutoriels`, espace vide, 1 440 px
- Constat : onze tutoriels, « environ 38 min ». Ordre conseillé : 1 « Préparer votre activité » (devis et factures, catalogue), 2 « Préparer vos modèles », 3 « Votre premier événement », 4 « Vendre et facturer », 5 « Avec les mariés ». « Importer ses événements existants » est le dernier, sous « Autres tutoriels », hors étapes. Le premier tutoriel porte « Conseillé ensuite » alors que rien n'est fait ; les autres « À faire », le mot des tâches. Les titres disent « vos », « son », « ses », « leur ».
- Preuve : `releve/vide/shots/tutoriels--1440.jpg`
- Gravité présumée : freine
- Qui bute : la planner qui vient d'un autre outil : son premier besoin est classé « autre ». La débutante : sept minutes de réglages de facture avant son premier mariage.
- Principe candidat : l'ordre d'un parcours suit la valeur pour la planner (voir un mariage vivre), pas l'ordre des réglages ; la reprise est une porte d'entrée, pas une annexe.

### H-TX-17 — Le centre d'aide ne comprend pas les mots de la planner
- Écran et taille : `/aide`, 1 440 px
- Constat : je cherche « reprendre mon tableau excel » : « Écrans trouvés : 0 — Aucun article ne correspond à votre recherche. » (une seule recherche essayée.) Trois mots pour l'objet cherché sur le même écran : « fiche » (introduction), « écrans » (compteur), « article » (message). Avant le champ de recherche viennent le compteur des tutoriels et un bouton plein. La page fait 12 766 px de haut ; chaque carte coupe son texte à trois lignes par « … » (115 libellés coupés au relevé).
- Preuve : texte après `nav/spec-TX/057.jpg` ; `releve/vide/shots/aide--1440-haut.jpg` ; relevé § 5 (`/aide`, 115)
- Gravité présumée : freine
- Qui bute : la planner qui cherche avec ses mots (« Excel », « récupérer », « mes anciens mariages ») et non ceux de l'outil (« importer »).
- Principe candidat : la recherche d'aide connaît les synonymes du métier ; une recherche sans résultat propose les sujets les plus proches et un moyen d'écrire à quelqu'un.

### H-TX-18 — « Évènement » et « événement » sur le même écran, partout
- Écran et taille : tous ; vu sur `/demarrage`, `/demarrage/pret`, `/events`, `/events/[id]`, `/`, `/import`, 1 440 px
- Constat : le menu, le titre de la liste, la recherche, les champs et tout `/import` écrivent « événement » ; les phrases, les boutons et les états vides écrivent « évènement ». Dans la seule carte « Créer mon premier évènement » : titre en « è », « Type d'événement » et « Date de l'événement » en « é », aide et bouton en « è ». En tête de fiche : « Date de l'événement » à 60 px de « Reporter l'évènement… ». À la question 1 : « 2. Évènements » à côté de « Agence événementielle ». `fr.json` : environ 430 chaînes en « è », 200 en « é ».
- Preuve : `nav/spec-TX/010.jpg`, `nav/spec-TX/024.jpg`, `nav/spec-TX/032.jpg`, `nav/spec-TX/042.jpg`
- Gravité présumée : gêne
- Qui bute : la planner soigneuse, dont le métier est le détail. Deux orthographes du mot central disent « outil pas fini ». La recherche par mot peut en souffrir (supposé, non essayé).
- Principe candidat : un lexique unique, une graphie par mot, tenue par un contrôle automatique des fichiers de textes.

### H-TX-19 — Après la reprise : « Source du prospect : Outil actuel », « Type à préciser », et des tirets
- Écran et taille : `/events/[id]` du mariage repris, en-tête et onglet Budget, 1 440 px
- Constat : l'en-tête du mariage repris affiche « Source du prospect : Outil actuel » et « Type d'événement : Type à préciser », sans dire pourquoi ni quoi faire. « Option » n'a pas de date. Dans l'onglet Budget, les onze postes repris affichent « — » en Prévu, Réel, Écart, Reste à payer : aucune mention « non repris du PDF ». L'ancien outil a quatre noms : « outil actuel » (`/import`, et valeur de source), « ancien logiciel » (bloc PDF de l'onglet Budget), « un autre logiciel de gestion » (question 5), « logiciel de planification » (`fr.json`, `Import.takeoverIntro`).
- Preuve : `nav/spec-TX/079.jpg` ; texte après `nav/spec-TX/077.jpg` et après `nav/spec-TX/079.jpg`
- Gravité présumée : gêne
- Qui bute : la planner qui vérifie son mariage après la reprise. Elle ne sait pas si « — » veut dire « zéro », « perdu » ou « à saisir ». « Outil actuel » deviendra faux dans un mois.
- Principe candidat : une valeur absente après une reprise dit « non repris » et propose le geste ; l'origine d'une donnée reprise se dit « Repris le 24/11 depuis <fichier> », pas dans un champ métier.

### H-TX-20 — « Reprendre » a cinq sens, et voisine avec « Importer »
- Écran et taille : `/import`, menu des Paramètres, onglet Budget, accueil, 1 440 px
- Constat : « Reprendre mes événements » (faire venir d'un autre outil), « en cours · Reprendre » (continuer un import commencé, journal des imports), « Reprendre un export » (rubrique voisine du menu : recharger une archive Symbola), « Reprendre le questionnaire » (accueil), « Reprendre les prestataires retenus (PDF) » (onglet Budget). L'écran s'appelle « Importer des données », son entrée de menu « Importer », sa question « Que voulez-vous reprendre ? », son bouton « Lire le fichier » ; l'onglet Budget porte « Importer » et « Reprendre… » à 150 px l'un de l'autre.
- Preuve : `nav/spec-TX/062.jpg`, `nav/spec-TX/079.jpg`, `nav/spec-TX/001.jpg`, `releve/repris/shots/import--1440.jpg`
- Gravité présumée : gêne
- Qui bute : celle qui cherche « reprendre » dans les Paramètres et trouve « Reprendre un export », qui fait autre chose.
- Principe candidat : « Reprendre » est réservé à « faire venir mes données d'ailleurs » ; continuer se dit « Continuer », recharger une archive « Restaurer ».

### H-TX-21 — Créer : trois verbes sur un même écran
- Écran et taille : `/events` et `/prestataires`, espace vide, 1 440 px
- Constat : `/events` : « + Créer » (barre du haut), « Nouveau » (bouton plein), « Créer un évènement » (état vide), et la visite parle de « Nouveau prospect ». `/prestataires` : « Nouveau prestataire » (bouton plein) et « Ajouter un prestataire » (état vide), puis « Créer, puis Métiers et étiquettes » sur le formulaire. Trois noms du même geste : hasard.
- Preuve : `releve/vide/shots/events--1440-haut.jpg`, `releve/vide/shots/prestataires--1440-haut.jpg`, `releve.json` (`/prestataires/nouveau`)
- Gravité présumée : gêne
- Qui bute : la planner peu à l'aise, qui se demande si « Ajouter » et « Nouveau » font deux choses.
- Principe candidat : « Créer » fait naître un objet qui a sa fiche (évènement, prestataire, modèle, devis) ; le bouton, l'état vide et la barre du haut disent le même verbe et le même nom.

### H-TX-22 — « Ajouter » a un sens quand il ajoute à une liste ; il se perd sur les modèles
- Écran et taille : Paramètres, onglets de la fiche (libellés du relevé)
- Constat : « Ajouter la tâche », « Ajouter une séquence », « Ajouter le lieu », « Ajouter la pièce », « Ajouter la source » mettent un élément dans une liste visible : l'écart avec « Créer » a un sens. Il se perd sur les modèles : `/events/modeles` porte « Nouveau modèle » et « Créer un modèle » ; `/devis/modeles` « Ajouter le modèle de départ » et « Créer un modèle » ; `/budget/parametres` « Créer le modèle ». « Ajouter » nu, sans nom, figure sur 18 relevés. L'article varie : « Ajouter la tâche », « Ajouter une séquence ».
- Preuve : `releve.json`, `grid.commandLabels` (comptes par libellé sur les 294 relevés)
- Gravité présumée : gêne
- Qui bute : celle qui règle ses modèles : trois boutons, trois verbes, un seul geste.
- Principe candidat : « Ajouter un… » = mettre une ligne de plus dans la liste que l'on a sous les yeux ; toujours suivi du nom, avec « un/une ».

### H-TX-23 — « Changer la date », « Modifier les informations », « Reporter l'évènement » : trois gestes sur la même date
- Écran et taille : `/events/[id]`, en-tête et panneau « Modifier », 1 440 px
- Constat : « Changer le type » figure sur 29 relevés (toute la fiche), « Changer la date » dans le panneau de modification, « Reporter l'évènement… » sous la frise, « Reporter » sur chaque tâche. « Changer » a un sens quand on remplace un choix par un autre (type, régime de TVA) ; « Renommer » (étapes, repas) est juste : il ne touche que le nom. Pour la date d'un évènement, deux verbes mènent à deux chemins sans que l'écran dise la différence.
- Preuve : `nav/spec-TX/032.jpg` ; `releve.json` (`/events/[id]?onglet=apercu&modifier`, `/events/parametres/etapes`)
- Gravité présumée : gêne
- Qui bute : la planner dont le mariage est décalé d'une semaine : « Changer » ou « Reporter » ? Les effets sur le rétroplanning ne sont dits que dans l'aide de 484 mots.
- Principe candidat : « Modifier » ouvre un formulaire ; « Changer de… » remplace un choix par un autre ; un geste qui a des conséquences a un seul nom et un seul endroit.

### H-TX-24 — « Supprimer », « Retirer », « Archiver » : un écart qui a un sens, mal tenu
- Écran et taille : Programme, carnet, Paramètres (libellés du relevé)
- Constat : « Retirer Domaine des Tilleuls » (le lieu sort du programme, il existe toujours) et « Archiver » (la fiche quitte le carnet, reste sur les évènements) ont un sens. Mais dans les listes des Paramètres, le même geste s'appelle « Retirer » (étapes, repas, types de pièce) ou « Supprimer » (étiquettes, modèles de budget). L'aide des tâches écrit : « « Supprimer » la retire tout de suite ».
- Preuve : `releve.json`, `grid.commandLabels` (`/events/parametres/etapes`, `/prestataires/parametres/etiquettes`, `/budget/parametres`) ; `fr.json`, `Help.allTasks`
- Gravité présumée : gêne
- Qui bute : celle qui hésite à cliquer : « Retirer » détruit-il ? « Supprimer » se rattrape-t-il ?
- Principe candidat : « Supprimer » détruit (corbeille, annulable) ; « Retirer » détache sans détruire ; « Archiver » range sans détruire. Chaque bouton dit ce qui reste.

### H-TX-25 — « Réglages » ouvre les « Paramètres »
- Écran et taille : `/events`, `/taches`, `/prestataires`, onglet Budget, 1 440 px
- Constat : le bouton de chaque module dit « Réglages » ; le menu, les écrans d'arrivée et les textes disent « Paramètres ». Sur le carnet vide, à 400 px du bouton « Réglages », l'état vide écrit « créez vos types dans les paramètres du carnet ». Dans l'onglet Budget, le bouton se lit « Réglages : Paramètres des lignes du budget par défaut ». Dans les Paramètres : « Enregistrer les paramètres » (devis) et « Enregistrer les réglages » (relances). `fr.json` : 72 chaînes avec « réglages », 59 avec « paramètres ».
- Preuve : `releve/vide/shots/prestataires--1440-haut.jpg`, `releve/vide/shots/taches--1440-haut.jpg` ; texte après `nav/spec-TX/077.jpg` ; `releve.json` (`/devis/parametres`, `/devis/relances`)
- Gravité présumée : gêne
- Qui bute : celle qui suit une consigne écrite (« dans les paramètres du carnet ») et cherche un bouton de ce nom.
- Principe candidat : un texte qui cite une commande la cite par son libellé exact, entre guillemets.

### H-TX-26 — Champ obligatoire vide : c'est le navigateur qui parle, pas Symbola
- Écran et taille : `/demarrage/pret` (formulaire vide) et `/import?type=event_sheets` (aucun fichier), 1 440 px
- Constat : dans les deux cas, une bulle du navigateur, dans la langue du navigateur, posée sur le texte voisin (le libellé du champ suivant ; la ligne « Jusqu'à 50 fiches à la fois… »). Aucun message de Symbola. Aucun champ n'est marqué obligatoire à l'avance : seul « (facultatif) » marque le second prénom. La date, non marquée, est-elle obligatoire ? L'écran ne le dit pas.
- Preuve : `nav/spec-TX/025.jpg`, `nav/spec-TX/062.jpg`
- Gravité présumée : gêne
- Qui bute : la planner sur un ordinateur réglé dans une autre langue, ou sur téléphone, où la bulle disparaît en deux secondes.
- Principe candidat : l'app écrit ses propres messages d'erreur, sous le champ, en disant quoi saisir ; ils restent tant que l'erreur reste.

### H-TX-27 — Aucun mot après « Créer l'évènement », ni après l'abandon d'un import
- Écran et taille : `/demarrage/pret` → `/events/[id]` ; `/import/[id]/confirmation` → `/import`, 1 440 px
- Constat : au clic sur « Créer l'évènement », le bouton pâlit sans changer de texte. Deux secondes plus tard la fiche s'affiche, défilée de 64 px, la visite par-dessus. Je n'ai vu aucun message « Évènement créé », ni moyen d'annuler ; la première chose lue est « 1 sur 5 — Les onglets ». Après « Oui, abandonner », retour à `/import` sans message en tête de page.
- Preuve : `nav/spec-TX/029.jpg`, `nav/spec-TX/030.jpg` ; texte après `nav/spec-TX/069.jpg`
- Gravité présumée : gêne
- Qui bute : la débutante, qui attend qu'on lui confirme son premier geste et qu'on lui dise ce que l'app vient de préparer pour elle (18 tâches, 12 postes).
- Principe candidat : après une action, une phrase dit ce qui vient d'être fait et ce que l'app a ajouté d'elle-même ; rien ne s'ouvre par-dessus.

### H-TX-28 — « Source du prospect : Instagram », que personne n'a saisie
- Écran et taille : `/events/[id]`, en-tête, compte neuf, 1 440 px
- Constat : le mariage créé depuis « Votre espace est prêt » affiche « Source du prospect : Instagram ». Le formulaire ne posait pas la question. Le mariage est « Confirmé », pas prospect. Le même mot sert de filtre sur `/events` (« Source du prospect », valeur « Toutes »).
- Preuve : `nav/spec-TX/032.jpg`, `nav/spec-TX/042.jpg`
- Gravité présumée : gêne
- Qui bute : la planner qui suit d'où viennent ses clients : ses chiffres par source sont faux dès le premier mariage. Les autres se demandent ce qu'est une « source ».
- Principe candidat : l'app n'invente pas une donnée métier ; une valeur non saisie s'affiche « non renseigné », avec le geste pour la saisir. Mot candidat : « Comment ils m'ont connue ».

### H-TX-29 — « Votre espace est prêt », puis « votre fiche entreprise n'est pas complète » et « 0 sur 2 faits »
- Écran et taille : `/demarrage/pret` puis `/`, compte neuf, 1 440 px
- Constat : l'écran final annonce « Votre espace est prêt » et « Votre régime de TVA : franchise en base de TVA ». L'accueil répond par un bandeau « Votre fiche entreprise n'est pas encore complète. La compléter » et par « Pour bien démarrer — 0 sur 2 faits — 1. Régler l'essentiel : société, adresse, TVA ». La TVA vient d'être réglée ; cinq questions et un mariage comptent pour zéro. Quatre mots pour la même chose : « espace », « entreprise », « société », « organisation » (« Créer une autre organisation », dans le menu).
- Preuve : `nav/spec-TX/023.jpg`, `releve/vide/shots/accueil--1440.jpg` ; texte après `nav/spec-TX/037.jpg`
- Gravité présumée : gêne
- Qui bute : la débutante : « prêt » ou pas prêt ? Elle a l'impression de recommencer.
- Principe candidat : une liste de démarrage compte ce qui est déjà fait, assistant compris ; l'app ne dit pas « prêt » s'il reste un préalable.

### H-TX-30 — « Prochaine action » en montre trois, puis vient « Prochaine étape »
- Écran et taille : `/events/[id]` Synthèse, 1 440 px
- Constat : le bloc « Prochaine action » (singulier) liste trois tâches et « Voir 2 de plus ». Juste dessous, le bandeau « Prochaine étape : créer les liens des mariés », bouton plein sur toute la largeur. Deux « prochaines », deux mots, cinq choses à faire. « Liens des mariés » s'explique dans la phrase suivante (« lien personnel, sans compte »), mais le bouton dit seulement « Créer les liens ». Le même bandeau s'affiche sur le mariage repris, déjà avancé.
- Preuve : `nav/spec-TX/031.jpg`, `nav/spec-TX/079.jpg`
- Gravité présumée : gêne
- Qui bute : celle qui veut savoir quoi faire maintenant : l'écran lui donne deux réponses.
- Principe candidat : un écran a une seule « suite », au singulier, avec un seul bouton ; le reste est une liste, nommée comme telle.

### H-TX-31 — « Aucun risque détecté ce matin », sous cinq retards
- Écran et taille : `/`, compte neuf après le premier mariage, et espace vide, 1 440 px
- Constat : l'accueil liste cinq tâches « En retard » puis, plus bas, « Risques — Le radar passe chaque matin sur les évènements à venir. Aucun risque détecté ce matin. » « Radar » n'est expliqué nulle part sur l'écran. Dans l'espace vide, le bloc est là aussi, sans rien à surveiller.
- Preuve : `releve/vide/shots/accueil--1440.jpg` ; texte après `nav/spec-TX/037.jpg`
- Gravité présumée : gêne
- Qui bute : celle qui lit « en retard » et « aucun risque » sur le même écran et ne sait plus lequel croire.
- Principe candidat : deux blocs qui parlent d'urgence emploient une seule échelle de mots ; un bloc sans objet ne s'affiche pas.

### H-TX-32 — Menu « Nouveau » : « Évènement confirmé — Directement en préparation »
- Écran et taille : `/events`, menu « Nouveau », 1 440 px
- Constat : trois choix : « Prospect — Une demande à étudier, avant tout devis signé. Pas de rétroplanning. », « Évènement confirmé — Directement en préparation, avec ou sans client (ex. un shooting photo). », « Pour un client existant ». Or la frise de la fiche distingue « Confirmé » (étape 2) et « En préparation » (étape 3) : mon mariage « confirmé » n'est pas « en préparation ». Aucun choix « un mariage déjà en cours, que je reprends » ; le bouton « Importer » est à côté, sans lien avec ce menu.
- Preuve : `nav/spec-TX/042.jpg`, `nav/spec-TX/032.jpg`
- Gravité présumée : gêne
- Qui bute : la planner qui reprend un mariage signé il y a six mois : aucun des trois choix ne décrit son cas.
- Principe candidat : les mots d'un statut sont les mêmes dans le menu, la frise et les filtres ; un menu de création couvre les situations réelles, reprise comprise.

### H-TX-33 — « Tâches » n'a pas de visite, les trois autres modules en ont
- Écran et taille : `/taches`, compte neuf, 1 440 px
- Constat : aucune visite ne s'ouvre à la première visite de `/taches` ; le panneau « ? » n'y a pas de bouton « Revoir la visite ». `tours.json` définit des visites pour l'accueil, la liste, la fiche, le carnet, le catalogue et le budget, pas pour les tâches. Le centre d'aide promet pourtant « Chaque écran a sa fiche : à quoi il sert, sa visite guidée… ».
- Preuve : `nav/spec-TX/045.jpg`, `nav/spec-TX/046.jpg`, `tours.json`
- Gravité présumée : gêne
- Qui bute : celle qui a compris le principe « ? › Revoir la visite » et ne le retrouve pas, sur l'écran le plus dense (trois boutons et deux cases par ligne).
- Principe candidat : une promesse d'aide vaut pour tous les écrans du même rang, ou n'est pas faite.

### H-TX-34 — Le tutoriel proposé ne correspond pas à l'état de l'écran
- Écran et taille : `/prestataires` (375 px) et `/events` (1 440 px), compte neuf
- Constat : sur le carnet vide (« Aucun prestataire »), le bandeau propose « Découvrir en 4 minutes — Comparer plusieurs devis pour une ligne du budget ». Sur la liste des évènements, il propose « La fiche d'un événement » alors que je viens d'en parcourir une. En 375 px, le bandeau occupe 160 px et repousse le titre « Carnet de prestataires » à 380 px du haut.
- Preuve : `nav/spec-TX/053.jpg`, `nav/spec-TX/042.jpg`
- Gravité présumée : gêne
- Qui bute : la débutante sur téléphone : son premier écran du carnet est une invitation à comparer des devis.
- Principe candidat : une aide proposée répond à ce que l'écran montre maintenant ; sinon elle se tait.

### H-TX-35 — Sur téléphone, la visite cache ce qu'elle montre et dit « Survolez »
- Écran et taille : `/prestataires`, visite, 375 × 812
- Constat : la bulle devient une feuille de 200 à 240 px en bas d'écran. À l'ouverture, la page a défilé seule de 410 px : la planner découvre l'écran par son milieu, la pastille encadrée collée au bord haut. À l'étape 3, la zone encadrée (« Aucun résultat ») est à moitié sous la feuille. Le texte dit « Survolez une fiche pour voir son repère sur la carte » : pas de survol au doigt, et la carte n'est pas à l'écran (bascule « Liste / Carte »).
- Preuve : `nav/spec-TX/048.jpg`, `nav/spec-TX/050.jpg`, `nav/spec-TX/051.jpg`
- Gravité présumée : gêne
- Qui bute : la planner qui s'inscrit depuis son téléphone.
- Principe candidat : un texte d'aide ne nomme que des gestes possibles sur l'appareil ; une aide ne déplace pas l'écran avant que l'on ait vu son haut.

### H-TX-36 — Le panneau d'aide rogne l'écran qu'il explique
- Écran et taille : `/taches` avec « ? » ouvert, 1 440 px
- Constat : le panneau prend 380 px à droite et resserre la page : les boutons « Reporter » et « Supprimer » de chaque ligne sortent du cadre, « Modifier » est au ras du bord. Les titres de tâche passent de deux à trois lignes. L'aide cite pourtant « Reporter » et « Supprimer ».
- Preuve : `nav/spec-TX/046.jpg` (à comparer à `nav/spec-TX/045.jpg`)
- Gravité présumée : gêne
- Qui bute : celle qui lit l'aide et veut faire le geste en même temps.
- Principe candidat : l'aide ouverte laisse visible et utilisable ce dont elle parle.

### H-TX-37 — Le titre de l'aide n'est pas celui de l'écran
- Écran et taille : panneau « ? », `/taches` et `/events`, 1 440 px
- Constat : écran « Tâches », aide « Les tâches de tous vos mariages » (sur deux lignes ; le texte dit ensuite « tous vos évènements »). Écran « Événements », aide « Liste des événements ». Menu « Prestataires », écran « Carnet de prestataires ».
- Preuve : `nav/spec-TX/046.jpg`, `nav/spec-TX/044.jpg`, `releve/vide/shots/prestataires--1440-haut.jpg`
- Gravité présumée : détail
- Qui bute : celle qui doute d'avoir ouvert la bonne aide ; l'agence qui ne fait pas de mariages.
- Principe candidat : l'aide porte le nom exact de l'écran, lui-même égal au libellé du menu.

### H-TX-38 — « Reprendre le questionnaire » avant d'avoir commencé ; « questionnaire » est déjà pris
- Écran et taille : `/`, compte neuf avant l'assistant, 1 440 px ; `/demarrage`
- Constat : le bandeau dit « Terminez la préparation de votre espace : il reste 5 questions. Reprendre le questionnaire » alors que rien n'a commencé (5 sur 5). L'assistant s'intitule « Préparons votre espace ». « Questionnaires » désigne ailleurs ceux que l'on envoie aux mariés (section de la fiche, rubrique des Paramètres).
- Preuve : `nav/spec-TX/001.jpg`, `nav/spec-TX/010.jpg` ; texte après `nav/spec-TX/036.jpg`
- Gravité présumée : détail
- Qui bute : celle qui revient après avoir fermé l'onglet à l'inscription.
- Principe candidat : une étape de démarrage a un seul nom, repris par le bandeau qui y ramène ; « Commencer » avant, « Continuer » pendant.

### H-TX-39 — L'assistant de démarrage se répète et parle par pronoms
- Écran et taille : `/demarrage`, questions 1 à 5, 1 440 px
- Constat : « « Passer » garde la réponse proposée » est écrit deux fois par écran (en-tête et sous les boutons), y compris à la question 5 où rien n'est proposé. Les aides commencent par « Il » sans nom avant : « Il choisit vos modèles de départ », « Il fixe les mentions de vos devis » (sous « Êtes-vous soumise à la TVA ? »). Les étapes s'appellent « Volume » et « Outils ». « Continuer » devient « Voir mon espace » à la dernière question. Une pastille répondue ne se distingue que par un fond pâle. Le menu entier, la recherche et « Créer » restent offerts pendant les questions.
- Preuve : `nav/spec-TX/010.jpg`, `nav/spec-TX/021.jpg` ; texte après `nav/spec-TX/013.jpg`
- Gravité présumée : détail
- Qui bute : personne ne bute ; mais c'est le premier écran de l'app, et il donne le ton.
- Principe candidat : une consigne se dit une fois, à l'endroit du geste ; une phrase d'aide a un sujet.

### H-TX-40 — « 0/11 » en permanence dans le menu
- Écran et taille : menu latéral, tous les écrans, 1 440 px
- Constat : « Tutoriels 0/11 » garde sa pastille verte sur tous les écrans, assistant de démarrage et assistant d'import compris. Le même compteur ouvre le centre d'aide (« Tutoriels faits : 0 sur 11 », barre de progression, bouton plein) avant le champ de recherche.
- Preuve : `nav/spec-TX/010.jpg`, `nav/spec-TX/065.jpg`, `releve/vide/shots/aide--1440-haut.jpg`
- Gravité présumée : détail
- Qui bute : la planner expérimentée, qui ne suivra pas onze tutoriels et garde un « 0/11 » sous les yeux. À côté de « Tâches · 5 en retard », deux pastilles se disputent l'œil ; avec un orange de marque, un compteur se lira comme une alerte (dépend de la couleur).
- Principe candidat : une pastille du menu signale du travail à faire pour un client, jamais une progression d'apprentissage.

### H-TX-41 — « Passer la visite » jusqu'à la dernière bulle, à côté de « Terminer »
- Écran et taille : visites, toutes étapes, 1 440 px et 375 px
- Constat : chaque bulle porte « Passer la visite » (lien), « Précédent », « Suivant ». À la dernière, « Passer la visite » reste, au-dessus de « Terminer » : deux sorties pour le même effet. Aucune ne dit si la visite reviendra. Pas de croix. Seule la dernière étape de la visite de l'accueil dit où la retrouver.
- Preuve : `nav/spec-TX/007.jpg`, `nav/spec-TX/051.jpg`
- Gravité présumée : détail
- Qui bute : celle qui craint de « rater » quelque chose en passant.
- Principe candidat : une aide temporaire a une sortie, toujours au même endroit, qui dit où la retrouver.

### H-TX-42 — États vides : le bon gabarit, mais l'action n'est pas le bouton principal
- Écran et taille : `/events`, `/prestataires`, espace vide, 1 440 px
- Constat : les deux états vides suivent le gabarit attendu (titre, une phrase, « Par exemple : … », une action, « Lire l'aide »). Mais l'action (« Créer un évènement », « Ajouter un prestataire ») est un bouton à contour, tandis que le bouton plein de l'écran est ailleurs (« Nouveau », « Nouveau prestataire »). Le titre du carnet vide tient en trois lignes et contient deux consignes. Sous l'état vide de `/events`, « Charge des douze prochains mois » aligne douze lignes de zéros.
- Preuve : `releve/vide/shots/events--1440-haut.jpg`, `releve/vide/shots/prestataires--1440-haut.jpg`
- Gravité présumée : détail
- Qui bute : la débutante, qui voit deux boutons pour créer et un tableau de zéros.
- Principe candidat : dans un écran vide, l'action de l'état vide est le bouton principal de l'écran, au même libellé ; les blocs sans donnée se taisent. (Le « plein » dépend de la couleur d'action à venir.)

### H-TX-43 — « ⌘K » et « Recher » sur téléphone
- Écran et taille : barre du haut, 375 × 812
- Constat : le champ de recherche fait environ 127 px : on y lit « Recher » et la pastille « ⌘K », raccourci de clavier d'ordinateur. Le texte complet, « Rechercher un événement, un devis, une tâche, une aide… », n'est jamais lisible à cette taille.
- Preuve : `nav/spec-TX/053.jpg`
- Gravité présumée : détail
- Qui bute : toute planner sur téléphone : le champ n'a pas l'air d'une recherche.
- Principe candidat : un libellé coupé est remplacé par une icône et un nom accessible ; un raccourci clavier ne s'affiche que là où il y a un clavier.

## 3. Dix principes de Design System, par ordre d'importance

1. **Rien de neuf n'est en retard, et l'app n'invente pas de donnée métier.** Une date calculée et déjà passée se dit « à replacer » ; une valeur non saisie ou non reprise se dit telle, avec le geste pour la compléter.
2. **Une question posée change la suite.** Les réponses du démarrage décident de ce qui est proposé ensuite ; la reprise est une porte d'entrée de même rang que « créer ».
3. **Un lexique, tenu par un contrôle.** Un mot par objet (évènement, poste, mariés ou client selon le type, Paramètres), une graphie, et un contrôle automatique des fichiers de textes.
4. **Des verbes définis.** « Créer » fait naître un objet qui a sa fiche ; « Ajouter un… » met une ligne dans la liste visible ; « Modifier » ouvre un formulaire ; « Supprimer » détruit, « Retirer » détache, « Archiver » range ; « Reprendre » fait venir des données d'ailleurs. Le bouton, l'état vide et l'aide citent le même libellé.
5. **« Annuler » défait, « Fermer » quitte.** Un geste métier grave a son propre mot et une confirmation qui dit ce qui est perdu et ce qui reste.
6. **Vide n'est pas « à jour ».** Deux états, deux textes ; l'état « rien encore » porte l'action principale de l'écran, un exemple, une aide de trente secondes ; un bloc sans objet se tait.
7. **L'app écrit ses messages.** Erreur sous le champ, qui dit ce que l'app a compris, pourquoi cela ne va pas et où aller ; confirmation qui dit ce qui a été fait et ce que l'app a ajouté d'elle-même.
8. **Une aide à la fois, jamais par-dessus un résultat.** Trois niveaux nommés (aide de l'écran, exemple, centre d'aide) ; pas de visite sur un écran vide ; pas de compteur d'apprentissage dans le menu.
9. **L'aide d'écran répond à des questions.** Trente secondes de lecture, trois questions, un lien ; même titre que l'écran ; l'écran reste utilisable à côté.
10. **Un texte se lit sans connaître l'outil.** Ni « module », « ligne pourvue », « rapprochement », « radar », « plage occupée » sans explication à l'endroit même ; ni geste impossible sur l'appareil (« survolez » au doigt).
