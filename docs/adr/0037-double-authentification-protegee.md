# ADR 0037 — Double authentification protégée : limite d'essais, anti-rejeu, secret chiffré

- Statut : **remplacé** au lot 33 par [0052](0052-identite-fournisseur-open-source.md) et
  [0067](0067-fournisseur-d-identite-logto.md) : la double authentification est tenue par Logto,
  les secrets et la commande `mfa-secrets` ont disparu de Symbola (migration 0130)
- Date : 2026-11-08
- Complète : [0013](0013-auth-maison-pour-le-mvp.md) (authentification maison),
  [0029](0029-assistance-admin-et-statistiques-d-usage.md) (réinitialisation par l'Admin),
  [0035](0035-traitements-de-fond-suivis-des-imports.md) (chiffrement AES-256-GCM),
  [0036](0036-migrations-annulables.md) (migrations annulables)
- Story : L16-SEC-01 (`docs/lots/lot-16-reprise-ux.md`), audit du 08/11/2026 (S1, S3, S4)

## Contexte

L'audit du 08/11/2026 (`docs/audits/2026-11-08-audit-complet.md`) a relevé trois faiblesses de
la double authentification :

1. **Pas de limite d'essais sur le code.** Une fois le mot de passe connu (réutilisé
   ailleurs, hameçonné), la page `/mfa` acceptait des essais sans fin. Un code à 6 chiffres
   avec une tolérance d'une période de chaque côté laisse 3 codes valides à chaque instant :
   quelques heures de force brute suffisaient. Le verrouillage après 5 essais (PRD-HUB-01) ne
   protégeait que le mot de passe.
2. **Secret stocké en clair** (`hub.users.totp_secret`). Une copie de la base, ou une
   sauvegarde mal rangée, livrait le second facteur de chaque compte.
3. **Même jeton de session avant et après le code.** La session passait à « vérifiée » sans
   changer de jeton.

Ces trois points comptent davantage dès que la solution est proposée à d'autres prestataires.

## Décision

1. **5 codes faux d'affilée verrouillent la validation 15 minutes**, comme le mot de passe
   (PRD-HUB-01). Le compteur est tenu **par compte**, pas par session : une nouvelle connexion
   par mot de passe ne le remet pas à zéro. Un code juste le remet à zéro. Pendant le
   verrouillage, même un code juste est refusé. Le verrouillage est journalisé avec
   l'identifiant du compte seulement, et le titulaire reçoit un e-mail traduit : à ce stade,
   son mot de passe est connu d'un tiers et il doit le changer. Le message à l'écran dit
   « bloqué 15 minutes », comme pour le mot de passe : l'attaquant connaît déjà le mot de
   passe, et le cacher n'apporterait rien, alors qu'une vraie utilisatrice ne comprendrait pas
   pourquoi son code juste est refusé.
2. **Un code ne sert qu'une fois.** Le pas de temps (période de 30 s) du dernier code accepté
   est enregistré (`totp_last_used_step`). Un code de ce pas ou d'un pas antérieur est
   refusé, et compte comme un échec. La consommation du code et le remplacement de la
   session se font dans une même transaction, sous condition : deux envois simultanés du
   même code ne passent pas tous les deux.
3. **Nouveau jeton de session à la validation.** L'ancien jeton est supprimé et un nouveau
   est émis, déjà vérifié. L'app remplace le cookie : écran `/mfa`, et activation par un
   marié dans son espace.
4. **Secret chiffré au repos.** AES-256-GCM de la bibliothèque standard de Node, comme les
   fiches PDF du lot 15 (aucune cryptographie maison, aucune dépendance).
   - Clé : la variable d'environnement `MFA_ENCRYPTION_KEY` (32 octets en base64,
     `openssl rand -base64 32`), une par environnement, **requise** : l'app refuse de démarrer
     sans elle (`packages/env`).
   - Le chiffré est rattaché au compte (données associées `symbola:totp:<id>`) : recopié sur
     un autre compte, il ne se déchiffre pas.
   - Format stocké : `v1:` + base64(iv | chiffré | étiquette). Le préfixe de version permet un
     changement de clé ou d'algorithme plus tard.
   - Les secrets enregistrés en clair avant le lot 16 se relisent tels quels, et sont chiffrés
     **au démarrage de l'app** (`sealLegacyTotpSecrets`, sans effet une fois fait) ou à la
     validation suivante.
5. **Retour arrière** : une image antérieure au lot 16 ne sait pas lire un secret chiffré.
   La commande `pnpm --filter @symbola/auth mfa-secrets -- --unseal` les remet en clair, à
   lancer **avant** de relancer l'ancienne image. La migration 0075 (trois colonnes) s'annule
   par son script (`drizzle-rollback/0075_lot16_mfa_protection.sql`, ADR 0036).
6. **La réinitialisation par l'Admin** (ADR 0029) efface aussi le compteur, le verrouillage et
   le dernier code accepté.

## Conséquences

- **La clé est un secret de plus**, que Julien ajoute dans `.env.staging` et
  `.env.production` **avant** de passer à l'image du lot 16, et garde dans son gestionnaire de
  mots de passe. Les sauvegardes restic ne contiennent que le chiffré.
  - **Clé perdue** : plus aucun secret ne se déchiffre. Chaque compte de l'équipe doit
    reconfigurer sa double authentification (réinitialisation par l'Admin, ADR 0029), et un
    marié doit la réactiver depuis son espace.
  - Ne jamais réutiliser la clé du staging en production.
- **Le développement local exige la clé** dans `.env` (le modèle `.env.example` la prévoit). En
  CI, chaque job en génère une à la volée : aucune valeur n'est commitée.
- **`confirmTotp` change de contrat** : elle renvoie `confirmed` (avec le nouveau jeton),
  `invalid` ou `locked`, et non plus un booléen. Ses appelants (écran `/mfa`, espace des
  mariés, tests) sont adaptés dans le même lot.
- **Limites restantes** (audit S2, story L16-SEC-02) :
  - aucune limitation de débit par adresse IP ;
  - le verrouillage par compte permet à quelqu'un qui connaît le mot de passe de bloquer la
    double authentification de la titulaire pendant 15 minutes. C'est voulu : l'e-mail
    l'invite à changer son mot de passe.
- Appareil de confiance (code redemandé tous les 90 jours plutôt qu'à chaque connexion) :
  ADR [0038](0038-appareil-de-confiance.md).
