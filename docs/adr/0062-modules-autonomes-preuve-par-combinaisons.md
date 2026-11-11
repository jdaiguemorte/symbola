# ADR 0062 — Modules autonomes : preuve par les combinaisons de modules (écart ARC-01)

- Statut : accepté (spécification du lot 24 validée par Julien le 11/11/2026, décision D6)
- Date : 2026-11-11
- Complète : [0011](0011-monolithe-modulaire-pour-le-mvp.md) (une seule app à modules internes),
  [0012](0012-base-unique-schemas-logiques-pour-le-mvp.md) (un schéma par module).
- Exigences : ARC-01, ARC-07 de `docs/CAHIER_DES_CHARGES.md`.

## Contexte

ARC-01 demande que chaque app soit un module autonome, avec ce critère : « Retirer le dossier d'une
app laisse les autres compiler et passer leurs tests. » Le pilote est une seule app Next.js à
modules internes (ADR 0011). Les modules s'appellent par leur porte d'entrée, `service.ts`, comme le
veut ARC-02. Le 11/11/2026, les dépendances entre modules sont :

| Module | Appelle le `service.ts` de |
| --- | --- |
| budget | events |
| events | vendors |
| hub | events, quotes, vendors |
| quotes | events, hub |
| vendors | budget, events |

Retirer un dossier casse donc, par construction, la compilation de ceux qui l'appellent. Les écrans
(`app/`) importent aussi les services des modules qu'ils affichent.

## Décision

Pour le pilote, l'écart est accepté. Le critère « retirer le dossier » est remplacé par trois preuves,
toutes jouées en CI :

1. **Frontières** : un module n'importe d'un autre que son `service.ts`, jamais son `repository.ts`,
   ses tables ou ses composants (`pnpm check:boundaries`, ADR 0011).
2. **Dégradation propre** (ARC-07) : le parcours `e2e/arc-07-combinaisons-modules.spec.ts` joue les
   16 combinaisons des quatre modules souscrits. Pour chacune, l'accueil, le menu, la recherche et les
   écrans de chaque module répondent sans erreur ; le menu ne montre que les modules souscrits ; un
   écran ou un lien d'un module absent mène à « indisponible ».
3. **Données** : un schéma par module, sans clé étrangère entre schémas, et des migrations propres à
   chaque module (ADR 0012, [0036](0036-migrations-annulables.md)).

Option écartée : un job de CI qui retire chaque module et compile les autres avec des doublures de
ses services. Il prouverait que les doublures compilent, pas que l'app fonctionne sans le module ;
il faudrait tenir ces doublures à jour à chaque changement de contrat.

## Conséquences

- Une nouvelle dépendance entre modules passe par `service.ts` ou par un événement de
  `domain_events` (ARC-05). Pour un couplage nouveau, l'événement est préféré : il ne crée pas de
  dépendance de compilation.
- Le jour où un module est extrait (trajectoire de l'ADR 0011), son `service.ts` devient un contrat
  HTTP `/v1/...` décrit en OpenAPI, et ceux qui l'appellent passent par un client. ARC-01 devient
  alors vérifiable à la lettre, et cet ADR sera revu.
- Un module ajouté entre dans `MODULE_KEYS`, et donc dans les combinaisons jouées par ARC-07.
