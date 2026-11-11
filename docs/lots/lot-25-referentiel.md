# Lot 25 — Nouveau référentiel, ADR et identifiants

**Statut** : spécification validée par Julien le 11/11/2026 (« Oui, les trois » : D1 a, D2 a,
D3 a). Aucun changement de comportement de l'app. Branche `lot-25-referentiel`.

Identifiants : ceux de `docs/CAHIER_DES_CHARGES.md`. Un identifiant préfixé (`PRD-EVT-03`,
`L16-SEC-01`) désigne l'ancien référentiel (décision Q1).

## Contexte

Le rapport d'écart (`docs/GAP_REPORT.md`, § 6, 7 et 9) et les décisions du 11/11/2026
(`docs/QUESTIONS.md`) font du nouveau cahier des charges la seule référence (Q2). Rien de cela
n'est encore dans le dépôt :

- les documents du nouveau référentiel sont restés hors de Git, dans la copie de travail ;
- `CLAUDE.md` désigne toujours l'ancien cahier des charges et le PRD comme sources de vérité ;
- les mêmes identifiants désignent deux choses : `HUB-28` est « le menu des réglages défile
  seul » dans les tests du lot 21, et les automatisations dans le nouveau document.

**Ce que doit garantir le lot** : un seul référentiel dans le dépôt ; un agent de code qui lit
`CLAUDE.md` applique les règles du nouveau document (NFR-24) ; chaque écart accepté a son ADR ;
un identifiant sans préfixe ne désigne plus que le nouveau document.

**Exigences** : NFR-24 ; SEC-01, ARC-04, DAT-02, RGP-05, NFR-07 (ADR) ; DAT-05 (règle
d'arrondi) ; RGP-13 (liste datée des sous-traitants) ; NFR-31 et ARC-11 (renvoi à l'ADR 0051).

## Partie A — Verser le nouveau référentiel

Fichiers aujourd'hui non suivis dans la copie de travail, versés tels quels :

- `docs/CAHIER_DES_CHARGES.md`, `DESIGN.md` (racine), `docs/maquette/`, `docs/schemas/`,
  `docs/recette/` (archive de Julien, Q25 : noms de concurrents retirés hors du benchmark du § 4) ;
- `docs/GAP_REPORT.md`, `docs/gap.csv`, `docs/QUESTIONS.md`, `docs/conformite/` (rapport d'écart,
  décisions, fiches pour l'expert-comptable, l'avocat et le délégué à la protection des données).

Contrôles : Gitleaks et Semgrep passent sur les maquettes HTML ; relecture des noms de
concurrents (seulement dans le tableau du § 4).

**Après la fusion** : ces fichiers existent aussi, non suivis, dans la copie principale de
Julien. Ils devront y être retirés avant son prochain `git pull`, sinon Git refuse de les
écraser. La commande sera donnée dans la pull request.

## Partie B — Archiver l'ancien référentiel

- `docs/cahier-des-charges.md` → `docs/archive/cahier-des-charges-v1.md` ;
- `docs/PRD-MVP.md` → `docs/archive/PRD-MVP.md`.

Chacun reçoit un bandeau : archivé le 11/11/2026, remplacé par `docs/CAHIER_DES_CHARGES.md`
(Q2) ; ses identifiants se lisent avec le préfixe `PRD-`. Le texte archivé n'est pas réécrit.
Les liens qui pointent vers ces deux fichiers sont mis à jour.

## Partie C — Réécrire `CLAUDE.md` (NFR-24)

Même structure, pas plus long qu'aujourd'hui :

- **§ 1 Sources de vérité** : `docs/CAHIER_DES_CHARGES.md` (et son § 1, adressé à l'agent),
  `DESIGN.md`, `docs/gap.csv`, `docs/lots/`, `docs/adr/` ; règle des identifiants (Q1) ;
  l'ancien référentiel est archivé.
- **§ 2 Principes** : chaque principe cite les exigences ARC et SEC qu'il porte. Changements :
  identité vers un fournisseur open source (SEC-01, lot 33 ; authentification maison d'ici là) ;
  tiers par lien personnel (Q4) ; purge automatique avec préavis (Q10).
- **§ 3 Pile** : sauvegarde sur Hetzner Storage Box (ADR 0051), alertes ntfy, cible identité.
- **§ 6 Tests** : `describe` avec l'identifiant du nouveau document ; rejeu du scénario en local
  à chaque lot (C4).
- **§ 7 Terminé** : la définition du nouveau document (§ 1), exclusivement (Q23). Le français et
  l'anglais restent une règle d'écriture, hors de cette définition (C1).
- **§ 8 Méthode** : lots numérotés à partir de 22 (Q26).
- **§ 9 Commandes** : `sudo git pull` depuis la session `julien` (voir partie G).

## Partie D — ADR

| N° | Titre | Remplace ou complète | Exigences | Mise en œuvre |
| --- | --- | --- | --- | --- |
| 0052 | Identité : fournisseur d'identité open source | Remplacera 0013, 0037 et 0038 à la bascule | SEC-01, HUB-01 | Lot 33 |
| 0053 | Accès des tiers par lien personnel | Remplace 0020 | UX-11, POR-01, POR-10, SEC-14, SEC-15, SEC-17 | Lot 26 |
| 0054 | Budget à cinq montants | Remplace 0032 | BUD-01 à BUD-04 | Lot 28 |
| 0055 | Statuts d'évènement, report, annulation, rétroplanning à la création | Remplace la décision L12-EVT-13 | EVT-01, EVT-03, EVT-05 | Lot 34 |
| 0056 | Purge RGPD automatique avec préavis | Avenant à 0024 | RGP-05 | Lot 34 |
| 0057 | Charte graphique `DESIGN.md` | Remplace 0025 | — | Lot 25b |
| 0058 | Fenêtre de déploiement : règle écrite, appliquée à la main | — (écart assumé, Q32) | NFR-07 | — |
| 0059 | Arrondi des montants et de la TVA | — | DAT-05 | Selon la décision D3 |

**Avenants datés** (une section ajoutée, la décision d'origine n'est pas réécrite) :

- 0011 : TypeScript à l'intérieur de l'app, OpenAPI obligatoire pour toute API exposée à
  l'extérieur (C3) ; ARC-04 reste « Divergent », justifié ici ;
- 0012 : DAT-02, pas de clé étrangère entre schémas de modules, clés primaires non devinables ;
- 0027 : ARC-11, fichiers servis par l'app après contrôle des droits ; le lien de partage limité
  dans le temps pour les tiers (DOC-04) viendra avec les lots 26 et 37 ;
- 0051 : déjà écrit (§ 6, Garage sur le VPS pendant le pilote, NFR-31 et ARC-11) : renvoi
  seulement.

**Pas dans ce lot** : hors-ligne (lot 29, avec la dépendance de service worker), contact unique
(lot 36), mots de passe compromis (lot 24), suivi des erreurs (lot 40).

## Partie E — Liste des sous-traitants (RGP-13)

`docs/conformite/sous-traitants.md`, datée : fournisseur, rôle, données concernées, pays,
garantie. Premiers éléments connus : Contabo (serveur), Hetzner (sauvegardes chiffrées,
Finlande), IONOS (envoi des e-mails), IGN (géocodage des adresses), ntfy.sh (alertes
d'exploitation, sans donnée personnelle), GitHub (code et intégration continue, sans donnée de
client). Le pays et la garantie de chacun sont vérifiés sur la documentation du fournisseur ; ce
qui ne l'est pas est marqué « à vérifier ». La publication sur le site viendra au lot 57.

## Partie F — Préfixer les anciens identifiants (Q1)

**Mesure du 11/11/2026** (`origin/main`) : environ 1 300 occurrences dans environ 400 fichiers
(EVT 417, HUB 321, PRE 262, BUD 138, SEC 121, ARC 27 ; les 60 occurrences de NFR viennent
surtout du lot 22, qui utilise déjà les nouveaux identifiants).

- **Règle** : `PRD-<id>` pour un identifiant défini dans le PRD ; `L<n>-<id>` pour un
  identifiant défini dans la spécification du lot n (`L16-SEC-01`, `L21-HUB-28`).
- **Table de correspondance** : `docs/referentiel/correspondance-identifiants.md` (ancien
  identifiant, nouveau nom, document d'origine, titre), tirée du PRD et de `docs/lots/`, puis
  relue à la main.
- **Outil** : `tools/referentiel/prefix-legacy-ids.mjs` applique la table (mot entier, familles
  retenues par la décision D1), renomme aussi les fichiers (`e2e/evt-06.spec.ts` →
  `e2e/prd-evt-06.spec.ts`) et a son test.
- **Exclus** : les migrations SQL déjà appliquées (`packages/db`, immuables) ; `docs/archive/` ;
  le nouveau cahier des charges et les documents du rapport d'écart (ils citent déjà les deux
  référentiels explicitement) ; l'historique Git ; les nouveaux identifiants déjà utilisés au
  lot 22 (NFR-10 à NFR-14, NFR-30, NFR-31, ARC-11) ; les textes affichés à l'utilisateur
  (aucun identifiant n'y est attendu : vérifié avant d'appliquer).
- **Contrôles** : lint, types, tests, `check:boundaries`, parcours bout en bout en CI ; diff relu
  par échantillon ; recherche finale d'un ancien identifiant resté sans préfixe.

## Partie G — Retours de la mise en service du lot 22

- `docs/runbooks/deploiement.md` : `sudo git pull` depuis la session `julien`, jamais depuis un
  shell `sudo -i` (Git refuse alors le dépôt).
- `docs/runbooks/surveillance.md` (étape 6) et `restauration.md` (§ 6) : l'URL Push se saisit
  sans sa partie `?status=…`. `disk-check.sh` et `backup.sh` ignorent cette partie si elle est
  restée (une alerte « down » ne doit jamais arriver comme « up »), avec un test.
- `restauration.md` § 5 : relevé du test du 11/11/2026 (staging, Storage Box, instantané
  b0e26260, 5,44 MiB, 1 min 1 s, OK) ; § 2 : accès root par `ssh symbola` puis `sudo -i`.
- Les relevés des § 7 et § 8 attendent la phase C, reportée par Julien.

## Décisions de Julien (11/11/2026 : a, a, a)

- **D1 — Portée du préfixe.** (a) Seulement les familles en collision : EVT, HUB, BUD, PRE, SEC,
  ARC (et NFR s'il en reste d'anciens). (b) Tous les anciens identifiants, y compris DEV, SOC,
  IMP, RGPD, AIDE, ONB, GEO et DB. **Recommandation : (a).** Ces autres familles n'existent pas
  dans le nouveau document : un `DEV-02` nu ne peut pas être mal lu, et on évite environ
  200 occurrences de plus.
- **D2 — Choix du fournisseur d'identité.** (a) L'ADR 0052 acte la bascule et fixe les critères
  (licence compatible avec JUR-18, OpenID Connect, clés d'accès, lien magique, double
  authentification, hébergeable sur le VPS, reprise des comptes) ; le comparatif et le choix se
  font au lot 33. (b) Comparatif et choix maintenant, dans le lot 25. **Recommandation : (a).**
  Le lot 25 reste un lot de documentation ; le choix sera fait quand il servira.
- **D3 — Arrondi de la TVA (DAT-05).** Aujourd'hui, la TVA est calculée **par taux**, sur la base
  totale de ce taux, arrondie une fois au centime (demi vers le haut) :
  `apps/symbola/modules/quotes/amounts.ts`. Le nouveau document demande « par ligne puis
  totalisée ». (a) Garder la règle actuelle et l'écrire dans l'ADR 0059 ; DAT-05 est noté
  « Divergent », justifié. (b) Passer au calcul par ligne au lot 31a. **Recommandation : (a).**
  C'est le calcul de la norme européenne de facture électronique (EN 16931), que suit
  Factur-X (lots 41 et 42). Le calcul par ligne y créerait des écarts d'arrondi. La question
  est ajoutée à la fiche de l'expert-comptable pour confirmation.

## Découpage

Un commit par partie (A à G, F en deux : table et outil, puis résultat), une pull request.

## Vérification

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:boundaries`, shellcheck ; parcours bout
  en bout en CI.
- `CLAUDE.md` cite les identifiants ARC et SEC qu'il impose (critère de NFR-24).
- Aucun ancien identifiant des familles retenues ne reste sans préfixe hors des exclusions.
