# ADR 0044 — Limitation de débit en base ; envois de fichiers par des routes dédiées

- Statut : accepté
- Date : 2026-11-08
- Précise : [0018](0018-caddy-remplace-traefik-proxy-partage.md) (proxy Caddy, qui reportait la
  limitation de débit) et [0037](0037-double-authentification-protegee.md) (double
  authentification protégée)
- Story : SEC-02 (lot 16, spécification `docs/lots/lot-16-reprise-ux.md`)

## Contexte

Audit du 08/11/2026 (`docs/audits/2026-11-08-audit-complet.md`, S2, S5 et S6).

- **S2** : aucune limitation de débit, ni dans l'app ni au proxy.
  - Exposés : la connexion, le mot de passe oublié (qui envoie des e-mails), la double
    authentification, la recherche instantanée et l'import.
  - Le verrouillage par compte freine une attaque ciblée, mais pas le bourrage d'identifiants
    sur de nombreux comptes.
- **S5** : toutes les actions serveur acceptaient 21 Mo, avant même le contrôle de session,
  parce que les devis joints (BUD-03) en ont besoin.
- **S6** : ni `Permissions-Policy` ni `Cross-Origin-Opener-Policy`.

## Décision

### Une table PostgreSQL à fenêtre glissante, pas un module de Caddy

- **Table `core.rate_limit_events`** (migration 0078, annulable) : une ligne par tentative
  acceptée (`bucket`, `key_hash`, `created_at`).
- **Service** : `packages/db/src/rate-limit.ts`. `consumeRateLimits` vérifie toutes les règles
  d'une tentative, puis la compte dans chacune.
  - Un verrou consultatif de transaction par clé empêche des requêtes simultanées de dépasser
    la limite.
  - Une tentative **refusée n'est pas comptée** : qui attend le délai annoncé repasse.
- **Pourquoi pas Caddy** : un module de limitation demande une image de Caddy recompilée et
  une configuration sur le VPS, que Claude ne touche pas. Il ne connaît pas non plus le compte
  visé (e-mail saisi, session). La table n'ajoute aucune dépendance et se teste en CI.
- **RGPD** : pas de RLS, la limite s'applique avant toute connexion. La clé (adresse IP,
  e-mail saisi, identifiant du compte) n'est gardée que sous forme d'empreinte SHA-256, un jour
  au plus (purge horaire, `lib/rate-limit.ts`). Elle est déclarée dans `privacy.registry.yaml`.

### Les limites

Elles sont définies dans `apps/symbola/lib/rate-limit.ts`. Ce sont des réglages techniques de
sécurité, pas des données métier.

| Action | Par adresse | Par compte |
| --- | --- | --- |
| Connexion | 20 / 15 min | 10 / 15 min (e-mail saisi) |
| Double authentification (connexion, espace du marié) | 20 / 15 min | 10 / 15 min |
| Mot de passe oublié | 5 / heure | 3 / heure (e-mail saisi) |
| Recherche instantanée | 300 / minute | 120 / minute |
| Envoi de fichier | 60 / 10 min | 30 / 10 min |

- Le verrouillage après 5 échecs (connexion, double authentification) reste en place.
- **Adresse du client** : la dernière de `X-Forwarded-For`, celle qu'a vue le proxy. Caddy
  remplace l'en-tête envoyé par le client (sans `trusted_proxies`), qui ne peut donc pas
  choisir son adresse.
- **Sans proxy devant l'app** (tests de bout en bout, poste local), il n'y a pas d'adresse :
  seule la limite par compte s'applique. Next.js pose alors l'adresse de la connexion dans
  `X-Forwarded-For` (il ne le fait que si l'en-tête manque) : une adresse de bouclage
  (`127.0.0.1`, `::1`), traitée comme « pas d'adresse ». En production, l'app n'est joignable
  que par Caddy, qui pose l'adresse du client.
- **Réponse** : le message traduit dit combien de minutes attendre (« Trop de tentatives.
  Réessayez dans 15 minutes. »).
  - Une route (recherche instantanée, envois de fichiers) répond **429** avec `Retry-After`.
  - Une action serveur (connexion, double authentification, mot de passe oublié) affiche le
    message dans son formulaire : Next.js ne permet pas de choisir le code HTTP d'une action
    serveur.

### Envois de fichiers par des routes dédiées ; actions serveur à 1 Mo

- La limite des actions serveur revient à celle de Next.js, **1 Mo**.
- Les quatre envois de fichiers passent par des routes `POST` :
  - `/budget/<id>/devis` : devis joint à une ligne de budget ;
  - `/events/<id>/consultes/<id>/devis` : devis d'un prestataire consulté ;
  - `/prestataires/<id>/fichiers` : plaquette ou RIB d'une fiche ;
  - `/import/envoi` : fichier ou fiches PDF d'un import.
- `lib/uploads/receive.ts` vérifie, **avant de lire le corps** :
  - la même origine que l'app, la règle des actions serveur ;
  - la session de l'équipe ;
  - la limite de débit ;
  - la taille annoncée.

  Le corps est ensuite lu en flux, et coupé dès qu'il dépasse 21 Mo, même sans taille
  annoncée.
- Le formulaire garde son usage grâce à `useUploadAction` (`app/ui/use-upload.ts`) : même
  état, même indicateur d'envoi en cours, mêmes messages. La route peut aussi renvoyer
  l'adresse de l'étape suivante (import).

### En-têtes

- `Permissions-Policy: camera=(), microphone=(), geolocation=()`. La carte cherche autour d'une
  adresse saisie, jamais de la position de l'appareil.
- `Cross-Origin-Opener-Policy: same-origin`.

## Conséquences

- Chaque tentative limitée coûte une transaction courte de plus. La recherche instantanée en
  compte une par frappe (après 200 ms d'attente).
- Un envoi de fichier demande JavaScript, comme le reste de l'app : sans lui, le formulaire
  ne part plus.
- **Vérification sur le staging (Julien)** : depuis un même navigateur, six demandes de lien
  « mot de passe oublié » en moins d'une heure, avec des adresses différentes. La sixième doit
  afficher « Trop de tentatives ». Si elle ne l'affiche pas, Caddy ne transmet pas
  `X-Forwarded-For` : seule la limite par compte joue, à corriger dans le Caddyfile.
- Si l'app tourne un jour dans plusieurs processus ou sur plusieurs serveurs, la table reste
  la référence commune : rien à changer.
- Migration 0078 à appliquer avant de déployer l'image ; son annulation est dans
  `docs/runbooks/restauration.md` § 4 bis.
