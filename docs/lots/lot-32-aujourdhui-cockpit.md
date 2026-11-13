# Lot 32 — « Aujourd'hui », cockpit d'évènement et création rapide

**Statut** : spécification **validée par Julien le 13/11/2026** (« Oui, je valide » : D1 à D11 en (a)).
32a fait le 13/11/2026 (bilan après la partie F) ; 32b fait le 13/11/2026 (bilan après la partie I).
Branche `lot-32-aujourdhui`, partie de `main` (après le lot 31, PR #111). Le travail reste en deux
parties, mais une seule PR les porte toutes les deux : décision de Julien du 13/11/2026 (« Une seule
pour les 2 »), qui remplace les deux PR de D1 (a).

## Contexte

Phase 1 du plan (`docs/GAP_REPORT.md` § 7) : fermer les parcours P0. Le lot 32 ferme **PAR-03
« Piloter : le quotidien d'un évènement »** et son scénario **SC-03 « Lundi matin »** :

1. Camille ouvre « Aujourd'hui » sur son téléphone.
2. Elle repère les trois urgences sans défiler.
3. Elle coche une tâche par erreur et l'annule.
4. Elle ouvre le cockpit du mariage de référence depuis une alerte.
5. Elle relance depuis le cockpit un prestataire sans contrat.
6. Elle ajoute une tâche avec la création rapide.

Mesures : trente secondes pour savoir par quoi commencer, chaque action en deux gestes.

Cibles visuelles : `docs/maquette/Aujourdhui.html` et `docs/maquette/Cockpit.html`.

**Exigences** (toutes P0) :

| ID | Exigence | Critère | État (`docs/gap.csv`) |
| --- | --- | --- | --- |
| HUB-08 | Accueil « Aujourd'hui » : tâches dues, échéances de paiement, décisions du client en attente, rendez-vous, alertes, tous évènements confondus. | Tri par urgence. Chaque ligne mène à l'action en un clic. | Partiel : des blocs séparés, sans tri unique ni décisions du client |
| UX-01 | Répondre à « que dois-je faire maintenant ? » | L'accueil et chaque cockpit affichent en premier la prochaine action, son échéance et son responsable. | Partiel : l'accueil s'ouvre sur l'agenda |
| UX-06 | Statut, suite, blocage | Tout objet montre son statut, l'étape suivante et qui la bloque. | Partiel : « qui bloque » n'apparaît nulle part |
| EVT-02 | Cockpit : compte à rebours, santé du planning, du budget et des décisions, prochaine action, échéances des quatorze jours, activité récente. | Les trois actions les plus urgentes sont visibles sans défiler sur un écran de 13 pouces. | Partiel : quatre chiffres et l'activité, sans le reste |
| FAC-12 | Suivi des encaissements, chiffre d'affaires signé et encaissé, prévisionnel. | Trois chiffres en tête d'écran : signé, facturé, encaissé. | Partiel : encaissements à venir par mois seulement |
| HUB-07 | Création rapide depuis tout écran : prospect, évènement, tâche, dépense, devis. | Un clic ou un raccourci clavier. | Absent |
| UX-03 | Trois gestes pour l'essentiel | Les dix actions les plus fréquentes s'atteignent en trois gestes au plus depuis l'accueil. | Partiel : pas de création rapide, gestes non mesurés |
| CRM-04 | Contrôle de disponibilité à la saisie d'une date : évènements confirmés et options le même jour. | L'alerte apparaît avant l'enregistrement. | Partiel : badge dans l'agenda, pas d'alerte à la saisie |
| EVT-07 | Vue du portefeuille : calendrier, liste, charge par mois, filtres. | Deux évènements le même jour sont signalés. | Partiel : pas de charge par mois |
| CHR-03 | Vues liste et calendrier, puis colonnes et chronologie. | Liste et calendrier au MVP. | Partiel : pas de calendrier des tâches |

## Découpage proposé (D1)

- **32a — « Aujourd'hui » et cockpit** : HUB-08, UX-01, UX-06, EVT-02, FAC-12. SC-03, étapes 1 à 5.
- **32b — Création rapide et portefeuille** : HUB-07, UX-03, CRM-04, EVT-07, CHR-03. SC-03, étape 6.

## Lot 32a — « Aujourd'hui » et cockpit

### Partie A — Les urgences, une seule liste (HUB-08, UX-01, UX-06 ; D2 à D4)

Une fonction pure range tout ce qui demande une action, tous évènements confondus. Chaque élément
porte :
- ce qu'il faut faire ;
- l'évènement concerné ;
- l'échéance ;
- **qui doit agir** : « Vous », « Le client » ou le nom du prestataire ;
- l'action en un clic (cocher, marquer payé, relancer, ouvrir).

**Sources** (chaque module souscrit apporte la sienne ; sans le module, sa source disparaît) :

| Source | Module | Qui agit |
| --- | --- | --- |
| Tâches non faites, en retard ou à venir (planner ou client) | Évènements | Vous, ou « le client » |
| Échéances de paiement des clients (devis signés) | Devis | Le client |
| Échéances des prestataires (budget) | Budget | Le client |
| Décisions demandées au client, sans réponse | Évènements | Le client |
| Règlements déclarés par un client, à confirmer | Budget | Vous |
| Devis sans réponse et prospects sans nouvelle (délais de relance) | Devis, Évènements | Le client |
| Facture d'acompte bloquée (mention manquante) | Devis | Vous |
| Prestataire retenu sans contrat signé (D6) | Évènements | Le prestataire |
| Deux évènements le même jour | Évènements | Vous |
| Demandes RGPD et purge à valider (titulaire), liens à renouveler | Hub, Évènements | Vous |

Les **rendez-vous** viennent avec le module Rendez-vous (lot 46) ; d'ici là, aucune source ne les
fournit.

**Tri par urgence (D2)**, en quatre groupes, dans cet ordre :
1. **En retard** : le plus en retard d'abord.
2. **Aujourd'hui** : ce qui tombe aujourd'hui.
3. **Attend un tiers** : ce que le client ou un prestataire doit faire ; le plus ancien d'abord.
4. **À venir** : les quatorze prochains jours, par date.

Les trois premiers éléments forment « À traiter en premier ».

### Partie B — L'écran « Aujourd'hui » (D3)

Il reprend la maquette, de haut en bas :
- **en-tête** : la date, le nombre d'évènements en cours et le nombre de points qui demandent
  attention ;
- **« À traiter en premier »** : trois lignes, visibles sans défiler sur ordinateur et à 375 px ;
- **le reste**, par groupe (en retard, aujourd'hui, attend un tiers, à venir), replié au-delà de
  quelques lignes ;
- **« Mes évènements »** : les évènements en cours, avec la date, le compte à rebours et leur état
  (« 3 points à traiter », « À jour », « Option »). Chaque évènement ouvre son cockpit.

Les blocs actuels de l'accueil (agenda, tâches, encaissements, relances, alertes) disparaissent :
leur contenu passe dans la liste. Le calendrier de douze mois passe à l'écran « Évènements »
(32b, EVT-07). Les alertes du titulaire et le plafond d'envois gardent leur bandeau en tête.

### Partie C — Annuler une tâche cochée (SC-03, étape 3 ; D7)

Cocher une tâche depuis « Aujourd'hui » ou le cockpit la marque faite tout de suite. Un message
« Tâche faite. Annuler » reste dix secondes ; « Annuler » la rétablit. Les deux actes vont à
l'activité de l'évènement, comme aujourd'hui. Le reste d'UX-07 (corbeille, etc.) reste au
lot 39.

### Partie D — Le cockpit (EVT-02, UX-01, UX-06 ; D5)

L'onglet « Aperçu » de la fiche d'évènement devient « Synthèse », dans l'ordre de la maquette :
- **en-tête** : noms, statut, date, lieu, **compte à rebours** (« 68 jours avant le jour J »),
  « Voir comme le client » (aperçu du portail, existant) ;
- **« Prochaine action »** : le premier élément de la partie A pour cet évènement, avec son
  échéance, qui doit agir et son action. Pour une tâche, il propose « Reporter » (nouvelle date) ;
- **trois indicateurs de santé** :
  - planning : tâches faites sur le total, tâches en retard ;
  - budget : montant engagé sur l'enveloppe, si le module Budget est souscrit ;
  - décisions du client : nombre en attente, et la plus ancienne ;
- **« Les 14 prochains jours »** : tâches, échéances des clients et des prestataires, décisions
  attendues, par date ;
- **« Activité récente »** (existante).

Sur un écran de 13 pouces (1 280 × 800), la prochaine action et les deux suivantes sont visibles
sans défiler. Les formulaires actuels de l'aperçu (date, budget souhaité, lieu) passent sous
« Modifier les informations », replié.

### Partie E — Relancer un prestataire sans contrat (SC-03, étape 5 ; D6)

Un prestataire **retenu** sans contrat signé apparaît dans les urgences, avec l'action « Relancer
le prestataire ». Cette action :
- ouvre la messagerie de la planner, avec un message prérempli au prestataire (son adresse vient de
  la fiche du carnet) ;
- inscrit la relance, datée, dans l'activité de l'évènement.

L'envoi par Symbola lui-même viendra avec la messagerie (lots 38 et 55).

### Partie F — Les trois chiffres (FAC-12 ; D8)

En tête de « Devis et factures » et de « Encaissements », trois chiffres :
- **Signé** : les devis signés, en TTC, à la date de signature ;
- **Facturé** : les factures émises moins les avoirs, à la date d'émission ;
- **Encaissé** : les encaissements reçus moins les annulations, arrhes comprises, à la date du
  paiement.

Par défaut, l'année civile en cours ; on peut choisir une autre année. Les essais en sont exclus.
« Prévisionnel » reste la liste des encaissements à venir, déjà affichée.

### Bilan du lot 32a (13/11/2026)

**Fait** :
- **« Aujourd'hui »** (HUB-08, UX-01, UX-06 ; D2 à D4) :
  - une seule liste, triée en quatre groupes : en retard, aujourd'hui, en attente d'un tiers,
    quatorze prochains jours ;
  - les sources : tâches (les vôtres et celles du client), échéances des clients et des
    prestataires, décisions du client, règlements déclarés, devis et prospects à relancer,
    facture d'acompte bloquée, prestataire retenu sans contrat, lien redemandé, deux évènements le
    même jour ;
  - « À traiter en premier » : les trois plus urgents, visibles sans défiler sur ordinateur et à
    375 px ;
  - chaque ligne dit l'évènement, l'échéance et qui agit (« Vous », « Attend le client »,
    « Attend » et le nom du prestataire), avec l'action en un clic (« Fait », « Relancer »,
    « Ouvrir ») ;
  - « Mes évènements » : date, compte à rebours, statut, « N points à traiter » ou « À jour » ;
  - un module non souscrit n'apporte rien. Un module lent (plus de 2 s) ou en panne est signalé
    « indisponible », et le reste s'affiche : la garde de l'ancien bloc « Encaissements à venir »
    est reprise pour chaque source.
- **Les anciens blocs de l'accueil** sont retirés (dix fichiers). L'agenda passe sur
  « Évènements », avec son repère dans la visite. Le menu dit « Aujourd'hui ».
- **Annuler** (D7) : « Fait » coche tout de suite ; « Tâche « … » faite. Annuler » reste dix
  secondes, sur l'accueil et sur la synthèse.
- **La synthèse** (EVT-02, D5) : l'onglet « Aperçu » devient « Synthèse » :
  - en-tête : compte à rebours (« 68 jours avant le jour J ») et « Voir comme » la personne du
    premier lien client actif ;
  - « Prochaine action » et les deux suivantes, le reste replié, « Reporter » pour une tâche ;
  - le bandeau « Prochaine étape » vient juste dessous (UX-01 : la prochaine action d'abord) ;
  - santé : planning (faites sur le total, en retard), budget (engagé sur l'enveloppe, si le
    module est souscrit), décisions du client (en attente, la plus ancienne), et la barre des
    lignes pourvues (PRD-EVT-03) ;
  - les quatorze prochains jours, par date ;
  - les formulaires (date, budget souhaité, lieu) sous « Modifier les informations », replié ;
    les champs importés restent visibles ;
  - en 1 280 × 800, la prochaine action et les deux suivantes sont visibles sans défiler. Pour
    cela, le choix du type d'évènement tient sur une ligne.
- **Relancer un prestataire** (D6) :
  - le message prérempli s'ouvre dans la messagerie de la planner, à l'adresse de la fiche du
    carnet ;
  - la relance s'inscrit dans le fil d'activité (sorte « vendor_reminded », migrations 0127 et
    0128, avec leur annulation) ;
  - le nom n'est pas recopié dans l'activité : il se lit sur le prestataire consulté, et
    disparaît avec lui (retrait, demande d'oubli ; RGP-05).
- **Les trois chiffres** (FAC-12, D8) :
  - signé (TTC, à la date de signature), facturé (moins les avoirs, à l'émission), encaissé
    (moins les annulations, arrhes comprises, au paiement) ;
  - par année civile, essais exclus ;
  - en tête de « Devis et factures » et de « Encaissements ».
- **Accessibilité** :
  - le nom du bouton « Fait » contient son texte visible (« Fait : « … » », WCAG 2.5.3) ;
  - sur « Devis et factures », la section ne double plus le nom du tableau (repère en double,
    antérieur au lot).
- **Textes et aide**, en français et en anglais :
  - aide de l'accueil, de la fiche, des devis et des encaissements ;
  - visites de l'accueil, de la fiche et des évènements ;
  - deux tutoriels qui parlaient de « Vue d'ensemble ».

**Vérifications** (13/11/2026) :
- lint, vérification des types, frontières de modules : verts ;
- tests unitaires : tous les paquets verts, app 478 (dont le tri, le compte à rebours et la garde
  des sources) ;
- intégration sur une base réelle :
  - base 159 (dont l'annulation de 0127 et 0128) ;
  - app 582 : sources pour toute l'organisation, isolation, relance sans copie du nom, trois
    chiffres sans les essais, relances du lot 13 portées sur la nouvelle liste ;
- Playwright, ordinateur et 375 px, axe-core, sur une base rechargée : 259 passés, 1 ignoré
  (comme avant). Nouveau parcours `hub-08-sc-03-lundi-matin` (SC-03 et FAC-12) ; quinze parcours
  existants mis à jour (accueil, onglet « Synthèse », formulaires repliés, agenda sur
  « Évènements ») ;
- captures du centre d'aide régénérées (ADR 0033). Le script échouait depuis le lot 31a : sa
  préparation envoyait un devis sans les mentions requises. Il les remplit maintenant ;
- Semgrep (comme en CI, sans `.next`) : 0 constat ;
- Gitleaks sur les 61 fichiers texte du lot : un seul constat, le mot de passe fictif d'un
  parcours existant (`prd-hub-02`), ligne antérieure au lot et inchangée.

**Rejeu SC-03** (`docs/recette/SC-03.md`) : étapes 1 à 5 tenues sur téléphone.
- « Aujourd'hui » s'affiche en 0,3 s, les trois urgences sans défiler.
- Cocher puis annuler : 2 gestes. Ouvrir le cockpit depuis l'alerte : 1 geste. Relancer :
  2 gestes.
- Le jeu fictif ne donnait pas le point de départ (tâches dues, échéances, décision) : complété
  en préparation, hors mesure.

**Écarts et suites** :
- **Fil d'activité** : la partie C disait que cocher et annuler vont à l'activité « comme
  aujourd'hui ». En fait, seules les coches des tiers (par leur lien) y vont, et ce lot ne change
  pas cette règle. À trancher si la planner veut voir ses propres coches dans le fil.
- **« Qui agit »** n'est encore affiché que sur les urgences et la synthèse. Les écrans des
  devis, factures et lignes de budget le diront plus tard (UX-06 reste partiel).
- **Rendez-vous** : avec leur module (lot 46). HUB-08 reste partiel pour cela seul.
- **Jeu fictif** : il ne contient ni tâche due, ni échéance proche, ni décision en attente
  (remarque pour le lot de recette).

## Lot 32b — Création rapide et portefeuille

### Partie G — Création rapide (HUB-07, UX-03 ; D9)

- Un bouton **« + Créer »** dans l'en-tête de chaque écran, et la touche **« N »** quand le
  curseur n'est pas dans un champ.
- Il ouvre un menu à quatre entrées : prospect, tâche, dépense, devis.
  - Le prospect est l'évènement naissant.
  - La dépense est une ligne de budget, avec le devis d'un prestataire s'il y en a un.
- Chaque entrée ouvre un formulaire court, en panneau, sans quitter l'écran.
- L'évènement proposé est celui de l'écran courant ; à défaut, il se choisit dans la liste.
- La création se confirme par un message, avec un lien vers l'objet créé.

**UX-03 — les dix actions depuis l'accueil**, après le lot, au plus en trois gestes :

| Action | Chemin | Gestes |
| --- | --- | --- |
| Ajouter un prospect | « + Créer » › Prospect › Créer | 3 |
| Créer un devis | « + Créer » › Devis › Créer | 3 |
| Ajouter une tâche | « + Créer » › Tâche › Ajouter | 3 |
| Enregistrer un devis de prestataire dans le budget | « + Créer » › Dépense › Enregistrer | 3 |
| Marquer un paiement | « Aujourd'hui » › « Marquer payé » › Valider | 2 ou 3 |
| Écrire au client | Évènement › « Écrire au client » (messagerie de la planner) | 2 |
| Ouvrir le déroulé du jour J | Évènement › « Jour J » | 2 |
| Trouver un contact et l'appeler | ⌘K › résultat › numéro | 3 |
| Émettre une facture | Devis › « Émettre » (l'acompte part déjà de lui-même, lot 31) | 2 ou 3 |
| Partager un document | Lot 37 (documents par évènement) | — |

### Partie H — Alerte de date (CRM-04 ; D10)

À la saisie d'une date d'évènement, dans la création d'un prospect et dans la fiche :
- dès que la date est choisie, avant l'enregistrement, Symbola liste les évènements **confirmés**
  et les **options** (prospect, devis envoyé) du même jour ;
- l'alerte n'empêche pas d'enregistrer.

### Partie I — Portefeuille et calendrier des tâches (EVT-07, CHR-03 ; D11)

- **Écran « Évènements »** :
  - deux vues, liste et calendrier (celui de l'accueil) ;
  - la **charge par mois** sur douze mois ;
  - les jours où deux évènements tombent ensemble, signalés dans les deux vues ;
  - les filtres existants.
- **Écran « Tâches »** : une vue **calendrier du mois** à côté de la liste. Chaque tâche est à son
  échéance et ouvre son évènement.

### Bilan du lot 32b (13/11/2026)

**Fait** :
- **Création rapide** (HUB-07, D9) :
  - « Créer » dans la barre du haut de chaque écran de l'équipe, et la touche N hors d'un champ ;
  - quatre entrées : prospect, tâche, dépense, devis ; une entrée dont le module n'est pas
    souscrit disparaît (ARC-06) ;
  - un formulaire court dans une fenêtre, sans quitter l'écran ; l'évènement de l'écran est
    proposé (fiche, budget, jour J, devis) ;
  - un message de confirmation avec le lien « Ouvrir » ;
  - la dépense est une ligne de budget : le poste, le prestataire consulté s'il y en a un, le
    libellé, le montant du devis du prestataire (« devis reçu ») ;
  - le devis se crée en brouillon numéroté ;
  - les créations reprennent les contrôles des écrans d'origine. Un évènement d'une autre
    organisation est refusé : test d'abus.
- **« Écrire au client »** dans l'en-tête de la fiche (UX-03) : la messagerie de la planner
  s'ouvre, aux adresses des clients.
- **Alerte de date** (CRM-04, D10) :
  - dès qu'une date est choisie, les évènements confirmés et les options (prospect, devis
    envoyé) du même jour s'affichent, avant l'enregistrement, sans rien bloquer ;
  - dans le formulaire « Nouveau prospect », la création rapide et la date de la fiche ;
  - l'alerte ne montre jamais une autre organisation.
- **Portefeuille** (EVT-07, D11) :
  - « Évènements » propose deux vues, « Liste » et « Calendrier » ;
  - la charge des douze prochains mois (confirmés et options, par mois) ;
  - « Même jour : … » dans la liste ;
  - dans le calendrier, le badge vaut aussi pour deux évènements un jour de semaine. Avant, un
    tel jour ouvrait une liste vide (défaut corrigé).
- **Calendrier des tâches** (CHR-03) :
  - « Liste » ou « Calendrier » sur « Tâches » ;
  - le mois du lundi au dimanche, chaque tâche à son échéance et menant à son évènement ;
  - sur téléphone, la liste des seuls jours qui ont des tâches.
- **Textes et aide**, en français et en anglais : aide de l'accueil, des évènements, de la
  création d'un prospect et des tâches ; repère « Liste ou calendrier » dans la visite.
- **Aucune migration.**

**Vérifications** (13/11/2026) :
- lint, vérification des types, frontières de modules : verts ;
- tests unitaires : app 483, dont la charge par mois, le même jour et la grille d'un mois
  (passage d'heure, année bissextile) ;
- intégration : base 159, app 582 ;
- Playwright, ordinateur et 375 px, axe-core : nouveau parcours `hub-07-creation-rapide` (les
  quatre créations, la touche N, l'alerte de date, le portefeuille, le calendrier des tâches,
  « Écrire au client », un module non souscrit, l'abus entre organisations) ; trois parcours de
  l'agenda passés à la vue « Calendrier ». Sur une base rechargée : 265 passés, 1 ignoré ;
- captures du centre d'aide régénérées ;
- Semgrep : 0 constat ; Gitleaks sur les 26 fichiers texte du 32b : seul revient le mot de passe
  fictif du parcours `prd-hub-02`, ligne antérieure au lot et inchangée.

**Rejeu SC-03, étape 6** (`docs/recette/SC-03.md`, section 32b) : tenue en 3 gestes sur
téléphone, l'évènement de l'écran proposé.

**Écarts et suites** :
- **UX-03** reste partiel :
  - les créations ouvrent leur formulaire en 2 gestes, mais s'enregistrent en 3 ou 4 selon le
    choix à faire (source, évènement, poste) ;
  - à arbitrer : faut-il préremplir la dernière source utilisée et l'évènement le plus proche ?
  - marquer un paiement, appeler un contact et émettre une facture ne sont pas remesurés ;
    partager un document viendra au lot 37.
- **Devis du prestataire joint en fichier** : la dépense en garde le montant. Le fichier se
  joint ensuite sur la ligne du budget, comme aujourd'hui.
- **Options** : prospect et devis envoyé, en attendant le statut « option » du lot 34 (EVT-01).

## Décisions à prendre

- **D1 — Découpage.**
  - (a) 32a (« Aujourd'hui » et cockpit), puis 32b (création rapide et portefeuille), deux PR.
  - (b) Une seule PR.

  **Recommandation : (a).** Le 32a ferme la partie la plus utile de SC-03, et chaque PR reste
  relisible.
- **D2 — Tri par urgence.**
  - (a) Les quatre groupes de la partie A, et « À traiter en premier » pour les trois premiers.
  - (b) Une seule liste par date.

  **Recommandation : (a).** Ce qui est en retard ou attend un tiers ne se voit pas par la date
  seule.
- **D3 — L'accueil.**
  - (a) Refondu selon la maquette : la liste unique remplace les blocs, et l'agenda passe à
    « Évènements ».
  - (b) Les blocs restent, et la liste s'ajoute au-dessus.

  **Recommandation : (a).** Ajouter sans retirer, c'est retrouver la page qui oblige à tout lire,
  ce que PAR-03 veut éviter.
- **D4 — Qui agit.**
  - (a) Chaque élément dit « Vous », « Le client » ou le nom du prestataire.
  - (b) Seulement « Vous » et « Attend un tiers ».

  **Recommandation : (a)** (UX-06, « qui la bloque »).
- **D5 — Cockpit.**
  - (a) L'onglet « Aperçu » devient la « Synthèse » de la maquette (partie D), et les formulaires
    passent sous « Modifier les informations ».
  - (b) Un nouvel onglet à côté de l'aperçu.

  **Recommandation : (a).** Un seul endroit pour savoir où en est l'évènement.
- **D6 — Relancer un prestataire.**
  - (a) Message prérempli dans la messagerie de la planner, et relance inscrite dans l'activité de
    l'évènement. Cela demande une nouvelle sorte d'activité, donc un petit changement de schéma.
  - (b) Message prérempli seulement, sans trace.

  **Recommandation : (a).** La relance doit se voir dans l'activité (PAR-03, étape 4 : « sans
  autre saisie »).
- **D7 — Annuler une tâche cochée.**
  - (a) Message « Annuler » pendant dix secondes, dès ce lot, pour les tâches.
  - (b) Attendre le lot 39 (UX-07).

  **Recommandation : (a).** C'est l'étape 3 de SC-03.
- **D8 — Trois chiffres.**
  - (a) Par année civile (l'année en cours par défaut), sur « Devis et factures » et
    « Encaissements ».
  - (b) Depuis le début.

  **Recommandation : (a).** Un chiffre d'affaires se lit par année.
- **D9 — Création rapide.**
  - (a) Bouton « + Créer » dans l'en-tête et touche « N », formulaire en panneau, évènement
    courant proposé.
  - (b) Une page « Nouveau » dédiée.

  **Recommandation : (a)** (HUB-07 : « un clic ou un raccourci clavier »).
- **D10 — Alerte de date.**
  - (a) Non bloquante, avant l'enregistrement : confirmés et options du même jour.
  - (b) Bloquante.

  **Recommandation : (a).** Deux évènements le même jour sont possibles, avec une équipe.
- **D11 — Portefeuille.**
  - (a) Le calendrier quitte l'accueil pour « Évènements », avec la charge par mois.
  - (b) Il reste aussi sur l'accueil.

  **Recommandation : (a)**, cohérente avec D3.

## Migrations

- **32a, avec D6 (a)** : `events`. Une valeur « prestataire relancé » s'ajoute aux sortes
  d'activité de l'évènement, seule dans sa migration. L'activité gagne aussi une référence
  facultative au prestataire. Les deux migrations ont leur annulation.
- **32b** : aucune, a priori.

## Fichiers touchés (prévision)

- **32a** :
  - `apps/symbola/app/page.tsx` et `app/accueil/` : liste des urgences, « Mes évènements » ;
  - une fonction pure de tri (`lib/today/`), avec ses tests ;
  - `app/events/[id]/` : synthèse, prochaine action, santé, quatorze jours, relance, report ;
  - modules `events`, `budget` et `quotes` : les listes pour toute l'organisation (décisions en
    attente, prestataires sans contrat, chiffres signé, facturé, encaissé), par leur `service.ts` ;
  - `app/devis/` et `app/devis/encaissements/` : trois chiffres ;
  - traductions, aide, registre RGPD si besoin.
- **32b** :
  - `app/app-shell.tsx`, ou un composant d'en-tête, pour la création rapide ;
  - les actions existantes de création (prospect, tâche, ligne de budget, devis) ;
  - `app/events/` (vues, charge par mois) ; `app/taches/` (calendrier) ;
  - les formulaires de date (alerte).

## Tests

- **Unitaires** : le tri par urgence (groupes, ordre, cas limites : veille, jour même, échéance
  passée, passage à l'heure d'été), « qui agit », le compte à rebours, les trois chiffres.
- **Intégration** :
  - les listes pour toute l'organisation ;
  - l'isolation entre organisations ;
  - un module non souscrit ne fournit rien ;
  - relance et report ;
  - les trois chiffres, sans les essais.
- **Parcours Playwright** (ordinateur et 375 px, axe-core) :
  - SC-03 : les trois urgences sans défiler, la tâche cochée puis annulée, le cockpit ouvert
    depuis une alerte, la relance, la création rapide (32b) ;
  - l'alerte de date ;
  - les vues du portefeuille.
- **Rejeu SC-03** sur le jeu fictif (`docs/recette/SC-03.md`). Si le jeu chargé ne donne pas le
  point de départ du scénario (onze tâches dues, deux échéances, une décision en attente), le
  script le complète en préparation, hors mesure, et le compte rendu le dit.

## Hors périmètre

- **Rendez-vous** : lot 46 (RDV-01 à RDV-04).
- **Récapitulatif de fin de journée** (PAR-03, étape 5) : avec les notifications (lot 53, HUB-15).
- **Envoi des relances par Symbola** : avec la messagerie (lots 38 et 55).
- **Onglets Prestataires, Invités et Jour J du cockpit de la maquette** : lots 47, 49 et 51 ;
  l'accès au jour J existe déjà.
- **Corbeille et annulation générale** : lot 39 (UX-07).

## Ambiguïtés relevées

- **« Options »** (CRM-04) : le cahier des charges ne définit pas de statut « option ». Je prends
  « prospect » et « devis envoyé » avec une date ; le statut « option » viendra avec les statuts du
  lot 34 (EVT-01).
- **« Responsable »** (UX-01) : une tâche connaît aujourd'hui « planner » ou « client ». Le nom d'un
  membre de l'équipe viendra avec l'équipe (lot 52).
- **« Prestataire sans contrat »** : statut « retenu », sans « contrat signé ». Un prestataire
  seulement consulté n'est pas une urgence.
- **Lot court du journal d'audit (Q35)** : la DPO l'a proposé juste après le lot 31. Il attend tes
  durées de conservation ; je le placerai où tu voudras.
