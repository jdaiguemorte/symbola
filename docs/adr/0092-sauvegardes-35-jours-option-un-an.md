# ADR 0092 — Sauvegardes : 35 jours glissants de base, un an en option payante

- Statut : accepté (décision de Julien du 18/11/2026, réponse à Q35)
- Date : 2026-11-18
- Écart assumé avec : NFR-13 (« 7 quotidiennes, 4 hebdomadaires, 12 mensuelles »). Le second
  critère de NFR-13 (« le serveur ne peut pas effacer ses propres sauvegardes ») est inchangé.
- Complète : ADR 0051 (sauvegarde restic vers la Storage Box), ADR 0056 (purge automatique).

## Contexte

Aujourd'hui, `infra/backup/backup.sh` garde 7 copies quotidiennes, 4 hebdomadaires et
12 mensuelles. Une donnée effacée dans Symbola survit donc jusqu'à un an dans les sauvegardes :
- effacement demandé par une personne (RGPD) ;
- purge des invités à J+30 ;
- fermeture d'un espace.

La DPO demande une rotation de 35 jours au plus, et un journal des effacements rejoué après toute
restauration (réponse du 13/11, Q35).

Garder un an servirait surtout à retrouver une erreur découverte tard : une suppression remarquée
des mois après, ou une corruption lente. Ce besoin est rare. Les pièces comptables, elles, restent
dans l'application dix ans : elles n'ont pas besoin des sauvegardes. Un an de copies coûte aussi
en stockage.

## Décision

1. **Base : 35 jours glissants.** Les sauvegardes permettent de remonter à n'importe quel jour des
   35 derniers jours, puis disparaissent.
2. **Option payante, plus tard : remonter jusqu'à un an.** Une sauvegarde est une copie de toute la
   base, toutes organisations mêlées : on ne peut pas garder un an pour une seule organisation
   sans garder les données des autres. L'option prendra donc la forme d'une **archive mensuelle
   propre à l'organisation qui la souscrit**, faite à partir de l'export complet du lot 35, gardée
   un an. Elle relève du lot 54 (abonnement, options). Son contrat dira qu'une donnée effacée peut
   y rester jusqu'à un an, au choix de la planner.
3. Le **journal des effacements** est rejoué après toute restauration (lot 35c), pour qu'une
   restauration ne fasse pas revenir une donnée effacée.

## Conséquences

- `infra/backup/backup.sh` et `backup.env.example` passent à une rétention de 35 jours
  (`--keep-within 35d`, ou 35 copies quotidiennes). Les tests de configuration du déploiement
  suivent.
- Les copies instantanées de la Storage Box, qui protègent contre l'effacement par le serveur,
  passent elles aussi à 35 jours au plus. C'est un réglage chez Hetzner : un geste de Julien.
- Sur le VPS, le changement prend effet au prochain déploiement, après la fin du gel. Julien met à
  jour `backup.env` et la Storage Box en suivant `docs/runbooks/restauration.md`.
- Le registre et la fiche de la DPO indiquent 35 jours.
- NFR-13 passe à « Divergent » dans `docs/gap.csv`, justifié par cet ADR.
