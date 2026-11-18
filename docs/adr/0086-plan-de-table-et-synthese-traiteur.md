# ADR 0086 — Plan de table par temps fort et synthèse pour le traiteur calculée à la demande

- Statut : accepté (spécification du lot 50 validée par Julien le 18/11/2026, décisions D0 à D9
  dans leur option a)
- Date : 2026-11-18
- Complète : [0083](0083-module-invites-donnees-sensibles-et-purge.md) (module Invités, régimes
  avec accord et chiffrés, purge), [0079](0079-socle-des-modules-rendez-vous-et-invites.md) (module
  fermé par défaut, chiffrement au niveau du champ), [0019](0019-generation-pdf-react-pdf.md) (PDF côté
  serveur), [0012](0012-base-unique-schemas-logiques-pour-le-mvp.md) (un schéma par module).
- Exigences : INV-05, INV-06 ; parcours PAR-07 (étapes 5 et 6), scénario SC-07 (étape 6) ;
  `docs/lots/lot-50-plan-de-table.md`. Points ouverts DPO-7 et DPO-8 (fiche de la DPO,
  question 15).

## Contexte

Le lot 49 a livré la liste des invités, leurs réponses par temps fort et leurs régimes. Le plan de
table et la note au traiteur se font encore sur papier ou dans un tableur recopié, qui emporte les
régimes (données de santé) hors de tout contrôle. Le lot 50 ferme PAR-07 : composer le plan, sortir
la synthèse « sans retouche ».

## Décision

1. **Un plan par temps fort à table** (D1) : `guests.seating_plans`, unique par temps fort. Copie
   d'un plan vers un autre temps fort : les tables, et les places de ceux qui se placent aussi au
   temps fort d'arrivée ; jamais par-dessus un plan commencé.
2. **Tables en cartes, sans plan de salle** (D2) : nom, forme (ronde, rectangulaire, d'honneur),
   capacité ; ajout en série (« 12 tables rondes de 10 ») ; la forme propose la capacité
   (`seating-rules.json`), donne le libellé et l'ordre au PDF. Aucune position dessinée.
3. **Qui se place** : les présents au temps fort, et ceux qui n'ont pas répondu (marqués « en
   attente », jamais dans les couverts) ; ceux qui ont décliné n'apparaissent pas. **Une place par
   invité et par plan**, à une table du même plan : contrainte unique et référence composée
   `(table_id, plan_id)` en base. Un **désistement** (page de réponse ou réponse notée) libère la
   place dans la même transaction ; la place garde la date et le nom de la table pour prévenir la
   planner, qui efface l'alerte.
4. **Placement** (D0, D3) : le composant commun des lots 44 et 50 (`app/ui/move-to-group.tsx`),
   sans dépendance : « Déplacer » et la liste des tables au clavier et au doigt, glisser-déposer à
   la souris, annonce, focus qui suit l'invité (ou, à 375 px, le titre du panneau affiché).
   « Non placés » est une destination comme une autre ; un foyer se place d'un geste. Les non
   placés restent visibles : colonne fixe sur ordinateur, onglet avec leur nombre à 375 px.
5. **Contraintes signalées, jamais bloquantes** (D4) : « ensemble » et « séparés » entre deux à
   vingt invités, et capacité dépassée, signalées sur la table et dans la liste des alertes. Les
   contraintes sont **internes** : ni au client, ni dans la synthèse, ni dans l'export complet de
   l'organisation (exclusion déclarée). Une contrainte réduite à moins de deux personnes disparaît.
6. **Types de repas** (D5) : liste de l'organisation copiée de `meal-types.json` (adulte, enfant,
   bébé sans repas, prestataire), renommée, masquée, complétée ; valeur par défaut tirée de l'âge
   (0-2 ans : bébé), modifiable par invité. Repas des prestataires : un nombre par temps fort.
7. **Synthèse calculée à la demande, jamais rangée** (D6 à D8) : totaux (couverts des présents,
   repas par type, régimes et allergènes), puis chaque table et les présents sans table ; repas des
   prestataires et « en attente » à part ; date d'arrêt. **Nominative pour la titulaire seule** ;
   un membre reçoit la version sans nom, **exacte par table** (pas de « moins de 3 » : un traiteur
   ne sert pas « moins de 3 » assiettes), même s'il demande la nominative. Contrôle côté serveur.
   PDF A4 noir et blanc (`@react-pdf/renderer`, langue de l'organisation) ou CSV (marque d'ordre
   des octets, « ; », cellules `=` `+` `-` `@` neutralisées). Le fichier part vers le navigateur ;
   chaque téléchargement est tracé (`guests.caterer_summary_downloads` et le journal d'audit :
   qui, quand, temps fort, version, format), jamais son contenu. Sans plan, les totaux seulement.
8. **Purge et RGPD** : plans, tables, places, contraintes, repas des prestataires et traces de
   téléchargement suivent la purge des invités (J+30) ; à J+7, la synthèse ne contient plus aucun
   régime (rien à poursuivre : aucune copie dans Symbola). L'effacement d'une personne retire sa
   place et ses contraintes ; la recherche RGPD montre sa table par temps fort, pas ses contraintes.
9. **Le client ne compose pas** (D9) : ni plan ni synthèse par son lien.

## Conséquences

- Une migration `guests` seulement (0159), annulable tant qu'aucun plan ni type choisi n'existe.
- La copie envoyée au traiteur sort de Symbola : l'écran le rappelle ; la mention de pied du PDF
  nominatif (« à supprimer après l'évènement ») attend l'avis de la DPO (DPO-7).
- Les contraintes « séparés » gardent la durée des invités (30 jours) tant que la DPO ne demande
  pas plus court (DPO-8).
- Le libellé visible du bouton commun reste « Déplacer » (pas « Placer à… ») : un libellé
  paramétrable serait un ajout au composant du socle, à décider avec le lot 44.
- Hors périmètre : plan de salle dessiné et aide au placement (INV-11), plan composé par le client,
  synthèse par le lien du traiteur, export `.xlsx`.
