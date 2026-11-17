# ADR 0077 — Suivi des erreurs : GlitchTip, hors d'internet, et des erreurs triées par l'app

- Statut : accepté (lot 40b, décision D14 validée par Julien le 17/11/2026 ; décision Q27)
- Date : 2026-11-17
- Complète : [0074](0074-brouillons-conflits-et-erreurs-referencees.md) (référence courte d'une
  erreur, à l'écran et au journal).
- Exigences : NFR-16 et NFR-27 de `docs/CAHIER_DES_CHARGES.md` (pile de référence, § 10 :
  « suivi d'erreurs auto-hébergé ») ; spécification `docs/lots/lot-40-exploitation-mesures.md`
  (partie 40b).

## Contexte

Depuis le lot 39b, chaque erreur du serveur est notée au journal du conteneur avec sa référence
courte, celle que l'écran montre. Rien ne regroupe les erreurs, ne les compte ni n'alerte ; les
erreurs nées dans le navigateur ne laissent aucune trace. Q27 a choisi un service de suivi des
erreurs ; NFR-27 veut un ADR pour tout composant ajouté sur le serveur.

## Décision

1. **GlitchTip 6.2.6** (licence MIT, compatible avec le protocole des kits Sentry), utilisé sans
   modification, dans le Compose de chaque environnement, profil `erreurs` (ne démarre que si
   Julien l'active) :
   - un seul conteneur (web et worker, `SERVER_ROLE=all_in_one`), sans Valkey (file et cache dans
     sa base) ;
   - **sa propre base PostgreSQL** (`glitchtip-postgres`) : GlitchTip exige
     `max_locks_per_transaction=512`, un réglage du serveur qu'on ne change pas pour la base de
     Symbola ; ses données ne sont pas sauvegardées (des erreurs techniques, gardées 30 jours) ;
   - **hors d'internet** : ni Caddy, ni alias ; l'app lui écrit par le réseau Docker, Julien ouvre
     son écran par un tunnel SSH (port en boucle locale, distinct par environnement) ;
     `ALLOWED_HOSTS` limité à ces noms ; inscriptions, création d'organisation et administration
     Django fermées ; aucun e-mail envoyé (alerte par webhook vers ntfy, réglée dans son écran).
2. **L'app trie ce qui sort** (`apps/symbola/lib/error-tracking.ts`, sans dépendance : pas de kit
   `@sentry/nextjs`) : la référence courte, le type de l'erreur, sa pile d'appels (fichiers,
   fonctions, lignes), la route sans requête, identifiant, jeton ni adresse e-mail, la version de
   l'app et l'origine. Jamais le message de l'erreur (il peut citer une valeur saisie), l'adresse
   complète, la personne, les en-têtes ni les cookies (SEC-20).
3. **Serveur** : `onRequestError` (instrumentation.ts) note l'erreur au journal comme avant, puis
   l'envoie. **Navigateur** : l'écran d'erreur envoie une erreur née dans le navigateur (sans
   condensé du serveur) au relais `POST /api/erreurs` : même origine, débit limité (30 par quart
   d'heure et par adresse IP), taille bornée ; l'app refait le tri avant de transmettre.
4. **Sans adresse de projet** (`ERROR_TRACKING_DSN` vide), rien ne part ; un service injoignable ne
   fait jamais lever l'erreur d'origine (délai de 3 s).

## Conséquences

- Vérifié le 17/11/2026 sur un GlitchTip 6.2.6 local : l'enveloppe est reçue, l'erreur regroupée
  sous son type, avec la référence, la route nettoyée, l'origine et la version ; ni l'adresse
  e-mail du message piégé, ni le message, ni l'identifiant de la fiche ne sont gardés.
- Mémoire en plus sur le VPS : 512 Mo (staging) et 768 Mo (production) au plus pour GlitchTip,
  256 Mo pour sa base, sur 24 Go ; à mesurer à la mise en service (NFR-27 : un seul serveur).
- Écart à la spécification (partie K) : la base est un PostgreSQL à part, pas une base de plus
  dans celui de Symbola, à cause du réglage `max_locks_per_transaction`.
- Mise en service par Julien : `docs/runbooks/deploiement.md`, § Suivi des erreurs.
- La version 7 de GlitchTip est sortie le 9/11/2026 ; Renovate proposera la montée, à vérifier
  contre ce document.
