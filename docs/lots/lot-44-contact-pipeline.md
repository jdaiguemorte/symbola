# Lot 44 — Formulaire de contact et pipeline en colonnes

**Statut** : spécification proposée le 18/11/2026, **validée par Julien le 18/11/2026** : toutes les décisions retenues dans leur option recommandée (a), préalable commun et élargissement de la contrainte des natures d'e-mails du `hub` compris (accord donné). Le lot change le
schéma `events` (tables et une colonne) et la contrainte des natures d'e-mails du schéma `hub`
(D7) : validation explicite requise (CLAUDE.md § 8). Aucune dépendance nouvelle.

Branche `lot-44-contact-pipeline`, partie de `main` (2649e8d, après la PR #134). Aucune version
intermédiaire n'est déployée (gel des déploiements) : le lot se rejoue en local.

Ce lot avance **en parallèle des lots 47 et 50** ; il partage avec le lot 50 un **préalable
commun** (D0) : voir la section dédiée et « Travail en parallèle » à la fin.

## Contexte

Une demande de mariage arrive aujourd'hui par e-mail, téléphone ou message sur les réseaux.
Camille la recopie à la main dans Symbola (SC-02, version MVP : « Camille saisit le prospect »).
Le cahier des charges prévoit qu'en V1 **le formulaire crée le prospect** (SC-02, départ ; PAR-02,
étape 1) et que les prospects avancent dans un **pipeline en colonnes** dont les étapes sont
réglables (CRM-02).

Exigences du lot (§ 8, domaine CRM) :

- **CRM-01** (P1) — Formulaire de contact intégrable au site du planner ou partagé par lien. Il
  crée un prospect avec date, lieu, budget, nombre d'invités et source. *Critère* : protection
  anti-spam sans captcha visible ; mention d'information affichée (RGP-03).
- **CRM-02** (P1) — Pipeline en colonnes aux étapes paramétrables. Glisser-déposer. Motif de perte
  demandé. *Critère* : le déplacement d'une carte se fait aussi au clavier.

Parcours et scénario : PAR-02 (étape 1, « La demande crée un prospect. La disponibilité de la date
s'affiche aussitôt »), SC-02 (départ, variante V1). Personas SU-01 (Camille) et SU-05 (Léa).

## Ce qui existe aujourd'hui

- **Prospect = évènement au statut « Option »** (EVT-05, lot 34a, ADR 0055) : date, nombre
  d'invités estimé, budget souhaité, type d'évènement, lieux (`events.event_places`), source
  obligatoire (`events.prospect_sources`, PRD-EVT-07), motif de perte (`events.loss_reasons`)
  demandé à l'annulation.
- **Statuts fixes** du cycle de vie : Option, Confirmé, En préparation, Clôturé, Reporté, Annulé.
  Ils ne sont pas paramétrables, et ne doivent pas le devenir (ADR 0055).
- **Contrôle de disponibilité** de la date (CRM-04, Conforme, lot 32b) :
  `app/events/same-day-notice.tsx`, `lib/portfolio/portfolio.ts`.
- **Fiche contact unique** du hub (CRM-03, lot 36a) : `hub.contacts`, `modules/hub/contacts.ts` ;
  les clients d'un évènement y sont reliés.
- **Formulaires publics protégés** : piège à robots (`lib/honeypot.ts`, lot 24b) et limitation de
  débit (`lib/rate-limit.ts`, ADR 0044). Le lot 46 en fait autant pour sa page de réservation
  publique (`/reserver/<adresse>`, sa D11).
- **Glisser-déposer sans dépendance** : `app/events/parametres/sortable-budget-lines.tsx` (lot 13)
  — souris, plus « Monter » / « Descendre » pour le clavier et le doigt, déplacement annoncé.
- **En-têtes** : `X-Frame-Options: DENY` (`next.config.ts`) et `frame-ancestors 'none'`
  (`middleware.ts`) sur toutes les pages. Aucune page ne peut être affichée dans un cadre.
- **E-mails** : natures fermées par la contrainte `hub.email_templates_kind_check` (élargie par
  les lots 46 et 49) ; modèles dans `email-templates.json`.

Rien n'existe pour : le formulaire public, sa page de réglages, les étapes du pipeline, la vue en
colonnes.

## Préalable commun aux lots 44 et 50 (D0)

Les deux lots ont besoin de la même interaction : **déplacer un élément vers un groupe** (une carte
vers une colonne, un invité vers une table), au clavier, au doigt et à la souris.

Proposition : un petit composant commun `app/ui/move-to-group.tsx`, écrit **avant** les deux lots,
dans une PR à part (comme le socle des lots 46 et 49) :

- un bouton « Déplacer » sur chaque élément ouvre la liste des groupes (menu accessible) ; le choix
  déplace et **annonce** le résultat (`aria-live`) ; le focus revient sur l'élément déplacé ;
- à la souris, le glisser-déposer HTML natif fait la même chose (le HTML ne marche pas au doigt :
  le bouton reste la voie du téléphone) ;
- le serveur fait foi : les déplacements s'enregistrent l'un après l'autre (modèle de
  `sortable-budget-lines.tsx`) ;
- tests du composant (clavier, annonce, ordre des enregistrements) et axe-core.

Aucune dépendance. Sans ce préalable (D0 b), chaque lot écrit le sien et l'un des deux devra être
repris.

## Une seule PR

Le lot tient en une PR : deux exigences d'un même domaine, un seul module touché en profondeur
(`events`). Le préalable D0 est une PR à part, commune aux lots 44 et 50, comme le socle des lots
46 et 49.

## Partie A — Le formulaire public (CRM-01 ; D1 à D6)

- **Adresse** (D2) : `/contact/<adresse>` ; adresse choisie par la planner, unique, modifiable
  (l'ancienne cesse de répondre), proposée à partir du nom de l'organisation. Même règle que la
  page de réservation du lot 46 (sa D11).
- **Champs** (D3) : prénom et nom ; e-mail ; téléphone ; date souhaitée **ou** période (« au
  printemps 2028 », texte court) ; lieu ou ville ; budget (montant ou tranche) ; nombre d'invités ;
  type d'évènement (liste de l'organisation) ; « Comment m'avez-vous connue ? » (sources de
  prospect de l'organisation) ; message. Obligatoires : le nom, et l'e-mail **ou** le téléphone.
  La planner masque les champs facultatifs qu'elle ne veut pas ; elle n'en ajoute pas (hors
  périmètre). Libellés et aides en français et en anglais, selon la langue du navigateur.
- **Mention d'information** (RGP-03) : affichée **avant** le bouton d'envoi. Responsable du
  traitement : l'organisation (nom, adresse) ; finalité : répondre à la demande et préparer
  l'évènement ; durée : celle des prospects de l'organisation (`prospectRetentionMonths`, déjà
  réglable) ; droits et contact ; lien vers la politique de confidentialité de la planner. Texte de
  départ dans les données (`contact-form.json`, FR et EN), relu par l'avocat (AV-4). Le formulaire
  ne s'ouvre pas tant que l'adresse de la politique de confidentialité n'est pas renseignée.
- **Anti-spam sans captcha visible** (D4) : piège à robots existant ; délai minimal de remplissage
  (horodatage signé dans le formulaire, refus sous 3 secondes) ; limitation de débit par adresse
  IP (hachée) et par organisation ; plus de deux liens dans le message = envoi mis de côté (« à
  vérifier »), pas refusé. Rien d'envoyé à un service extérieur. Un envoi refusé reçoit la même
  réponse qu'un envoi réussi (le robot n'apprend rien).
- **À l'envoi** (D5) :
  - le contact est retrouvé dans le hub par son e-mail exact (sans tenir compte des majuscules),
    sinon créé ; un contact existant n'est **jamais modifié** par le formulaire : les valeurs
    reçues vont dans la demande, pas dans la fiche (CRM-03 ; la fusion des doublons est au lot 45) ;
  - l'évènement est créé au statut **Option**, à la **première étape** du pipeline, avec la source
    choisie (ou la source « Formulaire de contact » des données de départ si le champ est masqué
    ou laissé vide), la date, le lieu, le budget, le nombre d'invités et le type ;
  - le message et la période vont dans une **demande** rattachée à l'évènement (texte affiché tel
    quel, jamais interprété) ;
  - un évènement `events.prospect.received` est publié (`domain_events`), sans donnée personnelle.
- **Côté prospect** (D6) : une page de confirmation, rien d'autre. **Aucun e-mail automatique** vers
  l'adresse saisie : un formulaire public qui envoie des e-mails à n'importe quelle adresse sert de
  relais aux robots. La réponse part de la planner (modèles de réponse au lot 45).
- **Côté planner** : la demande apparaît dans « Aujourd'hui » (« Nouvelle demande : Léa M., 12 juin
  2027 ») avec le contrôle de disponibilité de la date (CRM-04, déjà là) ; un e-mail
  « Nouvelle demande de contact » part à la titulaire (réglable : activé par défaut), sans le
  message ni les coordonnées du prospect (lien vers la fiche seulement, SEC-20).
- **Intégration au site** (D1) : la planner déclare les adresses de son site (une à cinq, en
  `https://`) ; la page `/contact/<adresse>/cadre` les accepte comme parents
  (`frame-ancestors` de cette seule page) ; partout ailleurs, `DENY` reste. Symbola donne le code à
  copier (`<iframe>` avec titre et hauteur) et l'aperçu. Sans adresse déclarée, seul le lien marche.
- **Module** : le formulaire appartient au module `events` (le prospect est un évènement) ; il
  n'existe pas de module CRM à part (D8).

## Partie B — Le pipeline en colonnes (CRM-02 ; D9 à D11)

- **Étapes** (D9) : liste de l'organisation, copiée des données de départ
  (`pipeline-stages.json`, FR et EN : « Nouvelle demande », « Premier échange », « Rendez-vous »,
  « Devis envoyé »). La planner renomme, ajoute, retire (une étape non vide se vide d'abord, ou ses
  cartes passent à une autre étape choisie), réordonne. Entre une et dix étapes.
- **Ce qu'est une étape** : la position d'un évènement **au statut Option** dans la démarche
  commerciale. Les statuts du cycle de vie ne changent pas (ADR 0055) : le pipeline ne montre que
  les options, et ses deux sorties sont des **statuts** :
  - déposer une carte sur « Gagné » **confirme** l'évènement (passage à Confirmé, EVT-05, avec ses
    effets actuels : rétroplanning, etc.) après un écran de confirmation ;
  - déposer sur « Perdu » **annule** l'évènement avec son **motif de perte obligatoire** (liste de
    l'organisation, déjà là) et une note facultative.
- **Vue** : `/events/pipeline`, une colonne par étape, plus les deux sorties. Carte : nom du
  prospect, date (ou période), nombre d'invités, budget, source, ancienneté dans l'étape, alerte
  de disponibilité si la date est déjà prise. La liste actuelle des évènements reste ; un lien
  passe de l'une à l'autre.
- **Déplacer** : composant commun (D0) : bouton « Déplacer » et menu des étapes (clavier, doigt),
  glisser-déposer à la souris. Chaque déplacement est annoncé et entre dans l'historique de
  l'évènement (`event_activities` : « Passé à l'étape Rendez-vous », auteur, date).
- **375 px** (D10) : une étape à la fois (onglets des étapes avec le nombre de cartes), cartes en
  liste ; le menu « Déplacer » sert au doigt.
- **Ordre dans une colonne** (D11) : par date de dernière activité, la plus ancienne en haut (ce
  qui attend le plus) ; pas de tri à la main.
- **Données fictives** : les évènements `is_demo` apparaissent dans le pipeline de l'essai guidé,
  jamais dans les statistiques (règle existante).

## Partie C — Réglages, aide, droits

- **Réglages** `/events/parametres/contact` : activer le formulaire, adresse, champs masqués, adresse
  de la politique de confidentialité, sites autorisés (cadre), e-mail de nouvelle demande. Réservé
  à la titulaire ; un membre voit le pipeline et déplace les cartes (comme il modifie un évènement
  aujourd'hui).
- **Étapes** : `/events/parametres/etapes`, même règle (données de l'organisation, HUB-20).
- **Aide contextuelle** : deux articles (« Mettre le formulaire sur votre site », « Suivre vos
  demandes en colonnes ») et les textes des écrans, en français et en anglais.
- **RGPD** : la demande (message, période) entre dans le registre (`privacy.registry.yaml`) et dans
  `privacy/v1` du module `events` (trouver, exporter, anonymiser, effacer) ; elle suit la durée des
  prospects ; une demande « à vérifier » non traitée est effacée après 30 jours (réglage en
  données).

## Décisions à prendre

- **D0 — Le préalable commun aux lots 44 et 50.**
  - (a) Petite PR préalable : composant `move-to-group` dans `app/ui`, avant les deux lots.
  - (b) Chaque lot écrit le sien ; on les réunit plus tard.

  **Recommandation : (a).** Même interaction, mêmes exigences d'accessibilité (clavier, annonce,
  doigt) ; deux versions divergeraient. Le préalable tient en une demi-journée.
- **D1 — L'intégration dans le site de la planner.** Touche la politique de sécurité des en-têtes.
  - (a) Cadre accepté **seulement** sur `/contact/<adresse>/cadre`, pour les sites déclarés par la
    planner ; `DENY` partout ailleurs.
  - (b) Cadre accepté depuis n'importe quel site sur cette page.
  - (c) Pas de cadre : un lien ou un bouton vers la page Symbola.

  **Recommandation : (a).** C'est le sens de « intégrable » ; (b) ouvre la page à n'importe quel
  site pour un gain nul ; (c) ne tient pas CRM-01. La page encadrée n'a ni session ni bouton
  sensible : le risque de détournement de clic est faible, mais la liste fermée le réduit encore.
- **D2 — L'adresse publique.**
  - (a) Adresse choisie par la planner, comme la page de réservation du lot 46.
  - (b) Identifiant aléatoire.

  **Recommandation : (a)**, pour la même raison qu'au lot 46 (adresse donnée sur un site, une carte,
  un réseau). Une adresse commune aux deux pages viendra quand le hub portera un « nom public » de
  l'organisation (hors périmètre).
- **D3 — Les champs.**
  - (a) Liste fixe tirée de CRM-01, champs facultatifs masquables.
  - (b) Champs personnalisés en plus.

  **Recommandation : (a).** CRM-01 nomme les champs ; les questions sur mesure relèvent des
  questionnaires (CRM-09, lot 45).
- **D4 — L'anti-spam.**
  - (a) Local : piège à robots, délai minimal signé, limitation de débit, message à liens mis de
    côté.
  - (b) Service de vérification invisible (Turnstile, hCaptcha) : nouveau sous-traitant, données
    envoyées à un tiers, ADR.

  **Recommandation : (a).** Pas de sous-traitant ni de traceur sur le site de la planner ; si le
  spam passe quand même, (b) pourra s'ajouter derrière une interface.
- **D5 — Un contact qui existe déjà.**
  - (a) Retrouvé par e-mail exact ; la demande s'y rattache ; sa fiche n'est jamais modifiée par le
    formulaire.
  - (b) Toujours un contact neuf ; la fusion au lot 45.

  **Recommandation : (a).** CRM-03 (P0) : « un contact n'existe qu'une fois ». Ne rien écraser
  empêche quiconque de modifier une fiche en tapant l'adresse d'un autre.
- **D6 — Un e-mail au prospect.**
  - (a) Non : page de confirmation seulement.
  - (b) Oui, un accusé de réception au texte fixe.

  **Recommandation : (a).** (b) fait de Symbola un relais d'envoi vers des adresses tapées par
  n'importe qui (réputation du domaine d'envoi, plaintes).
- **D7 — L'e-mail à la planner.** Touche le schéma `hub` (contrainte des natures d'e-mails).
  - (a) Nouvelle nature `prospect_form_received`, activée par défaut, désactivable ; contrainte
    `hub.email_templates_kind_check` élargie par une migration `hub` à part, annulable.
  - (b) Pas d'e-mail : « Aujourd'hui » seulement.

  **Recommandation : (a).** Une demande du dimanche soir doit se voir le lundi sans ouvrir Symbola.
  C'est la troisième fois qu'un lot élargit cette contrainte (46, 49) : même méthode, accord
  demandé.
- **D8 — Où vit le formulaire.**
  - (a) Dans le module `events` : le prospect est un évènement au statut Option.
  - (b) Un module `crm` neuf.

  **Recommandation : (a).** Sources, motifs de perte et prospects y sont déjà ; un module neuf
  devrait lire et écrire les évènements par le service, pour rien. Le contact passe par le service
  du hub.
- **D9 — Les étapes et les statuts.**
  - (a) Étapes paramétrables **à l'intérieur** du statut Option ; « Gagné » et « Perdu » sont les
    statuts Confirmé et Annulé.
  - (b) Les étapes remplacent les statuts.

  **Recommandation : (a).** Les statuts portent des règles (rétroplanning, facturation, purge,
  ADR 0055) ; une étape n'est qu'un repère commercial.
- **D10 — Le pipeline sur téléphone.**
  - (a) Une étape à la fois, onglets avec nombres, menu « Déplacer ».
  - (b) Colonnes défilant à l'horizontale.

  **Recommandation : (a).** Le défilement horizontal est refusé ailleurs (NFR-19, UX-05).
- **D11 — L'ordre des cartes.**
  - (a) Par dernière activité, la plus ancienne en haut.
  - (b) Ordre à la main.

  **Recommandation : (a).** Ce qui attend le plus se voit d'abord ; l'ordre à la main se perd dès
  qu'une carte bouge.

## Points pour les conseils

**Avocat** (question suivante de sa fiche, numéro donné à la fusion : les lots 41 et 46 prennent 14 à 16) :

- **AV-4** — Le texte de départ de la mention d'information du formulaire (RGP-03) : la planner est
  responsable du traitement, Symbola sous-traitant ; le texte suffit-il, ou faut-il une case à
  cocher (consentement) pour une simple demande de contact ? Recommandation de travail : mention
  sans case (la base est la demande de la personne, mesures précontractuelles).
- **AV-5** — Un formulaire encadré dans le site de la planner : faut-il mentionner Symbola
  (sous-traitant) dans la mention, ou la politique de la planner suffit-elle ?

**DPO** : rien de nouveau (prospects déjà au registre ; durée déjà réglable). La demande « à
vérifier » effacée à 30 jours est notée dans le registre.

## Migrations (prévision)

Numérotation : le lot part du premier numéro libre de `main` au moment de son code (0159 si le lot
46 est fusionné avant). La PR fusionnée en second **renumérote** les siennes **et** leur donne une
date (`when` du journal) postérieure à la dernière de `main` : le migrateur de Drizzle n'applique
pas une migration plus ancienne que la dernière appliquée.

- **`events`** (une migration et son annulation) :
  - `pipeline_stages` (organisation, libellé, position) ;
  - `events.pipeline_stage_id` (facultatif, renseigné pour une option) ;
  - `contact_forms` (organisation unique, active, adresse publique unique, champs masqués,
    adresse de la politique, sites autorisés, e-mail à la titulaire) ;
  - `prospect_requests` (évènement, message, période, budget en tranche, état « à vérifier »,
    reçue le) ;
  - RLS et index sur `organization_id` pour chaque table ; droits du rôle applicatif.
- **`hub`** (une migration à part et son annulation) : contrainte
  `email_templates_kind_check` élargie à `prospect_form_received` (D7), avec la réunion des
  natures alors présentes sur `main`.
- Données de départ : `pipeline-stages.json`, `contact-form.json`, source « Formulaire de contact »
  ajoutée à `prospect-sources.json` (et sa variante agence).

## Fichiers touchés (prévision)

- `packages/db/src/schema/events.ts`, `packages/db/src/schema/hub.ts` (contrainte),
  `packages/db/drizzle/`, `packages/db/drizzle-rollback/`.
- `apps/symbola/modules/events/` : `contact-form.ts`, `pipeline.ts`, `service.ts`, `repository.ts`,
  `privacy.ts` ; tests d'intégration.
- `apps/symbola/app/contact/[adresse]/` (page publique et `cadre`), `app/events/pipeline/`,
  `app/events/parametres/contact/`, `app/events/parametres/etapes/`, `app/accueil` (« Aujourd'hui » : la demande).
- `apps/symbola/middleware.ts` et `next.config.ts` : `frame-ancestors` pour la seule page encadrée.
- `packages/contracts` : schéma de `events.prospect.received` v1.
- `packages/starter-templates/src/` : `pipeline-stages.json`, `contact-form.json`,
  `prospect-sources*.json`, `email-templates.json`.
- `packages/i18n/src/messages/fr.json` et `en.json` ; centre d'aide ; `privacy.registry.yaml`.
- `docs/gap.csv` (CRM-01, CRM-02), ADR 0084, `docs/recette/SC-02.md` (variante V1).

## Tests

Chaque critère devient un test ; les `describe` portent l'identifiant.

- **CRM-01** (intégration) : un envoi crée l'évènement Option à la première étape, avec date,
  lieu, budget, invités, source ; le contact existant est retrouvé par e-mail et sa fiche n'est pas
  modifiée ; nom et e-mail **ou** téléphone obligatoires ; champ masqué ignoré même si la requête
  l'envoie ; message gardé tel quel (balises affichées en texte).
- **Anti-spam** : piège rempli, envoi en moins de 3 s, horodatage falsifié, débit dépassé : rien
  n'est créé et la réponse est identique à un succès ; message à trois liens : demande « à
  vérifier ».
- **Mention** (RGP-03) : affichée avant le bouton ; formulaire fermé sans politique de
  confidentialité.
- **Cadre** (D1) : `/contact/<adresse>/cadre` porte `frame-ancestors` avec les seuls sites
  déclarés ; `/contact/<adresse>` et toute autre page gardent `DENY` (test des en-têtes).
- **Abus et isolation** (SEC-36) : l'adresse d'une organisation ne crée rien dans une autre ; une
  organisation A ne lit ni ne déplace les cartes de B ; une adresse désactivée ou ancienne répond
  « introuvable », comme une adresse inconnue ; l'Admin ne voit aucune demande ; journaux sans
  e-mail ni téléphone (SEC-20).
- **CRM-02** (intégration) : réglage des étapes (ajout, renommage, ordre, retrait d'une étape non
  vide refusé sans destination) ; « Gagné » confirme ; « Perdu » exige le motif ; historique du
  déplacement.
- **CRM-02** (Playwright, ordinateur et 375 px, axe-core) : une carte déplacée **au clavier seul**
  (bouton, menu, annonce, focus revenu) ; glisser-déposer à la souris ; à 375 px, une étape à la
  fois, sans défilement horizontal.
- **Parcours** (Playwright) : un prospect remplit le formulaire, la demande apparaît dans
  « Aujourd'hui » avec l'alerte de date prise ; la carte avance jusqu'à « Gagné ».
- **Rejeu** : SC-02, variante V1 (« le formulaire crée le prospect »), sur le jeu fictif ;
  `docs/recette/SC-02.md` complété.

## Hors périmètre

- Champs personnalisés, questionnaires (CRM-09, lot 45) ; modèles de réponse et relances des
  prospects (CRM-05, CRM-06, lot 45) ; détection et fusion des doublons (CRM-07, lot 45).
- Taux de conversion par source (CRM-08, lot 56).
- Accusé de réception au prospect (D6) ; SMS.
- Adresse publique commune au formulaire et à la page de réservation (D2).
- Encadrement de la page de réservation du lot 46 (même méthode, à décider après ce lot).

## Ambiguïtés relevées

- CRM-01 dit « date » ; beaucoup de demandes n'ont qu'une période. La spécification garde la date
  (champ `event_date`) **ou** une période en texte court dans la demande.
- CRM-02 dit « motif de perte demandé » : la spécification le rend **obligatoire** au passage à
  « Perdu », comme à l'annulation aujourd'hui.
- « Budget » : montant ou tranche ; la tranche reste dans la demande, seul un montant va dans
  `wanted_budget_cents`.

## Travail en parallèle (lots 44, 47 et 50)

- **Avec le lot 47** : les deux touchent `packages/db/src/schema/events.ts` (tables différentes) et
  la contrainte des natures d'e-mails du hub. Conflits attendus, sans recouvrement : le fichier de
  schéma, le journal des migrations, les traductions. La PR fusionnée en second renumérote ses
  migrations (avec leur date) et réunit les listes de natures.
- **Avec le lot 50** : préalable commun D0 (composant `move-to-group`) ; aucun schéma partagé.
- **Avec le lot 46** (PR #135, presque prête) : rien de commun dans le code ; le lot 44 reprend sa
  règle d'adresse publique.
