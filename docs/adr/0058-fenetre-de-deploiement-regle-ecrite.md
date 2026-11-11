# ADR 0058 — Fenêtre de déploiement : règle écrite, appliquée à la main

- Statut : accepté (décision Q32 de Julien du 11/11/2026) ; écart assumé à NFR-07 pendant le
  pilote
- Date : 2026-11-11
- Exigences : NFR-07 de `docs/CAHIER_DES_CHARGES.md`.

## Contexte

NFR-07 interdit tout déploiement du vendredi midi au lundi matin, quand les planners sont sur le
terrain ; sa vérification demande que la chaîne de déploiement refuse hors fenêtre, sauf
correctif urgent motivé. Aujourd'hui, Julien déploie à la main, en suivant
`docs/runbooks/deploiement.md` ; aucune chaîne automatique ne déploie la production.

## Décision

1. **Règle** : aucun déploiement en production du vendredi 12 h au lundi 8 h, heure de Paris.
2. **Exception** : un correctif urgent, motivé et noté avec sa raison dans le journal
   d'exploitation.
3. **Application à la main** : la règle est écrite en tête du runbook de déploiement. Le staging
   n'est pas concerné.
4. **Revoir** quand le déploiement de la production sera automatisé (lot 40a) : la chaîne devra
   alors refuser hors fenêtre.

## Conséquences

- NFR-07 reste « Divergent » dans `docs/gap.csv`, justifié par cet ADR.
- Le risque d'oubli est porté par une seule personne, qui est aussi la seule à déployer.
