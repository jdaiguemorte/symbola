# H-MI — Reprise de données et migration depuis un autre outil

Preuves : `P` = `(captures hors dépôt)/mi-preuves`
(mes captures de navigateur, copiées avant qu'une seconde session ne réécrive les numéros) ;
`R` = `(captures hors dépôt)/releve` (captures du relevé).

## 1. Ce que j'ai regardé, et ce que je n'ai pas pu regarder

**Rejoué moi-même, en 1 440 × 900, dans deux comptes neufs.**
`spec-MI-1` (logiciel spécialisé) : accueil avant l'assistant, les cinq questions de `/demarrage`,
`/demarrage/pret`, menu « Créer », recherche « importer », `/import`, reprise de
`fiche-evenement-complete.pdf` (colonnes, vérifier et confirmer, bilan), liste, fiche de « Léa &
Hugo » (Synthèse, Mariés, Budget et prestataires), aperçu de la reprise de
`prestataires-evenement.pdf`. `spec-MI-2` (tableur) : assistant, `/import` › « Un autre fichier »,
`budget.csv` par `/import` (impasse), création à la main de « Juliette & Romain », `budget.csv`
depuis l'onglet Budget (colonnes, rapprochements, confirmation, résultat), « Aujourd'hui » après la
reprise, bilan, annulation de l'import, journal, `a-faire.csv` jusqu'à l'étape Colonnes.
**Lu sur les captures du relevé** (états `repris`, `camille`, `import`) : liste, fiche (Synthèse),
Budget et prestataires, Rétroplanning, Programme, Aujourd'hui, Tâches, carnet, étapes « Types » et
« Doublons » du carnet. Les quatre PDF et tableurs d'origine ont été lus en entier.

**Pas regardé.** Une coupure technique a fermé mes navigateurs ; j'ai fini avec 50 commandes.
Donc : le fichier de 600 contacts et `prestataires.csv` ne sont **pas** rejoués ; `a-faire.csv`
s'arrête à l'étape Colonnes (ni doublons, ni résultat) ; dans mon compte, la reprise du PDF des
prestataires s'arrête à l'aperçu et celle du programme n'est pas rejouée (leur résultat est lu chez
Martine, sur capture) ; le carnet en tableur n'est pas rejoué par moi (étapes lues sur les captures
`import`) ; l'onglet Rétroplanning de mes comptes neufs n'est pas ouvert (seul le bandeau de la
fiche est vu) ; aucune vue en 375 px ni en 911 × 512 ; l'aide « ? » et le tutoriel « Importer ses
événements existants » ne sont pas ouverts.

**Réponses aux questions posées.**
- Le total « Prévu » repris vaut bien **36 450,00 €** (et « Réel » 27 502,00 €), mais seulement
  par l'onglet Budget du mariage ; par `/import`, les 14 lignes sont rejetées (H-MI-01).
- « Aucun modèle de rétroplanning » **n'apparaît pas** dans un compte passé par l'assistant :
  l'assistant installe « Rétroplanning mariage (modèle de départ) », 18 tâches, et la fiche reprise
  propose de l'appliquer. C'est ce modèle qui pose alors problème (H-MI-06).
- Un import s'annule, pendant 90 jours, depuis son bilan (H-MI-32). Vérifié après coup : l'onglet
  Budget revient à « Aucune ligne pourvue sur 12 », total 0,00 €, postes en double disparus.

## 2. Hypothèses

### H-MI-01 — Le budget du tableur est rejeté en entier : l'assistant ne demande jamais « pour quel mariage ? »
- Écran et taille : `/import` › « Un autre fichier » › « Lignes de budget », `/import/[id]/confirmation`, compte neuf, 1 440
- Constat : `budget.csv` n'a pas de colonne « évènement ». Après quatre étapes, l'écran annonce « 14 lignes sur 14 ne seront pas importées », quatorze fois « événement introuvable ou ambigu parmi vos événements », et conseille de « les corriger dans votre tableur ». Aucun champ pour choisir le mariage. La voie qui marche existe (bouton « Importer » de l'onglet Budget du mariage : « votre fichier n'a pas besoin de colonne pour le désigner »), mais l'impasse ne la cite pas.
- Preuve : P/s2-023-budget-14-rejetees.jpg ; P/s2-032-import-depuis-onglet-budget.jpg
- Gravité présumée : bloque
- Qui bute : la planner au tableur, un classeur par mariage ; elle n'a jamais eu de colonne « évènement » et croit que Symbola ne lit pas son fichier.
- Principe candidat : quand une donnée manque pour rattacher un import, l'écran la demande ; il ne renvoie pas au fichier.

### H-MI-02 — Un acompte déjà versé devient une échéance « En retard »
- Écran et taille : `/events/[id]?onglet=budget` après reprise de `budget.csv`, 1 440
- Constat : la colonne « Acompte versé » (1 950,00 € le 15/09/2026, etc.) est reconnue comme « Acompte (montant) ». Résultat : « Réglé 0,00 € » sur toutes les lignes, six « Prochaine échéance … · En retard », « Reste à payer 27 502,00 € » au lieu de 18 775,00 €. Aucune étape n'a demandé si ces sommes étaient payées.
- Preuve : texte de l'onglet relevé par le navigateur (session `spec-MI-2`, commande 43) ; P/s2-020-budget-colonnes.jpg (colonne « Acompte versé » reconnue) ; P/s2-044-aujourdhui-apres-reprise.jpg (« 22 points demandent votre attention »)
- Gravité présumée : bloque
- Qui bute : toute planner qui reprend un mariage en cours ; elle voit des retards de paiement chez des clients à jour, et peut les relancer à tort.
- Principe candidat : une date passée, dans un import, se lit « fait » sauf avis contraire ; l'assistant pose la question une fois.

### H-MI-03 — Au lendemain de la reprise, « Aujourd'hui » demande de faire signer douze contrats déjà signés
- Écran et taille : `/`, espace repris (Martine), 1 440 ; Synthèse de la fiche
- Constat : « 12 points demandent votre attention », bloc « Relances et messages (12) » : « Contrat de Les P'tits Loups (Baby-Sitter) à faire signer · Depuis le 24 novembre 2026 · Attend Les P'tits Loups », bouton « Noter une relance », pour chacun des prestataires repris du PDF. Le PDF s'appelle « prestataires retenus » : ils sont engagés depuis des mois.
- Preuve : R/repris/shots/accueil--1440-haut.jpg ; R/repris/shots/events_id_--1440.jpg (« Voir 9 de plus »)
- Gravité présumée : bloque
- Qui bute : la planner en migration ; son premier écran utile est une liste de douze fausses urgences, toutes datées du jour de l'import.
- Principe candidat : un objet repris arrive dans l'état où il était, pas à l'état initial ; à défaut, l'import ne crée aucune alerte.

### H-MI-04 — L'assistant demande ce qu'on remplace, puis n'en fait rien
- Écran et taille : `/demarrage?etape=5` puis `/demarrage/pret`, deux comptes neufs, 1 440
- Constat : j'ai coché « Un autre logiciel de gestion » (compte 1) puis « Un tableur (Excel, Google Sheets…) » (compte 2). Les deux fois, « Votre espace est prêt » ne propose que « Créer mon premier évènement » et « Explorer avec un exemple ». Le mot « reprendre » n'y figure pas.
- Preuve : P/s1/015.jpg, P/s1/017.jpg
- Gravité présumée : bloque
- Qui bute : la planner qui arrive avec des mariages en cours ; elle recrée à la main ce qu'un import aurait repris, ou part chercher.
- Principe candidat : une réponse donnée à l'assistant change l'écran qui suit.

### H-MI-05 — La reprise est au troisième niveau des Paramètres
- Écran et taille : `/`, menu « Créer », `/import`, compte neuf, 1 440
- Constat : rien dans le menu latéral ; « Créer » ne liste que Prospect, Tâche, Dépense, Devis ; « Aujourd'hui » d'un espace vide dit « Rien ne presse : tout est à jour. » La reprise est sous Paramètres › Prestataires et données › Importer. J'y suis arrivé en tapant « importer » dans la recherche.
- Preuve : P/s1/020.jpg, P/s1/023.jpg, P/s1/027.jpg
- Gravité présumée : bloque
- Qui bute : toute planner en migration le premier jour ; « Paramètres » n'est pas l'endroit où l'on cherche ses mariages.
- Principe candidat : un parcours central garde une entrée au premier niveau tant qu'il n'est pas terminé.

### H-MI-06 — Le modèle de rétroplanning met un mariage en cours « en retard de 250 jours »
- Écran et taille : fiche de « Juliette & Romain » (créée, 20 mars 2027, modèle coché), `/`, 1 440 ; bandeau de la fiche reprise « Léa & Hugo »
- Constat : à 115 jours du jour J, le modèle de départ crée 18 tâches dont 10 en retard : « Réserver le lieu de réception · En retard de 215 jours », « Définir le budget global · En retard de 250 jours ». Le menu affiche « Tâches · 10 en retard » en rouge, sur deux lignes. Sur le mariage repris, le bandeau « Prochaine étape : appliquer le rétroplanning » pousse au même geste, bouton principal « Appliquer le modèle », sans dire que les tâches passées seront en retard.
- Preuve : P/s2-044-aujourdhui-apres-reprise.jpg ; P/s1/055.jpg et P/s1/059.jpg (bandeau)
- Gravité présumée : bloque
- Qui bute : la planner qui reprend un mariage à quatre mois du jour J ; le lieu est réservé et payé, l'écran dit le contraire.
- Principe candidat : appliquer un modèle à un évènement déjà commencé demande quoi faire des échéances passées (faites, à revoir, ignorées).

### H-MI-07 — Les tâches du tableur n'ont pas de porte dans le mariage, et leurs deux colonnes utiles ne sont pas reconnues
- Écran et taille : `/import?type=tasks&evenement=…` (adresse tapée), `/import/[id]/colonnes`, 1 440
- Constat : l'onglet Rétroplanning n'a pas de bouton « Importer » (vu dans le code : seul l'onglet Budget porte ce lien ; l'adresse fonctionne si on la tape et affiche « Les lignes iront dans l'évènement « Juliette & Romain » »). Sur `a-faire.csv`, « Symbola en a reconnu 2 sur 4 » : « Fait ? » et « Qui » ; « Quoi » et « Pour quand », le titre et l'échéance, sont « À choisir ». L'aperçu titre la fiche « moi ».
- Preuve : P/s2-048-taches-et-journal.jpg, P/s2-050-taches-colonnes.jpg ; code `apps/symbola/app/events/[id]/page.tsx` l. 945
- Gravité présumée : bloque (supposé : par `/import`, les tâches subissent le même rejet que le budget ; non rejoué)
- Qui bute : la planner au tableur ; sa liste « à faire » est ce qu'elle ouvre chaque matin.
- Principe candidat : ce qui s'importe dans un évènement s'importe depuis chaque onglet concerné, au même endroit.

### H-MI-08 — On reprend à sept endroits, sans ordre affiché
- Écran et taille : `/import`, `/events`, `/prestataires`, onglets Budget et Programme de la fiche, 1 440
- Constat : quatre tuiles sur `/import` ; « Importer » dans la liste des évènements et dans le carnet ; « Importer » et « Reprendre les prestataires retenus (PDF) » dans l'onglet Budget ; « Importer » et « Importer un chrono (tableur ou PDF) » dans l'onglet Programme. `/import` dit « Deux PDF sont repris ailleurs » et oublie le troisième (prestataires retenus). Le texte qui donne l'ordre (« Reprenez d'abord votre carnet de prestataires, puis vos événements », `fr.json` l. 3666) n'était pas affiché sur mon écran.
- Preuve : P/s1/027.jpg, P/s1/064.jpg, P/s2-017-autre-fichier.jpg, R/repris/shots/events_id_onglet_programme--1440.jpg, R/repris/shots/prestataires--1440-haut.jpg
- Gravité présumée : freine
- Qui bute : la planner qui a quatre fichiers par mariage ; elle ne sait ni par lequel commencer ni ce qui reste à faire.
- Principe candidat : une reprise se suit sur une seule page, qui liste les fichiers attendus, leur ordre et leur état (fait, reste).

### H-MI-09 — Les sommes déjà payées finissent dans « Champs importés » et le budget dit « 0,00 € engagés »
- Écran et taille : Synthèse de la fiche reprise, 1 440
- Constat : la fiche PDF dit « Total Payé : 3200.0 € », « Total : 21650.5 € ». La Synthèse affiche « 0,00 € engagés sur une enveloppe de 25 000,00 € » ; les trois montants sont tout en bas, sous « Champs importés », écrits « 18450,50 € » sans espace de milliers, rangés par ordre alphabétique. « Budget Total », « Budget Restant » et « Vous avez utilisé 0% » ne figurent nulle part, sans mention.
- Preuve : R/repris/shots/events_id_--1440.jpg ; P/s1/039.jpg (« Pas de filtre ni de calcul ») ; texte de la fiche relevé en session 1
- Gravité présumée : freine
- Qui bute : la planner qui pilote au réglé et au reste à payer ; le chiffre de tête de sa fiche est faux dès le premier jour.
- Principe candidat : un montant repris hors calcul est signalé là où le calcul s'affiche, avec le geste pour l'y faire entrer.

### H-MI-10 — L'assistant promet la rubrique « Notes » ; la fiche affiche « Notes — »
- Écran et taille : `/import/[id]/colonnes` puis Synthèse, 1 440
- Constat : sous « Une note sur la fiche », l'assistant écrit « Visible sur la fiche, rubrique « Notes » ». Sur la fiche, « Notes » vaut « — » ; les valeurs sont dans un autre bloc, « Champs importés », plus bas.
- Preuve : P/s1/039.jpg ; R/repris/shots/events_id_--1440.jpg
- Gravité présumée : freine
- Qui bute : la planner qui vérifie son import ; elle cherche au bon endroit, lit « — » et conclut à une perte.
- Principe candidat : un écran nomme l'endroit d'arrivée par le mot exact que porte cet endroit.

### H-MI-11 — Des lignes de budget sans montant, comptées « 11 lignes pourvues sur 11 »
- Écran et taille : `/events/[id]?onglet=budget`, espace repris, 1 440
- Constat : après la reprise du PDF, onze lignes « Retenu », toutes à « — » en Prévu, Réel, Écart, et « 0,00 € » en Réglé ; total « 0,00 € » cinq fois. La barre de progression est pleine et verte. Rien ne dit que le PDF ne portait pas de montants ni où les saisir.
- Preuve : R/repris/shots/events_id_onglet_budget--1440.jpg
- Gravité présumée : freine
- Qui bute : la planner qui croit le budget repris parce que la barre est verte. Dépend de la couleur : le vert plein dit « terminé » ; avec le futur trio, réserver la couleur de réussite à un état vraiment complet.
- Principe candidat : une valeur absente après un import dit pourquoi et quoi faire ; un indicateur de complétude ne compte que ce qui est complet.

### H-MI-12 — Les postes du tableur doublent les postes de départ
- Écran et taille : onglet Budget après `budget.csv`, 1 440
- Constat : « Lieu » (deux lignes) est créé à côté de « Lieu de réception · À trouver » ; « Photo et vidéo » (deux lignes) à côté de « Photographe · À trouver » et « Vidéaste · À trouver » ; « Musique » (deux lignes) à côté de « DJ / musiciens · À trouver ». L'onglet passe à « 6 lignes pourvues sur 18 ».
- Preuve : texte de l'onglet (session 2, commande 43) ; P/s2-040-budget-confirmation.jpg (créations « Lieu », « Photo et vidéo », « Musique »)
- Gravité présumée : freine
- Qui bute : la planner au tableur ; elle a un lieu payé et un poste « Lieu de réception — À trouver » sur le même écran.
- Principe candidat : un import qui crée une catégorie proche d'une catégorie existante le dit et propose de les réunir.

### H-MI-13 — Trois lignes « Traiteur » fondues en une, et un écart faux
- Écran et taille : `/import/[id]/rapprochements`, puis onglet Budget, 1 440
- Constat : l'écran des doublons montre trois lignes nommées « Traiteur » (lignes 4, 5, 6), sans le détail ni le montant qui les distinguent. « Valider les 8 rapprochements proposés » les réunit : Prévu 17 100,00 € (somme des trois), Réel 13 640,00 € (une seule), « Écart − 3 460,00 € ». « Brunch du dimanche » et « Vins et champagne » ne sont plus des lignes.
- Preuve : P/s2-037-budget-rapprochements.jpg ; texte de l'onglet (session 2, commande 43)
- Gravité présumée : freine
- Qui bute : la planner qui suit le brunch à part ; son tableur avait 14 lignes, Symbola en garde moins sans l'avoir dit.
- Principe candidat : une décision de rapprochement montre ce qui distingue les lignes et ce que deviendra chaque valeur.

### H-MI-14 — Le bilan contredit la confirmation
- Écran et taille : `/import/[id]/confirmation` puis `/import/[id]/journal`, 1 440
- Constat : avant : « Fiches créées 6 · Fiches mises à jour 8 ». Après : « 14 créés · 0 mis à jour ». Dans l'impasse de H-MI-01, l'étape « Doublons » affiche « 14 nouveaux » à côté de « Lignes rejetées 14 ». Pour la fiche PDF : « toutes reconnues (25) » puis « 19 colonnes reconnues, 4 en note, 2 ignorées ».
- Preuve : P/s2-040-budget-confirmation.jpg, P/s2-045-budget-bilan.jpg, P/s2-023-budget-14-rejetees.jpg, P/s1/034.jpg
- Gravité présumée : freine
- Qui bute : la planner prudente ; c'est le moment où elle se demande si l'import a tout pris.
- Principe candidat : les nombres annoncés avant une action sont ceux du compte rendu après.

### H-MI-15 — Un mariage repris n'a pas de type
- Écran et taille : en-tête de la fiche, repris (mon compte et Martine) et créé (mon compte), 1 440
- Constat : repris : « Type d'événement : Type à préciser », lien « Changer le type », et plus bas « Plage occupée · Règle des évènements sans type ». Créé à la main : « Mariage ». La tuile s'appelait pourtant « Reprendre mes événements » dans un espace qui n'organise que des mariages.
- Preuve : P/s1/055.jpg ; R/repris/shots/events_id_--1440.jpg ; texte de la fiche créée (session 2, commande 30)
- Gravité présumée : freine
- Qui bute : la planner qui ne fait que des mariages ; elle ne sait pas ce que le type commande, ni qu'il manque.
- Principe candidat : quand une seule valeur est possible, l'import la pose ; sinon il la demande à l'étape de vérification.

### H-MI-16 — Le programme repris invente des heures de fin
- Écran et taille : `/events/[id]?onglet=programme`, espace repris, 1 440
- Constat : dans le PDF, « 00:30 Fin de soirée » n'a pas de fin ; repris : « 00:30 – 11:00 · 10 h 30 ». « 12:00 Récupérer les clés » devient « 12:00 – 12:15 · 15 min ». « 11:00 - 00:00 Repas à la charge des mariés » devient « 11:00 – 12:00 · 1 h ». Rien ne distingue une heure lue d'une heure déduite.
- Preuve : R/repris/shots/events_id_onglet_programme--1440.jpg ; PDF `programme-jour-j.pdf` p. 3 et 4
- Gravité présumée : freine
- Qui bute : la planner qui diffuse le programme aux prestataires ; une durée fausse part chez le DJ.
- Principe candidat : une valeur déduite par l'import porte une marque tant qu'elle n'est pas confirmée.

### H-MI-17 — Aucun contrôle que le fichier est bien celui de ce mariage
- Écran et taille : onglet Budget (aperçu du PDF), onglet Programme, 1 440
- Constat : sur la fiche de « Léa & Hugo », l'aperçu écrit « Fichier de : Clémence MARTIN, Bastien LEROY — 12 juin 2027. » en texte courant, sans alerte. Chez Martine, le programme repris porte « Mariée - Clémence » et « Marié - Bastien » dans la colonne « Qui » d'un mariage dont les mariés sont Léa et Hugo.
- Preuve : P/s1/068.jpg ; R/repris/shots/events_id_onglet_programme--1440.jpg
- Gravité présumée : freine
- Qui bute : la planner qui reprend dix mariages d'affilée ; un fichier déposé sur la mauvaise fiche passe.
- Principe candidat : quand le fichier nomme un autre objet que l'objet ouvert, l'écran arrête et demande.

### H-MI-18 — Trois journées toutes intitulées « Jour J », et un bloc sans titre
- Écran et taille : onglet Programme et Synthèse, espace repris, 1 440
- Constat : « Jour J — 11 juin 2027 », « Jour J — 12 juin 2027 », « Jour J — 13 juin 2027 » ; la veille et le lendemain s'appellent aussi « Jour J ». La Synthèse liste trois temps forts « Jour J » avec trois boutons « Modifier « Jour J » ». Un quatrième tableau, sans titre ni date, porte « 14:30 – 16:00 Domaine des Tilleuls » et « 16:00 Église Saint-Exemple de Villefictive » : ce sont les « lieux et horaires » de la fiche PDF, devenus des séquences. Le mariage créé, lui, a « Cérémonie laïque », « Dîner », « Brunch ».
- Preuve : R/repris/shots/events_id_onglet_programme--1440.jpg ; R/repris/shots/events_id_--1440.jpg ; R/camille/shots/events_id_onglet_programme--1440.jpg
- Gravité présumée : freine
- Qui bute : la planner et, plus tard, les invités, qui « répondent pour chacun » des temps forts.
- Principe candidat : deux objets de même rang ne portent jamais le même nom ; un bloc sans titre n'existe pas.

### H-MI-19 — L'annuaire du programme est perdu, les lieux des séquences sont vides
- Écran et taille : onglet Programme, espace repris, 1 440
- Constat : le PDF donne huit rôles avec nom et téléphone (traiteur Paul VERDIER, DJ Félix ROUSSEL…). Repris : « Contacts du jour J : Aucun contact du jour J. » La colonne « Lieu » est vide sur les douze séquences. La description de la cérémonie (vingt-cinq lignes) est un seul paragraphe en italique, « Ligne 19 Ligne 20 … Ligne 33 Fin du déroulé » à la suite.
- Preuve : R/repris/shots/events_id_onglet_programme--1440.jpg ; PDF `programme-jour-j.pdf` p. 1 à 4
- Gravité présumée : freine
- Qui bute : la planner le jour J ; les numéros qu'elle avait dans son ancien outil ne sont plus à l'écran.
- Principe candidat : l'import dit, par bloc du fichier, ce qu'il a pris et ce qu'il a laissé.

### H-MI-20 — « Source » est obligatoire, sans le dire, pour un mariage déjà signé
- Écran et taille : `/import/[id]/confirmation`, 1 440
- Constat : « Source pour les événements sans source », liste « Choisissez une source ». Le libellé ne dit ni « obligatoire » ni à quoi sert la source. « Importer 1 événement » ne fait rien tant qu'elle est vide ; seule la bulle du navigateur le signale. Huit options, aucune « Je ne sais plus ».
- Preuve : P/s1/043.jpg
- Gravité présumée : freine
- Qui bute : la planner qui reprend trente mariages ; elle invente une source pour passer, et fausse ses statistiques.
- Principe candidat : un champ obligatoire le dit avant l'envoi, et une reprise admet « inconnu ».

### H-MI-21 — « Bon » et « tout est à jour » pour un mariage sans aucune tâche
- Écran et taille : Synthèse, `/taches`, onglet Rétroplanning, espace repris, 1 440
- Constat : « Planning · 0 sur 0 tâches faites · Aucune tâche en retard · Bon » ; `/taches` : « Aucune tâche à faire : tout est à jour. » ; Rétroplanning : « 0 tâche faite sur 0 · 0 en retard ». Le mariage est à 199 jours, ses tâches sont restées dans l'ancien outil.
- Preuve : R/repris/shots/events_id_--1440.jpg ; R/repris/shots/taches--1440-haut.jpg ; R/repris/shots/events_id_onglet_retroplanning--1440.jpg
- Gravité présumée : freine
- Qui bute : la planner rassurée à tort ; rien ne lui dit de reprendre ou de créer ses tâches.
- Principe candidat : « vide » et « à jour » sont deux états, avec deux textes et deux actions.

### H-MI-22 — La frise date la confirmation du jour de l'import
- Écran et taille : frise de statut, repris et créé, 1 440
- Constat : repris : « Option ✓ » sans date, « Confirmé · 25 novembre 2026 » (jour de l'import ; 24 chez Martine). Créé à la main : « Option · 25 novembre 2026 », « Confirmé · 25 novembre 2026 ». Le mariage repris est confirmé depuis des mois ; la date affichée est celle de la saisie.
- Preuve : P/s1/055.jpg ; R/repris/shots/events_id_onglet_retroplanning--1440.jpg ; texte de la fiche créée (session 2)
- Gravité présumée : gêne
- Qui bute : la planner qui relit l'historique d'un dossier, ou une associée qui le découvre.
- Principe candidat : une date d'étape inconnue reste vide ou se dit « repris le… », jamais « confirmé le… ».

### H-MI-23 — Le bandeau « Prochaine étape » propose le premier pas d'un mariage neuf
- Écran et taille : fiche reprise, tous les onglets, 1 440
- Constat : « Prochaine étape : appliquer le rétroplanning » (compte passé par l'assistant) ou « créer les liens des mariés » (Martine), bouton principal sur toute la largeur, environ 150 px au-dessus des onglets, répété sur chaque onglet. Le mariage créé de référence n'a pas ce bandeau. Pour un mariage repris, la suite logique serait « reprendre ses prestataires, son budget, son programme ».
- Preuve : P/s1/055.jpg, P/s1/059.jpg, P/s1/064.jpg ; R/repris/shots/events_id_onglet_budget--1440.jpg
- Gravité présumée : gêne
- Qui bute : la planner en reprise ; l'action la plus visible de la fiche n'est pas la sienne.
- Principe candidat : la « prochaine étape » d'un objet dépend de son origine et de son avancement.

### H-MI-24 — Un PDF décrit avec les mots d'un tableur, et des valeurs techniques
- Écran et taille : `/import/[id]/confirmation` et `/colonnes` pour la fiche PDF, 1 440
- Constat : « 1 ligne », « 19 colonnes reconnues, 4 en note sur la fiche, 2 ignorées », « Ligne 1 : Léa MARTIN & Hugo BERNARD », « Lignes rejetées ». Les deux « colonnes ignorées » sont « Fiche » (le nom du fichier) et « Motif de rejet · Colonne vide. », qui n'existent pas dans le PDF. « Statut : confirmed » en anglais, « Date de l'événement 2027-06-12 ».
- Preuve : P/s1/034.jpg, P/s1/039.jpg ; texte de l'étape Colonnes (session 1)
- Gravité présumée : gêne
- Qui bute : la planner peu à l'aise avec l'informatique ; « 2 colonnes ignorées » sonne comme une perte.
- Principe candidat : l'écran parle de ce que l'utilisatrice a déposé (une fiche, des rubriques), pas de la mécanique.

### H-MI-25 — « Vérifier et confirmer » ne montre pas ce qui sera créé
- Écran et taille : `/import/[id]/confirmation`, fiche PDF et budget, 1 440
- Constat : pour la fiche : une ligne, « Léa MARTIN & Hugo BERNARD, le 12 juin 2027 », sous le titre « Création (échantillon) » ; ni lieux, ni coordonnées, ni budget. Pour le budget : cinq lignes « Lieu — 6 500,00 € », sans total. La planner ne peut pas comparer « 36 450,00 € » à son tableur avant de confirmer.
- Preuve : P/s1/034.jpg, P/s2-040-budget-confirmation.jpg
- Gravité présumée : gêne
- Qui bute : la planner qui veut une preuve avant d'appuyer.
- Principe candidat : l'écran de confirmation d'un import donne un total de contrôle et la fiche telle qu'elle sera.

### H-MI-26 — « Voir l'événement » ouvre la liste, puis une visite guidée la recouvre
- Écran et taille : `/import/[id]/journal` puis `/events`, puis fiche, compte neuf, 1 440
- Constat : le bouton principal du bilan, « Voir l'événement », mène à `/events`, pas à la fiche. Une visite « 1 sur 5 · La liste » s'ouvre et bloque le clic sur la ligne ; son cadre entoure la barre du haut, pas la liste. La fiche ouvre une troisième visite (« 1 sur 5 · Les onglets »). Trois visites en trois écrans, au moment où la planner veut voir son mariage.
- Preuve : P/s1/047.jpg, P/s1/050.jpg, P/s1/055.jpg
- Gravité présumée : gêne
- Qui bute : la planner qui vient de confirmer son premier import.
- Principe candidat : un bouton au singulier ouvre l'objet ; une visite guidée n'interrompt pas un parcours en cours.

### H-MI-27 — « Reprendre » a cinq sens, et la reprise trois noms
- Écran et taille : accueil, `/import`, journal, menu des Paramètres, 1 440
- Constat : « Reprendre le questionnaire » (continuer), « Reprendre mes événements » (importer), « en cours · Reprendre » (continuer un import), « Reprendre un export » (restaurer une archive Symbola, juste sous « Importer » dans le menu), « (poste repris de la ligne 4) » (recopié). La même page s'appelle « Importer » (menu), « Importer des données » (titre), « Importer un fichier » (recherche), « Importer ses événements existants » (tutoriel) ; le journal s'appelle aussi « Historique des imports ».
- Preuve : P/s1/027.jpg, P/s1/023.jpg, P/s1/047.jpg, P/s2-032-import-depuis-onglet-budget.jpg, P/s2-037-budget-rapprochements.jpg
- Gravité présumée : gêne
- Qui bute : la planner qui cherche « reprendre mes mariages » et lit « Reprendre un export ».
- Principe candidat : un verbe, un geste ; « reprendre » est réservé à l'arrivée depuis un autre outil.

### H-MI-28 — Les quatre tuiles de `/import` n'ont pas l'air de boutons ; le seul bouton plein est le tutoriel
- Écran et taille : `/import`, 1 440
- Constat : quatre cadres blancs, titre gras et cinq à six lignes de texte gris, sans flèche ni bouton. Le seul bouton principal de l'écran est « Commencer le tutoriel ». Le formulaire s'ouvre sous les tuiles : la page saute de 600 à 880 px. Le relevé compte déjà quatre libellés sur deux lignes ici.
- Preuve : P/s1/027.jpg, P/s1/031.jpg ; relevé § 5, `/import`
- Gravité présumée : gêne
- Qui bute : la planner qui lit avant de cliquer ; elle prend les tuiles pour une explication.
- Principe candidat : ce qui est cliquable en a l'air ; l'action principale de l'écran est celle du parcours, pas l'aide.

### H-MI-29 — « Que contient le fichier ? » : huit choix, aucun proposé
- Écran et taille : `/import?type=autre`, 1 440
- Constat : huit boutons radio, de « Événements et leurs clients » à « Modes de paiement », sans choix par défaut. Les trois qui servent à une reprise (évènements, tâches, lignes de budget) sont mêlés à cinq listes de réglage. Symbola lit ensuite les en-têtes « Poste, Prévu, Réel » mais ne s'en sert pas pour proposer.
- Preuve : P/s2-017-autre-fichier.jpg
- Gravité présumée : gêne
- Qui bute : la planner au tableur ; « Lignes de budget » ou « Lignes du budget par défaut » ?
- Principe candidat : quand l'app peut deviner, elle propose et l'utilisatrice confirme.

### H-MI-30 — Trois boutons de lot aux noms voisins, et « Continuer » plein alors que rien ne peut continuer
- Écran et taille : `/import/[id]/rapprochements`, 1 440
- Constat : « Valider les 8 rapprochements proposés », « Créer les 8 lignes comme nouvelles », « Tout accepter (5 propositions sûres) » ; par ligne, « Mettre à jour », « Créer », « Rapprocher ». Quatre verbes pour deux décisions. « Continuer » garde sa couleur pleine sous « L'import ne peut pas être confirmé tant qu'il en reste ». Même écran pour le carnet : 25 rapprochements.
- Preuve : P/s2-037-budget-rapprochements.jpg ; R/import/shots/import_importId_rapprochements--1440-haut.jpg
- Gravité présumée : gêne
- Qui bute : toute planner ; c'est la seule vraie décision de l'import. Dépend de la couleur : le bandeau d'alerte est ambré ; si l'orange devient une couleur d'action, alerte et action se confondront ici.
- Principe candidat : une décision binaire a deux boutons, et un bouton inactif n'a pas la couleur d'une action.

### H-MI-31 — Le journal ne dit ni le mariage, ni le résultat
- Écran et taille : `/import`, bloc « Journal des imports », 1 440
- Constat : colonnes « Date, Fichier, Contenu, Lignes, État ». Deux lignes « budget.csv · Lignes de budget · 14 », l'une « annulé », l'autre « en cours · Reprendre ». Ni l'évènement visé, ni le nombre de créés et de rejetés, ni l'auteur. L'import laissé dans l'impasse de H-MI-01 reste « en cours ».
- Preuve : P/s2-048-taches-et-journal.jpg
- Gravité présumée : gêne
- Qui bute : la planner qui reprend dix mariages, chacun avec son « budget.csv ».
- Principe candidat : une ligne de journal se suffit : quoi, où, combien, par qui, et la suite possible.

### H-MI-32 — L'annulation existe et dure 90 jours, mais son texte se relit deux fois
- Écran et taille : `/import/[id]/journal`, 1 440
- Constat : « Annuler cet import » ouvre : « Annulation possible jusqu'au 23 février 2027 à 04:35. L'annulation supprime les 14 éléments créés et remet rien d'autre. » La dernière phrase est fautive. Rien ne dit ce que deviennent les changements faits depuis sur ces lignes. Après le clic, la capture immédiate ne montre aucun message ; le journal dit ensuite « annulé ». Le bilan du budget n'a pas de lien vers le mariage (celui de la fiche en a un).
- Preuve : P/s2-046-annuler-import.jpg, P/s2-048-taches-et-journal.jpg, P/s2-045-budget-bilan.jpg
- Gravité présumée : gêne
- Qui bute : la planner qui s'est trompée de fichier et veut être sûre d'être revenue en arrière. Vérifié : l'onglet Budget revient à « Aucune ligne pourvue sur 12 », total 0,00 €.
- Principe candidat : après une annulation, l'écran montre l'état retrouvé et un lien vers l'objet.

### H-MI-33 — Des statuts de prestataire déduits sans le dire
- Écran et taille : onglet Budget après `budget.csv`, 1 440
- Constat : une ligne avec « Réel » devient « Retenu · Engagé » ; une ligne avec prestataire sans « Réel » devient « Pressenti » (Élodie Beauté, alors que la note du tableur dit « Essai le 6 février ») ; sans prestataire, « À trouver ». Aucune étape n'a annoncé cette règle.
- Preuve : texte de l'onglet (session 2, commande 43) ; `prestataires.csv`
- Gravité présumée : gêne
- Qui bute : la planner qui lit « Pressenti » pour une coiffeuse réservée.
- Principe candidat : une règle de déduction s'écrit à l'étape de vérification, avec le moyen de la corriger en lot.

### H-MI-34 — Les capitales de l'ancien outil restent
- Écran et taille : Synthèse et onglet Mariés, repris, 1 440
- Constat : « Léa MARTIN · Hugo BERNARD », « POITIERS » ; le mariage créé affiche « Léa Martin · Maxime Dubois ». Le titre, lui, est bien « Léa & Hugo ».
- Preuve : P/s1/059.jpg ; R/repris/shots/events_id_--1440.jpg ; R/camille/shots/events_id_--1440.jpg
- Gravité présumée : détail
- Qui bute : la planner soigneuse ; ces noms partiront sur un devis ou un lien personnel.
- Principe candidat : l'import met les noms à la casse de l'app et le montre dans l'aperçu.

### H-MI-35 — Le mariage créé reçoit une source sans qu'on la demande ; le mariage repris l'exige
- Écran et taille : `/demarrage/pret` puis fiche créée ; confirmation d'import, 1 440
- Constat : « Juliette & Romain », créé par le formulaire de fin d'assistant (trois champs), affiche « Source du prospect : Instagram » : je ne l'ai pas choisie. L'import, lui, bloque tant que la source n'est pas choisie (H-MI-20).
- Preuve : texte de la fiche créée (session 2, commande 30) ; P/s1/043.jpg
- Gravité présumée : gêne
- Qui bute : la planner qui regardera ses sources en fin d'année.
- Principe candidat : une même donnée a la même règle (demandée, facultative, valeur par défaut) quelle que soit la porte d'entrée.

### H-MI-36 — Rien ne marque une valeur reprise, ni ne relie la fiche à son import
- Écran et taille : liste, fiche, onglets, repris, 1 440
- Constat : la liste est identique pour un mariage repris et un mariage créé. Sur la fiche, le seul signe est le bloc « Champs importés », en bas. Aucun lien « repris le 25 novembre depuis fiche-evenement-complete.pdf », aucun accès au bilan ni à l'annulation depuis la fiche.
- Preuve : R/repris/shots/events--1440-haut.jpg ; R/camille/shots/events--1440-haut.jpg ; R/repris/shots/events_id_--1440.jpg
- Gravité présumée : gêne
- Qui bute : la planner qui doute d'une valeur trois semaines plus tard.
- Principe candidat : un objet repris garde la trace de son origine, à un clic.

### H-MI-37 — L'aperçu des prestataires retenus tient dans 620 px, ses listes sont coupées
- Écran et taille : onglet Budget, aperçu du PDF, 1 440
- Constat : dans une zone de 1 056 px, le tableau fait environ 620 px. Les deux listes par ligne affichent « Cré », « Nouv », « Traite » : le choix proposé (créer la fiche, nouvelle ligne ou poste existant) ne se lit pas sans ouvrir chaque liste, douze fois. « 12 prestataires lus » est écrit deux fois. Les en-têtes « Fiche du carnet », « Ligne du budget », « Ne pas reprendre » sont sur deux lignes.
- Preuve : P/s1/068.jpg
- Gravité présumée : freine
- Qui bute : toute planner ; c'est l'écran où elle décide de ce qui entre dans son budget.
- Principe candidat : aucune troncature dans un choix à valider ; un tableau de décision prend la largeur disponible.

### H-MI-38 — « Coiffeur(se) - Maquilleur(se) » ne rejoint pas « Coiffure et maquillage »
- Écran et taille : aperçu du PDF des prestataires ; onglet Budget chez Martine, 1 440
- Constat : pour Iris Beauté, la fiche proposée est « métier à classer » et la ligne « Nouvelle ligne « Coiffeur(se) - Maquilleur(se) » », alors que le poste « Coiffure et maquillage » existe. Chez Martine, le budget repris porte les mots de l'ancien outil : « Baby-Sitter », « Robe de mariée », « Coiffeur(se) - Maquilleur(se) » ; deux fleuristes sur une seule ligne. Le carnet affiche « 3 prestataires à classer ».
- Preuve : texte de l'aperçu (session 1) et P/s1/068.jpg ; R/repris/shots/events_id_onglet_budget--1440.jpg ; R/repris/shots/prestataires--1440-haut.jpg
- Gravité présumée : gêne
- Qui bute : la planner qui retrouve les libellés de l'outil qu'elle quitte.
- Principe candidat : l'import range dans le vocabulaire de l'espace ; ce qu'il n'a pas su ranger est listé une fois, avec le geste pour le faire.

### H-MI-39 — Un compte neuf arrive sur « Aujourd'hui », pas sur l'assistant
- Écran et taille : `/`, compte neuf, 1 440
- Constat : à la première ouverture, « Aujourd'hui » s'affiche avec une visite guidée « 1 sur 4 » et un bandeau « Terminez la préparation de votre espace : il reste 5 questions. Reprendre le questionnaire ». On peut importer avant d'avoir répondu : l'espace n'a alors ni modèles ni postes (c'est l'état de l'espace de Martine). Réserve : l'outil de navigation ouvre le compte « déjà connecté, sur l'accueil » ; l'arrivée réelle après inscription n'est pas vue.
- Preuve : capture lue en session 1 (non conservée : numéro réécrit) ; P/s1/015.jpg pour la suite
- Gravité présumée : gêne
- Qui bute : la planner pressée qui saute le questionnaire et importe d'abord.
- Principe candidat : ce qui conditionne le résultat d'un import se règle avant l'import, et l'import le vérifie.

### H-MI-40 — La recherche propose l'action, la touche Entrée ouvre autre chose
- Écran et taille : barre de recherche, 1 440
- Constat : « importer » affiche une action, « Importer un fichier », et l'aide « Entrée pour ouvrir ». Entrée mène à `/recherche?q=importer`, qui liste « Importer ses événements existants · Tutoriel » et « Importer des données · Écran de l'application ». Le mot « importer » reste ensuite dans le champ sur tous les écrans suivants.
- Preuve : P/s1/023.jpg, P/s1/027.jpg, P/s1/034.jpg
- Gravité présumée : détail
- Qui bute : la planner au clavier.
- Principe candidat : quand une seule suggestion est affichée, Entrée l'ouvre.

### H-MI-41 — L'aperçu de l'étape Colonnes est trop étroit pour ses libellés
- Écran et taille : `/import/[id]/colonnes`, 1 440
- Constat : dans le panneau de droite, « Adresse du client 2 », « Ville du client 2 », « Statut de l'événement » tombent sur deux ou trois lignes ; l'e-mail est coupé « hugo.bernard@exampl / e.org ». La pastille « Reconnue » s'applique aussi aux colonnes envoyées en note. La page fait 2 676 px pour une fiche d'une page.
- Preuve : P/s1/039.jpg ; relevé § 5 (`/import/[importId]/colonnes` : 8 colonnes sur deux lignes)
- Gravité présumée : détail
- Qui bute : la planner qui relit l'aperçu avant de continuer.
- Principe candidat : aucun libellé de champ sur deux lignes ; un aperçu a la forme de la fiche finale.

## 3. Matrice repris ou créé

« Créé » = « Léa & Maxime » (Camille, jeu fictif) et, quand la ligne le dit, « Juliette & Romain »
(créé par moi à la fin de l'assistant). « Repris » = « Léa & Hugo » chez Martine (espace fait par
l'outil de test) et dans mon compte `spec-MI-1` (passé par l'assistant).

| Écran | Élément | Mariage créé | Mariage repris | Effet sur la planner | L'écran l'explique-t-il |
| --- | --- | --- | --- | --- | --- |
| Liste | Ligne | Mariés, date, statut, lieu | Identique | Aucun ; impossible de retrouver « ce que j'ai importé » | Non, aucune marque |
| Fiche, en-tête | Type d'évènement | « Mariage » (Juliette & Romain) ; « Type à préciser » chez Camille (défaut du jeu fictif) | « Type à préciser » (les deux comptes) | Plage occupée « sans type » ; type à poser à la main | Non |
| Fiche, en-tête | Source du prospect | « Instagram », posée sans question | Demandée, obligatoire à l'import | Statistiques faussées des deux côtés | Non |
| Fiche, boutons | « Voir comme … » | « Voir comme Léa Martin » | Absent | Pas d'aperçu client tant qu'aucun lien | Non |
| Frise | Dates | Option, Confirmé (ou En préparation) datés | « Option ✓ » sans date ; « Confirmé » daté du jour de l'import | Historique faux | Non |
| Avant les onglets | Bandeau « Prochaine étape » | Aucun (Camille) ; « créer les liens des mariés » (Juliette & Romain) | « appliquer le rétroplanning » (compte avec assistant) ; « créer les liens des mariés » (Martine) | L'action la plus visible n'est pas celle d'une reprise | En partie : dit quoi faire, pas ce qui manque |
| Barre d'onglets | Pastille Budget | « 6/9 » | « 11/11 » (Martine) ; « 0/12 » avant la reprise des prestataires | 11/11 se lit « budget complet » | Non |
| Synthèse | Prochaine action | Deux tâches en retard, un contrat à faire signer | « Rien à faire … tout est à jour » puis, après le PDF, douze « Contrat … à faire signer · Depuis le [jour de l'import] » | Douze fausses relances | Non |
| Synthèse | Santé › Planning | « 31 sur 42 tâches faites · 2 en retard · À surveiller » | « 0 sur 0 tâches faites · Aucune tâche en retard · Bon » | Fausse assurance | « Pourquoi ? » non ouvert |
| Synthèse | Santé › Budget | « 24 150,00 € engagés sur 35 000,00 € » | « 0,00 € engagés sur une enveloppe de 25 000,00 € » (le fichier disait 21 650,50 €, dont 3 200 € payés) | Chiffre de tête faux | Non ; les montants sont en bas, « Champs importés » |
| Synthèse | Les 14 prochains jours | Quatre lignes | « Rien d'ici quatorze jours. » | Vide sans raison | Non |
| Synthèse | Interlocuteurs | « Léa Martin · Maxime Dubois » | « Léa MARTIN · Hugo BERNARD » | Capitales sur les documents à venir | Non |
| Synthèse | Notes | « — » | « — », alors que l'import annonçait « rubrique Notes » | Croit la note perdue | Non |
| Synthèse | Temps forts | « Cérémonie laïque · 15:30 », « Dîner », « Brunch » | Aucun, puis trois « Jour J » (11, 12, 13 juin) après le programme | Invités appelés à répondre à trois « Jour J » | Non |
| Synthèse | « Champs importés » | Absent | Note, Solde, Total, Total Payé | Seul signe de la reprise ; hors calcul | En partie (le titre) |
| Budget et prestataires | Noms des lignes | Postes de l'espace (« Lieu de réception », « Traiteur »…) | Mots de l'ancien outil (« Baby-Sitter », « Coiffeur(se) - Maquilleur(se) ») ou du tableur (« Lieu », « Musique ») à côté des postes de départ | Doublons de postes | Non |
| Budget et prestataires | Montants | Prévu, réel, réglé, reste, échéance | PDF : « — » partout, total 0,00 € ; tableur : Prévu 36 450,00 €, Réel 27 502,00 €, Réglé 0,00 € | PDF : budget vide ; tableur : payé non repris | Non |
| Budget et prestataires | Statuts | « Contrat signé », « Engagé », « Devis reçu », « Soldé », « À trouver » | PDF : « Retenu » seul ; tableur : « Retenu · Engagé », « Pressenti », « À trouver » déduits | Contrats à refaire signer ; statuts à corriger un à un | Non |
| Budget et prestataires | Échéances | À venir, datées, « Soldé » | Tableur : acomptes versés affichés « En retard » | Fausses relances de paiement | Non |
| Rétroplanning | Tâches | 42 tâches, 2 en retard | « 0 tâche faite sur 0 » ; « Aucun modèle de rétroplanning » chez Martine seulement ; avec l'assistant, modèle de 18 tâches proposé | Sans modèle : vide ; avec : dix retards de 125 à 250 jours (vu sur Juliette & Romain) | Non |
| Programme | Titres des journées | Nom du temps fort et date | « Jour J — date » trois fois, plus un tableau sans titre | Veille et lendemain appelés « Jour J » | Non |
| Programme | Colonne « Lieu » | Remplie (« Terrasse », « Grande salle ») | Vide | À ressaisir | Non |
| Programme | Colonne « Qui » | Poste ou prestataire | Mélange : « Lieu », « Brunch » (pour le traiteur), « Mariée - Clémence », « Photographe, Gaspard » | Mauvais interlocuteur diffusé | Non |
| Programme | Heures de fin | Saisies | Déduites (« 00:30 – 11:00 · 10 h 30 ») | Durées fausses | Non, aucune marque |
| Programme | « Chevauchements à vérifier » | Affiché | Absent | — | — |
| Programme | Contacts du jour J | Aucun | Aucun, alors que le PDF en donnait huit | Numéros perdus | Non |
| Mariés | Liens personnels | Créés | « Aucun lien pour l'instant. » | Normal ; à créer | Oui (bandeau) |
| Aujourd'hui | Sous-titre et premier bloc | « 6 points » : tâches, une relance, un paiement | Martine : « 12 points », douze contrats à faire signer ; mon compte au tableur : « 22 points », dix tâches en retard | Premier matin : fausses urgences | Non |
| Tâches | Liste | 11 à faire, 2 en retard | « Aucune tâche à faire : tout est à jour. » | Fausse assurance | Dit d'où naissent les tâches, pas comment les reprendre |
| Menu latéral | Pastille « Tâches » | « 2 en retard » | Rien (Martine) ; « 10 en retard » si le modèle est appliqué | — | — |
| Carnet | Fiches | 12 prestataires | 35 fiches, « 3 prestataires à classer », « Non placé sur la carte » | Rangement à finir | Oui (« ranger les types ») |

## 4. Du fichier à la fiche

### Fiche d'évènement (PDF du logiciel spécialisé) — vérifié dans mon compte

| Champ du fichier | Ce qu'il devient | État |
| --- | --- | --- |
| « Léa MARTIN & Hugo BERNARD » | Titre « Léa & Hugo » ; interlocuteurs « Léa MARTIN · Hugo BERNARD » | Repris ; capitales gardées |
| Date : samedi 12 juin 2027 | « 12 juin 2027 », « 199 jours avant le jour J » | Repris |
| E-mails des deux mariés | Onglet Mariés, fiches de contact | Repris |
| Adresse, 86000 POITIERS (×2) | Adresse, code postal, ville des deux contacts | Repris ; « POITIERS » en capitales |
| Téléphones : 0639980101 | « 06 39 98 01 01 », sur Léa seule | Repris, mis en forme ; Hugo sans téléphone (comme dans le PDF) |
| Domaine des Tilleuls, 14:30 | Lieu de l'évènement (en-tête, fiche d'identité) ; l'heure devient une séquence « 14:30 – 16:00 Domaine des Tilleuls » dans un tableau sans titre du programme (vu chez Martine) | Lieu repris ; heure mise ailleurs, fin inventée |
| Église Saint-Exemple de Villefictive, 16:00 | Second lieu ; séquence « 16:00 » du même tableau | Idem |
| « Cérémonie laïque » | « Champs importés › Note » ; « Notes » reste « — » | Mis ailleurs |
| Budget Souhaité : 25000 € | « enveloppe de 25 000,00 € » | Repris |
| Total Payé : 3200.0 € | « Champs importés › Total Payé 3200,00 € » ; Réglé 0,00 € | Mis ailleurs, hors calcul |
| Solde : 18450.5 € ; Total : 21650.5 € | « Champs importés » | Mis ailleurs, hors calcul |
| Budget Total : 0 € ; Budget Restant ; « 0% de votre budget » | Rien | Perdu, sans mention |
| Pied de page (société de la planner, SIRET) | Rien | Écarté, sans mention |
| (absent) Statut | « Confirmé » proposé, daté du jour de l'import | Ajouté |
| (absent) Source | Demandée, obligatoire | Ajouté |
| (absent) Type | « Type à préciser » | Manquant |

### Prestataires retenus (PDF) — aperçu vu dans mon compte, résultat vu chez Martine

| Champ du fichier | Ce qu'il devient | État |
| --- | --- | --- |
| En-tête « Clémence MARTIN, Bastien LEROY », date | « Fichier de : … », sans alerte sur la fiche d'un autre couple | Affiché, non contrôlé |
| 13 lignes | « 12 prestataires lus » ; « Ligne non reprise, c'est vous : Belle Journée. » | Repris, exclusion dite |
| Type de prestataire | Nom d'une nouvelle ligne de budget, ou poste existant ; type de fiche rapproché (« Garde d'enfants ») ou « métier à classer » | Transformé |
| Nom | Fiche du carnet (créée ou retrouvée), « Retenu » sur la ligne | Repris |
| Contact, e-mail, téléphone | Montrés dans l'aperçu | Repris (fiche non ouverte) |
| Instagram | Absent de l'aperçu | Non vérifié |
| (absent) Montants, contrat, échéances | « — », 0,00 €, puis « Contrat … à faire signer » | Manquant, non expliqué |

### Programme du jour J (PDF) — résultat vu chez Martine, sur capture

| Champ du fichier | Ce qu'il devient | État |
| --- | --- | --- |
| Trois journées (11, 12, 13 juin) | Trois blocs « Jour J — date », trois temps forts « Jour J » | Repris, mal nommé |
| Heure seule (« 12:00 ») | Début, fin et durée (« 12:00 – 12:15 · 15 min ») | Transformé, fin inventée |
| « 11:00 - 00:00 » | « 11:00 – 12:00 · 1 h » | Transformé à tort |
| Titre de séquence | Séquence | Repris |
| Description | « Note interne », en un seul paragraphe | Repris, retours à la ligne perdus |
| Interlocuteur (« Traiteur - Paul », « Lieu - Claire ») | « Qui » : nom de poste (« Brunch », « Lieu ») ou texte brut | Transformé, parfois faux |
| « WeddingPlanner - Julie » | Rien | Écarté, sans mention |
| « Caché des mariés : Oui » | Pastille « Cachée des mariés » | Repris |
| Annuaire (rôle, nom, téléphone), p. 1 et 2 | « Aucun contact du jour J. » | Perdu |
| Lieux et heures de la p. 1 (Mairie de Villefictive) | Non retrouvés sur la capture | Non vérifié |

### Tableur de la planner — `budget.csv` vérifié ; `a-faire.csv` jusqu'aux colonnes

| Champ du fichier | Ce qu'il devient | État |
| --- | --- | --- |
| (aucune colonne « évènement ») | Par `/import` : 14 lignes rejetées ; par l'onglet Budget : rattachées au mariage ouvert | Dépend de la porte |
| Poste (écrit une fois) | Recopié sur les lignes suivantes (« poste repris de la ligne 4 ») ; rapproché d'un poste existant ou créé en double | Repris ; doublons |
| Détail | « Libellé de la ligne ? (55 %, à confirmer) » ; non visible dans la liste du budget | À choisir ; non vérifié après fusion |
| Prestataire | Nom sous le poste, statut déduit | Repris, statut ajouté |
| Prévu | Prévu ; total 36 450,00 € | Repris, juste |
| Réel | Réel ; total 27 502,00 € | Repris, juste |
| Acompte versé, Date acompte | Échéance « En retard » ; Réglé 0,00 € | Transformé à contresens |
| Solde, Date solde | Reconnus ; non visibles dans la liste | Non vérifié |
| Trois lignes « Traiteur », deux « Fleurs » | Une ligne « Traiteur » (17 100,00 €), une « Fleuriste » (2 720,00 €) | Fusionnées |
| Tâches : « Quoi », « Pour quand » | « À choisir » | Non reconnues |
| Tâches : « Fait ? » (x), « Qui » (moi, mariés) | « Faite », « Responsable » | Reconnues ; résultat non vu |

## 5. Dix principes de Design System

1. **Un import arrive dans l'état du fichier.** Ce qui était payé, signé, fait dans l'ancien outil
   l'est dans Symbola ; un import ne crée ni retard ni relance.
2. **L'écran demande ce qui manque.** Mariage visé, statut d'un paiement, type : une question à
   l'étape de vérification, jamais « corrigez votre tableur ».
3. **Une reprise, une page.** Les fichiers attendus pour un mariage, leur ordre, ce qui est fait,
   ce qui reste ; les autres portes y mènent.
4. **Les mêmes nombres avant et après.** L'écran de confirmation donne un total de contrôle ; le
   bilan redit les mêmes comptes.
5. **Une valeur absente dit pourquoi et quoi faire.** « — » n'est jamais seul après un import ;
   un indicateur de complétude ne compte que le complet.
6. **Une valeur déduite est marquée.** Heure de fin, statut, date d'étape : visible comme
   « déduit » jusqu'à confirmation.
7. **« Vide » n'est pas « à jour ».** Deux textes, deux actions ; jamais « Bon » sur zéro.
8. **Un mot, un geste.** « Reprendre » pour l'arrivée depuis un autre outil ; « continuer » pour le
   reste ; un seul nom pour la page et pour son journal.
9. **L'objet repris garde son origine.** Depuis la fiche : le fichier, la date, le bilan,
   l'annulation.
10. **Le vocabulaire de l'espace l'emporte.** L'import range dans les postes, types et casses de
    Symbola, et liste une fois ce qu'il n'a pas su ranger.
