# Lot 63 — Retours de la recette de la wedding planner du 21/11/2026

**Statut** : spécification, **à valider par Julien avant le code** (le lot change le schéma de
trois modules et deux parcours P0). Sept paquets, 63a à 63g, chacun sur sa branche
`lot-63x-<nom>` et sa pull request vers `main`.

Sources : l'analyse retour par retour `docs/audits/2026-11-21-recette-planner.md` (numéros #1 à
#42, décisions du 21/11 en § 12) et les maquettes `docs/maquette/Recette-planner.html` (M1 à
M10). Les numéros #n ci-dessous renvoient à l'analyse.

## Contexte

La wedding planner pilote a rejoué la prise en main, les prestataires, l'import, le budget, les
documents, les tâches et les tutoriels. Ses retours tiennent en quatre causes :

1. **On se perd** : chaque action renvoie ailleurs (Paramètres, page Budget séparée, consultation
   du poste, page du tutoriel, espace du client) sans retour à l'écran de départ.
2. **Des fonctions existent mais restent cachées** : créer un évènement confirmé ou pour un
   client existant, rattacher un prestataire du catalogue à une ligne du budget, voir les
   échéances des prestataires.
3. **Trois bogues** :
   - l'import d'évènements affiche un autre statut que celui enregistré ;
   - un type sans modèle reçoit le rétroplanning du mariage ;
   - le retour après une signature fictive mène à l'espace du client.
4. **Les listes ne permettent pas d'agir sur la ligne** (tâches, rétroplanning, choix), et les
   mots ne sont pas ceux du métier (« Déjà retenus », « Garder en champ libre », « Devisé »).

## Décisions déjà prises (21/11)

| Sujet | Décision | Effet |
|---|---|---|
| Pour bien démarrer | Seulement « Régler l'essentiel » et « Ajouter un premier prestataire ». Devis, import des contacts, invitation du client : tutoriels. | Revient sur D11 (lot 33b) |
| Assistant « L'essentiel » | Oui, une question par écran. Obligatoires : raison sociale, adresse, SIRET, régime de TVA. | Revient sur D9 (lot 33b) ; ADR 0103 |
| Visite guidée | Remplace les repères numérotés. | Remplace l'ADR 0033 ; ADR 0104 |
| Plusieurs métiers par fiche | Oui ; types combinés existants scindés. | Schéma `vendors` ; ADR 0105 |
| Rétroplanning | Jamais d'office ; proposé à la création si le type a un modèle ; sinon une astuce. | Revient sur D8 (lot 34a) ; ADR 0106 |
| Vocabulaire du budget | « Devisé » devient « Réel » en français. | Textes FR seulement |
| Tâches | « Supprimer » sur la ligne. Catégories de départ : Client, Prestataires, Administratif, Jour J. | Schéma `events` |
| Échéances | Dans l'onglet « Budget et prestataires » et dans le calendrier. | — |
| Planning du jour J en PDF | Nouveau profil d'import, deux exemples reçus. | Données, pas de dépendance |

## Questions encore ouvertes

- **Q4 (Engagé)**, reformulée en **Q42** dans `docs/QUESTIONS.md`. BUD-01 impose cinq montants,
  dont l'engagé, et SC-04 dit « la ligne passe à engagé ». Je propose de **garder l'engagé, mais
  autrement** :
  - une pastille « Engagé » sur la ligne dont le devis est accepté ou le contrat signé ;
  - un sous-total « dont engagé » sous le total ;
  - plus de colonne à part.

  Cela respecte BUD-01 et SC-04 sans ajouter de colonne. **Accepté le 21/11.**
- **Q42 bis (fenêtre ou panneau)** : **tranché le 21/11 sur les maquettes M11 et M12 : la
  grande fenêtre.**
  - Toute modification, courte ou longue, se fait dans une **fenêtre** : tâche, échéance, fiche
    complète d'un prestataire, ligne de budget avec son échéancier, évènement.
  - Une modification longue a ses rubriques à gauche et « Suivant » pour enchaîner, sans y être
    obligée. Elle enregistre à chaque rubrique et propose « ligne suivante » dans une liste.
  - Le **panneau latéral** ne sert qu'aux réglages d'un écran (#29) et à la consultation rapide.
  - S'écarte de UX-13 (« panneau latéral d'édition ») : ADR 0107.

## Paquets

L'ordre suit l'arbitrage du cahier des charges (§ 1) : bogues d'abord, puis parcours P0, puis
confort. **63a** part dès la validation. **63b**, **63c** et **63f** sont indépendants et peuvent
avancer en parallèle. **63d**, **63e** et **63g** changent le schéma : chacun attend ton accord
sur sa partie « Données ».

---

### 63a — Corrections et mots (aucune migration)

#### HUB-14 — Le statut choisi à l'import d'évènements est celui qu'on voit (#19)

- **Étant donné** un import de fiches d'évènement en PDF, **quand** elle choisit « En
  préparation » pour une fiche, **alors** le choix s'enregistre sans bouton séparé, reste
  affiché après rechargement et apparaît tel quel dans la synthèse avant import.
- **Quand** l'import est appliqué, **alors** l'évènement créé a ce statut, et le journal de
  l'import le dit.
- Test de non-régression : statut choisi ≠ statut lu dans le fichier.

#### EVT-01, CHR-01, HUB-21 — Plus de rétroplanning d'un autre type (#26)

- **Étant donné** un type d'évènement sans modèle de rétroplanning, **quand** un évènement de
  ce type est créé, **alors** aucune tâche n'est créée (fin du repli sur le premier modèle de
  l'organisation, `findDefaultTaskTemplateId`).
- La proposition à la création (case cochée, astuce) vient en 63c ; 63a supprime seulement le
  repli fautif.

#### HUB-11, HUB-10 — Tutoriels : mots, retour et fin (#4, #6, #7, #8)

- Le tutoriel et l'écran emploient le même libellé : **« Faire signer »**. Un test vérifie que
  chaque libellé de bouton cité par un tutoriel existe dans les textes de l'écran visé.
- **Étant donné** une signature fictive dans un exemple, **quand** elle a signé, **alors** le
  bouton dit « Revenir au devis » et rouvre le devis dans l'app, plus `/portail`.
- Au lancement d'un tutoriel qui crée des données : « Symbola crée un exemple, marqué EXEMPLE.
  Il est supprimé à la fin du tutoriel, avec tout ce qu'il contient. Vos vrais évènements ne
  sont pas touchés. »
- Fin : « Tutoriel terminé. L'exemple a été supprimé. » et le tutoriel conseillé ensuite ; plus
  de « L'exemple est réglé selon votre choix ».

#### HUB-11 — Pour bien démarrer, l'indispensable seulement (#2)

- La liste de l'accueil n'a que « Régler l'essentiel » (lien vers les Paramètres en attendant
  63f) et « Ajouter un premier prestataire ». Elle disparaît une fois les deux faits.
- « Préparer un premier devis », « Importer vos contacts » et « Inviter un client sur son
  espace » deviennent des tutoriels du centre d'aide (fichiers de données traduisibles).
- Une organisation qui avait déjà tout coché ne voit pas réapparaître la carte.

#### UX-10 — Les mots du métier (#10, #11, #22, #27, #28)

- « Chaque alerte dit sa règle » disparaît de l'accueil.
- Filtre « Déjà retenus » → **« Déjà travaillé ensemble »**.
- « Garder en champ libre (sur la fiche) » → **« Une note sur la fiche »**, avec sa conséquence
  (« Visible sur la fiche, rubrique Notes. Pas de filtre ni de calcul. »). Le tableau des
  colonnes vient en 63b.
- Onglets de la fiche : « Budget » → **« Budget et prestataires »** ; « Devis » → **« Mes devis
  et factures »**.
- Budget, en français : « Devisé » → **« Réel »** partout où le montant devisé s'affiche (écran,
  export, portail). L'anglais garde « Quoted ».

#### PRE-01, PRE-11 — Filtres des prestataires (#12, #13)

- Bouton « Effacer les filtres », visible dès qu'un filtre est actif ; chaque filtre actif est
  une pastille retirable.
- « Où ? » : le lieu et le rayon dans un seul contrôle (maquette M4), avec un seul libellé.

#### FAC-01, UX-02, UX-14 — Envoi du devis (#37, #38)

- **Étant donné** un client qui a une adresse, **quand** elle prépare l'envoi, **alors**
  l'adresse de facturation est pré-remplie avec la sienne, modifiable.
- Règle commune : un champ `required` porte « * » dans son libellé, et le formulaire dit
  « * obligatoire ». Contrôle automatique sur tous les formulaires (test qui parcourt les
  composants).
- À l'envoi, la liste de ce qui manque, chaque ligne menant au champ.

---

### 63b — Import (migration 0201, Q44)

#### HUB-14, UX-15 — On voit que ça charge (#15)

- Sur ordinateur, « Importer » ouvre une **fenêtre de chargement** : étapes (fichier lu,
  colonnes reconnues, doublons, aperçu), ligne en cours, « Rien n'est encore enregistré. Vous
  pouvez fermer : l'import continue. » Sur téléphone, le même contenu en haut de la page.
- La réaction est visible en moins de 100 ms (UX-15).

#### HUB-14, UX-10 — Où va chaque colonne (#22, maquette M5)

- Un tableau : colonne du fichier avec deux valeurs d'exemple, menu « Devient, sur la fiche »
  (les champs par leur nom, puis « Une note sur la fiche », puis « Ne pas importer »), état
  (« Reconnue », « Choisie », « Ignorée »).
- À droite, l'**aperçu** de la première ligne en fiche, qui suit les choix.

#### HUB-14 — Rapprochements vérifiables (#16)

- La ligne du fichier et la fiche existante côte à côte : nom, métier, ville, e-mail, téléphone,
  nombre d'évènements ; les valeurs qui diffèrent sont marquées par un texte, pas seulement par
  une couleur.
- Trois choix : « C'est le même », « Ce sont deux prestataires », « Décider plus tard ».
- **Étant donné** deux fiches qui n'ont en commun que le prénom, **alors** la proposition porte
  « À vérifier » et le choix par défaut est « Ce sont deux prestataires ».

#### HUB-14, UX-07 — Fin d'import claire (#17)

- D'abord le bilan : créés, mis à jour, ignorés, colonnes gardées en note, chacun cliquable.
- Bouton principal **« Vérifier les N prestataires »** : la liste filtrée sur cet import, avec
  une pastille « Import du JJ/MM » retirable. Secondaire : « Revenir à mes prestataires ».
- L'annulation dans un bloc replié « Annuler cet import ». Il nomme chaque fiche modifiée à la
  main depuis l'import, avec son métier, sa ville et l'heure de la modification. Les choix sont
  « Annuler l'import, sauf ces fiches » ou « Tout annuler » (plus de « Annuler quand même :
  Prestataire : Sans intitulé »).
- Même bilan pour les autres types d'import (contacts, évènements, budget, invités).

#### HUB-14 — Importer depuis chaque écran (#18)

- Un bouton « Importer » dans Prestataires, Évènements, Contacts, Invités, Budget et Programme
  ouvre l'import réglé sur ce type ; l'écran central garde l'historique.

#### BUD-01, BUD-03, HUB-14 — Budget importé complet (#21, #42)

- L'import d'un budget lit Prévu, Réel (devisé) et Réglé ; l'écart et le reste à payer se
  calculent.
- S'il trouve des colonnes d'acompte et de solde datées, il crée les **échéances**
  correspondantes. Sinon, il fait comme aujourd'hui.

#### CHR-08 — Programme du jour J depuis le PDF de l'ancien logiciel (#20)

- Nouveau profil de données dans `import-profiles.json` (lecture par `pdfjs-dist`, déjà
  présent). Il lit le jour, le début, la fin, le titre, la description (en note), les
  interlocuteurs et « Caché des mariés ».
- Même écran de contrôle que l'import par tableur (lot 51) ; rien n'est écrit avant
  « Importer ».
- Les sept pièges de l'analyse (§ 4 bis) ont chacun un test, sur des PDF **fabriqués** aux noms
  inventés (les exemples réels ne vont pas dans le dépôt) :
  - une fin à 00:00 est absente, et une fin plus tôt que le début passe au lendemain ;
  - une ligne sans interlocuteur devient un repère ;
  - un interlocuteur sans rôle reste en texte ;
  - un rôle en double se rapproche par rôle et nom, et la planner elle-même est ignorée ;
  - le nom après le rôle se cherche dans le prénom, le nom et la raison sociale ;
  - une ligne « Caché des mariés » n'est pas partagée : elle s'importe cachée des mariés (Q44,
    migration 0201 ; réglable sur chaque séquence dans l'éditeur du programme) ;
  - le résumé des invités est ignoré.
- Les intervenants de l'en-tête se rapprochent des prestataires du catalogue par le même écran
  qu'en M5.

---

### 63c — Évènements, budget, documents, réglages (migration : peut-être une)

#### EVT-01, HUB-07 — Créer l'évènement qu'on veut (#24, maquette M7)

- Bouton **« Nouveau »** sur la liste des évènements, avec trois choix :
  - Prospect ;
  - Évènement confirmé, client facultatif (ex. un shooting photo) ;
  - Pour un client existant.
- La route existe déjà (`?type=evenement`, `?contact=`).
- Trois champs suffisent toujours : nom, date, type (EVT-01).

#### EVT-01, CHR-01, HUB-21 — Le rétroplanning proposé à la création (#26)

- Si le type a un modèle : case « Partir du rétroplanning « <type> » (N tâches) », **cochée**
  pour un évènement confirmé, **décochée** pour un prospect, avec « Voir les tâches ».
- Si le type n'a pas de modèle : l'astuce, avec « Créer un modèle pour « <type> » » (dans un
  panneau, sans quitter le formulaire).
- Un modèle s'applique plus tard depuis l'onglet Rétroplanning.
- Les tâches déjà faites ne bougent pas quand la date change (CHR-01, inchangé).
- SC-01, étape 5 : un mariage confirmé a bien son rétroplanning, la case étant cochée par défaut.

#### EVT-07, CHR-03, UX-13 — Une seule barre pour trois vues (#25)

- Liste, Colonnes et Calendrier partagent le même en-tête, avec le sélecteur au même endroit et
  les mêmes boutons.

#### BUD-04, PRE-02 — Rattacher un prestataire depuis la ligne du budget (#39)

- Sur chaque ligne, « Choisir un prestataire… » cherche dans le catalogue, d'abord le métier du
  poste et les fiches « Déjà travaillé ensemble ». Le choisir le **retient** pour ce poste,
  comme « Retenir » dans la consultation.
- « + Nouveau prestataire » le crée dans une fenêtre, sans quitter le budget.
  « Comparer plusieurs prestataires » ouvre la consultation.

#### BUD-01, BUD-03, BUD-04 — Budget et prestataires, une seule vue (#21, #40, maquette M9)

- L'onglet de la fiche montre, par ligne : prévu, réel, écart (réel − prévu, signe écrit),
  réglé, reste à payer, prochaine échéance (pastille « En retard » si dépassée), et les pièces
  du prestataire sous son nom.
- La ligne se déplie sur son échéancier : « Ajouter une échéance », « Marquer payée ».
- L'engagé : pastille « Engagé » sur la ligne dont le devis est accepté ou le contrat signé, et
  sous-total « dont engagé » (Q42, accepté le 21/11).
- La page Budget séparée (`/budget/[id]`) mène à cet onglet, pour une seule vue.

#### DOC-01, BUD-04 — Déposer un document au bon endroit (#30, #31, maquette M8)

- Une zone de dépôt toujours en tête (glisser-déposer sur ordinateur). Elle demande « Ce
  document est : devis d'un prestataire, facture d'un prestataire, contrat, autre » et, pour un
  devis ou une facture, le prestataire concerné.
- La pièce va dans le dossier de son type et se rattache à la ligne du budget.
- « Déplacer vers… » sur chaque pièce, et glisser-déposer sur ordinateur.
- « Mes devis » et « Mes factures » restent en lecture.
- « Lire l'aide » mène à l'article des documents.
- **Données** : les dossiers par défaut « Devis des prestataires », « Factures des
  prestataires » et « Contrats » se créent avec l'évènement, à partir d'un fichier de données.
  Le rattachement d'une pièce à une ligne du budget passe par les pièces de ligne qui existent
  déjà (`budget_line_attachments`) ; une migration n'est nécessaire que s'il faut garder le
  type de pièce. **À vérifier au début du paquet.**

#### UX-09, UX-13 — Les réglages sans perdre l'écran (#29)

- Sur ordinateur, la roue « Réglages » d'un écran ouvre ses réglages dans un **panneau
  latéral** ; le fermer laisse l'écran tel quel.
- Sur téléphone : la page de réglages, avec « Retour à <écran> ».

---

### 63d — Tâches et Aujourd'hui (migration : oui)

#### CHR-02, UX-07 — Agir sur la ligne d'une tâche (#32, #33, #34, maquette M6)

- Deux gestes distincts :
  - un **rond « Fait »** (nom accessible « Marquer « <tâche> » comme faite ») ;
  - une **case de sélection** à gauche, avec « Tout sélectionner » dans l'en-tête.
- Actions sur la ligne : « Modifier », « Reporter » (demain, dans une semaine, choisir une date)
  et **« Supprimer »**.
- La suppression est immédiate, annulable dix secondes (UX-07), puis la tâche part à la
  corbeille.
- Échéance modifiable dans la cellule.
- Clic sur la ligne ou « Modifier » : fenêtre de la tâche (Q42 bis, ADR 0107), avec « Enregistrer »
  et « Supprimer la tâche ».
- Actions groupées : décaler de N jours, responsable, catégorie, supprimer.
- Le rétroplanning d'un évènement emploie le même tableau.
- SC-03, étape 3 : une tâche cochée par erreur s'annule.

#### CHR-03, HUB-20 — Catégories et priorité des tâches (#35)

- **Données** :
  - une table `events.task_categories` (organisation, libellé, couleur, position ; RLS ;
    modèle de départ en données : Client, Prestataires, Administratif, Jour J) ;
  - deux colonnes sur les tâches : `category_id` (facultative) et `priority` (`high` ou
    `normal`, par défaut `normal`) ;
  - migration réversible, schéma `events` seulement ;
  - tests d'isolation entre organisations.
- Catégorie et priorité s'affichent dans la liste et dans le calendrier, toujours avec leur
  libellé, jamais par la couleur seule. Elles se règlent dans les Paramètres des évènements.

#### HUB-08, BUD-03, BUD-11 — Aujourd'hui en calendrier (#9, #41, maquette M3)

- Un calendrier du mois à côté des priorités. Il montre les évènements, les rendez-vous, les
  tâches (couleur de leur catégorie) et les **échéances de paiement** non réglées (catégorie
  « Paiements »).
- Clic sur un jour : le détail du jour dans une fenêtre. Clic sur un élément : son écran.
- Sur téléphone : la semaine en liste, sous les priorités.
- Les échéances lues ici passent par le `service.ts` du module Budget (ARC-01).

#### PRE-02, UX-13 — Les écrans de choix (#36)

- La consultation d'un poste et les décisions reprennent le motif de ligne de M6 : actions
  visibles, fenêtre au clic.

---

### 63e — Prestataires à plusieurs métiers (migration : oui)

#### PRE-01, PRE-11, HUB-20 — Une fiche, plusieurs métiers (#14, maquette M4)

- **Données** :
  - une table `vendors.vendor_type_links` (organisation, prestataire, type, `is_primary`), avec
    au plus un métier principal par fiche (index unique partiel) et RLS ;
  - `vendors.type_id` devient le métier principal, puis disparaît une fois les lectures passées
    sur la nouvelle table ;
  - migration en deux temps, réversible, schéma `vendors` seulement.
- **Reprise** : chaque fiche reçoit son type actuel comme métier principal.
  - Les types combinés reconnus par les synonymes (« Photographe et vidéaste », « Coiffure et
    maquillage »…) sont scindés : la fiche reçoit les deux métiers, et le type combiné est
    fusionné dans le premier (fusion de types du lot 16).
  - La liste des combinaisons est un fichier de données.
  - Le résultat est affiché à Julien avant la migration de production, organisation par
    organisation.
- Fiche : métiers cochés, un principal (couleur et icône sur la carte). Les étiquettes et les
  champs de chaque métier s'ajoutent, ainsi que les étiquettes « pour tous ».
- Les filtres, la carte, la recherche et l'export trouvent la fiche par n'importe lequel de ses
  métiers ; l'export porte la liste des métiers.
- Import : une valeur combinée donne plusieurs métiers ; synonymes complétés dans
  `vendor-type-synonyms.json`.
- Contrat interne : `service.ts` renvoie `typeIds` (et `primaryTypeId`). Les autres modules
  qui lisent le type d'un prestataire sont mis à jour dans la même PR, en gardant
  temporairement l'ancien champ. L'événement `vendors.vendor_type.merged` reste compatible.

---

### 63g — Les apps : voir ce qui existe et le demander (migration : oui, à valider)

Ajouté le 21/11 : la planner ne trouvait ni les plans de table ni les plans des lieux. Le
libre-service est fermé (ADR 0101), « Mon abonnement » est caché, et un module non activé ne
laisse aucune trace (HUB-06, ARC-07). Maquette M13.

#### HUB-06, HUB-27, ARC-06, ARC-07 — Écran « Apps »

- Une entrée « Apps » en bas du menu, pour la Propriétaire. Chaque module du catalogue y figure
  avec :
  - son état (« Activée », « Non activée », « Demandée le … ») ;
  - ce qu'il apporte ;
  - où le trouver une fois activé.
- Les textes viennent de `plans.json`, traduisibles.
- **Libre-service fermé** (le pilote) :
  - « Demander l'activation » ouvre une fenêtre, sans champ libre (SEC-09 : l'Exploitation ne
    reçoit aucune donnée métier), puis enregistre la demande ;
  - la demande peut être annulée tant qu'elle n'est pas traitée ;
  - l'Exploitation la voit dans `/exploitation/organisations`, avec le nom de l'organisation et
    le module ;
  - une fois le module activé, la planner reçoit une notification (HUB-15) et le module apparaît
    dans son menu à la requête suivante (ARC-06).
- **Libre-service ouvert** : le même écran propose « Ajouter à mon abonnement ». Il affiche le
  prix, le prorata et le nouveau total, puis passe par le parcours de « Mon abonnement » du
  lot 54.
- Ailleurs, rien ne change : pas de lien vers un module absent (ARC-07).
- **Données** :
  - une table `hub.module_requests` (organisation, clé du module, demandée par, demandée le,
    traitée le, état ; RLS, et lecture par l'Exploitation sur son rôle distinct comme pour les
    abonnements) ;
  - migration réversible, schéma `hub` seulement ;
  - tests d'isolation, et test que l'Admin ne lit que la clé du module et l'organisation.
- **Correction du catalogue** : « Plans de salle » est décrit « plans des lieux et des
  tables », alors que le **plan de table** est dans le module **Invités**. Les descriptions de
  `plans.json` disent où est chaque fonction.

### 63f — Démarrage et visite guidée (aucune migration)

#### HUB-09, HUB-18, HUB-23, UX-04 — Assistant « L'essentiel » (#1, maquette M1)

- Six étapes, une question par écran : société et SIRET, adresse et contact, logo, TVA, banque
  (RIB), numérotation.
- Il écrit dans les réglages existants, sans nouvelle table. Enregistrement à chaque étape,
  « Finir plus tard », retour à l'accueil à la fin.
- Raison sociale, adresse, SIRET et régime de TVA sont obligatoires **pour envoyer un devis**,
  pas pour entrer dans l'app. SC-01 : aucun champ bloquant, moins de dix minutes.
- Le questionnaire d'accueil (lot 33b) reste avant l'assistant. L'assistant est la première
  ligne de « Pour bien démarrer ».

#### HUB-11 — Visite guidée (#3, maquette M2)

- Par écran clé (Aujourd'hui, Évènements, fiche d'un évènement, Prestataires, Budget, Devis) :
  trois à cinq étapes. Le fond est assombri, la zone expliquée reste claire, une bulle à côté
  propose « Précédent », « Suivant » et « Passer la visite ».
- La visite se lance seule à la première visite et se relance depuis « ? › Revoir la visite »
  (HUB-11).
- Clavier :
  - le focus va dans la bulle, puis revient à son point de départ ;
  - Échap ferme.
- Le contenu de chaque écran est un fichier de données traduisible.
- **Remplace** les repères numérotés (`landmarks.tsx`, `page-tour.tsx`), migrés vers ce
  format ; ADR 0104 remplace l'ADR 0033.
- Sur téléphone : une bulle en bas de l'écran, la zone encadrée, sans découpe.

#### HUB-11, HUB-10 — Tutoriel dans le panneau latéral (#5, #8, maquette M10)

- Le tutoriel s'ouvre dans un panneau qui reste pendant la navigation dans l'exemple.
- Les étapes se cochent quand l'action est faite, et « Étape suivante » mène au bon écran.
- « Quitter le tutoriel » supprime l'exemple.
- À la fin, retour à l'écran d'où le tutoriel a été lancé.

---

## Design system (`DESIGN.md`)

À ajouter avec 63a, utilisé par tous les paquets :

- **Fenêtre (ordinateur)** : pour un chargement, une confirmation et **toute modification**.
  - Fond assombri, focus piégé, Échap ferme.
  - Courte : une colonne.
  - Longue (maquettes M11, M12) : jusqu'à 860 px, rubriques à gauche, « Suivant » pour
    enchaîner, enregistrement à chaque rubrique, « ligne suivante » dans une liste.
  - Sur téléphone, c'est une page avec « Retour » et les mêmes rubriques.
  - Jamais deux fenêtres empilées.
- **Panneau latéral** : réglages d'un écran et consultation rapide, sans quitter l'écran ; jamais
  pour une modification longue.
- **Glisser-déposer** : toujours doublé d'un bouton (« Déplacer vers… »).
- **Champ obligatoire** : « * » dans le libellé et « * obligatoire » dans le formulaire.
- **Barre de filtres** : chaque filtre a son libellé au-dessus, à la même hauteur ; un lieu et
  son rayon forment un seul contrôle ; « Effacer les filtres » dès qu'un filtre est actif.
- **Visite guidée** : décrite en 63f.

## Données et migrations

| Paquet | Migration | Schéma | Réversible | Accord |
|---|---|---|---|---|
| 63a, 63f | aucune | — | — | — |
| 63b | 0201 : `program_items.hidden_from_clients` (séquence cachée des mariés, Q44) | `events` | oui | accordé le 21/11 (Q44) |
| 63c | 0196 si le type de pièce doit être gardé (à vérifier) | `events` | oui | à confirmer au début du paquet |
| 63d | 0197 : `task_categories`, `category_id`, `priority` | `events` | oui | **accord du 21/11** |
| 63e | 0198 : `vendor_type_links` et reprise ; 0199 : retrait de `type_id` | `vendors` | oui | **accord du 21/11** (résultat de la reprise montré avant la production) |
| 63g | 0200 : `module_requests` | `hub` | oui | **accord du 21/11** |

Numéros réservés le 21/11 (0196 à 0200), pour que les paquets menés en parallèle ne se marchent pas dessus ; si 63c n'a pas de migration, 0196 reste libre. Aucune clé étrangère entre schémas (avenant de l'ADR 0012).

## ADR à écrire

- **0103** : assistant « L'essentiel », qui revient sur D9 du lot 33b.
- **0104** : visite guidée à la place des repères ; remplace l'ADR 0033.
- **0105** : prestataires à plusieurs métiers.
- **0106** : rétroplanning proposé à la création, plus créé d'office ; revient sur D8 du lot 34a.
- **0107** : la fenêtre pour modifier, le panneau pour les réglages ; s'écarte de UX-13.
- **0108** : écran « Apps » et demandes d'activation pendant le pilote (63g) ; complète l'ADR 0101.

## Tests et rejeu

- Chaque critère ci-dessus devient un test, sous l'identifiant de l'exigence. Exemple :
  `describe('HUB-14 — …')`, et un `it` par puce.
- Tests d'isolation pour `task_categories` et `vendor_type_links`.
- Playwright, ordinateur et 375 px, un parcours par écran touché :
  - création d'évènement ;
  - budget et prestataires ;
  - documents ;
  - tâches ;
  - import avec fin d'import ;
  - visite guidée ;
  - tutoriel.
- axe-core sur la visite guidée et les fenêtres.
- Horloge simulée : report d'une tâche (veille, jour même), échéance en retard, heures du PDF
  autour de minuit.
- Rejeu local, écrit dans `docs/recette/` :
  - **SC-01** (premier quart d'heure, avec l'assistant) ;
  - **SC-03** (lundi matin) ;
  - **SC-04** (devis de traiteur dans le budget) ;
  - **SC-10** (import).

## Fichiers touchés (principaux)

- **Démarrage, aide** :
  - `app/accueil/*` ;
  - `lib/onboarding/checklist.ts` ;
  - `app/demarrage/*` ;
  - `app/page-tour.tsx` ;
  - `packages/ui/src/landmarks.tsx` ;
  - `app/aide/tutoriels/*` ;
  - `app/signature-fictive/[token]/page.tsx` ;
  - `lib/help/*`.
- **Import** :
  - `app/import/**` ;
  - `lib/import/*` ;
  - `packages/import-engine/src/pdf.ts` ;
  - `packages/starter-templates/src/import-profiles.json` ;
  - `vendor-type-synonyms.json`.
- **Évènements** :
  - `app/events/page.tsx`, `app/events/new/*`, `app/events/pipeline/*` ;
  - `app/events/[id]/*` (budget, documents, tâches, consultation) ;
  - `modules/events/*`.
- **Budget** :
  - `app/budget/[eventId]/*` ;
  - `modules/budget/*`.
- **Prestataires** :
  - `app/prestataires/*` ;
  - `modules/vendors/*` ;
  - `packages/db/src/schema/vendors.ts`.
- **Tâches** :
  - `app/taches/*` ;
  - `packages/db/src/schema/events.ts`.
- **Transverse** :
  - `app/settings-link.tsx` ;
  - `DESIGN.md` ;
  - `packages/i18n/src/messages/{fr,en}.json` ;
  - `docs/gap.csv`.

## Hors périmètre

- La plateforme agréée et la signature renforcée (sans lien avec ces retours).
- La synchronisation des échéances vers les agendas externes (le flux ICS existant n'est pas
  modifié).
