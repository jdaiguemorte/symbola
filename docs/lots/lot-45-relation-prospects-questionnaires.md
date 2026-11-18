# Lot 45 — Réponses en un clic, relances des prospects, doublons, questionnaires

**Statut** : spécification proposée le 18/11/2026, **à valider par Julien**. Le lot change les
schémas `events` et `hub` (tables, colonnes, contrainte des natures d'e-mails) : validation
explicite requise (CLAUDE.md § 8). Aucune dépendance nouvelle.

Branche `lot-45-relation-prospects`, partie de `main`. Aucune version intermédiaire n'est
déployée (gel des déploiements) : le lot se rejoue en local.

Ce lot avance **en parallèle des lots 43 et 51** : voir « Travail en parallèle » à la fin.

## Contexte

Le lot 44 fait entrer les demandes (formulaire, pipeline). Il reste à **y répondre vite**, à
**relancer sans oublier**, à **ne pas avoir deux fois la même personne**, et à **recueillir les
informations du couple une seule fois**. Parcours **PAR-02** (P0), étapes 2 et 7 :

- « Le planner répond en un clic depuis un modèle, avec une proposition de rendez-vous » ;
- « Sans réponse, des relances partent à J+3 et J+7. Elles s'arrêtent dès que le client
  réagit. »

Réussite de PAR-02 : aucune ressaisie entre prospect, devis, évènement et facture.

Exigences du lot :

- **CRM-05** (P1) — Réponse en un clic depuis des modèles : premier contact, brochure, proposition
  de rendez-vous. *Critère* : le message se relit et se modifie avant l'envoi.
- **CRM-06** (P1) — Relances automatiques réglables, arrêtées dès que le prospect répond.
  *Critère* : aucune relance ne part après une réponse ou un refus.
- **CRM-07** (P1) — Détection et fusion des doublons sur e-mail et téléphone. *Critère* : la fusion
  conserve tout l'historique.
- **CRM-09** (P1) — Questionnaire de découverte envoyé au prospect ; ses réponses préremplissent
  l'évènement. *Critère* : aucune réponse n'est redemandée ensuite.
- **POR-07** (P1) — Questionnaires : découverte, cérémonie, musiques, détails pratiques.
  *Critère* : enregistrement à chaque réponse ; reprise possible plus tard.
- **HUB-21** (P0, Partiel) — Modèles par type d'évènement, duplicables et versionnés : ce lot y
  ajoute les questionnaires. *Critère* : modifier un modèle ne change pas les évènements déjà
  créés.

FAC-15 (validité et relance des devis), prévue ici par le plan, passe au lot 43 (sa D1), qui
affiche la validité sur la page de proposition. RGP-17 (prospection commerciale) reste « Sans
objet » : une relance à une personne qui a fait une demande n'est pas de la prospection. Point à
confirmer par l'avocat (AV-9).

## Ce qui existe aujourd'hui

- **Prospects** : évènements au statut Option, pipeline et formulaire de contact (lot 44), source,
  motif de perte.
- **« Écrire au client »** (lot 38b, ADR 0072) :
  - le modèle du type d'évènement, avec ses variables remplies depuis la fiche (aucune variable
    vide), puis l'aperçu ;
  - ensuite, la messagerie de la planner s'ouvre (`mailto`) ou le texte se copie : **Symbola
    n'envoie rien** ;
  - modèles de départ dans `message-templates.json` (première demande, rendez-vous), par type
    d'évènement, versionnés.
- **E-mails envoyés par Symbola** : adaptateur et file sans doublon (lot 40b, ADR 0076), à l'image
  de l'organisation (lot 38, ADR 0072).
- **Rappel interne « à relancer »** : réglages `app/parametres/relances`, sans envoi.
- **Fiche contact unique** du hub (CRM-03, lot 36) : `hub.contacts`, `hub.contact_notes`. Elle est
  désignée par les clients d'un évènement, les liens personnels (`event_links.contact_id`), les
  signataires et les rendez-vous.
- **Rapprochements à l'import** (`lib/import/matching.ts`) : doublons signalés à l'import seulement.
- **Modèles par type d'évènement** : rétroplanning, programme, budget, devis, contrat, messages ;
  un évènement garde la version dont il vient (lots 31, 38).

Rien n'existe pour : l'envoi d'une réponse depuis Symbola, les relances envoyées, la détection et
la fusion des doublons hors import, les questionnaires.

## Une seule PR

Le lot tient en une PR : il ferme la relation avec le prospect (PAR-02, étapes 2 et 7) et
l'aboutit à l'évènement prérempli.

## Partie A — Répondre en un clic (CRM-05 ; D1)

- Sur une demande (carte du pipeline, fiche, « Aujourd'hui ») : **« Répondre »**. Le choix du
  modèle (premier contact, brochure, proposition de rendez-vous) ouvre l'écran existant « Écrire
  au client » : variables remplies, aperçu, destinataire, texte **modifiable**.
- **Deux façons d'envoyer** (D1) :
  - **« Envoyer depuis Symbola »** : l'e-mail part à l'image de l'organisation, avec en adresse
    de réponse celle de la planner. Il est rangé dans l'historique du contact (CRM-03) ;
  - **« Ouvrir dans ma messagerie »** : le `mailto` actuel, gardé. L'envoi est noté « préparé »
    dans l'historique.
- **Brochure** : un document de l'organisation (PDF) joint par lien sécurisé, pas en pièce jointe
  (servi après contrôle, ADR 0027). Le lien expire après 30 jours.
- **Rendez-vous** : si le module Rendez-vous est ouvert (lot 46), le modèle insère le lien de la
  page de réservation ; sinon, des créneaux proposés à la main (ARC-07).
- **Modèles de départ** : brochure ajoutée à `message-templates.json`, en français et en anglais.

## Partie B — Relancer sans oublier (CRM-06 ; D2, D3)

- **Réglage par organisation** : relances à J+3 et J+7 après la dernière réponse de la planner
  sans retour du prospect (données de départ `prospect-follow-ups.json`). Au plus trois, chacune
  avec son modèle.
- **Comment elles partent** (D2) : par défaut, chaque relance **se prépare** et apparaît dans
  « Aujourd'hui » : « Relancer Léa M. : prête, à relire ». La planner l'envoie d'un geste après
  l'avoir relue, ou la retire. Un réglage permet l'envoi **automatique**, désactivé par défaut.
- **Arrêt** (critère CRM-06, D3) : la relance est annulée, et vérifiée une dernière fois juste
  avant l'envoi, dès que l'un de ces faits survient :
  - la planner note « a répondu » (un geste, depuis la carte ou « Aujourd'hui ») ;
  - la carte change d'étape, l'évènement est confirmé ou perdu (refus) ;
  - le prospect agit dans Symbola : il ouvre son portail, répond à un questionnaire, réserve un
    rendez-vous ou signe ;
  - un nouvel envoi de la planner a lieu, ce qui repart à zéro.
- **Pas de lecture de la boîte e-mail de la planner** (D3) : une réponse par e-mail ou par
  WhatsApp, Symbola ne la voit pas. C'est la planner qui la signale d'un geste.

## Partie C — Doublons (CRM-07 ; D4, D5)

- **Détection** dans le hub, sur l'**e-mail** normalisé (casse, espaces) et le **téléphone**
  normalisé (format international). Elle a lieu à la saisie, au formulaire de contact (lot 44)
  et en tâche de fond chaque nuit. Les paires suspectes apparaissent dans « Contacts › Doublons
  possibles », jamais fusionnées seules.
- **Fusion** (D4), par la planner :
  - elle choisit la fiche gardée et, champ par champ, la valeur à garder ;
  - un écran de confirmation montre ce qui sera réuni (évènements, notes, messages, rendez-vous,
    liens, signatures) ;
  - la fiche absorbée disparaît, son **historique entier passe** à la fiche gardée (critère).
- **Les autres modules suivent** (D5) : le hub publie `hub.contact.merged` (fiche absorbée, fiche
  gardée, dans `domain_events`) ; chaque module (events, quotes, appointments, guests si
  concerné) **repointe** ses références par son propre service, de façon idempotente. Aucun
  module n'écrit dans les tables d'un autre (ARC-01).
- **Trace** : la fusion est journalisée (qui, quand, quelles fiches) ; elle ne se défait pas
  automatiquement, mais la trace permet de la reprendre à la main.
- **Données fictives** : un contact `is_demo` ne se fusionne jamais avec un contact réel.

## Partie D — Questionnaires (CRM-09, POR-07, HUB-21 ; D6 à D8)

- **Modèles de questionnaires** par type d'évènement, dupliquables et versionnés (HUB-21) :
  - **questions** : texte court, texte long, choix unique, choix multiple, date, nombre, montant ;
  - **une question peut alimenter un champ de l'évènement** : date, nombre d'invités, budget
    souhaité, lieu ou ville, style, type d'évènement ;
  - **modèles de départ** (`questionnaires.json`, FR et EN) : découverte, cérémonie, musiques,
    détails pratiques. Ils ne contiennent aucune question sur la santé, la religion ou les
    opinions : les régimes passent par le module Invités, avec accord (lot 49).
- **Envoi** : la planner envoie un questionnaire à un contact de l'évènement, par son lien
  personnel (portail, rubrique « Questionnaires », fermée par défaut puis ouverte pour ce
  questionnaire). Pour un prospect (CRM-09), le lien est celui du client, créé si besoin à
  l'envoi.
- **Réponse** (POR-07) :
  - une question par écran sur téléphone, ou toutes à la suite sur ordinateur ;
  - **enregistrement à chaque réponse** ;
  - reprise plus tard, là où la personne s'était arrêtée ;
  - « Terminer » prévient la planner.
- **Préremplissage** (CRM-09, D7) : à la fin, les réponses liées à un champ **remplissent**
  l'évènement si le champ est vide. S'il est déjà rempli, l'écart est montré à la planner
  (« Léa indique 140 invités, la fiche dit 120 ») et elle choisit. **Aucune réponse n'est
  redemandée ensuite** (critère) :
  - une question liée à un champ déjà rempli est **proposée pré-remplie** à confirmer ;
  - une question à laquelle la personne a déjà répondu (même questionnaire ou autre) n'est pas
    posée de nouveau.
- **Version figée** (HUB-21) : un questionnaire envoyé garde la version du modèle dont il vient ;
  modifier le modèle ne change pas les questionnaires déjà envoyés.
- **Où vit la fonction** (D6) : module `events` (le questionnaire appartient à l'évènement) ; les
  modèles aussi, à côté des modèles de rétroplanning et de programme.

## Décisions à prendre

- **D1 — Envoyer depuis Symbola.**
  - (a) Deux voies : « Envoyer depuis Symbola » (historique complet, nécessaire aux relances) et
    « Ouvrir dans ma messagerie » (l'actuel `mailto`).
  - (b) Garder seulement le `mailto`.

  **Recommandation : (a).** Sans envoi par Symbola, ni l'historique (CRM-03) ni les relances
  (CRM-06) ne fonctionnent ; le `mailto` reste pour qui préfère sa boîte.
- **D2 — Relances préparées ou automatiques.**
  - (a) Préparées dans « Aujourd'hui » et envoyées d'un geste par la planner ; envoi automatique en
    réglage, désactivé par défaut.
  - (b) Automatiques par défaut.

  **Recommandation : (a).** La planner garde la main : elle sait souvent, par WhatsApp ou par
  téléphone, que le couple a déjà répondu. C'est ta préférence du lot 47. L'automatique reste
  possible pour qui le veut.
- **D3 — Savoir que le prospect a répondu.**
  - (a) Par les faits visibles dans Symbola et par un geste de la planner (« a répondu ») ; aucune
    lecture de sa boîte e-mail.
  - (b) Lire les réponses par e-mail (adresse de réponse gérée par Symbola, ou accès à la boîte).

  **Recommandation : (a).** (b) demande un service de réception d'e-mails ou l'accès à la boîte de
  la planner : nouveau sous-traitant, données sensibles, ADR. À revoir avec la messagerie
  (lot 55).
- **D4 — La fusion des doublons.**
  - (a) Toujours par la planner, champ par champ, après confirmation ; jamais automatique.
  - (b) Fusion automatique quand l'e-mail est identique.

  **Recommandation : (a).** Deux personnes peuvent partager une adresse (couple, famille) ; une
  fusion à tort mélange deux historiques.
- **D5 — Les références des autres modules.**
  - (a) Événement `hub.contact.merged` ; chaque module repointe par son service, de façon
    idempotente.
  - (b) Le hub met à jour les tables des autres modules.

  **Recommandation : (a).** C'est la règle des frontières (ARC-01, ARC-05) ; (b) l'enfreint.
- **D6 — Où vivent les questionnaires.**
  - (a) Module `events`, comme les autres modèles d'évènement.
  - (b) Un module `questionnaires` à part.

  **Recommandation : (a).** Un questionnaire n'a de sens que pour un évènement ; ses réponses
  remplissent l'évènement.
- **D7 — Une réponse qui contredit la fiche.**
  - (a) Le champ vide se remplit ; un champ déjà rempli montre l'écart et la planner choisit.
  - (b) La réponse remplace toujours la fiche.

  **Recommandation : (a).** La planner a souvent une information plus récente (rendez-vous) ; rien
  ne s'écrase sans elle.
- **D8 — Les fichiers dans un questionnaire.**
  - (a) Pas de question « fichier » dans ce lot ; les documents passent par les documents de
    l'évènement (lot 29b).
  - (b) Question « fichier » (photos d'inspiration…).

  **Recommandation : (a).** Le dépôt de fichiers par lien existe déjà ailleurs ; l'ajouter aux
  questionnaires double les contrôles (antivirus, taille, droits) pour peu.
- **D9 — Les e-mails.** Touche le schéma `hub` (contrainte des natures d'e-mails).
  - (a) Natures `prospect_reply`, `prospect_follow_up`, `questionnaire_sent` ; contrainte élargie
    par une migration `hub` à part, annulable, avec la réunion des natures de `main`.
  - (b) Réutiliser une nature générique.

  **Recommandation : (a)**, même méthode que les lots 44, 46, 47 et 49.

## Points pour les conseils

**Avocat** (question suivante de sa fiche, numéro donné à la fusion) :

- **AV-9** — Les relances à un **prospect qui a fait une demande** (formulaire, e-mail) : est-ce de
  la prospection commerciale (accord préalable, lien de désinscription, RGP-17), ou la suite de sa
  demande, sans ces obligations ? Recommandation de travail : la suite de sa demande. Chaque
  relance porte quand même une phrase « Vous ne souhaitez plus de nouvelles ? Répondez
  simplement. », et le geste « ne plus relancer » de la planner.

**DPO** : les questionnaires de départ évitent toute donnée sensible ; une planner qui ajoute une
question sur la santé ou la religion reçoit un avertissement, avec un renvoi au module Invités,
qui recueille l'accord. La fusion de contacts est notée au registre (traitement de mise à jour).

## Migrations (prévision)

Numérotation : le lot part du premier numéro libre de `main` au moment de son code. Une PR
fusionnée après une autre **renumérote** les siennes **et** leur donne une date (`when` du
journal) postérieure à la dernière de `main`.

- **`events`** :
  - `questionnaire_templates` (type d'évènement, nom, version) et `questionnaire_template_items`
    (question, nature, choix, champ alimenté, position) ;
  - `event_questionnaires` (évènement, contact, version du modèle figée, envoyé le, terminé le) et
    `questionnaire_answers` (question, valeur, répondu le) ;
  - `prospect_follow_ups` (évènement, rang, prête le, envoyée le, retirée le, motif d'arrêt) ;
  - `event_messages` (évènement, contact, modèle, envoyé ou préparé, le, par) ;
  - rubrique « Questionnaires » ajoutée à `event_links_rubrics_check` ;
  - RLS et index.
- **`hub`** :
  - `contact_duplicates` (paire, raison, détectée le, écartée le) ;
  - `contact_merges` (gardée, absorbée, par, le, champs choisis) ;
  - contrainte des natures d'e-mails (D9), dans une migration à part.
- Données de départ : `prospect-follow-ups.json`, `questionnaires.json`, brochure dans
  `message-templates.json`.

## Fichiers touchés (prévision)

- `packages/db/src/schema/events.ts`, `hub.ts` ; `drizzle/` et `drizzle-rollback/`.
- `apps/symbola/modules/events/` : `questionnaires.ts`, `prospect-follow-ups.ts`, `messages.ts`,
  `service.ts`, `repository.ts`, `privacy.ts`.
- `apps/symbola/modules/hub/` : `contact-duplicates.ts`, `contact-merge.ts`, `service.ts` ;
  consommateurs de `hub.contact.merged` dans `events`, `quotes`, `appointments`, `guests`.
- `apps/symbola/app/` : `events/[id]/ecrire` (envoi), `events/pipeline` (Répondre),
  `contacts/doublons`, `events/parametres/questionnaires`, `portail/questionnaires`, `accueil`.
- `packages/contracts` : `hub.contact.merged` (v1).
- `packages/starter-templates/src/`, `packages/i18n/src/messages/`, centre d'aide,
  `privacy.registry.yaml`.
- `docs/gap.csv` (CRM-05, CRM-06, CRM-07, CRM-09, POR-07, HUB-21), ADR 0090,
  `docs/recette/SC-02.md` (étapes 1 et 2), `docs/recette/SC-10.md` (doublons).

## Tests

- **CRM-05** : modèle, variables, texte modifié avant l'envoi ; envoi rangé dans l'historique ;
  `mailto` noté « préparé » ; lien de brochure expiré refusé.
- **CRM-06** (horloge simulée) : relances préparées à J+3 et J+7 ; **aucune** après « a répondu »,
  un changement d'étape, une confirmation, un refus ou une action du prospect, même survenue
  entre la préparation et l'envoi ; envoi automatique en réglage.
- **CRM-07** : détection par e-mail et téléphone normalisés ; fusion qui garde **tout**
  l'historique (évènements, notes, messages, rendez-vous, liens, signatures) ; consommateurs
  idempotents (événement reçu deux fois) ; jamais de fusion avec un contact fictif ; organisation
  A ne voit pas les doublons de B.
- **CRM-09 et POR-07** (intégration et Playwright 375 px, axe-core) :
  - enregistrement à chaque réponse et reprise ;
  - champ vide rempli, écart montré, question déjà connue proposée pré-remplie, jamais
    redemandée ;
  - questionnaire envoyé figé quand le modèle change.
- **Isolation et abus** (SEC-36) : lien d'un autre évènement, rubrique fermée, organisation A
  contre B, Admin ; aucun e-mail ni téléphone dans les journaux.
- **Rejeu** : SC-02 (étapes 1 et 2 en V1), SC-10 (doublons) ; fichiers de `docs/recette/` mis à
  jour.

## Hors périmètre

- Lecture des réponses par e-mail (D3 b) ; messagerie par sujet (MSG-03 à MSG-05, lot 55).
- Validité et relance des devis (FAC-15, lot 43).
- Question « fichier » (D8 b) ; logique conditionnelle entre questions.
- Envoi depuis le domaine de la planner (Q18, lot 55) : l'adresse de réponse suffit ici.

## Ambiguïtés relevées

- CRM-06 dit « dès que le prospect répond » : Symbola ne lit pas les e-mails ; la réponse est le
  geste de la planner ou un fait vu dans Symbola (D3).
- POR-07 cite « musiques » : liste de titres en texte long ; aucune intégration à un service de
  musique.

## Travail en parallèle (lots 43, 45 et 51)

- **Avec le lot 43** : les deux élargissent la contrainte des natures d'e-mails du `hub` ; la PR
  fusionnée en second réunit les listes. FAC-15 passe au lot 43 : aucun fichier du module `quotes`
  en commun, hormis un consommateur de `hub.contact.merged` (petit fichier neuf).
- **Avec le lot 51** : les deux touchent `packages/db/src/schema/events.ts`, sur des tables
  différentes. Conflits de texte dans le schéma, le journal des migrations et les traductions.
- `gap.csv`, traductions, `globals.css` : garder tout, accolades équilibrées.
