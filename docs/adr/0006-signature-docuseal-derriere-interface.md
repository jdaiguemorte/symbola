# ADR 0006 — Signature électronique : DocuSeal derrière une interface

- Statut : accepté
- Date : 2026-10-25

## Contexte

Les devis doivent être signés en ligne ; on ne développe jamais sa propre signature.

## Décision

DocuSeal auto-hébergé (AGPL-3.0, utilisé sans modification), piloté par API et webhooks. L'app Devis ne parle qu'à une interface `SignatureProvider` (envoyer, statut, récupérer le document signé). Un faux fournisseur sert aux tests et aux essais guidés.

## Conséquences

Passer à Documenso ou Yousign ne touche pas l'app Devis. La page de signature porte la marque DocuSeal tant que la version Pro n'est pas prise. Licence Pro à vérifier avant l'ouverture multi-clients.
