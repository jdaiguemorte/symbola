# Lot 24 — Preuves de cloisonnement, comptes et envois, jeu fictif

**Statut** : spécification validée par Julien le 11/11/2026, décisions D1 à D7 en (a). Branche
`lot-24-preuves-cloisonnement` pour le 24a, puis une branche pour le 24b.

## Contexte

Phase 0 du plan (`docs/GAP_REPORT.md` § 7) : **prouver** que les données d'une organisation sont
à l'abri des autres, et que les comptes et les envois résistent aux abus. Le jeu fictif
(DAT-10) rejoint ce lot (décision C4) : chaque lot suivant en a besoin pour rejouer son scénario.

**Exigences** : SEC-03 à SEC-06, SEC-12, SEC-13, SEC-20, SEC-22, SEC-36, ARC-01, ARC-07, DAT-01,
DAT-10 (toutes P0). Décision Q22 : mots de passe compromis par une dépendance tenue à jour.

**Constat du 11/11/2026** (`docs/gap.csv`) :

- les pages appellent une garde (test du lot 16), mais rien ne vérifie les **routes** et les
  **actions serveur** ;
- la RLS rend introuvable l'objet d'une autre organisation, mais **aucun test ne prouve** que la
  réponse est la même que pour un objet inexistant, et le refus n'est pas journalisé ;
- aucun test ne cherche d'e-mail ni de téléphone dans les **journaux techniques** ;
- **mots de passe** : douze caractères minimum, mais aucun contrôle contre les listes de mots de
  passe compromis ; après dix échecs, le délai est **fixe**, pas croissant ;
- **sessions** : 8 heures glissantes, mais le cookie expire 8 heures après la connexion ; pas de
  « déconnecter tous mes appareils », pas de retrait d'un membre ;
- **envois** : pas de plafond d'e-mails par organisation et par heure ;
- **modules** : pas de test joué avec chaque combinaison de modules ; « retirer le dossier d'un
  module » ne peut pas compiler aujourd'hui, car les modules s'appellent par leur `service.ts` ;
- **index** : sur 64 tables qui portent `organization_id`, 7 seulement ont un index qui commence
  par cette colonne (contraintes d'unicité comprises) ;
- **jeu fictif** : `docs/recette/symbola-synthetic-users.json` (14 profils, 2 organisations,
  2 événements, 18 scénarios) n'a pas de chargeur.

## Découpage : deux lots, deux pull requests (décision D1)

- **24a — Jeu fictif et preuves d'accès** : parties A à F (DAT-10, SEC-12, SEC-13, SEC-20, DAT-01,
  ARC-07, ARC-01).
- **24b — Comptes et envois** : parties G à K (SEC-03 à SEC-06, SEC-22, SEC-36).

---

## Lot 24a — Jeu fictif et preuves d'accès

### Partie A — Jeu fictif chargeable en une commande (DAT-10, décision D7)

- Commande `pnpm --filter @symbola/app seed:recette` : elle crée, ou recrée à l'identique, les
  2 organisations du jeu, leurs comptes (titulaire, collaborateurs, mariés), leurs 2 événements,
  avec devis, échéancier, budget et prestataires, **par les services des modules**. Ainsi, les
  règles (RLS, journal, chaîne des pièces) s'appliquent comme en vrai.
- **Jamais mêlé aux données réelles** : la commande refuse de tourner en production
  (`NODE_ENV=production`, ou base de production). Les organisations du jeu ont des identifiants
  fixes et un nom marqué « [Recette] ».
- Les mots de passe des comptes du jeu sont générés et écrits dans un fichier local hors du dépôt.
  Ils ne sont jamais affichés dans un journal.
- Les rejeux des lots suivants (`docs/recette/SC-xx.md`) partent de ce jeu.

### Partie B — Chaque route a sa règle d'accès (SEC-12)

Un test parcourt toutes les pages, routes (`route.ts`) et actions serveur (`"use server"`) de
`apps/symbola/app`. Chacune doit appeler une garde ou un contrôle reconnu (`requirePlanner`,
`requireOwner`, `authorizedPlanner`, `ownerContext`, signature de webhook…), ou figurer dans la
liste des entrées publiques, avec son motif (connexion, invitation, santé, webhook signé). Une
route ajoutée sans règle fait échouer le test.

### Partie C — Même réponse pour « inexistant » et « interdit », refus journalisé (SEC-13, SC-S1, décision D4)

- Un test e2e se connecte dans l'organisation A et appelle chaque route qui prend un identifiant
  (événement, devis, facture, avoir, document signé, fichier de prestataire, export RGPD…), avec un
  identifiant de B puis un identifiant inexistant. Les deux réponses doivent être identiques :
  statut, corps, et rien qui distingue l'un de l'autre.
- Chaque refus d'un identifiant introuvable, pour une personne connectée, va au journal de **son**
  organisation (`hub.access.refused`, famille « droits ») : la route et l'identifiant demandé,
  sans rien révéler de l'autre organisation. Une seule ligne par minute et par route, pour ne pas
  noyer le journal.

### Partie D — Aucune donnée personnelle dans les journaux techniques (SEC-20)

- Les suites d'intégration capturent tout ce qui est écrit dans la console (`console.*`). À la
  fin, un contrôle échoue s'il y trouve une adresse e-mail ou un numéro de téléphone.
- Le job e2e de la CI fait de même sur la sortie du serveur.
- Les messages trouvés sont corrigés : des identifiants, jamais des noms ni des adresses.

### Partie E — `organization_id` indexé partout (DAT-01)

- Une migration par module ajoute l'index manquant sur `organization_id` de chaque table métier.
- Un test parcourt la base : chaque table qui a `organization_id` l'a obligatoire et indexé.
- Les tables d'identité du hub, sans RLS, restent l'écart déjà décrit par l'ADR 0013.

### Partie F — Combinaisons de modules (ARC-07, ARC-01, décision D6)

- **ARC-07** : un test joue les 16 combinaisons des 4 modules du MVP (Événements, Budget, Devis,
  Prestataires). Pour chacune, l'accueil, le menu, la recherche et les écrans d'un module voisin
  s'affichent sans erreur ; un lien vers un module absent disparaît, ou mène à « indisponible ».
- **ARC-01** (« retirer le dossier d'une app laisse les autres compiler ») : impossible tant que
  les modules s'appellent par leur `service.ts`. Proposition : un ADR d'écart, où ARC-07 tient lieu
  de preuve, et où le contrôle des frontières vérifie qu'un module n'importe d'un autre que son
  `service.ts`.

---

## Lot 24b — Comptes et envois

### Partie G — Mots de passe compromis (SEC-03, décision Q22, décision D2)

Un mot de passe connu comme compromis est refusé : à la création d'un compte, à l'acceptation
d'une invitation, à la réinitialisation. Le contrôle est local, sans appel sortant ni
sous-traitant. Il s'appuie sur une dépendance tenue à jour (Q22), avec son ADR.

### Partie H — Délai croissant après les échecs (SEC-04)

Après dix échecs de connexion, ou de demande de lien, pour un même compte ou une même adresse IP,
le délai double à chaque nouvelle série : 1, 2, 4, 8 minutes, plafonné à 1 heure. Le
comportement est testé avec une horloge simulée.

### Partie I — Sessions et révocation (SEC-05, SEC-06, décision D3)

- **Cookies** : un test vérifie les attributs `HttpOnly`, `Secure` (en production) et
  `SameSite`. Le cookie est prolongé à chaque activité, comme la session : la déconnexion arrive
  bien après 8 heures **d'inactivité**, et non 8 heures après la connexion. Testé avec une horloge
  simulée.
- **« Déconnecter tous mes appareils »**, dans Mon compte : coupe toutes les autres sessions et
  les appareils de confiance.
- **Retrait d'un membre** (D3) : la titulaire retire l'accès d'un collaborateur. Ses sessions sont
  coupées et il ne peut plus se connecter (SC-S2).
- **Délai** : une session révoquée est refusée à la requête suivante, sans attendre (contrôle à
  chaque requête). Le test vérifie moins d'une minute.

### Partie J — Plafond d'envois et piège à robots (SEC-22, décision D5)

- **Plafond** : un nombre maximal d'e-mails envoyés par organisation et par heure, réglé par
  l'Admin. Atteint, l'envoi est refusé avec un message clair, une ligne va au journal, et la
  titulaire est prévenue (bandeau à l'accueil).
- **Formulaires publics** (mot de passe oublié, acceptation d'invitation) : limitation de débit
  (déjà là), plus un **piège à robots** (champ caché qu'un humain ne remplit pas).

### Partie K — Suite d'abus, SC-S1 à SC-S6 (SEC-36)

Un fichier de parcours e2e rejoue les scénarios de sécurité du § 17 :

| Scénario | Ce qui est rejoué |
| --- | --- |
| SC-S1 | Identifiant d'une autre organisation sur chaque route (partie C) |
| SC-S2 | Collaborateur retiré qui rejoue une requête avec sa session encore ouverte (partie I) |
| SC-S3 | Lien d'un prestataire hors de sa portée : **au lot 26** (les liens personnels n'existent pas encore). Le test est écrit, marqué « à venir » |
| SC-S4 | Lien de client expiré, puis lien d'un autre événement (invitations de l'espace du marié) |
| SC-S5 | Fichier de test antivirus (EICAR), puis fichier au type falsifié |
| SC-S6 | Mot de passe oublié demandé 200 fois en une minute ; envoi au-delà du plafond (partie J) |

---

## Tests (un `describe` par exigence)

Chaque partie ci-dessus porte ses tests :
- en intégration : base, authentification, app ;
- en e2e : ordinateur et 375 px, avec axe-core pour les écrans touchés ;
- en scripts : le chargeur du jeu fictif.

## Migrations

- 24a : index `organization_id`, une migration par module.
- 24b : retrait d'un membre (colonne de désactivation du compte), plafond d'envois (réglage de la
  plateforme, compteur par organisation).

Toutes ont leur script d'annulation.

## Documentation

- ADR de la dépendance des mots de passe (24b).
- ADR de l'écart ARC-01 (24a).
- Runbook « jeu fictif ».
- `docs/gap.csv`.
- Aide de « Mon compte » et de l'écran d'équipe.
- Rejeux SC-S1 à SC-S6 dans `docs/recette/`.

## Hors périmètre

- Les liens personnels des tiers et SC-S3 : lot 26.
- La gestion complète de l'équipe (inviter un collaborateur, changer un rôle) : lot à venir. Le 24b
  ne fait que le retrait (D3).
- Un formulaire de contact public : il n'existe pas encore. Le piège à robots s'appliquera à lui.

## Décisions à prendre

- **D1 — Découpage.** (a) Deux lots, 24a puis 24b, avec deux PR. (b) Un seul lot. **Recommandation :
  (a).** Le jeu fictif sert dès le 24b.
- **D2 — Liste des mots de passe compromis** (Q22 : une dépendance tenue à jour).
  - (a) La liste des mots de passe courants issus de fuites du paquet `@zxcvbn-ts/language-common`
    (licence MIT), seule, sans le calcul de robustesse.
  - (b) La liste des 100 000 mots de passe les plus répandus publiée par le NCSC britannique,
    versionnée dans le dépôt et mise à jour à la main.

  **Recommandation : (a).** C'est ce que tu as choisi : une dépendance tenue à jour, sans appel
  sortant. Je vérifierai sa taille, sa licence et sa dernière version avant de l'ajouter, et
  l'ADR le dira.
- **D3 — Retrait d'un membre.**
  - (a) Un écran « Équipe » minimal dans Paramètres, réservé à la titulaire : la liste des comptes
    de l'organisation et « Retirer l'accès ».
  - (b) Seulement « Déconnecter tous mes appareils » ; le retrait d'un membre attend la gestion de
    l'équipe.

  **Recommandation : (a).** SEC-06 et SC-S2 l'exigent, et c'est petit.
- **D4 — Refus d'accès journalisés.** (a) Oui, dans le journal de l'organisation de la personne,
  une ligne par minute et par route au plus. (b) Non, seulement dans le journal technique.
  **Recommandation : (a).** SC-S1 demande « Tentative journalisée », et la titulaire doit voir
  qu'un compte de son équipe sonde des identifiants.
- **D5 — Plafond d'envois par défaut.** (a) 100 e-mails par heure et par organisation, réglables
  par l'Admin. (b) Une autre valeur, à toi de la donner. **Recommandation : (a).** C'est bien
  au-delà de l'usage d'une wedding planner (relances, invitations, devis), et cela bloque un envoi
  en masse.
- **D6 — ARC-01.** (a) Un ADR d'écart : ARC-07 (les combinaisons de modules) tient lieu de preuve,
  et le contrôle des frontières vérifie qu'un module n'importe d'un autre que son `service.ts`.
  (b) Un job de CI qui retire chaque module et compile les autres avec des doublures de leurs
  services. **Recommandation : (a).** Le (b) testerait des doublures plutôt que l'app ; l'exigence
  vise le jour où un module est extrait (ADR 0011).
- **D7 — Jeu fictif.** (a) Il est créé par les services des modules, sous deux organisations
  « [Recette] » aux identifiants fixes, et refusé en production. (b) Il est inséré directement en
  base. **Recommandation : (a).** Les règles réelles (RLS, journal, chaîne) s'y appliquent, et le
  jeu reste juste quand le code change.

---

## Bilan du lot 24a (11/11/2026)

- **Jeu fictif** (DAT-10, D7) : `pnpm --filter @symbola/app seed:recette` charge les deux
  organisations « [Recette] » (identifiants fixes `7ec37e00-…-0001` et `…-0002`), 9 comptes,
  69 événements, catalogue, devis et échéancier, budget confirmé, 42 tâches, prestataires, par
  les services des modules. Refusé en production et sur une base où le jeu est déjà chargé ; les
  comptes et mots de passe vont dans un fichier hors du dépôt (mode 600). Runbook
  `docs/runbooks/jeu-fictif.md`, ligne de `CLAUDE.md` § 9. Pas encore dans le jeu, faute
  d'écran : invités, tables, accès payeur, comptable, liens des tiers.
- **Règle d'accès de chaque entrée** (SEC-12) : `lib/access-rules.test.ts` analyse avec le
  compilateur TypeScript chaque page, route et action serveur (plus de 150 actions) ; une entrée
  sans garde fait échouer le test, sauf les entrées publiques listées avec leur motif. Il
  remplace le contrôle des pages du lot 16.
- **Inexistant = interdit, refus journalisé** (SEC-13, SC-S1, D4) : `hub.access.refused` au
  journal de l'organisation de la personne (route, identifiants remplacés par `[id]`,
  identifiant demandé), au plus une ligne par minute, par personne et par route ; par la page
  introuvable commune pour les écrans, par `refusedResponse` pour les routes. Parcours e2e : les
  objets d'une autre organisation répondent comme des objets inexistants.
- **Journaux sans donnée personnelle** (SEC-20) : la console du serveur masque e-mails et
  téléphones, y compris dans les erreurs affichées par Next.js ; les suites d'intégration relèvent
  la console et échouent sur une donnée personnelle ; la CI contrôle la sortie du serveur pendant
  les parcours e2e. Aucune fuite trouvée dans le code actuel.
- **Index** (DAT-01) : 53 tables indexées sur `organization_id` (migrations 0095 à 0100, une par
  module, annulables) ; test de la base.
- **Combinaisons de modules** (ARC-07) : parcours e2e des 16 combinaisons. **ARC-01** : écart
  accepté (ADR 0062, D6).
- **Au passage** : un job e2e de la #96 annulé après 30 minutes. Cause : une compilation de
  Next.js 15.5 a perdu un composant client (`ProfileForm`) de son manifeste, et 13 parcours de
  `/parametres` ont échoué trois fois chacun. La relance du même code est passée. Défaut
  intermittent, jamais vu sur les 30 passages précédents.

**Reste, hors du 24a** :

- le 24b (comptes et envois : SEC-03 à SEC-06, SEC-22, SEC-36, SC-S2 à SC-S6) ;
- charger le jeu fictif sur le staging demandera un réglage explicite (le staging tourne avec
  `NODE_ENV=production`), à décider au déploiement d'ensemble ;
- au déploiement d'ensemble : migrations 0095 à 0100 (index seulement, quelques secondes).

## Bilan du lot 24b (11/11/2026)

- **Mots de passe compromis** (SEC-03, Q22, D2) : `checkPassword` (`@symbola/auth`) refuse un mot
  de passe de la liste `@zxcvbn-ts/language-common` (49 233 mots de passe issus de fuites, contrôle
  hors ligne). La liste ne comptant que 308 entrées de douze caractères ou plus, la **base** du mot
  de passe est comparée aussi (minuscules, sans chiffres ni symboles en bordure, sans
  substitutions, sans répétition) : « Password1234! » est refusé. Une seule règle pour la
  réinitialisation et les deux invitations (le module Événements recopiait la longueur). ADR 0063.
- **Délai croissant** (SEC-04) : à partir du dixième échec des dernières 24 heures, par compte et
  par adresse (mot de passe faux, demande de lien refusée), la tentative suivante attend 1, puis
  2, 4, 8… minutes, jusqu'à 1 heure ; une connexion réussie remet le compte à zéro. S'ajoute à la
  fenêtre glissante et au verrouillage ; le message donne le plus long des délais.
- **Cookie de session** (SEC-05) : prolongé à chaque navigation, comme la session en base (8 heures
  sans activité) ; HttpOnly, SameSite=Lax, Secure en production, testés.
- **Révocation** (SEC-06, D3) : Paramètres › Équipe (titulaire) liste les comptes de l'équipe et
  retire l'accès d'un collaborateur après confirmation (migration 0101) : sessions et appareils de
  confiance supprimés, connexion et lien de réinitialisation refusés, session refusée dès la
  requête suivante, ligne au journal. « Déconnecter tous mes autres appareils » dans Mon compte et
  l'espace du marié.
- **Envois** (SEC-22, D5) : plafond de 100 e-mails par heure et par organisation, réglable par
  l'Admin (migration 0102), pour les e-mails vers une adresse saisie (signataires, mariés invités) ;
  au-delà, refus avec le délai, ligne au journal (une par heure) et bandeau à l'accueil. Piège à
  robots sur les cinq formulaires publics.
- **Suite d'abus** (SEC-36) : `e2e/sec-36-suite-abus.spec.ts` rejoue SC-S1, S2, S4, S5 et S6 ;
  SC-S3 est écrit et marqué « à venir » (lot 26). Au passage, SC-S4 a montré qu'un lien de marié
  expiré affichait encore le formulaire : la page le refuse désormais dès l'ouverture.

**Reste, hors du 24b** :

- SC-S3 et les liens personnels des prestataires (lot 26) ;
- la gestion complète de l'équipe (inviter un collaborateur, changer un rôle, rendre un accès) ;
- une liste de mots de passe français (`@zxcvbn-ts/language-fr`), si Julien le souhaite (ADR 0063) ;
- au déploiement d'ensemble : migrations 0101 et 0102.
