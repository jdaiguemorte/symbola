# Lot 0 — Socle

**Contrainte d'infrastructure : un seul serveur, le VPS Contabo.** Aucun autre serveur n'est utilisé (pas de serveur domestique, pas de machine de secours). Staging et production cohabitent sur ce VPS, strictement isolés.

Objectif : un dépôt, une CI de sécurité et une infrastructure qui rendent tous les lots suivants sûrs et rapides. **Architecture du MVP allégée par les ADR 0011-0014** (une seule app, une seule base à schémas, authentification maison, événements internes) — voir la note en tête de `CLAUDE.md`. À la fin du lot, un module témoin `hello` traverse toute la chaîne : connexion via l'authentification maison, lecture en base avec RLS, publication d'un événement interne (`domain_events`), déploiement en staging puis en production.

Le lot 0 ne contient aucune fonctionnalité métier.

## Environnements

| Environnement | Machine | Rôle |
| --- | --- | --- |
| Dev | Poste de Julien, Docker Compose | Développement, tests locaux, Mailpit pour les e-mails |
| Staging | **Le même VPS Contabo**, dans un projet Docker Compose séparé : bases, rôles PostgreSQL, organisation Zitadel, sous-domaines (`*.staging.symbola.fr`), secrets et réseaux Docker distincts de la production ; ressources limitées par conteneur pour ne jamais pénaliser la production | Recette, ZAP, tests de restauration ; données fictives uniquement |
| Production | VPS Contabo (24 Go RAM, 300 Go disque) | Usage réel |

Claude Code prépare les fichiers, scripts et runbooks. **Julien exécute lui-même** toute action sur un serveur réel (SSH, DNS, secrets, ouverture de ports).

## Stories techniques et critères d'acceptation

### SOC-01 — Dépôt et outillage

- Le monorepo suit la structure de `CLAUDE.md` (apps, packages, infra, docs).
- `pnpm install` puis `pnpm dev` démarre le socle local et l'app `hello` en une commande documentée.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` passent sur un dépôt neuf.
- Un contrôle de dépendances échoue si un module importe le `repository.ts` ou un composant interne d'un autre module (ADR 0011) — seul `service.ts` peut être importé.
- La section « Commandes » de `CLAUDE.md` est complétée.

### SOC-02 — Pipeline CI de sécurité

- À chaque pull request : lint, typecheck, tests, Semgrep, Gitleaks, OSV-Scanner, build des images et Trivy.
- **Étant donné** un secret factice ajouté dans un commit de test, **alors** Gitleaks fait échouer la CI.
- **Étant donné** une vulnérabilité critique connue dans une dépendance ou une image, **alors** la CI échoue.
- Renovate est configuré (mises à jour groupées, hebdomadaires).
- Après déploiement en staging, un scan OWASP ZAP « baseline » s'exécute ; une alerte haute bloque la promotion en production.

### SOC-03 — Socle local et conteneurs

- Un compose de dev lance : PostgreSQL, Zitadel, NATS JetStream, MinIO, ClamAV, Mailpit, Traefik.
- Chaque service a un healthcheck ; les conteneurs applicatifs tournent en utilisateur non-root, système de fichiers en lecture seule quand c'est possible.
- Les variables d'environnement sont validées par Zod au démarrage ; `.env.example` documente chaque variable sans valeur sensible.

### SOC-04 — Identité (authentification maison, ADR 0013)

- `packages/auth` implémente : hachage argon2id des mots de passe, création/validation de session opaque (`randomBytes(32)` base64url, cookie httpOnly `sameSite=lax` `secure` en production), rôles `owner`, `member`, `client`, `admin`.
- **Étant donné** un utilisateur au rôle professionnel sans MFA, **quand** il se connecte, **alors** la configuration d'un TOTP lui est imposée avant d'accéder au hub.
- **Quand** l'utilisateur est connecté, **alors** il navigue entre les modules (hub, `hello`) sans se reconnecter (un seul process, une seule session).
- `packages/auth` expose un helper serveur qui renvoie l'utilisateur, son organisation et ses rôles, ou refuse — c'est la seule porte d'entrée vers l'authentification (aucun autre code n'appelle directement la lib sous-jacente), pour que la bascule vers Zitadel (ADR 0004, si justifiée plus tard) ne touche que ce package.

### SOC-05 — Base de données et RLS (base unique, schémas logiques — ADR 0012)

- `packages/db` fournit : création de la base et du rôle applicatif (un seul au MVP), création d'un schéma par module, helper de transaction fixant `app.organization_id`, modèle de policy RLS.
- Le rôle applicatif n'est pas propriétaire des tables et n'a pas `BYPASSRLS` (test qui le vérifie).
- `packages/testing` fournit un helper de test d'isolation réutilisable : **étant donné** deux organisations A et B avec des données, **quand** A lit, liste ou modifie, **alors** aucune donnée de B n'est visible ou modifiable.
- Le module `hello` a une table protégée dans son propre schéma et passe ce test.
- **Étant donné** du code d'un module qui exécute une requête SQL directe sur le schéma d'un autre module, **alors** une revue de code (ou un contrôle statique) le signale : seul `service.ts` du module propriétaire peut être appelé.

### SOC-06 — Contrats et événements internes (ADR 0011, 0014)

- `packages/contracts` contient : l'interface TypeScript du `service.ts` de `hello` (pensée comme le futur `/v1` OpenAPI), un schéma d'événement `hello.greeting.created`, les types partagés.
- **Étant donné** une modification incompatible d'une interface `service.ts` ou d'un schéma d'événement, **alors** un test de contrat échoue.
- `packages/db` fournit la table `domain_events` (motif outbox) et un worker qui la consomme de façon idempotente.
- `hello` publie l'événement via `domain_events` ; un consommateur de test le reçoit une seule fois même en cas de rejeu (idempotence).

### SOC-07 — Registre de données personnelles

- Format `privacy.registry.yaml` défini et documenté (champ, catégorie, règle de conservation, règle d'anonymisation).
- **Étant donné** une migration qui ajoute une colonne marquée personnelle ou nommée `email`, `phone`, `first_name`, `last_name`, `address`… sans déclaration, **alors** la CI échoue.
- Le contrat `privacy/v1` (find, export, anonymize, erase) est défini dans `packages/privacy` ; `hello` l'implémente sur sa table de test.

### SOC-08 — Fichiers

- Envoi d'un fichier via `hello` : vérification du type par le contenu, taille maximale paramétrable, analyse ClamAV, stockage MinIO privé, téléchargement par lien signé à durée limitée.
- **Étant donné** le fichier de test EICAR, **alors** l'envoi est refusé.

### SOC-09 — Déploiement (une seule app, ADR 0011)

- Compose de staging et de production : socle + l'app `symbola` (qui contient le module `hello`), derrière Traefik avec HTTPS automatique sur un seul sous-domaine.
- Revenir à la version précédente de l'app se fait en une commande documentée (tag d'image).
- En-têtes de sécurité vérifiés par un test automatisé (CSP, HSTS, X-Frame-Options, Referrer-Policy).
- Runbook `docs/runbooks/deploiement.md` : premier déploiement, mise à jour, retour arrière. Le runbook note la trajectoire : si un module est extrait en app autonome plus tard (ADR 0011), il reçoit son propre compose et son propre sous-domaine à ce moment.

### SOC-10 — Sauvegardes

- restic sauvegarde chaque nuit la base PostgreSQL (dump) et Garage (ADR 0015) de chaque environnement, plus les données d'Uptime Kuma, chiffré, dans un dossier dédié du VPS, séparé des données. Pas de copie externe ni de serveur de secours au démarrage : risque accepté et documenté dans le runbook ; une copie externe sera ajoutée avant l'ouverture à d'autres clients.
- Runbook `docs/runbooks/restauration.md` ; une restauration complète est réalisée et chronométrée sur le staging.

### SOC-11 — Surveillance

- Uptime Kuma surveille chaque app et le socle, alerte par e-mail.
- Page de santé : chaque app expose `/health` (état + version).

### SOC-12 — Durcissement serveur (runbook exécuté par Julien)

- Runbook `docs/runbooks/durcissement-serveur.md` pour le VPS : connexion SSH par clé uniquement, root désactivé, pare-feu limité à 80/443 (+ SSH restreint), CrowdSec, mises à jour de sécurité automatiques, Docker à jour.
- Une checklist de vérification après exécution.

### SOC-13 — Compteurs d'usage (préparation future empreinte carbone, ADR 0017)

- Table `usage_counters` (`packages/db`) : organisation, date, requêtes comptées, octets de réponse cumulés.
- Middleware Next.js (ou équivalent au niveau du routeur) qui incrémente ces compteurs à chaque requête authentifiée, sans ralentir la requête de façon perceptible (écriture asynchrone ou batchée).
- Pas de calcul carbone ici, seulement la collecte brute — le module `carbon` qui l'exploitera est V2 (CARB-02 à CARB-04).
- Test : une requête du module `hello` incrémente bien le compteur de la bonne organisation.

## Fin du lot 0

- Toutes les stories SOC passent.
- `hello` tourne en production : connexion MFA, donnée lue sous RLS, événement publié, fichier envoyé et téléchargé.
- Une restauration a été testée.
- Pull request relue par Julien, puis fusion.
