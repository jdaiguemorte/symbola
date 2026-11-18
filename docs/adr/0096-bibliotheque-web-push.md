# ADR 0096 — Bibliothèque `web-push` pour le chiffrement des notifications push

- Statut : accepté (accord de Julien du 18/11/2026, décision D4 du lot 53 dans son option a)
- Date : 2026-11-18
- Complète : [0095](0095-notifications-automatismes-radar-et-vocabulaire.md), [0064](0064-jour-j-hors-ligne.md).
- Exigences : ARC-09, HUB-15 ; SEC-01 (« sécurité héritée, pas réinventée », CLAUDE.md § 2.7).

## Contexte

Une notification Web Push doit être chiffrée de bout en bout jusqu'au navigateur (RFC 8291, ECDH P-256
et AES-128-GCM) et la demande au service de push signée par une clé VAPID (RFC 8292, JWT ES256). C'est
de la cryptographie : CLAUDE.md interdit de l'écrire nous-mêmes. Rien dans la pile ne le fait.

## Décision

- Dépendance de production `web-push` 3.6.x (application `apps/symbola`), référence de Node pour la
  norme, avec ses types `@types/web-push` en développement. Elle n'est appelée que par
  `modules/hub/push.ts`, derrière l'interface `PushSender` (remplacée dans les tests) ; durée de vie d'un
  message : six heures ; délai d'appel : dix secondes.
- **Licence** : `web-push` est sous **MPL-2.0** (et non MIT, comme l'indiquait la spécification) ; ses
  dépendances (`http_ece`, `asn1.js`, `jws`, `https-proxy-agent`, `minimist`) sont sous MIT. Employée sans
  modification, comme `lightningcss` (MPL-2.0, déjà en production) : elle est déclarée dans
  `tools/licences/autorisees.json` et `docs/conformite/licences.md`. Écart signalé à la session de
  coordination le 18/11/2026 pour confirmation de Julien.
- Clés VAPID propres à chaque environnement (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, base64url),
  tirées par `apps/symbola/scripts/generate-vapid-keys.mjs` (Node seul, sans dépendance), validées au
  démarrage par `packages/env` (paire cohérente), transmises par le compose de production sans valeur par
  défaut, générées à chaque passage de la CI ; procédure dans `docs/runbooks/deploiement.md`. Le sujet
  VAPID est l'adresse publique de l'app en https (une adresse `mailto:` neutre en développement).

## Conséquences

- Les services de push des navigateurs (Apple, Google, Mozilla) reçoivent un message chiffré, son heure
  et sa durée de vie : destinataires techniques (`docs/conformite/sous-traitants.md`, DPO-10).
- Perdre ou changer les clés ne perd aucune donnée : chaque appareil réactive le push.
