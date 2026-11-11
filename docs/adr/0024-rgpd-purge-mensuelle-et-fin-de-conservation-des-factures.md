# ADR 0024 — RGPD : purge mensuelle et fin de conservation des factures

- Statut : accepté ; points 2 et 3 remplacés par
  [0056](0056-purge-rgpd-automatique-avec-preavis.md) (purge automatique avec préavis) au lot 34
- Date : 2026-11-02
- Complète : [0010](0010-facturation-conforme.md), [0023](0023-rgpd-contrat-par-fiches-et-orchestration.md)

## Contexte

RGPD-05 (PRD §8) : chaque mois, le module liste les personnes dont la durée de conservation est
échue ; la titulaire valide la liste, peut exclure une ligne avec un motif ; rien n'est purgé
sans validation. Les durées sont des réglages de l'organisation (lot 6, RGPD-04) : prospect sans
suite 3 ans après la dernière activité, client 3 ans après la fin de la relation, compte de
marié inactif 2 ans, factures et avoirs 10 ans, devis signés 5 ans (RGPD-03).

L'ADR 0010 rend une facture émise **immuable** : le rôle applicatif n'a pas le droit `UPDATE`
sur `quotes.invoices` et `quotes.credit_notes`, et un trigger refuse toute modification ou
suppression. Or le cahier des charges (§ 6) prévoit l'anonymisation des factures à la fin de
leur conservation comptable. Julien a décidé le 02/11/2026 de traiter ce cas dès le MVP
(première échéance réelle en 2036, 2031 pour les devis signés).

## Décision

1. **Règles pures** dans `packages/privacy/src/retention.ts`, testées avec des dates simulées :
   une donnée est échue **le jour même** de son échéance, jamais la veille. Fin de la relation
   client : la plus tardive entre la date de l'événement et le dernier encaissement (décision
   de Julien). Compte de marié : dernière connexion réussie (nouvelle colonne
   `hub.users.last_login_at`), sinon date de création.
2. **Liste calculée à la demande** (`apps/symbola/lib/privacy/purge.ts`), à partir des services
   des modules (événements, encaissements, documents échus, comptes) : jamais stockée, elle
   reflète toujours l'état du jour. Le tableau de bord rappelle la liste tant que celle du mois
   n'a pas été validée.
3. **Validation** : la liste est recalculée côté serveur ; seules les lignes affichées et
   validées sont traitées. Chaque ligne est purgée ou exclue avec un motif obligatoire ; une
   ligne exclue **revient le mois suivant** (décision de Julien), avec son dernier motif. La
   purge passe par le contrat `privacy/v1` de chaque module (`planErasure`, `erase`, comme
   l'oubli) ; trace et accusés dans `hub.privacy_purges` (sans libellé : références opaques,
   dates, motifs).
4. **Fin de conservation dans le contrat** : `ErasureInput.today` ; une fiche « conservée »
   dont la date de fin est atteinte devient « anonymisée ». Le même mécanisme sert l'oubli
   (RGPD-03) d'une personne dont les factures ont dépassé dix ans.
5. **Exception contrôlée au verrou des factures** (précise l'ADR 0010) :
   - le rôle applicatif reçoit `UPDATE` **sur la seule colonne `buyer_snapshot`** des factures
     et avoirs ;
   - le trigger d'immuabilité n'accepte une mise à jour que si la transaction le déclare
     (`SET LOCAL app.retention_anonymization = 'on'`, posé par le module quotes après avoir
     vérifié l'échéance) **et** que rien d'autre que la copie de l'acheteur ne change ;
   - la suppression reste interdite ; montants, numéros, lignes et copie du vendeur ne bougent
     jamais. Testé sur PostgreSQL réel avec le rôle applicatif.
   Devis signé à la fin de sa preuve : signataires et descriptions anonymisés, document signé
   et certificat supprimés du stockage.

## Conséquences

- Une facture reste immuable dans tous les cas sauf un : l'anonymisation de l'acheteur, à la
  fin de sa conservation, dans une transaction qui le déclare. Le contrôle de l'échéance est
  applicatif (les durées sont des réglages, pas des constantes SQL) : une durée réglée trop
  court par erreur anonymiserait trop tôt, d'où la validation humaine de chaque ligne et la
  relecture des durées par un juriste avant l'ouverture SaaS.
- Limite connue : le cahier des charges prévoit un avertissement au marié avant la suppression
  de son compte inactif ; il n'est pas envoyé au MVP (la titulaire valide chaque ligne).
- Si un module devient une app autonome, la liste interroge ses routes `/v1/privacy/...` au
  lieu de son `service.ts` ; la règle d'immuabilité suit la base des factures.
