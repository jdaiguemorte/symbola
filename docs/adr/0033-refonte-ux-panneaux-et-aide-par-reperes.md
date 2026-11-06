# ADR 0033 — Refonte UX : panneaux latéraux, aide par repères, captures réelles

- Statut : accepté
- Date : 2026-11-06
- Précise : ADR 0030 (aide qui forme), ADR 0029 (Administration), lot 13

## Contexte

Recette du 06/11/2026 : l'application est difficile à prendre en main. Les écrans empilent des
sections qui se déplient vers le bas, les réglages sont dispersés sur douze écrans, l'aide est une
longue liste de définitions et les tutoriels peuvent être menés tous en même temps. Maquettes
validées par Julien, spécification : `docs/lots/lot-13-ux.md`.

## Décision

1. **Panneau latéral comme seul motif d'édition et de détail.** Un composant commun
   (`SidePanel`, dans `apps/symbola/app/ui/` : ces composants s'appuient sur le routeur de Next ; `packages/ui` reste indépendant du framework) remplace les formulaires dépliés dans la page. Son état vit
   dans l'adresse (`?panneau=…`), pour le lien partageable et le retour arrière.
2. **Barre de filtres et tableau de liste communs** (`FilterBar`, `ListTable`, même dossier),
   avec filtrage à la saisie et état dans l'adresse.
3. **Aide par repères.** Les visites focus (AIDE-05) et les textes d'aide en fenêtre (AIDE-01)
   sont remplacés par des repères numérotés posés sur les éléments réels, décrits par écran dans
   les fichiers de traduction. La progression existante (`hub.help_progress`) enregistre
   « repères vus » à la place de « visite faite » ; affichage d'office une seule fois par écran.
4. **Un seul tutoriel en cours** par compte : lancer un tutoriel en interrompt explicitement un
   autre (choix de la personne), jamais en silence.
5. **Captures réelles dans le centre d'aide**, produites par un script Playwright
   (`pnpm --filter @symbola/app help:captures`) sur une organisation fictive, en 1280 px,
   enregistrées dans `apps/symbola/public/aide/captures/` et versionnées. Elles sont régénérées
   à chaque lot qui modifie un écran (étape de la définition de « terminé » du lot). Pas de
   génération à chaque build : une capture qui change sans raison ne doit pas passer inaperçue
   dans une PR.
6. **Sauvegarde signalée à l'app.** `infra/backup/backup.sh` enregistre chaque exécution dans
   `hub.backup_runs` (début, fin, résultat, taille) par une requête SQL dans le conteneur
   PostgreSQL de l'environnement, avec le rôle d'administration déjà utilisé par le script
   (aucun nouveau secret, aucune route HTTP). Seul l'Admin lit cette table ; elle ne contient
   aucune donnée d'organisation.
7. **Délais de relance par organisation** (`hub.organization_profiles` : relance devis,
   relance prospect), valeurs de départ dans `packages/starter-templates`.

## Conséquences

- Les visites focus et leurs tests disparaissent ; les repères ont leurs propres tests e2e.
- Les écrans sont migrés étape par étape (sept PR) ; l'ancien et le nouveau motif cohabitent
  le temps du lot.
- Les captures ajoutent des images au dépôt (environ 30 PNG, quelques centaines de ko au
  total).
- Aucune nouvelle dépendance : glisser-déposer des listes en HTML natif avec alternative
  clavier.
