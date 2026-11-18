# ADR 0093 — Prestataires (pièces, lieu, IBAN chiffré sous contrôle) et argent de la planner (honoraires, commissions, mandat)

- Statut : accepté (spécification du lot 48 validée par Julien le 18/11/2026, décisions D1 à D8
  dans leur option a)
- Date : 2026-11-18
- Complète : [0079](0079-socle-des-modules-rendez-vous-et-invites.md) (chiffrement au niveau du champ),
  [0027](0027-telechargements-servis-par-l-app.md) (fichiers servis par l'app), [0036](0036-migrations-annulables.md)
  (migrations annulables), [0075](0075-deploiement-en-une-commande.md) (migrations compatibles,
  arrêt de l'app), [0085](0085-prestataires-par-lien-et-choix-qui-engage.md) (prestataires par
  lien), [0089](0089-proposition-signer-puis-regler-par-virement.md) (« Régler l'acompte »),
  [0091](0091-jour-j-de-terrain-et-file-hors-ligne.md) (remises du jour J).
- Exigences : 48a — PRE-05, PRE-06, PRE-10, SEC-27, DAT-08 ; 48b — BUD-08, PRE-07, JUR-10, DOC-02,
  HUB-26. Scénarios SC-04, SC-05, SC-09 (en partie) ; `docs/lots/lot-48-prestataires-argent-mandat.md`.
  Points ouverts : AV-10, AV-11 (avocat), EC-8 (expert-comptable).

## Contexte

Le carnet de prestataires gardait des fichiers (plaquette, RIB) et des champs par type, mais rien
qui expire, rien qui relie un lieu au déroulé du jour, et aucun IBAN structuré : un RIB changé par un
message n'était ni tracé ni signalé, alors que c'est la première porte d'entrée des fraudes au
virement. L'IBAN de la planner (`quotes.quote_settings`) restait en clair. Côté argent, les
honoraires de la planner, ses commissions et son rôle (intermédiaire ou revendeur) n'existaient pas.

## Décision — 48a (prestataires)

1. **Deux PR** (D1) : 48a (modules `vendors`, `events`, `hub`, `quotes` pour le chiffrement) puis
   48b (modules `quotes` et `budget`). Les champs personnalisés (HUB-25) sortent du lot (D2).
2. **Pièces à échéance** (PRE-05, D3) : `vendors.vendor_document_kinds` (natures de l'organisation,
   posées une fois depuis `vendor-document-kinds.json`) et `vendors.vendor_documents` (nature,
   fichier privé contrôlé comme ceux de la fiche, dernier jour de validité, état). Trois états :
   « demandée » (sans fichier), « à vérifier » (déposée par le lien du prestataire, lot 47),
   « vérifiée » (déposée ou vérifiée par la planner). Alerte N jours avant la fin
   (`vendor_settings.document_alert_days`, 30 proposés depuis les données de départ), comptée en
   jours calendaires de Paris ; une pièce d'un prestataire retenu qui expire avant la date de
   l'évènement est signalée sur l'évènement (synthèse) et dans « Aujourd'hui ». Le lien d'un
   prestataire ne dépose que dans une pièce demandée à **son** prestataire, une seule fois.
3. **Contraintes du lieu** (PRE-06, D4) : les champs de lieu restent des champs par type ;
   `vendor_type_fields.rule_key` donne leur sens au contrôle (fin de la musique, baisse du volume,
   départ des invités, accès des prestataires, capacités…). Les règles (contrôle, séquences visées,
   fin de la nuit à 6 h, types « musique ») vivent dans `venue-rules.json`, les libellés dans
   `vendor-types.json`. Une organisation d'avant le lot reçoit une fois les champs à règle sur ses
   types « lieu », en reconnaissant ceux qu'elle a déjà (« Fin de soirée imposée »). Le contrôle
   (`lib/events/venue-checks.ts`, orchestration events → vendors) vise les séquences dont le temps
   fort est au lieu, ou celles du lieu de réception ; il est **signalé, jamais bloquant**, sur le
   programme et dans le mode Jour J, avec sa règle ; la capacité dépassée l'est sur la synthèse de
   l'évènement. Les plans dessinés restent au lot 60.
4. **IBAN des prestataires** (PRE-10, SEC-27, D5) : `vendors.iban_sealed` et `bic_sealed` chiffrés
   (field-box), `iban_masked` (« FR76 •••• •••• 1234 ») seule forme montrée, jamais prérempli en
   clair. Tout changement (planner ou lien du prestataire) écrit `vendors.vendor_bank_changes` dans
   la même transaction (ancien et nouvel IBAN masqués, auteur) et une ligne du journal d'audit
   (identifiants seulement). Tant qu'un changement n'est pas levé par « J'ai vérifié par
   téléphone » (horodaté, nominatif), un bandeau demande d'appeler au numéro déjà connu, l'IBAN est
   « à vérifier » sur l'échéancier du budget et les remises du jour J, « Aujourd'hui » le signale,
   et le RIB n'est **jamais** montré au client (lien caché et route refusée). Un lien de
   prestataire ne change que l'IBAN de sa fiche : la fiche vient du lien, jamais du formulaire.
5. **IBAN de la planner chiffré** (DAT-08, D5) : migration `0176` (colonnes chiffrées, marqueur
   « arrêt requis ») suivie d'une **étape de données** (`packages/db/scripts/data-steps.ts`) :
   une migration SQL ne sait pas chiffrer avec une clé que la base ignore. `migrate` lance l'étape
   « aller » de chaque migration appliquée (rejouable : elle ne traite que ce qui reste en clair) ;
   `rollback` lance l'étape « retour » (déchiffrement) dans la transaction de l'annulation, avant
   le script SQL, et la refuse sans la clé. Les colonnes en clair restent, vides, pour l'annulation
   et pour garder le nom des champs de l'export (`iban`, `bic` y sortent déchiffrés : contrat
   export/v1 inchangé). Le module des devis déchiffre à la lecture (l'écran « Régler l'acompte » du
   lot 43 reste juste) ; une valeur encore en clair se lit, puis se chiffre au prochain
   enregistrement. field-box est repris par son chemin depuis `packages/db/scripts` (`@symbola/auth`
   dépend de `@symbola/db`, pas l'inverse ; le fichier n'utilise que la bibliothèque de Node).
   Les copies figées des documents déjà émis gardent leur IBAN (DAT-04 : une pièce émise est
   immuable).
6. **Notes confidentielles** (DAT-08, D5) : une case « confidentielle » sur la note interne d'une
   fiche (`vendors.internal_note_sealed`), les notes d'un évènement (`events.notes_sealed`) et
   chaque note de contact (`hub.contact_notes.body_sealed`, `is_confidential`), chacune dans son
   schéma. Chiffrée, la note laisse son champ en clair vide : elle sort des recherches, des
   exports, de la fiche d'identité, et n'est lue, changée ou décochée que par la titulaire et son
   auteur (les rôles par évènement du lot 52 s'y brancheront). Le droit d'accès de la personne
   (export RGPD) la rend en clair ; l'export complet de l'organisation ne la contient pas, comme les
   régimes du lot 49 (et pas davantage l'IBAN chiffré d'un prestataire).
7. **Annulation** : 0173 à 0175 refusent tant qu'une pièce, un changement d'IBAN tracé, un IBAN ou
   une note chiffrés existent (rien ne se perd) ; 0176 remet l'IBAN de la planner en clair.

## Conséquences

- `DATA_ENCRYPTION_KEY` protège désormais aussi les IBAN et les notes confidentielles : perdue, ils
  sont perdus (runbook de déploiement, § clé du chiffrement). Le déploiement de 0176 arrête l'app le
  temps de la migration et demande la clé dans l'environnement de `migrate`.
- Le lot 53 (radar des risques) lit pièces expirées et IBAN « à vérifier » par le service `vendors`
  (`listVendorDocumentNotices`, `listPendingBankChecks`), sans toucher aux tables.
- Écart assumé : aucune alerte par e-mail ou notification des pièces et des IBAN dans ce lot ; ils
  vivent dans « Aujourd'hui » et sur les écrans (le lot 53 ajoute les notifications).
