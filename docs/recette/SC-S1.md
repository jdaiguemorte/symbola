# Rejeu SC-S1 — Accès croisé entre organisations, lot 24a

- Date : 11/11/2026, en local, par Claude Code : app compilée, base neuve `symbola_lot24`,
  jeu fictif chargé par `pnpm --filter @symbola/app seed:recette`.
- Scénario (cahier des charges, § 17) : connecté à l'organisation A, Rex remplace l'identifiant
  d'un évènement par celui d'un évènement de B, sur chaque route. Attendu : refus identique à
  « inexistant », tentative journalisée.

| Sens | Adresses rejouées | Objet de l'autre organisation | Objet inexistant | Journal |
| --- | --- | --- | --- | --- |
| Camille (ORG-01) sur les objets de Maison Belkacem (ORG-02) | `/events/[id]`, `/budget/[id]`, `/devis/[id]` | 404, « Page introuvable » | 404, « Page introuvable » : identique | 1 ligne par adresse au journal d'ORG-01 |
| | `/events/[id]/programme/pdf`, `/devis/[id]/pdf` | 404, corps vide | 404, corps vide : identique | 1 ligne par adresse au journal d'ORG-01 |
| Nadia (ORG-02) sur les objets de l'Atelier (ORG-01) | les mêmes cinq adresses | 404, identique | 404, identique | 1 ligne par adresse au journal d'ORG-02 |

- Le journal d'ORG-01, lu par Camille (Paramètres › Journal d'activité), montre cinq lignes
  « Accès refusé : objet introuvable », famille Droits, avec l'adresse demandée
  (`/events/[id]`…), sans rien de l'autre organisation.
- Une seule ligne par minute, par personne et par adresse : la demande d'un identifiant
  inexistant, juste après, n'en ajoute pas.
- Rejoué aussi par les tests automatisés : `sec-13-inexistant-interdit.spec.ts` (ordinateur et
  375 px, axe-core) et `lib/access-refusals.integration.test.ts`.

Résultat : **passé, sans blocage**.
