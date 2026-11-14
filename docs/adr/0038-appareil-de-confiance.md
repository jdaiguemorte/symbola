# ADR 0038 — Appareil de confiance : le code de double authentification redemandé tous les 90 jours

- Statut : **remplacé** au lot 33 par [0052](0052-identite-fournisseur-open-source.md) et
  [0067](0067-fournisseur-d-identite-logto.md) : la table des appareils de confiance a disparu
  (migration 0130) ; quand redemander le second facteur relève désormais de Logto
- Date : 2026-11-08
- Complète : [0013](0013-auth-maison-pour-le-mvp.md) (authentification maison),
  [0037](0037-double-authentification-protegee.md) (double authentification protégée)
- Story : L16-SEC-03 (`docs/lots/lot-16-reprise-ux.md`)

## Contexte

Julien a posé deux questions le 08/11/2026 : la double authentification est-elle obligatoire, et
faut-il la demander à chaque connexion ? Les applications bancaires ne la demandent qu'une fois de
temps en temps.

- **Aucune obligation légale** pour un logiciel de devis et de factures. Les règles de
  facturation portent sur l'inaltérabilité, la numérotation et l'archivage. Le RGPD
  (article 32) demande une sécurité adaptée au risque, et la CNIL recommande la double
  authentification pour un accès distant à des données personnelles, ce que manipulent les
  planners (coordonnées des mariés, budgets, devis). L'obligation pour les rôles
  professionnels reste donc un choix du projet (ADR 0013), maintenu.
- **Les banques** (directive européenne DSP2) exigent l'authentification forte à chaque paiement,
  mais pour la simple consultation seulement tous les 90 à 180 jours, sur un appareil reconnu.
  C'est ce modèle que retient Julien : **90 jours**.

## Décision

1. Sur l'écran du code, une case **« Se souvenir de cet appareil pendant 90 jours »**,
   **décochée par défaut** (ordinateur partagé), avec un rappel de ne pas la cocher sur un
   ordinateur partagé.
2. Code validé avec la case cochée : un **jeton aléatoire d'appareil** est posé dans un cookie
   `symbola_appareil` (httpOnly, `SameSite=Lax`, `Secure` en production, 90 jours). Seul son
   hachage est stocké (`hub.trusted_devices`, comme les sessions), avec l'échéance et la date de
   dernière utilisation. Le jeton est créé dans la même transaction que la session (ADR 0037).
3. À la connexion, **le mot de passe reste toujours demandé**. Un jeton d'appareil valide, non
   échu et **appartenant à ce compte** dispense seulement du code. L'échéance est fixe
   (90 jours après le code), pas glissante.
4. **Jamais pour l'Admin** : vu ses droits sur toute la suite, il saisit son code à chaque
   connexion ; la case ne lui est pas proposée.
5. **Révocation de tous les appareils du compte** : réinitialisation du mot de passe, de la
   double authentification par l'Admin (ADR 0029), nouvelle clé de double authentification,
   « Oublier tous mes appareils » (profil de l'équipe, sécurité de l'espace des mariés), et
   oubli d'un compte de marié (RGPD-03 ; suppression en cascade). Se déconnecter n'oublie pas
   l'appareil : c'est le but.
6. Les appareils échus d'un compte sont effacés à sa connexion suivante. La migration 0076 (table
   et droits du rôle applicatif) s'annule par son script (ADR 0036).

## Conséquences

- Moins de codes à saisir pour la planner au quotidien, sur ses propres appareils. Le second
  facteur reste exigé sur tout nouvel appareil, et tous les 90 jours.
- **Un cookie d'appareil volé** permet de passer l'étape du code pendant sa durée de validité,
  mais seulement avec le mot de passe du compte. La personne le révoque avec « Oublier tous mes
  appareils » ou en changeant son mot de passe.
- Une seule durée pour toute la suite (90 jours), dans le code comme les autres règles de
  session (PRD-HUB-01). En faire un réglage par organisation se fera si un client le demande.
- Les appareils ne sont ni nommés ni listés un par un : on n'enregistre pas le type de
  navigateur, pour ne garder aucune donnée de plus. Le profil en affiche seulement le nombre.
