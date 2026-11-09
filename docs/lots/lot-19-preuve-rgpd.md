# Lot 19 — Fin de la preuve des demandes RGPD

**Statut** : fait sur la branche `lot-19-preuve-rgpd` (RGPD-09). Décisions de Julien du
09/11/2026 : 5 ans après la clôture, par la purge mensuelle validée à la main ; choix
d'architecture dans l'[ADR 0048](../adr/0048-preuve-des-demandes-rgpd-anonymisee.md).
Reste : recette sur le staging (migration 0083 au déploiement).

## Contexte

Suite signalée au lot 18 (ADR 0047, « Manque connu ») : une demande close garde le nom de la
personne comme preuve de son traitement, mais rien ne le remplaçait par « [anonymisé] » à la fin
de cette conservation, contrairement au registre de données. Julien a demandé si ce nom
disparaît après un oubli validé : non, il restait.

## RGPD-09 — La preuve d'une demande close est anonymisée à son terme

- **Étant donné** une demande close, **quand** la durée réglée après le jour de sa clôture
  (heure de Paris, 5 ans par défaut) est atteinte, **alors** elle apparaît dans la purge
  mensuelle, avec le nom de la personne : le jour même, jamais la veille, y compris au passage
  à l'heure d'été.
- **Étant donné** une demande en cours (ouverte ou prolongée), **alors** elle n'apparaît
  jamais dans la purge, quelle que soit sa date de réception.
- **Quand** la titulaire change la durée dans les Réglages, **alors** la liste suit ce réglage.
- **Quand** elle valide la ligne, **alors** le nom devient « [anonymisé] » et le motif de
  prolongation est effacé ; le type, les dates et le journal de la demande restent ; la demande
  reste dans la liste et ne revient plus dans la purge.
- **Quand** elle exclut la ligne avec un motif, **alors** le nom reste et la ligne revient le
  mois suivant.
- **Étant donné** une demande close, **alors** son dossier dit jusqu'à quand le nom est gardé,
  puis que la preuve est terminée ; le nom anonymisé s'affiche traduit (FR, EN).
- Isolation : une organisation ne voit ni n'anonymise la preuve d'une demande d'une autre, même
  en appelant le contrat du hub avec son identifiant.

Tests : `packages/privacy/src/retention.test.ts`, `lib/privacy/purge.integration.test.ts`,
`app/rgpd/person.test.ts`, chaîne d'annulation (`rollback.integration.test.ts`), parcours
`rgpd-09-preuve-anonymisee`.
