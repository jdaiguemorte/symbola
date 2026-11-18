# Lot 53 — Notifications, récapitulatif, automatisations, tâches hors évènement, santé et radar des risques

**Statut** : spécification proposée le 18/11/2026, **validée par Julien le 18/11/2026** : toutes les décisions retenues dans leur option recommandée (a), changements de schéma, contrainte des natures d'e-mails du `hub` et, pour le lot 53, dépendance `web-push` compris (accord donné, ADR à écrire dans la PR). Le lot change les
schémas `hub` et `events`, et demande **une dépendance hors stack** (`web-push`, D4) : accord et ADR
requis (CLAUDE.md § 3 et 8).

Branche `lot-53-notifications`, partie de `main`. Aucune version intermédiaire n'est déployée
(gel des déploiements).

Ce lot avance **en parallèle des lots 48 et 52** : voir « Travail en parallèle » à la fin.

## Contexte

Symbola fait déjà beaucoup de choses seul : relances, rappels, feuilles de route, purge. Mais la
planner ne le voit pas toujours. Elle n'a ni centre de notifications, ni récapitulatif, ni moyen de
couper un automatisme. Elle doit encore tout surveiller : contrats manquants, pièces expirées,
impayés. Le cahier des charges veut un produit qui **prévient utilement** (UX-16) et un **radar des
risques** quotidien (GC-02).

Exigences :

- **HUB-15** (P1) — Notifications dans l'application, par e-mail et en push ; réglages par type ;
  récapitulatif quotidien. *Critère* : chaque type se coupe séparément.
- **UX-16** (P1) — Notifier utile : chaque notification mène à une action ; récapitulatif quotidien
  par défaut ; réglages par type et plages de silence.
- **ARC-09** (P0, Partiel) — Application web progressive : ce lot ajoute les **notifications push**
  (le lot 51 a fait la file hors ligne).
- **HUB-28** (P1, Partiel) — Automatisations prêtes à activer (contrat signé puis évènement créé,
  échéance à J-7 puis rappel, RSVP manquant puis relance). *Critère* : chaque automatisation
  s'active, se coupe et laisse une trace. L'éditeur de règles libre est en P2.
- **HUB-24** (P1, Partiel) — Vocabulaire réglable par type d'évènement (« mariés », « clients »,
  « commanditaire »). *Critère* : le terme choisi s'applique aux écrans, aux e-mails et aux
  documents.
- **CHR-05** (P1) — Jalons, alertes de retard et indicateur de santé du planning. *Critère* :
  l'indicateur s'explique, il liste les tâches qui le dégradent.
- **CHR-10** (P1) — Tâches hors évènement et tâches récurrentes. *Critère* : elles apparaissent dans
  « Aujourd'hui ».
- **GC-02** (P1) — Radar des risques quotidien : prestataires retenus sans contrat, décisions en
  attente, attestations expirées, échéances impayées, tâches critiques en retard. *Critère* : chaque
  alerte explique sa règle ; les seuils se règlent.

## Ce qui existe aujourd'hui

- **« Aujourd'hui »** (`app/accueil`, `lib/today`) : tâches, échéances, demandes, décisions, alertes
  de date, relances de devis et de prospects (lots 32, 44, 45).
- **E-mails de service** par la file des tâches (lot 40b, ADR 0076), à l'image de l'organisation
  (lot 38).
- **Événements internes** (`domain_events`) et leur worker (`lib/event-worker.ts`).
- **Automatismes déjà câblés, sans interrupteur** :
  - devis signé, puis évènement confirmé (rétroplanning, facture d'acompte) ;
  - rappels de tâches (lot 27a) ;
  - relances RSVP (lot 49) ;
  - relances d'impayés et de proposition (lot 43) ;
  - relances préparées de prospects (lot 45) ;
  - feuilles de route des prestataires (lot 47) ;
  - purge RGPD (lot 34).
- **« Santé de l'évènement »** sur la synthèse (tâches faites, en retard, en attente) ;
  `event_tasks` toujours rattachées à un évènement (`event_id` obligatoire).
- **Vocabulaire** (`lib/vocabulary.ts`, ADR 0045) : deux vocabulaires fixes, « les mariés » ou
  « le client », sur les écrans seulement.
- **Service worker** écrit à la main, limité au jour J (`public/sw.js`, ADR 0064).

## Une seule PR

Le lot tient en une PR. Notifications, automatisations et radar partagent une même mécanique :
un fait arrive, une règle décide, puis la notification part par un ou plusieurs canaux. Tâches hors
évènement, santé et vocabulaire sont de petites parties qui alimentent « Aujourd'hui » et les
notifications. Si la PR devenait trop grosse, la coupure naturelle serait :
1. notifications et push ;
2. automatisations, radar, tâches, santé et vocabulaire.

## Partie A — Notifications (HUB-15, UX-16 ; D1 à D3)

- **Un centre de notifications** dans l'application (cloche et nombre non lus). Chaque notification
  dit **quoi** et **quelle action** (« Léa a signé le devis — Voir l'évènement ») et **mène à
  l'action** (critère UX-16).
- **Types**, en données : nouvelle demande, devis signé ou expiré, virement déclaré, décision du
  client, réponse d'un prestataire, IBAN à vérifier, pièce qui expire, tâche en retard, alerte du
  radar, etc. Pour chaque type et chaque canal (application, e-mail, push), la planner coupe ou
  garde (critère HUB-15).
- **Récapitulatif quotidien par défaut** (UX-16, D1) : un e-mail le matin, à une heure réglable dans
  le fuseau de l'organisation. Il regroupe ce qui est nouveau et ce qui attend. Les types marqués
  « immédiat » partent tout de suite, par exemple une déclaration de virement ou une alerte du jour
  J.
- **Plages de silence** (D2) : ni push ni e-mail immédiat la nuit ou le dimanche, si la planner le
  règle. Ce qui tombe pendant le silence attend la fin de la plage ou le récapitulatif. **Le jour
  d'un évènement**, les alertes du jour J passent outre (réglage).
- **Destinataire** (D3) : le planner principal de l'évènement (lot 52) ; à défaut, la Propriétaire.
  Une notification sans évènement va à la Propriétaire.
- **Aucune donnée personnelle superflue** dans un push ou un objet d'e-mail : « Nouvelle demande »
  plutôt que le nom et le téléphone du prospect (SEC-20).

## Partie B — Notifications push (ARC-09 ; D4)

- **Web Push** (norme des navigateurs) :
  - la planner l'active par appareil depuis ses réglages ;
  - sur iPhone, il marche une fois Symbola installé sur l'écran d'accueil (iOS 16.4 et plus) ;
    l'écran l'explique ;
  - les clés VAPID sont dans l'environnement (validées au démarrage, `packages/env`).
- **Le contenu est chiffré** de bout en bout jusqu'au navigateur, comme l'impose la norme. Les
  services de push des navigateurs (Apple, Google, Mozilla) ne voient qu'un message chiffré.
- **Le service worker** (ADR 0064) s'étend aux événements `push` et `notificationclick` : il affiche
  et ouvre l'action. Sa portée hors ligne reste limitée au jour J.
- **Bibliothèque** (D4) : chiffrer un message Web Push est de la cryptographie. CLAUDE.md interdit
  de l'écrire soi-même : il faut la bibliothèque `web-push` (licence MIT). Ton accord et un ADR sont
  nécessaires.

## Partie C — Automatisations prêtes à activer (HUB-28 ; D5)

- **Écran « Automatisations »** : une ligne par automatisme existant ou nouveau, avec ce qu'il fait,
  un **interrupteur**, ses réglages (délais) et son **journal** (dernières exécutions : quand, sur
  quoi, résultat).
- **Les trois du critère** :
  1. **Contrat signé, puis évènement confirmé** (existant) : interrupteur et trace ;
  2. **Échéance à J-7, puis rappel au payeur** (nouveau) : un e-mail court au payeur désigné
     (lot 43), avec le montant, la référence et le RIB, au plus tôt 7 jours avant. Il est distinct
     des relances d'impayés du lot 43, qui partent **après** l'échéance ;
  3. **RSVP manquant, puis relance** (lot 49) : interrupteur et trace sur l'existant.
- **Les autres automatismes existants** rejoignent l'écran avec un interrupteur et une trace :
  rappels de tâches, relances d'impayés et de proposition, relances préparées de prospects,
  feuilles de route.
- **Ce qui ne se coupe pas** : la purge RGPD et les obligations légales, affichées « toujours
  actives » avec leur raison.
- **Couper** un automatisme arrête ses prochains envois ; rien n'est rattrapé à la remise en route.
  L'écran le dit.

## Partie D — Tâches hors évènement et récurrentes (CHR-10 ; D6)

- Une tâche peut ne pas avoir d'évènement : déclaration de TVA, relance de la comptabilité,
  renouvellement de l'assurance. Elle peut **se répéter** : chaque semaine, chaque mois, chaque
  trimestre, chaque année, à une date ou un jour donné.
- La prochaine occurrence se crée quand la précédente est faite, ou à sa date.
- Les tâches hors évènement apparaissent dans **« Aujourd'hui »** (critère) et dans l'écran Tâches,
  avec leurs rappels (lot 27a) et leurs notifications.
- Elles appartiennent au module `events`, la table des tâches acceptant une tâche sans évènement
  (D6).

## Partie E — Jalons et santé du planning (CHR-05)

- Une tâche du rétroplanning peut être un **jalon** : contrat traiteur signé, liste d'invités close.
  Un jalon en retard pèse plus que d'autres tâches.
- **Indicateur de santé** : il existe déjà sur la synthèse. Il prend trois états, « bon », « à
  surveiller » ou « en retard », selon des seuils réglables. **Il s'explique** (critère) : un clic
  liste les tâches qui le dégradent, jalons d'abord, avec leur retard.
- Une **alerte de retard** sur un jalon part par les notifications.

## Partie F — Radar des risques (GC-02 ; D7)

- **Chaque matin**, avant le récapitulatif, Symbola parcourt les évènements à venir et détecte :
  - **prestataires retenus sans contrat** X jours avant l'évènement (statut Retenu, pas « Contrat
    signé ») ;
  - **décisions du client en attente** au-delà de leur échéance ;
  - **pièces expirées ou qui expirent avant l'évènement** (lot 48) ;
  - **échéances impayées** (lot 43) ;
  - **tâches critiques en retard** (jalons) ;
  - **IBAN « à vérifier »** non levés (lot 48) ;
  - **feuilles de route non confirmées** (lot 47).
- **Chaque alerte explique sa règle** (« Retenu depuis 21 jours sans contrat signé ; seuil : 14
  jours avant l'évènement ») et mène à l'action. **Les seuils se règlent** (critère). Ce sont des
  données de l'organisation, avec des valeurs de départ dans `risk-radar.json`.
- Le radar lit chaque module **par son service** (ARC-01). Un module fermé ou absent ne produit
  aucune alerte, jamais d'erreur (ARC-07).
- Il apparaît dans « Aujourd'hui » (section « Risques ») et dans le récapitulatif quotidien.

## Partie G — Vocabulaire réglable (HUB-24 ; D8)

- **Par type d'évènement**, la planner choisit le terme qui désigne les clients :
  - au singulier et au pluriel, en français et en anglais ;
  - avec des valeurs proposées (« les mariés », « les clients », « le commanditaire ») ou un terme
    libre court.
- **Le terme s'applique** (critère) :
  - aux écrans, en remplaçant les deux vocabulaires fixes de l'ADR 0045 ;
  - aux **e-mails**, par une variable des modèles ;
  - aux **documents** (devis, contrat, programme), par la même variable.

  Un document déjà émis garde son texte (pièces figées).
- Le genre et l'accord : le terme se choisit avec son genre et son nombre. Les phrases sont écrites
  pour rester justes (« vos clients », « le couple »), sans accord deviné.

## Décisions à prendre

- **D1 — Le récapitulatif.**
  - (a) E-mail quotidien le matin, par défaut ; les types « immédiats » partent tout de suite.
  - (b) Tout en immédiat, récapitulatif en option.

  **Recommandation : (a)**, c'est le texte d'UX-16 (« récapitulatif quotidien par défaut »).
- **D2 — Les plages de silence et le jour J.**
  - (a) Plages réglables ; le jour d'un évènement, les alertes du jour J passent outre (réglage).
  - (b) Silence absolu pendant les plages.

  **Recommandation : (a).** Un samedi de mariage, une alerte de décalage doit passer.
- **D3 — À qui vont les notifications d'un évènement.**
  - (a) Au planner principal (lot 52), sinon à la Propriétaire.
  - (b) À toute l'équipe de l'évènement.

  **Recommandation : (a)**, avec un réglage par membre pour recevoir aussi celles des évènements où
  il est assistant.
- **D4 — Le push.** Dépendance hors stack.
  - (a) Web Push avec la bibliothèque `web-push` (MIT), ADR à écrire.
  - (b) Pas de push dans ce lot : application et e-mail seulement.

  **Recommandation : (a).** Le push est dans ARC-09 (P0) et HUB-15. Le chiffrer à la main est
  interdit (CLAUDE.md, « jamais de crypto maison »). La bibliothèque est la référence de Node pour
  cette norme.
- **D5 — Couper un automatisme.**
  - (a) Couper arrête les envois à venir, sans rattrapage à la remise en route ; la purge RGPD et
    les obligations légales ne se coupent pas.
  - (b) À la remise en route, envoyer ce qui a été manqué.

  **Recommandation : (a).** Un rattrapage ferait partir d'un coup des rappels périmés.
- **D6 — Les tâches hors évènement.** Touche le schéma `events`.
  - (a) `event_tasks.event_id` devient facultatif, et une tâche porte une règle de répétition.
  - (b) Une table de tâches à part dans le hub.

  **Recommandation : (a).** Une tâche reste une tâche (rappels, Aujourd'hui, écran Tâches) ; deux
  tables doubleraient tout.
- **D7 — Le radar.**
  - (a) Chaque matin, règles et seuils en données, lecture par les services, alertes expliquées.
  - (b) En continu.

  **Recommandation : (a).** C'est le texte de GC-02 (« chaque jour ») ; une passe par jour suffit et
  coûte peu.
- **D8 — Le vocabulaire.**
  - (a) Terme par type d'évènement, avec genre et nombre, appliqué aux écrans, aux e-mails et aux
    documents à venir.
  - (b) Garder les deux vocabulaires fixes.

  **Recommandation : (a)**, le critère de HUB-24 le demande.

## Points pour les conseils

- **DPO** :
  - les abonnements push (adresse du service de push du navigateur, clés publiques) sont des
    données techniques, supprimées à la désactivation ou après 90 jours sans usage ;
  - les services de push des navigateurs reçoivent seulement un message chiffré et l'heure.

  À noter au registre et dans la liste des sous-traitants, comme « destinataire technique » (DPO-10,
  pour information).
- **Avocat** : rien.

## Migrations (prévision)

Numérotation : à partir du premier numéro libre de `main` (0173 aujourd'hui). Une PR fusionnée
après une autre renumérote ses migrations **et** leur date (`when`).

- **`hub`** :
  - `notification_types` (données) et `notification_preferences` (compte, type, canal, actif) ;
  - `notifications` (compte, type, objet, action, lue le) ;
  - `push_subscriptions` (compte, appareil, adresse du service, clés publiques, vu le) ;
  - `quiet_hours` ;
  - `automations` (organisation, clé, actif, réglages) et `automation_runs` (clé, objet, résultat,
    le) ;
  - `risk_rules` (organisation, règle, seuil) ;
  - contrainte des natures d'e-mails (récapitulatif, rappel J-7, alerte), dans une migration à part.
- **`events`** :
  - `event_tasks.event_id` facultatif, `recurrence`, `is_milestone` ;
  - `event_type_vocabulary` (type, terme, genre, nombre, langue).
- RLS et index partout.

## Tests (prévision)

- **HUB-15 et UX-16** :
  - chaque type se coupe par canal ;
  - chaque notification porte une action qui ouvre le bon écran ;
  - récapitulatif à l'heure de l'organisation (horloge simulée, changement d'heure) ;
  - plages de silence respectées ;
  - alertes du jour J qui passent outre.
- **Push** : abonnement, envoi chiffré (bibliothèque simulée), clic qui ouvre l'action ;
  désabonnement ; aucune donnée personnelle dans le contenu.
- **HUB-28** :
  - interrupteur, trace de chaque exécution ;
  - rappel J-7 envoyé une fois, et jamais après un paiement déclaré ;
  - relance RSVP coupée qui ne part plus ;
  - purge non coupable.
- **CHR-10** : tâche hors évènement dans « Aujourd'hui » ; répétition mensuelle ; prochaine
  occurrence créée.
- **CHR-05** : santé expliquée (liste des tâches qui la dégradent) ; jalon en retard qui pèse plus.
- **GC-02** :
  - chaque règle détectée sur le jeu fictif, avec son explication ;
  - seuils réglés ;
  - module fermé : aucune alerte, aucune erreur.
- **HUB-24** : un terme libre apparaît sur un écran, dans un e-mail et dans un devis ; un document
  déjà émis ne change pas.
- **Isolation et abus** (SEC-36) : notifications et abonnements d'une autre organisation ou d'un
  autre compte invisibles ; l'Admin ne voit rien.
- **Rejeu** : SC-03 (lundi matin : récapitulatif, radar, santé expliquée).

## Hors périmètre

- Éditeur de règles libre (P2) ; SMS (avec le fournisseur de SMS, Q34).
- Notifications aux clients et aux prestataires au-delà des e-mails existants.
- Tableaux de bord d'agence (lot 56).

## Ambiguïtés relevées

- HUB-28 « contrat signé puis évènement créé » : Symbola **confirme** l'évènement existant (le
  prospect est déjà un évènement Option, lot 44). C'est le même automatisme, nommé ainsi.
- UX-16 « chaque notification mène à une action » : une notification purement informative (« la
  purge a eu lieu ») mène au journal correspondant.

## Travail en parallèle (lots 48, 52 et 53)

- **Avec le lot 52** :
  - les deux touchent le schéma `hub` (tables différentes) et la contrainte des natures d'e-mails ;
  - la PR fusionnée en second réunit les listes ;
  - le **planner principal** (D3) vient du lot 52 : d'ici sa fusion, la Propriétaire reçoit tout.
- **Avec le lot 48** : le radar lit les pièces et les IBAN « à vérifier » par le service `vendors` ;
  ces règles restent sans alerte tant que 48a n'est pas fusionné (ARC-07).
- Traductions, `gap.csv`, `globals.css` : garder tout, avec les accolades équilibrées.
