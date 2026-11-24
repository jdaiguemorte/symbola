# Lot 68 — Audit UX des parcours : Aujourd'hui, Évènements, Tâches, Prestataires, Paramètres

**Statut** : plan validé par Julien le 24/11/2026 (« Valider le plan ») ; **cadrage validé par
Julien le 24/11/2026** (« Valider le cadrage », porte 1) : panel, parcours, protocole, seuils de la
grille, et A1 à A6 retenues dans leur option recommandée. Aucun écran de l'app n'est modifié par ce
lot ; aucun schéma, contrat, dépendance ni serveur réel. Le seul code touché est l'outil de relevé,
hors suite de tests.

Ce lot produit un audit, des maquettes, puis un Design System. Le code des écrans viendra dans des
lots de réalisation, découpés à la fin (phase 7).

## Contexte et but

Le lot 62 a corrigé des familles de défauts mesurables (formulaires empilés, plusieurs boutons
principaux, débordements). Les recettes des 21, 22 et 24/11 montrent que cela ne suffit pas : un
écran peut passer toutes les mesures et rester difficile à lire. Julien demande un audit par des
spécialistes, confronté à des utilisatrices, sur les modules les plus utilisés, où « chaque détail
compte » : un libellé qui tombe sur deux lignes, un bouton dont on ne sait pas s'il en est un, six
espaces d'action dans la même zone visuelle.

Trois buts :

1. Rendre les quatre modules et les Paramètres clairs au premier regard, pour une planner à l'aise
   comme pour une planner qui ne l'est pas.
2. Rendre la **reprise d'un mariage en cours** aussi fluide qu'un mariage créé dans Symbola :
   Symbola ne sera pas forcément le premier outil de la planner.
3. Tirer de ces écrans les **règles du Design System** qui serviront à la refonte des autres.

Exigences du cahier des charges servies : UX-01 (que dois-je faire maintenant), UX-02 (zéro
ressaisie), UX-03 (trois gestes), UX-04 (de la valeur en dix minutes), UX-06 (statut, suite,
blocage), UX-07 (annuler), UX-08 (l'écran vide enseigne), UX-10 (les mots du métier), UX-12
(simple d'abord), UX-13 (un seul patron), UX-14 (accessible), HUB-11 (aide et visites), HUB-14
(import), NFR-19 (de 360 à 1 920 px).

## Périmètre

| Zone | Écrans | Profondeur |
| --- | --- | --- |
| Aujourd'hui | `/` (liste du jour, calendrier, radar, liste de démarrage, rappels) | Complète |
| Évènements | `/events` (liste et calendrier), `/events/new`, fiche `/events/[id]` : en-tête, frise de statut, bandeau de prochaine étape, barre d'onglets, onglets Synthèse, Rétroplanning, Budget et prestataires (partie prestataires), Programme | Complète |
| Tâches | `/taches` (tableau, calendrier, tâche en panneau, tâches hors évènement), tâches de la fiche | Complète |
| Prestataires | `/prestataires` (liste, carte), `/prestataires/nouveau`, fiche `/prestataires/[id]`, prestataires d'un évènement | Complète |
| Paramètres | Les cinq groupes du menu (`app/settings-menu.ts`), une cinquantaine de rubriques | Trouvabilité de tout le menu ; chaque écran passé à la grille |
| Premiers pas et aide | `/demarrage` et ses deux suites, visites guidées, aide d'écran (« ? »), `/aide`, `/tutoriels` | Complète |
| Reprise | `/import` et ses étapes (types, colonnes, lignes, rapprochements, écarts, confirmation, journal), reprise d'un PDF de prestataires retenus | Complète |
| Transverse | Menu latéral, barre du haut, recherche et palette, création rapide, cloche, bandeau d'annulation | Complète |

Les autres onglets de la fiche (Devis, Mariés, Documents, Invités) et les autres modules (budget,
devis, invités, rendez-vous, portail, Jour J, plans de salle, pipeline) ne sont regardés qu'à leurs
**points d'entrée** depuis les zones ci-dessus : le lien y mène-t-il clairement, en revient-on.

Tailles : 1 440 px, 375 px, et 1 366 px avec un zoom de 150 % (profil SU-04).

## Les six spécialistes

Chaque spécialiste est un agent qui reçoit un angle, la grille de détail et l'accès à l'app. Il
pose des **hypothèses numérotées** ; il ne propose pas encore de solution.

| Code | Angle | Ce qu'il regarde |
| --- | --- | --- |
| IA | Architecture de l'information et navigation | Où sont les choses, ce que promet chaque entrée de menu, les chemins entre liste, fiche et panneau, les 50 rubriques de Paramètres |
| IX | Interaction et formulaires | Appel à l'action de chaque écran, nombre de zones d'action, états (vide, erreur, retour après action), annulation, saisie |
| VI | Hiérarchie visuelle et typographie | Retours à la ligne, troncatures, alignements, densité, poids relatif des éléments, affordance des boutons et des liens |
| TX | Textes, aide et premiers pas | Mots du métier, cohérence des verbes, messages d'erreur, écrans vides, visites, aide d'écran |
| MI | Reprise et migration | Import, différences entre mariage repris et mariage créé, ce qui manque après la reprise et comment l'écran le dit |
| MA | Mobile et accessibilité | 375 px, zone du pouce, cibles, zoom 150 %, clavier, lecteur d'écran sur les écrans du périmètre |

Une hypothèse s'écrit ainsi : identifiant (`H-VI-07`), écran et taille, constat en une phrase,
preuve (capture ou mesure), gravité présumée, principe candidat pour le Design System.

## Le panel : huit utilisatrices synthétiques

Quatre profils viennent du cahier des charges (§ 16), sans changement. Quatre profils sont propres
à ce lot ; ils restent dans ce document et ne modifient pas le cahier des charges. La moitié du
panel est à l'aise avec les outils, l'autre non.

| ID | Profil | Appareil | Aisance | Vient de |
| --- | --- | --- | --- | --- |
| SU-01 | Camille Roussel, planner indépendante | iPhone et portable 13 pouces | Moyenne | Tableur et traitement de texte |
| SU-02 | Nadia Belkacem, dirigeante d'agence | Grand écran et tablette | Élevée | Outils épars, sans droits |
| SU-03 | Hugo Lemaire, chef de projet junior | Téléphone Android | Élevée | — (rejoint un espace existant) |
| SU-04 | Sophie Garnier, planner expérimentée | Portable 15 pouces, zoom 150 % | Faible | Classeurs, tableur, agenda papier |
| L68-SU-A | Inès Carpentier, planner haut de gamme | Portable 14 pouces et iPhone | Très élevée | Un logiciel spécialisé pour wedding planners |
| L68-SU-B | Martine Vasseur, planner en pleine saison | Portable 15 pouces à 1 366 px, Android | Faible | Tableur, dossiers partagés, messagerie instantanée |
| L68-SU-C | Valérie Monnier, gérante d'agence évènementielle | Écran 27 pouces | Très élevée | Un outil généraliste de gestion de projet |
| L68-SU-D | Clémence Aubry, planner en reconversion | iPhone, presque jamais d'ordinateur | Faible avec les outils professionnels | Aucun outil : Symbola est le premier |

### L68-SU-A · Inès Carpentier, planner haut de gamme venue d'un logiciel spécialisé

38 ans, Paris. Dix-huit mariages par an, dont des mariages à l'étranger. Une assistante en renfort.

- Contexte : trois ans sur un logiciel de wedding planning qu'elle quitte. Sept mariages en cours
  à reprendre. Elle a ses exports : des PDF et des tableurs produits par l'ancien outil.
- Objectifs : ne rien perdre des liens entre un mariage, ses prestataires retenus et ses tâches ;
  retrouver ses habitudes en une soirée ; gagner du temps par rapport à l'ancien outil.
- Frustrations : refaire à la main ce qu'un import aurait dû faire ; un outil neuf moins rapide
  que l'ancien sur ses gestes quotidiens.
- Comportement à simuler : compare chaque écran à ce qu'elle connaît et le dit. Compte les clics.
  Remarque le moindre défaut d'alignement ou de libellé. Cherche d'abord les filtres et le tri.
- Limite de patience : un geste de plus que dans son ancien outil est un défaut ; deux, un motif
  de départ.
- Abandonne si : un prestataire repris n'est pas rattaché à son mariage, un statut repris est
  faux, ou elle doit retoucher chaque ligne après l'import.
- Données de test : un mariage en cours repris depuis les fichiers d'export fictifs (voir
  « Données de test »).
- Phrase type : « Dans mon ancien outil, c'était un clic. »

### L68-SU-B · Martine Vasseur, planner au tableur, en pleine saison

47 ans, Nantes. Dix mariages par an, six en cours au moment où elle change d'outil, en juin.

- Contexte : un classeur par mariage, avec ses onglets à elle (budget, prestataires, à faire), des
  cellules fusionnées, un poste de budget écrit une seule fois pour plusieurs lignes. Des dossiers
  partagés pour les contrats. Les couples lui écrivent par messagerie instantanée.
- Objectifs : reprendre un mariage en une demi-heure sans rien casser ; reconnaître ses colonnes ;
  savoir tout de suite ce qui reste à compléter.
- Frustrations : ne pas savoir si l'import a tout pris ; un écran qui affiche des cases vides sans
  dire pourquoi ; devoir choisir entre des options qu'elle ne comprend pas.
- Comportement à simuler : suit l'ordre de l'écran, de haut en bas. Lit les titres et les
  boutons, saute les paragraphes. Revient au tableur pour vérifier un chiffre. N'ouvre l'aide que
  si un bouton le lui propose à l'endroit où elle bloque.
- Limite de patience : trente minutes par mariage repris ; un écran où elle ne sait pas quoi
  faire en dix secondes.
- Abandonne si : un total de budget diffère de son tableur sans explication, ou si elle ne peut
  pas annuler un import.
- Données de test : classeur fictif d'un mariage en cours, à la forme de son tableur.
- Phrase type : « Je n'ai pas le temps d'apprendre, j'ai un mariage samedi. »

### L68-SU-C · Valérie Monnier, gérante d'agence évènementielle

41 ans, Lille. Agence de cinq personnes, trente évènements par an : mariages et évènements
d'entreprise.

- Contexte : son équipe travaille depuis deux ans dans un outil généraliste de gestion de projet,
  avec des tableaux, des vues enregistrées et des automatismes. Elle en connaît toutes les ficelles.
- Objectifs : voir la charge de chacun et les retards sur tous les évènements ; déléguer et
  suivre ; ne pas perdre les vues que son équipe utilise chaque matin.
- Frustrations : une liste qu'on ne peut ni filtrer, ni trier, ni grouper ; des actions une par
  une quand il en faut vingt ; des réglages éparpillés.
- Comportement à simuler : clavier d'abord. Filtre, trie et groupe avant de lire. Sélectionne
  plusieurs lignes et cherche l'action groupée. Ouvre les Paramètres dès le premier jour pour
  adapter l'outil. Juge sévèrement toute incohérence entre deux écrans.
- Limite de patience : deux secondes par écran ; un réglage introuvable en trois essais.
- Abandonne si : elle ne voit pas les tâches de toute l'équipe sur un seul écran, ou si deux
  écrans font la même chose de deux façons.
- Données de test : l'organisation d'agence du jeu fictif (plusieurs membres, nombreux évènements).
- Phrase type : « Montrez-moi tout ce qui est en retard, par personne. »

### L68-SU-D · Clémence Aubry, planner en reconversion, première saison

29 ans, Toulouse. Ancienne infirmière. Trois mariages signés pour sa première saison.

- Contexte : Symbola est son premier outil professionnel. Elle travaille le soir sur son
  téléphone, rarement sur un ordinateur. Elle ne maîtrise pas encore tout le vocabulaire du métier.
- Objectifs : être guidée ; ne rien oublier d'important ; avoir l'air sûre d'elle devant ses
  premiers couples.
- Frustrations : un écran vide qui ne dit pas par où commencer ; des mots qu'elle n'ose pas
  demander ; une aide qui renvoie à une longue page.
- Comportement à simuler : suit volontiers une visite guidée jusqu'au bout. Touche ce qui
  ressemble à un bouton. Ne devine pas qu'un élément sans forme de bouton se touche. Fait défiler
  avant de lire.
- Limite de patience : deux écrans sans comprendre ce qu'on attend d'elle.
- Abandonne si : le premier écran lui demande une décision qu'elle ne sait pas prendre, ou si
  l'aide ne répond pas à la question de l'écran où elle est.
- Données de test : un espace neuf, vide.
- Phrase type : « Je commence par quoi ? »

## Les parcours

Les notes et les six questions par étape sont celles du cahier des charges (§ 17). Trois questions
s'y ajoutent pour ce lot (voir « Protocole »). Chaque parcours se joue aux tailles du profil.

| ID | Parcours | Profils | Départ |
| --- | --- | --- | --- |
| L68-PC-01 | Premier quart d'heure et premiers pas sur chaque écran (reprend SC-01) | SU-01, L68-SU-D | Espace neuf, vide |
| L68-PC-02 | Reprise d'un mariage en cours depuis un autre outil (reprend SC-10 pour SU-04) | L68-SU-B, L68-SU-A, SU-04 | Espace neuf, fichiers d'export fictifs |
| L68-PC-03 | Lundi matin (reprend SC-03) | SU-01, SU-02, SU-03 | Évènements en cours, tâches dues, alertes |
| L68-PC-04 | Un mariage de A à Z | SU-01, L68-SU-A | Une demande reçue |
| L68-PC-05 | Prestataires | L68-SU-A, L68-SU-C, L68-SU-B | Carnet rempli, un mariage avec des postes à pourvoir |
| L68-PC-06 | Tâches | L68-SU-C, SU-03, SU-01 | Plusieurs évènements, tâches en retard |
| L68-PC-07 | Paramètres | SU-04, SU-02, L68-SU-D, L68-SU-C | Espace en service |
| L68-PC-08 | Bloquée sur un écran | SU-04, L68-SU-D | Au milieu d'une saisie |
| L68-PC-09 | Parité entre mariage repris et mariage créé | L68-SU-B, L68-SU-A | Deux mariages jumeaux |

Soit 24 passages (un profil sur un parcours).

**L68-PC-01.** S'inscrire et répondre aux questions de démarrage ; lire « Votre espace est prêt » ;
arriver sur Aujourd'hui vide ; créer le premier mariage ; ouvrir tour à tour Évènements, Tâches et
Prestataires vides et dire, pour chacun, ce que l'écran attend d'elle ; suivre une visite guidée ;
fermer et retrouver son travail. Mesures : moins de dix minutes ; sur chaque écran vide, l'action
à faire est nommée en moins de dix secondes.

**L68-PC-02.** Trouver par où reprendre un mariage en cours ; importer contacts, budget, tâches et
prestataires retenus ; se tromper une fois et annuler ; ouvrir la fiche du mariage repris et dire
ce qui est complet, ce qui manque et par quoi continuer ; comparer un total à son tableur.
Mesures : trente minutes au plus ; aucun total différent sans explication ; l'utilisatrice cite
sans aide les trois choses qui restent à compléter.

**L68-PC-03.** Ouvrir Aujourd'hui ; repérer les trois urgences sans défiler ; cocher une tâche par
erreur et l'annuler ; ouvrir un mariage depuis une alerte ; relancer un prestataire sans contrat ;
ajouter une tâche par la création rapide. Pour SU-02 : dire qui est en retard dans l'équipe.
Mesures : trente secondes pour savoir par quoi commencer ; chaque action en deux gestes.

**L68-PC-04.** Créer le mariage à partir d'une demande ; lire le rétroplanning généré et l'ajuster ;
noter un prestataire à trouver, en comparer trois, en retenir un ; suivre la fiche à J-90, J-30 et
J-7 (horloge simulée) et dire, à chaque date, ce que la fiche demande de faire ; atteindre le
programme, puis l'entrée du Jour J et de la clôture. Mesures : à chaque date, la prochaine action
est nommée en moins de dix secondes ; aucune information saisie deux fois.

**L68-PC-05.** Chercher un fleuriste libre à une date ; filtrer par type et par étiquette ;
ouvrir une fiche et y lire tarif, évaluation et pièces ; rattacher le prestataire à un mariage
depuis le carnet, puis un autre depuis la fiche du mariage ; repérer une pièce expirée ; créer un
prestataire qui manque sans quitter le mariage. Mesures : un prestataire trouvé et rattaché en
moins d'une minute ; le même geste se fait de la même façon des deux côtés.

**L68-PC-06.** Voir ce qui est dû cette semaine, tous évènements confondus ; filtrer par
évènement, par responsable, par catégorie ; déléguer une tâche ; en décaler plusieurs ; passer au
calendrier et en revenir ; créer une tâche sans évènement ; retrouver la même tâche dans la fiche
du mariage. Mesures : la liste d'une personne en deux gestes ; une tâche a la même forme et les
mêmes commandes dans `/taches` et dans la fiche.

**L68-PC-07.** Quinze tâches de trouvabilité, sans la recherche des Paramètres puis avec : changer
les coordonnées de l'entreprise ; ajouter une catégorie de tâche ; modifier le modèle de
rétroplanning ; ajouter un type de prestataire ; créer une étiquette de prestataire ; régler le
délai d'alerte des pièces ; inviter une collaboratrice ; couper une notification ; changer le mot
« mariés » ; lancer un import ; retrouver une tâche supprimée ; modifier un message type ; régler
une relance (deux rubriques portent ce mot) ; changer les postes de budget proposés par défaut ;
exporter toutes ses données. Mesures : rubrique trouvée au premier essai dans 12 cas sur 15 ;
aucune introuvable en trois essais.

**L68-PC-08.** Au milieu d'un formulaire, ne plus savoir quoi mettre dans un champ ; ouvrir l'aide
de l'écran ; revoir la visite ; chercher dans le centre d'aide ; revenir au formulaire. Mesures :
l'aide s'ouvre en un geste ; elle répond à la question de l'écran ; la saisie en cours est intacte.

**L68-PC-09.** Ouvrir côte à côte le mariage créé dans Symbola et son jumeau repris ; passer les
mêmes écrans ; dire ce qui diffère et si c'est gênant. Le spécialiste MI tient la matrice (voir
plus bas).

## Données de test

- Local seulement : socle Docker, jeu fictif (`seed:recette`), e-mails dans Mailpit. Aucun serveur
  réel. L'app est celle de `main` **avec le lot 67** (PR #180), qui modifie l'import.
- **Mariages jumeaux** : le mariage de référence du jeu fictif (créé dans Symbola) et le même
  mariage repris par import dans un autre espace.
- **Fichiers d'export fictifs**, écrits pour ce lot dans `docs/audits/2026-11-ux-parcours/donnees/`
  et chargés par l'écran d'import lui-même : un classeur de planner (budget où le poste n'est écrit
  qu'une fois, prestataires, liste de tâches aux colonnes personnelles), un PDF de prestataires
  retenus à la forme de celui reçu en recette le 24/11, le fichier de 600 contacts existant. Toutes
  les données sont inventées (ARC-13) ; aucun fichier réel n'entre dans le dépôt.
- Un espace neuf et vide pour L68-PC-01 ; l'organisation d'agence du jeu fictif pour SU-02, SU-03
  et L68-SU-C. Si le jeu fictif ne charge pas assez d'évènements pour l'agence, le relevé le dira
  avant la phase 3.

## Protocole

### Phase 1 — Relevé

L'outil du lot 62 (`apps/symbola/e2e/zz-releve-ergonomie.spec.ts`, hors suite) est complété pour
les mesures de la grille et rejoué sur le périmètre, aux trois tailles. Chaque écran est capturé
dans ses états : vide, rempli, repris par import, en erreur, panneau ouvert. Livrable : une planche
par écran et un tableau de mesures.

### Phase 2 — Audit des spécialistes

Les six spécialistes travaillent en parallèle, sans se lire. Chacun parcourt l'app réelle et les
planches, et pose ses hypothèses. Ils ne lisent pas les journaux du panel avant d'avoir fini.

### Phase 3 — Tests du panel

Un agent par passage. Il ne reçoit que la fiche du profil, le départ du parcours et un navigateur :
ni le code, ni la documentation, ni les hypothèses des spécialistes. Il adopte l'appareil, la
taille d'écran, la patience et le vocabulaire du profil (§ 16 du cahier des charges). Il tient un
journal à voix haute : ce que je cherche, ce que je vois, ce que je comprends, ce que je fais.
Quand la limite de patience est dépassée, il s'arrête : un abandon est un résultat.

Chaque étape reçoit une note de 0 à 3 et répond aux six questions du cahier des charges, plus
trois :

7. A-t-elle su dire quelle est l'action principale de l'écran ?
8. A-t-elle hésité entre deux commandes qui semblaient faire la même chose ?
9. A-t-elle pris pour un bouton ce qui n'en était pas, ou manqué un bouton qui n'en avait pas l'air ?

### Phase 4 — Confrontation et synthèse

| Verdict | Règle |
| --- | --- |
| Confirmée | Observée chez deux profils au moins, ou cause d'un abandon (note 0), ou établie par une mesure de l'outil |
| Infirmée | Aucun profil ne bute, aucune mesure ne l'établit |
| À trancher | Un seul profil, ou spécialistes et panel en désaccord : la question va à Julien, et à la planner pilote s'il le souhaite |

Les frictions que le panel rencontre sans qu'un spécialiste les ait prévues deviennent des
constats au même titre. Chaque constat confirmé reçoit une gravité (bloque, freine, gêne, détail)
et un principe candidat pour le Design System.

### Limite de la méthode

Les utilisatrices synthétiques et les spécialistes sont des agents du même modèle : leurs
jugements ne sont pas indépendants comme ceux de huit personnes. La méthode repère bien les
incohérences, les libellés obscurs, les chemins longs et les écarts mesurables. Elle ne prouve pas
ce que fera une vraie planner, ni ce qu'elle préférera. Les mesures de l'outil et l'avis de la
planner pilote servent de contrepoids.

## Grille des détails

Chaque écran passe cette grille. Seuils fixés à la porte 1 (24/11/2026).

| Critère | Ce qu'on mesure | Seuil proposé |
| --- | --- | --- |
| Action principale | Boutons principaux visibles, hors panneau ouvert | Un seul |
| Zones d'action | Groupes distincts de commandes dans la première hauteur d'écran (barre d'outils, filtres, onglets, actions de ligne, bandeau…) | Trois au plus en 1 440 px, deux en 375 px |
| Une ligne | Libellés de bouton, d'onglet, de menu, d'en-tête de colonne, de pastille et de champ qui passent à la ligne | Aucun en 1 440 px ; en 375 px, seuls les titres prévus pour deux lignes |
| Troncature | Textes coupés | Aucun sans moyen de lire le texte entier |
| Affordance | Éléments cliquables sans signe visible ; éléments non cliquables qui ressemblent à un bouton | Aucun |
| Un verbe par geste | Verbes employés pour créer, modifier, supprimer, annuler, fermer | Le même partout |
| Mêmes emplacements | Place de « Créer », de « Modifier », des filtres, des actions de ligne | Celle du relevé du 17/11 (UX-13) |
| Écran vide | Action principale, exemple, aide de trente secondes (UX-08) | Les trois |
| Retour après action | Confirmation visible, annulation pendant dix secondes (UX-07) | Toujours |
| Statut, suite, blocage | Tout objet montre son statut et l'étape suivante (UX-06) | Toujours |
| Donnée reprise | Une valeur absente après un import dit pourquoi et quoi faire | Toujours |
| Téléphone | Débordement horizontal ; cibles tactiles ; action principale dans la zone du pouce | Aucun ; 44 px ; oui |
| Zoom 150 % | Fonctions perdues ou recouvertes | Aucune |
| Aide | Gestes pour ouvrir l'aide de l'écran ; saisie conservée | Un ; oui |
| Accessibilité | axe-core, parcours au clavier | Aucune violation ; tout atteignable |

## Matrice « repris ou créé »

Une ligne par différence visible entre les deux jumeaux : écran, élément, ce que montre le mariage
créé, ce que montre le mariage repris, effet sur l'utilisatrice, proposition. Les retours du lot 67
en sont les premières lignes : poste de budget à reporter, prestataires repris sans rattachement,
prestataires retenus venus d'un PDF, clients reconnus par leur rôle. S'y ajoutent, à vérifier :
tâches sans date ou sans catégorie, rétroplanning non généré, statuts absents, frise de statut,
bandeau de prochaine étape, marque d'une valeur reprise (`imported-fields.tsx`), tri et filtres
sur des valeurs vides, « Aujourd'hui » au lendemain d'une reprise.

## Livrables

| Phase | Livrable | Emplacement |
| --- | --- | --- |
| 0 | Ce cadrage | `docs/lots/lot-68-audit-ux-parcours.md` |
| 1 | Relevé : planches et mesures | `docs/audits/2026-11-ux-parcours/01-releve.md` ; captures hors dépôt, sauf les preuves citées |
| 2 | Hypothèses des spécialistes | `docs/audits/2026-11-ux-parcours/02-hypotheses.md` |
| 3 | Journaux du panel | `docs/audits/2026-11-ux-parcours/03-panel/` ; les trois scénarios du cahier des charges rejoués vont aussi dans `docs/recette/` (C4) |
| 4 | Synthèse, constats classés, matrice | `docs/audits/2026-11-ux-parcours/04-synthese.md`, `05-matrice-repris-cree.md` |
| 5 | Maquettes : « aujourd'hui » et « proposé » côte à côte, 1 440 et 375 px, états vide, rempli, repris | `docs/maquette/lot-68/`, et une page privée pour la relecture |
| 6 | Design System : règles, composants, motifs, liste de contrôle des autres écrans | `DESIGN.md`, page de référence, ADR |
| 7 | Plan des lots de réalisation | `docs/lots/` |

Les maquettes emploient les jetons actuels de `DESIGN.md` (ADR 0057). Aucune règle n'est écrite
dans `DESIGN.md` avant la porte 3 : le Design System se construit sur les maquettes validées.

Ordre des maquettes : Aujourd'hui, Évènements, Tâches, Prestataires, reprise et import, premiers
pas et aide, Paramètres. Chaque maquette est rejouée par les profils concernés avant d'être
présentée.

## Portes de validation

| Porte | Julien valide | Après |
| --- | --- | --- |
| 1 | Le panel, les parcours, le protocole, les seuils de la grille | Phase 0 |
| 2 | Les constats et leur classement ; ce qui part en maquette | Phase 4 |
| 3 | Les maquettes, module par module | Phase 5 |
| 4 | Le Design System | Phase 6 |

## Organisation

- Branche `lot-68-audit-ux-parcours`, partie de `main`. Une pull request par porte, vers `main` :
  cadrage ; relevé, audit et synthèse ; maquettes ; Design System.
- Les phases 2 et 3 lancent six spécialistes puis 24 passages, en parallèle par groupes. C'est le
  poste le plus coûteux du lot.
- `docs/gap.csv` ne change pas : ce lot ne livre aucune exigence. Les lots de réalisation le
  mettront à jour.

## Ambiguïtés

| # | Question | Décision (recommandation retenue le 24/11) |
| --- | --- | --- |
| A1 | Quels outils d'origine simuler pour la reprise ? | Deux : le tableur d'une planner et les exports d'un logiciel spécialisé, à la forme des fichiers reçus en recette le 24/11, avec des données inventées. |
| A2 | Seuil des zones d'action : trois en 1 440 px, deux en 375 px ? | Oui pour mesurer ; la synthèse dira si le seuil tient. |
| A3 | Les jetons de `DESIGN.md` (couleurs, polices, rayons) sont-ils remis en question ? | Non, sauf si un constat l'exige (contraste, affordance d'un bouton) ; le constat le dira à la porte 2. |
| A4 | Les Paramètres sur téléphone | Mesurés par l'outil sur toutes les rubriques ; joués par le panel sur ordinateur, sauf Notifications et Mon compte. |
| A5 | Montrer les maquettes à la planner pilote avant le Design System | Oui, à la porte 3, si Julien le souhaite ; rien ne lui est envoyé sans lui. |
| A6 | La fiche d'évènement : quatre onglets en profondeur, les quatre autres à leur entrée | Oui ; la barre d'onglets elle-même est auditée en entier. |

## Hors périmètre

- Toute modification d'un écran de l'app, de son code ou de ses traductions.
- Les modules budget, devis, invités, rendez-vous, portail, Jour J, plans de salle, pipeline,
  au-delà de leurs points d'entrée.
- Les espaces des tiers (client, prestataire, invité), l'Exploitation, l'espace comptable.
- Un test avec de vraies utilisatrices : il reste à l'initiative de Julien.
