# ADR 0008 — Données de démonstration isolées et éphémères

- Statut : accepté
- Date : 2026-10-25

## Contexte

Chaque module propose un essai guidé sur des données fictives, qui ne doivent polluer ni la comptabilité ni les statistiques.

## Décision

Colonne `is_demo` sur les entités concernées, série de numérotation `DEMO` distincte, filigrane « Document fictif », exclusion systématique des stats, exports, e-reporting et recherches RGPD, faux fournisseur de signature et d'e-mail. Purge à la fin de l'essai, et job de purge des essais abandonnés.

## Conséquences

Un test automatisé vérifie qu'aucune donnée de démo ne subsiste après un essai et qu'aucune requête de reporting ne les inclut.

## Mise en œuvre — module événements (lot 2, AIDE-02)

- `events.events.is_demo` et `demo_expires_at` (24 h après le début de
  l'essai) ; les lignes de l'événement (clients, postes, tâches, programme,
  accès, fil d'activité) le suivent et sont supprimées avec lui.
- L'événement fictif est construit depuis `packages/starter-templates`
  (`demo-event.json`, rétroplanning, programme et postes de départ), jamais
  depuis des constantes.
- Exclusions : recherche RGPD (`eventsPrivacy`), événements internes
  (`domain_events` : rien n'est publié pour un événement d'essai), liste
  « Premiers pas » du tableau de bord (`hasRealEvents`). Aucune invitation
  de marié depuis un essai (pas d'e-mail à un tiers). PDF en filigrane
  « Document fictif ».
- Purge : à la fin de l'essai (bouton de la fiche), et pour un essai
  abandonné, au retour sur la liste des événements et chaque heure côté
  serveur (`lib/demo-purge.ts`, lancé par `instrumentation.ts`).
- Le test `trial.integration.test.ts` vérifie qu'après l'essai aucune ligne
  de l'événement fictif ne subsiste dans les tables du module ni dans
  `domain_events`, et la purge à 24 h (veille et lendemain de l'échéance).
