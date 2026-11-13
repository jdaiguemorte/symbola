# ADR 0066 — Arrhes : reçu non fiscal hors de la chaîne des pièces ; solde déduit taux par taux

- Statut : accepté (décisions D20 à D22 du lot 31, validées par Julien le 13/11/2026)
- Date : 2026-11-13
- Complète : [0061](0061-pieces-inalterables.md) (pièces inaltérables, encaissements en écritures,
  chaîne d'empreintes) et [0059](0059-arrondi-des-montants-et-de-la-tva.md) (arrondi de la TVA par
  taux).
- Exigences : FAC-05, JUR-08 de `docs/CAHIER_DES_CHARGES.md` ; réponses 7 et 7 bis de
  l'expert-comptable du 13/11/2026 (`docs/conformite/fiche-expert-comptable.md`).

## Contexte

Le lot 31a émettait une « facture d'arrhes » comme une facture d'acompte, et le solde déduisait les
acomptes en TTC avant de ventiler le reste au prorata des taux. L'expert-comptable a répondu :
- **arrhes** : ce sont une indemnité de dédit. Elles sont hors TVA, hors facturation électronique
  et hors e-reporting tant qu'elles ne sont pas imputées sur le prix. Une TVA écrite sur une
  facture serait due. À l'encaissement, il faut remettre un reçu non fiscal. La facture de solde
  porte le prix total, avec les arrhes en règlement. Des arrhes se versent une fois, à la
  réservation ;
- **solde** : il doit déduire chaque acompte en HT et en TVA, taux par taux.

## Décision

1. **Aucune facture d'arrhes.** L'émission d'une facture d'acompte est refusée pour un devis à
   arrhes, avant toute attribution de numéro. Rien n'est programmé à la signature. Un devis à
   arrhes n'a qu'une échéance (D22) : le choix des arrhes sur plusieurs échéances, une deuxième
   échéance, et l'envoi d'une copie ancienne qui en aurait plusieurs sont refusés et nommés.
2. **Reçu non fiscal** (`quotes.earnest_receipts`) :
   - **Création** : à l'encaissement d'arrhes, dans la transaction de l'écriture d'encaissement.
   - **Numérotation** : la série `receipt` (« R » par défaut, réglable, « DEMO-R » pour un essai),
     sans trou.
   - **Contenu** : le vendeur et les clients (signataires) figés, la date et le montant reçus, le
     mode de paiement.
   - **Inaltérabilité** : comme une facture (même déclencheur), seule la copie des clients
     s'anonymise à la fin de la conservation comptable, et seul un reçu d'essai se supprime.
   - **Encaissement annulé** : l'annulation passe par une écriture inverse et laisse le reçu,
     affiché « annulé » ; un nouvel encaissement reçoit un nouveau reçu.
3. **Hors de la chaîne des pièces.** Le reçu n'est pas une pièce comptable : pas d'original
   déposé, pas d'entrée dans `ledger_entries`. Le PDF se rend à la demande depuis la copie figée.
   L'encaissement, lui, reste dans la chaîne (ADR 0061), et c'est lui qui fait foi.
4. **Solde au prix total.** Pour un devis à arrhes, la facture de solde porte le prix total (HT,
   TVA, TTC), puis les arrhes reçues et non annulées comme règlements, puis le reste à payer. Le
   montant de la facture est le prix total.
5. **Solde par taux.** Chaque facture d'acompte, nette de ses avoirs, est retirée de son propre
   taux, en base et en TVA, depuis sa copie figée. Acomptes et solde redonnent exactement le devis,
   taux par taux. Le PDF montre le devis par taux, chaque acompte déduit (HT et TVA par taux), le
   solde par taux et le reste à payer. Un solde émis avant le lot 31c garde sa présentation.
6. **E-reporting** : les encaissements d'arrhes en sont exclus ; la facture de solde, au prix
   total, y entre.

## Conséquences

- Un devis à arrhes ne génère de facture qu'au solde ; le reçu suffit au client jusque-là.
- Les documents de renonciation (constat quand le client renonce, restitution du double quand la
  planner renonce) viennent avec l'annulation d'un évènement (EVT-05, lot 34).
- Des arrhes puis des acomptes sur un même devis (choix par échéance) restent possibles plus tard
  si la pilote en a besoin (D22, option b) : le choix passerait alors du devis à l'échéance.
- Le reçu entre dans le contrat `privacy/v1` du module quotes (recherche, données liées, oubli,
  purge à la fin de la conservation) et au registre.
