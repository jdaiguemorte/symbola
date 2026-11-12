# Lot 26 — Accès des tiers par lien personnel

**Statut** : spécification validée par Julien le 12/11/2026 (« Oui, comme recommandé » : D1 à D10
en (a)). Branche `lot-26-liens-personnels` pour le 26a, partie de `lot-28c-tva-export-carnet`
(PR #101) pour que ses migrations suivent la 0108.

## Contexte

Phase 1 du plan (`docs/GAP_REPORT.md` § 7) : avec les lots 27 et 28, le lot 26 ferme le parcours du
portail (PAR-06, scénario SC-06 « Le portail des mariés et du père »). Le lot 27 (contenu du
portail) en dépend.

**Exigences** (toutes P0) : UX-11, POR-01, POR-10, SEC-14, SEC-15, SEC-17, RGP-03.
**Voisines, hors du lot** : SEC-16 (code avant une action sensible, P1, lot 43), DOC-04 (partage
d'un fichier par lien, P1, lot 37), INV-03 (lien de l'invité, P1, lot 49), PRE-04 (espace
prestataire, P1, lot 47).
**Décisions déjà prises** : Q4 (a), liens personnels pour tous les tiers ; ADR 0053, qui remplace
l'ADR 0020 au lot 26 ; Q15, aucune donnée réelle à reprendre.
**Scénarios** : SC-06 étapes 1 et 4 (les autres étapes viennent aux lots 27, 37, 43 et 55),
SC-S3 et SC-S4 (porte 1).

**Critères d'acceptation du cahier des charges** :

| ID | Critère |
| --- | --- |
| UX-11 | Client, prestataire et invité agissent par lien personnel. Ni mot de passe, ni inscription. |
| POR-01 | Le parent payeur ne voit que ce qu'on lui a ouvert. |
| POR-10 | Un nouveau document reste privé tant que le planner ne l'a pas partagé. |
| SEC-14 | Le jeton d'un événement est refusé sur un autre. |
| SEC-15 | Un lien expiré propose d'en demander un nouveau. |
| SEC-17 | Le jeton n'apparaît ni dans l'historique, ni dans les journaux. |
| RGP-03 | Aucun formulaire public sans mention d'information. |
| SC-S3 | Avec le lien d'un prestataire : budget, devis des autres, portail du client refusés. |
| SC-S4 | Lien de client expiré, puis lien d'un autre événement : refus, proposition de demander un nouveau lien, rien de révélé. |

## Constat du 12/11/2026

- **Accès des mariés par compte** (ADR 0020) : la planner invite un e-mail depuis la fiche de
  l'événement ; le marié crée un compte (`hub.users`, rôle `client`) avec un mot de passe, double
  authentification facultative (`/espace/securite`). L'invitation est un jeton
  `<organisation>.<secret>` de 256 bits, haché, valable 7 jours (`events.event_client_accesses`).
- **Ce que voit le marié** (`/espace/<id>`) : le rétroplanning (il coche ses tâches), le programme
  en variante « mariés » et son PDF, les options de prestataires que la planner a montrées (avec
  devis et RIB partagés, L11-EVT-11), le budget par catégorie (totaux, lot 28b), les devis qu'il
  doit signer (lien Documenso reconnu par l'e-mail de son compte).
- **Droits** : tout ou rien. Un parent payeur verrait tout ; le chargeur du jeu fictif laisse
  Bernard sans accès (« le payeur attend son accès propre »).
- **Prestataires et invités** : aucun accès.
- **En-têtes** : `Referrer-Policy: strict-origin-when-cross-origin` partout ; ni `noindex` ni
  `robots.txt`.
- **Information des personnes** : aucune mention sur l'espace du marié.
- **Code qui dépend des comptes des mariés** : la fiche de l'événement (inviter, retirer, état des
  accès), le pré-remplissage des signataires d'un devis (e-mails des accès), l'étape suivante
  « inviter les mariés », le fil d'activité (`event_activities.actor_user_id`), le budget et les
  options vus par le client (`hasActiveClientAccess`), le registre RGPD, le chargeur du jeu
  fictif, les tests `lot-11-prestataires`, `sec-36-suite-abus`, `client-access`, `client-budget`,
  et les tests de `@symbola/auth` qui emploient le rôle `client`.

## Découpage : deux lots, deux pull requests (décision D1)

- **26a — Le lien du client** : modèle du lien, ouverture sans jeton dans l'adresse, droits par
  personne, expiration, demande d'un nouveau lien, information des personnes, et reprise de
  l'espace des mariés (les comptes `client` disparaissent).
- **26b — Le lien du prestataire et le code à usage unique** : espace minimal du prestataire, code
  à l'ouverture en option, scénario SC-S3.

## Lot 26a — Le lien du client

### Partie A — Le lien et son jeton (UX-11, SEC-14, décisions D2 et D7)

- **Un lien = une personne, un événement, des droits.** Table `events.event_links` : public
  (`client`, `vendor`, `guest` ; seul `client` au 26a), nom et e-mail de la personne, client de
  l'événement qu'elle représente (facultatif : Bernard n'en est pas un), droits (partie B),
  expiration (partie C), haché du jeton, auteur, date de création, dernière ouverture, date de
  retrait.
- **Jeton** : 256 bits aléatoires (`randomBytes(32)`), au format `<organisation>.<secret>` de
  l'ADR 0053 ; seul le haché SHA-256 du secret est stocké. Il n'est affiché qu'une fois, à la
  création ou au renouvellement (« Copier le lien », D10), et envoyé par e-mail ; il ne se relit
  jamais ensuite.
- **Ouverture** (D2) : le lien envoyé est `https://…/lien#<jeton>`. Le jeton, dans le fragment,
  n'est jamais transmis au serveur ni au proxy. La page `/lien` le lit, l'échange par un envoi de
  formulaire (POST) contre une **session de lien**, remplace l'entrée d'historique, puis ouvre le
  portail `/portail`. Sans JavaScript : un message dit de l'activer.
- **Session de lien** (D7) : table `events.event_link_sessions` (haché, lien, dernière activité,
  échéance) ; cookie `symbola_lien` (HttpOnly, Secure, SameSite=Lax), valable 30 jours sans visite,
  jamais au-delà de l'expiration du lien. À chaque requête, le serveur revérifie le lien : retiré,
  expiré, événement perdu ou fictif, la session est refusée sur-le-champ. Un navigateur porte une
  session de lien à la fois ; ouvrir un autre lien la remplace.
- **Portée** : la session ne sert que l'événement de son lien. Tout identifiant d'événement ou
  d'objet est lu depuis le lien, jamais depuis l'adresse ; un objet d'un autre événement répond
  comme un objet inexistant (SEC-13).
- **Séparation des publics** : le cookie de lien n'ouvre aucun écran de la planner ; la session
  d'une planner n'ouvre pas le portail (`/portail` ne lit que `symbola_lien`).
- **Débit** (SEC-04) : ouverture et demande de lien limitées par adresse IP (nouvelles entrées
  `linkOpen` et `linkRenewal` de `lib/rate-limit.ts`).
- **Fiche de l'événement**, section « Accès des tiers » (remplace « Accès des mariés ») : liste des
  liens (personne, profil, ce qu'elle voit, expiration, état : actif, expiré, retiré ; dernière
  ouverture ; demande de nouveau lien), actions « Créer un lien », « Renouveler » (nouveau jeton,
  l'ancien cesse aussitôt), « Retirer », « Modifier les droits ». L'envoi compte dans le plafond
  d'e-mails (SEC-22).

### Partie B — Droits et partage (POR-01, POR-10, décision D3)

- **Rubriques** du portail, cochées par lien : Rétroplanning, Programme, Options de prestataires,
  Budget, Devis à signer. Une rubrique non cochée n'est ni affichée ni lisible (le service la
  refuse, pas seulement l'écran).
- **Budget objet par objet** : « tout le budget » ou « catégories choisies ». Avec des catégories
  choisies, la personne ne voit que ces catégories, sans total général (SC-06 : Bernard voit le
  traiteur et le lieu, ni le budget global ni les autres lignes). Table
  `events.event_link_shared_slots` (lien, catégorie).
- **Profils de départ** (données, pas code : `packages/starter-templates/src/link-profiles.json`,
  FR et EN) : « Marié(e) » (toutes les rubriques, tout le budget) et « Payeur » (Budget en
  catégories choisies, Devis à signer). Le profil ne fait que pré-cocher ; la planner ajuste.
- **Rien par défaut** : un lien sans profil n'a aucune rubrique ; une catégorie créée après coup
  n'apparaît pas à un lien en « catégories choisies » ; une option de prestataire reste masquée tant
  que la planner ne la montre pas (règle d'EVT-11, gardée) ; les devis à signer ne montrent que
  ceux où l'e-mail du lien est signataire. Les documents (lot 37) suivront la même règle.
- **Ce que voit chaque personne** : la ligne du lien, sur la fiche, résume ses rubriques et ses
  catégories. L'aperçu « vu par le client » (POR-09) vient au lot 27.

### Partie C — Expiration et nouveau lien (SEC-15, décisions D4 et D5)

- **Expiration calculée** (D4) : date choisie par la planner, sinon date de l'événement plus un
  délai propre au public (client 30 jours, prestataire 7 jours ; invité : clôture des réponses, au
  lot 49), lu dans `packages/starter-templates/src/link-expiry.json`. Le lien vaut jusqu'à la fin de
  ce jour, heure de Paris. Sans date d'événement : 180 jours après la création, recalculé dès que la
  date est posée. Un report garde donc des liens valables.
- **Lien expiré, retiré ou inconnu** : même page, qui ne révèle rien (ni nom, ni événement, ni
  organisation) et propose « Demander un nouveau lien ».
- **Demande de nouveau lien** (D5) : si le jeton correspond à un lien expiré de l'organisation (pas
  retiré), la demande est notée sur le lien (pastille sur la fiche de l'événement, ligne dans
  « Aujourd'hui ») et un e-mail prévient la planner ; elle renouvelle d'un clic. Rien n'est envoyé
  au demandeur ; la réponse est la même dans tous les cas.

### Partie D — Pages à lien (SEC-17)

- `/lien`, `/portail` et leurs sous-adresses : `X-Robots-Tag: noindex, nofollow, noarchive`,
  balise `robots` équivalente, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` ;
  `robots.txt` les écarte. Les liens sortants (signature Documenso) portent `rel="noreferrer"`.
- Le jeton n'est jamais écrit dans un journal ni dans un message d'erreur ; `check:logs` (lot 24)
  vérifie aussi les nouveaux fichiers.
- Après l'ouverture, ni l'adresse ni l'historique de l'onglet ne portent le jeton (test e2e).

### Partie E — Information des personnes (RGP-03)

- Chaque page à lien porte une mention d'information au nom de l'organisation : qui traite les
  données, pourquoi, combien de temps, comment exercer ses droits (contact de l'organisation).
- Texte de départ FR et EN dans `packages/starter-templates/` (données traduisibles), modifiable
  par la titulaire dans Paramètres. **Texte juridique à faire relire** (§ 20 du cahier des
  charges) : marqué « à adapter » à l'écran et noté dans `docs/conformite/`.

### Partie F — Reprise de l'espace des mariés (ADR 0053 § 9, décision D8)

- **Portail** : `/portail` reprend ce que montrait `/espace/<id>` (rétroplanning, programme et PDF,
  options montrées avec devis et RIB, budget par catégorie, devis à signer), filtré par les droits
  du lien. Le contenu nouveau du portail est l'affaire du lot 27.
- **Retraits** : `/espace`, `/espace/securite` et `/espace/invitation/<jeton>` disparaissent (une
  ancienne adresse mène à la page « lien non valable ») ; la garde `requireClient` devient
  `requireLink` ; `getClientAuthContext` et le rôle `client` sont retirés de `@symbola/auth`.
- **Fiche de l'événement et devis** : pré-remplissage des signataires depuis les liens « client »
  (sinon les e-mails des clients de l'événement) ; étape suivante « Créer les liens des mariés »
  quand aucun lien client n'existe.
- **Fil d'activité** : l'auteur d'une coche est le lien (nom de la personne) ;
  `event_activities.actor_link_id` rejoint `actor_user_id`, qui devient facultatif.
- **Journal** (lot 23) : `actor_kind` reçoit `link` ; ouverture, renouvellement et retrait d'un lien
  y sont inscrits (sans le jeton).
- **RGPD** : registre (nom et e-mail du lien), recherche, export et oubli dans le module events ;
  purge avec l'événement.
- **Jeu fictif** (`lib/recette/load.ts`) : liens « Marié(e) » pour Léa et Maxime, lien « Payeur »
  pour Bernard (Traiteur et Lieu de réception) ; les adresses des liens sont écrites dans le
  fichier local de recette, jamais commitées.
- **Contrats internes modifiés** (`packages/contracts`, incompatibles, validés avec cette
  spécification) : `hasActiveClientAccess`, `getClientEventView`, `setClientTaskDone`,
  `getClientVendorOptions`, `getClientBudgetView` prennent l'accès du lien au lieu d'un compte ;
  `inviteEventClient`, `acceptEventClientInvitation`, `listEventClientAccesses`,
  `revokeEventClientAccess` sont remplacés par les fonctions des liens.

### Partie G — Tests, rejeu et documents du 26a

- **Unitaires** : jeton (longueur, format, haché), calcul d'expiration avec horloge simulée (veille,
  jour même, lendemain à minuit à Paris, passage à l'heure d'été, sans date puis date posée),
  rubriques et profils, en-têtes des pages à lien.
- **Intégration** (base réelle) : jeton d'un événement refusé sur un autre ; lien d'une autre
  organisation refusé ; lien retiré qui coupe une session ouverte ; lien expiré ; Payeur limité à
  ses catégories (le service refuse le reste) ; rubrique non cochée refusée par le service ; aucun
  jeton en clair en base ; demande de nouveau lien sans effet visible pour un jeton inconnu ;
  retour arrière des migrations.
- **Abus** (CLAUDE.md § 2.11) : accès croisé entre organisations, lien d'un autre événement, lien
  expiré, cookie de lien sur un écran de la planner, session de planner sur le portail, débit
  d'ouverture et de demande.
- **E2E** (ordinateur et 375 px, axe-core) : Léa ouvre son lien sans inscription, coche une tâche ;
  le jeton a quitté l'adresse et l'historique ; Bernard ne voit que Traiteur et Lieu ; lien expiré
  puis demande ; mention d'information sur chaque page à lien ; SC-S4 réécrit dans
  `sec-36-suite-abus.spec.ts` ; liste des routes et de leurs règles d'accès
  (`access-rules.test.ts`, SEC-12) à jour.
- **Rejeu** : SC-06 étapes 1 et 4, SC-S4 (`docs/recette/SC-06.md`).
- **Documents** : avenant de l'ADR 0053 (décisions D2 à D8), ADR 0020 marqué « remplacé, retiré »,
  aide contextuelle (fiche de l'événement, portail), `docs/gap.csv` (UX-11, POR-01, POR-10, SEC-14,
  SEC-15, SEC-17, RGP-03), bilan dans ce fichier.

### Bilan du lot 26a (12/11/2026)

**Fait** (branche `lot-26-liens-personnels`, partie du 28c) :

- **Liens** : tables `events.event_links`, `event_link_shared_slots`, `event_link_sessions`
  (migration 0109, RLS forcée, horodatage et journal des suppressions) ; règles pures dans
  `modules/events/link-tokens.ts`, accès aux données dans `links-repository.ts`, orchestration
  dans `service.ts`. Jeton de 256 bits haché, format `<organisation>.<secret>`.
- **Ouverture** : `/lien#<jeton>` (D2) ; la page retire le jeton de l'adresse avant tout envoi,
  l'échange par une action serveur (débit limité : `linkOpen`, `linkRenewal`) contre le cookie
  `symbola_lien` (D7) ; `/lien` dit aussi qu'un lien ne vaut plus et propose d'en demander un
  nouveau (D5).
- **Portail** `/portail` : rubriques du lien (rétroplanning, programme et PDF, options et leurs
  fichiers, budget entier ou par catégories, devis à signer), en-tête de l'organisation
  (`/portail/logo`), mention d'information (RGP-03), « Fermer l'accès sur cet appareil ».
  `X-Robots-Tag`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `robots.txt`.
- **Fiche de l'événement** (onglet Mariés) : liste des liens (personne, état, validité, ce
  qu'elle voit, dernière ouverture, demande de nouveau lien), création avec profil, lien montré
  une fois avec « Copier le lien » (D10), modification des droits, renouvellement, retrait.
  « Aujourd'hui » : bloc « Demandes de nouveau lien ».
- **Reprise** (D8) : `/espace` retiré (redirection vers `/lien`), garde `requireLink`, rôle
  `client` retiré de `@symbola/auth` et du type `hub.role` (0111), table des invitations
  supprimée (0112) ; auteur `link` au journal (0110) et au fil d'activité ; RGPD (registre,
  recherche, export, oubli) ; comptes de mariés retirés du RGPD du hub et des statistiques de
  l'Admin ; jeu fictif : liens de Léa, Maxime (« Marié(e) ») et Bernard (« Payeur », Lieu de
  réception et Traiteur).
- **Réglages RGPD** : mention d'information modifiable (texte de départ à faire relire) ; le
  réglage des comptes de mariés inactifs n'est plus affiché (sa valeur reste en base).

**Vérifié** (en local, base `symbola_lot24`) : lint, types, frontières de modules ; registre RGPD ;
tests unitaires (app 363, dont 9 sur les règles des liens ; modèles de départ 39) ; intégration
(base 139 dont le retour arrière de 0109 à 0112, authentification 48, fichiers 12, e-mail 2,
app 480, plus 3 sur la mention d'information) ; parcours e2e complets sur l'app compilée et une
base neuve (ordinateur et 375 px, axe-core) : 205 réussis, 0 échec, 3 ignorés (SC-S3 attend le 26b) ;
Semgrep 0 alerte ; Gitleaks : aucune fuite ajoutée ; journaux du serveur sans e-mail ni téléphone ;
rejeu SC-06 étapes 1 et 4 et SC-S4 (`docs/recette/SC-06.md`, `docs/recette/SC-S2-a-S6.md`).

**Corrigé pendant les vérifications** : un second lien ouvert dans le même onglet n'était pas lu
(seul « # » changeait) ; la mention d'information renvoyait au nom de l'organisation faute
d'adresse de contact (elle donne l'e-mail de la titulaire) ; le tableau du budget du portail
défile dans sa zone à 375 px (la lecture sans défilement relève du lot 27, POR-02). Après ces
correctifs, les trois fichiers e2e touchés (`prd-evt-06`, `prd-bud-04`, `sec-36`) : 18 réussis,
2 ignorés.

**Remarques** :

- Les instantanés Drizzle d'avant (0106 à 0108) ne suivaient plus le schéma ; ceux de 0109 à 0112
  sont tirés du schéma réel (`generateDrizzleJson`).
- Le réglage « Compte d'un marié sans connexion » reste en base sans usage ; à retirer avec le
  fournisseur d'identité (lot 33) ou à réemployer pour les comptes d'équipe inactifs.
- Au déploiement d'ensemble (gel) : migrations 0109 à 0112 ; les comptes « client » du staging
  (fictifs) sont supprimés par 0111.

## Lot 26b — Le lien du prestataire et le code à usage unique

### Partie H — Lien du prestataire (UX-11, décision D9)

- Depuis un prestataire rattaché à l'événement (fiche du carnet avec e-mail), la planner crée un
  lien « prestataire » : public `vendor`, expiration 7 jours après l'événement.
- **Espace minimal** `/prestataire` : l'événement (prénoms des clients, date), les lieux, les lignes
  du programme où figure son poste (sans note interne), le contact de l'organisation. Rien d'autre :
  ni prix, ni budget, ni autre prestataire, ni portail du client. Le brief et l'espace complet
  viennent au lot 47.

### Partie I — Code à usage unique à l'ouverture (POR-01, décision D6)

- Case « Demander un code à l'ouverture » sur le lien. À l'ouverture, un code de six chiffres part
  à l'e-mail du lien ; valable dix minutes, cinq essais, débit limité ; la session de lien ne
  s'ouvre qu'après le code.
- La liste des actions sensibles de SEC-16 (signer, payer, voir le budget détaillé) est écrite
  dans l'avenant de l'ADR 0053 ; le code avant ces actions arrive avec SEC-16 (lot 43).

### Partie J — Tests, rejeu et documents du 26b

- SC-S3 dans `sec-36-suite-abus.spec.ts` (le test « à venir » du lot 24 devient actif) : avec le
  lien d'un prestataire, budget, devis des autres et portail du client répondent comme inexistants.
- Code à usage unique : expiré à dix minutes (horloge simulée), cinq essais, rejoué refusé.
- Rejeu SC-S3 ; `docs/gap.csv`, aide de l'espace prestataire, bilan.

## Migrations (numéros à partir de 0109, après les 0107 et 0108 du 28c)

| Lot | Schéma | Contenu |
| --- | --- | --- |
| 26a | `events` | `event_links`, `event_link_shared_slots`, `event_link_sessions` (RLS par organisation, index) ; `event_activities.actor_link_id`, `actor_user_id` facultatif |
| 26a | `core` | `audit_entries.actor_kind` accepte `link` |
| 26a | `hub` | texte d'information de l'organisation ; comptes `client` et leurs sessions supprimés ; valeur `client` retirée du type `role` (D8) |
| 26a | `events` | `event_client_accesses` supprimée (après la reprise du code) |
| 26b | `events` | `event_links.vendor_candidate_id`, `otp_required` ; table des codes à usage unique |

Chaque migration a son script d'annulation (`packages/db/drizzle-rollback/`), testé par
`rollback.integration.test.ts`. L'annulation recrée les structures vides : les comptes fictifs
supprimés ne reviennent pas (le staging se recharge avec le jeu fictif). Au déploiement d'ensemble
(gel) : ajouter ces migrations à la liste des gestes.

## Fichiers touchés (prévision)

- `packages/db/src/schema/{events,core,hub}.ts`, `packages/db/drizzle/01xx_*`,
  `packages/db/drizzle-rollback/01xx_*`.
- `packages/contracts/src/events/service-contract.ts`, `packages/contracts/src/audit.ts`.
- `packages/auth/src/{roles,totp}.ts` et ses tests (rôle `client` retiré).
- `packages/starter-templates/src/{link-profiles,link-expiry,link-privacy-notice}.json`.
- `apps/symbola/modules/events/{service,repository,links,privacy,privacy-erasure,import}.ts`,
  `apps/symbola/modules/budget/service.ts`, `apps/symbola/modules/quotes/service.ts`.
- `apps/symbola/lib/{auth-context,guards,link-session,rate-limit}.ts`, `apps/symbola/middleware.ts`,
  `apps/symbola/next.config.ts`, `apps/symbola/app/robots.ts`.
- `apps/symbola/app/lien/`, `apps/symbola/app/portail/` (nouveaux), `apps/symbola/app/espace/`
  (retiré), `apps/symbola/app/events/[id]/` (section des accès, étape suivante),
  `apps/symbola/app/devis/[quoteId]/signature-section.tsx`, `apps/symbola/app/parametres/`
  (texte d'information), `apps/symbola/lib/recette/load.ts`.
- `packages/i18n/src/messages/{fr,en}.json`, `privacy.registry.yaml`.
- 26b : `apps/symbola/app/prestataire/`, `apps/symbola/modules/events/link-otp.ts`.

## Hors périmètre

- Contenu du portail : trois prochaines actions, budget en trois chiffres, validations
  horodatées, aperçu « vu par le client », rappels (lot 27).
- Documents de l'événement et partage d'un fichier par lien (lot 37, DOC-04).
- Lien de l'invité et RSVP (lot 49) ; espace complet du prestataire et brief (lot 47).
- Code avant une action sensible (SEC-16, lot 43) ; paiement en ligne (lot 43).
- Contact unique (lot 36) : le lien gardera son nom et son e-mail jusque-là.
- Fournisseur d'identité (lot 33) : il ne concerne que les comptes des professionnels.

## Ambiguïtés relevées

- **« Aucun formulaire public sans mention d'information »** (RGP-03) : au 26a, les seules pages
  publiques qui recueillent des données de tiers sont les pages à lien (cocher une tâche) ; les
  formulaires de contact et de RSVP viendront avec leur mention (lots 44 et 49). Les formulaires
  de connexion des professionnels ne recueillent pas de données de tiers.
- **Historique du navigateur** (SEC-17) : le test vérifie l'adresse et l'historique de l'onglet.
  L'historique global du navigateur n'est pas observable par un test ; le fragment (D2) garde
  au moins le jeton hors de tout journal de serveur.
- **Bernard** : SC-06 lui fait déclarer un règlement (étape 5) ; au 26a, son lien ne fait que lire
  ses catégories. Le règlement déclaré vient au lot 27 ou 43.

## Décisions à prendre

- **D1 — Découpage.**
  - (a) Deux PR : 26a (lien du client, reprise de l'espace des mariés) puis 26b (prestataire, code
    à usage unique, SC-S3).
  - (b) Une seule PR.

  **Recommandation : (a).** Le 26a change trois schémas et retire les comptes des mariés ; le 26b
  s'y ajoute sans rien reprendre.

- **D2 — Où passe le jeton à l'ouverture.**
  - (a) Dans le fragment (`/lien#<jeton>`), échangé par la page contre une session ; il n'atteint
    jamais le serveur ni ses journaux, et les robots qui suivent les liens des e-mails n'ouvrent
    pas de session.
  - (b) Dans le chemin (`/lien/<jeton>`), échangé par le serveur puis redirigé : marche sans
    JavaScript, mais le jeton passe par le proxy et ses journaux, qu'il faudrait filtrer.

  **Recommandation : (a).** C'est le seul moyen de garantir « ni dans les journaux » sans régler
  Caddy ; le portail demande déjà JavaScript.

- **D3 — Droits d'un lien.**
  - (a) Rubriques cochées par lien, budget entier ou par catégories, pré-cochées par deux profils
    de départ (« Marié(e) », « Payeur »), modifiables.
  - (b) Deux profils fixes, sans réglage.

  **Recommandation : (a).** Le commanditaire d'un événement d'entreprise ou une belle-mère qui ne
  paie que la robe ne rentrent pas dans deux profils.

- **D4 — Expiration.**
  - (a) Calculée à chaque ouverture : date choisie, sinon date de l'événement plus 30 jours
    (client) ou 7 jours (prestataire), jusqu'à minuit à Paris ; sans date, 180 jours après la
    création.
  - (b) Date fixée à la création, à changer à la main après un report.

  **Recommandation : (a).** Un report ne doit pas couper le portail des mariés.

- **D5 — Demande d'un nouveau lien.**
  - (a) La demande va à la planner (pastille, ligne dans « Aujourd'hui », e-mail) ; elle renouvelle
    d'un clic ; rien n'est envoyé au demandeur.
  - (b) Un nouveau lien part tout seul à l'e-mail du lien expiré (sauf lien retiré), débit limité.

  **Recommandation : (a).** L'expiration après l'événement est voulue ; (b) la rendrait sans effet.

- **D6 — Code à usage unique.**
  - (a) Au 26b, en option à l'ouverture (POR-01) ; la liste des actions sensibles est écrite, le
    code avant ces actions vient avec SEC-16 (lot 43, avec le paiement).
  - (b) Au 26b, aussi avant le budget.

  **Recommandation : (a).** SEC-16 est P1 ; un code avant le budget gênerait Léa (« trente
  secondes ») sans protéger davantage qu'un lien personnel déjà limité à ses rubriques.

- **D7 — Durée de la session ouverte par un lien.**
  - (a) 30 jours sans visite, jamais au-delà de l'expiration du lien, coupée dès que le lien est
    retiré.
  - (b) Jusqu'à la fermeture du navigateur : il faut rouvrir l'e-mail à chaque visite.

  **Recommandation : (a).** Maxime revient deux semaines plus tard sans chercher l'e-mail ; le
  lien reste contrôlé à chaque requête.

- **D8 — Comptes des mariés existants.**
  - (a) Supprimés avec leurs sessions ; table des invitations supprimée ; rôle `client` retiré du
    code et du type `role` (migrations annulables).
  - (b) Comptes supprimés, mais valeur `client` gardée dans le type, inutilisée.

  **Recommandation : (a).** ADR 0053 § 9 ; aucune donnée réelle (Q15) ; une valeur morte finit par
  resservir par erreur.

- **D9 — Espace du prestataire au 26b.**
  - (a) Minimal : événement, date, lieux, lignes du programme où il figure, contact de
    l'organisation.
  - (b) Une page d'attente (date et contact), le reste au lot 47.

  **Recommandation : (a).** SC-S3 a besoin d'un lien qui ouvre quelque chose ; le programme par
  poste existe déjà.

- **D10 — Remise du lien.**
  - (a) E-mail envoyé par Symbola, plus « Copier le lien » affiché une seule fois (pour un SMS ou
    une messagerie).
  - (b) E-mail seulement.

  **Recommandation : (a).** Léa suit tout depuis son téléphone ; la planner choisit le canal, et le
  lien reste personnel, limité et révocable.
