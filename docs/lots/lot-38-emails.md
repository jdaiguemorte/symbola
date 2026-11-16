# Lot 38 — Les e-mails à l'image de l'organisation, les modèles de messages et les flux de calendrier

**Statut** : spécification **à valider par Julien** (décisions D1 à D12 ci-dessous). Le lot touche
les schémas `hub` et `events` et les parcours P0 des liens, des signatures et du programme : il
attend la validation avant le code (CLAUDE.md § 8). Branche `lot-38-emails`, partie de `main` après
le lot 37b (PR #122).

## Contexte

Les e-mails que Symbola envoie au nom de la planner sont aujourd'hui du texte brut, signé
« L'équipe Symbola », écrit en dur dans les services en français et en anglais. Rien ne dit
qu'ils viennent d'Atelier Camille R. ; la planner ne peut ni les relire, ni les adapter, ni
s'en envoyer un essai. Elle n'a pas non plus de modèle pour répondre à une demande, et ses
évènements n'arrivent pas dans son agenda.

Exigences du lot (`docs/GAP_REPORT.md`, plan des lots ; condition : Q18) :

| ID | Exigence | P | Critère d'acceptation | Écart aujourd'hui |
| --- | --- | --- | --- | --- |
| MSG-01 | E-mails de service aux couleurs de l'organisation, depuis des modèles à variables, avec aperçu et envoi test. | P0 | Aucun e-mail ne part avec une variable vide. | Partiel : texte brut écrit en dur, sans modèle, sans couleurs, sans aperçu ni essai |
| MSG-02 | Garde-fou d'envoi groupé : nombre et liste des destinataires affichés, confirmation explicite. | P0 | Aucun envoi à plus d'un destinataire sans cet écran. | Partiel : signataires listés avant l'envoi du devis, sans nombre ni confirmation |
| HUB-18 | Identité de l'organisation sur les documents, e-mails et portails : logo, couleurs, coordonnées, mentions. | P0 | Logo et coordonnées au MVP, couleurs et polices en V1. | Partiel : devis, factures et portails à son image ; e-mails non |
| HUB-21 | Modèles par type d'évènement : rétroplanning, budget, déroulé, devis, contrat, e-mails, questionnaires. Duplicables et versionnés. | P0 | Modifier un modèle ne change pas les évènements déjà créés. | Partiel : devis et contrat versionnés (31a, 31b) ; aucun modèle d'e-mail |
| HUB-29 | Calendrier : flux ICS par utilisateur et par évènement. Synchronisation Google et Microsoft dans les deux sens. | P0 | Flux ICS au MVP, synchronisation en V1. | Absent |

Décision de Julien qui s'applique : **Q18** — envoi depuis le domaine du planner, sinon depuis le
domaine de Symbola ; le service d'e-mail reste à choisir et doit gérer plusieurs domaines (DKIM) ;
lots 38 et 55. L'envoi depuis le domaine du planner est MSG-04 (P1, lot 55).

Autres règles : SEC-22 (plafond d'envois par organisation, lot 24b), SEC-20 (aucune donnée
personnelle dans les journaux), CLAUDE.md § 2.6 (modèles de départ en fichiers de données
traduisibles) et § 2.10 (aucun texte affiché en dur), ADR 0046 (apparence des documents),
ADR 0053 (tiers par lien personnel), ADR 0071 (programme diffusé ; l'e-mail de D11 vient ici).

## Ce qui existe aujourd'hui

- **`packages/mail`** : `sendMail({ to, subject, text, attachments })` par SMTP (Mailpit en dev,
  IONOS en production), expéditeur `SMTP_FROM` ; plafond d'envois par organisation et par heure
  (lot 24b).
- **Seize e-mails**, tous en texte brut :
  - au nom de l'organisation, vers les tiers : lien du client (créé, renouvelé), lien du
    prestataire (créé, renouvelé), rappels des tâches du client, demande de signature du devis,
    demande de signature du contrat, devis et contrat à commander d'abord, exemplaire signé (avec
    le PDF) ; code à usage unique d'un lien ;
  - à l'équipe : devis signé, demande de renouvellement d'un lien, export complet prêt,
    invitation dans l'équipe (et sa relance) ;
  - de Symbola : lien de connexion, e-mails de la console d'exploitation.
- **Identité** : le logo et les coordonnées de l'organisation sont sur les devis, les factures et
  en tête des portails ; la couleur et la police des documents sont dans `quotes.quote_settings`
  (ADR 0046).
- **« Écrire au client »** sur la fiche ouvre la messagerie de la planner (`mailto:`), sans texte.
- **Programme diffusé** (lot 37b) : la page du destinataire signale une nouvelle version ;
  l'e-mail était renvoyé à ce lot (D11 du lot 37).
- **Aucun flux de calendrier.**

## Découpage (D1)

- **38a — Les e-mails de service à l'image de l'organisation** : MSG-01, MSG-02, HUB-18 (e-mails),
  l'e-mail « nouvelle version du programme ».
- **38b — Les modèles de messages et les flux de calendrier** : HUB-21 (e-mails), HUB-29.

Deux PR, chacune avec ses migrations, ses tests et son rejeu.

## Lot 38a — Les e-mails de service à l'image de l'organisation

### Partie A — Des modèles à variables (MSG-01 ; D3, D5, D6)

- **Les e-mails aux tiers deviennent des modèles de l'organisation** (D3) : liens du client et du
  prestataire (créés, renouvelés), rappels des tâches, demandes de signature (devis, contrat),
  commande d'abord, exemplaire signé, nouvelle version du programme.
  - Paramètres › Modèles d'e-mails : chaque modèle, en français et en anglais (D6), avec son
    objet, son texte et la liste de ses variables (`{{prénom}}`, `{{lien}}`, `{{valable_jusqu_au}}`,
    `{{évènement}}`, `{{organisation}}`…). « Revenir au texte de départ » à tout moment.
  - Les textes de départ sont un fichier de données traduisible (`packages/starter-templates`).
- **Aucune variable vide** (D5) :
  - à l'enregistrement, une variable inconnue est refusée, et une variable indispensable (le lien
    d'un e-mail de lien) ne peut pas manquer ;
  - à l'envoi, une variable sans valeur arrête l'envoi : la planner voit laquelle ; un envoi
    automatique (rappel) arrêté est porté au journal et signalé dans « Aujourd'hui ».
- **Les autres e-mails** (code d'un lien, équipe, Symbola) gardent un texte de Symbola, non
  modifiable, sorti des services vers les fichiers de traduction, et la même mise en page.

### Partie B — À l'image de l'organisation (MSG-01, HUB-18 ; D2, D4, D7)

- **Mise en page** (D4) : un e-mail HTML avec sa version texte. En tête, le logo (joint à
  l'e-mail, sans adresse publique) ou le nom de l'organisation ; la couleur de ses documents
  (ADR 0046, graphite si aucune) pour le bandeau et le bouton ; en pied, ses coordonnées (e-mail,
  téléphone, adresse, site) et « Envoyé avec Symbola ».
- **Expéditeur** (D2) : le nom de l'organisation est le nom affiché ; l'adresse reste celle de
  Symbola ; les réponses vont à l'adresse de contact de l'organisation.
- **Aperçu et essai** (D7) : l'écran du modèle montre l'e-mail tel qu'il partira, avec des données
  fictives ; « M'envoyer un essai » l'envoie à la personne connectée, marqué « Essai », compté
  dans le plafond d'envois.

### Partie C — Le garde-fou d'envoi groupé (MSG-02 ; D8)

- Tout envoi décidé par l'équipe vers plus d'une personne passe par le même écran : le nombre, la
  liste (nom et adresse), et un bouton « Envoyer à N personnes ».
- Le serveur refuse l'envoi si la liste confirmée n'est plus celle qu'il calcule (une personne
  ajoutée ou retirée entre-temps).
- Envois concernés : demande de signature d'un devis ou d'un contrat à plusieurs signataires,
  e-mail du programme (partie D), et au 38b un message depuis un modèle à plusieurs destinataires.
  Les envois automatiques (rappels, exemplaires signés) vont à une personne à la fois.

### Partie D — Prévenir d'une nouvelle version du programme (D9 ; D11 du lot 37)

- Après une diffusion, « Prévenir par e-mail » propose les destinataires : les liens actifs des
  clients (rubrique Programme) et des prestataires. Garde-fou de la partie C.
- Chacun reçoit son programme en PDF (le sien : client ou prestataire), le numéro de la version, et
  l'invitation à ouvrir son espace par son lien personnel. Le lien lui-même ne peut pas être
  renvoyé : Symbola n'en garde que l'empreinte (ADR 0053).
- La fiche note quand la version a été envoyée, et à combien de personnes.

## Lot 38b — Les modèles de messages et les flux de calendrier

### Partie E — Les modèles de messages de la planner (HUB-21, SC-02 étape 2 ; D10)

- **Ses propres modèles** : « Réponse à une première demande », « Proposer un rendez-vous »… pour
  tous les évènements ou pour un type d'évènement. Duplicables et versionnés : chaque
  enregistrement fait une version ; les précédentes se relisent et se restaurent. Deux modèles de
  départ, en fichier de données traduisible.
- **« Écrire au client »** sur la fiche propose le modèle du type de l'évènement, en remplit les
  variables, montre l'aperçu, la liste des destinataires et les valeurs manquantes. Puis il ouvre
  la messagerie de la planner avec le texte, ou le copie (D10). Aucune variable vide.

### Partie F — Les flux de calendrier (HUB-29 ; D11, D12)

- **Un flux par personne de l'équipe** : les évènements datés de l'organisation (hors essais,
  perdus et annulés), en journée entière, avec le lien vers la fiche.
- **Un flux par évènement** : son programme du jour, séquence par séquence, à l'heure de
  l'évènement.
- **Une adresse secrète** : jeton aléatoire, gardé seulement haché, montré une fois, régénérable
  (l'ancienne adresse cesse de répondre), en lecture seule, débit limité ; Profil › Mon calendrier.
- Format ICS (RFC 5545) écrit par l'app, sans dépendance. La synchronisation Google et Microsoft
  est en V1.

## Décisions à prendre

- **D1 — Le découpage.**
  - (a) Deux PR : 38a (e-mails de service, garde-fou, e-mail du programme), 38b (modèles de
    messages, flux de calendrier).
  - (b) Une seule PR.

  **Recommandation : (a).** Deux livraisons qui se rejouent chacune (SC-02 étapes 4 et 5, SC-08
  étape 6 au 38a ; SC-02 étape 2 au 38b).
- **D2 — Le service d'e-mail (Q18).**
  - (a) Garder pour ce lot le service actuel, derrière `packages/mail`. Le nom de l'organisation
    est le nom affiché, l'adresse reste celle de Symbola, les réponses vont à l'adresse de
    contact de l'organisation. Le service à plusieurs domaines se choisit au lot 55, avec l'envoi
    depuis le domaine de la planner (MSG-04).
  - (b) Choisir dès ce lot un service européen à plusieurs domaines : comparatif, nouveau
    sous-traitant, ADR, coût mensuel.

  **Recommandation : (a).** MSG-01 ne demande pas le domaine de la planner ; changer de service
  maintenant ajouterait un sous-traitant et un coût sans gain visible avant le lot 55. Le choix
  du service (et son prix) reste à vous.
- **D3 — Quels e-mails deviennent des modèles de l'organisation.**
  - (a) Ceux qu'elle adresse aux tiers (liens, rappels, signatures, commande, exemplaire signé,
    programme). Le code d'un lien, les e-mails à l'équipe et ceux de Symbola gardent un texte fixe,
    passé dans les fichiers de traduction.
  - (b) Tous.

  **Recommandation : (a).** Un code de sécurité ou une invitation dans l'équipe ne gagne rien à
  être réécrit, et y perdrait en clarté.
- **D4 — L'identité dans l'e-mail (HUB-18).**
  - (a) HTML et sa version texte : logo joint (ou nom), couleur des documents, coordonnées en pied.
  - (b) Texte brut, signé du nom de l'organisation et de ses coordonnées.

  **Recommandation : (a).** C'est le sens de « aux couleurs de l'organisation » (MSG-01). La
  couleur existe déjà pour les documents (ADR 0046) ; la police reste en V1 (HUB-18).
- **D5 — Les variables.**
  - (a) Une liste fixe par modèle ; variable inconnue ou indispensable manquante refusée à
    l'enregistrement ; valeur vide à l'envoi : l'e-mail ne part pas, on dit laquelle.
  - (b) Une valeur vide remplacée par un texte par défaut.

  **Recommandation : (a).** C'est le critère de MSG-01 : aucun e-mail ne part avec une variable
  vide.
- **D6 — Les langues.**
  - (a) Chaque modèle en français et en anglais ; la langue du destinataire choisit (celle de son
    lien, celle du signataire).
  - (b) Un seul texte par modèle.

  **Recommandation : (a).** Les e-mails existants le font déjà ; les liens ont une langue.
- **D7 — L'aperçu et l'essai.**
  - (a) Aperçu dans l'écran du modèle, avec des données fictives ; essai envoyé à la personne
    connectée seulement, marqué « Essai ».
  - (b) Essai à une adresse saisie.

  **Recommandation : (a).** Une adresse libre ferait de l'essai un moyen d'envoyer n'importe quoi
  à n'importe qui depuis Symbola.
- **D8 — Le garde-fou d'envoi groupé (MSG-02).**
  - (a) Un écran commun pour tout envoi décidé par l'équipe vers plus d'une personne ; le serveur
    refuse si la liste a changé depuis l'écran.
  - (b) Un message de confirmation simple.

  **Recommandation : (a).** Le critère demande le nombre et la liste ; le contrôle côté serveur
  évite qu'une liste modifiée entre-temps parte sans être revue.
- **D9 — Prévenir d'une nouvelle version du programme.**
  - (a) « Prévenir par e-mail » après la diffusion, proposé, avec le garde-fou ; le PDF de chacun en
    pièce jointe.
  - (b) Un e-mail automatique à chaque diffusion.

  **Recommandation : (a).** La planner diffuse parfois une correction mineure la veille au soir ;
  elle choisit quand prévenir. SC-08 dit « avertis après sa validation ».
- **D10 — Les modèles de messages de la planner (38b).**
  - (a) Ses modèles, par type d'évènement ou pour tous, duplicables et versionnés ; « Écrire au
    client » remplit le texte puis ouvre sa propre messagerie (ou copie le texte).
  - (b) Comme (a), mais le message part par Symbola, aux couleurs de l'organisation, réponses vers
    la planner.

  **Recommandation : (a).** Le message part de sa boîte, la réponse y revient, la conversation y
  reste. L'envoi par Symbola trouvera sa place avec le fil de discussion (MSG-03) et l'envoi
  depuis son domaine (MSG-04), en V1.
- **D11 — Les flux de calendrier (38b).**
  - (a) Un flux par personne de l'équipe (évènements datés) et un flux par évènement (son
    programme) ; adresse secrète, régénérable ; les tiers plus tard.
  - (b) Seulement le flux par personne.

  **Recommandation : (a).** C'est la lettre de HUB-29 (« par utilisateur et par évènement ») ; le
  flux d'un évènement sert la veille et le jour J, sur le téléphone.
- **D12 — Ce que montre le flux.**
  - (a) Le type d'évènement et les prénoms des clients (« Mariage — Léa & Maxime »), comme sur la
    fiche.
  - (b) Le type et la ville seulement, sans nom.

  **Recommandation : (a).** C'est l'agenda de la planner, qu'elle abonne elle-même ; sans prénom,
  deux mariages du même mois se confondent. Le registre RGPD et l'ADR le disent ; régénérer
  l'adresse coupe l'accès d'un agenda perdu.

## Migrations (prévision)

- **38a** :
  - `hub` : modèles d'e-mails de l'organisation (`email_templates` : nature, langue, objet, texte),
    sous RLS ; un modèle absent vaut le texte de départ.
  - `events` : l'envoi d'une version du programme (`program_versions.notified_at`,
    `notified_count`).
- **38b** :
  - `hub` : modèles de messages et leurs versions (`message_templates`,
    `message_template_versions`, type d'évènement en identifiant sans clé étrangère) ; adresses de
    calendrier (`calendar_feeds` : personne, empreinte du jeton, révocation), sous RLS.

Chaque migration ne touche que le schéma de son module (DAT-09) et a son annulation.

## Fichiers touchés (prévision)

- `packages/mail` : e-mail HTML et texte, pièces jointes en ligne (logo), nom affiché et adresse
  de réponse.
- `packages/starter-templates` : textes de départ des e-mails de service et des modèles de
  messages (FR, EN).
- `packages/db` : schémas `hub` et `events`, migrations, annulations, tests (isolation,
  annulation, accès Admin).
- `packages/contracts` : modèles d'e-mails, garde-fou d'envoi, modèles de messages, flux.
- `apps/symbola/modules/hub` : modèles d'e-mails et de messages, rendu (variables, mise en page),
  adresses de calendrier.
- `apps/symbola/modules/events`, `apps/symbola/modules/quotes` : leurs e-mails passent par les
  modèles ; e-mail du programme ; flux ICS d'un évènement.
- `apps/symbola/app` : Paramètres › Modèles d'e-mails et Modèles de messages, écran du garde-fou,
  « Prévenir par e-mail » sur la fiche, « Écrire au client », Profil › Mon calendrier, routes des
  flux.
- `privacy.registry.yaml`, `packages/i18n` (FR, EN), aide des écrans, `docs/adr` (un ADR pour les
  e-mails et les flux), `docs/conformite/sous-traitants.md` (inchangé avec D2 (a)),
  `docs/export/format-v1.md`, `docs/gap.csv`, runbook.

## Tests

- **Chaque critère devient un `it`** sous son identifiant.
- **MSG-01** :
  - le rendu remplace chaque variable ; une variable vide arrête l'envoi et la nomme ;
  - une variable inconnue, ou un lien manquant dans l'e-mail d'un lien, est refusé à
    l'enregistrement ;
  - chaque e-mail de service part en HTML et en texte, au nom de l'organisation, réponses vers son
    adresse de contact, logo joint (Mailpit) ;
  - l'essai part à la personne connectée seulement, marqué « Essai », compté dans le plafond.
- **MSG-02** : aucun envoi à plus d'une personne sans l'écran ; une liste modifiée depuis l'écran
  est refusée.
- **HUB-18** : logo, couleur et coordonnées dans l'e-mail ; sans logo, le nom ; sans couleur, le
  graphite.
- **Programme** : seuls les liens actifs concernés reçoivent l'e-mail, chacun avec son PDF ; ni
  note interne ni séquence détaillée d'un autre prestataire.
- **HUB-21 (38b)** : un modèle se duplique ; une modification fait une version, l'ancienne se relit
  et se restaure ; le modèle du type de l'évènement passe avant celui de tous.
- **HUB-29 (38b)** : le flux suit RFC 5545 (échappement, lignes pliées, journées entières, heures
  dans le fuseau de l'évènement) ; un jeton inconnu, régénéré ou d'une personne retirée de
  l'équipe ne répond rien ; ni essais, ni évènements d'une autre organisation.
- **Isolation et abus** : organisation A contre B pour chaque nouvelle table ; un modèle d'une autre
  organisation ne s'utilise pas ; l'Admin n'en lit aucun.
- **Playwright** : modèles d'e-mails (édition, aperçu, essai), garde-fou, « Prévenir par e-mail »,
  « Écrire au client », Mon calendrier ; ordinateur et 375 px, axe-core.
- **Rejeu** : SC-02 étapes 4 et 5 (Léa reçoit son lien et la demande de signature aux couleurs
  d'Atelier Camille R.) et SC-08 étape 6 (les prestataires concernés sont avertis après sa
  validation) au 38a ; SC-02 étape 2 (Camille répond depuis un modèle) au 38b.

## Hors périmètre

- Envoi depuis le domaine de la planner et réglage DKIM (MSG-04, lot 55) ; choix du service
  d'e-mail à plusieurs domaines (Q18, avec le lot 55, selon D2).
- Journal des envois remis ou rejetés (MSG-05, P1), fil de discussion (MSG-03, P1), SMS (MSG-06).
- Synchronisation Google et Microsoft (HUB-29, V1) ; flux de calendrier pour les clients et les
  prestataires.
- Prise de rendez-vous en ligne (RDV) : le modèle « Proposer un rendez-vous » propose des dates
  écrites par la planner.
- Polices dans les e-mails (HUB-18, V1).

## Ambiguïtés relevées

- **« E-mails de service »** (MSG-01) et **« modèles… e-mails »** (HUB-21) : deux choses distinctes,
  les e-mails que Symbola envoie au nom de la planner (38a) et les messages qu'elle écrit
  elle-même depuis un modèle (38b) : D3, D10.
- **« Écran de contrôle des envois »** (plan des lots) : lu comme l'écran du garde-fou (MSG-02) ; le
  journal des envois est MSG-05 (P1) : D8.
- **« Couleurs » au MVP** : MSG-01 (P0) dit « aux couleurs de l'organisation », HUB-18 met les
  couleurs en V1 ; la couleur des documents existe déjà et sert aux e-mails : D4.
- **Q18** demande un service à plusieurs domaines « pour les lots 38 et 55 » ; ce lot n'en a pas
  besoin si l'envoi depuis le domaine de la planner reste au lot 55 : D2.
