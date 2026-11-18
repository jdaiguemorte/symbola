# Lot 49 — Invités et RSVP, régimes avec accord, purge des invités

**Statut** : spécification proposée le 18/11/2026, **validée par Julien le 18/11/2026** : toutes les décisions retenues dans leur option recommandée (a), dépendances comprises (accord donné, ADR à écrire dans la PR du lot).
Branche `lot-49-invites-rsvp`, partie de `main` (85c655d, après la PR #131). Le lot crée un
module et son schéma (`guests`), ajoute une table au schéma `events` (D2) et des colonnes au
schéma `hub` (D9) : validation explicite requise (CLAUDE.md § 8). Aucune dépendance nouvelle
(le QR code emploie `qrcode`, déjà là, ADR 0028).

**Avant la première donnée réelle d'invité** (réponse 5 de la DPO, Q35) : l'analyse d'impact
« socle » du module, que chaque planner complète. Le lot peut s'écrire et se rejouer sur le jeu
fictif sans elle ; le module reste **fermé par défaut** (préalable commun, D0) et l'Admin ne
l'ouvre pour la pilote qu'une fois l'analyse faite.

Aucune version intermédiaire n'est déployée (gel des déploiements). Le lot se rejoue en local.

Ce lot avance **en parallèle des lots 41 et 46** ; il partage avec le lot 46 un **préalable
commun** : voir la section dédiée et « Travail en parallèle » à la fin.

## Contexte

Symbola n'a pas de module Invités. Les couples tiennent leur liste dans un tableur, envoient les
invitations à répondre par leurs propres moyens et recopient les réponses ; les régimes
alimentaires circulent par e-mail jusqu'au traiteur. Ce sont des données d'invités qui n'ont rien
demandé, dont certaines (régimes, allergies) relèvent de l'article 9 du RGPD (réponse 3 de la
DPO).

Exigences du lot (`docs/GAP_REPORT.md` § 7, tableau « Phase 2 » ; `docs/gap.csv`) :

| ID | Exigence | P | Critère d'acceptation | Écart aujourd'hui |
| --- | --- | --- | --- | --- |
| INV-01 | Liste d'invités par foyers et personnes : accompagnants, enfants, côté, groupe, coordonnées | P1 | Seuls le nom et un moyen de contact sont obligatoires. | Absent : module Invités absent |
| INV-02 | Import depuis un tableur et saisie par le client dans son portail | P1 | L'import signale les doublons avant d'écrire. | Absent |
| INV-03 | RSVP en ligne par lien ou QR code personnel : présence par temps fort, régime, hébergement, transport | P1 | Réponse en moins de soixante secondes sur téléphone, sans compte. | Absent |
| INV-04 | Suivi des réponses et relances automatiques | P1 | Aucune relance vers un invité qui a répondu. | Absent |
| INV-07 | Régimes et allergies dans une liste paramétrable, avec l'accord de l'invité ; accès restreint, purge programmée | P1 | RGP-06 à RGP-08 respectées dès l'activation du module. | Absent |
| RGP-06 | Régimes et allergies : liste fermée paramétrable, case d'accord non précochée, texte clair sur l'usage et les destinataires | P1 | Sans accord, la donnée n'est pas enregistrée. | Absent |
| RGP-07 | Accès aux données sensibles limité ; chiffrement au niveau du champ (DAT-08) | P1 | Un Assistant sans ce droit voit le nombre de régimes, pas les noms. | Absent |
| RGP-08 | Purge programmée des données d'invités après l'évènement, annoncée sept jours avant, report possible et motivé | P1 | La purge efface aussi les exports stockés et les copies hors ligne. | Absent |
| RGP-18 | Enfants invités : prénom, tranche d'âge, régime, saisis par un adulte du foyer | P1 | Aucun contact direct collecté pour un enfant. | Absent |

Parcours PAR-07 (P1), étapes 1 à 4 ; scénario SC-07, étapes 1 à 5 et 7 (l'étape 6, plan de
table et synthèse pour le traiteur, est au lot 50). Personas SU-05 (Léa), SU-10 (Jeanne, 71 ans,
téléphone d'entrée de gamme, lien reçu par SMS), SU-11 (Antoine, lecteur d'écran).

Ce que la DPO a déjà répondu (Q35, fiche, réponses 2 à 5) et que ce lot applique :

- **Base légale** : intérêt légitime du planner et du couple, test de mise en balance documenté ;
  **information de l'invité au premier contact** (article 14) et **droit d'opposition**.
- **Régimes et allergies** : données de l'article 9 ; **l'accord vient de l'invité lui-même par
  son lien** (ou du titulaire de l'autorité parentale, qui le déclare), **jamais du client qui
  saisit la liste** ; Symbola garde la preuve pour le planner (horodatage, version du texte,
  canal) ; retrait aussi simple que l'accord ; pas de champ libre ; transmission au traiteur
  limitée ; **compteur agrégé qui ne dévoile pas un régime unique dans un petit groupe**.
- **Enfants** : prénom, tranche d'âge et régime ; le régime n'est enregistré que si la personne
  qui saisit déclare être le représentant légal ; **ni compte ni lien pour un enfant**.
- **Purge** : **régimes et allergies 7 jours après l'évènement**, le reste 30 jours après, préavis
  de 7 jours ; **un seul report, 90 jours au plus** ; gel pour litige à part.
- **Analyse d'impact** obligatoire, par chaque planner, avant la première donnée réelle ;
  Symbola fournit une analyse « socle » et un registre prérempli.

Décisions et ADR qui s'appliquent : ADR 0011 et 0012 (un module, un schéma), ADR 0053 (liens
personnels), ADR 0056 (purge automatique avec préavis), ADR 0062 (modules autonomes), ADR 0069
(contact dans le noyau), ADR 0072 et 0076 (e-mails, file sans doublon), ADR 0037 (chiffrement
AES-256-GCM, modèle du chiffrement de champ), ADR 0028 (`qrcode`). Lot 40c : le RSVP doit passer
la revue au lecteur d'écran (NFR-17, UX-14, renvoyé à ce lot).

## Ce qui existe aujourd'hui

- **Temps forts** : aucun. L'évènement a un programme minute par minute (`events.program_items`)
  et des lieux (`events.event_places`) ; les temps forts (EVT-04) sont prévus au lot 51. Le jeu
  fictif en décrit trois pour le mariage de référence (cérémonie laïque, dîner, brunch).
- **Liens personnels** (lot 26, ADR 0053) : `events.event_links` pour le client, le payeur et le
  prestataire (adresse e-mail obligatoire, rubriques du portail `LINK_RUBRICS`, code à usage
  unique facultatif, expiration, retrait) ; jeton de 256 bits après « # », haché, retiré de
  l'adresse ; session par cookie (`lib/link-session.ts`) ; mention d'information au nom du
  planner (`link-privacy-notice.json`, réglable dans les réglages RGPD).
- **Portail** (lot 27) : rubriques ouvertes une à une par la planner (POR-10).
- **Import** (lot 5, HUB-14) : moteur `packages/import-engine` avec aperçu, doublons, annulation,
  neutralisation des formules ; cibles `events`, `budget`, `quotes`, `vendors`, `hub`.
- **E-mails** : modèles en données, garde-fou d'envoi groupé (MSG-02, écran de contrôle des
  destinataires), file `hub.jobs` avec clé d'unicité (lot 40b).
- **Purge** (ADR 0056, lot 34) : purge automatique avec préavis, exclusion motivée d'une ligne,
  orchestrée par `lib/privacy/purge.ts` à travers le contrat `privacy/v1` de chaque module ;
  durées dans `hub.privacy_settings`.
- **Chiffrement** : seulement le secret de double authentification (`packages/auth/src/secret-box.ts`,
  ADR 0037). DAT-08 (régimes, IBAN, notes confidentielles) est noté au lot 48.
- **Rôles** : titulaire (`owner`) et membre (`member`) ; pas de droit fin par membre (équipe et
  droits par évènement : lot 52).
- **Copies hors ligne** (lot 29, ADR 0064) : le jour J garde sur l'appareil programme, contacts du
  jour et documents ; aucune donnée d'invité.
- **QR code** : `qrcode` 1.5.4 calcule déjà côté serveur le QR code de la double authentification
  (ADR 0028).

## Préalable commun aux lots 46 et 49 (D0)

Le même que dans la spécification du lot 46 : une petite PR préalable, sans migration, fusionnée
avant de lancer les deux sessions :

1. **Registre des modules** : `appointments` et `guests` dans `MODULE_KEYS`, **fermés par
   défaut** (les modules existants restent ouverts par défaut) ; libellés, écran de
   l'Exploitation, `starter-kit.ts`, combinaisons de l'ADR 0062.
2. **Chiffrement de champ** : `packages/auth/src/field-box.ts`, sur le modèle de `secret-box.ts`
   (AES-256-GCM, ADR 0037), clé `DATA_ENCRYPTION_KEY` validée au démarrage, données associées
   (table, colonne, ligne).
3. **Jeton de lien partagé** : fonctions pures de `modules/events/link-tokens.ts` déplacées dans
   `packages/auth/src/link-token.ts`.

## Une seule PR

Le lot est gros, mais d'un seul tenant : la liste, la réponse, l'accord et la purge sont la même
donnée vue à quatre moments, et RGP-06 à RGP-08 doivent tenir « dès l'activation du module »
(INV-07). Le découper livrerait une liste d'invités sans sa purge, ce que le critère interdit.
Une PR, relue par parties (A à G).

## Partie A — Temps forts et liste d'invités (INV-01, RGP-18 ; D1, D2)

- **Temps forts** (D2) : une table minimale `events.key_moments` (nom, date, heure de début,
  lieu facultatif parmi les lieux de l'évènement, position), gérée depuis la fiche de
  l'évènement ; exposée par `modules/events/service.ts`. Premier pas d'EVT-04, que le lot 51
  complétera (chrono par temps fort, évènement sur plusieurs jours). Le RSVP demande la présence
  **par temps fort**.
- **Foyers et personnes** : un foyer (nom affiché, côté, groupe, langue des messages) regroupe des
  personnes ; une personne est un **adulte** (prénom, nom, e-mail, téléphone) ou un **enfant**
  (prénom, tranche d'âge, **aucun moyen de contact**, contrainte en base : RGP-18).
- **Obligatoire** : le nom de chaque personne et **un moyen de contact pour le foyer** (e-mail ou
  téléphone d'un de ses adultes) ; tout le reste est facultatif (INV-01).
- **Côté** : un des clients de l'évènement, ou « les deux » ; **groupes** : étiquettes de
  l'évènement créées à la volée (« Amis du lycée »), sans liste en dur.
- **Invités par temps fort** : par défaut, tout le foyer est invité à tous les temps forts ; la
  planner ou le client restreint (le brunch pour la famille proche).
- **Pas de contact du noyau** : les invités ne deviennent **pas** des contacts du hub (CRM-03) :
  ils appartiennent à l'évènement, sont purgés avec lui (partie F) et n'encombrent pas le
  carnet de la planner.

## Partie B — Import et saisie par le client (INV-02 ; D5, D12)

- **Import d'un tableur** (CSV, XLSX) par le moteur existant, nouvelle cible `guests` : colonnes
  reconnues (synonymes en données), aperçu, **doublons signalés avant d'écrire** (même nom et même
  e-mail ou même téléphone, dans l'évènement ou dans le fichier), formules neutralisées,
  annulation. Une colonne de régime dans le fichier est **ignorée et signalée** : seul l'invité
  donne son régime, avec son accord (réponse 3 de la DPO).
- **Saisie par le client** (D5) : nouvelle rubrique « Invités » du portail, **fermée par défaut**
  (POR-10), que la planner ouvre lien par lien ; le client y ajoute, corrige, importe et suit les
  réponses ; il ne voit jamais les régimes nominatifs (partie E).
- Le fichier importé est contrôlé comme tout envoi (type par le contenu, taille, antivirus,
  SEC-21) et purgé avec les données de l'import (`import-purge`).

## Partie C — Le RSVP : une page, une minute, sans compte (INV-03 ; D3, D4, D11, D13)

- **Le lien** (D3) : un lien personnel **par adulte qui a un moyen de contact** ; jamais pour un
  enfant. Le lien du **répondant du foyer** (le premier adulte, ou celui que la planner désigne)
  permet de répondre à la présence de tout le foyer ; chaque adulte répond pour son propre régime.
  Jeton de 256 bits haché, après « # », retiré de l'adresse, `noindex`, `no-referrer` (SEC-14,
  SEC-17) ; expiration **à la clôture des réponses** (SEC-15) ; retrait par la planner.
- **Distribution** (D4) : par e-mail depuis Symbola, au nom de la planner (et des mariés), après
  l'**écran de contrôle des destinataires** (MSG-02) ; ou **copie du lien** et **QR code
  personnel** (PNG à imprimer ou à envoyer), pour que le client l'envoie lui-même par SMS ou
  messagerie (SU-10 reçoit son lien par SMS).
- **La page** : une seule page, gros caractères (corps de 18 px au moins), cibles de 44 px,
  contraste AA, un titre par question, chaque champ étiqueté (SU-11), aucune adresse e-mail
  demandée (SU-10 abandonne sinon). Dans l'ordre :
  1. présence de chaque membre du foyer, **par temps fort** auquel il est invité (oui ou non,
     un toucher) ;
  2. **régime et allergies** de la personne du lien (et des enfants, si elle déclare être leur
     représentante légale) : cases d'une **liste fermée** (partie D), **après** la case
     d'accord ;
  3. **hébergement** et **transport** (besoin d'une chambre, d'une navette : oui ou non) si la
     planner a activé ces questions pour l'évènement (désactivées par défaut, D11) ;
  4. bouton « Envoyer ma réponse ».
- **Après l'envoi** : « Merci, votre réponse est enregistrée », le récapitulatif, et « Et
  après ? » (date de clôture, réponse modifiable jusque-là) : la phrase type de Jeanne.
- **Aucun champ libre** (D11) : pas de « message aux mariés » (réponse 3 de la DPO, RGP-04).
- **Mention d'information** (RGP-03, article 14) en tête et en pied de page, au nom de la planner
  et des mariés : qui traite, pourquoi, combien de temps, droits, **opposition** (lien
  « Je ne souhaite pas que mes données soient conservées », partie F). Texte de départ en
  données, réglable dans les réglages RGPD, à faire relire (DPO-4).
- **Clôture** (D13) : date choisie par la planner avant l'envoi des invitations (30 jours avant le
  premier temps fort, proposé) ; après elle, la page affiche les réponses en lecture et le contact
  de la planner, et le lien expire.
- **Soixante secondes** : mesurées sur l'app compilée, profil « téléphone de milieu de gamme en
  4G » du lot 40c, pour le foyer de Jeanne (deux personnes, trois temps forts, un régime).

## Partie D — Régimes et allergies : liste fermée, accord, chiffrement (INV-07, RGP-06, RGP-07 ; D6 à D8)

- **Liste fermée paramétrable** : référentiel de l'organisation, copié des données de départ
  (`dietary-options.json`, FR et EN) : régimes (végétarien, végétalien, sans gluten, sans
  lactose…) et **les quatorze allergènes à déclaration obligatoire** du règlement européen
  INCO ; la planner masque ou ajoute une entrée (libellé court) ; l'invité ne fait que cocher.
  Les régimes à caractère religieux attendent la DPO (D6, DPO-1).
- **Accord** : case **non précochée**, texte clair (usage : repas de l'évènement ; destinataires :
  la planner, le traiteur ; durée : 7 jours après l'évènement), **avant** les cases. Sans accord,
  les cases sont désactivées et rien n'est enregistré, même si la requête en contient (contrôle
  serveur). **Preuve** gardée : horodatage, version du texte, canal (« lien personnel »),
  personne, et la déclaration de représentant légal pour un enfant. **Retrait** : décocher
  l'accord efface aussitôt les régimes concernés ; la preuve garde l'horodatage du retrait.
- **Chiffrement** (D7) : la liste cochée de chaque personne est chiffrée au niveau du champ
  (préalable commun, point 2) ; la base, les sauvegardes et une copie de la base n'en montrent
  rien en clair.
- **Accès** (D8) : la **titulaire** voit les régimes nominatifs ; un **membre** de l'équipe (et le
  client au portail) voit des **nombres** par régime et par temps fort, **jamais les noms** ; un
  nombre inférieur à **3** s'affiche « moins de 3 » (seuil en données), pour ne pas dévoiler un
  régime unique dans un petit groupe (réponse 3 de la DPO). Le contrôle est côté serveur. Le droit
  délégable à un membre arrive avec les droits d'équipe (lot 52).
- **Vers le traiteur** : la synthèse et son export sont au lot 50 (INV-06) ; ce lot en fixe la
  règle : nominatif seulement pour la titulaire, agrégé ailleurs.

## Partie E — Suivi des réponses et relances (INV-04 ; D10)

- **Suivi** : par temps fort, nombre de oui, de non, d'attentes ; liste filtrable (côté, groupe,
  sans réponse) pour la planner et, s'il y a accès, le client ; la fiche de l'évènement affiche
  le nombre d'invités confirmés (EVT-03 : « nombre d'invités confirmé »).
- **Relances automatiques** (D10) : deux relances par défaut, aux dates choisies avant la
  clôture (J-21 et J-7 avant la clôture, proposé), **seulement aux foyers sans réponse** qui ont
  une adresse e-mail, par la file `hub.jobs` (clé d'unicité par foyer et par relance) ; le choix
  est revérifié **au moment de l'envoi** (une réponse arrivée entre-temps annule la relance) ;
  aucune relance après la clôture. Pour les foyers sans e-mail, la liste « à relancer à la main »
  avec le lien à copier.
- Chaque relance passe l'écran de contrôle des destinataires quand la planner la déclenche à la
  main ; les relances programmées ont été approuvées avec l'envoi des invitations (même écran,
  qui annonce le calendrier).

## Partie F — Purge des invités (RGP-08 ; D9)

- **Échéances** (horloge en heure de Paris, après le **dernier jour** de l'évènement) :
  **régimes et allergies à J+7**, le reste (foyers, personnes, réponses, liens, preuves d'accord
  hors horodatage anonymisé) **à J+30**. Durées réglables dans `hub.privacy_settings`, valeurs de
  départ en données (7 et 30), bornées par la DPO (jamais plus longues que la valeur de départ
  plus un report).
- **Préavis** de 7 jours : ligne dans « Aujourd'hui » et e-mail à la titulaire ; **un seul
  report**, motivé, de **90 jours au plus** ; le report est tracé au journal d'audit (sans donnée
  personnelle). Le gel pour litige reste à part (hors périmètre).
- **Ce que la purge efface** (critère de RGP-08) : les données du module ; les fichiers
  d'import d'invités et leurs lignes ; les **exports stockés** qui contiennent des invités de
  l'évènement (archives d'export de l'organisation du lot 35 et exports RGPD encore gardés :
  supprimées, la titulaire en est prévenue) ; les **copies hors ligne** : aucune donnée d'invité
  n'y entre dans ce lot (test qui le prouve) ; le lot 50 qui les y mettra devra les purger.
- **Opposition** d'un invité (lien de la page) : ses coordonnées et ses régimes sont effacés
  aussitôt, il ne reçoit plus rien ; la planner en est prévenue ; sa présence déjà donnée reste
  (sous son seul nom) jusqu'à la purge, sauf avis contraire de la DPO (DPO-3).
- **Évènement annulé** : la purge part de la date d'annulation (même délais).
- `privacy/v1` du module (trouver, exporter, anonymiser, effacer une personne) ; un invité qui
  demande l'effacement par la planner est effacé sans attendre la purge.

## Partie G — Activation, analyse d'impact, aide (INV-07)

- Le module est **fermé par défaut** (préalable commun). À la première ouverture, la titulaire
  voit ce que le module fait des données, le lien vers l'**analyse d'impact « socle »** (fournie
  par Julien, `docs/conformite/`, hors code) et confirme l'avoir complétée ; la confirmation est
  datée et tracée. Sans elle, aucune saisie n'est possible.
- Registre RGPD : chaque champ déclaré (`privacy.registry.yaml`), avec sa finalité, sa base et sa
  durée ; registre prérempli des planners complété (RGP-02, lot 57).
- Aide de chaque écran (planner, portail, page du RSVP) ; la page du RSVP a sa propre aide courte,
  sur l'écran même.

## Décisions à prendre

- **D0 — Le préalable commun aux lots 46 et 49.** Voir la spécification du lot 46.
  **Recommandation : (a)**, petite PR préalable.
- **D1 — Le module.** Change le schéma de la base.
  - (a) Module neuf `modules/guests`, schéma `guests`, clé `guests`, fermé par défaut.
  - (b) Invités rangés dans le module `events`.

  **Recommandation : (a).** Le modèle de données du cahier des charges en fait une app ; un
  module à part se ferme, se purge et se prouve seul.
- **D2 — Les temps forts.** Touche le schéma `events`.
  - (a) Table minimale `events.key_moments` dès ce lot, gérée sur la fiche de l'évènement ; le
    lot 51 la complète.
  - (b) Des « moments de réponse » propres au module des invités ; le lot 51 les reliera aux temps
    forts.

  **Recommandation : (a).** Le temps fort appartient à l'évènement (§ 11 du cahier des charges) ;
  le plan de table (lot 50) et le chrono (lot 51) s'y rattacheront. (b) créerait deux notions à
  fusionner ensuite. Le lot 46 ne touche pas au schéma `events` (sa D8), pas de conflit.
- **D3 — Qui a un lien.**
  - (a) Un lien par adulte qui a un moyen de contact ; le répondant du foyer répond à la présence
    de tous ; chacun donne son propre régime, et celui de ses enfants s'il se déclare représentant
    légal ; aucun lien pour un enfant.
  - (b) Un lien par foyer, qui répond à tout, régimes des autres adultes compris.

  **Recommandation : (a).** (b) contredit la réponse 3 de la DPO (l'accord vient de l'invité
  lui-même). Pour un accompagnant sans contact, le régime reste vide ; à confirmer (DPO-2).
- **D4 — Comment partent les invitations.**
  - (a) E-mail depuis Symbola après l'écran de contrôle, plus lien à copier et QR code pour un
    envoi par le client (SMS, messagerie, papier).
  - (b) Ajouter l'envoi de SMS (nouveau sous-traitant, ADR).

  **Recommandation : (a).** Aucun sous-traitant nouveau ; le QR code imprimé sur le faire-part
  est l'usage courant du métier. Le SMS pourra s'ajouter derrière l'interface d'envoi.
- **D5 — Le client dans son portail.**
  - (a) Rubrique « Invités » fermée par défaut, ouverte par la planner lien par lien : saisie,
    import, suivi ; jamais de régime nominatif.
  - (b) Seule la planner gère la liste ; le client lui envoie son tableur.

  **Recommandation : (a).** INV-02 et SC-07 (étape 1 : « Léa importe sa liste ») le demandent.
- **D6 — Les régimes à caractère religieux** (halal, casher, sans porc).
  - (a) Absents de la liste de départ tant que la DPO ne s'est pas prononcée ; la planner peut en
    ajouter, sous sa responsabilité, avec un avertissement.
  - (b) Présents dès le départ.

  **Recommandation : (a).** Ils révèlent une conviction religieuse (autre catégorie de
  l'article 9) ; le réglage protecteur par défaut (RGP-05) l'emporte en attendant la réponse
  (DPO-1). Ce point est juridique : je ne le tranche pas, je propose le défaut le plus prudent.
- **D7 — Chiffrer les régimes.**
  - (a) Chiffrement de champ du préalable commun (AES-256-GCM, clé `DATA_ENCRYPTION_KEY`), sur
    la liste cochée de chaque personne ; compteurs calculés par l'app après déchiffrement.
  - (b) Attendre le lot 48 (DAT-08 pour tous les champs sensibles).

  **Recommandation : (a).** RGP-07 l'exige « dès l'activation du module » ; le lot 48 réutilisera
  la même brique pour l'IBAN.
- **D8 — Qui voit les régimes.**
  - (a) Nominatif pour la titulaire seule ; nombres pour les membres et le client, avec le seuil
    « moins de 3 » ; droit délégable au lot 52.
  - (b) Un droit par membre dès ce lot (colonne de `hub.memberships`, écran d'équipe).

  **Recommandation : (a).** La pilote travaille seule ; (b) anticiperait le lot 52 (droits par
  membre et par évènement) en touchant le schéma `hub` pour une seule case.
- **D9 — La purge.** Touche le schéma `hub` (durées).
  - (a) Régimes à J+7, le reste à J+30 (après le dernier jour de l'évènement), préavis de
    7 jours, un report motivé de 90 jours au plus, exports stockés supprimés, durées dans
    `hub.privacy_settings` ; gel pour litige hors périmètre.
  - (b) Tout à J+30.

  **Recommandation : (a).** Ce sont les réponses 2 et 3 de la DPO ; le gel pour litige mérite
  sa propre règle (qui décide, combien de temps), à poser à la DPO avec le lot 57.
- **D10 — Les relances.**
  - (a) Deux relances par défaut (J-21 et J-7 avant la clôture), réglables (zéro à trois), aux
    seuls foyers sans réponse qui ont une adresse e-mail, revérifiées à l'envoi.
  - (b) Relances seulement à la main.

  **Recommandation : (a).** INV-04 demande des relances automatiques ; la revérification à
  l'envoi tient le critère « aucune relance vers un invité qui a répondu ».
- **D11 — Les questions du RSVP.**
  - (a) Présence par temps fort (toujours) ; régime (si la planner l'active, activé par défaut) ;
    hébergement et transport (désactivés par défaut) ; aucun champ libre.
  - (b) Toutes les questions toujours posées, plus un message libre aux mariés.

  **Recommandation : (a).** Minimisation (RGP-04, « la collecte de données dont personne n'a
  besoin » est à éviter dans PAR-07) et soixante secondes pour Jeanne.
- **D12 — Les doublons à l'import.**
  - (a) Même nom et même e-mail, ou même nom et même téléphone (après normalisation), dans
    l'évènement ou dans le fichier ; signalés à l'aperçu, rien n'est écrit avant le choix.
  - (b) Même nom seulement.

  **Recommandation : (a).** Deux « Martin » sont fréquents dans une famille ; le nom seul
  signalerait de faux doublons.
- **D13 — La clôture des réponses et l'expiration des liens.**
  - (a) Date de clôture obligatoire avant l'envoi (30 jours avant le premier temps fort,
    proposée) ; les liens expirent à cette date (SEC-15) ; la planner peut la repousser.
  - (b) Liens valables jusqu'au jour de l'évènement.

  **Recommandation : (a).** C'est l'expiration par défaut du cahier des charges pour un invité, et
  le traiteur a besoin d'un chiffre arrêté.

## Points pour la DPO

À verser dans sa fiche (question 14 ; la 13 vient du lot 46). Aucun ne bloque l'écriture du
lot ; DPO-1 et DPO-4 doivent être tranchés avant d'ouvrir le module à la pilote, avec l'analyse
d'impact.

- **DPO-1** : régimes à caractère religieux dans la liste de départ (D6) : les proposer, et à
  quelle condition ?
- **DPO-2** : accompagnant adulte sans moyen de contact : peut-on recueillir son régime par le
  répondant du foyer, avec une déclaration (« il m'a demandé de répondre pour lui ») ? Sinon, son
  régime reste vide.
- **DPO-3** : opposition d'un invité : faut-il effacer aussi sa présence déjà donnée, ou la garder
  sous son seul nom jusqu'à la purge ?
- **DPO-4** : texte de départ de la mention d'information de la page du RSVP et de l'e-mail
  d'invitation (article 14, au nom du planner et du couple) ; texte de l'accord pour les régimes.
- **DPO-5** : seuil d'agrégation des compteurs (« moins de 3 ») : suffisant ?
- **DPO-6** : suppression des archives d'export qui contiennent des invités au moment de la purge
  (partie F) : la bonne lecture de « la purge efface aussi les exports stockés » ?

## Migrations (prévision)

- **`events`** (avec ton accord, D2 ; une migration et son annulation) : `key_moments`
  (organisation, évènement, nom, date, heure, lieu, position, auteur et dates, suppression
  logique), RLS forcée.
- **`guests`** (nouveau schéma ; création, puis droits et RLS, avec leurs annulations) :
  - `event_settings` (évènement, clôture, questions activées, relances, analyse d'impact
    confirmée) ;
  - `households` (évènement, nom affiché, côté, groupe, langue, répondant) et `household_groups` ;
  - `guests` (foyer, adulte ou enfant, prénom, nom, e-mail, téléphone, tranche d'âge ; contrainte :
    un enfant n'a ni e-mail ni téléphone) ;
  - `guest_invitations` (personne, temps fort) et `rsvp_answers` (personne, temps fort, réponse,
    date, hébergement, transport) ;
  - `dietary_options` (référentiel de l'organisation, copié des données de départ) ;
  - `diets` (personne, liste chiffrée) et `diet_consents` (personne, version du texte, canal,
    accordé le, retiré le, déclaration de représentant légal) ;
  - `guest_links` (personne, empreinte du jeton, expiration, retrait, dernière ouverture) ;
  - `purge_postponements` (évènement, motif, nouvelle date, par qui).
- **`hub`** (une migration, D9) : `privacy_settings` : `guest_retention_days` (30),
  `guest_diet_retention_days` (7), `guest_purge_max_postpone_days` (90).
- Numéros : à partir de 0150 ; la deuxième PR fusionnée renumérote (voir « Travail en
  parallèle »).

## Fichiers touchés (prévision)

- `packages/db/src/schema/guests.ts` (nouveau), `events.ts` (`key_moments`), `hub.ts` ;
  migrations et annulations ; `guests-isolation.integration.test.ts`,
  `events-isolation.integration.test.ts` ; listes du test d'annulation.
- `packages/contracts/src/guests/` (contrat du service) ; `events/service-contract.ts`
  (`LINK_RUBRICS` : `guests` ; temps forts) ; `import/` (cible `guests`).
- `apps/symbola/modules/guests/` : `service.ts`, `repository.ts`, `rsvp.ts` (règles pures),
  `diets.ts` (accord, chiffrement, agrégats), `reminders.ts`, `purge.ts`, `privacy.ts`,
  `export.ts`, `import.ts`, `trash.ts`.
- `apps/symbola/modules/events/` : temps forts (`key-moments.ts`, `service.ts`, `repository.ts`).
- `apps/symbola/app/events/[id]/page.tsx` (onglet « Invités », temps forts sur la synthèse) et
  `app/events/[id]/invites/` ; `app/rsvp/` (page publique) ; `app/portail/` (rubrique
  « Invités ») ; `app/rgpd/reglages` (durées) ; `app/events/parametres` (liste des régimes).
- `lib/privacy/search.ts`, `erasure.ts`, `purge.ts` ; `lib/export/organization-export.ts` ;
  `lib/import` (profil d'import `guests`) ; `lib/rate-limit.ts` (`rsvp_answer`, `rsvp_open`) ;
  `lib/today` (préavis de purge) ; `instrumentation.ts` (relances, purge des invités).
- `packages/starter-templates/src/` : `dietary-options.json`, mention d'information et texte
  d'accord, `import-synonyms.json` (colonnes d'invités), `email-templates.json` (invitation,
  relance), `privacy-settings.json` (durées).
- `packages/i18n/src/messages/fr.json`, `en.json` : nouvel espace `Guests` à la fin ; clés
  ajoutées à `Events`, `LinkPortal`, `Privacy`, `SettingsMenu`, `Help`.
- `privacy.registry.yaml` (bloc à la fin) ; `lib/help/screens.ts` et aide ; ADR (module Invités,
  données sensibles et purge) ; `docs/gap.csv` ; bilan ; rejeu `docs/recette/SC-07.md` ;
  `docs/recette/accessibilite.md` (revue du RSVP, VoiceOver par Julien).

## Tests

- **Chaque critère devient un `it`** sous son identifiant (`INV-01` à `INV-04`, `INV-07`,
  `RGP-06` à `RGP-08`, `RGP-18`).
- **INV-01, RGP-18** : un foyer s'enregistre avec un nom et un moyen de contact, refusé sans ;
  un enfant avec e-mail ou téléphone refusé par la base même (requête directe) ; aucun lien
  ne se crée pour un enfant.
- **INV-02** : l'import de 120 lignes avec doublons les signale à l'aperçu et n'écrit rien avant
  le choix ; formule neutralisée (`=`, `+`, `-`, `@`) ; colonne de régime ignorée et signalée ;
  annulation ; le client importe depuis son portail seulement si la rubrique lui est ouverte.
- **INV-03** : réponse sans compte ; lien d'un autre évènement ou d'une autre organisation
  refusé ; lien expiré après la clôture, avec le contact de la planner ; jeton absent de
  l'adresse et des journaux ; parcours Playwright de Jeanne sous **60 s** sur l'app compilée en
  profil 4G, à 375 px ; axe WCAG 2.2 AA ; parcours au clavier seul ; arbre d'accessibilité revu
  (chaque champ étiqueté, titres par question) ; animations coupées sous
  `prefers-reduced-motion`.
- **RGP-06** : sans accord, une requête qui contient des régimes n'enregistre rien ; accord puis
  retrait : régimes effacés, preuve gardée (horodatage, version, canal) ; un adulte ne peut pas
  donner le régime d'un autre adulte ; un parent qui se déclare représentant légal donne celui de
  son enfant, sans déclaration rien n'est enregistré ; aucun champ libre dans la page (test sur le
  DOM).
- **RGP-07** : la valeur en base est chiffrée (lecture brute illisible) ; un membre et le client
  obtiennent des nombres, jamais de noms, même en appelant l'action serveur directement ; un
  régime porté par une ou deux personnes s'affiche « moins de 3 ».
- **INV-04** (horloge simulée) : relance à J-21 et J-7 avant la clôture aux seuls foyers sans
  réponse ; une réponse arrivée la veille annule la relance du lendemain ; une relance rejouée ne
  part qu'une fois ; aucune après la clôture.
- **RGP-08** (horloge simulée, en heure de Paris, veille, jour même, changement d'heure) :
  préavis à J+23 pour la purge à J+30, à J (jour du dernier temps fort) pour les régimes à J+7 ;
  régimes effacés à J+7, le reste à J+30 ; report unique, motivé, de 90 jours au plus (un second
  refusé) ; archives d'export contenant les invités supprimées ; copie hors ligne du jour J sans
  aucune donnée d'invité ; évènement annulé : délais comptés depuis l'annulation ; opposition
  traitée aussitôt.
- **Isolation et abus** : l'organisation A ne lit ni ne modifie les foyers, réponses, régimes et
  liens de B ; le lien d'un foyer ne lit pas un autre foyer du même évènement ; le client au
  portail ne voit que les invités de son évènement ; l'Admin n'accède à aucune donnée d'invité ;
  débit limité à l'ouverture et à l'envoi du RSVP ; un module fermé masque l'onglet et la rubrique
  sans erreur (ARC-07) ; module fermé → la page du RSVP répond « lien inconnu ».
- **Bout en bout** : la planner crée les temps forts et ouvre la rubrique au client ; Léa importe ;
  envoi après contrôle des destinataires (Mailpit) ; Jeanne et Antoine répondent ; suivi ;
  relance ; purge simulée. Ordinateur et 375 px.
- **Rejeu** : SC-07, étapes 1 à 5 et 7, sur le jeu fictif (mariage de référence, 120 invités
  générés, Jeanne et Antoine selon leurs fiches) ; `docs/recette/SC-07.md`. Julien passe la page du
  RSVP au lecteur d'écran (VoiceOver, liste de dix minutes du lot 40c).

## Hors périmètre

- Plan de table et synthèse pour le traiteur, avec leurs exports (INV-05, INV-06 : lot 50).
- Temps forts complets : chrono par temps fort, évènement sur plusieurs jours (EVT-04 : lot 51).
- Page de l'évènement pour les invités, hébergements et navettes, accueil par QR code
  (INV-08 à INV-10, P2).
- Envoi par SMS (D4) ; code à usage unique pour voir ou modifier ses données sensibles (SEC-16,
  lot 43, réponse 7 de la DPO).
- Droit délégable aux membres (lot 52) ; gel pour litige (à poser à la DPO avec le lot 57).
- Rédaction de l'analyse d'impact « socle » (action de Julien avec la DPO, hors code).

## Ambiguïtés relevées

- **« Un moyen de contact »** (INV-01) : lu par foyer, pas par personne (un enfant n'en a pas ; un
  conjoint peut n'en pas avoir).
- **« Lien ou QR code personnel »** : le QR code porte le même lien personnel que l'e-mail ; il
  vit le temps du lien.
- **« Purge… 30 jours après l'évènement »** : compté depuis le dernier jour de l'évènement (le
  brunch du lendemain compte).
- **« Exports stockés »** (RGP-08) : lu comme les archives et fichiers gardés par Symbola ; un
  fichier déjà téléchargé par la planner échappe à Symbola (l'écran de téléchargement le rappelle).
- **« Assistant sans ce droit »** (RGP-07) : lu comme tout membre qui n'est pas titulaire, tant
  que les droits par membre n'existent pas (lot 52).

## Travail en parallèle (lots 41, 46 et 49)

Le tableau des points communs est dans la spécification du lot 46 (même contenu). Pour ce lot :

- **Schéma `events`** : seul ce lot y touche (temps forts) pendant le travail en parallèle, si la
  D8 du lot 46 est retenue (comptes rendus dans le module Rendez-vous).
- **Schéma `hub`** : ce lot ajoute des colonnes à `privacy_settings` ; le lot 41 en ajoute à
  `organization_profiles`. Tables différentes : seuls les numéros de migration se croisent.
- **Insertion** : `Guests` à la fin de `fr.json` et `en.json` ; e-mails après
  `program_published` ; bloc du registre RGPD à la fin ; tâches périodiques à la fin du bloc de
  `instrumentation.ts` ; onglet « Invités » dans `TABS` de la fiche de l'évènement (le lot 46 n'y
  ajoute pas d'onglet).
- **Portail** : rubrique `guests` dans `LINK_RUBRICS` et son contenu ; le lot 46 ajoute les
  prochains rendez-vous à l'accueil ; la seconde PR fusionnée résout les ajouts voisins.
