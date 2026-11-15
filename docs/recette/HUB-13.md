# Rejeu HUB-13 — export complet de l'atelier de Camille (ORG-01)

Aucun scénario du cahier des charges (§ 17) ne joue l'export complet : le rejeu exporte l'atelier
de Camille (SU-01, ORG-01), chargé du jeu fictif, comme prévu par la spécification du lot 35
(`docs/lots/lot-35-export.md`, Tests).

## Lot 35a — exporter toutes les données de l'atelier

- Date : 15/11/2026, en local, par Claude Code.
- Environnement :
  - app compilée (`next start`) ;
  - base neuve `symbola_lot24`, jeu fictif chargé par `pnpm --filter @symbola/app seed:recette`
    (comptes dans le fichier local de recette, hors du dépôt) ;
  - Logto, Mailpit et Garage du socle de dev.
- Méthode : Chromium piloté par un parcours Playwright temporaire, hors du dépôt. Camille se
  connecte sur ordinateur (1 280 px), et chaque écran est repris à 375 px.
- Limite du jeu fictif : il ne porte aucun document pour ORG-01, donc l'archive ne contient aucun
  fichier. Les fichiers sont vérifiés ailleurs :
  - par le test d'intégration (`lib/export/organization-export.integration.test.ts`) : document
    rangé, empreinte juste, pièce absente signalée ;
  - par le parcours e2e `hub-13-export-complet`.

| Étape | Ce que fait la personne | Résultat |
| --- | --- | --- |
| 1 | Camille ouvre Paramètres, « Exporter mes données » | L'écran dit ce que contient l'export, son format et ce qui n'est pas exporté. axe-core : aucune violation ; 375 px : aucun débordement |
| 2 | « Préparer l'export » | « Export demandé. Nous vous prévenons par e-mail dès qu'il est prêt. » L'export apparaît « En attente », avec « Rassemblement des données… » |
| 3 | Elle attend, sans recharger la page | « Prêt » au bout de 4 s : « 327 lignes, 0 fichier, 150 Ko · Téléchargeable jusqu'au 22 novembre 2026 à 10:35 ». axe-core : aucune violation ; 375 px : aucun débordement |
| 4 | « Télécharger l'archive » | `symbola-export-2026-11-15.zip`, 150 Ko. Le manifeste suit le format v1 : 83 entités, 327 lignes ; 250 empreintes SHA-256 vérifiées |
| 4 | Contenu, entité par entité | Équipe 1, événements 4, clients 5, tâches 42, prestataires consultés 12, moments du programme 24, lignes de budget 24, devis 1, fiches du carnet 12, journal d'activité 6 |
| 5 | Isolation | Aucune trace de l'autre organisation du jeu fictif (ni son identifiant, ni son nom) |
| 6 | `LISEZMOI.txt` | Organisation, date de préparation (UTC), contenu, exclusions et conventions, en français puis en anglais |

Résultat : **passe sans blocage.**
