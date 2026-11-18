# ADR 0079 — Socle des modules Rendez-vous et Invités : modules fermés par défaut, chiffrement au niveau du champ, jeton de lien commun

- Statut : accepté (décision D0 des spécifications des lots 46 et 49, validées par Julien le
  18/11/2026)
- Date : 2026-11-18
- Complète : [0037](0037-double-authentification-protegee.md) (même construction de
  chiffrement, autre clé), [0053](0053-acces-des-tiers-par-lien-personnel.md) pour le jeton
  des liens personnels, [0062](0062-modules-autonomes-preuve-par-combinaisons.md) (combinaisons de
  modules).
- Exigences : DAT-08, RGP-05, SEC-14, ARC-02 de `docs/CAHIER_DES_CHARGES.md` ; spécifications
  `docs/lots/lot-46-rendez-vous.md` et `docs/lots/lot-49-invites-rsvp.md`, partie « Préalable
  commun (D0) ».

## Contexte

Les lots 46 (rendez-vous) et 49 (invités et RSVP) créent chacun un module, en parallèle. Ils ont
trois besoins communs. Si chacun les écrivait de son côté, on aurait deux versions ou des conflits
sur les mêmes lignes :

- **Registre des modules** : jusqu'ici, un module sans réglage de l'Admin est ouvert
  (`isModuleEnabled` répond oui sans ligne). Un nouveau module serait donc ouvert d'office chez
  toutes les organisations. RGP-05 demande des réglages protecteurs par défaut, et la DPO demande
  une analyse d'impact avant la première donnée réelle d'invité.
- **Chiffrement au niveau du champ** (DAT-08) : l'adresse secrète d'un agenda extérieur (lot 46),
  les régimes et allergies (lot 49), plus tard l'IBAN (lot 48).
- **Jeton des liens personnels** : il est écrit dans `modules/events/link-tokens.ts`. Les deux
  nouveaux modules en ont besoin sans franchir la frontière du module events (ARC-02).

## Décision

1. **État par défaut propre à chaque module** (`modules/hub/module-registry.ts`) : `events`,
   `budget`, `quotes` et `vendors` restent ouverts sans réglage, comme avant. `appointments` et
   `guests` sont fermés tant que l'Admin ne les ouvre pas pour l'organisation. Une clé inconnue
   est fermée, et l'action de l'Exploitation la refuse. Les tableaux de l'Exploitation
   (organisations, prise en main) suivent la même règle.
2. **Chiffrement au niveau du champ** (`packages/auth/src/field-box.ts`) :
   - même construction que les secrets de double authentification : AES-256-GCM de la
     bibliothèque standard de Node, sans dépendance ;
   - une **clé distincte**, `DATA_ENCRYPTION_KEY` (32 octets en base64), validée au démarrage par
     `packages/env`, sans valeur par défaut et différente de `MFA_ENCRYPTION_KEY` ;
   - les données associées rattachent chaque chiffré à sa place (organisation, `schéma.table`,
     colonne, ligne) : recopié ailleurs, il ne se déchiffre pas ;
   - format stocké : `f1:` + base64(iv | chiffré | étiquette) ;
   - une valeur non chiffrée est refusée, jamais relue telle quelle ;
   - les erreurs ne reprennent jamais la valeur.
3. **Jeton de lien commun** (`packages/auth/src/link-token.ts`) : `newLinkSecret`,
   `hashLinkSecret`, `formatLinkToken` et `parseLinkToken` y passent sans changement. Le module
   events les réexporte. Les règles d'expiration et de droits restent propres à chaque module.

## Conséquences

- **Avant le premier déploiement qui contient ce socle**, il faut ajouter `DATA_ENCRYPTION_KEY`
  dans `.env.staging` et `.env.production` (`docs/runbooks/deploiement.md`). Sinon l'app refuse de
  démarrer. La clé se garde dans le gestionnaire de mots de passe. La sauvegarde restic ne la
  contient pas : **perdue, les valeurs chiffrées sont perdues.**
- Changer de clé n'est pas prévu. Le préfixe `f1:` laisse la place à un `f2:` (nouvelle clé,
  rechiffrement au démarrage, comme le lot 16) le jour où il le faudra.
- Les combinaisons de modules de l'ADR 0062 restent jouées sur les quatre modules du pilote.
  Chaque nouveau lot ajoute son module à la preuve.
- Les chiffrés ne sont pas cherchables. Les modules qui en ont besoin gardent à part ce qui doit
  être compté, par exemple le nombre de régimes du lot 49, sans le nom.
- Pas de migration : `hub.organization_modules` accepte déjà toute clé.
