# ADR 0097 — Clôture d'un évènement, évaluation des prestataires, modèle d'évènement et exports comptables

- Statut : accepté (spécification du lot 58 validée par Julien le 19/11/2026, décisions D1 à D5 dans
  leur option a ; changements des schémas `events`, `vendors` et `quotes` accordés le même jour)
- Date : 2026-11-19
- Complète : [0011](0011-monolithe-modulaire-pour-le-mvp.md) et [0012](0012-base-unique-schemas-logiques-pour-le-mvp.md)
  (un module, un schéma), [0055](0055-statuts-d-evenement-et-retroplanning-a-la-creation.md) (statuts, « Clôturé »),
  [0061](0061-pieces-inalterables.md) (pièces, originaux, chaîne), [0068](0068-export-complet-contrat-export-v1.md)
  (export de l'organisation), [0093](0093-prestataires-pieces-iban-et-argent-de-la-planner.md)
  (honoraires, commissions), [0094](0094-equipe-et-acces.md) (rôle Comptable).
- Exigences : PAR-09, EVT-08, PRE-08, FAC-11 ; scénario SC-09 ; `docs/lots/lot-58-cloture-et-exports-comptables.md`.
  Expert-comptable : EC-9.

## Contexte

Un évènement passé restait « Confirmé » jusqu'à ce que la planner le clôture à la main ; rien ne
rassemblait ce qui restait à faire, ni ce que l'évènement avait rapporté. Rien ne permettait de le
dupliquer ou d'en garder un modèle. Les prestataires n'avaient qu'une note générale sur leur fiche. Le
comptable lisait les pièces une à une ; aucun journal ni FEC n'existait.

## Décision

1. **Liste de clôture** (PAR-09) : à J+1 dans le fuseau de l'évènement (`closingDue`, lot 34a), « À
   clôturer » apparaît dans « Aujourd'hui » et sur la fiche. La liste lit chaque module par son
   `service.ts` (orchestration `lib/closing`) : soldes à facturer, échéances des prestataires,
   commissions à facturer, évaluations, temps passé, trois leçons, demande d'avis. Un module non
   souscrit rend son étape « indisponible » (ARC-07). Une étape se coche à la main (« fait ailleurs ») ;
   le temps passé n'est jamais « à faire ».
2. **Demande d'avis** (Julien, 18/11, option a) : le texte de départ (données, FR et EN) est rempli
   avec les prénoms, l'organisation et le lien d'avis réglé par la planner (`events.closing_settings`,
   `https://` seulement) ; il se relit et se modifie, puis part de Symbola à chaque client qui a une
   adresse. Une variable restée entre accolades arrête l'envoi. **Aucune nature d'e-mail nouvelle** :
   l'envoi réemploie la nature `prospect_reply` (« texte relu par la planner », lot 45), qui porte le
   texte final ; la contrainte des natures du hub reste inchangée (pas de migration `hub`).
3. **Bilan** (D4) : budget final du client (cinq montants) figé à la clôture dans
   `events.event_closings.budget_snapshot` ; marge = honoraires (termes du lot 48b appliqués au budget)
   + commissions (toutes, quel que soit leur statut) − frais propres de la planner (libellé libre et
   montant HT, hors du budget du client). Le temps passé, déclaratif, donne la marge par heure ; sans
   temps saisi, le tableau de bord (`/events/bilans`) n'est lié de nulle part, sans rappel.
4. **Archivage** : un évènement clôturé ou annulé s'archive (`events.archived_at`) ; il sort des listes
   courantes (évènements, Aujourd'hui, radar) et se retrouve sous « Archivés » et dans la recherche. La
   **lecture seule est applicative** : les gestes de la planner sur l'évènement (statut, date, fiche,
   tâches ajoutées, programme, lieux, postes, prestataires, documents, liens, décisions, clôture,
   évaluations) passent par `assertEventWritable`, et les écrans n'offrent plus de formulaire. Un
   déclencheur en base a été écarté : il aurait bloqué l'anonymisation RGPD (qui remplace des valeurs),
   la fusion de contacts et la corbeille, qui doivent suivre leur calendrier (spécification : « les purges
   prévues suivent leur calendrier »). Un évènement se désarchive depuis sa clôture.
5. **Évaluation des prestataires** (PRE-08) : `vendors.vendor_evaluations`, une par prestataire retenu et
   par évènement (note 1 à 5, trois critères facultatifs, commentaire). Toujours interne : aucune route de
   lien (portail, espace prestataire, jour J), aucun écran du Comptable, aucun export vers un tiers ne la
   lit (test statique `lib/closing/internal-only.test.ts`). L'export complet de l'organisation (lot 35a)
   l'emporte : c'est la réversibilité de ses propres données, pas un tiers. L'historique sur la fiche
   reprend la note générale du lot 28c.
6. **Modèle et duplication** (EVT-08, D5) : `events.event_templates` garde un instantané de structures
   (tâches et écart au jour J, programme, postes et libellés des lignes du budget sans montant,
   questionnaires, prestataires si la case est cochée). Le contrôle refuse un e-mail, un téléphone ou un
   nom de client de l'évènement source dans un texte copié et dit où il se trouve. La duplication crée un
   évènement en Option, sans client, invité, devis ni facture, aux dates recalculées ; un questionnaire
   du modèle devient une tâche « Envoyer le questionnaire » (il ne peut pas partir sans client).
7. **Exports comptables** (FAC-11, D1 à D3) : la famille se déduit de la forme juridique
   (`accounting-exports.json` : micro-entreprise → journal des recettes ; autres formes → journaux des
   ventes et des encaissements, FEC) et se choisit à chaque export. Partie double : 411/706/44571 pour
   les ventes, 512/411 pour les encaissements ; plan et journaux de départ en données, réglables par la
   planner (`quotes.accounting_export_settings`), à relire par l'expert-comptable (EC-9). Le FEC ne se
   produit que sur une année ou un exercice. Le **contrôle bloquant** compare les totaux de l'export aux
   sommes SQL indépendantes (facturé, avoirs, encaissé, au centime), vérifie l'équilibre de chaque pièce
   et la continuité de la numérotation par série et par année (factures et avoirs) entre la dernière
   pièce d'avant la période et la première d'après (ou le dernier rang attribué) ; un écart bloque
   (409, rien n'est servi) et se nomme (« F-2027-0042 absente de la numérotation »). Les pièces d'essai
   n'y sont jamais (DAT-10). Chaque demande, servie ou bloquée, est tracée (`quotes.accounting_exports`,
   en ajout seul) et va au journal d'audit, sans donnée personnelle. Le Comptable télécharge depuis
   `/comptable` (lecture seule ; le plan de comptes lui reste fermé).

## Conséquences

- Trois migrations, une par schéma : 0188 (events), 0189 (vendors), 0190 (quotes), annulables, refusées
  tant que des données en dépendent.
- Les champs libres (leçons, libellés des frais propres, commentaire d'une évaluation) sont au registre
  RGPD ; l'oubli d'un client efface les leçons et anonymise les libellés de frais, l'oubli d'un
  prestataire efface les commentaires de ses évaluations.
- À revoir après la réponse EC-9 : compte 4191 pour les acomptes, comptes auxiliaires, encodage du FEC,
  compte des arrhes.
