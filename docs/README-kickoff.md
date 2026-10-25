# Kit de démarrage Symbola pour Claude Code

Ce dossier contient tout ce qu'il faut pour lancer le développement du MVP avec Claude Code.

| Fichier | Rôle |
| --- | --- |
| `CLAUDE.md` | Règles du dépôt, lues automatiquement par Claude Code à chaque session : principes, stack, structure, sécurité, tests, définition de « terminé », méthode |
| `docs/cahier-des-charges.md` | Cahier des charges complet (vision, architecture, sécurité, RGPD, toutes les apps) |
| `docs/PRD-MVP.md` | PRD du MVP : 36 stories avec critères d'acceptation |
| `docs/adr/` | 10 décisions d'architecture initiales |
| `docs/lots/lot-0-socle.md` | Spécification du lot 0 (socle technique), 12 stories techniques |
| `PROMPT-LOT-0.md` | Le premier message à coller dans Claude Code |

## Mise en route

1. Crée un dépôt Git privé vide (GitHub), par exemple `symbola`.
2. Copie le contenu de ce dossier à sa racine, sauf ce `README.md` (ou garde-le dans `docs/`), puis fais un premier commit sur `main`.
3. Ouvre Claude Code à la racine du dépôt.
4. Colle le contenu de `PROMPT-LOT-0.md`.
5. Laisse Claude Code résumer, poser ses questions et proposer son plan : valide avant qu'il code.

## À garder en tête

- Le cahier des charges et le PRD vivent dans le document partagé ; ces fichiers en sont une copie au 25 octobre 2026. Si tu modifies le document, réexporte-le ou demande à Claude Code de mettre `docs/` à jour.
- Un seul serveur : le VPS Contabo. Le staging y tourne à côté de la production, strictement isolé. Pas de serveur de secours ; les sauvegardes restent sur le VPS au démarrage (risque accepté).
- Toute action sur un serveur réel reste entre tes mains : Claude Code prépare, tu exécutes.
