# Rapport d'écart — Symbola face au cahier des charges du 11 novembre 2026

2026-11-11 · rédigé par Claude Code pour Julien · état du dépôt : `main` au commit `eca005f` (lot 21 fusionné)

Ce rapport compare l'application existante aux 367 exigences de `docs/CAHIER_DES_CHARGES.md`
(copie du 11 novembre 2026, archive `symbola-dossier-agent.zip`). Il suit le protocole de la
section 1 et le plan de la section 18. La grille ligne par ligne est dans `docs/gap.csv`. Les
questions sont dans `docs/QUESTIONS.md`. **Aucun code n'a été modifié.**

## Méthode et limites

- **Inventaire en lecture seule** : schéma de base (`packages/db/src/schema`, 84 migrations),
  routes et écrans (`apps/symbola/app`), modules (`apps/symbola/modules`), paquets partagés,
  tests (unitaires, intégration, 57 parcours Playwright), CI (`.github/workflows`), infrastructure
  (`infra/`), runbooks, ADR 0001 à 0050, PRD, spécifications des lots 0 à 21, audit du 8 novembre.
- **Preuves** : chaque statut cite un fichier, un test ou une décision. Un statut sans preuve vaut
  Absent (règle du § 1). Je n'ai lancé ni l'application ni les tests : un test cité existe et porte
  sur le critère, je ne l'ai pas rejoué ici.
- **Scénarios** : rejoués **sur pièces**, c'est-à-dire en confrontant chaque étape au code, sans
  navigateur. Une étape notée « à jouer » existe dans le code mais demande un essai réel pour être
  notée de 0 à 3. Le rejeu réel avec les Synthetic Users reste à faire (question Q24).
- **Effort** : S une demi-journée au plus, M deux jours au plus, L au-delà. **Risque** : risque de
  régression sur l'existant.
- **Lots** : numérotés à partir de 22, à la suite des lots déjà livrés. Lots 22 à 40 : P0. Lots
  41 à 59 : P1. « V2 » et « Au-delà » : P2 et P3.
- **Identifiants** : ceux du nouveau document. Plusieurs existent déjà avec un autre sens dans le
  PRD et les lots (HUB-01, EVT-03, SEC-01…). Dans ce rapport, « PRD EVT-03 » désigne l'ancien
  sens. Voir la question Q1, bloquante.

## 1. Synthèse en dix lignes

1. Le socle technique est solide. L'isolation des organisations est garantie par la base et prouvée par des tests. Les factures sont immuables et numérotées sans trou. La CI de sécurité est complète, le RGPD est outillé et l'import passe par un assistant.
2. L'application suit le PRD-MVP et l'ancien cahier des charges. Le nouveau document vise plus large (CRM, invités, Jour J hors ligne, portails sans compte) et tranche autrement plusieurs choix structurants.
3. Scores selon la règle de la section 18, après tes décisions du 11 novembre : **P0 52 %** (50 % si l'on refuse les divergences restantes), **P1 21 %**, **P2 6 %**. Sur 367 lignes : 33 Conforme, 170 Partiel, 137 Absent, 4 Divergent, 23 Sans objet.
4. **La porte 1 n'est pas franchie.** Trois raisons : la sauvegarde reste sur le disque du VPS, la restauration n'a jamais été faite sur un serveur vierge, et le journal d'audit est modifiable. 32 exigences P0 des domaines SEC, DAT et RGP ne sont pas conformes.
5. Quatre parcours P0 cassent de bout en bout :
   - PAR-01 : pas d'inscription libre ;
   - PAR-04 : budget à deux montants, sans validation par le client ;
   - PAR-06 : compte obligatoire pour le client ;
   - PAR-08 : pas de mode Jour J ni de hors-ligne.
6. Quatre décisions déjà prises contredisaient le nouveau document : comptes des mariés (ADR 0020), authentification maison (ADR 0013), pas de hors-ligne (PRD § 10), purge validée à la main (ADR 0024). Le 11 novembre, tu les as toutes tranchées en faveur du nouveau document (§ 9).
7. Les identifiants du nouveau document entrent en collision avec ceux du PRD et des lots. Il faut trancher avant d'écrire le moindre test ou commit.
8. **Échéance légale** : facture électronique au 1er septembre 2027. Aujourd'hui, une facture à un client professionnel est même refusée par l'application.
9. Plan proposé : 19 lots P0 (22 à 40), puis 19 lots P1 (41 à 59). Onze lots P0 changent le schéma de données et attendent ta validation (§ 1, étape 8).
10. Les huit questions bloquantes (Q1 à Q6, Q14, Q15) et les cinq points C1 à C5 sont tranchés depuis le 11 novembre (`docs/QUESTIONS.md`). Les points juridiques attendent les professionnels (fiches dans `docs/conformite/`).

## 2. Scores par domaine et par priorité

Calcul de la section 18 : Conforme et Divergent justifié par un ADR valent 1, Partiel 0,5, Absent 0 ;
Sans objet sort du calcul. Entre parenthèses, le nombre d'exigences notées. « strict » donne le score
si les divergences sont refusées (comptées 0) : il n'apparaît que là où il diffère.

| Domaine | P0 | P1 | P2 | P3 |
| --- | --- | --- | --- | --- |
| UX | 47 % (16) | 25 % (2) | — | — |
| PAR | 50 % (6) | 25 % (4) | 0 % (1) | — |
| HUB | 50 % (18) | 32 % (11) | 0 % (1) | — |
| CRM | 50 % (3) | 21 % (7) | 0 % (1) | — |
| RDV | — | 0 % (4) | 0 % (1) | — |
| EVT | 50 % (5) | 10 % (5) | 0 % (1) | — |
| CHR | 50 % (6) | 17 % (3) | 50 % (1) | — |
| BUD | 36 % (7) | 12 % (4) | 0 % (1) | — |
| FAC | 56 % (9) | 25 % (6) | 0 % (2) | — |
| PRE | 50 % (2) | 25 % (8) | 50 % (1) | — |
| INV | — | 0 % (7) | 0 % (4) | — |
| POR | 43 % (7) | 12 % (4) | — | — |
| DOC | 36 % (7) | 25 % (4) · 0 % strict | 0 % (1) | — |
| MSG | 50 % (2) | 0 % (3) | 0 % (1) | — |
| JRJ | 0 % (4) | 0 % (5) | — | — |
| RPT | — | 17 % (3) | 0 % (2) | — |
| TPS | — | — | 0 % (4) | — |
| GC | — | 0 % (3) | 9 % (11) | Sans objet (10) |
| IA | — | — | Sans objet (7) | — |
| ARC | 71 % (19) · 61 % strict | 100 % (1) | — | — |
| DAT | 62 % (13) · 54 % strict | 50 % (1) | — | — |
| SEC | 62 % (25) | 33 % (9) | Sans objet (1) | — |
| RGP | 64 % (7) | 11 % (9) | 0 % (2) | — |
| JUR | 44 % (9) | 22 % (9) | 0 % (1) | — |
| NFR | 41 % (17) | 36 % (14) | — | — |
| **Total** | **52 % (182) · 50 % strict** | **21 % (126) · 20 % strict** | **6 % (36)** | — |

Répartition des statuts (après tes décisions du 11 novembre) : P0 = 29 Conforme, 124 Partiel,
26 Absent, 3 Divergent, 1 Sans objet ; P1 = 4 Conforme, 42 Partiel, 79 Absent, 1 Divergent,
2 Sans objet. Le grand nombre de « Partiel »
en P0 reflète un produit réel mais construit sur d'autres critères : la fonction existe, un critère
du nouveau document échoue.

**Ce qui est déjà conforme** (33 lignes, entre autres) :

- isolation des organisations (SEC-10, SEC-11, ARC-08) ;
- frontières de modules contrôlées en CI (ARC-02) ;
- numérotation sans trou et factures figées (FAC-06, DAT-04) ;
- signature avec dossier de preuve (FAC-03, JUR-14) ;
- contrôle des fichiers déposés (SEC-21, DOC-05) ;
- chaîne de sécurité en CI (SEC-30 à SEC-32, SEC-34) ;
- secrets (SEC-23, ARC-15) ;
- migrations rejouables et annulables (DAT-09) ;
- textes externalisés en FR et EN (HUB-19, NFR-20) ;
- durées de conservation réglables (RGP-09) ;
- aucun traceur (RGP-16) ;
- évènements internes en outbox (ARC-05) ;
- aide guidée (HUB-11).

## 3. Les dix écarts les plus graves

Classés selon les règles d'arbitrage du § 1 : d'abord la perte de données et la sécurité, puis les
parcours P0 cassés.

| # | Écart | Exigences | Preuve | Lot |
| --- | --- | --- | --- | --- |
| 1 | **Les sauvegardes et les fichiers vivent sur le disque du VPS.** La sauvegarde restic est quotidienne et chiffrée, mais son dépôt est `/srv/backups/restic/<env>`, sur le même serveur et chez le même fournisseur. Garage, qui stocke les fichiers, tourne aussi sur ce disque. Une panne du disque, une erreur ou un rançongiciel emporte la base, les fichiers et les sauvegardes. Le serveur peut aussi effacer ses propres sauvegardes (`restic forget` lancé depuis le VPS) et n'en garde que 6 mensuelles, au lieu de 12. | NFR-10, NFR-13, NFR-31, ARC-11 | `infra/backup/backup.env.example` (RESTIC_REPOSITORY), `infra/backup/backup.sh:108-109`, `docs/runbooks/restauration.md` § 1 | 22 |
| 2 | **La restauration n'a été prouvée qu'une fois, le 26 octobre, sur le staging.** Elle n'a pas été refaite sur un serveur vierge. La remise en service après la perte du VPS n'a jamais été chronométrée. | NFR-11, NFR-12 | `docs/runbooks/restauration.md` § 5 (un seul relevé) | 22 |
| 3 | **Le journal d'audit est modifiable et ne couvre que l'Admin.** Le rôle applicatif a `UPDATE` et `DELETE` sur `hub.audit_log`. Ni les connexions, ni les exports, ni les émissions de factures, ni les encaissements, ni les suppressions n'y sont inscrits. | SEC-19, ARC-16, HUB-16, SEC-09 | `packages/db/drizzle/0010_grant_hub03_tables.sql`, `packages/db/src/schema/hub.ts` (audit_log) | 23 |
| 4 | **Les encaissements sont modifiables et rien n'est chaîné.** Une facture émise est bien bloquée par un déclencheur. Mais le paiement d'une échéance (`paid_on`, mode) reste une colonne modifiable, et aucune empreinte ne relie factures et encaissements. La facture émise n'est pas conservée comme fichier : elle est redessinée depuis son instantané. L'attestation de l'article 286 du CGI n'est donc pas possible. | FAC-14, JUR-05, DOC-08 | `packages/db/src/schema/quotes.ts` (payment_schedule_items, invoices), `apps/symbola/app/devis/factures/[invoiceId]/pdf/route.ts` | 23 |
| 5 | **Le client doit créer un compte avec mot de passe.** Prestataires et invités n'ont aucun accès. Le nouveau document veut des liens personnels sans compte, hachés, limités en portée et à durée réglable. | UX-11, POR-01, SEC-14, SEC-15, SEC-17 | `docs/adr/0020-acces-maries-par-evenement.md`, `apps/symbola/app/espace/invitation/[token]` | 26 (après Q4) |
| 6 | **Pas de mode Jour J et aucune application installable.** Il n'y a ni manifeste, ni service worker, ni cache : le jour J sans réseau est impossible. `CLAUDE.md` annonce pourtant une « PWA installable ». | JRJ-01 à JRJ-04, ARC-09, NFR-09 | `apps/symbola/public` (aide et carte seulement), PRD § 10 (« pas de mode hors connexion ») | 29, 30 (après Q6) |
| 7 | **Pas de contrat.** Aucun contrat ne se génère depuis un modèle à variables. L'application ne gère pas la rétractation de 14 jours, n'impose pas le choix entre acompte et arrhes, et ne demande ni l'assurance ni le médiateur. La signature porte seulement sur le devis. | FAC-04, DOC-02, JUR-07, JUR-08, JUR-09, JUR-20 | aucun modèle de contrat dans `packages/starter-templates/src` | 31 |
| 8 | **Le budget du client ne tient pas sa promesse.** Il a deux montants (prévu, réel) au lieu de cinq. Il n'y a ni échéancier par prestataire, ni validation d'une dépense par le client, ni seuil d'alerte sur l'enveloppe, ni export. | BUD-01, BUD-02, BUD-03, BUD-07, BUD-10 | `packages/db/src/schema/budget.ts`, `apps/symbola/app/espace/[id]/client-budget.tsx` (lecture seule) | 28, 27 |
| 9 | **Aucun export complet de l'organisation.** Le carnet de prestataires s'exporte, et l'export RGPD se fait personne par personne. Rien ne permet de partir avec toutes ses données ni de les réimporter. | HUB-13, RGP-11, DAT-13 | `apps/symbola/app/prestataires/export/route.ts`, `apps/symbola/app/rgpd` | 35 |
| 10 | **Pas d'inscription libre.** L'organisation est créée par l'Admin, avec un utilisateur pour une organisation. Ni lien magique, ni clé d'accès, et Symbola stocke lui-même les hachés de mots de passe, alors que SEC-01 l'interdit. | HUB-01, HUB-02, PAR-01, SEC-01 | `packages/db/src/schema/hub.ts` (users.password_hash, organization_id), `docs/adr/0013-auth-maison-pour-le-mvp.md` | 33 (après Q3, Q5) |

**À surveiller juste après** :

- **Factur-X.** Une facture à un client professionnel lève aujourd'hui « pas encore disponible » (`apps/symbola/modules/quotes/service.ts:294-298`). C'est une exigence P1, mais l'échéance légale du 1er septembre 2027 ne se déplace pas (FAC-10, JUR-02 à JUR-04 ; lots 41 et 42).
- **Contact unique.** Le même client se ressaisit d'un évènement à l'autre et sur chaque devis (CRM-03, UX-02 ; lot 36).

## 4. Les vingt vérifications de la section 18

| # | Question | Réponse sur pièces |
| --- | --- | --- |
| 1 | A lit-il un objet de B en changeant un identifiant ? (SEC-10) | Non. RLS et tests d'isolation par module (`packages/db/src/*-isolation.integration.test.ts`). |
| 2 | La base refuse-t-elle seule l'accès croisé ? (SEC-11) | Oui. Le rôle applicatif n'est ni propriétaire ni exempté (`roles.integration.test.ts`). |
| 3 | Sauvegarde externe, déjà restaurée ? (NFR-10, NFR-12) | Sauvegarde oui, mais **pas externe** : elle est sur le VPS. Une seule restauration, sur le staging, le 26 octobre. |
| 4 | Une facture émise se modifie-t-elle ? (FAC-06, FAC-14) | Non, un déclencheur l'en empêche (test). Mais les encaissements se modifient et rien n'est chaîné. |
| 5 | Trous de numérotation ? (FAC-06) | Non. Un test le vérifie (`invoices.integration.test.ts`). |
| 6 | Montants en centimes ? (ARC-17) | Oui, des colonnes `*_cents` entières partout. |
| 7 | Listes métier dans le code ? (HUB-20) | Les listes vivent en base. Les statuts (évènement, poste, devis) sont des énumérations fixes. Aucun test automatique ne cherche de libellés en dur. |
| 8 | Une app lit-elle les tables d'une autre ? (ARC-02) | Non. `check:boundaries` le vérifie en CI. |
| 9 | Retirer une app casse-t-il les autres ? (ARC-01, ARC-07) | La désactivation est testée. Le retrait du dossier et les combinaisons de modules ne le sont pas. |
| 10 | Le client crée-t-il un compte pour signer ? (UX-11) | Pas pour signer : Documenso envoie un lien. Mais il en faut un pour son espace. |
| 11 | Saisie en double entre prospect, devis, évènement, facture ? (UX-02) | Oui : les signataires et l'adresse de facturation se saisissent sur le devis, et les clients se saisissent par évènement. |
| 12 | Jour J en mode avion ? (JRJ-02) | Non. Il n'y a ni mode Jour J ni PWA. |
| 13 | Secrets dans le dépôt ou l'historique ? (SEC-23) | Gitleaks parcourt tout l'historique en CI (`fetch-depth: 0`). Je ne l'ai pas relancé ici. |
| 14 | Fichiers déposés contrôlés ? (SEC-21) | Oui : type réel, taille, ClamAV et fichier EICAR testés. |
| 15 | L'export complet se réimporte-t-il ? (HUB-13) | Il n'existe pas d'export complet. |
| 16 | Une donnée de démonstration part-elle vers un tiers ? (HUB-10) | La signature passe par un faux fournisseur. Les autres envois ne sont pas prouvés. |
| 17 | Envoi groupé sans écran de contrôle ? (MSG-02) | Pas d'envoi groupé à ce jour, et pas d'écran de contrôle. |
| 18 | Le portail passe-t-il axe-core ? (NFR-17) | axe-core tourne dans les parcours e2e, sur ordinateur et à 375 px, avec la cible WCAG 2.1. |
| 19 | Fichier d'instructions et guide d'installation ? (NFR-23, NFR-24) | `CLAUDE.md` existe, sans renvoi vers ce document. Il n'y a pas de guide d'installation. |
| 20 | Les e2e couvrent-ils les parcours P0 ? (NFR-21) | Ils couvrent les stories du PRD, pas les parcours PAR du nouveau document. |

## 5. Scénarios de la section 17, rejoués sur pièces

Notation : **Passe** = l'étape est réalisable dans le code actuel ; **À jouer** = la fonction existe,
la fluidité (note 1 à 3) demande un essai réel ; **Bloque** = la fonction manque (note 0).

| Scénario | Étapes | Verdict |
| --- | --- | --- |
| SC-01 · Premier quart d'heure (P0) | 1 Bloque (pas d'inscription libre) · 2 À jouer (assistant de démarrage ; volume et outils remplacés absents) · 3 À jouer · 4 Passe (nom, date, type) · 5 Bloque en partie (rétroplanning seulement pour un évènement confirmé, EVT-13 du lot 12) · 6 Passe (devis depuis le catalogue) · 7 À jouer (brouillon gardé côté serveur) | **Bloque** à l'étape 1 |
| SC-02 · De la demande à l'acompte (P0) | 1 À jouer (prospect = évènement ; pas d'alerte de date à la saisie) · 2 Bloque (pas de modèle de réponse) · 3 Bloque (pas d'options) · 4 À jouer (aperçu PDF, pas « vu par le client ») · 5 Bloque pour l'option ; signature par lien Documenso possible · 6 Passe (plusieurs signataires) · 7 À jouer (passage en Confirmé automatique, facture d'acompte émise à la main) · 8 Passe au niveau MVP (Camille marque payé) | **Bloque** (étapes 2, 3, 5) |
| SC-03 · Lundi matin (P0) | 1 À jouer (l'accueil commence par l'agenda) · 2 À jouer · 3 Passe (la tâche se décoche) · 4 Bloque (pas d'alerte de risque) · 5 Bloque (ni relance de prestataire ni statut « contrat ») · 6 Bloque (pas de création rapide) | **Bloque** |
| SC-04 · Devis du traiteur dans le budget (P0) | 1 Bloque (pas d'échéancier prestataire) · 2 À jouer (écart prévu/réel, sans enveloppe) · 3 Bloque · 4 Bloque · 5 Bloque · 6 Bloque | **Bloque** |
| SC-05 · Trois fleuristes (P1) | 1 Bloque (pas d'envoi de brief) · 2 Bloque · 3 Bloque · 4 Passe (options montrées aux clients, lot 11) · 5 Bloque (lecture seule) | **Bloque** |
| SC-06 · Portail des mariés et du père (P0) | 1 Bloque (inscription obligatoire) · 2 Bloque (pas de « trois prochaines actions ») · 3 À jouer · 4 Bloque (pas de droits de payeur) · 5 Bloque · 6 Bloque (pas de fil) | **Bloque** |
| SC-07 · Cent vingt réponses (P1) | 1 à 7 Bloque (pas de module Invités) | **Bloque** |
| SC-08 · Jour J sans réseau (P0, étapes 1 à 3 au MVP) | 1 Bloque · 2 Bloque · 3 Bloque | **Bloque** |
| SC-09 · Clôture (P1) | 1 Bloque · 2 Passe (solde, acomptes déduits) · 3 Bloque · 4 Bloque · 5 Bloque (pas de journal des ventes ni d'accès comptable) · 6 Bloque | **Bloque** |
| SC-10 · Quinze ans de contacts (P0) | 1 Bloque (pas d'inscription libre) · 2 À jouer (assistant d'import, mais pas d'entité « contact » : le fichier mêle clients et prestataires) · 3 Passe (annulation en bloc, IMP-05) · 4 Passe (import en cours conservé 7 jours) · 5 Passe (tutoriels) | **Bloque** à l'étape 1 |
| SC-11 · Agence et cliente entreprise (P1) | 1 Bloque · 2 Bloque · 3 À jouer (PDF du devis) · 4 Bloque (pas de bon de commande) · 5 Bloque (facture à un professionnel refusée) · 6 Bloque | **Bloque** |
| SC-12 · Couple autonome (P2) | 1 à 4 Bloque | **Bloque** |

| Abus (SU-14) | Résultat sur pièces |
| --- | --- |
| SC-S1 · Identifiant d'une autre organisation | Lecture refusée par la RLS (l'objet est introuvable). La tentative **n'est pas journalisée**. |
| SC-S2 · Ancien assistant avec session ouverte | Sans objet aujourd'hui : il n'y a pas de membre à retirer. Le retrait d'accès d'un client est contrôlé à chaque requête (ADR 0020). |
| SC-S3 · Lien de prestataire | Sans objet : il n'y a pas de lien prestataire. |
| SC-S4 · Lien client expiré ou d'un autre évènement | Invitation expirée refusée, accès vérifié par évènement. Il n'est pas proposé de demander un nouveau lien. |
| SC-S5 · Fichier EICAR, type falsifié | Refus (`packages/files/src/eicar.ts`, `magic-bytes.ts`). |
| SC-S6 · Formulaire en rafale, envoi à mille adresses | Il n'y a ni formulaire public ni envoi groupé. Le débit est limité sur la connexion et le mot de passe oublié (ADR 0044), mais rien ne plafonne les envois par organisation. |

**Conséquence pour les portes** :

- **Porte 1** : il faut SC-01, SC-03 et SC-04, plus SC-S1 à SC-S5. Les trois premiers bloquent. SC-S1 passe pour le refus mais pas pour la journalisation.
- **Porte 2** : tous les scénarios P0 bloquent aujourd'hui.

## 6. Divergences d'architecture et ADR proposés

Le § 1 demande de documenter une divergence acceptable par un ADR, sans la corriger. Les huit lignes
« Divergent » de la grille s'appuyaient chacune sur un ADR existant. Les quatre premières contredisaient
le nouveau document sur un point P0.

**Mise à jour du 11 novembre** : tes décisions ont tranché ces quatre lignes en faveur du nouveau
document. SEC-01, UX-11, POR-01 et RGP-05 ne sont plus « Divergent » mais des écarts à combler. Il
reste quatre lignes « Divergent » : ARC-04 (en attente de C3), DAT-02, ARC-11 et DOC-04. Le tableau
ci-dessous garde l'analyse d'origine ; le § 9 donne les décisions.

| Sujet | Existant | Nouveau document | ADR proposé | Question |
| --- | --- | --- | --- | --- |
| Identité | Authentification maison avec argon2id, TOTP et appareil de confiance (ADR 0013, 0037, 0038) | SEC-01 : pas de mot de passe chez Symbola, fournisseur OpenID Connect ; HUB-01 : lien magique, clé d'accès | Soit un ADR qui assume l'écart et ajoute les mots de passe compromis, les clés d'accès et le lien magique. Soit un ADR de bascule vers un fournisseur d'identité, la cible prévue par l'ADR 0013. | Q3 |
| Accès des tiers | Compte par personne pour les mariés (ADR 0020) | Lien personnel sans compte pour le client, le prestataire et l'invité, avec un code à usage unique pour les actions sensibles | ADR « Accès des tiers par lien personnel », qui remplacerait l'ADR 0020 | Q4 |
| Hors ligne | « Pas de mode hors connexion » (PRD § 10) ; aucune PWA livrée | ARC-09, JRJ-02, NFR-09 en P0 | ADR « Application installable et Jour J hors ligne » ; une dépendance de service worker est possible, à te demander d'abord | Q6 |
| Purge RGPD | Purge mensuelle validée à la main (ADR 0024, PRD RGPD-05) | RGP-05 : purge active sans réglage | Avenant à l'ADR 0024 si tu gardes la validation | Q10 |
| Stockage des fichiers et sauvegardes | Garage et restic sur le VPS (ADR 0015, runbook) | NFR-10, NFR-31 : hors du serveur et chez un autre fournisseur | ADR « Sauvegarde externe et stockage d'objets hors serveur » | Q14, Q15 |
| Contrats entre modules | `service.ts` et contrats TypeScript testés (ADR 0011) | ARC-04 : OpenAPI avant le code | Rien de nouveau : l'ADR 0011 couvre l'écart. Ajouter un renvoi vers ARC-04. | Q16 |
| Clés étrangères | Pas de clé étrangère entre schémas de modules (ADR 0011, 0012) | DAT-02 : clés étrangères en base | Rien de nouveau : l'ADR 0012 couvre l'écart. | — |
| Liens de fichiers | Fichiers servis par l'app après contrôle des droits (ADR 0027) | ARC-11 : liens signés de 15 minutes au plus | Rien de nouveau : l'ADR 0027 couvre l'écart. Un lien de partage limité dans le temps sera à prévoir pour les tiers (DOC-04). | — |
| Noyau partagé | Le hub porte l'organisation et l'utilisateur ; l'évènement vit dans son module ; il n'y a pas de contact | ARC-03 : contact, évènement et fichier dans le noyau | ADR « Contact unique » : où il vit, et comment il se rattache aux clients, aux signataires et aux prestataires | Q17 |
| Charte graphique | Fraunces et Inter, palette de l'ADR 0025 | `DESIGN.md` à la racine : Space Grotesk et Inter, émeraude #0F6E5C | ADR qui remplace ou complète l'ADR 0025 | Q13 |

## 7. Plan de comblement par lots

Ordre du § 1 : d'abord la perte de données et les failles SEC en P0, puis les parcours P0 cassés de
bout en bout, puis le reste des P0. Chaque lot vise une semaine au plus. Les lots marqués
« schéma » changent la base et attendent ta validation explicite (§ 1, étape 8). Ceux marqués
« décision » attendent une réponse dans `docs/QUESTIONS.md`.

### Phase 0 — Mettre les données à l'abri (vers la porte 1)

| Lot | Contenu | Exigences | Conditions |
| --- | --- | --- | --- |
| 22 | Sauvegarde hors serveur, rétention 7/4/12 en ajout seul, fichiers hors du VPS, test de restauration mensuel sur serveur vierge, alertes sur téléphone | NFR-10 à NFR-14, NFR-30, NFR-31, ARC-11, SEC-18 | Décision (Q14, Q15). Les gestes sur le VPS sont faits par toi, avec un runbook à jour. |
| 23 | Journal d'audit commun en ajout seul ; empreintes chaînées des factures et des encaissements ; facture émise conservée comme fichier ; auteur et date de modification | SEC-19, ARC-16, HUB-16, FAC-14, JUR-05, JUR-06, DOC-08, DAT-06, SEC-09 | Schéma |
| 24 | Preuves de cloisonnement : test qui énumère les routes, même réponse pour « inexistant » et « interdit », journaux sans donnée personnelle, suite SC-S1 à SC-S6, débit croissant, mots de passe compromis, plafond d'envois, combinaisons de modules | SEC-03 à SEC-06, SEC-12, SEC-13, SEC-20, SEC-22, SEC-36, ARC-01, ARC-07, DAT-01 | Q22 pour la liste de mots de passe |
| 25 | Documentation sans code : ADR des divergences (§ 6), règle d'arrondi, liste datée des sous-traitants, renvoi de `CLAUDE.md` vers ce document | SEC-01, ARC-04, DAT-02, DAT-05, RGP-05, RGP-13, NFR-24 | Décision (Q1 à Q4, Q10) |

### Phase 1 — Fermer les parcours P0 (vers la porte 2)

| Lot | Contenu | Exigences | Conditions |
| --- | --- | --- | --- |
| 26 | Accès des tiers par lien personnel : jeton haché, portée, expiration par public, noindex, partage objet par objet | UX-11, POR-01, POR-10, SEC-14, SEC-15, SEC-17, RGP-03 | Décision (Q4), schéma, parcours P0 |
| 27 | Portail client : trois prochaines actions, budget en trois chiffres, validation horodatée, aperçu « vu par le client », rappels | POR-02 à POR-05, POR-09, BUD-07, CHR-04, UX-17, EVT-09 | Schéma, parcours P0 ; après le lot 26 |
| 28 | Budget à cinq montants, enveloppe et seuil, échéancier par prestataire, statuts des prestataires, HT/TTC, export | BUD-01 à BUD-04, BUD-09, BUD-10, PRE-01, PRE-02 | Décision (Q8), schéma, parcours P0 |
| 29 | Application installable et hors ligne : manifeste, service worker, cache du Jour J, documents embarqués | ARC-09, JRJ-02, JRJ-04, NFR-09 | Décision (Q6), dépendance éventuelle. Peut demander deux lots. |
| 30 | Mode Jour J en lecture : « Maintenant » et « Ensuite », appel en un toucher, durées calculées, 360 px | JRJ-01, JRJ-03, CHR-06, UX-05 | Après le lot 29 |
| 31 | Devis complet et contrat : sections, options, contrôle bloquant des mentions, facture d'acompte à la signature, contrat à variables, rétractation, acompte ou arrhes, assurance et médiateur, avertissement « à adapter » | FAC-01, FAC-04, FAC-05, FAC-07, DOC-02, DOC-03, JUR-01, JUR-07 à JUR-09, JUR-20, HUB-21, HUB-23, HUB-26 | Schéma ; se scinde en 31a (devis, mentions) et 31b (contrat). Les textes juridiques restent à faire relire (§ 20). |
| 32 | « Aujourd'hui » trié par urgence, cockpit (compte à rebours, santé, quatorze jours), création rapide, alerte de date, trois chiffres signé, facturé, encaissé | UX-01, UX-03, UX-06, HUB-07, HUB-08, CRM-04, EVT-02, EVT-07, CHR-03, FAC-12 | Parcours P0 |
| 33 | Inscription libre, multi-organisation, rôles Propriétaire et Planner, questionnaire complet, exemple étiqueté | HUB-01 à HUB-03, HUB-09, HUB-10, PAR-01, UX-04, SEC-07 | Décision (Q3, Q5), schéma, parcours P0 |
| 34 | Statuts d'évènement, report et annulation, date relative gardée sur la tâche, lieux complets, fuseau de l'évènement | EVT-01, EVT-03, EVT-05, CHR-01, CHR-02, FAC-13, DAT-07, ARC-17 | Décision (Q7), schéma |
| 35 | Export complet réversible (CSV, JSON, archive des documents) et test de réimport automatisé | HUB-13, RGP-11, DAT-13 | — |
| 36 | Contact unique (personne, foyer, entreprise) relié aux clients, aux signataires et à l'import | CRM-03, DAT-12, UX-02, HUB-14, ARC-03 | Décision (Q17), schéma ; L, deux lots probables |
| 37 | Documents par évènement, programme diffusé par prestataire et versionné, compteur de stockage | DOC-01, DOC-04, DOC-07, DOC-12, CHR-07, DAT-14, POR-04 | Schéma |
| 38 | Flux ICS, modèles d'e-mails aux couleurs de l'organisation avec aperçu et envoi test, écran de contrôle des envois | HUB-29, MSG-01, MSG-02, HUB-18, HUB-21 | Q18 (service d'e-mail) |
| 39 | Saisie sûre : annuler pendant dix secondes, corbeille de 30 jours, enregistrement automatique, écrans vides, états d'attente, erreurs référencées | UX-07 à UX-10, UX-13, UX-15, HUB-12, HUB-17, DAT-03, RGP-04, NFR-16 | Schéma (suppression logique) |
| 40 | Exploitation et mesures : fenêtre de déploiement, contrôle du durcissement à chaque déploiement, retour arrière en une commande, jeu de recette en une commande, mesures de performance, Safari, Firefox, Edge, 360 px et zoom, WCAG 2.2, inventaire des licences | NFR-01, NFR-02, NFR-07, NFR-17 à NFR-19, NFR-21, NFR-23, SEC-28, ARC-06, ARC-10, ARC-12, ARC-14, DAT-10, HUB-20, UX-14, JUR-17, JUR-18 | Se scinde en 40a (exploitation) et 40b (mesures et accessibilité) |

Certains lots P0 embarquent une exigence P1 voisine quand elle se fait dans le même geste : HUB-16
avec le journal, NFR-13 et NFR-30 avec la sauvegarde, EVT-09 avec les décisions du portail.

### Phase 2 — V1 commercialisable (vers la porte 3)

| Lot | Contenu | Exigences principales |
| --- | --- | --- |
| 41 | Factur-X, mentions de la réforme, bon de commande, assistant de conformité | FAC-10, JUR-02, JUR-12, JUR-13, GC-03 |
| 42 | Plateforme agréée et e-reporting — **à livrer avant l'été 2027** | FAC-10, JUR-03, JUR-04 |
| 43 | Proposition en page web, paiement en ligne, relances d'impayés, part par payeur | FAC-02, FAC-08, FAC-09, GC-01, SEC-16, BUD-06, BUD-11 |
| 44 | Formulaire de contact et pipeline en colonnes | CRM-01, CRM-02 |
| 45 | Modèles de réponse, relances, doublons, questionnaires | CRM-05 à CRM-07, CRM-09, FAC-15, POR-07, RGP-17 |
| 46 | Rendez-vous | RDV-01 à RDV-04, EVT-10 |
| 47 | Prestataires par lien : brief groupé, espace prestataire, sélection au client | PRE-03, PRE-04, PRE-09, PAR-05, BUD-05 |
| 48 | Pièces à échéance, contrôle de l'IBAN, commissions, honoraires, chiffrement des champs sensibles | PRE-05 à PRE-07, PRE-10, SEC-27, BUD-08, JUR-10, DAT-08, HUB-25 |
| 49 | Invités et RSVP, régimes avec accord, purge des invités | INV-01 à INV-04, INV-07, RGP-06 à RGP-08, RGP-18 |
| 50 | Plan de table et synthèse pour le traiteur | INV-05, INV-06 |
| 51 | Temps forts et Jour J de terrain : pointage, main courante, partage | EVT-04, JRJ-05 à JRJ-09, CHR-08 |
| 52 | Équipe : invitations de membres, sessions, équipe par évènement, clés d'accès | HUB-04, HUB-05, EVT-06, SEC-02, SEC-08 |
| 53 | Notifications, récapitulatif, automatisations, tâches hors évènement, radar des risques | HUB-15, HUB-28, UX-16, CHR-05, CHR-10, HUB-24, GC-02 |
| 54 | Abonnement en libre-service, quotas, interrupteurs par fonction | HUB-27, DOC-06, NFR-26 |
| 55 | Messagerie par sujet, envoi depuis le domaine du planner, portail installable et à ses couleurs | MSG-03 à MSG-05, POR-06, POR-08, POR-11 |
| 56 | Pilotage d'agence | PAR-10, RPT-01, RPT-02, RPT-05, CRM-08 |
| 57 | Conformité de l'éditeur, avec un avocat et un délégué à la protection des données : sous-traitance, registre, incidents, analyse d'impact, test d'intrusion, inventaire des composants | RGP-01, RGP-02, RGP-10, RGP-12, RGP-19, JUR-15, JUR-19, SEC-29, SEC-33, SEC-35, SEC-37 |
| 58 | Clôture d'évènement et exports comptables | PAR-09, EVT-08, FAC-11, PRE-08 |
| 59 | Qualité de service : charge, poids, disponibilité, page d'état, retours, journal des modifications | NFR-03 à NFR-06, NFR-08, NFR-15, NFR-22, NFR-25, NFR-28, NFR-29, UX-18, DOC-09, DOC-10 |

### Phases 3 et 4

- **V2** (46 lignes) : Temps et frais, game changers GC-04 à GC-14, règles d'IA, multi-devises, API publique, offre Couple.
- **Au-delà** (10 lignes P3, GC-15 à GC-24) : à instruire, pas à construire. Notées « Sans objet » dans la grille.

### Ce que je propose de faire en premier, après ta validation

1. ~~Trancher les questions bloquantes : Q1 à Q6, Q14 et Q15.~~ Fait le 11 novembre ; ordre mis à jour au § 9.
2. Lot 25 (ADR, sans code) et lot 22 (sauvegarde) en parallèle. Le lot 22 dépend surtout de gestes sur le VPS que toi seul fais.
3. Lots 23 et 24, puis le rejeu réel de SC-S1 à SC-S5.
4. Lots 26 à 28, qui ferment PAR-04 et PAR-06, avant d'ouvrir un autre parcours (« un parcours terminé vaut mieux que trois modules à moitié faits »).

## 8. Questions pour Julien

Elles sont dans `docs/QUESTIONS.md`. Tu as répondu le 11 novembre (tableau des décisions en tête
du fichier). Tu as aussi validé les cinq recommandations C1 à C5 : anglais conservé hors
définition de « terminé », sauvegarde chez Hetzner (Storage Box), TypeScript à l'intérieur et
OpenAPI pour toute API exposée, chargeur du jeu fictif au lot 24 avec rejeu à chaque lot, et
fiches pour les professionnels dans `docs/conformite/`.

## 9. Décisions du 11 novembre et effets sur le plan

Le détail est dans `docs/QUESTIONS.md`.

**Ce qui change dans la grille** :

- Les quatre divergences P0 sont tranchées en faveur du nouveau document : fournisseur d'identité
  (Q3), liens personnels pour les tiers (Q4), hors-ligne en lecture au MVP (Q6) et purge
  automatique avec préavis (Q10). SEC-01 passe à Absent ; UX-11, POR-01 et RGP-05 passent à
  Partiel. C'est pourquoi le score P0 « selon la règle » recule d'un point (52 % au lieu de 53 %)
  et rejoint presque le score strict.
- Deux écarts sont assumés pendant le pilote, chacun avec un ADR à écrire : Garage reste sur le VPS
  (Q14 b, NFR-31 et ARC-11), et la fenêtre de déploiement reste une règle écrite (Q32, NFR-07).
- Les autres décisions sont notées dans la colonne « commentaire » des lignes concernées.

**Ce qui change dans le plan** :

| Lot | Changement |
| --- | --- |
| 22 | Sauvegarde vers Hetzner Storage Box (C2), avec des copies que le VPS ne peut pas effacer (Q15.3), et 12 mensuelles. **À livrer avant la première donnée réelle.** Je recommande un test de restauration depuis le nouveau dépôt à la livraison. Le test mensuel sur serveur vierge vient après le pilote. |
| 24 | Ajout du chargeur du jeu fictif (DAT-10), validé (C4) : chaque lot en a besoin pour faire passer son scénario (Q23). |
| 25 | Élargi : archiver l'ancien cahier des charges et le PRD (Q2) ; réécrire `CLAUDE.md` (référence, définition de « terminé », identifiants) ; préfixer les anciens identifiants dans les tests et les documents (Q1). Écrire les ADR : identité, accès des tiers, Garage pendant le pilote, fenêtre de déploiement, budget à cinq montants, statuts, purge automatique, charte graphique. |
| 25b | **Nouveau** : jetons de `DESIGN.md` et composants de base (Q13), avant les lots 26 à 32, pour ne pas construire les nouveaux écrans deux fois. |
| 33 | Fournisseur d'identité open source : choix et licence, nouveau service, reprise des comptes (Q3). Il porte l'inscription libre, la multi-organisation et le renommage du rôle d'exploitation (Q30). Deux lots probables. |
| 34 | Ajout de la purge automatique avec préavis (RGP-05, Q10). |
| 38 et 55 | Le service d'e-mail doit gérer l'envoi depuis le domaine du planner, avec le domaine de Symbola par défaut (Q18). |
| 41 à 43 | Ordre inchangé : pas de client professionnel pendant le pilote (Q19). Plateforme agréée en feuille de route (Q20). Benchmark des prestataires de paiement avant le lot 43 (Q21). |

**Ordre proposé désormais** :

1. Lots 25 (documentation et ADR, sans code applicatif) et 22 (sauvegarde) en parallèle. Pour le
   lot 22, les gestes sur le VPS et chez le fournisseur restent les tiens.
2. Lot 25b (jetons de design), puis lots 23 et 24.
3. Lots 26 à 28, qui ferment PAR-04 et PAR-06, avant d'ouvrir un autre parcours.
