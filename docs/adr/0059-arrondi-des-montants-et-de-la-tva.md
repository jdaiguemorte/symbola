# ADR 0059 — Arrondi des montants et de la TVA

- Statut : accepté (décision D3 a du lot 25, 11/11/2026) ; à confirmer par l'expert-comptable
  (`docs/conformite/fiche-expert-comptable.md`, question 10)
- Date : 2026-11-11
- Précise : [0010](0010-facturation-conforme.md) (facturation conforme).
- Exigences : DAT-05 de `docs/CAHIER_DES_CHARGES.md` (écart assumé sur le mode de calcul de la
  TVA).

## Contexte

DAT-05 demande des montants en centimes entiers et « une TVA calculée par ligne puis
totalisée, avec une règle d'arrondi unique et documentée ». Le code calcule la TVA **par taux**
(`apps/symbola/modules/quotes/amounts.ts`). C'est aussi le calcul de la norme européenne de
facture électronique (EN 16931), que suit Factur-X (lots 41 et 42) : le montant de TVA y est
calculé par taux, à partir de la base de ce taux. Calculer par ligne puis additionner peut
donner un centime d'écart avec ce calcul.

## Décision

1. **Unités** : montants en centimes entiers, taux et remises en points de base (2000 = 20 %),
   quantités en millièmes (1500 = 1,5). Jamais de nombre à virgule flottante.
2. **Une seule règle d'arrondi** : au centime le plus proche, un demi-centime vers le haut
   (`roundHalfUp`), appliquée à chaque produit.
3. **Ligne** : brut = quantité × prix unitaire, arrondi ; remise de ligne = brut × taux de
   remise, arrondie ; net = brut − remise.
4. **TVA par taux** : les nets des lignes sont additionnés par taux ; la remise globale est
   répartie entre les taux au prorata de leur base (la dernière part reçoit le reste, pour un
   total exact) ; la TVA de chaque taux = base × taux, arrondie une seule fois ; total TVA =
   somme des TVA par taux ; TTC = HT + TVA.
5. **Échéancier et factures d'acompte** : chaque part est arrondie, la dernière reçoit le reste
   (`schedule.ts`, `invoicing.ts`) : la somme des parts égale toujours le total.
6. Si l'expert-comptable demande le calcul par ligne, il est changé avant les contrats et les
   factures complètes (lot 31a), par un ADR qui remplace celui-ci.

## Conséquences

- DAT-05 est « Divergent » dans `docs/gap.csv` sur le mode de calcul, justifié par cet ADR ; la
  règle d'arrondi, elle, est unique et documentée.
- Le passage à Factur-X ne demandera pas de changer les totaux.
