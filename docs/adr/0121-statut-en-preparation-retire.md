# ADR 0121 — Le statut « En préparation » est retiré ; la date de signature est gardée

- Statut : accepté (lot 72a ; décisions J1 et J2 de Julien du 27/11/2026)
- Date : 2026-11-27
- Diverge de : `docs/CAHIER_DES_CHARGES.md`, EVT-05 (sept statuts, dont « Confirmé » et « En
  préparation » distincts).
- Complète : ADR 0055 (statuts d'évènement du lot 34a).
- Exigences : EVT-05, UX-06, UX-07 ; spécification `docs/lots/lot-72-aujourdhui-et-evenements.md`
  (§ 4.1, § 4.2, § 5.1 ; § 8 point 1) ; maquette 15 du lot 68 (E1, E2).

## Contexte

Le lot 34a a repris les statuts du cahier des charges : Option, Confirmé, En préparation, Jour J (une
phase, jamais stockée), Clôturé, Reporté, Annulé. Aucune règle de l'app ne distinguait « Confirmé » de
« En préparation » : mêmes tâches, mêmes rappels, même report, même clôture. Les maquettes du volet 3
(E1) les réunissent en une seule étape, « Signé, en préparation ». Garder deux valeurs en base pour une
seule à l'écran obligeait à tenir une correspondance de plus. Julien a tranché (J1) : « Je n'ai rien en
production… le staging sera remis à zéro si besoin ».

La frise datait chaque étape du jour du clic dans Symbola, alors qu'un contrat peut avoir été signé sur
papier des semaines plus tôt (E2, J2).

## Décision

1. **`in_preparation` disparaît** de l'énumération `events.event_status` (migration 0225) et du contrat
   `EventStatus`. Les évènements, les reports en cours (`postponed_from_status`) et les lignes
   d'historique qui le portaient passent à `confirmed`. L'annulation de la migration remet la valeur
   dans l'énumération sans reconvertir les lignes. La migration demande l'arrêt de l'app
   (`arret-requis`).
2. **Le journal reste lisible** : les événements internes `events.event.created` et
   `events.event.status_changed` (version 2) acceptent encore la valeur retirée en lecture et la
   lisent `confirmed` ; aucun n'est plus publié avec elle. Le contrat reste compatible pour ses
   lecteurs ; aucun numéro de version ne change.
3. **Quatre étapes affichées** (`EVENT_DISPLAY_STEPS`, `displayStep`) : une demande en cours
   (`option`), signé et en préparation (`confirmed`), jour J (la phase), clôturé (`closed`). Reporté
   et Annulé ne sont pas des étapes.
4. **La date effective d'un changement de statut** (`event_status_history.effective_on`, migration
   0224) : posée par « Le contrat est signé… » (`markContractSigned` : au plus aujourd'hui dans le fuseau
   de l'évènement, au plus tôt un an avant sa création) et par l'automatisme « devis signé » (le jour de
   la signature), et à l'annulation (le jour). La frise la lit d'abord, sinon le jour du changement dans
   le fuseau de l'évènement.
5. Un fichier importé qui dit « En préparation » crée un évènement « Confirmé » (synonymes d'import).

## Conséquences

- Un statut du cahier des charges n'existe plus en base : ligne EVT-05 de `docs/gap.csv`.
- Les écrans actuels gardent leur frise, à quatre étapes ; la frise en lecture seule et le bouton
  « Le contrat est signé… » arrivent au paquet 72d, qui pourra réduire les statuts posés à la main.
- Les schémas d'export (`docs/schemas/export/v1/events`) ne listent plus la valeur : une archive
  d'avant reste lisible par un humain, la valeur y vaut « Confirmé ».
