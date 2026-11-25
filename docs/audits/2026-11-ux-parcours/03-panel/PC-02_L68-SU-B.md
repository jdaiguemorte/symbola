# PC-02 · Martine Vasseur (L68-SU-B) — journal

Portable 15 pouces, fenêtre 1366×768. Espace neuf, compte `pc02-martine@exemple.test`, créé pour l'occasion.
Captures : dossier `(captures hors dépôt)/nav/pc02-sub/` (noté `nav/` ci-dessous). Les captures d'avant l'interruption sont dans `nav/avant/`, celles d'après dans `nav/apres/` (les numéros ont recommencé à 001).

> Journal écrit en deux temps : les étapes 1, 2 et le début de la 3 avant une interruption technique du
> navigateur (non comptée), la suite après.

## Étape 1 — Répondre aux questions de démarrage, vite

J'arrive sur « Aujourd'hui » et, avant même de voir la page, une bulle me tombe dessus : « 1 sur 4 — Votre priorité du jour ». Je n'ai pas le temps, je clique « Passer la visite ». Dessous, un bandeau vert : « Terminez la préparation de votre espace : il reste 5 questions. Reprendre le questionnaire ». « Reprendre » ? Je ne l'ai jamais commencé. Je clique quand même.
Cinq questions, une par écran, la réponse déjà cochée : « Wedding planner », « Mariage », « Franchise en base » (je reconnais la phrase de mes factures, « TVA non applicable, art. 293 B »), puis le nombre d'évènements : là on m'a coché « De 11 à 25 », j'en fais dix, je corrige en « Jusqu'à 10 ». Dernière : je coche « Un tableur (Excel, Google Sheets…) » et « Voir mon espace ».
À la question 2, le bouton « Continuer » est sous le bas de l'écran : sept cases empilées l'une sous l'autre, il faut descendre pour le trouver.
J'arrive sur « Votre espace est prêt » : « 18 tâches de rétroplanning », « 12 postes de budget ». C'est allé vite.

- Note : 2
- Gestes : 9 (2 pour écarter la visite et ouvrir le questionnaire, 7 dans le questionnaire)
- Questions : 1 oui, « Continuer » à chaque écran ; 2 non ; 3 non (« Franchise en base » : je connais par mes factures) ; 4 non ; 5 oui, « Question précédente » et « Tout reste modifiable ensuite dans les Paramètres » ; 6 non ; 7 oui, « Continuer » ; 8 un peu : « Continuer » et « Passer » font la même chose quand je ne change rien ; 9 non.
- Captures : `nav/avant/004.jpg` (question 2, le bouton « Continuer » hors de l'écran)

## Étape 2 — Trouver par où l'on reprend un mariage en cours

Sur « Votre espace est prêt », sous « Et maintenant ? », on me propose deux choses : « Créer mon premier évènement » et « Explorer avec un exemple ». Aucune ne dit « reprendre ». Je viens pourtant de cocher que je remplace un tableur : j'attendais qu'on me dise « apportez votre tableur ». Rien. J'ai regardé l'écran jusqu'en bas : je ne sais pas quoi faire ici, mon mariage existe déjà, je ne veux pas le « créer » avec leurs « 18 tâches ».
Je vais dans le menu, « Événements » : c'est là que doit être un mariage. Deuxième bulle : « 1 sur 5 — La liste ». Je l'avais déjà passée, la visite ! « Passer la visite » encore. Et à la place apparaît un encadré « Découvrir en 2 minutes — La fiche d'un événement — Commencer le tutoriel / Plus tard », qui pousse toute la page vers le bas. Troisième sollicitation en trois écrans.
En haut à droite, trois boutons : « Réglages », « Importer », « Nouveau ». « Importer », c'est sûrement ça. Je clique : je me retrouve tout en bas d'une page des « Paramètres », avec un deuxième menu à gauche (« Mon entreprise », « Ventes », « Prestataires et données »…) et un bouton « Choose Files / No file chosen » en anglais. Je remonte : « Importer des données — Que voulez-vous reprendre ? ». Voilà le mot « reprendre ». Quatre cases : « Reprendre mes contacts », « Reprendre mes prestataires », « Reprendre mes événements », « Un autre fichier ».
Trouvé, mais par déduction, et dans les Paramètres, pas là où je cherchais.

- Note : 1
- Gestes : 4 (« Événements », « Passer la visite », « Importer », remonter la page)
- Questions : 1 non : « Votre espace est prêt » ne propose pas de reprendre un mariage ; 2 non ; 3 non à ce stade ; 4 oui : un écran entier regardé sans savoir quoi faire (« Et maintenant ? ») ; 5 sans objet ; 6 oui : tout le menu des Paramètres (« Estimation des trajets », « Fermer l'espace », « Journal d'activité ») alors que je veux juste apporter mon classeur ; 7 non sur « Votre espace est prêt » (l'action principale est « Créer l'évènement », pas la mienne) ; 8 oui : « Créer un évènement », « Nouveau », « + Créer » et « Importer » sur la même page ; 9 non.
- Captures : `nav/avant/014.jpg` (« Et maintenant ? » : créer ou explorer, pas reprendre), `nav/avant/017.jpg` (arrivée en bas de la page d'import, dans les Paramètres), `nav/avant/018.jpg` (les quatre cases)

## Étape 3 — Reprendre mes fichiers, un par un

### 3 a. Premier essai : le budget, avant d'avoir créé le mariage

« Reprendre mes événements » : dessous, « Fiches événement (PDF, une fiche par événement) » ou « Événements et leurs clients (une ligne par événement) ». Je n'ai ni l'un ni l'autre : j'ai un classeur par mariage, pas une liste de mariages, et aucun PDF. Je prends « Un autre fichier — Événements, tâches, lignes de budget, catalogue, listes… depuis un tableur (CSV, Excel) ou un fichier JSON ». « JSON », je ne sais pas ce que c'est.
« Que contient le fichier ? » : huit choix, aucun coché. « Lignes de budget » et « Lignes du budget par défaut » : lequel ? Je prends le premier. « Sources de prospects », « Motifs de perte », « Modes de paiement » : ça ne me regarde pas. Je dépose `budget.csv`, « Lire le fichier ».
Écran « Import de « budget.csv » », quatre étapes en haut : « Fichier — 14 lignes », « Colonnes », « Doublons », « Vérifier et confirmer ». 14 lignes : c'est bien mon compte. « Où va chaque colonne de votre fichier ? Symbola en a reconnu 8 sur 9. » Je reconnais mes colonnes : Poste, Prestataire, Prévu, Réel, Acompte versé, Date acompte, Solde, Date solde, toutes « Reconnue ». Pour « Détail », une étiquette « À choisir » et « Libellé de la ligne ? (55 %, à confirmer) » : 55 % de quoi ? Je choisis « Libellé de la ligne », l'étiquette passe à « Choisie ». À droite, un « Aperçu : ligne 1 du fichier » montre « Lieu / Domaine de la Roche Fictive / 6 500,00 € » : je comprends que chaque ligne va devenir une ligne de budget. Mais de quel mariage ? Personne ne me l'a demandé.
« Continuer » : « Ce que va faire l'import — Fiches créées 0 — Lignes rejetées 14 ». « 14 lignes sur 14 ne seront pas importées. Téléchargez le rapport pour les corriger dans votre tableur, puis réimportez-les. » Et quatorze fois : « Ligne 2 : événement introuvable ou ambigu parmi vos événements ». Corriger quoi dans mon tableur ? Il n'y a rien de faux dedans. Je finis par comprendre seule : le mariage n'existe pas encore ici. On m'a laissée aller jusqu'au quatrième écran pour me le dire, et sans me dire quoi faire. Juste au-dessus, l'étape « Doublons » affiche « 14 nouveaux, aucune mise à jour » : 14 nouveaux et 14 rejetés à la fois.
Je clique « Abandonner l'import » : « Abandonner cet import ? Le fichier et vos choix sont effacés ; rien n'a encore été importé. » — ça, c'est clair. « Oui, abandonner ». Je reviens à la page d'import, sans un mot pour me dire que c'est fait.

- Note : 1
- Gestes : 8 (case « Un autre fichier », « Lignes de budget », dépôt, « Lire le fichier », choix de colonne, « Continuer », « Abandonner l'import », « Oui, abandonner »)
- Questions : 1 non : rien ne dit qu'il faut créer le mariage avant ; 2 non ; 3 oui : « JSON », « L'encodage, le séparateur et la ligne d'en-tête », « 55 %, à confirmer », « ambigu » ; 4 oui : quatre écrans pour un import qui ne prend rien ; 5 oui : « Abandonner l'import », avec une phrase nette ; 6 oui : « Sources de prospects », « Motifs de perte », « Articles du catalogue » ; 7 oui (« Lire le fichier », « Continuer ») sauf au dernier écran, où il ne reste que « Retour » ; 8 oui : « Lignes de budget » / « Lignes du budget par défaut » ; 9 non.
- Captures : `nav/avant/027.jpg` (« Lignes rejetées 14 », « événement introuvable ou ambigu »), `nav/avant/020.jpg` (les huit choix), `nav/avant/023.jpg` (les colonnes)

### 3 b. Créer le mariage à la main

Je retourne dans « Événements », bouton « Nouveau » : trois choix, « Prospect », « Évènement confirmé », « Pour un client existant ». Mon mariage est signé depuis septembre : « Évènement confirmé — Directement en préparation, avec ou sans client (ex. un shooting photo) ». Formulaire « Nouvel événement » : type « Mariage » déjà mis, date, prénoms et noms des mariés, lieu, ville. Je tape tout à la main : 20 mars 2027, Juliette Morin, Romain Girard, Domaine de la Roche Fictive, Vertou. Rien de tout cela n'est venu de mes fichiers.
Tout en bas, une case déjà cochée : « Partir du rétroplanning « Rétroplanning mariage (modèle de départ) » (18 tâches) ». J'ai ma liste à moi, dix-sept lignes dont cinq faites : je décoche, je ne veux pas leurs dix-huit tâches par-dessus. « Créer l'événement ».
J'arrive sur la fiche « Juliette & Romain — Confirmé — 115 jours avant le jour J ». Et troisième bulle : « 1 sur 5 — Les onglets ». « Passer la visite », encore. Juste dessous, un grand bloc vert : « Prochaine étape : appliquer le rétroplanning — Appliquer le modèle / Plus tard ». Je viens de dire non.

- Note : 2
- Gestes : 11 (« Nouveau », « Évènement confirmé », 7 saisies, la case décochée, « Créer l'événement »)
- Questions : 1 oui ; 2 oui : les deux mariés, la date, le lieu et la ville, tapés à la main alors que j'apporte un classeur ; 3 « Prospect », « Source du prospect » : pas mes mots, mais je devine ; 4 non ; 5 oui (« Supprimer l'évènement… il se restaure pendant 30 jours », en bas de la fiche) ; 6 oui : « Source du prospect », « (ex. un shooting photo) » ; 7 oui ; 8 oui : « Nouveau », « + Créer », « Créer un évènement » ; 9 non.
- Captures : `nav/apres/018.jpg` (la case du rétroplanning cochée d'avance), `nav/apres/021.jpg` (la fiche et la troisième bulle)

### 3 c. Le budget, repris depuis la fiche du mariage

Onglet « Budget et prestataires — 0/12 ». Je clique et je ne vois pas le budget : l'écran est rempli par le bloc « Prochaine étape : appliquer le rétroplanning », le tableau est plus bas. Douze postes sont déjà là, vides, tous « À trouver » : « Lieu de réception », « Traiteur », « Photographe », « Vidéaste », « DJ / musiciens »… Ce ne sont pas les miens. Il y a un bouton « Importer » et un autre, « Reprendre les prestataires retenus (PDF) » : je n'ai pas de PDF.
« Importer » : me revoilà dans les Paramètres, en bas de page, mais cette fois un bandeau vert dit : « Les lignes iront dans l'évènement « Juliette & Romain » : votre fichier n'a pas besoin de colonne pour le désigner. » Voilà ce qu'il fallait me dire la première fois. Dessous, le « Journal des imports » garde mon premier essai : « budget.csv — Lignes de budget — 14 — abandonné ».
Je dépose `budget.csv`, mêmes colonnes, je rechoisis « Libellé de la ligne » pour « Détail » (il ne s'en souvient pas), « Continuer ».
Nouvel écran, que je n'avais pas eu : « Doublons — 8 rapprochements à décider ». « À vérifier · 8 », « Nouveaux · 6 », « Mises à jour · 0 ». Un encadré orange : « 8 rapprochements attendent votre décision. L'import ne peut pas être confirmé tant qu'il en reste. » Trois boutons : « Valider les 8 rapprochements proposés », « Créer les 8 lignes comme nouvelles », et plus bas « Tout accepter (5 propositions sûres) ». Je ne sais pas ce qu'est un rapprochement. Dans le tableau : « Traiteur (100 %) », « Fleuriste (63 %) », « Transport des invités (65 %) », « ressemblance 100 % ». Je comprends à moitié : mon « Traiteur » ressemble au leur. Une bonne chose : sous mes lignes sans poste, il a écrit « (poste repris de la ligne 4) » — il a compris que j'écris le poste une seule fois. Mais il me propose de « Mettre à jour » le même « Traiteur » trois fois de suite : dîner, brunch, vins. Qu'est-ce que ça va donner ? Rien ne le dit. C'est exactement le choix que je déteste. Je prends le premier bouton, celui qui parle de ne pas faire de doublons : « Valider les 8 rapprochements proposés », puis « Continuer ».
« Ce que va faire l'import — Fiches créées 6 — Fiches mises à jour 8 — Lignes rejetées 0 ». Des « fiches » ? Ce sont des lignes de budget. Aucun total : j'aurais voulu lire « 36 450,00 € » ici, avant de dire oui. Le bouton dit « Importer 14 lignes de budget » : 14, c'est mon compte, je clique.
« Import terminé — 14 créés — 0 mis à jour ». On m'annonçait 6 créées et 8 mises à jour, on me rend 14 créés. Lequel croire ? Et sur cet écran, aucun bouton pour retourner à mon mariage : « Détails du journal (fichier, auteur, dates) », « Annuler cet import », « Historique des imports ». Je repasse par le menu « Événements ».

- Note : 1
- Gestes : 10 (« Passer la visite », onglet, « Importer », dépôt, « Lire le fichier », choix de colonne, « Continuer », « Valider les 8 rapprochements proposés », « Continuer », « Importer 14 lignes de budget »)
- Questions : 1 non à l'écran « Doublons » ; 2 oui : le fichier redéposé, la colonne « Détail » rechoisie ; 3 oui : « rapprochement », « ressemblance 100 % », « propositions sûres », « Fiches mises à jour » ; 4 oui à l'écran « Doublons » : regardé en entier, pas su choisir ; 5 oui : « Abandonner l'import » avant, « Annuler cet import » après ; 6 non ; 7 non à l'écran « Doublons » (trois boutons de même poids, « Continuer » en bas) ; 8 oui : « Valider les 8 rapprochements proposés » / « Tout accepter (5 propositions sûres) » ; 9 non.
- Captures : `nav/apres/032.jpg` (« 8 rapprochements attendent votre décision »), `nav/apres/037.jpg` (« Import terminé — 14 créés », sans retour vers le mariage), `nav/apres/027.jpg` (le bandeau « Les lignes iront dans l'évènement… »)

### 3 d. Les prestataires et la liste à faire : non repris

Je n'ai pas repris `prestataires.csv` ni `a-faire.csv` : le plafond de commandes du test était atteint (les gestes refaits après l'interruption en ont mangé une part). Ce que j'ai vu sans les importer : l'onglet « Rétroplanning » du mariage n'a pas de bouton « Importer » (seulement « Appliquer le modèle » et « Nouvelle tâche »), alors que l'onglet du budget en a un ; pour ma liste à faire il faudrait donc repasser par les Paramètres, « Un autre fichier », « Tâches d'événements » — le chemin qui m'a rejeté 14 lignes sur 14 au premier essai. Et le menu « Prestataires » affiche « Carnet de prestataires — Aucun prestataire » (« Tous · 0 »), alors que six de mes prestataires sont maintenant écrits sur les lignes du budget.

- Note de l'étape 3 dans son ensemble : 1
- Captures : `nav/apres/048.jpg` (« Aucun prestataire », avec la quatrième bulle « 1 sur 4 — Les familles »)

## Étape 4 — Me tromper une fois, annuler, recommencer

Je n'ai pas eu à faire exprès. Première erreur (3 a) : j'ai lancé l'import du budget avant que le mariage existe. J'ai annulé par « Abandonner l'import » (en haut à droite, petit, souligné, pas un bouton) : « Abandonner cet import ? Le fichier et vos choix sont effacés ; rien n'a encore été importé. » — « Oui, abandonner » / « Non, continuer ». C'est net, j'ai su que rien n'était cassé. Après, pas de phrase « import abandonné » : je l'ai seulement retrouvé plus tard dans le « Journal des imports », à l'état « abandonné ». J'ai recommencé depuis la fiche du mariage (3 c) : il a fallu tout refaire, dépôt et colonne.
Deuxième erreur, que je n'ai vue qu'à l'étape 6 : « Valider les 8 rapprochements proposés » a fondu mes trois lignes de traiteur en une. Pour celle-là, il y a « Annuler cet import » sur l'écran « Import terminé ». Je l'ai vu, je ne l'ai pas essayé (plafond de commandes) : je ne sais donc pas ce qu'il défait exactement, ni s'il se retrouve une fois qu'on a quitté cet écran.

- Note : 2
- Gestes : 2 pour annuler (« Abandonner l'import », « Oui, abandonner »), puis 7 pour refaire
- Questions : 1 oui pour annuler, non pour savoir par où recommencer ; 2 oui : fichier et colonne ; 3 non ; 4 non ; 5 oui avant de confirmer (essayé) ; après, le bouton existe (pas essayé) ; 6 non ; 7 oui ; 8 « Abandonner l'import » en haut et « Retour » en bas : j'ai hésité une seconde ; 9 oui : « Abandonner l'import » a l'air d'un lien, pas d'un bouton.
- Captures : `nav/avant/028.jpg` (« Abandonner cet import ? »)

## Étape 5 — Ouvrir la fiche du mariage repris

« Événements », je clique « Juliette & Romain ». En tête : « Date de l'événement : 20 mars 2027 — 115 jours avant le jour J — Lieu : Domaine de la Roche Fictive (Vertou) ». C'est juste, c'est ce que j'ai tapé. L'onglet dit « Budget et prestataires 6/18 » : dix-huit ? J'ai quatorze lignes et huit postes.
« Prochaine action » : « Acompte · Studio Clair-Obscur · 870,00 € — En retard de 81 jours — Attend le client ». Puis le domaine, « 1 950,00 € — En retard de 71 jours », puis Maison Bellerive, « 4 000,00 € — En retard de 54 jours », et « Voir 9 de plus ». Mais ils sont payés, ces acomptes ! Ma colonne s'appelle « Acompte versé », avec la date où je l'ai versé. L'application en a fait des acomptes à payer, en retard depuis deux mois. Trois alertes fausses en ouvrant la fiche, et neuf autres lignes derrière « Voir 9 de plus », que je n'ai pas ouvertes.
Encore le bloc « Prochaine étape : appliquer le rétroplanning ». Puis « Santé de l'évènement » : « Planning — 0 sur 0 tâches faites — Aucune tâche en retard — Bon ». Bon ? Il n'y a rien dedans. « Budget — 27 502,00 € engagés — Pas d'enveloppe fixée ». « 6 lignes pourvues sur 18 ».
Ce qui est complet : la date, le lieu, les mariés, les montants du budget. Ce qui manque, vu sur l'écran : « Invités — estimés · — confirmés », « Style — », « Notes — », « Aucun temps fort pour l'instant », aucune tâche, « Pas d'enveloppe fixée ». Par quoi je continuerais : par dire que les acomptes sont versés, pour faire taire ces « En retard » — et je ne vois pas où.

- Note : 1
- Gestes : 2 (« Événements », la ligne du mariage)
- Questions : 1 non : la « Prochaine action » qu'on me donne est fausse, la « Prochaine étape » ne me concerne pas ; 2 non ; 3 « lignes pourvues », « enveloppe », « temps fort », « Renforts du jour J », « Plage occupée » : je devine les deux premiers ; 4 non ; 5 sans objet ; 6 oui : « Plage occupée — Agendas abonnés et page de réservation », « Équipe de l'évènement », « Questionnaires » ; 7 non : trois « Ouvrir », « Appliquer le modèle », « Ouvrir le budget », « Gérer l'équipe », lequel ? ; 8 oui : « Prochaine action » et « Prochaine étape », l'un sous l'autre ; 9 non.
- Captures : `nav/apres/041.jpg` (haut de la fiche ; les acomptes « En retard » sont juste sous l'écran, lus par le texte de la page)

## Étape 6 — Vérifier mon total : 36 450,00 €

Onglet « Budget et prestataires ». Il faut descendre tout en bas d'une page de plus de cinq hauteurs d'écran : dix-huit postes, cinq par écran, et l'en-tête du tableau ne suit pas — à mi-chemin je ne sais plus quelle colonne est le prévu et laquelle le réel. Tout en bas : « Total — 36 450,00 € — 27 502,00 € ». **Mon total prévu y est, au centime.** Le réel aussi : 27 502,00 €, je refais l'addition sur mon tableur, c'est ça.
Mais en remontant les lignes, je ne reconnais plus mon tableur.
« Traiteur — Maison Bellerive — 17 100,00 € — 13 640,00 € — − 3 460,00 € ». 17 100 n'existe nulle part chez moi : c'est 13 200 + 2 100 + 1 800, mon dîner, mon brunch et mes vins fondus en une ligne. Et l'écart est faux : mes 13 640 de réel, c'est le dîner seul, prévu à 13 200 — je suis 440 € au-dessus, pas 3 460 € en dessous. Pareil pour « Fleuriste — 2 720,00 € ». À côté de ça, mes deux lignes « Lieu » sont restées deux lignes (6 500,00 € et 840,00 €), sous un poste « Lieu de réception — À trouver » vide. Fondu ici, pas là. Je ne vois nulle part mon détail (« Chambres des témoins », « Brunch du dimanche, 60 couverts ») dans le tableau.
Et surtout : colonne « Réglé » : 0,00 € partout. « Reste à payer » : 27 502,00 €. J'ai versé 8 727 € d'acomptes et il me reste 18 775 € de soldes, c'est écrit dans mon fichier. « Prochaine échéance : 4 000,00 € · 2 octobre 2026 — En retard ». Total de l'écart : « − 3 898,00 € », alors que 27 502 moins 36 450 font − 8 948. La légende dit « Réglé = échéances payées ; reste à payer = réel − réglé » : ça m'explique leur calcul, pas pourquoi mes acomptes versés ne sont pas versés.
Mon total prévu est retrouvé. Mais un total diffère de mon tableur sans explication (le reste à payer) : c'est ma raison d'arrêter. Avec un mariage samedi, je ne confie pas mes paiements à un écran qui me dit que je dois 8 727 € déjà payés. **Abandon noté ici** ; je joue quand même l'étape 7 avec ce que j'ai vu.

- Note : 1 (le point auquel je tiens est retrouvé ; la raison d'abandon se présente sur le même écran)
- Gestes : 1 clic, puis le défilement jusqu'en bas (page de 4 116 px pour un écran de 768)
- Questions : 1 non : rien pour dire « cet acompte est payé » à l'endroit où je le vois en retard ; 2 non ; 3 « Engagé », « Pressenti », « Retenu » sur la même ligne : trois étiquettes, je ne sais pas ce qui les distingue ; 4 oui : le total est tout en bas de la page ; 5 oui en théorie (« Annuler cet import »), mais je ne suis plus sur cet écran ; 6 non ; 7 non : par ligne « + Ajouter des prestataires », une flèche, « Ouvrir », « Supprimer » ; 8 oui : la flèche « Voir l'échéancier » et « Ouvrir », côte à côte ; 9 oui : le nom du poste souligné (« Fleuriste ») est un lien, je ne l'aurais pas cliqué.
- Captures : `nav/apres/045.jpg` (le tableau à 1366 px : « Fleuriste — 2 720,00 € — 0,00 € — 2 250,00 € — En retard », « Supprimer » coupé en « Su », en-têtes hors de vue)

## Étape 7 — Les trois choses qui restent à compléter

Sans aide, avec mon tableur sous les yeux :
1. **Ma liste à faire** : douze tâches ouvertes (trouver un vidéaste, relancer les devis de navette, la liste des morceaux, le menu…). Ici : « Aucune tâche pour cet événement », « 0 tâche faite sur 0 ».
2. **Mes prestataires** : les contacts, téléphones, mails et notes de ma feuille. Ici : « Carnet de prestataires — Aucun prestataire ». Seuls leurs noms sont sur les lignes du budget.
3. **Les paiements** : dire que six acomptes sont versés (8 727 €) et remettre mes soldes à leurs dates. Ici : « Réglé 0,00 € » et tout « En retard ».
Et les trois « à trouver » de mon budget : le vidéaste (2 200 €), le trio de la cérémonie (650 €), la navette (900 €).

L'application me les a-t-elle dites ? En partie, et noyées. Elle écrit bien « À trouver » sur « Photo et vidéo 2 200,00 € », « Musique 650,00 € » et « Transport des invités 900,00 € » : ça, c'est juste, et je ne lui avais rien dit. Mais elle écrit aussi « À trouver » sur neuf postes vides à elle (« Lieu de réception », « Photographe », « DJ / musiciens », « Vidéaste »…) que j'ai déjà sous d'autres noms : douze « À trouver », trois vrais. Pour les tâches, elle me dit « Planning — Bon ». Pour les prestataires, rien. Pour les paiements, elle me dit le contraire de la vérité. Et ce qu'elle me présente comme la suite, « Prochaine étape : appliquer le rétroplanning », n'est aucune de mes trois choses. Je les cite parce que je connais mon classeur, pas parce que l'écran me les a données.

- Note : 1
- Gestes : 2 (onglet « Rétroplanning », menu « Prestataires »)
- Questions : 1 non ; 2 non ; 3 « Rétroplanning » je connais ; « lignes pourvues » non ; 4 oui : trois endroits à visiter pour reconstituer ce qui manque ; 5 sans objet ; 6 non ; 7 non ; 8 oui : « Appliquer le modèle » et « Nouvelle tâche » pour remplir la même liste vide, et pas d'« Importer » ; 9 non.
- Captures : `nav/apres/048.jpg` (« Aucun prestataire »), `nav/apres/045.jpg` (les « À trouver » en série)

## Petits détails qui m'ont gênée

- Partout : quatre bulles de visite en quatre pages, chacune après avoir cliqué « Passer la visite » sur la précédente : « 1 sur 4 — Votre priorité du jour » (accueil), « 1 sur 5 — La liste » (Événements), « 1 sur 5 — Les onglets » (fiche), « 1 sur 4 — Les familles » (Prestataires). Plus deux encadrés « Découvrir en 2 minutes » et « Découvrir en 4 minutes — Commencer le tutoriel / Plus tard ». `nav/avant/015.jpg`, `nav/apres/021.jpg`, `nav/apres/048.jpg`
- Accueil : « Reprendre le questionnaire » pour un questionnaire que je n'ai jamais commencé.
- Questionnaire : la pastille « 5. Outils » est plus haute que les quatre autres. `nav/avant/003.jpg`
- Questionnaire, question 5 : « « Passer » garde la réponse proposée. » alors qu'aucune case n'est cochée. `nav/avant/011.jpg`
- Événements : deux orthographes sur le même écran, « Événements », « La fiche d'un événement », et « Aucun évènement pour l'instant », « Créer un évènement ». `nav/avant/016.jpg`
- Champs de date : « mm/dd/yyyy », à l'américaine ; champs de fichier : « Choose File — No file chosen ». (Peut-être le navigateur du test plutôt que l'application : à vérifier.) `nav/avant/014.jpg`, `nav/avant/022.jpg`
- Page d'import : dans la case « Reprendre mes contacts », le deux-points se retrouve seul en début de ligne : « Chaque ligne devient un contact / : nom, coordonnées et notes. » `nav/avant/018.jpg`
- Page d'import : « Fichier (CSV, Excel .xlsx ou JSON) », « L'encodage, le séparateur et la ligne d'en-tête sont reconnus automatiquement. » : des mots d'informaticien.
- « Importer » depuis Événements ou depuis le budget : j'arrive en bas de la page, sur le champ de fichier, sans avoir vu le titre. `nav/avant/017.jpg`, `nav/apres/027.jpg`
- Nouvel événement : l'astérisque de « Type d'événement » est seul sur sa ligne, sous le libellé. `nav/avant/032.jpg`
- Colonnes : la liste déroulante coupe « Ligne du budget (obliga » ; dans l'aperçu, « 6 500,00 € » s'écrit sur trois lignes (« 6 / 500,00 / € ») et « Domaine de la Roche Fictive » sur quatre. `nav/avant/023.jpg`, `nav/avant/025.jpg`
- Rejet : « Téléchargez le rapport pour les corriger dans votre tableur » alors qu'il n'y a rien à corriger dans le tableur ; et l'étape « Doublons — 14 nouveaux, aucune mise à jour » au-dessus de « Lignes rejetées 14 ». `nav/avant/027.jpg`
- Vérification : « Créations (échantillon des 6 lignes) » n'en montre que cinq ; « Fiches créées » pour des lignes de budget.
- Import terminé : « 0 ignorée (vide, en erreur ou inchangée) », « 0 colonne gardée comme note » ; « 14 créés » écrit deux fois, une fois souligné, une fois en pastille. `nav/apres/037.jpg`
- Fiche : la rangée d'onglets est coupée à droite, « Documen ». `nav/apres/021.jpg`
- Fiche : « Option — 25 novembre 2026 », « Confirmé — 25 novembre 2026 » : la date d'aujourd'hui, pour un contrat signé en septembre.
- Onglet budget : en l'ouvrant, l'écran montre le bloc « Prochaine étape : appliquer le rétroplanning », pas le budget. `nav/apres/025.jpg`
- Onglet budget : « Réglages : Paramètres des lignes du budget par défaut » ; « Détail du budget (simulation, HT, exports) ».
- Tableau du budget à 1366 px : « Supprimer » coupé en « Su », le bouton « Ouvrir » coupé sur la ligne « Fleuriste », « + Ajouter des prestataires » sur deux lignes, « 675,00 € · 20 octobre 2026 » sur trois lignes, en-têtes de colonnes qui disparaissent en descendant. `nav/apres/045.jpg`

## Bilan

- Mesures du parcours :
  - *Je sais toujours si l'import a tout pris* : **non tenue**. Le compte de lignes est bien suivi (« Fichier — 14 lignes », « Importer 14 lignes de budget », « 14 créés »), mais « 6 créées, 8 mises à jour » devient « 14 créés, 0 mis à jour », dix-huit postes s'affichent pour quatorze lignes, trois lignes de traiteur n'en font plus qu'une, et je ne retrouve pas ma colonne « Détail » dans le tableau. Deux fichiers sur trois non repris (plafond du test).
  - *Aucun chiffre ne diffère sans explication* : **non tenue**. Total prévu 36 450,00 € et réel 27 502,00 € : exacts. Mais « Réglé 0,00 € » et « Reste à payer 27 502,00 € » (chez moi 8 727 € versés, 18 775 € restants), six acomptes « En retard » qui sont payés, « Traiteur 17 100,00 € » et son écart « − 3 460,00 € », total d'écart « − 3 898,00 € ».
  - *Je peux annuler* : **tenue avant la confirmation** (« Abandonner l'import », essayé, phrase claire). Après : bouton « Annuler cet import » vu sur « Import terminé », non essayé.
  - *Je cite les trois choses à compléter* : **oui, mais de mémoire**, par mon tableur ; l'application n'en donne aucune des trois clairement, et sa « Prochaine étape » est ailleurs.
- Abandons : un, à l'étape 6. Raison de ma fiche : un total de budget diffère de mon tableur sans explication (réglé et reste à payer ; acomptes versés comptés comme dus et en retard). Mon total prévu, lui, est juste. Non joué faute de commandes : la reprise de `prestataires.csv` et de `a-faire.csv`, l'essai de « Annuler cet import ».
- Les trois choses qui m'ont le plus gênée :
  1. Mes « acomptes versés » devenus des acomptes à payer, « En retard de 81 jours — Attend le client », avec « Réglé 0,00 € ».
  2. Personne ne m'a dit par où reprendre un mariage : « Et maintenant ? » propose de créer ou d'explorer ; l'import est dans les Paramètres ; il m'a laissé aller jusqu'au quatrième écran avant « événement introuvable ou ambigu », 14 fois, sans me dire de créer le mariage d'abord. Et le mariage lui-même, je l'ai tapé à la main.
  3. L'écran « 8 rapprochements attendent votre décision » : trois boutons, des pourcentages, et un choix dont je n'ai vu la conséquence (le traiteur à 17 100 €) qu'après coup.
- Les trois que j'ai aimées :
  1. Mes colonnes reconnues toutes seules, « 8 sur 9 », avec mes mots à gauche et l'aperçu de ma première ligne à droite.
  2. « (poste repris de la ligne 4) » : il a compris que je n'écris le poste qu'une fois. Et le total prévu tombe juste, 36 450,00 €.
  3. « Abandonner cet import ? Le fichier et vos choix sont effacés ; rien n'a encore été importé. » et, depuis la fiche, « Les lignes iront dans l'évènement « Juliette & Romain » ».
- Ma phrase, en sortant : « Le total est bon, mais il me dit que je n'ai rien payé et que j'ai six acomptes en retard : je n'ai pas le temps de tout recompter, j'ai un mariage samedi. »
