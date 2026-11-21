# Recette de la wedding planner du 21/11/2026 — analyse des retours

Document de travail, avant spécification. Aucun code n'est modifié. Chaque retour est relié à
l'écran et au code qui le porte, puis à une proposition ; les maquettes sont dans
`docs/maquette/Recette-planner.html` (repère **M1** à **M10**). Le découpage en lots et les
questions à trancher sont à la fin.

**Mise à jour du 21/11 (retour de Julien sur la première version)** : décisions reportées en
§ 12 ; les retours #2, #26, #21 et #32 sont réécrits en conséquence ; nouveau § 8 bis sur les
échéances de paiement des prestataires.

Légende de gravité, dans l'ordre d'arbitrage du cahier des charges (§ 1) :

- **Bogue** : l'écran fait autre chose que ce qu'il annonce. À corriger d'abord.
- **Parcours** : un parcours P0 bloque ou égare (démarrage, création d'évènement, import, devis).
- **Confort** : l'écran marche, mais il coûte des clics ou de la réflexion.

## 1. Démarrage et prise en main

| # | Retour | Constat dans le code | Proposition | Gravité | Maquette |
|---|---|---|---|---|---|
| 1 | Après chaque action de « Pour bien démarrer », on reste dans les Paramètres (ex. logo → « Entreprise et TVA », sous-écran « Mentions et logo »), sans guide. | `lib/onboarding/checklist.ts` : chaque ligne est un simple lien (`/parametres#logo`, `/devis`, `/events`…). Aucun retour à l'accueil, aucune suite. | **Assistant « L'essentiel »** : un formulaire en étapes, une question par écran (façon Typeform), qui écrit dans les mêmes réglages : société et SIRET, adresse, logo, régime de TVA, coordonnées bancaires, numérotation des devis et des factures. Barre d'avancement, « Passer » sur ce qui n'est pas obligatoire, retour à l'accueil à la fin. Les Paramètres restent pour modifier ensuite. | Parcours | M1 |
| 2 | « Inviter un client sur son espace » arrive trop tôt ; ce ne sera pas systématique. | Ligne `client_invite` de la liste de démarrage. | **Décidé** : « Pour bien démarrer » ne garde que ce qui est indispensable pour travailler (« Régler l'essentiel », « Ajouter un premier prestataire »). « Inviter un client sur son espace », « Préparer un premier devis » et « Importer vos contacts » deviennent des **tutoriels** du centre d'aide : ils n'encombrent pas l'accueil tant qu'elle ne les fait pas. | Confort | M1 |
| 3 | Il manque une visite guidée : fenêtre sur fond grisé, puis mise en avant des zones importantes. | `app/page-tour.tsx` et `packages/ui/src/landmarks.tsx` : des repères numérotés, volontairement sans blocage (lot 13, décision C). | **Visite guidée** par écran, en plus des repères : fond assombri, la zone mise en avant reste claire, une bulle explique, « Précédent », « Suivant », « Passer la visite ». Lancée seule à la première visite des écrans clés, relançable depuis « ? ». Sur téléphone : une bulle en bas de l'écran, sans découpe. | Confort | M2 |
| 4 | Le tutoriel doit dire qu'il supprimera les exemples à la fin (un évènement s'annule, il ne se supprime pas). | Les données `is_demo` sont bien purgées (ADR 0056), mais aucun texte ne le dit au départ. | Phrase en tête de chaque tutoriel qui crée des données : « Symbola crée un exemple, marqué EXEMPLE. Il disparaît à la fin du tutoriel, avec tout ce qu'il contient. Vos vrais évènements ne sont pas touchés. » | Confort | M10 |
| 5 | En ouvrant l'exemple, on perd le tutoriel. Reprendre le tutoriel après la vérification du devis est « une galère ». | Le tutoriel vit sur sa page (`app/aide/tutoriels/[key]`) : ouvrir l'exemple fait quitter cette page. | **Tutoriel dans le panneau latéral** : il reste ouvert pendant qu'on navigue dans l'exemple, l'étape en cours se coche seule quand l'action est faite, « Étape suivante » mène au bon écran. | Parcours | M10 |
| 6 | Le tutoriel dit « Envoyer en signature », l'écran du devis dit « Faire signer ». | `Tutorials…title` = « Envoyer en signature » ; bouton du devis `nextSign` = « Faire signer ». | Un seul mot : **« Faire signer »**, dans le tutoriel comme sur le devis. Contrôle automatique : chaque libellé de bouton cité par un tutoriel doit exister à l'écran. | Bogue | — |
| 7 | Après avoir signé à la place d'un marié, le lien de retour éjecte de la plateforme. | `app/signature-fictive/[token]/page.tsx` : « Revenir à mon espace » pointe vers `/portail` (l'espace du client), pas vers l'app. | En mode exemple, après la signature : **« Revenir au devis »**, qui rouvre la fiche du devis dans l'app, tutoriel toujours ouvert. | Bogue | M10 |
| 8 | Message de fin « L'exemple est réglé selon votre choix… » incompréhensible ; fin du tutoriel sur l'écran Aide avec « Bravo, tutoriel terminé ». | `Tutorials.doneBody`. | Dire ce qui s'est passé et la suite : « Tutoriel terminé. L'exemple a été supprimé. Prochain tutoriel conseillé : … » ; revenir à l'écran d'où le tutoriel a été lancé. | Confort | M10 |

## 2. Aujourd'hui

| # | Retour | Constat | Proposition | Gravité | Maquette |
|---|---|---|---|---|---|
| 9 | Le calendrier des évènements devrait être sur « Aujourd'hui » (évite « Évènements » puis « Calendrier »). | `app/accueil/today-view.tsx` liste « Mes évènements » ; le calendrier est dans `/events?affichage=calendrier`. | Un **calendrier du mois** sur l'accueil, à droite des priorités : évènements, rendez-vous et échéances de tâches, couleur par catégorie, clic sur un jour pour voir le détail. | Confort | M3 |
| 10 | « Chaque alerte dit sa règle » : laconique, inquiétant, inutile. | `fr.json` ligne 10544 (`intro` du radar). | **Supprimer la phrase.** Chaque alerte garde son « Pourquoi ? » dépliable. | Confort | M3 |

## 3. Prestataires

| # | Retour | Constat | Proposition | Gravité | Maquette |
|---|---|---|---|---|---|
| 11 | Le vocabulaire « Déjà retenu » n'est pas idéal. | Filtre `filterWorkedWithLabel`. | **« Déjà travaillé ensemble »**. | Confort | M4 |
| 12 | Pas de remise à zéro des filtres. | `app/prestataires/page.tsx`. | Bouton **« Effacer les filtres (3) »**, visible dès qu'un filtre est actif, et chaque filtre actif en pastille retirable. | Confort | M4 |
| 13 | « Autour de » et « dans un rayon de » devraient être associés. | Deux champs séparés dans la barre de filtres. | Un seul bloc **« Où ? »** : lieu, puis rayon en court champ à côté (« à 30 km »). | Confort | M4 |
| 14 | Un prestataire exerce plusieurs métiers (officiante et décoratrice ; photographe et vidéaste ; coiffure et maquillage) : une seule fiche, plusieurs métiers, les étiquettes de chaque métier. L'import a créé trois types : Photographe, Vidéaste, « Photographe et vidéaste ». | Une fiche n'a **qu'un type** (`vendors.type_id`). Le synonyme « Photographe & Vidéaste » a donné naissance à un troisième type. | **Plusieurs métiers par fiche** : un métier principal (couleur et icône sur la carte) et des métiers secondaires ; les étiquettes et les champs de chaque métier coché s'ajoutent. Les filtres trouvent la fiche par n'importe lequel de ses métiers. À l'import, « Photographe et vidéaste » devient **deux métiers** sur la même fiche. Migration des types combinés existants. **Change le schéma des prestataires.** | Parcours | M4 |

## 4. Import

| # | Retour | Constat | Proposition | Gravité | Maquette |
|---|---|---|---|---|---|
| 15 | Clic sur « Importer » : rien n'indique que ça charge. | `app/import/job-progress.tsx` existe, mais rien n'apparaît au clic. | **Fenêtre de chargement** (ordinateur) : étapes lues, nombre de lignes traitées, « Vous pouvez fermer : l'import continue ». Sur téléphone, la même chose en haut de page. | Parcours | M5 |
| 16 | Les rapprochements proposés ne permettent pas de vérifier (« Benjamin » rapproché de « Benjamin Dupuy » par erreur). | `app/import/[importId]/rapprochements/page.tsx` : la ligne du fichier montre le nom et la ville, la fiche proposée **son nom seul** (`option.label`). | **Comparaison côte à côte** : ligne du fichier et fiche existante, avec métier, ville, e-mail, téléphone ; les valeurs qui diffèrent sont soulignées ; trois choix explicites : « C'est le même », « Ce sont deux prestataires », « Décider plus tard ». | Bogue (perte de données possible) | M5 |
| 17 | Fin d'import confuse : « Annuler l'import » domine, puis « Annuler quand même : Prestataire : Sans intitulé / Benjamin » ; « Voir les 34 prestataires » ne filtre pas ; « Retour aux imports » ne ramène pas aux prestataires. | `app/import/[importId]/journal` ; `undoForce` ; lien vers `/prestataires` sans filtre. | **Bilan d'abord** : créés, mis à jour, ignorés, chacun cliquable. Bouton principal **« Vérifier les 34 prestataires »** qui ouvre la liste filtrée sur cet import (pastille « Import du 21/11 », retirable). **« Revenir à mes prestataires »** en secondaire. L'annulation descend dans un bloc replié « Annuler cet import », qui nomme les fiches modifiées depuis et dit pourquoi (« modifiée à la main le 21/11 à 15 h 02 »). | Parcours | M5 |
| 18 | Le menu « Importer » rangé dans « Prestataires et données » n'est pas évident : on importe aussi des évènements, des budgets… | Import central sous les Paramètres. | **Importer depuis chaque écran** : bouton « Importer » dans Prestataires, Évènements, Contacts, Invités, Budget, Programme ; il ouvre l'import déjà réglé sur le bon type. L'écran central reste, pour l'historique. | Confort | M7 |
| 19 | Import d'évènements : « Enregistrer les statuts » remet « Confirmé » à la place du statut choisi ; la synthèse affiche « Confirmé » alors que l'évènement créé est bien « En préparation ». | `confirmation/page.tsx` : la liste reprend la valeur lue dans le fichier (`row.values.status`), pas le statut enregistré par `setEventSheetStatuses`. L'enregistrement marche, l'affichage ment. | **Corriger** : afficher le statut enregistré partout (liste et synthèse) ; enregistrer à chaque choix, sans bouton séparé. Test de non-régression. | Bogue | — |
| 20 | Nouveau type d'import : le planning du jour J, en PDF. | `program-import-form.tsx` n'accepte que CSV et XLSX (lot 51). | **Lire le PDF de programme de l'ancien logiciel** (exemple reçu le 21/11, voir § 4 bis), puis le même écran de contrôle que le tableur. | Confort | — |
| 21 | Budget importé : il manque prévisionnel, devisé, écart, réglé, reste à payer. | La base a déjà `estimated`, `quoted`, `committed`, `paid` (`schema/budget.ts`) ; l'import des fiches ne lit que « Budget souhaité », « Total payé », « Solde ». | **Colonnes de l'import et de l'écran** : Prévu, **Réel** (décidé : « Devisé » devient « Réel » en français), **Écart** (réel − prévu, pour affiner les prochaines prévisions), Réglé (somme des échéances payées), **Reste à payer** (réel − réglé), **Prochaine échéance**. Voir Q4 sur « Engagé ». | Parcours | M9 |
| 22 | « Garder en champ libre » ne parle pas. | `gapsKeep`, `columnTargetFree`. | L'étape des colonnes devient un **tableau à trois colonnes** : « Colonne de votre fichier » (avec deux valeurs d'exemple), « Devient sur la fiche » (un menu : un champ nommé, « Une note sur la fiche », « Ne pas importer »), et un **aperçu de la fiche** qui montre où la valeur atterrit. Le mot « champ libre » disparaît. (La première version, trois boutons radio par colonne, n'était pas claire.) | Confort | M5 |
| 23 | Phrase coupée : « De plus, les champs automatiquement renseignés… ». | — | **À compléter** (Q7). | — | — |

## 4 bis. Le PDF de programme reçu le 21/11 (#20)

Deux exemples fournis par Julien le 21/11, deux mariages différents (**les fichiers ne sont
pas versés au dépôt**, qui est public : ils contiennent des noms et des numéros de téléphone). C'est l'export « programme » du même
logiciel que celui dont Symbola lit déjà les fiches d'évènement en PDF (profil
`planningSoftware` de `packages/starter-templates/src/import-profiles.json`, lecture par
`pdfjs-dist` dans `packages/import-engine/src/pdf.ts`). Sa structure, sur huit pages A4 en
paysage :

- **En-tête** (pages 1 et 2) : titre de l'évènement, date, mariés et téléphones, planner, lieux
  avec date et heure, résumé des invités, puis un **tableau des intervenants** : rôle (« DJ »,
  « Traiteur », « Coiffeur(se) - Maquilleur(se) »…), nom, contact, téléphone, Instagram.
- **Programme** (pages 3 à 7) : un tableau à colonnes fixes, **Heure**, **Titre**,
  **Description**, **Interlocuteur**, « Caché des mariés ». Il est découpé par **jour** (un
  bandeau « vendredi 4 décembre », « samedi 5 décembre », « dimanche 6 décembre » : le programme
  couvre la veille et le lendemain). L'heure est soit ponctuelle (« 13:00 »), soit une plage
  (« 12:15 - 13:30 », y compris après minuit : « 19:00 - 02:00 »).
- La **description** court sur plusieurs lignes et parfois **sur deux pages** (menus,
  déroulé de la cérémonie). Elle a du gras, de l'italique et de la couleur, qui se perdent.
- Les **interlocuteurs** s'écrivent « Rôle - Prénom », plusieurs par séquence, une puce de
  couleur par rôle ; le rôle retrouve un intervenant de l'en-tête.

**Pièges relevés sur les deux exemples**, à couvrir par des tests (fichiers de test fabriqués,
aux noms inventés) :

1. **« 00:00 » veut dire « pas d'heure »** : « 11:00 - 00:00 » est une séquence sans heure de
   fin, « 00:00 » seul une tâche sans heure ; mais « 19:00 - 02:00 » finit bien après minuit.
   Règle : une fin à 00:00 pile est absente ; une fin plus tôt que le début passe au lendemain.
2. **Une ligne-repère sans interlocuteur** (« Coucher du soleil », sur un bandeau coloré) : un
   repère horaire du programme, pas une séquence de travail.
3. **Des interlocuteurs sans rôle** (un témoin, un marié, désignés par leur seul prénom) : gardés
   en texte, jamais rattachés à un prestataire.
4. **Un rôle en double** : deux traiteurs, ou la planner listée deux fois (« Wedding Planner » et
   « WeddingPlanner »). On rapproche par rôle **et** nom, et l'on ignore la planner elle-même.
5. **Le nom après le rôle n'est pas toujours le prénom** (« DJ - » suivi du nom de famille) : on
   cherche dans le prénom, le nom et la raison sociale de l'intervenant.
6. **« Caché des mariés » rempli** (« Oui ») sur certaines lignes : la séquence n'est pas
   partagée avec les mariés.
7. **Le résumé des invités change de colonnes** d'un export à l'autre (Adulte, Enfants, Total ;
   ou Enfants, Homme, Femme, Adultes, Total) : à lire par l'intitulé, ou à ignorer (les invités
   ont leur propre import).

Les descriptions contiennent parfois un sous-planning (« 08h30 - … (Elodie) » pour les
préparatifs) : il reste dans la note de la séquence, on ne le découpe pas.

**Ce que l'import en ferait** : une séquence par ligne (jour, début, fin, titre, description en
note), les interlocuteurs rattachés aux prestataires de l'évènement par leur rôle (et à défaut
gardés en texte), « Caché des mariés » repris dans le partage de la séquence. L'en-tête sert à
proposer de rattacher les intervenants aux prestataires du catalogue (même écran de
rapprochement qu'en M5). Les colonnes se repèrent par leurs titres et leur position, comme pour
les fiches d'évènement. Faisable dans le paquet 63b ; c'est un nouveau profil de données, pas
une nouvelle dépendance.

## 5. Évènement : création, liste, rétroplanning

| # | Retour | Constat | Proposition | Gravité | Maquette |
|---|---|---|---|---|---|
| 24 | On ne trouve pas où créer un évènement ; l'onglet ne propose que « Nouveau prospect » ; impossible de créer un évènement sans prospect (shooting photo) ou pour un client déjà connu. | `app/events/page.tsx` : seul bouton `/events/new` (prospect). La route accepte déjà `?type=evenement` (évènement confirmé) et `?contact=` (client existant), mais aucun bouton n'y mène. | Bouton **« Nouveau »** avec trois choix : « Prospect (demande à étudier) », « Évènement confirmé », « Pour un client existant » ; le client devient facultatif pour un évènement confirmé. | Parcours | M7 |
| 25 | En vue colonnes (kanban), on perd les boutons et on revient mal à la liste. | `app/events/pipeline` a sa propre page et son propre en-tête. | **Même en-tête** sur les trois vues, sélecteur **Liste / Colonnes / Calendrier** toujours au même endroit. | Confort | M7 |
| 26 | Un prospect de type « Autres » reçoit des tâches de mariage et un rétroplanning. | `modules/events/service.ts` : « le rétroplanning du type naît avec l'événement, Option comprise » (lot 34a, **décision D8**) ; un type sans modèle reprend le **premier modèle créé** de l'organisation (`findDefaultTaskTemplateId`), en pratique celui du mariage : d'où les tâches de mariage sur « Autres ». | **Décidé** : aucun évènement ne reçoit un rétroplanning d'office, et plus jamais celui d'un autre type. **À la création**, si le type choisi a un modèle (le mariage, ou tout type pour lequel la planner en a créé un), le formulaire **le propose** (« Partir du rétroplanning Mariage : 24 tâches », case à cocher). Si le type n'a pas de modèle, une **astuce** à la place : « Vous organisez souvent ce type d'évènement ? Créez un modèle de rétroplanning : vos tâches habituelles seront prêtes à chaque nouvel évènement. » Le modèle reste applicable plus tard depuis l'onglet Rétroplanning. | Bogue | M7 |
| 27 | Renommer l'onglet « Budget » en « Budget et prestataires ». | Onglet de la fiche. | Renommer. | Confort | M9 |
| 39 | Dans l'onglet Budget, on nomme une ligne, mais on ne peut pas y rattacher un prestataire du catalogue, alors que c'est l'idée. | La ligne du budget (`budget-line-forms.tsx`) n'a qu'un nom, un prévu et une icône. Le rattachement existe, mais sur une page à part : la consultation du poste (`app/events/[id]/consultation/[slotId]`, prestataires consultés puis « Retenir »). Rien n'y mène depuis la ligne. | Sur chaque ligne, un champ **« Prestataire »** qui cherche dans le catalogue, filtré sur le métier du poste (« Traiteur » propose d'abord les traiteurs ; les fiches « Déjà travaillé ensemble » en tête). Le choisir le **retient** pour ce poste. « Comparer plusieurs prestataires » ouvre la consultation ; « Nouveau prestataire » le crée sans quitter le budget (fenêtre). | Parcours | M9 |
| 28 | L'onglet « Devis » ne contient que mes devis, pas ceux des prestataires. | Onglet du module `quotes`. | Renommer **« Mes devis et factures »** ; les devis des prestataires vont dans « Budget et prestataires », sur la ligne du prestataire. | Confort | M9 |
| 29 | Les boutons roue crantée « Réglages » envoient vers un autre onglet : on perd son parcours. | `app/settings-link.tsx` : lien vers la page de réglages. | Sur ordinateur, les réglages d'un écran s'ouvrent dans un **panneau latéral** au-dessus de l'écran courant ; on le ferme et on est où on était. Sur téléphone, page avec « Retour à … ». | Confort | M8 |

## 6. Documents de l'évènement

| # | Retour | Constat | Proposition | Gravité | Maquette |
|---|---|---|---|---|---|
| 30 | Deux options pour déposer un document, écran peu clair ; elles disparaissent après le premier dépôt ; « Lire l'aide » mène aux tutoriels sans filtre. | `documents-tab.tsx` : l'état vide propose deux formulaires, puis un seul reste. | **Une seule zone de dépôt**, toujours en tête (glisser-déposer sur ordinateur), qui demande **ce que c'est** : devis d'un prestataire, facture d'un prestataire, contrat, autre. Lien d'aide vers l'article des documents, pas vers la liste des tutoriels. | Parcours | M8 |
| 31 | Un devis déposé part dans « Divers » ; on ne peut pas le glisser vers « Devis ». | Les dossiers « Devis », « Factures » sont des dossiers fixes du module `quotes` (lecture seule) ; le dépôt libre va dans « Divers ». | Le type choisi au dépôt range la pièce dans **« Devis des prestataires »** (dossier de l'équipe, rattachable à une ligne du budget). Déplacement par **glisser-déposer** sur ordinateur et par **« Déplacer vers… »** partout. Les dossiers « Mes devis » et « Mes factures » restent en lecture. | Parcours | M8 |

## 7. Tâches et rétroplanning

| # | Retour | Constat | Proposition | Gravité | Maquette |
|---|---|---|---|---|---|
| 32 | Liste des tâches : pas de modification, de report, d'action rapide. | `app/taches/task-table.tsx` : case, libellé, évènement, échéance, responsable, statut ; pas d'action de ligne. | **Actions sur la ligne** : « Modifier », « Reporter » (+1 jour, +1 semaine, choisir une date), **« Supprimer », visible sur la ligne** (avec « Annuler » pendant quelques secondes, pas de confirmation) ; échéance modifiable d'un clic dans la cellule. Clic sur la ligne : **fenêtre modale** de la tâche, tous les champs, « Enregistrer ». | Parcours | M6 |
| 33 | Cocher donne l'impression de sélectionner la ligne, pas de la marquer « Fait ». | `task-check.tsx` : une case seule en première colonne. | Deux gestes séparés : un **bouton « Fait »** (rond à coche, libellé visible au survol et lu par le lecteur d'écran) et, à gauche, une case de **sélection** pour les actions groupées, avec « Tout sélectionner ». | Bogue (ambiguïté) | M6 |
| 34 | Rétroplanning : impossible de tout sélectionner ; modifier oblige à cliquer sur le titre complet ; écrans trop complexes. | Rétroplanning de la fiche : la ligne s'ouvre par son titre (lot 62, « Liste éditable »). | Même tableau que la liste des tâches : sélection, actions groupées (décaler de N jours, changer de responsable, supprimer), **édition en place** de l'échéance et du responsable. | Parcours | M6 |
| 35 | Catégories de tâches par couleur dans l'agenda, pour juger de la priorité. | Pas de catégorie de tâche. | **Catégories de tâches** paramétrables (couleur, libellé ; modèle de départ : Client, Prestataires, Administratif, Jour J) et **priorité** (haute, normale). Affichées dans la liste et dans le calendrier. **Change le schéma des évènements.** | Confort | M3, M6 |
| 36 | « Les écrans de choix » souffrent des mêmes difficultés que les tâches. | Choix des prestataires (`vendor-candidates.tsx`), décisions. | Même motif de ligne : actions visibles, fenêtre modale au clic. | Confort | — |

## 8. Devis

| # | Retour | Constat | Proposition | Gravité | Maquette |
|---|---|---|---|---|---|
| 37 | Reprendre l'adresse de facturation des mariés ferait gagner du temps à l'envoi. | Formulaire d'envoi du devis. | Choix **« Adresse de facturation : celle de [client] »** pré-rempli, modifiable. | Confort | — |
| 38 | Il manque souvent l'astérisque des champs obligatoires (l'envoi du devis « une galère »). | Pas de règle commune. | Règle du design system : tout champ obligatoire porte **« * »** et le formulaire dit « * obligatoire » ; à l'envoi, la liste de ce qui manque, avec un lien vers chaque champ. Contrôle automatique (`required` ⇒ astérisque). | Parcours | — |

## 8 bis. Échéances de paiement des prestataires (vérification demandée le 21/11)

**Ce qui existe** (lot 28b, BUD-03, complété aux lots 27a, 43, 51 et 53) :

- Chaque ligne du budget peut porter des **échéances** : libellé, montant fixe ou pourcentage du
  montant du prestataire (recalculé s'il change), date due, date de paiement, payeur désigné
  (les mariés par défaut). Le réglé de la ligne est la somme de ses échéances payées.
- On les crée sur la page **Budget** de l'évènement (`/budget/[id]`), ligne par ligne
  (« Ajouter une échéance »), et on les y retrouve dans un **échéancier regroupé par
  prestataire** : engagé, payé, reste, puis les échéances dans l'ordre des dates
  (`app/budget/[eventId]/vendor-schedule.tsx`).
- **Aujourd'hui** remonte les échéances non payées dues dans les **7 jours, retards compris**
  (`listUpcomingVendorPayments`).
- Un **rappel par e-mail au payeur** part 7 jours avant (délai réglable), si l'automatisme est
  actif (lot 53).
- Le client voit ses échéances sur son **espace** et peut y déclarer un virement, que la planner
  confirme ou refuse (lot 27a). Une échéance peut être « à remettre le jour J » et se pointer
  dans le mode Jour J (lot 51).

**Ce qui manque, et qui explique qu'on ne les trouve pas :**

| # | Constat | Proposition | Maquette |
|---|---|---|---|
| 40 | L'onglet Budget de la **fiche évènement** ne montre pas les échéances : il faut passer par le lien vers la page Budget séparée. Deux écrans de budget pour un même évènement. | Dans « Budget et prestataires », une colonne **« Prochaine échéance »** (montant et date, pastille « En retard » si dépassée) ; la ligne se déplie sur son échéancier, avec « Ajouter une échéance » et « Marquer payée ». | M9 |
| 41 | Les échéances ne sont **pas dans le calendrier** (ni l'agenda, ni le futur calendrier d'Aujourd'hui). Au-delà de 7 jours, rien ne les montre hors de la page Budget. | Les échéances dans le calendrier d'Aujourd'hui (catégorie « Paiements »), et une liste **« Paiements à venir »** tous évènements confondus, filtrable par mois. | M3 |
| 42 | L'**import** d'un budget ne crée pas d'échéances (il écrit des montants). | À l'import, lire si elles existent les colonnes « Acompte », « Date de l'acompte », « Solde », « Date du solde » et créer les échéances correspondantes ; sinon rien, comme aujourd'hui. | — |

## 9. Principe transverse : l'ordinateur a droit à plus

La remarque finale vaut pour tout ce qui précède : sur ordinateur, on peut offrir des gestes
propres à l'ordinateur (fenêtre modale de chargement, de modification, panneau latéral de
réglages, glisser-déposer), du moment que le téléphone garde un chemin équivalent. À écrire dans
`DESIGN.md` :

- **Fenêtre modale (ordinateur)** : pour un chargement, une modification rapide, une
  confirmation. Fond assombri, Échap ferme, le focus reste dedans. Sur téléphone, elle devient
  une page entière avec « Retour ». Jamais deux fenêtres empilées (règle existante).
- **Panneau latéral** : pour les réglages d'un écran, sans quitter l'écran.
- **Glisser-déposer** : toujours doublé d'un bouton (« Déplacer vers… »), pour le clavier et le
  téléphone.

## 10. Découpage proposé (lot 63, en six paquets ; spécification : `docs/lots/lot-63-retours-recette-planner.md`)

Ordre d'arbitrage : bogues et risques de données d'abord, puis parcours P0, puis confort.

| Paquet | Contenu | Migration | Taille |
|---|---|---|---|
| **63a — Corrections et mots** | #6, #7, #8 (texte), #10, #11, #12, #13, #19, #26, #27, #28, #37, #38, #2 et #4 | Non | Petit |
| **63b — Import** | #15, #16, #17, #18, #21, #22, #42 (#20 si Q5 a des exemples) | Non (sauf Q4) | Moyen |
| **63c — Évènements, documents, budget, réglages** | #24, #25, #29, #30, #31, #39, #40 | Peut-être (dossier « Devis des prestataires ») | Moyen |
| **63d — Tâches et Aujourd'hui** | #9, #32, #33, #34, #35, #36, #41 | **Oui** (catégories et priorité de tâche) | Moyen |
| **63e — Prestataires multi-métiers** | #14 | **Oui** (métiers d'une fiche, reprise des types combinés) | Moyen |
| **63f — Démarrage et visite guidée** | #1, #3, #5, #8 | Non | Moyen |

63a peut partir dès ta validation ; 63b, 63c et 63f sont indépendants et peuvent avancer en
parallèle ; 63d et 63e changent le schéma, donc attendent ton accord sur la spécification.

## 11. Questions à trancher

1. ~~Assistant « L'essentiel » (#1)~~ : **oui** (§ 12). au lot 33b (D9, D11), l'assistant société/SIRET/logo a
   été remplacé par le questionnaire et la liste de prise en main. Le réintroduire, en plus du
   questionnaire, te va ? Quels champs sont **obligatoires pour démarrer** (je propose : raison
   sociale, adresse, SIRET, régime de TVA ; logo, RIB et numérotation facultatifs) ? J'ai lu
   « formulaire type TypeScript » comme **Typeform** (une question par écran) : c'est bien ça ?
2. ~~Visite guidée (#3)~~ : **elle remplace les repères numérotés** (§ 12). elle s'ajoute aux repères numérotés, ou elle les remplace ? Que veut
   dire « personnalisables » : choisir les écrans visités, ou que toi tu règles le contenu par
   écran (fichier de données traduisible) ?
3. ~~Multi-métiers (#14)~~ : **oui** (§ 12). d'accord pour changer le schéma des prestataires (un métier
   principal + des métiers secondaires) et pour scinder les types combinés existants
   (« Photographe et vidéaste » → deux métiers sur chaque fiche) ?
4. **Budget (#21), toujours ouverte, reformulée en Q42 de `docs/QUESTIONS.md`** (BUD-01 et SC-04
   gardent l'engagé : je propose une pastille et un sous-total plutôt qu'une colonne). Texte initial : la base distingue Devisé et Engagé. Pour la testeuse, le réglé « est
   engagé ». Je propose d'afficher Prévu, Devisé, Écart, Réglé, Reste à payer, et de garder
   « Engagé » pour plus tard (masqué). D'accord ?
5. ~~Planning du jour J en PDF (#20)~~ : **exemple reçu**, voir § 4 bis. peux-tu obtenir deux ou trois PDF réels (anonymisés) ?
   Sans exemple, la lecture d'un PDF est trop incertaine pour être promise.
6. ~~Rétroplanning (#26)~~ : **tranché le 21/11** (§ 12). Revient sur la décision D8 du lot 34a :
   un ADR le notera.
7. ~~Phrase coupée (#23)~~ : **question annulée**. « De plus, les champs automatiquement renseignés… » : quelle était
   la suite ?
8. ~~Catégories de tâches (#35)~~ : **oui** (§ 12). la liste de départ Client, Prestataires, Administratif,
   Jour J te convient ?
9. ~~Échéances (#40, #41)~~ : **tranché le 21/11** (§ 12). Reste ouverte la lecture des
   échéances à l'import (#42), que je garde dans le paquet 63b sauf avis contraire.

## 12. Décisions du 21/11 (retour sur la première version)

| Sujet | Décision |
|---|---|
| Pour bien démarrer (#2) | Seulement « Régler l'essentiel » et « Ajouter un premier prestataire ». Devis, import des contacts et invitation du client passent en tutoriels. |
| Rétroplanning (#26, Q6) | Jamais d'office. Proposé à la création si le type a un modèle ; sinon une astuce invite à créer un modèle. Plus de repli sur le modèle d'un autre type. Revient sur D8 (lot 34a). |
| Vocabulaire du budget (#21) | En français, « Devisé » devient **« Réel »**. |
| Fenêtre ou panneau (Q42 bis) | La grande fenêtre pour toute modification, rubriques à gauche et « Suivant » ; le panneau pour les réglages et la consultation (maquettes M11, M12). Écart avec UX-13 : ADR 0107. |
| Apps (question du 21/11) | La planner ne peut pas souscrire elle-même : libre-service fermé (ADR 0101) et modules non activés invisibles. Écran « Apps » proposé (M13, paquet 63g). |
| Engagé (#21, Q4, Q42) | Gardé, en pastille « Engagé » sur la ligne et en sous-total « dont engagé » ; pas de colonne. |
| Tâches (#32) | « Supprimer » visible sur la ligne. |
| Assistant « L'essentiel » (#1, Q1) | Oui, en plus du questionnaire d'accueil. Obligatoires pour démarrer : raison sociale, adresse, SIRET, régime de TVA ; logo, RIB et numérotation facultatifs. Une question par écran, façon Typeform. Revient sur D9 et D11 (lot 33b). |
| Visite guidée (#3, Q2) | Elle **remplace** les repères numérotés (lot 13, ADR 0033) : un ADR le notera. |
| Plusieurs métiers (#14, Q3) | Oui : un métier principal et des métiers secondaires ; les types combinés existants sont scindés. |
| Planning du jour J en PDF (#20, Q5) | Exemple reçu ; nouveau profil d'import (§ 4 bis). |
| Phrase coupée (#23, Q7) | Question annulée : le retour #23 est retiré. |
| Catégories de tâches (#35, Q8) | Liste de départ : Client, Prestataires, Administratif, Jour J. |
| Échéances des prestataires (#40, #41) | Affichées dans l'onglet « Budget et prestataires » (colonne « Prochaine échéance », ligne dépliable sur son échéancier) **et** dans le calendrier (catégorie « Paiements »). |
| Maquettes à reprendre | M4 (alignements), M5 (étape des colonnes), M6 (suppression), M7 (rétroplanning à la création), M9 (« Réel », débordement, échéances). |
