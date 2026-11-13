# ADR 0065 — Contrats : signature avec le devis, commande avant la signature, dossier de preuve

- Statut : accepté (révision du lot 31b validée par Julien le 13/11/2026, décisions D9, D11 à D16)
- Date : 2026-11-13
- Complète : [0026](0026-signature-documenso.md) (signature par Documenso, sans le modifier),
  [0014](0014-evenements-internes-pour-le-mvp.md) (événements internes), [0061](0061-pieces-inalterables.md)
  (empreintes des pièces).
- Exigences : FAC-04, FAC-05, DOC-02, DOC-03, JUR-07, JUR-14 de `docs/CAHIER_DES_CHARGES.md` ;
  réponses de l'avocat du 13/11/2026 (questions 1, 5, 6 et 10 de `docs/conformite/fiche-avocat.md`).

## Contexte

Jusqu'au lot 31a, une demande de signature faisait signer le seul devis : une demande par version,
un PDF, le dossier de preuve du fournisseur (document signé et certificat). Le lot 31b ajoute le
contrat généré depuis un modèle. L'avocat a précisé :
- à distance, un bouton « commande avec obligation de paiement » avant la signature ;
- une demande d'exécution anticipée recueillie par une case distincte de la signature, horodatée
  et versée au dossier de preuve ;
- le canal de conclusion et le niveau de signature inscrits au dossier de preuve.

Il déconseille aussi de modifier Documenso (licence AGPL, réponse 10) : son bouton de signature ne
peut pas changer.

## Décision

1. **Une demande, un PDF.** Le devis puis son contrat forment un seul PDF, avec la zone de
   signature de chaque signataire en fin de contrat. La demande porte un type :
   - `quote` (le devis seul) ;
   - `quote_contract` (le devis et son contrat) ;
   - `contract` (le contrat seul, généré après la signature du devis, signé par les mêmes signataires).

   Une seule demande fait signer le devis d'une version, et un contrat ne se signe qu'une fois
   (index uniques partiels). La demande `contract` ne change pas le statut du devis.
2. **La commande avant le lien.** Pour un contrat conclu à distance, l'e-mail de signature ne
   contient pas le lien du fournisseur. Il invite le signataire sur son espace personnel (lien
   personnel, ADR 0053). Le signataire y lit le contrat, clique sur « Je commande avec obligation
   de paiement » (enregistré, avec le texte présenté), puis voit son lien. L'envoi est refusé si un
   signataire n'a pas de lien personnel actif, et la page du devis ne montre plus le lien à copier.
3. **Les actes du client** (commande, exécution anticipée) sont des lignes à part
   (`quotes.contract_signer_acts`) : nom et texte copiés, date, une par signataire et par sorte.
   Ils sont tracés au journal (identifiants seulement).
4. **Le dossier de preuve de Symbola.** Quand tous ont signé, Symbola écrit un JSON :
   - le canal de conclusion, la catégorie du client et le régime de rétractation ;
   - les versions du contrat et du modèle, avec la date de revue du modèle ;
   - les signataires et leurs actes ;
   - le niveau de signature ;
   - les empreintes du document signé et du certificat du fournisseur.

   Le JSON est déposé dans le stockage privé avec son empreinte SHA-256 (`quotes.contract_evidence`),
   puis relu et vérifié à chaque téléchargement ; il se lit en PDF. Il complète, sans le remplacer,
   le dossier de preuve du fournisseur. Un exemplaire signé est envoyé à chaque signataire en pièce
   jointe (support durable).
5. **Le régime en données.** La table de l'avocat (canal × catégorie du client → rétractation,
   éléments exigés, bouton de commande, sept jours sans paiement) vit dans
   `packages/starter-templates/src/contract-rules.json`, comme le seuil de la signature avancée
   (10 000 €) et la durée minimale de conservation (120 mois). Le code n'en contient aucune valeur.
6. **La facture d'acompte sans autre saisie** est programmée à la signature
   (`quotes.scheduled_deposit_invoices`). Elle est émise ensuite à deux occasions :
   - par le worker des événements, qui écoute `quotes.quote.signed` ;
   - par un passage toutes les heures, pour la fin du délai de rétractation et les devis d'essai.

   Le rendu de la facture prend alors la langue de la planner, sans requête HTTP.

## Conséquences

- Le niveau de signature réel reste « simple ». Le code SMS et la signature avancée viennent dans
  un lot à part, après le choix d'un fournisseur de SMS et de l'édition de Documenso (Q34).
- À distance, chaque signataire doit avoir un lien personnel actif : c'est le prix d'un bouton de
  commande qui ne dépend pas du fournisseur.
- Les jours fériés ne prolongent pas encore le délai de rétractation (seuls le samedi et le
  dimanche reportent au lundi).
- Le dossier de preuve suit la conservation du devis signé (dix ans par défaut) ; il est retiré du
  stockage à la fin de la preuve, comme les documents du fournisseur.
