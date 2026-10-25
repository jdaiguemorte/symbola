# ADR 0013 — Authentification maison derrière `packages/auth` (remplace ADR 0004 pour le MVP)

- Statut : accepté, remplace ADR 0004 pour le MVP
- Date : 2026-10-26

## Contexte

L'ADR 0004 proposait Zitadel auto-hébergé : SSO entre apps, MFA, multi-organisation native. Pour
un hub qui dessert une seule app (ADR 0011) et une seule organisation cliente au démarrage, un
IdP complet est un composant lourd à exploiter (base propre, surveillance, mises à jour) pour un
développeur solo, sans bénéfice de SSO inter-apps puisqu'il n'y a qu'une app. C'est le composant
le plus coûteux à faire fonctionner seul parmi ceux remis en cause par cette série d'ADR.

## Décision

Authentification maison, même patron que les projets Kindo et Capsule Vocale de Julien :
argon2id (`@node-rs/argon2`, paramètres durcis), jeton de session opaque (`randomBytes(32)`
base64url) en table `session`, cookie httpOnly `sameSite=lax` `secure` en production. MFA : TOTP
(ex. `otpauth`), ajoutée comme un champ sur l'utilisateur, obligatoire pour les rôles
professionnels, facultative pour les mariés — mêmes règles que l'ADR 0004. Tout appel d'authentification
passe exclusivement par `packages/auth` ; aucun autre code n'appelle directement la lib
d'authentification.

## Conséquences

Aucun mot de passe tiers à exploiter, mais aucun SSO si une deuxième app apparaît un jour (non
nécessaire tant qu'il n'y a qu'une app, ADR 0011). C'est la migration la plus coûteuse des
quatre révisées par cette série d'ADR si Zitadel devient nécessaire plus tard (ouverture à
d'autres clients, besoin de SSO) : migration des comptes existants, invalidation des sessions,
nouveau flux de connexion, reconfiguration MFA par utilisateur. L'isolation stricte derrière
`packages/auth` imposée dès ce lot est ce qui permet de faire cette bascule sans toucher le reste
du code applicatif.
