# Maquettes du volet 2 : la reprise d'un mariage en cours et l'import (lot 68, phase 5)

Date : 25/11/2026, par Claude Code. Deuxième volet de l'ordre validé à la porte 2
([06-decisions-porte-2.md](06-decisions-porte-2.md), § 3), à la suite du volet 1 validé le même jour
([07-maquettes-transverse-taches.md](07-maquettes-transverse-taches.md)). Cette note dit ce qui est
proposé, ce que Julien doit trancher (§ 3), ce que les maquettes supposent de l'app et ce qui a été
vérifié dans son code (§ 4 et 5), où chaque différence de la
[matrice « repris ou créé »](05-matrice-repris-cree.md) est traitée (§ 6), et ce qui ne l'est pas
(§ 7). Aucun écran de l'app n'est modifié ; `DESIGN.md` n'est pas touché.

## 1. Les livrables

Sept pages HTML autonomes dans [`docs/maquette/lot-68/`](../../maquette/lot-68/index.html), au gabarit
du volet 1, ajoutées au sommaire :

| Page | Contenu | Constats |
| --- | --- | --- |
| [6. La page « Reprendre un mariage en cours »](../../maquette/lot-68/06-reprise-page.html) | Les portes (fin de l'assistant de démarrage, « Nouvel évènement ») ; la page vide, en cours, terminée ; l'écran « Importer » des Paramètres | C-51, C-52, C-54, C-59 ; D6, D8, D11, M12 |
| [7. Ce que l'assistant demande](../../maquette/lot-68/07-reprise-questions.html) | Le mariage visé ; le statut d'un paiement ; type, « Où en est-il ? », source ; la liste « à faire » ; la table des règles | C-52, C-53, C-54, C-64 ; P-01 à P-03 |
| [8. Doublons, confirmation, bilan](../../maquette/lot-68/08-reprise-doublons-bilan.html) | Ranger dans les postes de l'espace sans fondre ; le doublon possible ; « Vérifier » ; le bilan ; retirer un import ; la table des nombres | C-57, C-58, C-61, C-66 ; P-07 |
| [9. La fiche d'un mariage repris](../../maquette/lot-68/09-reprise-fiche.html) | « À compléter » ; d'où vient chaque valeur ; budget « à répartir » ; fiche complétée ; liste des évènements ; « Aujourd'hui » au lendemain | C-53, C-55, C-56, C-61, C-64 |
| [10. Les prestataires retenus](../../maquette/lot-68/10-reprise-prestataires.html) | L'arrêt quand le fichier nomme un autre couple ; l'aperçu lisible et les contrats ; le bilan | C-53, C-62, C-66 ; D11 |
| [11. Le programme repris d'un PDF](../../maquette/lot-68/11-reprise-programme.html) | Journées par leur date, aucune heure déduite ; « à compléter » dans l'onglet et avant le partage ; l'annuaire proposé au carnet | C-63 ; D5 |
| [12. Les messages d'erreur de l'import](../../maquette/lot-68/12-reprise-erreurs.html) | Mauvais fichier au mauvais endroit ; erreur de colonne ; lignes à corriger à l'écran ; catalogue ; les mots de l'import | C-60 ; P-18 |

Chaque maquette met l'écran d'aujourd'hui (capture du relevé, ou description tirée des constats et du
code) à côté de l'écran proposé, en 1 440 et en 375 px, avec les états vide, en cours et terminé là
où ils diffèrent ; sous chacune, les constats traités et les règles de forme (D10). Les formes du
volet 1 sont reprises telles quelles : ligne type et ligne allégée d'une tâche, message de retour
sombre (M5), danger à trois niveaux, erreur de saisie, « Où en est-il ? » sans réponse cochée (M12,
M13), barre du bas du téléphone.

Données fictives : l'agence « Atelier Roussel » du volet 1 (Camille, son collègue Bastien), deux
mariages repris. **« Juliette & Romain »** vient d'un tableur : les fichiers de
[`donnees/tableur-planner/`](donnees/tableur-planner/LISEZ-MOI.md) (`prestataires.csv`, `budget.csv`,
`a-faire.csv`). **« Léa & Hugo »** vient d'un logiciel de planning : la fiche, le carnet, les
prestataires retenus et le programme du corpus `packages/testing/import-corpus/`. Le fichier des
prestataires retenus du corpus nomme « Clémence MARTIN, Bastien LEROY » ; le second prénom devient
« Malo » dans les maquettes, pour ne pas confondre avec Bastien, le collègue. Tous les montants sont
recalculés sur ces fichiers (page 8, « Les nombres ») : prévu 36 450,00 €, réel 27 502,00 €, réglé
8 727,00 €, reste 18 775,00 €.

## 2. Ce qui est proposé

- **Une page par mariage repris** (page 6). Six lignes dans l'ordre : carnet (une fois pour
  l'agence), le mariage (fiche PDF, ou nom et date saisis pour un tableur), budget, prestataires
  retenus, liste « à faire », programme. Chaque ligne dit son état en mots et par une forme
  (fait, en cours, à faire, pas de fichier) ; la ligne suivante porte la seule action principale ;
  « Je n'ai pas ce fichier » règle une ligne sans la laisser « à faire ». Un fichier qui en remplit
  deux (un budget qui nomme les prestataires) coche les deux. Un import laissé en plan se retrouve à
  sa ligne avec « Continuer ». La fin de la reprise ne dit jamais « tout est à jour » : elle compte
  ce qui reste et mène à la fiche.
- **Deux portes** : la ligne à part de « Nouvel évènement » (M12, inchangée) et la fin de l'assistant
  de démarrage, dont l'action principale devient « Reprendre un mariage en cours » quand la planner a
  dit suivre ses mariages dans un tableur ou un logiciel (D6). L'écran « Importer » des Paramètres
  reste pour les contacts, le carnet et les listes de l'espace, renvoie la reprise vers sa page et
  montre un import en cours en tête.
- **L'assistant demande au lieu de rejeter** (page 7) : le mariage visé (seulement hors de la page de
  reprise, avec « un mariage pas encore dans Symbola ») ; si les acomptes datés sont payés, avec le
  résultat de chaque réponse en euros ; le type (posé quand l'espace n'en a qu'un) ; « Où en est-il ? »
  avec les mots de « Nouvel évènement », date de signature « non renseignée » ; la source, facultative ;
  pour une liste « à faire », ce qu'il faut faire des échéances passées non faites. À côté, « Ce que
  Symbola a compris » écrit chaque déduction. **Règle de fond : un import ne crée ni retard ni
  relance ; ce qui était payé, signé ou fait le reste ; ce que le fichier ne dit pas est « non
  renseigné ».**
- **Doublons, vérifier, bilan** (page 8) : l'étape range chaque poste du fichier sous un poste de
  l'espace, sans jamais fondre deux lignes ; un poste de départ sans ligne se garde ou se retire ; un
  prestataire qui ressemble à une fiche du carnet est comparé colonne par colonne, avec « Si c'est la
  même ». « Continuer » répond toujours et nomme les choix qui restent. « Vérifier » et le bilan
  donnent les mêmes cinq nombres avec les mêmes mots ; le bilan dit ce qui n'a pas été repris et ce
  que la planner a choisi ; « Retirer cet import… » est un bouton de danger à vue, avec sa date
  limite et une fenêtre de niveau 2 qui dit ce qui part et ce qui reste.
- **La fiche d'un mariage repris** (page 9) : « Repris le 24 nov. de 4 fichiers · Voir la reprise »
  dans l'en-tête ; un bloc « À compléter après la reprise » (montants, contrats non signés, tâches,
  heures du programme, liens des mariés, invités), un bouton par point, à la place de « Prochaine
  action : tout est à jour » et du bandeau « créer les liens » ; la santé ne rend pas d'avis sur zéro
  tâche ; « D'où viennent ces valeurs ? » montre le fichier de chaque valeur ; plus de « Champs
  importés » : le total du fichier va en tête du budget, « à répartir », la note dans « Notes ». Dans
  la liste des évènements, une étiquette « Repris » et un filtre « Origine » ; sur « Aujourd'hui »,
  une ligne par reprise en cours au lieu de douze contrats « à faire signer ».
- **Les prestataires retenus** (page 10) : si le fichier nomme un autre couple, l'assistant s'arrête
  et compare ; l'aperçu prend toute la largeur, le poste proposé s'y lit en entier, trois lignes
  seulement sont « À vérifier » ; la question « Leurs contrats sont-ils signés ? » (tous, aucun,
  ligne par ligne) ; un bilan et un retrait d'ensemble.
- **Le programme repris d'un PDF selon D5** (page 11) : chaque journée par sa date, « la veille »,
  « le jour J », « le lendemain » en petit ; « Fin non renseignée » au lieu d'une heure déduite ;
  « 19 h – 2 h, le lendemain » ; un repère sans durée ; les lieux de la fiche restent des lieux ;
  dans l'onglet, « À compléter : 5 heures de fin », et sur chaque moment « Heure de fin » ou
  « Ponctuel » ; « Partager… » sur un programme incomplet ouvre d'abord une fenêtre qui le dit ; le
  bilan nomme l'annuaire non repris et propose de l'ajouter au carnet.
- **Les erreurs** (page 12) : au modèle de l'erreur de saisie du volet 1, sous ce qui est en cause,
  avec « Erreur : », ce qu'il faut faire et où aller ; un fichier déposé au mauvais endroit est
  reconnu et envoyé à sa ligne ; une erreur de colonne s'affiche à sa ligne sans toucher les autres
  choix ; les lignes en défaut se corrigent à l'écran au lieu d'être renvoyées au tableur. Une table
  des mots de l'import (doublon possible, retirer, continuer, non renseigné, moment) complète le
  lexique.

## 3. Les choix laissés à Julien

Chaque choix a une proposition (celle des maquettes) et l'autre voie. Le marqueur « choix Rn » des
pages renvoie ici.

| # | Question | Proposition (dans les maquettes) | L'autre voie |
| --- | --- | --- | --- |
| R1 | Une page de reprise par mariage, ou une page pour toute l'agence ? | **Par mariage** : six lignes, la ligne du carnet partagée entre tous (déjà faite au deuxième mariage). « Reprendre un autre mariage » repart d'une page neuve | Une page d'agence qui liste tous les mariages à reprendre et leurs fichiers ; plus longue, mais une vue d'ensemble pour qui reprend sept mariages |
| R2 | Le carnet passe-t-il en premier ? | **Oui**, ligne 1 : les prestataires retenus sont alors retrouvés au lieu d'être créés deux fois (l'ordre que l'app impose aujourd'hui sans le dire) | Le mariage d'abord, le carnet en dernier ou hors de la page ; plus naturel, mais des fiches en double à rapprocher ensuite |
| R3 | La fin de l'assistant de démarrage | **« Reprendre un mariage en cours » en bouton plein** quand la réponse « Que voulez-vous remplacer ? » cite un tableur ou un logiciel ; « Créer un nouveau mariage » sinon (D6) | Les deux choix au même rang, quelle que soit la réponse |
| R4 | Le compteur « 3 fichiers sur 6 » compte-t-il une ligne couverte par un import encore en cours ? | **Oui** (la ligne 4, remplie par le budget en cours, est comptée) | Non : elle ne compte qu'une fois le budget importé (plus strict, P-07) |
| R5 | Les questions de l'assistant ont-elles une réponse cochée d'avance ? | **Aucune**, comme « Où en est-il ? » (M13) ; chaque réponse dit son résultat | Cocher la réponse probable (« Acompte versé » lu comme payé) : un geste de moins, au risque d'un clic sans lecture |
| R6 | Le mot pour défaire un import terminé | **« Retirer cet import… »** : « Annuler » seul est réservé aux dix secondes (M6) | Garder « Annuler cet import », le texte actuel |
| R7 | La provenance des valeurs sur la fiche | **À la demande**, par l'interrupteur « D'où viennent ces valeurs ? » | Toujours visible tant que la reprise n'est pas complétée |
| R8 | Qu'est-ce qu'une ligne de budget « complète » ? | **Prestataire retenu et prévu connu** | Prestataire, prévu et contrat signé ; ou garder la règle actuelle (« Retenu » suffit) en changeant seulement le mot |
| R9 | Le bloc « À compléter » une fois tout fait | **Une ligne « Reprise complétée le … », puis disparaît au bout de sept jours** | Reste replié jusqu'au jour J ; ou disparaît tout de suite |
| R10 | Quand le fichier nomme-t-il « un autre couple » ? | **Quand aucun des deux mariés ne concorde, prénom et nom** (accents et casse ignorés) ; « Martin » seul ne suffit pas | Dès qu'un des deux ne concorde pas (plus d'alertes, dont les noms de jeune fille) |
| R11 | Le nom des journées d'un programme repris | **La date** (« Vendredi 11 juin 2027 »), « la veille » en petit : D5 à la lettre | Ce que fait l'app depuis le lot 67d (décision du 24/11, lue dans le code) : « Veille », « Jour J », « Lendemain », une autre date en JJ/MM/AAAA. Les deux décisions se contredisent : **à trancher** |
| R12 | Un moment sans heure de fin | **« Ponctuel »**, notion nouvelle qui le retire du compte des heures manquantes | Exiger une fin partout (une arrivée dure un quart d'heure) ; plus simple à construire, plus de saisie |
| R13 | Partager un programme incomplet | **Permis après une fenêtre** qui liste les heures manquantes ; les destinataires lisent « heure de fin à venir » ; « Compléter d'abord » est l'action principale | Bloqué tant que des heures manquent (lecture stricte de D5) |
| R14 | Où va l'annuaire du programme ? | **Au carnet** : les téléphones complètent les fiches, un absent y est créé (D5 le dit) | Dans les « contacts du jour J » du programme, qui existent dans l'app et restent vides aujourd'hui |
| R15 | « Moment » à la place de « séquence » dans le programme | **« Moment »** (lexique de la page 12) | Garder « séquence », le mot actuel de l'onglet |
| R16 | Les tâches non faites dont l'échéance est passée, dans une liste reprise | **L'assistant demande** : les garder (en retard, comme dans le tableur), les redater, ou les dire faites | Toujours les garder à leur date, sans question (le retard est celui du fichier) |
| R17 | Un poste de départ sans ligne dans le fichier | **Demandé** : le garder « à trouver » ou le retirer de ce mariage | Le garder sans question (comportement actuel), au prix de faux « À trouver » (C-61) |
| R18 | L'écran « Importer » des Paramètres accepte-t-il encore un budget, des tâches ou une fiche ? | **Oui**, en demandant « Pour quel mariage ? » (page 7) | Non : ces fichiers ne passent plus que par la page de reprise ; l'écran ne garde que contacts, carnet et listes de l'espace |

## 4. Ce que les maquettes supposent du comportement de l'app

À spécifier au lot de réalisation, pas à décider ici. Entre parenthèses, l'état actuel lu dans le
code (§ 5).

- **Une « reprise » rattachée à un mariage** qui regroupe ses imports, l'état de chaque ligne (dont
  « pas de fichier ») et l'import en cours (aujourd'hui : un journal d'imports par organisation, sans
  lien entre eux ni avec un mariage, sauf le paramètre `evenement` de l'onglet du budget).
- **La réponse « Que voulez-vous remplacer ? » utilisée** à la fin de l'assistant (elle est enregistrée
  dans `organization_profiles.replaced_tools`, mais ne change rien).
- **Une porte « tâches » depuis la reprise** (l'import « Tâches d'événements » existe dans `/import`,
  sans lien depuis l'évènement ; « Quoi » et « Pour quand » n'y étaient pas reconnus à l'audit).
- **Un acompte payé** : l'import sait poser « payé » seulement quand la colonne « Réglé » tombe sur le
  cumul des échéances ; la question de la page 7 demande une règle de plus. « Réel » vide reste
  « non renseigné » et sort du total réel.
- **Pas de relance née d'un import** : aujourd'hui « Contrat de … à faire signer » est calculé pour
  tout prestataire « Retenu » d'un mariage à venir. Il faut un statut de contrat (signé, non signé,
  non renseigné) et ne plus tirer cette ligne d'« Aujourd'hui » du seul statut « Retenu ».
- **Aucune étape de statut datée du jour de l'import** : la date de l'étape doit pouvoir rester vide
  (aujourd'hui `changed_at = now()`). Même chose pour une tâche importée faite : `done_at` doit pouvoir
  rester vide (aujourd'hui l'heure de l'import).
- **La source facultative** pour une fiche reprise (aujourd'hui exigée par l'import).
- **Le type posé ou demandé** (aujourd'hui jamais posé par l'import d'une fiche).
- **Les totaux d'une fiche** dans le budget, « à répartir », et la note dans « Notes » (aujourd'hui dans
  `imported_fields`, affichés sous « Champs importés » ; l'assistant annonce pourtant « rubrique
  « Notes » »).
- **La casse des noms** remise à celle de l'app (aujourd'hui « MARTIN » reste en capitales).
- **Une provenance par objet** pour « repris le … », l'étiquette de la liste et le filtre « Origine »
  (la table `hub.import_items` sait déjà quel import a écrit quel élément) ; **par valeur** pour
  « D'où viennent ces valeurs ? » (n'existe pas).
- **Le rangement des postes** : « Lieu » sous « Lieu de réception » (la règle du préfixe existe pour
  les prestataires retenus, pas pour un tableur, où la ressemblance est sous le seuil de 60) ; deux
  lignes d'un même poste restent deux lignes (aujourd'hui la seconde écrase la première).
- **Des nombres comptés de la même façon** à « Vérifier » et au bilan (aujourd'hui deux calculs).
- **Un bilan et un retrait d'ensemble** pour les prestataires retenus et le programme (aujourd'hui
  ni journal ni bilan, seulement un audit ; « Ne plus retenir » poste par poste).
- **La comparaison des mariés** du fichier à ceux de la fiche (aujourd'hui seule la date est comparée).
- **« Ponctuel », « à compléter » et l'avertissement de partage** pour le programme ; **l'annuaire**
  gardé pour être proposé au carnet (aujourd'hui il sert au rattachement puis disparaît, téléphones
  compris).
- **La reconnaissance d'un fichier déposé au mauvais endroit** et la correction des lignes à l'écran.
- **La validation par Symbola** des étapes de l'import (P-18), comme au volet 1.

## 5. Ce qui a été vérifié dans le code, et ce qui ne l'a pas été

Lu dans `origin/main` (`e6bf0e87`, lot 67 compris), sans lancer l'app. La branche de ce volet part de
celle du volet 1, qui n'a pas le lot 67 ; les affirmations des maquettes sont alignées sur
`origin/main`.

| Affirmation des maquettes | Vérifié | Où |
| --- | --- | --- |
| `/import` : « Que voulez-vous reprendre ? », trois tuiles « Reprendre mes… » et « Un autre fichier » ; onze sortes de fichiers, dont « Tâches d'événements », aucune « programme » | Oui | `app/import/page.tsx`, `packages/contracts/src/import/fields.ts` |
| Un budget sans colonne évènement, par `/import`, est rejeté ligne par ligne (« Événement introuvable ou ambigu ») ; depuis l'onglet, le mariage est fixé | Oui | `lib/import/matching.ts`, `new-import-form.tsx` |
| « Acompte versé » devient une échéance non payée, donc « En retard » si sa date est passée | Oui | `starter-templates/src/import-synonyms.json`, `modules/budget/import.ts`, `modules/budget/payments.ts` |
| « Contrat de … à faire signer » vient du seul statut « Retenu » | Oui | `modules/events/today-sources.ts` |
| « Fichier de : … » affiché ; seule la date est comparée | Oui | `lib/vendors/event-vendors-import-rules.ts` |
| Fiche PDF : source exigée, type non posé, statut déduit, étape datée du jour de l'import, totaux dans « Champs importés » | Oui | `lib/import/apply.ts`, `import-engine/src/third-party/event-sheet-row.ts`, `modules/events/import.ts` |
| Aucune trace d'origine sur l'évènement ; `hub.import_items` par élément | Oui | `packages/db/src/schema/hub.ts` |
| Plusieurs lignes d'un même poste écrivent sur la même ligne | Oui (lu, non rejoué) | `modules/budget/import.ts` ; l'audit avait vu une somme (17 100,00 €), le code dit « la dernière gagne » : **écart non expliqué** |
| Nombres de la confirmation et du bilan calculés autrement ; retrait 90 jours, éléments retouchés gardés | Oui | `confirmation/page.tsx`, `journal/page.tsx`, `lib/import/apply.ts` |
| Programme : la fin n'est jamais déduite à l'import ; journées « Veille », « Jour J », « Lendemain » depuis le lot 67d ; annuaire non gardé | Oui | `modules/events/program-import-rules.ts`, `program-import.ts` ; les fins déduites vues à l'audit (« 00:30 – 11:00 ») ne s'expliquent pas par le code lu : **à revoir à l'écran** |
| Textes d'erreur cités page 12 | Oui | fichier de traduction français |
| Assistant : réponse enregistrée sans effet ; « Votre espace est prêt » sans sortie vers l'import | Oui | `starter-templates/src/index.ts`, `app/demarrage/pret/page.tsx` |
| « Partir du rétroplanning » daté depuis le jour J, sans traiter le passé ; « Bon » sur zéro tâche ; « pourvue » = « Retenu » | Oui | `app/events/new/new-event-mode.ts`, `planning-rules.ts`, `modules/events/service.ts` |
| Une tâche importée faite reçoit l'heure de l'import ; pas de « fait par » dans la table | Oui | `modules/events/import.ts`, schéma `events.ts` |

**Non vérifié** : rien n'a été vu dans l'app en marche (les textes sont ceux des fichiers de
traduction) ; le score de ressemblance « Lieu » / « Lieu de réception » est calculé à la main ;
l'écran d'aperçu des prestataires retenus n'a été lu qu'en partie ; les limites réelles de taille et
de pages (10 Mo, une page pour une fiche, page 12) sont des exemples ; les « 30 minutes par
mariage » sont la cible de l'audit, pas une mesure.

## 6. La matrice « repris ou créé », ligne par ligne

Chaque différence du § 1 de [05-matrice-repris-cree.md](05-matrice-repris-cree.md), et où la
maquette la traite.

| Écran · élément | Différence | Traité où |
| --- | --- | --- |
| Liste · ligne | Rien ne distingue le repris | Page 9, « Liste des évènements » : étiquette « Repris », filtre « Origine » |
| Fiche · type | « Type à préciser » | Page 7, « La fiche d'un logiciel » : posé ou demandé |
| Fiche · source | Exigée sans le dire, « Outil actuel » | Page 7 : facultative, « non renseignée » ; page 9, « Informations » |
| Fiche · « Voir comme … » | Absent (aucun lien) | Page 9 : « Créer les liens » devient un point d'« À compléter » ; le bouton est dans l'en-tête |
| Frise · dates | « Confirmé » daté du jour de l'import | Page 7 : « Où en est-il ? », « Signé le : non renseigné » ; page 9 |
| Bandeau « Prochaine étape » | Premier pas d'un mariage neuf | Page 9 : remplacé par « À compléter après la reprise » |
| Onglets · pastille du budget | « 11/11 » lu « complet » | Page 9, « Budget » : « 0 sur 12 » lignes complètes (choix R8) |
| Synthèse · prochaine action | « Tout est à jour », puis douze « à faire signer » | Page 9 : « À compléter » ; page 10 : contrats demandés, aucune relance |
| Synthèse · santé du planning | « Bon » sur zéro tâche | Page 9 : « Pas encore de tâches : pas d'avis » |
| Synthèse · santé du budget | « 0,00 € engagés » contre 21 650,50 € | Page 9 : « 21 650,50 € engagés selon votre fichier » ; « à répartir » |
| Synthèse · 14 prochains jours | « Rien d'ici quatorze jours » sans raison | Non dessiné : le bloc relève du volet « Évènements » ; la raison (pas de tâches) est dans « À compléter » |
| Synthèse · interlocuteurs | « Léa MARTIN », « POITIERS » | Pages 7 et 9 : casse de l'app, montrée avant, « Garder les capitales » |
| Synthèse · notes | « — » alors que « Notes » était annoncé | Pages 7 et 9 : la note va dans « Notes » |
| Synthèse · « Champs importés » | Hors calcul, sans espace des milliers | Pages 7 et 9 : supprimé, chaque valeur à sa place |
| Synthèse · temps forts | Trois « Jour J » | Pages 9 et 11 : noms des moments, journées par leur date (choix R11) |
| Synthèse · invités, style, équipe | « — » sans le dire | Page 9 : « non renseigné », invités dans « À compléter » |
| Budget · noms des lignes | Mots de l'ancien outil, postes en double | Page 8 : rangement dans les postes de l'espace ; page 10 : poste proposé lisible |
| Budget · montants | PDF : « — » partout ; tableur : « Réglé 0,00 € » | Page 9 : « non renseigné » et total « à répartir » ; page 7 : acomptes payés |
| Budget · statuts | « Retenu » seul, « Pressenti » déduit | Page 10 : contrat demandé ; page 7 : « Ce que Symbola a compris » écrit chaque déduction |
| Budget · échéances | Acomptes versés « En retard » | Page 7 : question du paiement ; page 8 : « aucune échéance en retard » |
| Budget · lignes fondues | Trois « Traiteur » en une | Page 8 : chaque ligne reste une ligne |
| Budget · poste de chaque prestataire | Illisible, vu après validation | Page 10 : poste en entier, « À vérifier » sur trois lignes |
| Rétroplanning · tâches | Vide sans raison, ou modèle mis en retard ; pas de porte | Page 6 : ligne « Liste « à faire » » ; page 7 : import de la liste ; page 9 : « Les tâches » dans « À compléter » ; volet 1, page 2 : « Reprendre une liste » |
| Programme · titres des journées | « Jour J » ×3, tableau sans titre | Page 11 : date, lieux gardés comme lieux |
| Programme · « Lieu » et « Qui » | Vides ou faux (« Mariée - Clémence ») | Page 11 : poste et personne ; page 10 : contrôle du couple |
| Programme · heures de fin | Déduites | Page 11 : « Fin non renseignée », « à compléter », « Ponctuel » |
| Programme · contacts du jour J | Annuaire perdu | Page 11 : dit au bilan, proposé au carnet (choix R14) |
| Mariés · liens personnels | « Aucun lien », normal | Page 9 : point d'« À compléter » |
| Aujourd'hui · sous-titre et premier bloc | Douze fausses urgences | Page 9, « Aujourd'hui » : « Reprises en cours », aucune relance d'import |
| Tâches · liste | Mariage repris absent | Volet 1, page 2 : « À vérifier : … n'a pas encore de tâches » ; page 7 : la liste reprise dans « Tâches » |
| Menu · pastille « Tâches » | « 10 en retard » si le modèle est appliqué | Page 6 : aucun modèle appliqué à un mariage repris ; page 7 : seul un retard du fichier, gardé par la planner, compte |
| Carnet · fiches | « 16 placés » sur 25, noms sans fiche après un budget | Page 8 : les prestataires d'un budget retrouvés ou créés ; « 3 à classer » au bilan (page 6). Le reste relève du volet « Prestataires » |
| Contacts · fiches | Doublons par nom | Hors périmètre (C-65, D11) |

Du § 3 de la matrice : les portes (page 6), l'ordre imposé sans être dit (page 6, choix R2), ce qu'il
faut créer ou choisir à la main (pages 6, 7, 8, 10), se tromper et revenir en arrière (« Abandonner
cet import… » en bouton, page 7 ; « Retirer cet import… », page 8 ; retrait d'ensemble des
prestataires retenus, page 10 ; mauvais fichier, page 12).

## 7. Constats non traités, et pourquoi

| Constat | Pourquoi | Où il sera traité |
| --- | --- | --- |
| C-65 (contacts repris) | Hors périmètre (D11) | Quand « Contacts » sera refait |
| C-67 (premier mariage en retard) | En partie : un mariage repris n'applique aucun modèle (page 6) ; la règle d'un modèle sur un mariage commencé reste à écrire | Volet « Premiers pas » |
| C-68, C-70 (assistant, tutoriels) | Seule la dernière page de l'assistant est dessinée ; le parcours des tutoriels (D6) relève de l'aide | Volet « Premiers pas et aide » |
| C-22, C-23, C-24, C-80 (en-tête et onglets de la fiche) | Esquissés seulement ; ici, ce qui change pour un mariage repris | Volet « Évènements » |
| C-41, C-44, C-47 (carnet) | Un carnet repris arrive avec des fiches « à classer » (question gardée de D9) ; le rangement des métiers relève du carnet | Volet « Prestataires » |
| C-49, C-78 (budget, téléphone) | Le tableau du budget n'est montré que pour ce qui change après une reprise | Volet « Prestataires » |
| C-15, C-20 (accueil) | Seule la ligne « Reprises en cours » est dessinée | Volet « Aujourd'hui » |

## 8. Limites

- Maquettes statiques ; **aucun rejeu par le panel** (non demandé). Comme au volet 1, rien ne dit
  qu'un profil trouve « Reprendre ses fichiers » (M12 non essayée) ni que la reprise tient en trente
  minutes.
- Vérifié dans le navigateur, aux deux tailles : chaque cadre « Proposé » regardé en taille réelle ;
  par script, aucun débordement de côté, aucune commande de moins de 44 px dans les cadres de 375 px,
  aucun libellé de bouton coupé ou sur deux lignes, toutes les captures chargées. Corrigé après ce
  contrôle : un « ? » seul sur sa ligne (espace insécable devant « ? », « : », « ; », « ! » dans les
  pages du volet 2), une liste vide sur l'accueil au téléphone, des compteurs collés aux noms
  d'onglets.
- Les pages du volet 1 sont reconstruites à l'identique (octet pour octet) ; seul le sommaire change.
- Couleurs : jetons actuels de `DESIGN.md`, répartition A en rôles. « À vérifier » et « Erreur » gardent
  leurs fonds d'alerte (règle du lot 62) ; « À compléter » prend celui d'« À vérifier ». Aucune teinte
  verte de réussite : une reprise terminée se dit en mots.
- Plusieurs écrans « avant » n'ont pas de capture au relevé (vide de la page, onglet du programme,
  liste à faire, erreurs de colonne) : ils sont décrits à partir des journaux PC-02 et PC-09, de la
  matrice et du code.

## 9. La porte 3 de ce volet

Julien tranche R1 à R18 (§ 3), R11 en premier : D5 et la décision du lot 67d se contredisent sur le
nom des journées. Ce volet validé, ses formes (page de reprise, question avec résultat chiffré,
bilan aux mêmes nombres, « non renseigné », provenance) rejoignent le Design System (phase 6).
