# Lot 75 — Trois réparations de la chaîne de contrôle

- Origine : relevé du 27/11/2026, pendant la réalisation des lots 70 à 74 (une dizaine de PR et de CI par heure).
- Périmètre : CI, outillage et un test. **Aucun écran, aucun schéma, aucune migration**, aucun parcours : pas de validation préalable requise.
- Exigences touchées : SEC-30 à SEC-36 (chaîne de contrôle), FAC-10 (ADR 0081), DB-01 (ADR 0036), NFR-24.

## 1. Mustang, téléchargé à chaque passage (job « Factur-X »)

**Défaut.** Le job télécharge Mustang depuis Maven Central à chaque exécution (`curl -fsSL`) ; Maven Central répond régulièrement « 429 Too Many Requests » : trois PR ont rougi ainsi en une soirée, sans que leur code soit en cause.

**Correction.**
- L'archive est gardée en cache (`actions/cache/restore` et `/save`, actions de GitHub, même épinglage par version majeure que les autres), clé = version + empreinte SHA-256.
- Le téléchargement n'a lieu qu'en l'absence du cache, avec six essais espacés (20 s, 40 s…).
- L'empreinte SHA-256 est vérifiée **à chaque passage**, cache compris, avant tout usage ; le cache n'est écrit qu'après cette vérification, donc jamais avec un fichier altéré.
- Le contrôle des factures qui suit est inchangé.
- Même fragilité relevée pour l'image veraPDF (`docker pull` anonyme, Docker Hub) : tirage explicite avec cinq essais espacés ; l'empreinte de l'image reste vérifiée par Docker. Les autres tirages du workflow (services Postgres et Mailpit, Garage, ClamAV, Logto) n'ont pas été touchés : hors de ce lot, aucun échec relevé.

**Vérification.** Le job tourne une première fois (cache absent : téléchargement puis écriture du cache), puis une seconde (cache lu : aucun téléchargement, empreinte contrôlée). Les deux passages sont cités dans la PR. Les clés de cache d'une PR sont lisibles depuis `main` ; une exécution sur `main` les remplit pour toutes les PR.

## 2. `apps/symbola/next-env.d.ts`, réécrit par Next et commité par mégarde

**Défaut.** Le fichier est suivi par Git ; le serveur de développement le réécrit en y ajoutant `/// <reference path="./.next/types/routes.d.ts" />`. Trois sessions l'ont commité, ce qui fait échouer le lint (`@typescript-eslint/triple-slash-reference`).

**Ce que recommande Next.** La documentation de Next (page TypeScript, « next-env.d.ts ») dit que ce fichier est généré, ne doit pas être modifié, et recommande de l'ajouter au `.gitignore`. Next 15.5.29 (version du dépôt) fournit `next typegen`, qui le régénère sans compiler.

**Choix : le sortir du suivi et l'ignorer.** Garder le fichier suivi exige que chaque développeur ne le commite jamais dans sa version réécrite, ce qui est précisément ce qui échoue ; l'exclure du seul lint laisserait les diffs parasites. Changements :
- `git rm --cached` et ligne dans `.gitignore` ;
- le script `typecheck` de l'app devient `next typegen && tsc --noEmit` (le fichier existe donc avant `tsc`, sur un clone neuf comme en CI) ;
- le lint ignore `next-env.d.ts` (ESLint le lirait sinon, ignoré par Git ou non) ;
- `next build` et `next dev` le régénèrent eux-mêmes ; aucune autre commande ne change (`CLAUDE.md` § 9, ligne « Vérification des types », mise à jour).

**Vérification.** Sur un arbre sans le fichier ni `.next` : `pnpm --filter @symbola/app typecheck` et `lint` passent, `pnpm build` passe et recrée le fichier, que `git status` ne montre pas.

## 3. Test d'annulation des migrations (`packages/db/src/rollback.integration.test.ts`)

**Défaut.** Les annulations de chaque lot sont des listes écrites à la main (`LOT_72A`, `LOT_73A`, `LOT_36` qui les assemble…) et un test comptait leur longueur ; chaque nouveau paquet à migrations cassait les tests du précédent.

**Correction.** L'ordre des annulations se lit dans le **journal de Drizzle** (`meta/_journal.json`) : `NEWEST_FIRST` est le journal à l'envers, et `LOT_36`, `LOT_33`, `LOT_26` sont recalculés (`newestFirstDownTo`) au lieu d'être assemblés. Un lot déclare seulement ses propres tags pour son test ; trois lignes en tête du fichier le disent. Le lot 34a, qui comptait les tags des lots 72a et 73a, annule désormais « tout ce qui est plus récent que 0224 ». Rien de ce que le test vérifie ne change (chaque migration s'annule, se réapplique, les données de contrôle reviennent).

**Vérification.** 85 tests passent avant et après. Preuve de l'absorption : une migration factice `0999` (journal, SQL et script d'annulation) ajoutée après la dernière, les 85 tests passent sans retouche ; elle a ensuite été retirée (aucune trace dans la PR).
