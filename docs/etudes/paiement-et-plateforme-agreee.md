# Étude : prestataire de paiement (lot 43) et plateforme agréée (lot 42)

**Date** : 18/11/2026. **Statut** : étude préparatoire, **aucune décision prise**. Elle répond à Q21
(« Quel prestataire de paiement ? ») et prépare Q20 (« Quelle plateforme agréée ? »). Les
prestataires sont nommés (Q25 : un comparatif assumé peut les nommer).

**Avertissement sur les chiffres** : les tarifs ci-dessous viennent de comparatifs publics consultés
le 18/11/2026, pas des grilles officielles. Ils divergent d'une source à l'autre ; certains
prestataires n'affichent aucun prix (sur devis). Avant de choisir, il faut relire la grille
officielle de chaque finaliste et demander un devis pour un volume réel.

## 1. Ce que le cahier des charges demande

- **FAC-08** (P1) : paiement en ligne par lien (carte, virement, prélèvement) via un prestataire de
  paiement, avec rapprochement automatique. *Critère* : aucune donnée de carte ne transite par
  Symbola.
- **GC-01** (P1) : signer et payer en un seul geste (proposition, signature, acompte).
- **SEC-16** (P1) : un code à usage unique avant une action sensible depuis un lien (payer).
- **§ 10** : « prestataire de paiement européen avec carte et SEPA ». **§ 3** : aucune commission
  prélevée par Symbola sur les paiements.
- **Julien, le 18/11/2026** : le paiement par carte **n'est pas une obligation**. Sur des montants
  de plusieurs milliers d'euros, le client **garde le choix** du mode de règlement.

## 2. La vraie question : le modèle, avant le prestataire

Trois modèles possibles, du plus simple au plus lourd :

| Modèle | Qui reçoit l'argent | Statut de Symbola | Effort |
| --- | --- | --- | --- |
| **A. Le RIB du planner, sans prestataire** | Le planner, directement | Aucun : Symbola affiche un RIB et une référence | Faible |
| **B. Le compte du planner chez un prestataire, relié à Symbola** (« Connect » de Stripe, Mollie Connect, compte GoCardless relié) | Le planner, via **son propre** compte chez le prestataire | Logiciel qui crée des demandes de paiement ; il ne touche jamais l'argent | Moyen |
| **C. Plateforme d'encaissement pour compte de tiers** (Lemonway, Mangopay) | Le prestataire, qui reverse au planner | Agent de paiement d'un établissement agréé (démarche, responsabilités) | Lourd |

- **Le modèle C est inutile ici** : il sert aux places de marché qui répartissent un paiement
  entre plusieurs vendeurs. Symbola ne répartit rien et ne prend aucune commission (§ 3). Il
  ajoute une démarche réglementaire et la vérification d'identité de chaque planner par un tiers.
- **Le modèle A existe déjà en partie** : le payeur déclare une échéance réglée et la planner
  confirme (POR-09). Il est gratuit, mais le rapprochement reste à la main.
- **Le modèle B** apporte le paiement en ligne et le rapprochement automatique (FAC-08). Le
  planner ouvre son compte chez le prestataire, accepte ses conditions, puis le relie à Symbola.

**Point pour l'avocat** : confirmer qu'en modèle B, Symbola ne fait pas d'encaissement pour le
compte de tiers. L'argent ne passe jamais par un compte de Symbola. Il faut le confirmer avant
tout choix.

## 3. Les moyens de paiement, vus des gros montants

Exemple : un acompte de **5 000 €**.

| Moyen | Coût indicatif pour 5 000 € | Pour | Contre |
| --- | --- | --- | --- |
| **Virement au RIB du planner** (modèle A) | 0 € | Habitude du métier ; aucun plafond pratique ; aucun intermédiaire | Rapprochement à la main ; délai d'un jour ouvré (instantané si la banque du client le propose) |
| **Virement vers un IBAN dédié du prestataire** (Mollie, « bank transfer ») | ≈ 0,25 € | Référence unique, **rapprochement automatique** | L'argent transite par le compte du planner chez le prestataire avant d'arriver en banque |
| **Paiement par virement initié** (« Pay by bank », banque en ligne du client ; GoCardless Instant Bank Pay, Fintecture) | ≈ 10 € (0,2 % + 0,20 € annoncé chez GoCardless, non confirmé) ; Fintecture sur devis | Instantané, sans saisie d'IBAN, pas de contestation comme sur une carte | Plafonds de virement de la banque du client ; remboursement par un nouveau virement |
| **Prélèvement SEPA** (échéancier) | 0,35 € (Stripe, Mollie) ; 1 % + 0,20 € plafonné à 2 € (GoCardless) | Idéal pour un **échéancier** : acompte, paiements intermédiaires, solde | Mandat à signer ; le client particulier peut demander le remboursement **8 semaines** après un prélèvement autorisé |
| **Carte** | ≈ 75 € (1,5 % + 0,25 € carte européenne standard, Stripe) ; ≈ 140 € (carte premium, 2,8 %) ; ≈ 60 € (1,2 %, carte domestique, Mollie) | Familier, immédiat | Coûteux en pourcentage ; **plafond de paiement de la carte du client** (souvent quelques milliers d'euros par mois) ; frais de litige (≈ 20 €) |

Conséquences :

- **Sur les gros montants, le virement doit rester le moyen proposé en premier.** C'est l'usage du
  métier, et il ne coûte rien. La carte reste possible, au choix du planner, plutôt pour les
  petits montants.
- **Le planner choisit les moyens proposés pour chaque échéance** : virement seul, virement et
  carte, prélèvement pour un échéancier. Le client choisit parmi ceux-là. C'est la traduction de
  « garder le choix du mode de règlement ».
- **Point pour l'avocat** : en France, le planner ne peut pas, en principe, facturer au client un
  supplément pour le paiement par carte (interdiction des surcoûts sur les cartes de particuliers).
  Le coût de la carte reste donc au planner. C'est à confirmer, et à dire dans l'aide.

## 4. Les prestataires

| Prestataire | Siège, statut | Carte | Virement à rapprocher | Virement initié | Prélèvement | Relier le compte du planner (modèle B) | Remarques |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Mollie** | Pays-Bas, établissement agréé dans l'UE | 1,2 % (domestique) à 2,9 % | Oui, ≈ 0,25 €, IBAN français | À vérifier | ≈ 0,25 à 0,35 € | Oui (Mollie Connect, autorisation du planner) | Européen (§ 10) ; sans abonnement ; grille simple |
| **Stripe** | États-Unis, entité européenne en Irlande | 1,5 % + 0,25 € (2,8 % premium) ; hausse annoncée au 21/10/2026 | Oui (virement bancaire) | Non confirmé pour la France | 0,35 € | Oui (Connect « Standard » : rien à payer pour la plateforme) | API la plus complète ; « européen » au sens du § 10 à discuter ; transferts vers les États-Unis à examiner (DPO) |
| **GoCardless** | Royaume-Uni, entité dans l'UE | Non | Non | Oui (Instant Bank Pay) | 1 % + 0,20 €, plafonné à 2 € (offre de base) | Oui (compte du planner relié) | Spécialiste du prélèvement et des échéanciers ; pas de carte |
| **Fintecture** | France, agréé ACPR | Non | Non | Oui (spécialiste) | Non | À vérifier | Tarifs sur devis ; utilisé par la DGFiP |
| **Stancer** (groupe Iliad) | France | ≈ 0,7 à 2,5 % selon les sources | Oui (annoncé) | À vérifier | Oui | À vérifier (API pour une plateforme) | Peu cher ; offre plus réduite |
| **Payplug** (groupe BPCE) | France | 1,5 % + 0,25 € (Starter, 10 € HT/mois) ; 1,1 % (Pro) | Non mis en avant | À vérifier | À vérifier | À vérifier | Paiement en plusieurs fois par Oney |
| **Banques** (Monetico pour CIC et Crédit Mutuel, Systempay pour BPCE, etc.) | France | Sur devis | — | — | — | Non : un contrat de vente à distance **par planner** | Inadaptées à un logiciel partagé : chaque planner négocie son contrat |
| **Lemonway, Mangopay** | France (ACPR) ; Luxembourg (CSSF) | Oui | Oui | — | Oui | Modèle C seulement | Écartés (voir § 2) |

## 5. Recommandation de travail (à trancher par Julien)

1. **Toujours** le modèle A dans Symbola, gratuit et sans prestataire :
   - le RIB du planner et une **référence unique par échéance** sur la facture et le portail ;
   - un QR code de virement européen, que lisent une partie des applications bancaires ;
   - la déclaration du payeur (déjà là).
   Le rapprochement par l'import du relevé bancaire pourra venir plus tard.
2. **En option, pour les planners qui le veulent** : le modèle B, avec **un seul prestataire**
   européen au départ. Ma recommandation est **Mollie** :
   - européen (§ 10) ;
   - virement à rapprocher pour environ 0,25 €, le moyen roi des gros montants ;
   - carte et prélèvement dans le même compte, sans abonnement ;
   - liaison du compte du planner par autorisation (Mollie Connect).

   **Stripe** est l'alternative si l'on privilégie la richesse de l'API, ou si un planner a déjà un
   compte Stripe. **GoCardless** est un complément si les échéanciers par prélèvement deviennent
   centraux.
3. **Derrière une interface** (ARC-12), un second prestataire pourra s'ajouter sans réécrire le
   lot 43.
4. **Avant la spécification du lot 43** :
   - ouvrir des comptes de test chez Mollie et chez Stripe ;
   - vérifier les grilles officielles et la disponibilité du virement initié en France ;
   - poser les deux questions à l'avocat (modèle B, surcoût de la carte) ;
   - poser à la DPO la question des transferts hors UE si Stripe est retenu.

## 6. Le lot 42 : la plateforme agréée

**Deux choix différents, à ne pas confondre** :

1. **La plateforme agréée de ton entreprise** : celle qui recevra tes factures fournisseurs (dès
   le 1er septembre 2026) et émettra les factures d'abonnement de Symbola (au 1er septembre
   2027). Passer par ta banque est un bon choix. C'est une décision de gestion, sans effet sur le
   code. Des offres liées aux banques, d'après les sources consultées :
   - **Qonto** et **Shine** : plateformes agréées elles-mêmes, gratuites ou incluses dans
     certaines offres ;
   - **Crédit Mutuel et CIC** : plateforme d'Euro-Information, 10 factures par mois offertes puis
     environ 0,70 € HT la facture ;
   - **Banques Populaires et Caisses d'Épargne** : iPaidThat ;
   - **BNP Paribas, Société Générale, LCL** : aucune plateforme propre trouvée ; à demander à la
     banque.
2. **Le connecteur de Symbola (FAC-10, JUR-03, JUR-04)** : les factures **des planners** partent de
   Symbola. Chaque planner a **sa** plateforme agréée, souvent celle de sa banque ou de son
   comptable, choisie sans Symbola. Le lot 42 doit donc permettre :
   - soit de **déposer** chaque facture Factur-X (lot 41) chez la plateforme du planner. Il faut
     un connecteur par plateforme, ou une plateforme « hub » qui sait remettre aux autres ;
   - soit de **relier Symbola** à une plateforme partenaire choisie par Symbola, que le planner
     accepte d'utiliser pour les factures émises depuis Symbola.

   Le second choix est plus simple à construire, mais il impose une plateforme au planner. Le
   premier respecte son choix, mais multiplie les connecteurs. Les fiches de l'expert-comptable
   doivent trancher ce point fiscal :
   - un planner peut-il émettre par une plateforme et recevoir par une autre ?
   - comment l'e-reporting des ventes aux particuliers (JUR-04) suit-il ?

   **Je ne le tranche pas seul.**

**Calendrier** : l'émission devient obligatoire pour les TPE et PME au 1er septembre 2027. Le
connecteur doit être en production **avant l'été 2027** (lot 42). La question à l'expert-comptable
est donc à poser maintenant.

## Sources consultées (18/11/2026)

- Tarifs Stripe : [realdev.fr](https://www.realdev.fr/stripe-augmente-ses-tarifs-2026/),
  [findmycompany.ai](https://findmycompany.ai/en/guides/stripe-fees),
  [credit-et-banque.com](https://www.credit-et-banque.com/paiement-en-ligne-stripe-gocardless-mollie-frais/),
  [docs.stripe.com (comptes Express)](https://docs.stripe.com/connect/express-accounts),
  [victoire-digital.fr (Connect)](https://victoire-digital.fr/blog/stripe-connect-marketplace-guide-2026/).
- Mollie : [mollie.com/pricing](https://www.mollie.com/pricing),
  [mollie.com (virement)](https://www.mollie.com/payments/bank-transfer),
  [quasa.io](https://quasa.io/fr/media/stripe-ou-mollie-en-france-le-moyen-de-paiement-change-la-facture).
- GoCardless : [nathanibgui.com](https://nathanibgui.com/blog/gocardless-vs-slimpay/),
  [passerelledepaiement.com (open banking)](https://www.passerelledepaiement.com/actualites/open-banking-a2a-paiement-2026/).
- Fintecture : [lafabriquedunet.fr](https://www.lafabriquedunet.fr/logiciel/fintecture),
  [euro-saas.com](https://euro-saas.com/saas/fintecture/),
  [mind.eu.com (DGFiP)](https://www.mind.eu.com/fintech/services-bancaires/open-banking/open-banking-la-dgfip-va-proposer-linitiation-de-paiement-avec-fintecture/).
- Lemonway et Mangopay : [passerelledepaiement.com](https://www.passerelledepaiement.com/guides/comparatif-mangopay-lemonway/),
  [lemonway.com (statut d'agent)](https://www.lemonway.com/blog/obtenir-statut-agent-paiement).
- Stancer, Payplug, Monetico, Systempay : [shunpo.fr](https://www.shunpo.fr/technologies/payplug),
  [mobiletransaction.org](https://fr.mobiletransaction.org/paiement-en-ligne-meilleures-solutions/),
  [digitiz.fr](https://digitiz.fr/solutions-paiement-en-ligne/).
- Plateformes agréées : [francenum.gouv.fr](https://www.francenum.gouv.fr/guides-et-conseils/pilotage-de-lentreprise/dematerialisation-des-documents/facturation-0),
  [compta-online.com (banques)](https://www.compta-online.com/plateforme-agreee-facturation-electronique-ao8705),
  [pro.credit-agricole.fr](https://pro.credit-agricole.fr/comptabilite/facture/electronique/plateforme-agreee),
  [comparatif-facture-electronique.fr](https://www.comparatif-facture-electronique.fr/plateformes-agreees/).
  Liste officielle : impots.gouv.fr (à consulter directement).
