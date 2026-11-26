# Maquettes du volet 3 : « Aujourd'hui » et « Évènements » (lot 68, phase 5)

Date : 26/11/2026, par Claude Code. Troisième volet de l'ordre validé à la porte 2
([06-decisions-porte-2.md](06-decisions-porte-2.md), § 3), après le volet 1 (transverse et « Tâches »,
[07](07-maquettes-transverse-taches.md)) et le volet 2 (reprise et import,
[08](08-maquettes-reprise-import.md)), tous deux tranchés le 25/11/2026. Cette note dit ce qui est
proposé (§ 2), les choix laissés à Julien (§ 3), ce que les maquettes supposent de l'app (§ 4), ce qui
a été vérifié dans le code et ce qui ne l'a pas été (§ 5), et les constats non traités (§ 6). Aucun
écran de l'app n'est modifié ; `DESIGN.md` n'est pas touché.

## 1. Les livrables

Cinq pages HTML autonomes dans [`docs/maquette/lot-68/`](../../maquette/lot-68/index.html), au gabarit
des volets 1 et 2 (même feuille de style, mêmes icônes, mêmes cadres), ajoutées au sommaire :

| Page | Contenu | Constats |
| --- | --- | --- |
| [13. Aujourd'hui : vide, rempli, au lendemain d'une reprise](../../maquette/lot-68/13-aujourdhui-accueil.html) | L'espace neuf et sa seule action ; l'écran rempli, rien avant les urgences ; le lendemain d'une reprise | C-15, C-18, C-20, C-53 ; D6, M12, R3 |
| [14. Aujourd'hui : la ligne, les compteurs, l'agence](../../maquette/lot-68/14-aujourdhui-lignes-agence.html) | La ligne d'« À traiter en premier » et ce qu'elle ouvre ; le contact ; l'ordre ; un point = une ligne ; la vue « L'agence » | C-14, C-16, C-19, C-20, C-21 ; M3, M4 |
| [15. Évènements : en-tête, onglets, frise](../../maquette/lot-68/15-evenements-entete.html) | L'en-tête à 1 440 px, à 911 × 512 et sur téléphone ; les onglets ; le menu « ⋯ » ; la frise, reporté, annulé, « rétablir » | C-22, C-23, C-27, C-80 ; M6 |
| [16. Évènements : la suite, la Synthèse, les informations](../../maquette/lot-68/16-evenements-synthese.html) | Une seule « suite » selon l'état ; la Synthèse en cinq blocs ; « Modifier les informations » | C-24, C-26, C-28, C-55 ; D7 |
| [17. Évènements : la liste et le programme](../../maquette/lot-68/17-evenements-liste-programme.html) | La liste à un bouton plein, avec l'avancement ; le programme à deux commandes et un menu | C-29, C-30 ; D5, R11, R12, R15 |

Chaque maquette met l'écran d'aujourd'hui (capture du relevé, ou description tirée des journaux PC-03,
PC-04 et du code quand le relevé n'a pas de capture) à côté de l'écran proposé, en 1 440 et en 375 px,
vide, rempli et repris là où ils diffèrent ; l'en-tête de fiche est aussi montré à 911 × 512. Sous
chaque maquette : les constats traités et les règles de forme de D10. La création d'un évènement n'est
pas refaite (volet 1, page 3).

Formes reprises telles quelles : la ligne allégée d'« Aujourd'hui » et son lien de mariage (M4), la
ligne type de la fiche, le panneau unique d'une tâche (M1), le message de retour sombre (M5), le danger
à trois niveaux et « Annuler l'évènement » / « Garder l'évènement » (M6), les mots de « Nouvel
évènement » (M12), « Reprises en cours », « À compléter » et l'étiquette « Repris » (page 9), les noms
des journées du programme (R11), « moment » (R15), « Ponctuel » (R12), la barre du bas du téléphone
(D4), les bascules en encre (M8).

Données fictives : l'Atelier Roussel des volets 1 et 2 (Camille, son collègue Bastien), le mercredi
25 novembre 2026 ; « Léa & Maxime », mariage du samedi 12 juin 2027 au Manoir des Aulnes ; pour la vue
d'agence, « Maison Belkacem Évènements » du jeu de recette (Nadia et cinq collègues, quarante
évènements). Couleurs : jetons actuels, répartition A en rôles (l'émeraude ne porte que l'action et les
liens ; « bientôt » et l'attente sont neutres ; le rouge ne dit que le retard, toujours avec son mot ou
son « ! » ; la barre d'avancement est en encre).

Une incohérence entre volets : la liste de la page 9 date « Léa & Maxime » du 30 janvier 2027 au
Domaine des Tilleuls, alors que les pages 1, 2 et 4 du volet 1 le placent au 12 juin 2027. Le volet 3
suit le volet 1 ; le Domaine des Tilleuls reste à « Léa & Hugo » (page 9). Les pages du volet 2 ne
sont pas retouchées.

## 2. Ce qui est proposé

**Aujourd'hui.**

- **Espace neuf (page 13)** : l'état vide prend l'écran et porte la seule action principale, qui suit
  la réponse à l'assistant de démarrage (D6, R3) : « Nouvel évènement », ou « Reprendre un mariage en
  cours » ; l'autre voie en ligne à part (M12). « Pour bien démarrer » (trois étapes, dont la fiche
  entreprise) est dans l'état vide. Ni calendrier vide, ni « Risques », ni « Mes évènements ».
- **Rempli (page 13)** : rien entre le titre et les urgences, sauf une alerte qui bloque (plafond
  d'e-mails, rappels arrêtés, demande RGPD). Le bandeau « fiche entreprise » descend dans « Pour bien
  démarrer », une ligne en bas que l'on masque. « Risques » n'a plus de bloc : une alerte du radar
  devient une ligne de la partie « À regarder » ; sans alerte, rien. « Mes évènements » remonte sous les
  urgences et dit « 6 points, dont 2 en retard ».
- **Au lendemain d'une reprise (page 13)** : « Reprises en cours » (page 9) en tête, « 0 point » avec
  sa raison (« vos mariages repris n'ont pas encore de tâches ») et les deux suites ; aucune urgence née
  de l'import.
- **La ligne (page 14)** : une cible, le titre, qui ouvre la tâche dans son panneau par-dessus
  « Aujourd'hui » ; « Fermer » rend la même ligne. Le nom du mariage, lien séparé (M4). Quand un tiers
  est attendu, son contact sous le titre (nom et téléphone, qui appelle sur téléphone). Une action
  rapide d'une seule taille : « Fait », « Noter une relance » (le geste qui existe), rien pour un
  paiement ; « Ouvrir » disparaît. Ordre : les retards, puis tout par date, quel que soit qui agit.
- **Les compteurs (page 14)** : un point est une ligne d'« À traiter en premier » (retard, attente, ou
  dû d'ici quatorze jours). Le haut dit « 7 points à traiter d'ici 14 jours, dont 2 en retard », somme
  des parties ; une partie dit « Tâches 4 sur 7 » quand elle n'est pas montrée en entier ; « 4 autres
  points · Tout afficher » ouvre le reste en place ; « Mes évènements » répartit le même total.
- **La vue d'agence (page 14)** : une bascule « Moi · L'agence » quand l'espace a plus d'une personne.
  « L'agence » : par personne (en retard, aujourd'hui, d'ici 14 jours, évènements suivis, « Voir ses
  tâches ») ; par évènement (planner principal, tâches faites, retards, plus ancien retard), les
  évènements à jour repliés.

**Évènements.**

- **En-tête (page 15)** : retour, nom, faits sur une ligne, frise sur une ligne, une action
  (« Écrire aux mariés », « Ouvrir le Jour J » à partir de J-7) et un menu « ⋯ » (Messages, Voir comme…,
  Ouvrir le Jour J, Changer le type…, puis à part Reporter et Annuler l'évènement). Mesuré : 130 px du
  lien de retour au bas de la frise, 191 px onglets compris. Le type et la source passent dans
  « Informations ».
- **Onglets (page 15)** : les huit tiennent à 1 440 px, l'ouvert en gras et souligné, chacun avec son
  nombre utile (« 6 sur 9 », « 2 en retard »). « Rétroplanning » devient « Tâches » (volet 1),
  « Programme du jour J » devient « Programme ». À 911 × 512, ce qui ne tient pas passe dans « Plus ▾ »,
  l'onglet ouvert restant visible ; une barre fine garde nom, date, statut et onglets en défilant.
  Sur téléphone, la barre défile de côté avec une flèche de 44 px, l'onglet ouvert amené dans le cadre ;
  changer d'onglet garde la barre en haut.
- **Frise (page 15)** : quatre étapes (« Une demande en cours », « Signé, en préparation », « Jour J »,
  « Clôturé »), en lecture. Quand une étape se franchit à la main, un bouton nommé au bout de la frise
  (« Le contrat est signé… », « Clôturer l'évènement… »), et sa question juste dessous. Reporté et
  Annulé remplacent la frise par une ligne d'état et leur seule suite (« Fixer la nouvelle date… »,
  « Rétablir l'évènement… », niveau 2).
- **Une seule suite (page 16)** : un bloc en tête de la Synthèse, dont la forme suit l'état : devis à
  envoyer pour une demande ; liste des tâches à créer pour un mariage signé ; les points de l'évènement
  (mêmes lignes et mêmes comptes que l'accueil) en préparation, une étape en attente s'y ajoutant comme
  une ligne ; « À compléter » pour un repris ; « Clôturer » après le jour J. Plus de bandeau « Prochaine
  étape », plus de « tout est à jour » quand une étape attend, plus de « Reporter » orphelin.
- **Synthèse (page 16)** : cinq blocs au lieu de onze : la suite, puis « Où en est le mariage »
  (l'ancienne « Santé »), « Temps forts », « Rendez-vous » à gauche ; « Informations » et le fil à
  droite. Équipe, plage occupée, source deviennent des lignes d'« Informations » ; « Les 14 prochains
  jours » se fond dans la suite.
- **Modifier les informations (page 16)** : fenêtre longue de `DESIGN.md`, cinq rubriques à gauche, un
  seul « Enregistrer » toujours visible (D7) ; la date d'un mariage signé se lit et renvoie à
  « Reporter l'évènement… » ; le fuseau horaire est dit en mots et ne s'ouvre qu'à la demande.
- **Liste (page 17)** : « Nouvel évènement » seul bouton plein ; bascules en encre ; filtres libellés ;
  colonne « Évènement » avec le type ; colonne « Tâches faites » avec les retards ; « 2 le même jour »
  en texte neutre dans la date ; la charge des douze mois passe dans la vue « Calendrier ». Sur
  téléphone, la première ligne à 126 px au lieu de 835.
- **Programme (page 17)** : « Ajouter un moment », « Partager… » et un menu en tête, au lieu de sept
  commandes ; « Ajouter un moment » à la fin de chaque journée ; la ligne s'ouvre en place, « Retirer »
  passe dans son menu ; un doublon possible se dit « À vérifier : » ; la barre « Enregistrer le
  programme » reste.

## 3. Les choix laissés à Julien

Seize choix, à trancher un par un. Pour chacun : où regarder, la proposition (celle des maquettes),
l'autre voie, et ma recommandation.

### Aujourd'hui

| # | Question | Où regarder | Proposition | L'autre voie | Recommandation |
| --- | --- | --- | --- | --- | --- |
| A1 | Que compte un « point » ? (C-20) | Page 14, « Les compteurs » | Une ligne d'« À traiter en premier » : retard, attente, ou dû d'ici 14 jours. Le haut est la somme des parties ; « 4 sur 7 » dans une partie | Garder le sens de M15 (« attention » sans l'à-venir) et le dire dans le libellé : « 6 points demandent votre attention, 1 à venir » | **La proposition** : un seul sens, qui se recompte à l'écran ; c'est ce que Camille a fait de tête |
| A2 | Dans quel ordre viennent les lignes ? (C-19) | Page 14, table « Ordre des lignes » | Les retards, puis tout par date, quel que soit qui agit | Garder les groupes de l'app (retard, aujourd'hui, attente d'un tiers, à venir), en sortant les attentes dans une partie « En attente » à part | **La proposition** : la planner lit une journée par dates ; les attentes ne passent plus devant ses propres urgences |
| A3 | Que fait le titre d'une tâche ? (C-16) | Page 14, « Ce que le titre ouvre » | Son panneau, par-dessus « Aujourd'hui » ; « Fermer » rend la même ligne | Ouvrir la fiche du mariage sur l'onglet « Tâches », panneau ouvert ; « Fermer » laisse dans la fiche | **La proposition** : le nom du mariage mène déjà à la fiche (M4) ; le titre doit garder la planner sur sa liste du jour |
| A4 | Le contact sur la ligne d'une attente (C-21) | Page 14, anatomie (repère 3) | Nom et téléphone sous le titre ; sur téléphone, un toucher appelle | Le contact dans le panneau seulement, pour une ligne plus sobre | **La proposition** : « qui appeler » est la question de Hugo et de Camille ; la ligne ne s'allonge que pour les attentes |
| A5 | Où va « Mes évènements » ? (C-18, M15) | Page 13, « Rempli », table des blocs | Sous « À traiter en premier », avant le calendrier | Garder l'ordre de M15 (calendrier sous les urgences, « Mes évènements » en bas) | **La proposition** : la liste est courte et le panel l'a aimée ; elle était au troisième écran. Le calendrier reste à un défilement |
| A6 | Que devient « Risques » ? (C-18) | Page 13, « Rempli », table des blocs | Plus de bloc : chaque alerte du radar devient une ligne « À regarder » d'« À traiter en premier » ; aucune alerte, rien | Garder un bloc sous « Mes évènements », renommé « Points de vigilance », avec une phrase qui dit ce qu'il surveille, affiché seulement quand il y a une alerte | **La proposition** : une alerte est une chose à traiter ; elle se compte avec les autres (A1) |
| A7 | Une vue d'agence sur « Aujourd'hui » ? (C-14) | Page 14, « La vue d'une agence » | Bascule « Moi · L'agence » (plus d'une personne seulement) ; par personne et par évènement | Pas de vue nouvelle : la colonne « Tâches faites » de la liste des évènements (E7) et « Tâches » groupé par personne (volet 1) suffisent | **La proposition** : Nadia a abandonné faute d'un écran qui réponde aux deux questions à la fois ; l'autre voie demande deux écrans et des filtres |

### Évènements

| # | Question | Où regarder | Proposition | L'autre voie | Recommandation |
| --- | --- | --- | --- | --- | --- |
| E1 | Combien d'étapes dans la frise ? (C-27, C-25) | Page 15, « La frise » | Quatre : « Une demande en cours », « Signé, en préparation », « Jour J », « Clôturé » (les mots de « Nouvel évènement », M12) | Cinq, renommées : « Demande », « Signé », « En préparation », « Jour J », « Clôturé » | **La proposition** : aucune règle de l'app ne distingue « Confirmé » d'« En préparation » (même suite, même report) et le panel ne les a pas distingués ; les deux statuts peuvent rester en base, à trancher au lot de réalisation |
| E2 | Comment change-t-on le statut ? (C-27) | Page 15, « La frise » | La frise se lit ; un bouton nommé au bout de la frise pour l'étape qui se franchit à la main, sa question juste dessous ; reporter et annuler au menu | Garder les étapes cliquables, avec la question ancrée sous l'étape cliquée et un survol qui dit « Passer en … » | **La proposition** : un rond qui change un statut sans en avoir l'air est le défaut constaté ; un bouton dit ce qu'il fait |
| E3 | Des onglets qui ne tiennent pas (C-23, C-80) | Page 15, « À 911 × 512 » et « Téléphone » | Ordinateur étroit : « Plus ▾ » ; téléphone : barre qui défile, flèche de 44 px, onglet ouvert amené dans le cadre | Défilement de côté partout, avec la flèche | **La proposition** : à l'ordinateur, un menu se lit mieux qu'une barre qui défile à la souris |
| E4 | L'action visible de l'en-tête (C-22) | Page 15, « En-tête et onglets » | « Écrire aux mariés » ; à J-7, « Ouvrir le Jour J » prend sa place ; le reste au menu | Aucune action visible, tout au menu « ⋯ » | **La proposition** : écrire aux mariés est le geste le plus fréquent depuis la fiche ; le jour J, c'est l'écran du terrain |
| E5 | La date d'un mariage signé dans « Modifier les informations » (C-26) | Page 16, « Modifier les informations » | En lecture, avec « Reporter l'évènement… » ; la date d'une demande reste un champ | Un champ, qui ouvre la question du report quand le mariage est signé | **La proposition** : un seul chemin pour un geste qui touche des tiers |
| E6 | « Programme » au lieu de « Programme du jour J » (C-22) | Page 15, onglets ; page 17 | « Programme » ; « Jour J » ne nomme plus que l'étape et l'écran du terrain | Garder « Programme du jour J » | **La proposition** : trois « Jour J » sur une fiche (Inès, Camille) ; le programme couvre aussi la veille et le lendemain |
| E7 | Une colonne d'avancement dans la liste (C-29, C-14) | Page 17, « La liste » | « Tâches faites » (« 14 sur 20 · 2 en retard ») | Liste légère ; l'avancement seulement dans la vue d'agence (A7) | **La proposition** : une planner seule n'a pas la vue d'agence ; la liste est sa vue d'ensemble |
| E8 | La charge des douze prochains mois (C-29) | Page 17, « La liste » (intro) | Dans la vue « Calendrier » | Sous la liste, réduite aux mois qui ont un évènement ; ou supprimée | **La proposition** : c'est une lecture du calendrier, pas de la liste |
| E9 | « Les 14 prochains jours » sur la Synthèse (C-28) | Page 16, « La Synthèse » | Fondu dans la suite : mêmes lignes, même horizon que l'accueil | Garder le bloc, sous la suite, en calendrier de quinze jours | **La proposition** : deux blocs disaient la même chose avec deux comptes différents |

## 4. Ce que les maquettes supposent du comportement de l'app

À spécifier au lot de réalisation, pas à décider ici. Entre parenthèses, l'état actuel lu dans le
code (§ 5).

- **Les collègues dans « Qui s'en charge »** (déjà supposé au volet 1, C-32) : c'est la base de
  « Bastien » sur les lignes et de la vue par personne (aujourd'hui « Planner », « Mariés » ou un
  prestataire).
- **« Moi » et « L'agence »** : « Moi » réduit l'accueil aux tâches confiées et aux évènements dont on
  est planner principal (aujourd'hui, tous les évènements visibles, selon le réglage de visibilité du
  lot 52). « L'agence » demande des comptes par personne et par évènement (une requête nouvelle) et suit
  la visibilité.
- **Le compte des points** : `attentionCount` compterait toutes les lignes (aujourd'hui sans l'à-venir) ;
  le total d'une partie compterait ses lignes ; « Ensuite » (sous le calendrier) deviendrait « Tout
  afficher » au bas de la carte.
- **L'ordre** : les groupes « attente » et « à venir » fondus par date (aujourd'hui l'attente passe
  avant).
- **Le contact d'une attente** : nom et téléphone pris de la fiche du prestataire (`contact_name`,
  `phone`) ou du contact des mariés (`hub.contacts.phone`) ; sans téléphone, l'e-mail.
- **Le panneau d'une tâche sur l'accueil** : ouvert par l'adresse de l'accueil, refermé au même
  défilement (aujourd'hui le titre mène à la fiche, onglet Rétroplanning).
- **Les alertes du radar** comme lignes d'« À traiter en premier » (aujourd'hui une section à part,
  qui dit « Aucun risque détecté ce matin. »).
- **« Pour bien démarrer »** reçoit l'étape « fiche entreprise » et un « Masquer » qui se garde par
  personne ; l'état vide lit la réponse « Que voulez-vous remplacer ? » (volet 2, R3).
- **La frise** : quatre étapes à l'affichage ; un bouton d'étape (« Le contrat est signé… », avec la date
  de signature, qui peut être antérieure au jour) ; « Rétablir » au lieu de « Réactiver (repasse en
  Option) ». Le passage en signé ne crée pas de tâches : la Synthèse le propose ensuite.
- **« Ouvrir le Jour J » à partir de J-7** dans l'en-tête (aujourd'hui le bouton est là dès qu'un
  évènement signé a une date) ; toujours au menu.
- **Les onglets** : « Plus ▾ » et la barre fine en défilant ; l'onglet garde la position de la barre.
- **La Synthèse** : la suite unique (le bandeau `NextStepBanner` devient une ligne), le bloc « Les 14
  prochains jours » retiré, l'équipe et la plage occupée en lignes d'« Informations », l'équipe masquée pour
  une planner seule.
- **« Modifier les informations »** : une fenêtre à rubriques et un seul enregistrement pour les six
  formulaires d'aujourd'hui ; la date en lecture pour un mariage signé (aujourd'hui « Changer la date »
  pour tous les statuts).
- **La liste** : les tâches faites et en retard par évènement (aujourd'hui `listEvents` ne les donne
  pas) ; « 2 le même jour » au lieu de la pastille ; la charge des douze mois dans la vue « Calendrier » ;
  l'étiquette « Repris » et le filtre « Origine » (volet 2).
- **Le programme** : les commandes regroupées, « Ajouter un moment » par journée, « Retirer » au menu
  avec « Annuler » pendant dix secondes, l'alerte de doublon, les heures écrites « 17 h 30 » partout.

## 5. Ce qui a été vérifié dans le code, et ce qui ne l'a pas été

Lu dans `main` (`492145c5`, lots 67 et 69 compris), sans lancer l'app.

| Affirmation des maquettes | Vérifié | Où |
| --- | --- | --- |
| L'accueil empile : résumé, reprise du questionnaire, bandeau « fiche entreprise », alertes, « À traiter en premier », calendrier, « Ensuite », « Risques », « Pour bien démarrer », « Mes évènements » | Oui | `app/page.tsx` |
| « 6 points » compte retard, aujourd'hui et attentes, sans l'à-venir ; la carte montre les sept premiers, à-venir compris ; le titre d'une partie compte tous les éléments de sa nature | Oui | `lib/today/rank.ts` (`attentionCount`), `lib/today/parts.ts` (`HOME_FIRST_COUNT`, `todayParts`) |
| L'ordre : retard, aujourd'hui, attente d'un tiers, à venir | Oui | `lib/today/rank.ts` (`groupOf`, `sortGroup`) |
| La ligne : titre en lien vers l'objet, nom du mariage en texte, « Fait », « Noter une relance » ou « Ouvrir » | Oui | `app/accueil/today-view.tsx` (`TodayItemLine`) |
| « Mes évènements » : « N points à traiter » ou « À jour » | Oui | `today-view.tsx` (`MyEvents`) |
| « Risques » : « Le radar passe chaque matin… », « Aucun risque détecté ce matin. » | Oui | `app/accueil/risk-section.tsx`, fichier de traduction (`RiskRadar.today`) |
| Contact et téléphone d'un prestataire ; le client est un contact du hub, avec un téléphone | Oui | `packages/db/src/schema/vendors.ts`, `events.ts` (`event_clients.contact_id`), `hub.ts` (`contacts.phone`) |
| Planner principal d'un évènement ; visibilité par personne | Oui | `app/events/[id]/team-card.tsx`, `lib/event-visibility` |
| En-tête de fiche : type modifiable dans l'en-tête, « Messages », « Écrire au client », « Voir comme … », « Jour J » | Oui | `app/events/[id]/page.tsx` (`PageHeader`) |
| Onglets « Synthèse », « Budget et prestataires » (« 6/9 »), « Rétroplanning » (« 2 en retard »), « Programme du jour J », « Devis et factures », « Mariés », « Documents », « Invités » | Oui | `page.tsx` (`tabs`), traductions `Events.*` |
| Le bandeau « Prochaine étape » : devis pour une option ; rétroplanning, programme à trois mois, liens des mariés pour un confirmé ou en préparation | Oui | `app/events/[id]/next-step.ts` |
| La Synthèse : prochaine action et deux suivantes, « Reporter » de la première tâche, santé, quatorze jours | Oui | `app/events/[id]/cockpit.tsx` |
| Frise : cinq étapes, ronds cliquables, question sous la frise ; « Reporter l'évènement… », « Annuler l'évènement… » ; « Réactiver (repasse en Option) » ; depuis « Annulé », seule « Option » est permise | Oui | `change-status-form.tsx`, `modules/events/lifecycle.ts` (`canSetStatus`) |
| Changer le statut ne crée pas de tâches | Oui | `modules/events/service.ts` (`changeEventStatus`) |
| « Confirmé » et « En préparation » suivent les mêmes règles (suite, report, clôture, jour J) | Oui | `lifecycle.ts` (`LIVE_STATUSES`), `next-step.ts` |
| L'écran du jour J est ouvert dès qu'un évènement signé a une date | Oui | `app/jour-j/[eventId]/day-of-view.ts` (`isDayOfOpen`) |
| « Modifier les informations » : six formulaires dans un panneau (date, fuseau, budget souhaité, lieu, fiche d'identité, notes) | Oui | `page.tsx` (`SidePanel`) |
| La liste : colonnes « Mariés, Date, Statut, Lieu », pastille ambrée « Même jour : … », charge mensuelle sous la liste, onglets « À venir · N », « Terminés », « Archivés » | Oui | `app/events/page.tsx`, `same-day-notice.tsx`, `monthly-load.tsx` |
| Programme : « Ajouter une séquence », « Importer un chrono (tableur ou PDF) », deux versions du PDF, « Ajouter le programme à mon agenda » | Oui (les textes) | fichier de traduction ; `program-editor.tsx` lu en partie |

**Non vérifié** : rien n'a été vu dans l'app en marche ; les captures « aujourd'hui » sont celles du
relevé (avant le lot 69). Le nombre exact de commandes en tête du programme et le comportement de
« Retirer » (annulation possible ou non) sont repris de l'audit, pas relus dans `program-editor.tsx`.
Ce que deviennent les rappels et les acomptes au rétablissement d'un évènement (déjà non vérifié au
volet 1). Le coût d'une requête qui donne l'avancement de quarante évènements dans la liste. Les
nombres des maquettes (« 6 prestataires », « 38 réponses ») sont des exemples.

**Contrôlé dans le navigateur** (serveur local, Chromium du volet d'aperçu, fenêtre de 1 600 × 1 000) :
chaque cadre « Proposé » regardé en taille réelle à 1 440 et à 375 px, et l'en-tête de fiche à
911 × 512. Mesures : en-tête de 130 px (191 px avec les onglets) à 1 440 px ; à 911 × 512, la première
action de la fiche se termine à 439 px, la deuxième à 508 px, les onglets (631 px) et la frise (606 px)
tiennent dans les 631 px du contenu ; sur téléphone, onglets à 224 px et première action à 262 px, et
première ligne de la liste à 126 px. Par script, sur les cinq pages : toutes les captures chargées,
aucun débordement de côté dans les cadres de 375 px, aucune commande de moins de 44 px, aucun libellé
de bouton coupé. Corrigé après ces contrôles : la ligne de tâche écrasée à 911 px (passée sur deux
étages), la frise trop étroite dans les cartes d'état, « Noter une relance » sur trois lignes au
téléphone, une pastille de notifications dans un espace neuf, deux liens de moins de 44 px, une espace
manquante devant « · ».

## 6. Constats non traités, et pourquoi

| Constat | Pourquoi | Où il sera traité |
| --- | --- | --- |
| C-25, C-03 (création, mariage signé) | Maquettés au volet 1 (page 3) et tranchés (D8, M12, M13) ; non refaits, à la demande | — |
| C-17 (annuler un « Fait » dans l'agence) | D1 : pas un défaut d'annulation ; « Rouvrir » dans « Tâches › Faites » (volet 1) ; le message technique est corrigé au lot 69 | — |
| C-01, C-02 (visites sur l'accueil et la fiche) | La visite de l'accueil, seule automatique (D2), se pose sur l'état vide : son dessin relève de l'aide | Volet « Premiers pas et aide » |
| C-11 (bouton « Réglages » des écrans) | Les maquettes ne le montrent plus ; son sort est une question des Paramètres | Volet « Paramètres » |
| C-82 (menu latéral coupé à 911 × 512) | Le contenu de la fiche est mesuré à cette taille ; le menu, non | Volet « Paramètres » |
| C-49, C-78 (onglet du budget, téléphone compris) | Seul le nombre de l'onglet est dessiné | Volet « Prestataires » |
| C-81 (téléphone) | En partie : la liste des évènements et la fiche ; les formulaires et la barre du haut sont au volet 1 | — |
| Calendrier d'« Aujourd'hui » (lot 65c, M15) | Gardé tel quel ; seule sa place change (A5) | — |
| Onglets « Mariés », « Documents », « Invités », « Devis et factures » | Leur contenu n'a pas de constat dans ce volet | Hors périmètre |
| Vue « Colonnes » (pipeline des demandes) vue par Nadia | Elle répond aux prospects, pas à l'avancement ; aucun constat | Hors périmètre |
| L'accueil d'un assistant (Hugo) en « Moi » | Il suit la règle de « Moi » ; non dessiné à part | Lot de réalisation |
| L'état vide de la liste des évènements | Gardé : il suit le bon gabarit (§ 6 de la synthèse) | — |

## 7. Limites

- Maquettes statiques ; **aucun rejeu par le panel** (non demandé). Rien ne dit qu'un profil trouve la
  bascule « L'agence » ni qu'il comprend « 4 sur 7 » sans aide.
- Les cadres sont dessinés dans un navigateur Chromium aux polices du système (Inter et Space Grotesk
  si installées) ; les hauteurs mesurées changent de quelques pixels avec d'autres polices.
- Les pages sont produites par un petit générateur hors du dépôt, qui reprend octet pour octet la
  feuille de style et les icônes des pages du volet 2 et y ajoute les formes du volet 3 (bloc commenté en
  fin de feuille de style), toutes aux jetons de `DESIGN.md`. Les pages des volets 1 et 2 ne sont pas
  touchées ; seul le sommaire change.

## 8. La porte 3 de ce volet

À venir : Julien tranche A1 à A7 et E1 à E9 un par un. Les maquettes seront corrigées selon ses
réponses, puis ce volet rejoindra le Design System (phase 6) avec les volets 1 et 2.
