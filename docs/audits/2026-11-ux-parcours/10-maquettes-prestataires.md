# Maquettes du volet 4 : « Prestataires » (lot 68, phase 5)

Date : 26/11/2026, par Claude Code. Quatrième volet de l'ordre validé à la porte 2
([06-decisions-porte-2.md](06-decisions-porte-2.md), § 3), après le volet 1 (transverse et « Tâches »,
[07](07-maquettes-transverse-taches.md)), le volet 2 (reprise et import, [08](08-maquettes-reprise-import.md))
et le volet 3 (« Aujourd'hui » et « Évènements », [09](09-maquettes-aujourdhui-evenements.md)). Cette note
dit ce qui est proposé (§ 2), les choix retenus par défaut (§ 3), l'inventaire des fonctions gardées
(§ 3 bis), ce que les maquettes supposent de l'app (§ 4), ce qui a été vérifié dans le code et ce qui ne
l'a pas été (§ 5), et les constats non traités (§ 6). Aucun écran de l'app n'est modifié ; `DESIGN.md`
n'est pas touché.

## 1. Les livrables

Quatre pages HTML autonomes dans [`docs/maquette/lot-68/`](../../maquette/lot-68/index.html), au gabarit
des pages 13 à 17 (même feuille de style, mêmes icônes, mêmes cadres), ajoutées au sommaire :

| Page | Contenu | Constats |
| --- | --- | --- |
| [18. Le carnet, ses lignes et ses filtres](../../maquette/lot-68/18-prestataires-carnet.html) | La ligne du carnet et son action rapide ; familles, métiers, « Où ? », pièces ; tri et sélection en lot ; un carnet tout juste importé, « À classer », et l'écran « Classer les fiches » ; le carnet vide | C-43, C-44, C-45, C-47 ; D9 |
| [19. Rattacher à un mariage, voir les pièces](../../maquette/lot-68/19-prestataires-rattacher-pieces.html) | « Ajouter à un mariage… » depuis le carnet ; le même geste depuis le poste ; le carnet ouvert depuis un poste ; la colonne et le filtre « Pièces » | C-41, C-42, C-49 |
| [20. Créer une fiche, lire une fiche](../../maquette/lot-68/20-prestataires-creation-fiche.html) | Un seul formulaire, du carnet ou du poste ; la fiche en un clic ; une fiche neuve | C-46, C-48, C-42 |
| [21. Le poste du budget et la relance](../../maquette/lot-68/21-prestataires-budget-relance.html) | Le tableau des postes à 1 440 px ; le budget sur téléphone ; « Relancer… » | C-49, C-50, C-78, C-42 |

Chaque maquette met l'écran d'aujourd'hui (capture du relevé, ou description tirée des journaux PC-03,
PC-04, PC-05 et PC-08 quand le relevé n'a pas de capture) à côté de l'écran proposé, en 1 440 et en
375 px, et les états vide, rempli, repris (tout juste importé) là où ils diffèrent. Sous chaque maquette :
les constats traités et les règles de forme de D10.

Formes reprises telles quelles : la ligne type et son action rapide (volet 1), le menu « ⋯ », la
sélection en lot et sa barre (M2), les bascules en encre (M8), la fenêtre courte et son pied, « aucune
réponse cochée d'avance » (M13), le message de retour sombre et « Annuler » dix secondes (M5), le danger
de niveau 1 pour « Archiver », l'erreur de saisie et le « * » dit avant l'envoi, la marque de provenance
et « non renseigné » (volet 2), l'en-tête de fiche d'un évènement et ses onglets (volet 3), la barre du
bas du téléphone (D4).

Données fictives : l'Atelier Roussel des volets 1 à 3 (Camille, son collègue Bastien), le mercredi
25 novembre 2026 ; 48 fiches au carnet, dont 37 importées la veille dans l'état « tout juste importé » ;
« Léa & Maxime », sam. 12 juin 2027 au Manoir des Aulnes, neuf postes dont six retenus, 31 200,00 €
engagés (le chiffre de la Synthèse du volet 3) ; le contrat de Maison Haddad attendu depuis le 18 nov.
(la relance d'« Aujourd'hui », volet 3). Les montants se recomptent : prévu 34 600,00 €, réel 31 200,00 €,
réglé 5 850,00 €, reste 25 350,00 €, acompte du traiteur 2 880,00 € (30 % de 9 600,00 €). Couleurs :
jetons actuels, répartition A en rôles (l'émeraude ne porte que l'action et les liens ; « À trouver » et
« en comparaison » sont neutres, avec une forme ; le rouge ne dit que l'expiré et le retard, toujours avec
son mot et son « ! »).

## 2. Ce qui est proposé

**Le carnet (page 18).**

- **La ligne** : un tableau de 60 px par ligne. Le nom, seule cible, ouvre la fiche ; dessous, le contact
  et son téléphone. Colonnes : métier et ville, « Avec vous » (mariages faits ensemble), évaluation,
  pièces. Une action rapide, « Ajouter à un mariage… », et un menu « ⋯ » (Ouvrir la fiche, Appeler,
  Écrire, Modifier, puis à part « Archiver… »). Sur téléphone, une carte par fiche et le téléphone en lien
  de 44 px qui appelle.
- **La carte** devient une vue, « Liste · Carte », au lieu d'une moitié d'écran.
- **Les filtres** : les familles en pastilles comptées, puis les métiers de la famille choisie en second
  rang ; une barre de filtres libellés (« Rechercher », « Où ? » et son rayon, « Pièces », « Avec vous »,
  « Évaluation », « Étiquette ») ; chaque filtre posé devient une pastille qui s'enlève ; « 2 fiches sur
  48, par distance » ; un lieu trie par distance et écrit le trajet sur la ligne. Sur téléphone, un
  panneau du bas qui finit par « Voir les 2 fiches ».
- **Trier et sélectionner** : chaque en-tête trie, le tri est dit en clair ; « Sélectionner » ouvre la
  barre du volet 1 : « Ajouter à un mariage… », « Ajouter une étiquette… », « Exporter… », « Archiver… ».
- **Tout juste importé** (D9) : quand le fichier n'avait pas de colonne de métier, une phrase le dit, avec
  sa raison et « Classer les 37 fiches » (le bouton plein de l'écran dans cet état) ; « À classer · 37 »
  devient une pastille à côté des familles au lieu de doubler « Tous ». L'écran « Classer 37 fiches »
  propose un métier par fiche d'après son nom, dit d'où vient chaque proposition, et n'enregistre rien
  avant « Enregistrer les 31 métiers ».
- **Vide** : l'état vide d'aujourd'hui, gardé, plus « Reprendre votre carnet (tableur ou export) » à côté
  de « Nouveau prestataire » ; ni filtres ni carte sur une liste vide.

**Rattacher et pièces (page 19).**

- **Depuis le carnet** : « Ajouter à un mariage… » ouvre une fenêtre courte : le mariage (à venir,
  demandes comprises), le poste (proposé d'après le métier, « Nouveau poste » possible), et « Comment
  l'ajouter ? » : « En comparaison » ou « Retenu », chacun avec sa conséquence. Le message de retour
  offre « Annuler » et « Ouvrir le poste ». Plusieurs fiches à la fois passent en comparaison.
- **Depuis le poste** : un panneau de 700 px rattaché à la ligne, qui dit en une phrase ce que font
  « Mettre en comparaison » et « Retenir », montre les fiches du métier d'abord avec leurs pièces, écrit
  « Dans la comparaison » au lieu de griser, et repart d'une recherche vide. « Chercher dans tout le
  carnet » ouvre le carnet au métier du poste (pastille nommée qui s'enlève), et chaque ligne y offre
  « Ajouter à ce poste… ».
- **Les pièces** : une colonne « Pièces » dans le carnet, un mot et une forme par état (À jour, expire
  le…, expirée, demandée, déposée à vérifier, aucune demandée) ; un filtre « Pièces à régler » trié par
  urgence, avec la raison sous l'état (« le 31 oct. · retenu sur 2 mariages ») ; la même mention sous le
  prestataire retenu, dans le budget du mariage (page 21).

**Créer et lire (page 20).**

- **Un seul formulaire**, le même au carnet et au poste : nom, métier (obligatoire, proposé d'après le
  poste), contact, téléphone, e-mail, ville ; « Plus de détails » ouvre en place adresse, SIRET (avec
  « 14 chiffres, sur ses devis et factures »), site et réseaux, étiquettes, évaluation, tarifs, note.
  Depuis un poste, la question « Comment l'ajouter ? » s'ajoute, et le bouton devient « Créer et
  ajouter ». Après « Créer la fiche », la fiche s'ouvre.
- **La fiche** s'ouvre en un clic ; son en-tête tient en 200 px (métier, ville, mariages, évaluation,
  étiquettes, contact cliquable, « Ajouter à un mariage… », menu « ⋯ ») ; une alerte sous l'en-tête quand
  une pièce a expiré ou qu'un IBAN a changé ; à gauche « Avec vous » (les deux historiques fondus, une
  colonne « Montant ») et « Pièces » ; à droite « Caractéristiques », « Paiement et fichiers », « Note
  interne ». Un seul bouton plein au lieu de six.
- **Une fiche neuve** dit pour chaque valeur absente pourquoi ou quoi faire (« non renseignés ·
  Ajouter », « pas encore notée : elle se donne après un mariage ») et propose de demander les pièces
  habituelles en un bouton.

**Le budget et la relance (page 21).**

- **Le tableau des postes** : sept colonnes ; la première porte le poste (qui ouvre sa fenêtre), le
  prestataire (lien vers sa fiche), où il en est en mots et ses pièces ; une action rapide quand il y a
  quelque chose à faire (« Ajouter… » pour un poste à pourvoir, « Relancer… » pour un contrat attendu) ;
  Prévu, Réel (et l'écart), Réglé (et le reste), Prochaine échéance ; un menu « ⋯ ». « Engagé » quitte la
  ligne, « À trouver » n'est plus rouge, « Ouvrir » et « Supprimer » passent au menu. Les totaux en tête,
  cinq nombres en mots.
- **Sur téléphone** : une carte par poste, sans défilement de côté, quatre montants libellés sur deux
  colonnes, la prochaine échéance, l'action rapide en bouton pleine largeur ; les totaux en deux nombres.
- **La relance** : « Relancer… » sur la ligne du poste qui attend un contrat, sur la ligne
  d'« Aujourd'hui » et dans la fenêtre du poste, avec la même fenêtre en deux temps : « Le joindre »
  (contact, téléphone qui appelle, message type visible, « Copier le message », « Ouvrir dans ma
  messagerie ») puis « Noter ce que vous avez fait » (comment, le, me le rappeler, note). La ligne dit
  aussitôt « dernière relance : aujourd'hui, par e-mail ». Symbola n'envoie rien et aucun bouton de
  relance automatique n'est ajouté.

## 3. Les choix, retenus par défaut

**Règle de Julien du 26/11/2026** (rappelée en [09, § 3](09-maquettes-aujourdhui-evenements.md)) : les
propositions des nouvelles maquettes sont retenues par défaut et priment sur les décisions antérieures
qu'elles contredisent ; on vérifie qu'aucune fonction majeure ne disparaît (§ 3 bis) ; l'ergonomie cible
est celle des maquettes. Les quatorze choix ci-dessous sont donc **retenus tels que proposés**, sauf avis
contraire de Julien. L'autre voie est donnée pour mémoire.

Deux décisions antérieures sont contredites, et la maquette l'emporte :

- **V14 contre le volet 3** : le libellé « Noter une relance » gardé sur « Aujourd'hui » (page 14, § 2 de
  la note 09) devient « Relancer… », la même fenêtre partout. Ce n'est pas un bouton ajouté : c'est le
  même bouton, renommé, et la fenêtre aide à joindre avant de noter.
- **V7 contre le lexique de l'app** : « Pressenti » ne s'affiche plus ; le prestataire mis en
  comparaison se dit « en comparaison » (la valeur en base peut rester).

| # | Question | Où regarder | Proposition retenue | L'autre voie |
| --- | --- | --- | --- | --- |
| V1 | Que montre une ligne du carnet ? (C-44) | Page 18, « La ligne » | Nom et contact, métier et ville, mariages avec vous, évaluation, pièces ; « Ajouter à un mariage… » ; « Archiver » au menu | Une ligne plus courte (nom, métier, ville) et le reste au survol |
| V2 | Que devient la carte ? (C-44) | Page 18, « La ligne » | Une vue « Liste · Carte » | Une carte réduite à droite de la liste, repliable |
| V3 | Que fait le nom d'une fiche ? (C-48) | Page 18 ; page 20, table des blocs | Il ouvre la fiche ; l'aperçu latéral disparaît (contact et téléphone sont sur la ligne) | Garder l'aperçu, avec « Ajouter à un mariage… » et un lien de fiche plus visible |
| V4 | Quels filtres ? (C-43, C-47) | Page 18, « Les filtres » | Familles puis métiers ; « Où ? » de 170 px et son rayon ; « Pièces » nouveau ; les autres gardés ; pastilles qui s'enlèvent | Un seul bouton « Filtres » ouvrant un panneau, à l'ordinateur aussi |
| V5 | Tri et actions en lot (C-45) | Page 18, « Trier, sélectionner » | En-têtes qui trient ; « Sélectionner » et la barre du volet 1 | Un menu « Trier par » seul, et les exports gardés comme aujourd'hui |
| V6 | Un carnet importé sans métier (D9, C-47) | Page 18, « Tout juste importé » | Phrase d'état, « Classer les 37 fiches », écran de classement avec propositions d'après le nom | Renvoyer vers « Sélectionner » et « Donner le métier… », sans proposition |
| V7 | Les mots pour proposer un prestataire (C-49) | Page 19, « Depuis le poste » | « Mettre en comparaison » et « Retenir », expliqués en tête ; l'état « en comparaison » ; « Pressenti » ne s'affiche plus | Garder « Comparer » et « Retenir », avec une bulle d'aide sur chacun |
| V8 | Rattacher depuis le carnet (C-41) | Page 19, « Depuis le carnet » | Une fenêtre : mariage, poste proposé d'après le métier, « En comparaison » ou « Retenu », rien de coché | Ouvrir le mariage sur son poste, panneau ouvert, comme si l'on venait du mariage |
| V9 | Où se voient les pièces ? (C-42) | Page 19, « Les pièces » ; page 21 | Colonne et filtre au carnet, mention sous le prestataire au budget, alerte sur la fiche ; le rouge pour l'expiré seulement | Un voyant seul (sans mot) dans la liste, le détail au survol |
| V10 | Un seul formulaire de création (C-46) | Page 20, « Créer » | Six champs dans l'ordre de l'usage, métier obligatoire, « Plus de détails » en place | Garder les quatre rubriques, mais métier et téléphone en rubrique 1, et le même formulaire au poste |
| V11 | La fiche (C-48) | Page 20, « La fiche » | En-tête en 200 px, une action ; « Avec vous » fondu, colonne « Montant » ; deux colonnes | Garder l'ordre d'aujourd'hui en repliant chaque bloc |
| V12 | La ligne du budget (C-49) | Page 21, « Le tableau » | Poste, prestataire et pièces dans une cellule ; l'état en mots ; une action rapide selon le cas ; « Ouvrir » et « Supprimer » au menu | Garder une colonne « Prestataire » à part et le chevron de l'échéancier sur la ligne |
| V13 | Le budget sur téléphone (C-78) | Page 21, « Téléphone » | Une carte par poste, quatre montants, l'action rapide en bouton | Une liste des postes sans montants, le détail en page à part |
| V14 | La relance (C-50) | Page 21, « La relance » | « Relancer… » partout, fenêtre « Le joindre » puis « Noter » ; le canal suit le geste fait dans la fenêtre, sinon rien de coché | Garder « Noter une relance » et ajouter seulement le message visible et la mise à jour de la ligne |

## 3 bis. Aucune fonction majeure ne disparaît

Inventaire, écran par écran, de ce que l'app fait aujourd'hui (lu dans le code, § 5) et de l'endroit où
les maquettes le placent.

| Écran | Fonction d'aujourd'hui | Dans les maquettes |
| --- | --- | --- |
| Carnet, en-tête | « Paramètres du carnet », « Importer », « Nouveau prestataire » | « Nouveau prestataire » ; les deux autres au menu « ⋯ » (page 18) |
| Carnet, en-tête | Pastille « Import du … » (créés, mis à jour) et « Voir le bilan de l'import » | Gardées : la pastille s'ajoute aux filtres actifs ; le sous-titre de l'état « tout juste importé » nomme l'import (page 18) |
| Carnet, familles | « Tous », une pastille par famille, « À classer », second rang des types, bandeau « à classer » | Gardés ; « Toute la famille » devient « Tous les métiers » ; le bandeau devient la phrase d'état et « Classer les fiches » (page 18) |
| Carnet, filtres | Nom ou ville, « Où ? » et rayon (5 à 100 km), déjà travaillé ensemble, évaluation, sur la carte, étiquette, champs-filtres d'un type | Tous gardés ; « Sur la carte : à placer » passe dans la vue « Carte » ; les champs-filtres s'ajoutent quand un métier est choisi ; « Pièces » s'ajoute (page 18) |
| Carnet, filtres actifs | Pastilles, « Effacer les filtres », « Ce lieu n'a pas été trouvé… » | Gardés ; le message de lieu non trouvé reste sous « Où ? » (non dessiné) |
| Carnet, affichage | Bascule Liste / Carte ; carte par famille, rayon, zoom, « N à placer » | Gardés dans la vue « Carte » (non redessinée) |
| Carnet, résultats | « N résultats », tri par distance autour d'un lieu, trajet estimé, note sur les trajets | « N fiches sur 48, par … » ; trajet sur la ligne ; la note des trajets reste sous la liste (non dessinée) |
| Carnet, résultats | « Exporter en CSV », « Exporter en PDF » | Menu « ⋯ » et « Exporter… » de la sélection (page 18) |
| Carnet, ligne | Nom, métiers, ville, trajet, étoiles, « Exemple », « Non placé sur la carte », « Archiver » avec annulation | Nom, métier, ville, trajet, évaluation, pièces ; « Exemple » gardé (étiquette, non dessinée) ; « Non placé » dans la vue « Carte » ; « Archiver… » au menu, avec « Annuler » |
| Carnet, depuis un poste | Bandeau « Ajouter à la ligne … », « Revenir à la fiche de l'évènement », bouton d'ajout par ligne | Gardés (page 19) ; le filtre posé est le métier, plus le lieu |
| Carnet, états vides | Trois textes (vide, vide sans types, aucun résultat) | Gardés ; « aucun résultat » dit « 0 fiche sur 48 avec ces filtres » (page 18) |
| Aperçu latéral | Métiers, contact, téléphone, e-mail, adresse, trajet, évaluation, tarifs, note, « Ajouter à la ligne… », « Ouvrir la fiche complète » | Ligne du carnet et en-tête de la fiche (V3, page 20) |
| Fiche | Retour, métiers et principal, étiquettes, « Archivé », messages de géocodage, « Chercher autour de … » | En-tête ; « Chercher autour » au menu ; messages gardés (non dessinés) |
| Fiche | Historique avec vous (issue, prix réel, prix final, prix moyen) ; historique des collaborations (moyenne, critères, lien de clôture) | « Avec vous » fondu, « Montant » expliqué, prix moyen et moyenne en tête, « Le détail des évaluations » (page 20) |
| Fiche | Coordonnées et caractéristiques, site, réseaux, SIRET, champs du type, colonnes importées non reprises | « Caractéristiques » et en-tête ; les colonnes importées restent lisibles dans « Caractéristiques » (non dessiné) |
| Fiche | IBAN masqué, BIC, formulaire, alerte « IBAN changé », « J'ai vérifié par téléphone », journal | « Paiement et fichiers » ; l'alerte monte sous l'en-tête (page 20, table) |
| Fiche | Pièces : dépôt, demande, date de fin, vérifier, retirer, états | Bloc « Pièces » ; « Demander au prestataire » ; « Ajouter une pièce » (page 20) |
| Fiche | Note interne, confidentielle ; plaquettes et RIB ; plans de salle ; point sur la carte ; « Archiver » | Gardés (page 20, table) |
| Création, modification | Quatre rubriques, tous les champs, plusieurs métiers et principal, étiquettes à palier | Une fenêtre, six champs et « Plus de détails » ; plusieurs métiers sur la fiche ; « Modifier » ouvre la fenêtre complète (V10) |
| Paramètres du carnet | Familles et types, étiquettes, trajet, pièces (délai d'alerte, natures) | Non touchés ; l'écran « Classer » s'appuie sur leurs métiers |
| Import du carnet | Étape « Types » (proposition par libellé, création, à classer) | Gardée (page 18, table) |
| Budget, en-tête | Détail du budget (simulation, HT, exports), Importer, paramètres des lignes par défaut, totaux, « N lignes pourvues sur M », alerte de dépassement de l'enveloppe | Menu « ⋯ » de l'onglet ; cinq totaux ; « 6 postes retenus sur 9 » ; l'alerte de dépassement reste au-dessus des totaux (non dessinée) |
| Budget | « Reprendre les prestataires retenus (PDF) » | Menu « ⋯ » de l'onglet ; parcours du volet 2 (page 10) |
| Budget, ligne | Statut du poste, « Engagé », prestataires retenus ou « N en comparaison · N devis reçus » | En mots dans la cellule du poste ; « Engagé » est le montant « Réel » ; « 1 devis reçu » gardé |
| Budget, ligne | Liens Devis, Contrat, Facture | Menu « ⋯ » de la ligne (« Documents du poste ») et rubrique « Documents » de la fenêtre du poste ; **non dessinés** |
| Budget, ligne | Chevron et échéancier (« Marquer payée », « + Ajouter une échéance »), « Ouvrir », « Supprimer » (poste vide) | Menu « ⋯ » : Ouvrir le poste, Voir l'échéancier (déplié en place), Supprimer le poste… |
| Budget, ligne | Colonnes Prévu, Réel, Écart, Réglé, Reste à payer, Prochaine échéance ; « En retard », « Soldé » ; total et engagé ; légende de l'écart | Quatre colonnes, l'écart sous le réel, le reste sous le réglé ; « En retard » et « Soldé » gardés dans l'échéance (non dessinés) |
| Budget, menu d'ajout | Recherche par métier d'abord, « Déjà travaillé ensemble », « Comparer », « Retenir », « Retenir quand même », « Voir tout le carnet », « + Nouveau prestataire » | Panneau de la page 19 ; « Retenir quand même » gardé ; création par le formulaire unique (page 20) |
| Fenêtre du poste | Cinq rubriques ; comparaison (statut, devis, disponible le jour J, déjà travaillé, dernière relance, note) ; retenir, écarter, changer de prestataire, ne plus retenir ; demander des devis ; montrer aux clients, RIB aux clients, retirer ; montants, échéancier, documents, réglages, « Non requis » | **Gardée, non redessinée** ; seul « Noter une relance » y devient « Relancer… » (V14) |
| Relance | Canal, date, rappel (2, 3, 7, 14 jours, aucun), note, message type à copier, « Noter la relance », message de retour, fil d'activité, rappel sur « Aujourd'hui » | Tout gardé, dans la fenêtre en deux temps (page 21) |
| Espace du prestataire (lot 47) | Pièces et IBAN envoyés par lien, réponses | Non touché ; la demande de pièce y arrive comme aujourd'hui |

## 4. Ce que les maquettes supposent du comportement de l'app

À spécifier au lot de réalisation, pas à décider ici. Entre parenthèses, l'état actuel lu dans le code.

- **L'état des pièces d'une fiche** : un état résumé par fiche (le plus urgent de ses pièces, en tenant
  compte du statut demandée, à vérifier, vérifiée et de `documentAlert`), calculé pour la liste et le
  budget, avec un filtre et un tri (aujourd'hui calculé seulement sur la fiche et pour « Aujourd'hui » ;
  aucune liste ne le montre). « Aucune demandée » se distingue d'« À jour ».
- **« Ajouter à un mariage… » depuis le carnet** : une action qui prend un mariage, un poste (ou en crée
  un d'après le métier) et un statut (`shortlisted` ou `retained`), pour une ou plusieurs fiches
  (aujourd'hui `addVendorToSlotAction` n'existe que depuis le carnet ouvert par un poste, statut
  « Pressenti » seulement). « Retenu » sur un poste déjà pourvu suit la règle de « Changer de
  prestataire ».
- **Les mots** : « Pressenti » s'affiche « en comparaison » ; « Comparer » devient « Mettre en
  comparaison » ; les valeurs en base ne changent pas.
- **Le carnet ouvert depuis un poste** : il filtre par le métier du poste et non plus autour du lieu du
  mariage (aujourd'hui `selection.ts` pose un « Où ? » sur le lieu et la ville de l'évènement).
- **Le tri** par colonne et la **sélection** dans le carnet : paramètres de tri dans l'adresse ;
  actions groupées nouvelles (ajout à un mariage, étiquette, export de la sélection, archivage).
- **L'écran « Classer les fiches »** : une proposition de métier d'après le nom de la fiche (la
  correspondance `proposeVendorTypeTarget` de l'import travaille sur un libellé de métier, pas sur un
  nom ; à adapter ou à écrire), enregistrée en lot.
- **La création** : une seule fenêtre au carnet et au poste ; le métier est obligatoire, « À classer »
  restant possible en dernier choix explicite de la liste (aujourd'hui facultatif au carnet, « À
  classer » proposé au poste) ; un doublon possible signalé sous le nom (règle du volet 2).
- **La fiche** : plus d'aperçu latéral ; le nom ouvre la fiche ; les deux historiques fondus ; une seule
  colonne « Montant » (réel engagé, ou prix final une fois soldé) ; l'alerte d'IBAN changé et celle des
  pièces sous l'en-tête.
- **Le tableau du budget** : le nom du prestataire en lien vers sa fiche ; la dernière relance sur la
  ligne (`events.vendor_reminders`, déjà en base) ; l'état des pièces du prestataire retenu ; l'action
  rapide selon le cas ; liens de documents et échéancier au menu ; sur téléphone, des cartes à montants
  (aujourd'hui les mêmes cellules, libellées par `data-label`, sortent du cadre).
- **La relance** : « Relancer… » partout où « Noter une relance » existe, plus la ligne du poste qui
  attend un contrat ; le message type visible d'emblée (même texte que `vendorReminderDraftAction`) ;
  « Copier le message » dit « Message copié » ; « Ouvrir dans ma messagerie » ouvre la messagerie de la
  planner avec le message (lien `mailto:`), rien ne part de Symbola ; le canal pré-choisi selon le geste
  fait dans la fenêtre, sinon aucun (aujourd'hui « Téléphone » coché d'avance, `defaultChecked` du premier
  canal) ; la ligne du tableau mise à jour aussitôt.

## 5. Ce qui a été vérifié dans le code, et ce qui ne l'a pas été

Lu dans la branche du volet 3 (`a0391fea`, au-dessus de `main` `492145c5`), sans lancer l'app.
L'inventaire a été fait par lecture de code (un agent d'exploration, puis des contrôles directs pour les
lignes marquées « relu »).

| Affirmation des maquettes | Vérifié | Où |
| --- | --- | --- |
| Liste du carnet : en-tête, familles, « À classer », bandeau « les voir · ranger les types », filtres, Liste / Carte, exports, ligne avec « Archiver » | Oui | `app/prestataires/page.tsx`, `filters.ts`, `export/route.ts` |
| Aucun état de pièce dans la liste du carnet ni dans le tableau du budget ; les « pièces » du budget sont devis, contrat, facture | Oui | `page.tsx`, `events/[id]/budget-vendors-table.tsx` |
| Les pièces ont une date de fin ; l'état d'échéance est calculé (`documentAlert`), alerte à 30 jours réglable ; natures de départ « assurance RC » et « Kbis » | Oui | `modules/vendors/documents.ts`, `starter-templates/src/vendor-document-kinds.json` |
| Depuis un poste, le carnet est ouvert avec un « Où ? » sur le lieu du mariage | Oui, relu | `app/prestataires/selection.ts` (l. 62), `events/[id]/page.tsx` (`catalogHrefs`) |
| « Comparer » ajoute en « Pressenti » ; « Retenir » engage la ligne au montant du devis ; « Retenir quand même » au-delà du seuil | Oui, relu (textes) | `fr.json` (`VendorCandidates`, `BudgetVendors`), `vendor-choice.tsx` |
| Fenêtre « Nouveau prestataire pour … » : Nom, Métier (avec « À classer »), E-mail, Téléphone, Ville ; « Créer et retenir », « Créer et comparer » | Oui | `vendor-choice.tsx` |
| Formulaire du carnet en quatre rubriques ; « … : modifier » en modification | Oui | `app/prestataires/vendor-form.tsx` |
| L'import d'un carnet a une étape « Types » qui range les libellés reconnus, sinon « à classer » | Oui (code) | `lib/import/matching.ts`, `app/import/[importId]/types/` |
| Relance : « Comment avez-vous relancé ? », premier canal coché d'avance, « Dans 3 jours » par défaut, « Message type, à copier », rien n'est envoyé | Oui, relu | `app/accueil/note-reminder.tsx`, `fr.json` (`Today.reminder`) |
| « Noter une relance » sur « Aujourd'hui », la Synthèse et la fenêtre du poste, pas sur la ligne du tableau | Oui | `today-view.tsx`, `cockpit.tsx`, `slot-comparison.tsx` |
| Statuts d'un prestataire sur un poste et d'un poste | Oui | `vendor-slot-status.ts`, `fr.json` (`VendorCandidates.status`, `Events.vendorStatus*`) |

**Non vérifié** : rien n'a été vu dans l'app en marche ; les captures « aujourd'hui » sont celles du
relevé. Le contenu de « Détail du budget » et de la rubrique « Réglages du poste », non lus. Le texte exact
du message type (produit par `vendorReminderDraftAction`, non lu) : la maquette en donne un exemple. Si
« Demander au prestataire » écrit au prestataire ou dépose seulement la demande sur son lien. « Prix réel
9 600,00 € » et « Prix final 600,00 € » (C-48) : la maquette propose une seule colonne, sans avoir
reproduit le cas. Le coût d'un état des pièces calculé pour 48 fiches et pour chaque ligne du budget. Les
familles et les métiers des maquettes (« Fleurs et décoration », « Calèche et attelage », « Pâtissier »)
sont des exemples, pas ceux des modèles de départ.

**Déjà corrigé par le lot 69** (fusionné dans `main`, commit `732ea454`) : la largeur du champ « Où ? »
(C-43), la ligne d'un poste qui sortait du cadre à 1 280 et 1 366 px (C-49, « Supprimer » coupé), les
montants des cartes du budget ramenés dans la fenêtre à 375 px (C-78), « Dernière relance » relu après
« Relance notée. » (C-50). Les captures « aujourd'hui » des pages 18 à 21 sont d'avant ce lot, comme celles
du volet 3. Les maquettes ne refont pas ces corrections : elles traitent la forme de ces écrans (filtres
libellés et pastilles, tableau à sept colonnes sans « Supprimer » sur la ligne, cartes à montants,
relance en deux temps), qui va au-delà.

**Contrôlé dans le navigateur** (serveur local, Chromium du volet d'aperçu, fenêtre de 1 600 × 1 000) :
chaque cadre « Proposé » regardé en taille réelle à 1 440 et à 375 px. Par script, sur les quatre pages :
toutes les captures chargées, aucun débordement de côté dans les cadres de 375 px, aucune commande de
moins de 44 px dans ces cadres, aucun libellé de bouton coupé, aucune espace simple dans les guillemets ou
devant « : ; ? ! ». La feuille de style des pages 13 à 17 est reprise à l'octet près, le bloc du volet 4
ajouté à la fin ; les icônes sont identiques. Corrigé après ces contrôles : « Nom » et son « * » sur deux
lignes dans le formulaire de création (le défaut même de C-46), une classe du volet 4 qui en recouvrait
une du volet 2 (« 2 en comparaison » encadré), le tableau du budget trop étroit pour le prestataire (poste
et prestataire réunis dans une cellule), le panneau d'ajout qui couvrait sa ligne, un message de retour sur
trois lignes, les dates de la relance coupées, deux commandes de moins de 44 px au téléphone, un tri
affiché « Nom » sur une liste triée par distance, une pastille de retards dans un espace neuf.

## 6. Constats non traités, et pourquoi

| Constat | Pourquoi | Où il sera traité |
| --- | --- | --- |
| C-01, C-02, C-06 (visites guidées sur le carnet et le budget, « Revoir la visite » absent de « Nouveau prestataire ») | Leur dessin relève de l'aide | Volet « Premiers pas et aide » |
| C-11 (bouton « Réglages » des écrans) | « Paramètres du carnet » passe au menu « ⋯ » ; le sort du bouton est une question des Paramètres | Volet « Paramètres » |
| C-69 (« Aucun prestataire ne correspond » sans filtre) | Corrigé au lot 69 (`74ef79c7`) ; la maquette dit seulement le compte « 0 fiche sur 48 » | — |
| C-62, C-53 (prestataires retenus repris d'un PDF) | Maquettés au volet 2 (page 10), non refaits | — |
| C-65 (contacts repris, doublons) | Reporté par D11 | Quand « Contacts » sera refait |
| La vue « Carte » | Gardée telle quelle ; aucun constat ne porte sur la carte installée (le fond manquait dans l'essai) | — |
| La fenêtre du poste (cinq rubriques, comparaison, « Demander des devis ») | Aucun constat au-delà de la relance (C-50) et du nom du prestataire (C-49) ; non redessinée | Lot de réalisation, si le Design System le demande |
| Les Paramètres du carnet (familles, étiquettes, trajet, pièces) | Hors de ce volet | Volet « Paramètres » |
| L'espace du prestataire par lien (lot 47) | Aucun constat du panel | Hors périmètre |
| « Le carnet propose 8 prestataires sur 12 au poste, sans dire lesquels manquent » (Inès) | En partie : le panneau compte ce qu'il montre (« Fleuristes du carnet · 5 ») et renvoie à « tout le carnet » | — |

## 7. Limites

- Maquettes statiques ; **aucun rejeu par le panel** (non demandé). Rien ne dit qu'un profil comprend
  « Mettre en comparaison » sans aide, ni qu'il trouve « Ajouter à un mariage… » du premier coup.
- Les cadres sont dessinés dans un navigateur Chromium aux polices du système (Inter et Space Grotesk si
  installées) ; les hauteurs mesurées changent de quelques pixels avec d'autres polices.
- Les pages sont produites par le petit générateur hors du dépôt du volet 3, qui reprend octet pour octet
  la feuille de style et les icônes des pages 13 à 17 et y ajoute les formes du volet 4 (bloc commenté en
  fin de feuille de style), toutes aux jetons de `DESIGN.md`. Les pages des volets 1 à 3 ne sont pas
  touchées ; seul le sommaire change.

## 8. La porte 3 de ce volet

Les quatorze choix V1 à V14 sont retenus par défaut selon la règle du 26/11/2026. Julien peut en
renverser un en citant son numéro ; les maquettes seront alors corrigées. Les formes de ce volet
rejoignent ensuite le Design System (phase 6) avec celles des volets 1 à 3.
