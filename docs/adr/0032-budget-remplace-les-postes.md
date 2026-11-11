# ADR 0032 — « Budget » remplace les postes prestataires

- Statut : remplacé par [0054](0054-budget-a-cinq-montants.md) (cinq montants), en vigueur jusqu'au
  lot 28
- Date : 2026-11-05
- Précise : EVT-03 (postes prestataires), BUD-01 à BUD-04, ADR 0031 (prestataires consultés)

## Contexte

En recette (05/11/2026), la planner pilote n'a compris ni « postes » ni « postes de dépenses ».
Elle ne les retrouvait que dans la répartition budgétaire, qu'elle ne fait pas avant le budget.
Décision de Julien : on abandonne les postes et on garde « Budget ». Spécification :
`docs/lots/lot-12-demarrage.md` (EVT-17).

## Décision

1. **Mêmes données, autre présentation.** Un poste (`events.event_vendor_slots`) devient une
   **ligne du budget** ; les postes par défaut deviennent les lignes du budget par défaut. Les
   tables, contrats et l'événement interne `events.vendor_slot.booked` gardent leurs noms
   techniques : aucune migration de données, aucun contrat cassé.
2. **Un seul onglet « Budget »** sur la fiche événement : ligne (avec icône), prestataire retenu
   ou consultés, statut, prévu, réel, écart. L'ancienne adresse `?onglet=prestataires` mène au
   même onglet.
3. **Le budget existe dès la création de l'événement.** Le prévu devient facultatif
   (`budget.budget_lines.planned_amount_cents` accepte null) : une ligne se crée quand un
   montant est connu (prévu saisi, ou réel venu d'une réservation). Une ligne sans prévu n'a pas
   d'écart. La répartition (BUD-01) reste une aide facultative pour proposer des prévus.
4. **Icône par ligne** (`icon`, clé d'un jeu fixe d'icônes de l'app), pré-réglée par les modèles
   de départ par métier, reprise du défaut par chaque nouvel événement, affichée au programme du
   jour J pour voir d'un coup d'œil les prestataires concernés.
5. Tous les textes (FR/EN), l'aide et les tutoriels parlent de « ligne du budget ».

## Conséquences

- Une réservation crée désormais la ligne du budget si elle n'existait pas (auparavant ignorée).
- Les totaux comptent un prévu absent comme zéro ; l'espace clients affiche « Non défini ».
- Si un jour le budget est extrait en app autonome, la ligne du budget restera la clé de
  rapprochement avec les prestataires consultés (module events).
