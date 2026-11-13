# Questions pour Julien — rapport d'écart du 11 novembre 2026

Ces questions viennent de la comparaison entre `docs/CAHIER_DES_CHARGES.md` (le « nouveau
document »), le dépôt au commit `eca005f` et les documents existants : `CLAUDE.md`,
`docs/cahier-des-charges.md`, `docs/PRD-MVP.md`, `docs/lots/` et les ADR. Le § 1 du nouveau
document et `CLAUDE.md` demandent tous deux de signaler les contradictions sans trancher : aucune
n'est tranchée ici. Le contexte détaillé est dans `docs/GAP_REPORT.md`.

**Julien a répondu le 11 novembre 2026** : ses décisions sont consignées juste en dessous. Les
questions d'origine suivent, inchangées, pour garder le contexte.

## Décisions de Julien du 11 novembre 2026

| Question | Décision | Conséquence |
| --- | --- | --- |
| Q1 Identifiants | (a) Les anciens identifiants sont préfixés (`PRD-HUB-28`, `L21-HUB-28`) ; les identifiants sans préfixe sont ceux du nouveau document. | Les `describe` des tests et les documents existants sont renommés au lot 25. |
| Q2 Document de référence | (a) Le nouveau document remplace l'ancien cahier des charges et le PRD. | Les anciens documents sont archivés dans `docs/` et `CLAUDE.md` est réécrit (lot 25). |
| Q3 Identité | (b) Bascule vers un fournisseur d'identité open source. | Un ADR remplace l'ADR 0013 et choisit le fournisseur (licence, JUR-18). C'est un nouveau service sur le VPS (NFR-27), avec reprise des comptes. Les ADR 0037 et 0038 prennent fin à la bascule. Lot 33, probablement deux lots. |
| Q4 Accès des tiers | (a) Liens personnels pour le client, le prestataire et l'invité. | L'ADR 0020 est remplacé. Sans données réelles en production (Q15), aucun compte client n'est à reprendre. |
| Q5 Inscription | (a) Inscription libre dès le pilote. | Lot 33. |
| Q6 Hors ligne | (a) Hors-ligne en lecture au MVP. | Lots 29 et 30. Une dépendance de service worker te sera demandée, avec un ADR. |
| Q7 Statuts | (a) Statuts du nouveau document. | Avec Q2, la décision EVT-13 du lot 12 tombe : le rétroplanning naît à la création de l'évènement (EVT-01). Lot 34. |
| Q8 Budget | (a) Cinq montants. | L'ADR 0032 est remplacé. Lot 28. |
| Q9 Prestataires | Statuts alignés sur le nouveau document. | Lot 28. |
| Q10 Purge | (b) Purge automatique avec préavis. | Avenant à l'ADR 0024. Lot 34. |
| Q11 Accessibilité | WCAG 2.2 AA. | Lot 40. |
| Q12 Anglais | L'anglais est conservé. | Voir le point à confirmer C1. |
| Q13 Charte | (a) `DESIGN.md` adopté. | Refonte visuelle, et un ADR qui remplace le 0025. Je propose un lot 25b de jetons et de composants **avant** les lots 26 à 32, pour ne pas construire les nouveaux écrans deux fois. |
| Q14 Fichiers | (b) Garage reste sur le VPS pendant le pilote ; bascule au palier 2. | ADR qui assume l'écart pendant le pilote (NFR-31, ARC-11). |
| Q15 Sauvegarde | (1) Pas de données réelles en production. (2) Un fournisseur européen bon marché dans la durée. (3) Proposition demandée, voir ci-dessous. (4) Test mensuel sur serveur vierge après le pilote. | Le lot 22 doit être livré **avant la première donnée réelle**. |
| Q16 OpenAPI | Impacts à expliquer. | Voir ci-dessous. |
| Q17 Contact | (a) Table de contacts dans le hub. | Lot 36. |
| Q18 E-mail | Envoi depuis le domaine du planner, sinon envoi par défaut depuis le domaine de Symbola. | Le service d'e-mail reste à choisir. Il doit gérer plusieurs domaines d'envoi, chacun avec son authentification (DKIM). Lots 38 et 55. |
| Q19 Client professionnel | Aucun pendant le pilote. | Le lot 41 garde sa place. |
| Q20 Plateforme agréée | Gardée en feuille de route. | Lot 42. |
| Q21 Paiement | Benchmark à faire. | Avant le lot 43. Un benchmark assumé peut nommer les prestataires (Q25). |
| Q22 Mots de passe compromis | Une dépendance tenue à jour. | Je proposerai le paquet et l'ADR au lot 24. |
| Q23 « Terminé » | La définition du nouveau document, exclusivement. | `CLAUDE.md` § 7 est remplacé. Chaque exigence n'est terminée que si son scénario passe : voir l'explication de Q24. |
| Q24 Rejeu | Impacts à expliquer. | Voir ci-dessous. |
| Q25 Fichiers de l'archive | Versés. Noms retirés, sauf dans un benchmark assumé. | Versés le 11 novembre : `docs/CAHIER_DES_CHARGES.md`, `DESIGN.md` à la racine, `docs/maquette/`, `docs/schemas/`, `docs/recette/`. Les noms ne restent que dans le tableau du § 4 (le benchmark). La liste des sources du § 20 renvoie au § 4. Le `LISEZ-MOI.md` de l'archive n'est pas versé. |
| Q26 Lots | Numérotation à partir de 22. | — |
| Q27 Erreurs | Un nouveau service de suivi des erreurs. | ADR (NFR-27). Lot 40. |
| Q28 Choix commerciaux | Plus tard. | — |
| Q29 Points juridiques | Impacts à expliquer. | Voir ci-dessous. |
| Q30 Rôles | Renommer le rôle d'exploitation. | Lot 33 ou 52. |
| Q31 Accès d'exploitation | Les tracer. | Lot 23. |
| Q32 Fenêtre de déploiement | Une règle écrite, appliquée à la main. | ADR qui assume l'écart avec la vérification de NFR-07 (lot 25). |

### Q15.3 — Proposition : des sauvegardes que le serveur ne peut pas effacer

**Recommandation : un espace de sauvegarde chez Hetzner (Storage Box BX11), avec copies
instantanées automatiques.**

- **Prix** : 1 To pour 3,20 € HT par mois, soit environ 3,81 € TTC. C'est un prix catalogue, pas
  une remise de première année. Le trafic est illimité. Les copies instantanées ne sont pas
  facturées à part, mais elles prennent de la place sur le To ([offre BX11](https://www.hetzner.com/storage/storage-box/bx11?country=at),
  [documentation des copies](https://docs.hetzner.com/robot/storage-box/snapshots)).
- **Fournisseur européen distinct de Contabo**, comme l'exige NFR-10 : une suspension du compte
  Contabo ou une panne chez lui n'emporte pas les sauvegardes.
- **Fonctionnement** :
  - restic envoie la sauvegarde chiffrée par SFTP, avec une clé SSH propre à un sous-compte
    ([tutoriel Hetzner](https://community.hetzner.com/tutorials/storagebox-restic-docker-backup)).
    Les dépôts actuels changent seulement d'adresse.
  - Hetzner prend lui-même une copie instantanée chaque jour, et en garde dix (dix emplacements
    automatiques sur la BX11, la plus ancienne remplacée).
  - Ces copies sont en lecture seule. Elles ne se suppriment que depuis la console Hetzner, dont
    les identifiants ne vont **jamais** sur le VPS.
- **Ce que ça protège** : un VPS compromis peut effacer le dépôt restic, mais pas les copies des
  dix derniers jours. On restaure alors depuis la dernière copie saine (NFR-13).
- **Rétention** : restic garde 7 quotidiennes, 4 hebdomadaires et 12 mensuelles, contre 6
  mensuelles aujourd'hui (NFR-13). Les fichiers de Garage sont déjà dans la sauvegarde.
- **À vérifier au lot 22, avant de compter dessus** : Hetzner ne dit pas noir sur blanc qu'un accès
  SFTP ne peut pas toucher aux copies. C'est le fonctionnement normal des copies de ce type de
  système de fichiers, mais il faut le prouver : depuis le VPS, la suppression d'une copie doit
  échouer.
- **Je te recommande aussi un test de restauration depuis ce nouveau dépôt à la livraison du lot
  22**, même si le test mensuel est reporté après le pilote : c'est la seule preuve que la
  sauvegarde externe se relit.

**Alternative** : stockage d'objets avec verrouillage chez Scaleway, en France. Une zone coûte
environ 0,0075 € par Go et par mois, soit quelques centimes pour nos volumes
([tarifs Scaleway](https://www.scaleway.com/en/pricing/storage/)). Le verrouillage interdit toute
suppression avant l'échéance : c'est la protection la plus forte, et elle est documentée. Mais
restic s'y accorde mal : il faut garder les versions des fichiers, et une restauration après
attaque est plus délicate.

**Écartée** : le stockage d'objets de Contabo. Il sait verrouiller les fichiers
([guide Contabo](https://contabo.com/blog/kb/103000282887-how-do-i-use-object-locking-on-files-in-my-object-storage)),
mais c'est le fournisseur du VPS, et NFR-10 demande un autre fournisseur.

### Q16 — Expliqué : contrats TypeScript ou OpenAPI

- **Aujourd'hui** : les modules se parlent par des fonctions (`service.ts`). Leur forme est
  décrite dans `packages/contracts`, vérifiée par le compilateur et par des tests de contrat. Tout
  tourne dans la même application, et aucun de ces appels ne passe par le réseau.
- **OpenAPI** : un fichier standard qui décrit des adresses HTTP (routes, paramètres, réponses).
  Il sert quand un **autre programme** appelle Symbola par le réseau : un module sorti en service
  séparé, l'API publique (HUB-30, P2) ou un partenaire.
- **Adopter OpenAPI maintenant** : il faudrait décrire une seconde fois des appels qui ne passent
  jamais par le réseau, ajouter un générateur (une dépendance) et faire chaque changement deux
  fois. La pilote n'y verrait aucune différence.
- **Garder TypeScript** : rien à faire maintenant. On écrit le fichier OpenAPI le jour où une API
  sort de l'application (API publique, webhooks pour des tiers, module extrait), comme le prévoit
  l'ADR 0011. Le seul coût : la ligne ARC-04 reste « Divergente », justifiée par cet ADR.
- **Ma recommandation** : TypeScript à l'intérieur, OpenAPI obligatoire pour toute API exposée à
  l'extérieur. Un « d'accord » suffit.

### Q24 — Expliqué : le rejeu des scénarios

- **Pourquoi c'est devenu important** : le nouveau document ne valide un parcours que si son
  scénario passe (§ 17). Depuis ta réponse à Q23, c'est aussi la définition de « terminé » de
  **chaque** exigence. Le rejeu devient donc une étape de chaque lot, pas une recette finale.
- **Ce qu'est un rejeu** : quelqu'un, un agent ou toi, joue un profil fictif (Camille, Léa…) avec
  ses limites : son appareil, sa patience, ses mots. Il le fait sur des données fictives, note
  chaque étape de 0 à 3 et écrit un compte rendu `docs/recette/SC-xx.md`, avec captures.
- **Ce qui manque** :
  - charger le jeu fictif `docs/recette/symbola-synthetic-users.json` en une commande (DAT-10,
    absent aujourd'hui) ;
  - un lieu : en local, Claude Code pilote le navigateur et écrit le compte rendu ; sur le
    staging, qui n'admet que des données fictives, la recette se fait avant chaque porte.
- **Sans ça** : aucun lot ne peut être déclaré terminé selon la nouvelle définition.
- **Ma proposition** :
  - avancer le chargeur du jeu fictif (DAT-10) dans le lot 24 ;
  - rejeu en local par Claude Code à chaque lot ;
  - rejeu sur le staging par toi, ou par la pilote, aux portes 1 et 2 ;
  - ne pas tout rejouer maintenant : presque tout bloque sur des fonctions absentes, on
    n'apprendrait rien de plus que le rapport.

### Q29 — Expliqué : les points juridiques « à valider »

- **De quoi il s'agit** : dix questions de droit et de fiscalité que le document ne tranche pas, et
  que je ne dois pas trancher non plus. Leur réponse change le comportement du produit. Deux
  exemples :
  - si la rétractation de quatorze jours s'applique à l'organisation d'un mariage, le contrat doit
    l'annoncer, et l'acompte ne s'encaisse pas avant, sauf demande expresse du client ;
  - si une micro-entrepreneuse en franchise de TVA doit déclarer ses ventes aux particuliers,
    l'export doit le faire.
- **Ce n'est pas à toi de répondre.** Mais c'est à toi, futur éditeur, de poser ces questions aux
  bons professionnels :
  - **expert-comptable** (celui de la pilote peut suffire pour commencer) : franchise et réforme
    (JUR-03, JUR-04), article 286 du CGI (JUR-05), mentions obligatoires (JUR-01) ;
  - **avocat** en droit de la consommation et des contrats : rétractation (JUR-07), mandat et
    commissions (JUR-10), modèles de contrats (JUR-20), niveau de signature (JUR-14),
    accessibilité (JUR-17) ;
  - **juriste du logiciel libre** : licences de Documenso et du futur fournisseur d'identité
    (JUR-18) ;
  - **délégué à la protection des données** ou consultant RGPD : données des invités et analyse
    d'impact (RGP-06 à RGP-08, RGP-19), offre Couple.
- **Quand** : avant le lot qui les traduit dans le produit. Le lot 31 (contrats) a besoin de
  JUR-07, JUR-08, JUR-09, JUR-14 et JUR-20. Les lots 41 et 42 ont besoin de JUR-03 à JUR-05. Le
  reste doit être levé avant la porte 3 (ouverture commerciale).
- **En attendant** : je code les deux cas quand c'est possible, comme JUR-07 le demande déjà
  (délai respecté, ou demande expresse tracée).
- **Ma proposition** : je prépare une fiche par professionnel dans `docs/conformite/`, avec une
  page de contexte, des questions fermées et ce que fera le produit selon chaque réponse. Tes
  rendez-vous seront courts.

### Points confirmés par Julien le 11 novembre 2026

Julien a validé les cinq recommandations (« Oui, toutes ») :

- **C1 — Anglais et « terminé »** : chaque écran garde ses textes en français et en anglais
  (règle de `CLAUDE.md`). L'anglais ne fait plus partie de la définition de « terminé », qui est
  celle du nouveau document.
- **C2 — Fournisseur de sauvegarde** : Hetzner Storage Box, avec copies instantanées
  automatiques (lot 22).
- **C3 — Contrats d'API** : TypeScript à l'intérieur de l'application, OpenAPI obligatoire pour
  toute API exposée à l'extérieur. ARC-04 reste « Divergent », justifié par l'ADR 0011, que le
  lot 25 complète.
- **C4 — Rejeu des scénarios** : chargeur du jeu fictif au lot 24, rejeu en local à chaque lot,
  rejeu sur le staging aux portes 1 et 2.
- **C5 — Fiches juridiques** : préparées le 11 novembre, brouillons à relire avant envoi :
  `docs/conformite/fiche-expert-comptable.md` (10 questions, dont l'arrondi de la TVA ajouté
  au lot 25), `docs/conformite/fiche-avocat.md`
  (11 questions, dont les licences) et `docs/conformite/fiche-dpo.md` (10 questions). Chacune dit
  ce que fera Symbola selon la réponse et avant quel lot elle est attendue.

---

Les questions d'origine suivent. Pour chacune : ce que disent les documents, pourquoi c'est
important, les options possibles (sans recommandation tranchée) et les lots qui en dépendent.

---

## Référentiel

### Q1 — Les identifiants entrent en collision · **bloquante**

- **Constat** : le nouveau document demande de citer ses identifiants dans les commits, les tests
  et le rapport (§ 1). Or les mêmes préfixes existent déjà avec un autre sens dans le PRD et les
  lots, et les `describe` des tests les utilisent :
  - HUB-01 à HUB-29 (PRD et lots 10 à 21) contre HUB-01 à HUB-30 ;
  - EVT-01 à EVT-22 contre EVT-01 à EVT-11 ;
  - BUD-01 à BUD-04 contre BUD-01 à BUD-12 ;
  - PRE-01 à PRE-20 contre PRE-01 à PRE-11 ;
  - SEC-01 à SEC-03 (lot 16) contre SEC-01 à SEC-37 ;
  - ARC-01 (lot 16) contre ARC-01 à ARC-20.

  Par exemple, HUB-28 désigne aujourd'hui « le menu des réglages défile seul » et, dans le
  nouveau document, les automatisations.
- **Pourquoi** : un test nommé `HUB-28` deviendrait ambigu, et l'historique des commits aussi.
- **Options** : (a) préfixer les anciens identifiants (`PRD-HUB-28`, `L21-HUB-28`) et réserver les
  identifiants nus au nouveau document ; (b) préfixer les nouveaux (`CDC-HUB-28`) ; (c) garder les
  deux et tenir une table de correspondance dans `docs/`.
- **Débloque** : tout lot, puisque chaque test et chaque commit cite un identifiant.

### Q2 — Quel document fait foi ? · **bloquante**

- **Constat** : `CLAUDE.md` § 1 désigne comme sources de vérité `docs/cahier-des-charges.md`, le
  PRD-MVP, `docs/lots/` et `docs/adr/`. Le nouveau document se présente comme « la cible ». Il
  n'est pas encore dans le dépôt : j'ai seulement créé `docs/GAP_REPORT.md`, `docs/gap.csv` et ce
  fichier.
- **Options** : (a) le nouveau document remplace l'ancien cahier des charges et le PRD, archivés
  dans `docs/` ; (b) il s'y ajoute, avec une règle de priorité écrite dans `CLAUDE.md` ; (c) il ne
  sert que de grille d'écart, et le PRD reste la référence des stories.
- **Débloque** : la mise à jour de `CLAUDE.md` (NFR-24, lot 25) et l'ordre de tous les lots. La
  définition de « terminé » en découle (Q23).

---

## Décisions déjà prises que le nouveau document contredit

### Q3 — Identité : authentification maison ou fournisseur d'identité ? · **bloquante**

- **Constat** :
  - SEC-01 (P0) : « Le code de Symbola ne stocke aucun mot de passe », avec un fournisseur
    OpenID Connect (§ 10).
  - HUB-01 : connexion par lien magique, mot de passe ou clé d'accès.
  - L'ADR 0013 a choisi une authentification maison (argon2id) pour le MVP. Les ADR 0037 et 0038
    l'ont renforcée.
  - `CLAUDE.md` se contredit lui-même : le principe 6 dit « authentification et MFA par Zitadel…
    ne jamais écrire… son propre stockage de mots de passe », le tableau de la pile dit
    « authentification maison (argon2id…) ».
  - Le nouveau document se contredit aussi : son § 2 dit qu'« un choix différent déjà en place se
    documente, il ne se réécrit pas », alors que SEC-01 est en P0.
- **Options** : (a) garder l'authentification maison, écrire un ADR qui assume l'écart et ajouter
  ce qui manque (mots de passe compromis SEC-03, clés d'accès, lien magique, alertes SEC-08) ;
  (b) basculer vers un fournisseur d'identité open source, comme prévu par l'ADR 0013 (coût de
  bascule décrit dans sa section « Conséquences ») ; (c) garder l'existant au pilote et basculer
  avant l'ouverture commerciale.
- **Débloque** : lots 25 et 33, puis 52 ; SEC-07 ne s'applique que si le lien magique est retenu.

### Q4 — Accès des clients, prestataires et invités : compte ou lien personnel ? · **bloquante**

- **Constat** : UX-11, POR-01 et SEC-14 à SEC-17 (P0) veulent un lien personnel sans compte,
  limité en portée et en durée, avec un code à usage unique pour les actions sensibles. L'ADR 0020
  et le PRD EVT-06 font créer un compte à chaque marié, double authentification proposée.
  Prestataires et invités n'ont aujourd'hui aucun accès.
- **Options** : (a) remplacer l'ADR 0020 par un accès par lien pour tous les tiers ; (b) lien pour
  les prestataires et les invités, compte maintenu pour les mariés ; (c) lien par défaut, compte
  facultatif pour le client qui le souhaite.
- **À trancher aussi** : que deviennent les comptes clients existants sur le staging ou en
  production ?
- **Débloque** : lots 26 et 27, puis 47 et 49 ; scénarios SC-06, SC-S3, SC-S4.

### Q5 — Inscription en libre-service ou organisation créée par l'Admin ? · **bloquante**

- **Constat** : HUB-01, HUB-02 et PAR-01 (P0) veulent une inscription par la seule adresse
  e-mail, une organisation créée à l'inscription, et un utilisateur dans plusieurs organisations.
  Le PRD HUB-03 fait créer l'organisation par l'Admin, qui invite la titulaire. Le schéma rattache
  chaque utilisateur à une seule organisation (`hub.users.organization_id`, e-mail unique).
- **Options** : (a) inscription libre dès le pilote ; (b) inscription libre seulement à
  l'ouverture commerciale, l'Admin gardant la main pendant le pilote ; (c) multi-organisation
  repoussée en V1.
- **Débloque** : lot 33 ; scénarios SC-01 et SC-10, qui bloquent tous deux à l'étape 1.

### Q6 — Jour J hors ligne et application installable · **bloquante**

- **Constat** :
  - ARC-09, JRJ-01 à JRJ-04 et NFR-09 sont en P0 : le mode Jour J doit s'ouvrir en mode avion.
  - Le PRD § 10 dit : « pas de mode hors connexion (page "hors ligne" seulement) ».
  - `CLAUDE.md` § 3 annonce une « PWA installable », mais le dépôt n'a ni manifeste ni service
    worker (`apps/symbola/public`).
- **Options** : (a) hors-ligne en lecture au MVP, comme le demande le nouveau document ; (b) PWA
  installable d'abord, hors-ligne en V1 ; (c) un PDF du jour J téléchargé la veille comme solution
  d'attente.
- **À noter** : un service worker propre demandera peut-être une dépendance hors de la pile. Je te
  la demanderai avant de l'ajouter, avec un ADR.
- **Débloque** : lots 29 et 30 ; scénario SC-08.

### Q7 — Statuts d'évènement et rétroplanning à la création

- **Constat** :
  - EVT-05 (P0) fixe les statuts Option, Confirmé, En préparation, Jour J, Clôturé, Reporté et
    Annulé, avec un report qui décale le rétroplanning.
  - Le PRD EVT-02 fixe Prospect, Devis envoyé, Confirmé, Réalisé et Perdu (code actuel).
  - EVT-01 génère le rétroplanning à la création, alors que ta décision EVT-13 du lot 12 le
    réserve aux évènements confirmés.
- **Options** : (a) adopter les statuts du nouveau document ; (b) garder ceux du PRD et ajouter
  Reporté et Annulé ; (c) une liste de statuts paramétrable (HUB-20 l'interdit-il pour les
  statuts ?).
- **Débloque** : lot 34 ; scénario SC-01, étape 5.

### Q8 — Budget : deux montants ou cinq ?

- **Constat** : BUD-01 (P0) demande estimé, devisé, engagé, payé et reste à payer. Le PRD BUD-02
  et l'ADR 0032 ont retenu prévu, réel et écart.
- **Options** : (a) passer aux cinq montants ; (b) garder prévu et réel et dériver « engagé » et
  « payé » des échéances ; (c) cinq montants côté planner, trois côté client (POR-05).
- **Débloque** : lot 28 ; scénario SC-04.

### Q9 — Prestataires : statuts et place dans le MVP

- **Constat** :
  - PRE-01 et PRE-02 sont en P0, avec les statuts Pressenti, Consulté, Devis reçu, Retenu,
    Contrat signé et Soldé.
  - Le PRD mettait les prestataires hors MVP. Le carnet a été construit au lot 11 avec d'autres
    statuts : À trouver, Devis demandé, Devis reçu, Réservé, Non requis.
- **Question** : faut-il aligner les statuts sur le nouveau document, ou garder les tiens et
  documenter l'écart ?
- **Débloque** : lot 28.

### Q10 — Purge RGPD : active par défaut ou validée à la main ?

- **Constat** : RGP-05 (P0) veut une purge active sans aucun réglage. Le PRD RGPD-05 et l'ADR 0024
  disent « rien n'est purgé sans validation » : tu valides la liste chaque mois.
- **Options** : (a) garder la validation et l'assumer par un avenant à l'ADR 0024 ; (b) purge
  automatique avec préavis (le modèle de RGP-08 pour les invités) ; (c) automatique pour certaines
  catégories, validée pour d'autres.
- **Débloque** : lot 25.

### Q11 — Accessibilité : WCAG 2.1 ou 2.2 ?

- **Constat** : UX-14, NFR-17 et JUR-17 visent WCAG 2.2 AA. Le PRD § 10 visait 2.1 AA, et c'est
  ce que contrôle axe-core aujourd'hui.
- **Question** : passe-t-on à 2.2 dès le MVP, ou à l'ouverture commerciale ?
- **Débloque** : lot 40.

### Q12 — Langue anglaise

- **Constat** : HUB-19 demande seulement le français au lancement, avec des textes externalisés.
  `CLAUDE.md` (principe 9 et définition de « terminé ») exige FR et EN pour chaque story, ce qui
  est fait aujourd'hui.
- **Question** : l'anglais reste-t-il obligatoire pour chaque nouvelle story ?

### Q13 — Charte graphique : `DESIGN.md` ou ADR 0025 ?

- **Constat** : le nouveau document exige un fichier `DESIGN.md` à la racine. Ses jetons sont
  Space Grotesk et Inter, et l'émeraude #0F6E5C, et « aucun écran n'emploie une valeur hors
  jeton ». L'application suit l'ADR 0025 : Fraunces et Inter, avec la palette de
  `apps/symbola/app/globals.css`.
- **Options** : (a) adopter `DESIGN.md`, ce qui demande une refonte visuelle et un ADR qui
  remplace le 0025 ; (b) garder la charte actuelle et écrire un `DESIGN.md` qui la décrit ; (c)
  adopter les jetons progressivement, écran par écran.
- **À noter** : une nouvelle police (Space Grotesk) serait servie par l'app, comme Fraunces
  (licence OFL à vérifier).

---

## Infrastructure et données

### Q14 — Fichiers hors du disque du VPS · **bloquante**

- **Constat** : NFR-31 (P0) dit que les fichiers et les sauvegardes doivent être séparés du
  serveur applicatif et extensibles sans migration. ARC-11 précise « aucun fichier sur le disque
  du serveur ». Aujourd'hui, Garage (ADR 0015) stocke les fichiers sur un volume du VPS.
- **Options** : (a) un stockage d'objets européen hébergé (le § 3 cite des tarifs d'environ un
  centime par Go et par mois) à la place de Garage ; (b) garder Garage pour le pilote et basculer
  au palier 2 ; (c) garder Garage et répliquer ses fichiers vers un stockage externe.
- **À noter** : toute action sur le VPS, les secrets ou le DNS reste la tienne. Un nouveau
  fournisseur est aussi un sous-traitant à lister (RGP-13).
- **Débloque** : lot 22.

### Q15 — Sauvegarde externe, et des données réelles sont-elles déjà en production ? · **bloquante**

- **Constat** :
  - NFR-10 (P0) exige une sauvegarde chiffrée hors du VPS, chez un autre fournisseur, « dès la
    première donnée réelle ».
  - NFR-13 exige que le serveur ne puisse pas effacer ses propres sauvegardes, avec 12
    mensuelles.
  - Aujourd'hui, les dépôts restic sont dans `/srv/backups/restic/<env>` sur le VPS, avec 6
    mensuelles, et c'est le VPS qui lance `restic forget`.
  - Un seul test de restauration est consigné : le 26 octobre, sur le staging.
- **Questions** : (1) La production contient-elle déjà des données réelles de la pilote ? Si oui,
  le risque est immédiat. (2) Quel fournisseur pour le dépôt externe ? (3) Comment empêcher
  l'effacement (dépôt en ajout seul, verrouillage d'objets) ? (4) Qui fait le test mensuel sur un
  serveur vierge, et où ?
- **Débloque** : lot 22, donc la porte 1.

### Q16 — Contrats d'API : OpenAPI ou contrats TypeScript ?

- **Constat** : ARC-04 (P0) veut des contrats OpenAPI écrits avant le code. L'ADR 0011 garde des
  contrats TypeScript (`packages/contracts`) et ne passe à OpenAPI qu'à l'extraction d'un module.
- **Question** : l'ADR 0011 suffit-il comme justification (ligne notée Divergent) ?

### Q17 — Où vit le contact unique ?

- **Constat** : CRM-03 et DAT-12 (P0) exigent une fiche contact unique par adresse e-mail, et
  ARC-03 place le contact dans le noyau du hub. Aujourd'hui, les clients sont saisis par évènement
  (`events.event_clients`), les signataires sont recopiés sur chaque devis, et les prestataires
  ont leur propre fiche.
- **Options** : (a) table de contacts dans le hub ; (b) nouveau module « contacts » avec son
  `service.ts` ; (c) commencer par les clients, puis rattacher les prestataires.
- **À noter** : c'est un changement de schéma important, avec une reprise des données existantes.
  Probablement deux lots.
- **Débloque** : lot 36.

### Q18 — Service d'e-mail

- **Constat** : la question est restée ouverte dans le PRD (§ 11). Uptime Kuma utilise une boîte
  provisoire. Le nouveau document demande un service hébergé en Union européenne (§ 10), des
  modèles aux couleurs de l'organisation et, en V1, l'envoi depuis le domaine du planner (MSG-04).
- **Question** : quel service retient-on ? C'est un sous-traitant à lister (RGP-13).
- **Débloque** : lot 38.

---

## Facturation et paiement

### Q19 — Facturer un client professionnel pendant le pilote ?

- **Constat** : l'application refuse aujourd'hui toute facture à un client professionnel (« facture
  Factur-X… pas encore disponible », `apps/symbola/modules/quotes/service.ts:294-298`). Factur-X
  est en P1 (FAC-10), avec une échéance légale au 1er septembre 2027.
- **Question** : la pilote a-t-elle des clients entreprises à facturer avant le lot 41 ? Si oui,
  faut-il avancer ce lot, ou autoriser en attendant une facture PDF classique ?

### Q20 — Quelle plateforme agréée ?

- **Constat** : le PRD DEV-04 cite une plateforme agréée précise. Le nouveau document demande un
  connecteur en production avant l'été 2027 (JUR-03).
- **Question** : ce choix est-il confirmé ? Le connecteur sera une brique derrière une interface
  (ARC-12) : la retenir tôt fixe le calendrier des lots 41 et 42.

### Q21 — Quel prestataire de paiement ?

- **Constat** : `CLAUDE.md` dit « paiements par Stripe plus tard ». Le nouveau document demande un
  « prestataire de paiement européen avec carte et SEPA » (§ 10) et aucune commission Symbola
  (§ 3).
- **Question** : lequel retient-on pour le lot 43 ?

---

## Sécurité

### Q22 — Mots de passe compromis : liste locale ou service externe ?

- **Constat** : SEC-03 (P0) exige de refuser les mots de passe connus comme compromis. Deux
  voies : embarquer une liste dans l'application, ou interroger un service externe par préfixe
  d'empreinte (sans envoyer le mot de passe). La seconde crée un appel sortant et un
  sous-traitant. La première peut demander une dépendance.
- **Question** : quelle voie préfères-tu ? Je te demanderai l'accord pour toute dépendance.
- **Débloque** : lot 24.

### Q30 — Rôles : « Admin » et « Administrateur »

- **Constat** :
  - Dans le code, « admin » désigne l'opérateur de Symbola, sans accès aux données métier
    (ADR 0029).
  - Le nouveau document appelle « Administrateur » un rôle **d'organisation** (HUB-03) et
    « comptes d'exploitation » l'opérateur (SEC-09).
  - HUB-03 veut aussi Propriétaire et Planner dès le MVP, alors que le PRD mettait « multi-planners »
    hors MVP.
- **Questions** : faut-il renommer le rôle d'exploitation pour éviter la confusion ? Les rôles
  Planner, Assistant et Comptable entrent-ils au MVP ou en V1 ?

### Q31 — Accès d'exploitation à la base

- **Constat** : SEC-09 exige que tout accès d'exploitation aux données clients soit tracé dans le
  journal de l'organisation et motivé. La sauvegarde, la restauration et les commandes `psql` du
  runbook accèdent à toute la base sans trace dans ce journal.
- **Question** : faut-il tracer ces gestes (journal du VPS, ligne dans le journal d'audit), ou
  assumer l'écart par un ADR ?

---

## Recette et méthode

### Q23 — Quelle définition de « terminé » ?

- **Constat** : les deux définitions diffèrent.
  - Le nouveau document (§ 1) exige que le scénario Synthetic User concerné passe, que la chaîne
    de sécurité soit verte et que l'aide de l'écran soit à jour.
  - `CLAUDE.md` § 7 exige FR et EN, le registre RGPD, 375 px et axe-core, une visite guidée, un
    essai avec données de test et des articles d'aide.
- **Question** : laquelle s'applique aux prochains lots, ou faut-il cumuler les deux ?

### Q24 — Rejeu réel des scénarios

- **Constat** : j'ai rejoué les scénarios de la section 17 sur pièces seulement. Le jeu
  `symbola-synthetic-users.json` ne se charge pas en une commande (DAT-10 absent). Le nouveau
  document attend un fichier `docs/recette/SC-xx.md` par scénario, avec captures.
- **Questions** : où rejoue-t-on (en local, sur le staging, qui n'admet que des données
  fictives) ? Faut-il écrire d'abord le chargeur du jeu synthétique (lot 40), ou rejouer à la main
  dès maintenant les étapes notées « à jouer » ?

### Q25 — Quels fichiers de l'archive verser dans le dépôt ?

- **Constat** : l'archive contient aussi `docs/CAHIER_DES_CHARGES.md`, `DESIGN.md` (à la racine,
  selon le document), `docs/maquette/`, `docs/schemas/` et `docs/recette/`. Je n'en ai rien copié :
  ta demande portait sur les trois documents d'analyse.
- **Point d'attention** : le § 4 et les sources du § 20 du cahier des charges nomment des logiciels
  concurrents, y compris l'outil actuel de la pilote. Ta règle est de ne jamais les nommer dans le
  dépôt.
- **Questions** : verse-t-on ces fichiers ? Si oui, faut-il une copie du cahier des charges sans
  ces noms ?

### Q26 — Numérotation des lots

- **Question** : je propose de continuer la numérotation existante (lot 22 et suivants, branches
  `lot-<n>-<nom>`). Te convient-elle ?

### Q27 — Suivi des erreurs

- **Constat** : la pile de référence (§ 10) prévoit un « suivi d'erreurs auto-hébergé », et
  NFR-16 veut une référence d'erreur retrouvable dans les journaux. Il n'y a aujourd'hui que des
  journaux applicatifs et Uptime Kuma.
- **Question** : se contente-t-on d'une référence d'erreur dans les journaux, ou ajoute-t-on un
  composant ? Ce serait un nouveau service sur le VPS (NFR-27), donc un ADR.

### Q32 — Fenêtre de déploiement

- **Constat** : NFR-07 (P0) interdit tout déploiement du vendredi midi au lundi matin, « sauf
  correctif urgent motivé ». C'est toi qui déploies à la main (`docs/runbooks/deploiement.md`).
- **Question** : un garde dans le script de déploiement, avec un motif obligatoire pour forcer,
  te convient-il, ou une règle écrite suffit-elle ?

---

## Points que je ne tranche pas (commerciaux et juridiques)

### Q28 — Choix commerciaux ouverts (§ 3)

Le nouveau document les laisse ouverts. Je les note pour mémoire, sans proposition :

- l'offre Couple en direct ;
- le prix du module Espaces couples (départ proposé : 15 € HT par mois) ;
- les forfaits d'agence (prix, volume d'IA, ce qui les distingue avant l'IA) ;
- le quota de stockage par offre ;
- l'alerte à 80 % du volume d'IA et l'arrêt une fois le volume épuisé.

Le produit devra seulement les rendre paramétrables (ARC-06, DOC-12, IA-06).

### Q29 — Points juridiques « à valider » (§ 20)

Ils ne sont pas tranchés et je ne les tranche pas :

- franchise de TVA et réforme (JUR-03, JUR-04) ;
- article 286 du CGI et attestation (JUR-05) ;
- exception de rétractation pour une prestation à date fixe (JUR-07) ;
- mandat et commissions (JUR-10) ;
- rôle RGPD dans l'offre Couple ;
- base légale et durée pour les invités, et analyse d'impact (RGP-06 à RGP-08, RGP-19) ;
- accessibilité (JUR-17) ;
- licences de Documenso et du fournisseur d'identité (JUR-18) ;
- relecture des modèles de contrat (JUR-20) ;
- niveau de signature (JUR-14).

**Question** : qui les fait valider (expert-comptable, avocat, délégué à la protection des
données), et avant quel lot ? Les lots 31, 41, 42 et 57 en dépendent.

---

## Questions ouvertes du lot 28

### Q33 — Budget : une ligne par poste, ou des lignes sous chaque catégorie ?

BUD-01 demande un budget « par catégories et lignes ». L'app tient **une ligne par poste** de
l'évènement (Lieu, Traiteur…), qui sert de catégorie. Le jeu fictif, lui, range plusieurs lignes
sous un même poste : « Location du domaine », « Ménage et gardiennage » et « Mobilier
complémentaire » sous « Lieu de réception » (EV-REF-01). La spécification du lot 28, validée le
11/11, ne l'avait pas relevé ; le lot 28a garde une ligne par poste (BUD-01 reste Partiel).

- (a) Plusieurs lignes par poste, le poste devenant la catégorie : chaque ligne a ses cinq
  montants, son prestataire, ses échéances et ses documents ; la catégorie totalise. À faire au
  28b, avant l'échéancier, qui s'accroche à la ligne.
- (b) Garder une ligne par poste ; le détail (location, ménage, mobilier) reste dans le devis du
  prestataire.

**Recommandation : (a)**, au début du 28b : l'échéancier et les documents du 28b se rattachent à
une ligne, et la migration est plus simple avant qu'après.

**Décision de Julien (12/11/2026) : (a), au début du 28b.**

---

## Réponses de l'avocat (13 novembre 2026)

### Q34 — Ce que les réponses de l'avocat demandent hors du lot 31

L'avocat a répondu aux onze questions de `docs/conformite/fiche-avocat.md` ; Julien confirme que
les points marqués « à vérifier » sont validés. La note reste hors du dépôt, qui est public. Ce que
le lot 31 en fait est dans sa spécification (révision du 13/11/2026, décisions D11 à D17). Le
reste se range en trois groupes. L'expert-comptable et la DPO ont répondu ensuite (Q35, Q36).

**Actions de Julien, sans code (je ne peux pas les faire) :**

- **Avant toute donnée réelle de la pilote** (réponse 8) : créer la société (ou une entreprise
  individuelle), souscrire l'assurance et ouvrir le compte ; puis l'accord de sous-traitance avec
  la pilote (article 28 du RGPD), le registre des traitements (comme sous-traitant et comme
  responsable), les mentions légales, la politique de confidentialité, le plan de sécurité et la
  procédure en cas de violation, la liste des sous-traitants ultérieurs. **D'ici là, la pilote
  reste sur des données fictives.**
- **Avant le premier client payant** (réponse 8) : conditions générales d'utilisation et de vente,
  niveaux de service, réversibilité au sens du Data Act (préavis, transition, récupération puis
  effacement des données), circuit de paiement par un prestataire agréé qui verse directement à la
  planner (Symbola ne détient jamais les fonds, lot 43), bannière et politique de cookies,
  assurance responsabilité civile et cyber de l'éditeur.
- **Documenso** (réponses 5 et 10) : demander à l'éditeur une confirmation écrite que l'édition
  communautaire, non modifiée et appelée par son API, convient à un service payant ; sinon,
  budgéter l'édition Business. La signature avancée et la réauthentification relèvent de toute
  façon de l'édition payante.
- **Modèles** (réponse 6) : faire relire par un avocat inscrit les trois modèles de départ
  (contrat de prestation, mandat, conditions générales), puis à chaque évolution légale.
- **Marque** (réponse 11) : recherche d'antériorités par un conseil en propriété industrielle, puis
  dépôt (classes 9, 42 et 35), puis communication. Point de vigilance : « Symbola » est aussi le
  nom d'une police de caractères répandue.

**Choix à faire pour des lots à venir :**

- **Niveau de signature** (réponse 5, JUR-14) : choisir un fournisseur de SMS (nouveau
  sous-traitant, hors de la pile : ADR) et le moyen de la signature avancée (édition payante de
  Documenso ou autre prestataire). Un lot à part, après le 31b.
- **Fournisseur d'identité** (réponse 10, lot 33) : le critère de licence de l'ADR 0052 se précise
  en Apache ou MIT (Keycloak, Ory) ; éviter un second composant AGPL et les fonctions
  « enterprise » sans licence. À reprendre dans l'ADR du lot 33.

**Exigences précisées (pas de nouvelle décision) :**

- **Commissions** (réponse 4, JUR-10, lot 48) : affichage obligatoire pour un client particulier,
  mode intermédiaire ou revendeur par ligne du devis, alerte et blocage du modèle standard pour un
  forfait touristique.
- **Clients entreprises** (réponse 7, lot 41) : délai de paiement de 30 jours par défaut,
  pénalités à trois fois le taux d'intérêt légal, indemnité de 40 €, escompte « Néant », numéro de
  bon de commande s'il existe ; sur le devis et la facture, verrouillés hors des bornes légales ;
  facturation électronique.
- **Accessibilité** (réponse 9, JUR-17, lot 40) : garder WCAG 2.2 AA, publier une déclaration
  d'accessibilité volontaire pour les écrans du couple, consigner l'analyse d'exemption.
- **Licences** (réponse 10, JUR-18) : tenir l'inventaire des dépendances et de leurs licences dès
  maintenant (lot 40 au plus tard).

### Q35 — Ce que les réponses de la DPO demandent (13 novembre 2026)

Réponses vérifiées aux questions 1 à 11 de `docs/conformite/fiche-dpo.md` (résumé dans la fiche ;
la question 11, posée à part, a reçu sa réponse le même jour). Rien ne change pour le lot 31.

**Actions de Julien, sans code :**

- **Analyse d'impact** : une analyse « socle » du module Invités (outil gratuit de la CNIL), que
  chaque planner complète, **avant la première donnée réelle d'invité**, donc avant d'ouvrir le
  lot 49 à la pilote. Avec un registre prérempli pour les planners, et le registre de Symbola
  comme sous-traitant.
- **Accord de sous-traitance** : le contenu minimal de l'article 28.3 ; réutilisation des données
  des planners interdite par défaut ; chaîne de sous-traitance pour un évènement d'entreprise ;
  purge automatique inscrite comme instruction du planner ; violation signalée au planner sous
  24 heures ; changement de sous-traitant ultérieur annoncé 30 jours avant (15 jours en urgence
  de sécurité), avec opposition et résiliation sans pénalité.
- **Offre « couples »** : Symbola en serait responsable de traitement ; produit distinct, avec sa
  politique de confidentialité.

**Choix à faire :**

- **Journal d'audit** (question 11) : aujourd'hui rien n'en est purgé, ce que la DPO juge non
  conforme, « à corriger dès maintenant, même provisoirement ». Lot à part, court : 12 mois
  glissants pour les gestes courants, 3 ans pour les accès de l'équipe Symbola à la base, la durée
  des pièces comptables (10 ans) pour les factures et encaissements dans un flux à part ; journal
  découpé par date, segments supprimés à l'échéance, points de contrôle d'intégrité ; notice aux
  collaborateurs à l'invitation et à la première connexion, consultable depuis le profil ; chacun
  voit son propre journal ; mention type pour la titulaire. Les adresses IP sont déjà purgées à
  12 mois (lot 23). (a) Juste après le lot 31, avant les lots suivants ; (b) avec les lots 34 et
  35. **Recommandation : (a)** : rien n'est déployé avant la fin du rapport d'écart (gel), mais la
  durée sans limite ne doit pas partir avec le déploiement d'ensemble.
- **Sauvegardes** : la DPO demande une rotation de 35 jours au plus et un journal des effacements
  rejoué après toute restauration. Aujourd'hui, la sauvegarde garde 7 copies quotidiennes,
  4 hebdomadaires et **12 mensuelles** (`infra/backup/backup.sh`) : des données effacées survivent
  jusqu'à un an. (a) Réduire à 35 jours et ajouter le rejeu des effacements à la restauration
  (lot à part : réglage du serveur, runbook, test) ; (b) garder 12 mois en le justifiant dans
  l'analyse d'impact. Touche le VPS : ta décision. **Recommandation : (a)**, avant la première
  donnée réelle. Les sauvegardes mensuelles gardent aussi les adresses IP au-delà des 12 mois
  validés (question 11 : « un seul exemplaire »).

**À vérifier sur le VPS (Julien)** : que le Caddy partagé et le service d'e-mails ne gardent pas
les adresses IP plus de 12 mois (question 11) ; sinon, régler leurs journaux.

**Exigences précisées (pas de nouvelle décision) :**

- **Invités** (lot 49) : intérêt légitime avec test de mise en balance documenté ; information de
  l'invité au premier contact et droit d'opposition ; accord pour les régimes et allergies donné
  par l'invité lui-même par son lien (ou le représentant légal d'un enfant, déclaré), preuve
  gardée (horodatage, version du texte, canal), retrait aussi simple ; pas de champ libre ;
  compteur qui ne dévoile pas un régime unique dans un petit groupe ; ni lien ni compte pour un
  enfant ; régimes purgés 7 jours après l'évènement, le reste 30 jours après ; un seul report,
  90 jours au plus ; gel pour litige à part.
- **Liens** (lot 43, SEC-16) : code à usage unique aussi pour voir et modifier les données
  sensibles, envoyé au seul contact enregistré ; tentatives limitées, code bref, révocation par la
  personne, alerte sur un nouvel appareil.
- **Relances** (lot 45, CRM-06, RGP-17) : consentement préalable d'un particulier (case non
  précochée), planner identifié comme expéditeur, information à la collecte, listes d'opposition.
- **Conservation** (lots 34 et 35) : base active et archivage intermédiaire séparés ; copie d'une
  pièce d'identité supprimée après vérification ; export avant purge et corbeille courte.

### Q36 — Ce que les réponses de l'expert-comptable demandent (13 novembre 2026)

Réponses vérifiées aux questions 1 à 10 de `docs/conformite/fiche-expert-comptable.md`, puis à la
question des arrhes, posée à part (résumé dans la fiche). Ce qui touche le lot 31 y est (D18 à
D22) : en particulier, plus de « facture d'arrhes ».

**Actions de Julien, sans code :**

- **Planner pilote** : la réception des factures électroniques est obligatoire pour toute
  entreprise depuis le 1er septembre 2026 (plateforme agréée, annuaire). Vérifier qu'elle est
  prête : c'est hors de Symbola, mais elle en aura besoin.
- **Loi de finances pour 2027** : en surveiller le vote définitif (calendrier de la réforme).

**Exigences précisées (pas de nouvelle décision) :**

- **Lot 41** : les quatre mentions de la réforme entre assujettis, la catégorie de l'opération
  imprimée sur toutes les factures, le numéro de bon de commande, PDF/A-3 pour Factur-X, totaux
  identiques au centime entre PDF et fichier structuré ; émission vers les entreprises au
  1er septembre 2027, franchise comprise.
- **Lot 42** : e-reporting agrégé (catégorie LB/PS/LBPS, ventilation par taux, motif
  d'exonération), encaissements de services dans un flux à part, par une plateforme agréée ; en
  franchise, par bimestre ; article 286 seulement pour l'assujetti, avec l'attestation de
  l'éditeur sur le modèle de l'administration ; exports pour le comptable (journal des recettes,
  journal des ventes et des encaissements, FEC) et accès en lecture seule.
- **Lot 34** (annulation d'un évènement, EVT-05) : constat de renonciation quand le client
  renonce à des arrhes (ni facture ni avoir) ; document de restitution du double quand la planner
  renonce (sans TVA).
- **Lot 42** (suite) : les arrhes restent hors de l'e-reporting tant qu'elles ne sont pas imputées
  sur le prix.
- **Lot 48** : la TVA diffère entre intermédiaire transparent (honoraires) et revendeur (total
  refacturé) ; en franchise, le mode revendeur peut faire dépasser le seuil ; la qualité
  d'intermédiaire repose sur le contrat.

---

## Remarques sur le nouveau document lui-même

- Les tableaux PRE, INV, POR, DOC, MSG, JRJ, RPT et TPS sont placés en annexe (§ 20), alors que
  `gap.csv` les rattache à la section 8. C'est sans effet sur l'analyse, mais à corriger à la
  prochaine exportation.
- SC-08 exige un contraste de 7:1 sur l'écran du Jour J (cohérent avec `DESIGN.md`), au-delà du
  niveau AA demandé ailleurs (4,5:1). C'est cohérent, juste plus exigeant : à garder en tête au
  lot 30.
- La section 2 dit que la pile est libre, qu'un choix en place se documente et ne se réécrit pas.
  Plusieurs exigences P0 imposent pourtant un choix précis : SEC-01, ARC-04, ARC-11. Les
  questions Q3, Q14 et Q16 en découlent.
