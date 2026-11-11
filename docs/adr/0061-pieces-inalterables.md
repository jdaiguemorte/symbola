# ADR 0061 — Pièces inaltérables : originaux, encaissements en écritures, chaîne d'empreintes

- Statut : accepté (spécification du lot 23 validée par Julien le 11/11/2026 ; lot 23b)
- Date : 2026-11-11
- Complète : [0060](0060-journal-d-audit-commun.md) (journal d'audit commun),
  [0024](0024-rgpd-purge-mensuelle-et-fin-de-conservation-des-factures.md) (conservation des factures).
- Exigences : FAC-14, JUR-05, JUR-06, DOC-08 de `docs/CAHIER_DES_CHARGES.md` ; décisions D2, D6, D7
  du lot 23.

## Contexte

Avant le lot 23b, une facture émise était déjà immuable en base (déclencheur, migration 0042), mais
son PDF était redessiné à chaque téléchargement, rien ne chaînait les pièces, et un encaissement
était une colonne de l'échéance, effacée par « Marquer non payée ». FAC-14 exige que chaque facture
et chaque encaissement soit chaîné au précédent par une empreinte, et qu'une modification directe en
base soit détectée ; DOC-08, que l'original émis soit conservé tel quel ; JUR-05 vise l'attestation
de l'éditeur pour les encaissements de particuliers (article 286 du CGI).

## Décision

1. **Original** (`quotes.original_documents`, DOC-08) : à l'émission d'une facture ou d'un avoir, le
   PDF est rendu depuis la copie figée, déposé dans le stockage privé et enregistré avec son
   empreinte SHA-256, **dans la transaction qui attribue le numéro**. Stockage indisponible = pas
   d'émission, pas de numéro consommé. Le téléchargement sert l'original si son empreinte est celle
   de l'émission ; sinon 409, ligne `quotes.original.altered` au journal, et rien n'est reconstruit.
   Une pièce émise avant le lot reçoit son original à sa première ouverture, marqué « reconstitué »
   (D6). Pas d'original pour une pièce d'essai. Les documents signés reçoivent une empreinte à leur
   archivage, vérifiée à la relecture (colonnes de `signature_requests`, effacées avec les fichiers à
   la fin de leur conservation RGPD).
2. **Encaissements en écritures** (`quotes.payment_entries`, D2, JUR-05) : une saisie crée une écriture
   `received` au montant figé ; « Annuler le paiement » exige un motif et crée une écriture
   `reversal` liée. Rien ne s'efface. Les colonnes `paid_on` et mode de l'échéance restent une copie
   de lecture, mise à jour dans la même transaction.
3. **Chaîne** (`quotes.ledger_entries`, FAC-14) : une par organisation ; factures, avoirs, originaux,
   encaissements et annulations, dans l'ordre d'enregistrement. Le rang, l'empreinte précédente et
   l'empreinte (`SHA-256(précédente | rang | type | objet | contenu)`, fonction `sha256` de
   PostgreSQL) sont **calculés par la base**, sous un verrou propre à la chaîne de l'organisation ;
   ce que l'app fournit est ignoré. Les pièces s'enchaînent **par déclencheurs** sur leurs tables :
   aucune n'y échappe si le code l'oublie. Le contenu ne porte aucune donnée personnelle : copies
   figées, mentions et motifs y sont réduits à leur empreinte ; dates et instants en texte UTC fixe.
   Ajout seul pour tout rôle, propriétaire compris.
4. **Vérification** : `quotes.verify_ledger(organisation)` recalcule la chaîne et compare chaque
   écriture à la pièce actuelle : rang manquant, maillon rompu, écriture modifiée, pièce modifiée,
   pièce supprimée, pièce hors chaîne. Contrôle quotidien de toutes les organisations : une anomalie
   va au journal (`quotes.ledger.anomaly_detected`) et à une **sonde Uptime Kuma à part**
   (`LEDGER_CHECK_PUSH_URL`, « down ») — `/health` n'est pas en cause, l'app n'est pas en panne.
5. **Archive** (JUR-06, D7) : Devis › Paramètres › Archive comptable, titulaire seulement : années,
   CSV des écritures (export journalisé), originaux de l'année, vérification à la demande.
6. **Reprise** (D6) : la migration 0094 transforme les échéances payées en écritures `received`
   (montant fixe, ou pourcentage du total TTC arrondi au plus proche, comme l'écran) et chaîne les
   pièces existantes dans l'ordre chronologique, marquées « reprise ». Aucune pièce réelle n'existait
   en production (confirmé par Julien).

## Limites assumées

- Qui détient **à la fois** les droits complets sur la base et sur le stockage pourrait réécrire une
  chaîne entière de façon cohérente. Parades : le rôle applicatif ne le peut pas (droits et
  déclencheurs) ; le rôle propriétaire ne sert qu'aux migrations ; les sauvegardes chiffrées et
  leurs copies instantanées chez Hetzner (lot 22) gardent les états passés hors d'atteinte du VPS ;
  le contrôle est quotidien ; tout accès humain à la base est tracé (ADR 0060).
- **Attestation et clôtures** (JUR-05) : le contenu de l'attestation et une éventuelle obligation de
  clôtures périodiques (cumuls journaliers, mensuels, annuels) attendent l'expert-comptable (fiche,
  question 5). Le format d'archivage (PDF/A) aussi (question 6) : le PDF est conservé tel qu'émis.
- **Poids** : une facture d'une page avec un logo courant pèse moins de 150 Ko (test) ; un logo très
  lourd (jusqu'à 2 Mo acceptés à l'envoi) dépasserait : sa réduction à l'envoi relève de DOC-09.
- Un original reconstitué (pièce d'avant le lot) n'est pas l'original d'époque : il est marqué comme
  tel, dans la base et dans la chaîne.

## Conséquences

- Toute nouvelle sorte de pièce comptable (facture intermédiaire, Factur-X) s'ajoute à la chaîne par
  le même déclencheur et à `verify_ledger`.
- Émettre exige un rendu PDF (`renderOriginal`) : les tests passent un rendu factice.
- Au déploiement d'ensemble : migration 0094 ; régler `LEDGER_CHECK_PUSH_URL` avec une sonde Push
  d'Uptime Kuma (`docs/runbooks/surveillance.md`).
