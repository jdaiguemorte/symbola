# Lot 39 — Saisie sûre : rien ne se perd, ni en supprimant, ni en saisissant

**Statut** : spécification **validée par Julien le 16/11/2026** (« Je valide » : D1 à D14 en (a)),
ce qui vaut accord pour toucher les schémas `events`, `hub`, `quotes` et `budget`, et pour le texte
de mise en garde des champs libres proposé en D14. Branche `lot-39-saisie-sure`, partie de la tête
du lot 38b (PR #124).

Comme pour le lot 38 (précision de Julien du 16/11/2026) : aucune version intermédiaire n'est
déployée ni testée en staging ; le rejeu local fait la preuve du lot, et le runbook ne décrit pas
de retour arrière vers l'image d'un lot intermédiaire.

## Contexte

Aujourd'hui, une suppression est définitive dès le clic : une tâche, une ligne de budget, une
séquence du programme, un document, un contact disparaissent sans retour, et un évènement ne se
supprime pas du tout (il passe seulement « perdu » ou « annulé »). Une saisie en cours se perd si
l'onglet se ferme ou si le réseau tombe ; deux personnes qui modifient la même fiche s'écrasent
sans le savoir. Une erreur du serveur montre la page d'erreur de Next.js, sans référence pour la
retrouver dans les journaux. Les écrans vides disent « aucun… » sans proposer la suite ; aucun
écran n'a d'état d'attente.

Exigences du lot (`docs/GAP_REPORT.md`, plan des lots) :

| ID | Exigence | P | Critère d'acceptation | Écart aujourd'hui |
| --- | --- | --- | --- | --- |
| UX-07 | Annuler plutôt que confirmer | P0 | Une action réversible s'exécute tout de suite et s'annule pendant dix secondes. Une action irréversible demande une confirmation qui nomme l'objet. Corbeille de 30 jours. | Partiel : « Annuler » dix secondes pour une tâche cochée et un décalage du programme ; suppressions définitives |
| UX-08 | L'écran vide enseigne | P0 | Tout écran vide propose une action principale, un exemple et une aide de trente secondes. | Partiel : pas de composant commun |
| UX-09 | Rien ne se perd | P0 | Enregistrement automatique. Brouillon restauré après fermeture. Conflit d'édition signalé, jamais écrasé en silence. | Partiel : seul le devis en brouillon est gardé côté serveur |
| UX-10 | Les mots du métier | P0 | Vocabulaire du planner, paramétrable par type d'évènement. Aucun terme technique. Un message d'erreur dit ce qui s'est passé et comment en sortir. | Partiel : vocabulaire en place (ADR 0042, 0045) ; messages d'erreur non revus |
| UX-13 | Un seul patron | P0 | Liste, puis fiche, puis panneau latéral d'édition. Mêmes raccourcis, mêmes emplacements, mêmes libellés partout. | Partiel : panneau latéral non généralisé, raccourcis non unifiés |
| UX-15 | Immédiat | P0 | Réaction visible en moins de 100 ms. Mise à jour optimiste. Squelettes d'écran plutôt que roues d'attente. | Absent |
| HUB-12 | Recherche globale et palette de commandes | P1 | Résultats en moins de 500 ms, limités aux droits de l'utilisateur. | Partiel : recherche ⌘K en place, pas de palette d'actions |
| HUB-17 | Corbeille de 30 jours avec restauration | P1 | Un évènement supprimé se restaure avec tout son contenu. | Absent |
| DAT-03 | Suppression logique datée, puis purge réelle par tâche de fond | P0 | — | Partiel : `archived_at` sur le catalogue et le carnet ; suppressions directes ailleurs |
| RGP-04 | Minimisation : finalité documentée ; les champs libres portent une mise en garde | P0 | Le dictionnaire de données est revu à chaque nouvelle entité. | Partiel : registre vérifié en CI (36 champs libres déclarés), aucune mise en garde à l'écran |
| NFR-16 | Erreurs gérées : ni page blanche, ni message technique ; la saisie est gardée ; une référence retrouvable dans les journaux | P0 | Tests de coupure réseau et de panne de service tiers sur les parcours P0. | Partiel : `not-found.tsx` seulement ; ni `error.tsx`, ni référence |

Scénario : SC-01 étape 7 (« Elle ferme l'onglet, rouvre sur son téléphone et retrouve tout » ;
mesure : « brouillon retrouvé à l'identique »). Décisions et ADR qui s'appliquent : **Q27** (suivi
des erreurs par un nouveau service : ADR au lot 40 ; ce lot pose la référence d'erreur) ; ADR 0024
et 0056 (durées de conservation et purges RGPD) ; ADR 0033 (panneaux latéraux) ; ADR 0042 et 0045
(vocabulaire métier, par type d'évènement) ; ADR 0061 (pièces inaltérables) ; ADR 0064 (jour J
hors ligne).

## Ce qui existe aujourd'hui

- **Suppressions** : définitives (`removeEventTask`, `removeBudgetLine`, `removeProgramItem`,
  `removeEventDocument`, `deleteContacts`, `removeQuoteLine`, modèles…). Le carnet de prestataires
  et le catalogue s'archivent (`archived_at`). Un évènement ne se supprime pas : il passe « perdu »
  ou « annulé » ; seul l'essai guidé est purgé (orchestration `lib/demo-purge.ts`, module par
  module) et l'effacement RGPD retire une personne.
- **Annuler** : « Annuler » dix secondes après une tâche cochée (« Aujourd'hui », fiche) et après
  un décalage du programme. Sept écrans demandent une confirmation (`ConfirmDialog`).
- **Brouillons** : le devis en brouillon est gardé côté serveur ligne par ligne ; les autres
  formulaires (fiche, contact, notes, modèles) ne gardent rien avant l'envoi ; les valeurs saisies
  reviennent après un refus seulement là où l'écran le prévoit.
- **Erreurs** : les journaux du serveur notent le nom de l'erreur, sans donnée personnelle
  (SEC-20) ; une erreur non prévue casse la page (page d'erreur de Next.js) et la saisie est perdue.
- **Attente** : boutons désactivés pendant l'envoi ; ni `loading.tsx`, ni mise à jour optimiste.
- **Écrans vides** : une phrase par écran (« Aucun évènement »…), sans action ni exemple.
- **Recherche** : ⌘K (lot 10), limitée aux droits ; pas d'action ; délai non mesuré.
- **Panneaux** : `SidePanel` sur dix écrans (ADR 0033) ; d'autres éditent encore en place.
- **Champs libres** : 36 champs `contenu_libre` au registre, aucune mise en garde à l'écran.
- **Tâches de fond** : horaires, lancées par `instrumentation.ts` (purges des essais, des imports,
  des exports, des journaux de débit…).

## Découpage (D1)

- **39a — Rien ne se perd en supprimant** : DAT-03, HUB-17, UX-07 (suppression logique, corbeille de
  30 jours, purge réelle, « Annuler » dix secondes, confirmation qui nomme l'objet).
- **39b — Rien ne se perd en saisissant** : UX-09, NFR-16, UX-10 (enregistrement automatique,
  brouillons repris sur tout appareil, conflits d'édition, erreurs référencées, coupure réseau,
  messages d'erreur revus).
- **39c — Des écrans qui guident** : UX-08, UX-15, UX-13, HUB-12, RGP-04 (écrans vides, attente et
  mise à jour optimiste, patron unique et raccourcis, palette de commandes, mises en garde des
  champs libres).

Trois PR vers `main`, chacune avec ses migrations (39a, 39b), ses tests et son rejeu.

## Lot 39a — Rien ne se perd en supprimant

### Partie A — Suppression logique et corbeille (DAT-03, HUB-17 ; D2 à D5)

- **Ce qui va à la corbeille** (D2) : les objets qui portent du travail — un évènement avec tout son
  contenu (nouveau geste « Supprimer l'évènement »), un contact, un document d'évènement (avec ses
  versions), un modèle (devis, contrat, rétroplanning, programme, message).
- **Comment** (D3) : la suppression marque l'objet (date et auteur) ; la base le cache partout
  (listes, « Aujourd'hui », agenda, recherche, flux de calendrier, rappels, liens des tiers) ; il se
  restaure tel quel ; au bout de 30 jours, une tâche de fond le supprime pour de bon, fichiers
  compris, et le note au journal d'audit.
- **L'évènement supprimé** : tout son contenu disparaît avec lui (tâches, budget, devis en
  brouillon, documents, programme, lieux, prestataires consultés) ; ses liens personnels ne
  s'ouvrent plus ; restauré, il revient entier, liens compris s'ils ne sont pas expirés.
- **Ce qui ne se supprime pas** (D4) : un évènement qui porte une pièce légale (facture ou avoir
  émis, devis ou contrat signé) ; l'écran explique pourquoi et propose « Annuler l'évènement ».
- **Corbeille** (D5) : Paramètres › Corbeille (et un lien en bas des listes concernées) : chaque
  objet, sa date de suppression, son auteur, la date de sa purge, « Restaurer » ; « Supprimer
  définitivement » demande une confirmation qui nomme l'objet.
- **RGPD** : un objet à la corbeille reste une donnée tenue : la recherche RGPD le trouve, l'export
  le livre, l'effacement l'efface sans attendre la purge. L'export complet le livre avec sa date de
  suppression.

### Partie B — Annuler pendant dix secondes (UX-07 ; D6)

- **Les gestes réversibles** s'exécutent tout de suite, puis un bandeau « Annuler » reste dix
  secondes (même composant partout, annoncé aux lecteurs d'écran) : toute suppression (tâche,
  ligne de budget, séquence, lieu, ligne de devis, commentaire, note, et les objets de la
  corbeille), cocher une tâche et décaler le programme (déjà là), archiver un prestataire.
- **Les gestes irréversibles** (envoyer, émettre une facture, demander une signature, retirer un
  lien, supprimer définitivement) gardent une confirmation qui nomme l'objet (« Supprimer
  définitivement le contact Léa Martin ? »).

## Lot 39b — Rien ne se perd en saisissant

### Partie C — Enregistrement automatique et brouillons (UX-09 ; D7)

- **Les fiches existantes** (évènement, contact, prestataire, notes, modèles) s'enregistrent toutes
  seules, champ par champ, à la pause de frappe ou en quittant le champ ; l'écran dit « Enregistré »
  ou « Enregistrement… ».
- **Les créations inachevées** (nouvel évènement, nouveau contact, nouvelle note, devis en cours de
  saisie) gardent un brouillon côté serveur, par personne et par formulaire, repris sur tout
  appareil (« Reprendre votre brouillon du 16 novembre ? ») ; effacé à l'enregistrement, purgé au
  bout de 30 jours.
- **Le texte saisi revient** après tout refus, sur tous les formulaires (règle commune, plus écran
  par écran).

### Partie D — Conflits d'édition (UX-09 ; D8)

- Chaque fiche porte sa version (date de dernière modification). Un enregistrement fait sur une
  version dépassée est refusé : l'écran montre, champ par champ, la valeur enregistrée entre-temps
  (et par qui) et la sienne, et laisse choisir. Jamais d'écrasement silencieux.

### Partie E — Erreurs référencées et coupure réseau (NFR-16, UX-10 ; D9, D10)

- **Ni page blanche, ni message technique** : un écran d'erreur à l'image de l'app (`error.tsx` par
  zone et `global-error.tsx`), qui dit ce qui s'est passé, comment en sortir (« Réessayer »,
  « Revenir à la fiche »), et donne une **référence courte** (ex. « Réf. 7KQ2-M9XD ») ; la même
  référence est écrite au journal du serveur, avec le nom de l'erreur, jamais une donnée
  personnelle (SEC-20).
- **La saisie est gardée** : une action serveur qui échoue sans raison prévue rend l'erreur au
  formulaire (avec sa référence) au lieu de casser la page.
- **Coupure réseau** : l'écran annonce « Pas de connexion : votre saisie est gardée sur cet
  appareil », garde le texte, et propose de réessayer au retour du réseau.
- **Messages d'erreur revus** (UX-10) : sur les parcours P0, chaque message dit ce qui s'est passé
  et comment en sortir, sans terme technique.
- Le service de suivi des erreurs (Q27, NFR-27) reste au lot 40, avec son ADR.

## Lot 39c — Des écrans qui guident

### Partie F — L'écran vide enseigne (UX-08 ; D11)

- Un composant commun pour tout écran vide : l'action principale (« Créer un évènement »), un
  exemple (le mariage de référence étiqueté « Exemple » du lot 33b, quand l'écran s'y prête, ou une
  ligne d'exemple), et une aide lue en trente secondes (le texte de l'aide de l'écran, en court).
  Écrans : évènements, tâches, agenda, contacts, prestataires, devis et factures, encaissements,
  documents, modèles, corbeille.

### Partie G — Immédiat (UX-15)

- Squelettes d'écran (`loading.tsx`) sur les listes et les fiches ; mise à jour optimiste pour les
  gestes simples (cocher une tâche, choisir une option, changer un statut), défaite en cas de refus
  avec le message ; boutons « en cours » sur tout envoi. La mesure des 100 ms et des temps de
  réponse reste au lot 40b (NFR-01, NFR-02).

### Partie H — Un seul patron et la palette de commandes (UX-13, HUB-12 ; D12, D13)

- **Patron** : un relevé des écrans hors patron (liste, fiche, panneau latéral d'édition) ; ceux qui
  éditent encore en place passent au panneau ; mêmes emplacements pour « Créer », « Modifier »,
  « Supprimer ».
- **Raccourcis communs**, annoncés dans l'aide : ⌘K ou Ctrl K (rechercher et agir), N (créer, dans
  une liste), Échap (fermer le panneau), ? (aide de l'écran).
- **Palette** : ⌘K propose aussi des actions (« Créer un évènement », « Aller à Paramètres ›
  Corbeille »…), filtrées par les droits et les modules souscrits.

### Partie I — Les champs libres mettent en garde (RGP-04 ; D14)

- Sous chaque champ libre déclaré `contenu_libre` au registre, une mise en garde courte (texte à
  valider, D14) ; un test vérifie que chaque champ libre de l'écran la porte.

## Décisions à prendre

- **D1 — Le découpage.**
  - (a) Trois parties : 39a (suppressions), 39b (saisie, erreurs), 39c (écrans).
  - (b) Deux parties : 39a (suppressions et saisie), 39b (écrans).

  **Recommandation : (a).** Chaque partie a son propre schéma ou son propre risque ; la 39a touche
  presque toutes les tables et mérite sa PR.
- **D2 — Ce qui va à la corbeille.**
  - (a) Les objets qui portent du travail : évènement (avec tout son contenu), contact, document,
    modèles. Les éléments d'une fiche (tâche, ligne, séquence, lieu, commentaire, note) s'annulent
    pendant dix secondes, puis sont supprimés pour de bon, sans passer par la corbeille.
  - (b) Tout va à la corbeille, élément de fiche compris.

  **Recommandation : (a).** La corbeille reste lisible (dix objets, pas trois cents lignes) ; un
  élément de fiche se refait vite, et « Annuler » couvre la fausse manœuvre.
- **D3 — Comment une suppression se défait.**
  - (a) Suppression logique datée (DAT-03) : l'objet est marqué (date, auteur), la base le cache
    partout (RLS et requêtes), il se restaure tel quel ; purge réelle par tâche de fond au bout de
    30 jours (objets de la corbeille) ou de dix minutes (éléments d'une fiche, après « Annuler »).
  - (b) Instantané : l'objet est copié dans une table de corbeille puis supprimé ; la restauration
    le réinsère.

  **Recommandation : (a).** C'est la lettre de DAT-03 ; rien ne se recopie, les fichiers et les
  liens restent en place jusqu'à la purge, et la restauration ne peut pas « oublier » une table.
  Coût : chaque lecture des objets concernés doit écarter les supprimés (contrôlé par des tests
  qui passent en revue chaque liste, recherche, flux et export).
- **D4 — L'évènement qui porte une pièce légale.**
  - (a) Il ne se supprime pas : facture ou avoir émis, devis ou contrat signé obligent à le garder
    (conservation légale, ADR 0024 et 0061) ; l'écran propose « Annuler l'évènement ».
  - (b) Il se supprime, ses pièces légales restent seules dans l'archive comptable.

  **Recommandation : (a).** Une pièce orpheline perd son contexte, et l'archive comptable doit
  pouvoir être relue avec son évènement. Le point touche à la conservation légale : Julien peut le
  faire confirmer par l'expert-comptable.
- **D5 — Qui supprime et qui vide la corbeille.**
  - (a) Toute l'équipe supprime et restaure ce qu'elle peut modifier ; « Supprimer définitivement »
    est réservé à la titulaire.
  - (b) Toute l'équipe, y compris la suppression définitive.

  **Recommandation : (a).** Restaurer ne fait jamais de mal ; effacer pour de bon avant 30 jours
  est un geste de responsable.
- **D6 — Les gestes qui s'annulent pendant dix secondes.**
  - (a) Toute suppression, cocher une tâche, décaler le programme, archiver un prestataire ; les
    gestes irréversibles (envoyer, émettre, signer, retirer un lien, supprimer définitivement)
    gardent une confirmation qui nomme l'objet.
  - (b) Seulement les suppressions.

  **Recommandation : (a).** C'est le critère d'UX-07, et une partie existe déjà.
- **D7 — Les brouillons.**
  - (a) Côté serveur, par personne et par formulaire : repris sur tout appareil (SC-01 étape 7),
    purgés au bout de 30 jours ; les fiches existantes s'enregistrent champ par champ.
  - (b) Dans le navigateur seulement : repris sur le même appareil, pas sur le téléphone.

  **Recommandation : (a).** SC-01 ferme l'onglet sur un appareil et rouvre sur un autre. Un
  brouillon est une donnée de la personne : il entre au registre (purge 30 jours) et dans les
  recherches RGPD.
- **D8 — Les conflits d'édition.**
  - (a) Refus de l'enregistrement sur une version dépassée ; les deux valeurs montrées, champ par
    champ, au choix de la personne.
  - (b) Le dernier enregistrement gagne, avec un avertissement à l'autre personne.

  **Recommandation : (a).** C'est le critère : « jamais écrasé en silence ».
- **D9 — La référence d'erreur.**
  - (a) Une référence courte, lisible au téléphone (huit caractères sans lettres ambiguës), donnée
    à l'écran et écrite au journal du serveur.
  - (b) L'identifiant technique de Next.js (long, en hexadécimal).

  **Recommandation : (a).** La planner doit pouvoir la dicter au téléphone ; le journal fait le
  lien.
- **D10 — La coupure réseau.**
  - (a) Annoncée à l'écran, la saisie gardée sur l'appareil (puis versée aux brouillons de D7 au
    retour du réseau), « Réessayer ».
  - (b) Message d'erreur seul.

  **Recommandation : (a).** NFR-16 demande que la saisie soit gardée ; le jour J a déjà sa copie
  sur l'appareil (ADR 0064), le reste de l'app ne travaille pas hors ligne (hors du lot).
- **D11 — L'aide de trente secondes d'un écran vide.**
  - (a) Un texte court (lu en trente secondes) et le lien vers l'aide de l'écran ; l'exemple est le
    mariage de référence étiqueté (lot 33b) quand l'écran s'y prête.
  - (b) Une courte vidéo par écran.

  **Recommandation : (a).** Les vidéos se tournent et se traduisent à chaque changement d'écran ;
  le texte suit l'aide existante (lot 13).
- **D12 — La palette de commandes (HUB-12, P1).**
  - (a) Dans ce lot : ⌘K propose aussi des actions, filtrées par droits et modules.
  - (b) Plus tard.

  **Recommandation : (a).** La recherche existe ; ajouter les actions est un petit pas, et UX-13
  demande les mêmes raccourcis partout.
- **D13 — Le patron unique (UX-13).**
  - (a) Relevé des écrans hors patron, passage au panneau latéral de ceux qui éditent en place,
    raccourcis communs (⌘K, N, Échap, ?) annoncés dans l'aide.
  - (b) Seulement les raccourcis.

  **Recommandation : (a).** Le relevé borne le travail ; il sera joint à la PR 39c avant de toucher
  aux écrans.
- **D14 — La mise en garde des champs libres (RGP-04).**
  - (a) Sous chaque champ libre, un texte court, par exemple : « Ne notez ici ni donnée de santé,
    ni opinion, ni religion : ce champ peut être lu par votre équipe et exporté. » (proposition, à
    valider par Julien ou le DPO ; fichier de traduction).
  - (b) Une mise en garde par écran, en tête.

  **Recommandation : (a).** Le critère vise chaque champ libre ; le texte relève du conseil RGPD et
  n'est pas fixé sans validation.

## Migrations (prévision)

- **39a**, une par schéma touché (DAT-09), chacune avec son annulation :
  - `events` : `deleted_at`, `deleted_by` sur les évènements, les documents et les modèles de
    rétroplanning et de programme ; idem sur les éléments de fiche (tâches, lieux, séquences,
    commentaires) pour l'annulation de dix secondes ;
  - `hub` : idem sur les contacts, leurs notes et les modèles de messages ;
  - `quotes` : idem sur les modèles de devis et de contrat, et les lignes de devis ;
  - `budget` : idem sur les lignes de budget ;
  - politiques RLS : les lignes supprimées cachées par défaut, montrées seulement à la corbeille.
- **39b** : `hub` : brouillons de formulaires (personne, formulaire, contenu, date, purge 30 jours),
  sous RLS ; version des fiches (date de modification déjà présente, servie au formulaire).

## Fichiers touchés (prévision)

- `packages/db` : schémas et migrations de quatre modules, annulations, tests (isolation,
  annulation, accès Admin, lignes supprimées invisibles).
- `apps/symbola/modules/*` : suppression logique, restauration et purge dans chaque module (par son
  `service.ts`) ; orchestration de la purge des évènements dans `lib/` (comme `lib/demo-purge.ts`).
- `apps/symbola/app` : Paramètres › Corbeille, bandeau « Annuler », confirmations qui nomment,
  brouillons et indicateur d'enregistrement, écrans d'erreur, squelettes, écrans vides, palette.
- `packages/contracts`, `packages/i18n` (FR, EN), `privacy.registry.yaml` (brouillons),
  `docs/export/format-v1.md`, ADR (suppression logique et corbeille ; erreurs référencées),
  `docs/gap.csv`, runbook, aide des écrans.

## Tests

- **Chaque critère devient un `it`** sous son identifiant.
- **DAT-03, HUB-17** : un objet supprimé disparaît de chaque liste, recherche, flux, rappel et lien
  des tiers ; il se restaure tel quel ; un évènement restauré revient avec tout son contenu ; la
  purge réelle passe au bout de 30 jours (horloge simulée : veille, jour même, passage à l'heure
  d'été) et efface les fichiers ; un évènement portant une pièce légale ne se supprime pas.
- **UX-07** : « Annuler » rétablit l'élément pendant dix secondes ; après, il est purgé ; un geste
  irréversible demande une confirmation qui nomme l'objet.
- **UX-09** : un brouillon commencé sur un appareil se reprend sur un autre ; une fiche modifiée
  entre-temps refuse l'enregistrement et montre les deux valeurs.
- **NFR-16** : une panne d'un service tiers (signature, e-mail, stockage) et une coupure réseau
  laissent la saisie en place, un message clair et une référence retrouvée dans le journal (sans
  donnée personnelle) ; aucune page blanche.
- **Isolation et abus** : la corbeille et les brouillons d'une organisation ne se lisent ni ne se
  restaurent depuis une autre ; le brouillon d'une personne n'est pas lu par une autre ; l'Admin
  n'en lit aucun ; un objet supprimé n'est pas joignable par son identifiant ; un membre de
  l'équipe ne vide pas la corbeille (D5).
- **Playwright** : supprimer puis annuler, supprimer puis restaurer depuis la corbeille, brouillon
  repris, conflit, écran d'erreur avec référence, écrans vides ; ordinateur et 375 px, axe-core.
- **Rejeu** : SC-01 étape 7 (brouillon retrouvé à l'identique sur un autre appareil) ; une fausse
  manœuvre sur le mariage de référence (supprimer une tâche, annuler ; supprimer un document,
  restaurer depuis la corbeille).

## Hors périmètre

- Service de suivi des erreurs (Q27, NFR-27) et mesures de performance (NFR-01, NFR-02) : lot 40.
- Travail hors ligne du reste de l'app (seul le jour J est hors ligne, ADR 0064).
- Historique complet des modifications d'une fiche (au-delà du conflit d'édition).

## Ambiguïtés relevées

- **HUB-17 (P1) et DAT-03 (P0)** : la corbeille est P1, la suppression logique P0 ; le lot fait les
  deux d'un même geste (D3).
- **« Un évènement supprimé »** (HUB-17) : on ne supprime pas d'évènement aujourd'hui ; le lot en
  crée le geste, borné par la conservation légale (D4).
- **« Une aide de trente secondes »** (UX-08) : lue comme un texte court, pas une vidéo (D11).
- **SC-01 étape 7** traverse deux appareils : un brouillon dans le navigateur ne suffit pas (D7).
- **Corbeille et RGPD** : une donnée à la corbeille reste tenue (recherche, export, effacement
  immédiat) ; la purge à 30 jours s'ajoute aux durées de l'ADR 0024 sans les raccourcir.
- **UX-13** : « mêmes raccourcis » n'est pas détaillé par le cahier des charges ; la liste proposée
  (⌘K, N, Échap, ?) est à valider avec D13.

## Bilan du lot 39a (17/11/2026)

**Fait** (ADR 0073) :
- Migrations 0144 à 0147, une par schéma, chacune annulable (refusée tant qu'une ligne est à la
  corbeille) : `deleted_at` et `deleted_by` sur dix-sept tables ; politiques RLS restrictives qui
  cachent une ligne supprimée (`soft_delete_visibility`) et le contenu d'un évènement supprimé
  (`event_visibility`, et celles des tâches, documents, contacts et lignes de budget).
- Voir la corbeille est un acte explicite (`includingDeleted`) : suppression, restauration, purge,
  liste de la corbeille, demandes RGPD (recherche, export, effacement) et export complet.
- Suppression logique dans chaque module (`trash.ts`), orchestrée par `lib/trash.ts` ; purge
  horaire (éléments après dix minutes, corbeille après 30 jours, fichiers compris).
- « Annuler » pendant dix secondes sur tout l'écran (cookie de courte durée, sans libellé) pour
  toute suppression et l'archivage d'un prestataire ; plus de fenêtre de confirmation pour un geste
  réversible (modèles, prestataire).
- Paramètres › Corbeille : restaurer (toute l'équipe), supprimer définitivement (la titulaire, avec
  une confirmation qui nomme l'objet).
- Nouveaux gestes : « Supprimer l'évènement » (refusé s'il porte une pièce à conserver, D4) et
  « Supprimer le contact » (refusé s'il est client d'un évènement ou titulaire d'un lien).

**Preuves** :
- base : `soft-delete.integration.test.ts` (6 cas) et annulations (`rollback.integration.test.ts`) ;
- app : `lib/trash.integration.test.ts` (10 cas, dont horloge simulée et abus : autre organisation,
  lien personnel d'un évènement à la corbeille, commentaire d'un autre auteur) ;
- parcours : `e2e/hub-17-ux-07-corbeille.spec.ts` (ordinateur et 375 px, axe-core), parcours des
  lots 20, 21 et 38b adaptés ;
- chaîne : unitaires app 529, intégration app 719 et base 195, suite e2e complète 315 réussis et 3
  ignorés, Semgrep et Gitleaks sans
  alerte sur les fichiers du lot, registre RGPD à jour, frontières de modules respectées ;
- rejeu : `docs/recette/HUB-17.md` (tâche annulée, document et évènement restaurés).

**Reste** : 39b (brouillons, conflits d'édition, erreurs référencées, coupure réseau) et 39c (écrans
vides, attente, patron, palette, mises en garde des champs libres). Au journal d'activité, une mise
à la corbeille paraît comme une modification de la ligne (`deleted_at`) ; la purge, comme une
suppression.
