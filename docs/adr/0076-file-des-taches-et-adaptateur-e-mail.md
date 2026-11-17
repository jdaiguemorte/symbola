# ADR 0076 — File des tâches de fond, e-mail derrière une interface, couverture des règles métier

- Statut : accepté (lot 40b, décisions D9 à D13 validées par Julien le 17/11/2026)
- Date : 2026-11-17
- Complète : [0014](0014-evenements-internes-pour-le-mvp.md) (événements internes),
  [0072](0072-emails-a-l-image-de-l-organisation.md) (e-mails de l'organisation),
  [0073](0073-suppression-logique-et-corbeille.md) (purges horaires).
- Exigences : ARC-10, ARC-12, ARC-06, HUB-20 et NFR-21 de `docs/CAHIER_DES_CHARGES.md` ;
  spécification `docs/lots/lot-40-exploitation-mesures.md` (partie 40b).

## Contexte

Les e-mails partaient pendant la requête : un serveur d'envoi indisponible faisait échouer le geste,
sans reprise. Un même e-mail pouvait repartir si son déclencheur était rejoué (webhook de
signature, rapprochement). Les tâches périodiques (purges, rapprochements, rappels) tournaient dans
le seul processus de l'app, sans protection si deux processus tournaient un instant ensemble (un
déploiement). L'e-mail n'avait pas d'interface : un double de test n'existait qu'en passant par
Mailpit. Aucun seuil de couverture n'était contrôlé.

## Décision

1. **Interface d'e-mail (ARC-12)** : `packages/mail` expose `MailTransport`, avec un adaptateur
   SMTP (nodemailer) et un double en mémoire. Une suite de contrat commune
   (`transport-contract.ts`) passe contre les deux (SMTP contre Mailpit). `sendMail` garde sa
   signature. Le paiement, la plateforme agréée et l'IA suivront ce patron dans leurs lots.
2. **File des tâches (ARC-10)** : table `hub.jobs` (migration 0149, RLS). Un e-mail d'une
   organisation s'y inscrit avec une clé d'unicité, est tenté aussitôt (même délai qu'avant pour la
   personne), puis repris par le worker toutes les 30 s, cinq tentatives au plus (1, 5, 15 puis 60
   minutes). Garanties :
   - une tâche inscrite deux fois sous la même clé, ou rejouée, n'envoie qu'un e-mail ; les
     appelants rejouables donnent une clé faite d'identifiants (exemplaire signé, signature
     constatée, export prêt, invitation), jamais d'adresse ;
   - une tâche n'est prise que par un seul passage (`UPDATE … WHERE state = 'pending'`) ;
   - une tâche interrompue en plein envoi (processus arrêté) passe « interrupted » et n'est pas
     renvoyée : au plus une fois plutôt qu'en double ;
   - le contenu (destinataire, message, pièces jointes) s'efface dès la fin, réussie ou non ; la
     ligne garde le genre, l'état et les dates 30 jours, puis disparaît. Registre RGPD, recherche
     et effacement d'un e-mail en attente qui vise une personne.
3. **E-mails sans organisation** : le lien de connexion et les comptes créés par l'Exploitation
   partent en direct, par l'interface d'e-mail : un lien de connexion en retard ne sert plus, la
   personne le redemande.
4. **Tâches périodiques** : elles ne démarrent que dans le processus qui tient le verrou consultatif
   PostgreSQL `symbola:taches-periodiques`, pris sur une connexion de la réserve partagée gardée à
   part. Au déploiement, le nouveau processus attend que l'ancien s'arrête.
5. **Activation des modules (ARC-06)** : lue à chaque requête, par n'importe quel processus ; test
   du critère. Les interrupteurs par fonction rejoignent l'abonnement (lot 54, HUB-27).
6. **Libellés métier (HUB-20)** : un test lit les libellés FR et EN des référentiels de départ et
   les cherche entre guillemets dans les sources de l'app et des paquets
   (`tools/referentiel/hub-20-libelles.test.mjs`).
7. **Couverture (NFR-21)** : `@vitest/coverage-v8` (dépendance de développement, MIT, même équipe
   que Vitest), seuil de 80 % des lignes et des branches sur les fichiers de règles métier (calculs,
   droits, échéances), étape de la CI ; `apps/symbola/e2e/parcours.json` relie chaque parcours P0
   du cahier des charges à ses parcours de bout en bout, contrôlé par un test.

## Conséquences

- ARC-10, ARC-12, HUB-20 et NFR-21 passent à Conforme ; ARC-06 reste Partiel (fonctions au lot 54).
- Écart à la spécification : l'inscription de l'e-mail ne se fait pas dans la même transaction que
  l'écriture métier (les appelants écrivent dans d'autres modules, par leur `service.ts`). Elle
  suit l'écriture ; la clé d'unicité assure qu'un rejeu ne double rien.
- Un e-mail d'une organisation n'échoue plus au moment du geste quand le serveur d'envoi ne répond
  pas : il repart plus tard. Une variable manquante ou le plafond d'envoi arrêtent toujours le
  geste, avant l'inscription.
- Le seuil de couverture est global sur la liste des fichiers de règles : un nouveau fichier de
  règles rejoint `BUSINESS_RULE_FILES` dans `apps/symbola/vitest.config.ts`.
