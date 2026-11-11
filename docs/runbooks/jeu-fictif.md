# Runbook — Charger le jeu fictif de recette

Lot 24a (DAT-10, décision D7, décision C4). Le jeu fictif (`docs/recette/symbola-synthetic-users.json`)
sert aux rejeux des scénarios du cahier des charges (§ 17) : Claude Code les rejoue en local à chaque
lot, Julien sur le staging aux portes 1 et 2.

## Ce que la commande crée

Par les services des modules, comme le ferait l'app (RLS, journal et règles métier compris) :

- **[Recette] Atelier Camille R.** (`7ec37e00-0000-4000-8000-000000000001`) : la titulaire, le
  catalogue de six prestations, quatre événements dont le mariage de référence EV-REF-01 (clients,
  comptes des mariés, prestataires au carnet, 42 tâches, devis et échéancier, budget confirmé).
- **[Recette] Maison Belkacem Évènements** (`7ec37e00-0000-4000-8000-000000000002`) : la titulaire,
  cinq collaborateurs, le séminaire EV-REF-02 (devis envoyé), 39 autres événements et 25 prospects.

Pas encore créés, faute d'écran : invités et tables, accès payeur, comptable en lecture, liens
personnels des tiers. Ils rejoindront le jeu avec les lots qui les apportent.

## Commande

Socle de dev démarré, base migrée (voir `CLAUDE.md` § 9), puis :

```bash
pnpm --filter @symbola/app seed:recette
```

- Les comptes (e-mails en `@exemple.test`, mots de passe générés) sont écrits dans
  `symbola-recette-comptes.txt`, dans le dossier temporaire du système. `-- --comptes <fichier>`
  choisit un autre fichier, toujours **hors du dépôt**. Le fichier est lisible par son seul
  propriétaire ; rien de personnel n'est affiché.
- Par Docker (poste de Julien) : voir la ligne de `CLAUDE.md` § 9 ; les comptes arrivent dans
  `~/symbola-recette/comptes.txt`.
- À la première connexion, un compte de l'équipe configure sa double authentification.
- Les e-mails d'invitation des mariés partent vers Mailpit en dev.

## Refus

- **En production** (`NODE_ENV=production`) : la commande refuse toujours. Le staging tourne aussi
  avec `NODE_ENV=production` ; y charger le jeu demandera un réglage explicite, à décider au
  déploiement d'ensemble (liste des gestes du rapport d'écart).
- **Jeu déjà chargé** : les identifiants des deux organisations sont fixes. Pour repartir de zéro,
  recréer la base de dev (jamais celle d'un autre environnement), puis relancer la commande.
