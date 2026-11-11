# ADR 0052 — Identité : bascule vers un fournisseur d'identité open source

- Statut : accepté (décision Q3 b de Julien du 11/11/2026) ; le fournisseur est choisi au lot 33
  (décision D2 a du lot 25)
- Date : 2026-11-11
- Remplacera, à la bascule : [0013](0013-auth-maison-pour-le-mvp.md) (authentification maison),
  [0037](0037-double-authentification-protegee.md) (double authentification protégée) et
  [0038](0038-appareil-de-confiance.md) (appareil de confiance). Ils restent en vigueur jusque-là.
- Exigences : SEC-01, HUB-01, HUB-02, SEC-07, JUR-18, NFR-27 de `docs/CAHIER_DES_CHARGES.md`.

## Contexte

Symbola authentifie aujourd'hui lui-même : mots de passe hachés en argon2id dans `hub.users`, code
de double authentification (TOTP) et appareil de confiance, le tout derrière `packages/auth`
(ADR 0013). L'ADR 0013 notait déjà qu'un fournisseur d'identité était la cible (ADR 0004).

Le nouveau cahier des charges exige que Symbola ne stocke aucun mot de passe (SEC-01), une
connexion par lien magique, mot de passe ou clé d'accès (HUB-01), un lien magique à usage unique
valable quinze minutes (SEC-07) et plusieurs organisations par utilisateur (HUB-02). Julien a
choisi la bascule vers un fournisseur open source (Q3 b).

## Décision

1. **Symbola délègue l'authentification** à un fournisseur d'identité open source, hébergé sur
   le VPS, par OpenID Connect (flux « code » avec PKCE). Après la bascule, aucun schéma de l'app
   ne contient de mot de passe ni de secret de double authentification (critère de SEC-01).
2. **Critères de choix**, appliqués au lot 33 à au moins trois candidats :
   - licence : une brique à copyleft fort s'utilise sans modification, par son API, ou ses
     obligations sont assumées (JUR-18) ; elle entre dans l'inventaire des licences ;
   - connexion par lien magique (SEC-07), clé d'accès, mot de passe et double authentification ;
   - plusieurs organisations par utilisateur et rôles par organisation (HUB-02) ;
   - tient sur le VPS actuel, avec sa base dans le serveur PostgreSQL existant (base dédiée,
     comme Documenso) et sauvegardé par la sauvegarde nocturne (NFR-27, ADR 0051) ;
   - reprise des comptes existants (import des hachages argon2id, sinon nouveau mot de passe
     par lien) ;
   - pages et e-mails en français et en anglais, aux couleurs de Symbola ;
   - projet actif, avec des correctifs de sécurité réguliers.
3. **Le comparatif et le choix** sont écrits au lot 33, dans un ADR qui complète celui-ci.
4. **D'ici la bascule**, l'authentification maison reste en place, derrière `packages/auth`. Seul
   ce paquet changera à la bascule, avec la reprise des comptes. On n'y ajoute pas de nouveau
   moyen de connexion (lien magique, clé d'accès) : ils viendront avec le fournisseur. La
   vérification des mots de passe compromis (lot 24, Q22) s'applique à l'authentification
   maison tant qu'elle existe ; le même critère s'appliquera au fournisseur.
5. Le renommage du rôle d'exploitation (Q30) se fait avec la bascule (lot 33) ou au lot 52.

## Conséquences

- Plus de mot de passe ni de secret de double authentification chez Symbola ; les clés d'accès
  et le lien magique viennent d'un composant éprouvé.
- Un service de plus sur le VPS : mémoire, mises à jour, sauvegarde, supervision.
- La reprise des comptes et des sessions demande un lot à part entière (lot 33, sans doute deux).
- Jusqu'au lot 33, SEC-01 reste « Absent » dans `docs/gap.csv`.
