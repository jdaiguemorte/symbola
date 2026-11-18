# ADR 0087 — Règlement par virement au RIB du planner, sans prestataire de paiement

- Statut : accepté (décision de Julien du 18/11/2026, réponse à Q21)
- Date : 2026-11-18
- Écart assumé avec : FAC-08 (paiement en ligne par lien, via un prestataire de paiement), § 10
  du cahier des charges (« prestataire de paiement européen avec carte et SEPA »), et en partie
  GC-01 (signer et payer en un seul geste).
- Étude : `docs/etudes/paiement-et-plateforme-agreee.md`.

## Contexte

Les acomptes et soldes d'un mariage se comptent en milliers d'euros. Sur ces montants, le
virement est l'usage du métier : il ne coûte rien, il n'a pas de plafond pratique. La carte coûte
de 1,2 à 2,8 % et bute sur le plafond de la carte du client. L'étude du 18/11/2026 a comparé trois
modèles :

- le RIB du planner, sans prestataire ;
- le compte du planner chez un prestataire relié à Symbola ;
- une plateforme d'encaissement pour compte de tiers.

Elle a aussi comparé les prestataires (Mollie, Stripe, GoCardless, Fintecture, Stancer, Payplug,
banques).

## Décision

1. **Le seul mode de règlement géré par Symbola est le virement au RIB du planner.** Symbola
   affiche le RIB de l'organisation et une **référence unique par échéance** sur la facture, la
   proposition et le portail du client. Le payeur déclare avoir réglé (POR-09, déjà là) ; la
   planner confirme l'encaissement.
2. **Aucun prestataire de paiement**, aucune liaison avec un compte du planner chez un tiers.
   Aucun paiement par carte dans Symbola, donc **aucun supplément** à facturer au client.
3. Le planner reste libre d'encaisser autrement en dehors de Symbola (chèque, carte sur son propre
   terminal, espèces dans les limites légales). Il enregistre alors l'encaissement à la main, comme
   aujourd'hui.
4. **Symbola ne touche jamais l'argent** : aucune question d'encaissement pour compte de tiers.

## Conséquences

- **FAC-08** devient « Divergent » dans `docs/gap.csv` : règlement par virement avec référence ;
  le **rapprochement reste manuel**. Un rapprochement assisté (import du relevé bancaire, lecture
  des références) pourra venir plus tard, sans prestataire.
- **GC-01** : la signature enchaîne sur l'écran de règlement (RIB, référence, montant de
  l'acompte, QR code de virement si retenu au lot 43), sans paiement en ligne. Le droit de
  rétractation (JUR-07) reste inchangé.
- **SEC-16** (code à usage unique avant une action sensible) garde son sens pour la signature ; il
  n'y a plus de paiement à protéger.
- **Le lot 43** garde le reste de son périmètre :
  - la proposition en page web (FAC-02) ;
  - les relances d'impayés (FAC-09) ;
  - signer et régler (GC-01) ;
  - la répartition par payeur (BUD-06) ;
  - le calendrier des sorties d'argent (BUD-11).
- Aucun sous-traitant de paiement à ajouter à `docs/conformite/sous-traitants.md`.
- Si la pilote réclame un jour le paiement par carte, l'étude reste la base : un prestataire
  derrière une interface (ARC-12), sans réécrire le règlement par virement.
