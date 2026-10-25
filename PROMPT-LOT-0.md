# Prompt de démarrage — à coller dans Claude Code

Copie le bloc ci-dessous comme premier message dans Claude Code, ouvert à la racine du dépôt.

---

Tu démarres le projet Symbola.

1. Lis en entier `CLAUDE.md`, puis `docs/cahier-des-charges.md` (sections 1 à 3), `docs/PRD-MVP.md` (sections 1, 2, 9, 10 et 11), les ADR de `docs/adr/` et `docs/lots/lot-0-socle.md`.
2. Résume-moi en 10 lignes maximum ta compréhension du projet et du lot 0, puis liste les points ambigus ou contradictoires que tu as repérés. Attends ma réponse avant de coder.
3. Ensuite, propose un plan d'exécution du lot 0 : ordre des stories SOC, fichiers créés, dépendances installées (avec leur version stable actuelle), et ce que je devrai faire moi-même sur les serveurs. Attends ma validation.
4. Une fois le plan validé : crée la branche `lot-0-socle`, et avance story par story. Pour chacune : écris d'abord les tests tirés des critères d'acceptation, puis le code, puis lance lint, typecheck et tests. Fais un commit par story et résume-moi ce qui est fait et ce qui reste.

Règles : n'agis jamais sur un serveur réel, un DNS ou un secret ; prépare les fichiers et runbooks, je les exécute. Demande avant d'ajouter une dépendance hors de la stack de `CLAUDE.md`.

---

## Pour les lots suivants

Même schéma, en remplaçant le fichier de lot :

> Lis `CLAUDE.md`, puis `docs/PRD-MVP.md` section <n> et `docs/lots/lot-<n>-<nom>.md` s'il existe. Résume les stories du lot et leurs critères, signale les ambiguïtés, propose un plan, attends ma validation, puis avance story par story en écrivant les tests d'abord.
