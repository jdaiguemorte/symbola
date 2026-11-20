# Rejeu HUB-27, ARC-06, NFR-26, DOC-06 — abonnement, forfaits, interrupteurs et quota (lot 54)

Aucun scénario du cahier des charges (§ 17) ne joue l'abonnement : HUB-27 n'est requis qu'à
l'ouverture commerciale. Le rejeu suit les tests prévus par la spécification du lot 54
(`docs/lots/lot-54-abonnement-et-forfaits.md`, Tests), sur des ateliers neufs, à l'horloge simulée.

## Lot 54 — essai, offre, résiliation, quota

- Date : 19/11/2026, en local, par Claude Code.
- Environnement : base neuve `symbola_lot54` (bootstrap puis migrations jusqu'à 0193), Garage,
  ClamAV et Mailpit du socle de dev.
- Méthode : `modules/hub/subscriptions.integration.test.ts` (20 cas) et
  `modules/hub/subscription-rules.test.ts` (26 cas, horloge simulée : veille, jour même, heure
  d'été) ; le parcours e2e `e2e/hub-27-abonnement.spec.ts` rejoue les écrans (ordinateur et 375 px,
  axe-core, compte des clics de la résiliation).

| Étape | Ce qui se passe | Résultat |
| --- | --- | --- |
| 1 | Libre-service fermé (interrupteur) | Inscription sans essai ; « Mon abonnement » dit « réglé par l'équipe Symbola » |
| 2 | Ouvert à la pilote seulement | Ouvert pour elle, fermé pour un autre atelier ; une clé inconnue fermée |
| 3 | Inscription, libre-service ouvert | Essai de 30 jours, suite complète ouverte |
| 4 | J-8, J-7, J-6, J-1 | Aucun rappel, puis J-7 une fois, puis J-1 une fois |
| 5 | Fin de l'essai | Lecture seule, rien d'effacé ni fermé ; écriture ramenée à « Mon abonnement » ; export ouvert |
| 6 | Choix de la suite Solo | Lecture seule levée ; Rendez-vous et Invités fermés à la requête suivante, « indisponible » |
| 7 | Option, App seule, Pilote | Option ouvre son module ; App seule n'ouvre que l'app choisie ; Pilote tout, non modifiable ici |
| 8 | Passage à l'Agence à mi-période | Effet immédiat, écart au prorata positif, période conservée ; reconduction ensuite |
| 9 | Résiliation (trois clics), retour, résiliation | Accès jusqu'à la fin de la période ; à l'échéance, fermeture du lot 35c ; rouvert, lecture seule |
| 10 | Quota à 81 %, 96 %, 100 % | Un e-mail par palier ; dépôts acceptés pendant 7 jours, refusés ensuite ; tranche ajoutée : levé |
| 11 | Abus | Autre organisation, Planner, Comptable refusés ; RLS sur abonnement et quota ; Pilote jamais en libre-service |

Résultat : **passe sans blocage** (intégration). Parcours e2e : voir le bilan du lot 54.
