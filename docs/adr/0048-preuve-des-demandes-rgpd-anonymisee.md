# ADR 0048 — Preuve d'une demande RGPD close : nom anonymisé par la purge mensuelle

- Statut : accepté
- Date : 2026-11-09
- Précise : [0024](0024-rgpd-purge-mensuelle-et-fin-de-conservation-des-factures.md) (purge
  mensuelle, RGPD-05) et [0047](0047-dossier-rgpd-et-documents-dans-l-accompagnement.md)
  (dossier d'une demande, « Manque connu » des Conséquences)
- Décisions de Julien du 09/11/2026 : durée de 5 ans après la clôture ; anonymisation par une
  ligne de la purge mensuelle validée à la main.

## Contexte

Une demande d'exercice de droits close garde le nom ou la description de la personne
(`hub.privacy_requests.person_label`) comme preuve de son traitement, pendant la prescription
applicable (cahier des charges § 6, référentiel CNIL). Le registre de données prévoyait de le
remplacer par « [anonymisé] » à la fin de cette conservation, et d'effacer le motif de
prolongation (`extension_reason`). Rien ne le faisait : le nom restait indéfiniment (ADR 0047,
« Manque connu »).

Le cahier des charges ne fixe pas la durée de la preuve (« pendant la prescription »).

## Décision

- **Durée** : réglage par organisation, `hub.privacy_settings.request_proof_retention_months`,
  onglet Réglages de Données personnelles. Valeur de départ : **60 mois** (5 ans, prescription
  civile de droit commun), dans `packages/starter-templates/src/privacy-settings.json`
  (CLAUDE.md § 2.5), à faire valider par un juriste avant l'ouverture SaaS, comme les autres
  durées.
- **Point de départ** : le jour de la clôture, à l'heure de Paris (`closed_at`). Une demande en
  cours (ouverte ou prolongée) n'est jamais concernée. Échue le jour même, jamais la veille,
  comme les autres règles (`requestProofDueOn`, `packages/privacy`).
- **Mécanique** : la même que la purge mensuelle (RGPD-05), pas de traitement automatique.
  Une demande dont la preuve est échue devient une ligne de la liste (règle
  `privacy_request`, clé `request:<id>`, libellé : le nom, affiché à la titulaire seulement).
  Validée, la ligne passe par le contrat privacy/v1 du hub (sorte `privacy_request`, sort
  « anonymisée ») : `person_label` prend le marqueur `ANONYMIZED` (« [anonymisé] ») et
  `extension_reason` devient nul. Exclue avec un motif, elle revient le mois suivant.
- **Ce qui reste** : le type de la demande, ses dates (réception, échéance, prolongation,
  action, réponse, clôture) et son journal. La demande reste dans la liste ; son dossier dit
  que la preuve est terminée. Avant ce terme, l'étape « Clôture » du dossier indique jusqu'à
  quand le nom est gardé.
- **Affichage** : le marqueur stocké est technique et stable (celui des autres modules) ; les
  écrans l'affichent traduit (`Privacy.personAnonymized` : « [anonymisé] », « [anonymised] »).
  Une demande déjà anonymisée ne revient jamais dans la purge.
- **Données** : migration 0083 (annulable), une colonne de réglage, valeur par défaut 60.
  Aucune nouvelle table ; la trace de la purge garde la clé et la règle, jamais le nom.

## Conséquences

- Annuler 0083 (`docs/runbooks/restauration.md`, § 4 bis) retire le réglage ; une durée
  modifiée par la titulaire est perdue. Les noms déjà anonymisés le restent : l'anonymisation
  est irréversible, comme pour les autres lignes de la purge.
- Une organisation qui a des demandes closes depuis plus de 5 ans les verra toutes dans la
  première purge après le déploiement.
- Le libellé du module hub dans les preuves et les purges devient « Comptes, imports et
  demandes RGPD ».
- Les captures d'aide de l'onglet Réglages (un champ de plus) sont à régénérer
  (`pnpm --filter @symbola/app help:captures`).
