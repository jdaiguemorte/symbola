# Lot 73d — Créer une fiche, lire une fiche : rejeu local (28/11/2026)

Spécification : `docs/lots/lot-73-prestataires.md`, § 5.4 (critères 1 à 11) ; maquette 20. Données entièrement
fictives, créées par les tests et les parcours. Aucun serveur réel. Pas de rejeu de scénario du § 17 à ce
paquet : SC-04 et SC-05 se rejouent au 73g, comme pour le 73b et le 73c.

## Ce qui a été rejoué

1. Base locale `symbola`, migrations de `main` (aucune en attente). **Aucune migration nouvelle.**
2. Tests de calcul : `app/prestataires/vendor-create-model.test.ts` et
   `app/prestataires/[id]/vendor-sheet-model.test.ts` (29), vus échouer sans le code puis réussir ; toute la
   suite Vitest de l'app : 1 538 réussis.
3. Intégration contre PostgreSQL : `lib/vendors/vendor-sheet-73d.integration.test.ts` (12) et les tests voisins
   des modules Prestataires et Évènements (liens compris) : 173 réussis.
4. Parcours `e2e/lot-73d-creer-lire.spec.ts`, projets « desktop » et « mobile-375 », sur l'app de cette copie en
   mode développement (port 3073, session ouverte en base sans le fournisseur d'identité local) : RESULTAT_E2E.

## Ce que montrent les parcours

- Au carnet, « Nouveau prestataire » ouvre la fenêtre « Nouveau prestataire » sur le carnet (`?nouveau=1` ;
  `/prestataires/nouveau` y mène) : Nom, Métier, Contact, Téléphone, E-mail, Ville, dans cet ordre ; « À
  classer » est le dernier choix des métiers ; « * obligatoire » est dit avant l'envoi.
- Envoyée vide : aucune bulle du navigateur ; sous « Nom », « Donnez le nom du prestataire, par exemple « Maison
  Haddad ». » ; sous « Métier », « Choisissez son métier, ou « À classer » si vous ne le savez pas encore. » ;
  le contact déjà tapé reste ; le focus va au nom. axe-core : aucune violation, en erreur comprise.
- « Maison Hadad » : « Une fiche « Maison Haddad » existe à Poitiers. La voir » sous le champ ; la création
  reste possible.
- « Plus de détails » ouvre en place l'adresse, le N° SIRET (« 14 chiffres, sur ses devis et factures »), le
  site et les réseaux, l'évaluation, les tarifs, la note (et les étiquettes et champs du métier choisi).
- « Créer la fiche » ouvre la fiche neuve : « À classer · Poitiers · aucun mariage avec vous », « Pas encore de
  mariage ensemble… », « E-mail non renseigné · Ajouter », « pas encore notée : elle se donne après un
  mariage », « non renseignée : la carte et les trajets en ont besoin · Ajouter » ; **aucun « — »**.
- « Aucune pièce demandée. Votre agence demande d'habitude : Assurance et Kbis. » ; « Demander Assurance et
  Kbis » dépose deux demandes (« 2 pièces demandées à Douceurs Montées », « La demande l'attendra sur son lien,
  dès qu'il en aura un. ») ; « Annuler » les retire (« Demande retirée. »).
- Depuis le poste « Transport » de Léa & Maxime, la recherche « Les Calèches du Lac » qui ne trouve rien ouvre
  la même fenêtre, le nom seul prérempli, « Pour le poste « Transport » de Léa & Maxime », « Comment l'ajouter
  à « Transport » ? » sans réponse cochée ; sans réponse, « Choisissez comment l'ajouter au poste : en
  comparaison, ou retenu. » et rien n'est créé ; « Retenu » puis « Créer et ajouter » : la fiche est au carnet
  et retenue sur le poste (« Retenu sur « Transport ». »). Depuis un poste « Photographe », le métier
  « Photographe » est proposé (« Proposé d'après le poste « Photographe ». »).
- La fiche de Maison Haddad, ouverte d'un clic depuis le carnet : en-tête de moins de 200 px à 1 440 px, un
  seul bouton plein (« Ajouter à un mariage… ») sur toute la fiche ; l'alerte « Attestation d'assurance
  responsabilité civile · à renouveler : fin de validité le 31 octobre 2026. Maison Haddad est retenu sur
  1 mariage à venir. » et « Demander au prestataire », dont la fenêtre propose cette pièce et dit qu'elle
  attendra son lien ; « Avec vous » : Léa & Maxime (lien vers son poste), Traiteur, « Retenu, contrat non
  signé », 9 600,00 €, « après le jour J » ; plus de « Prix final ».
- Le menu « ⋯ » : Modifier (la même fenêtre, complète : « Modifier « Maison Haddad » », métiers cochés),
  Archiver… ; Caractéristiques, Paiement et fichiers, Note interne, Point sur la carte présents.
- Paramètres du carnet › Pièces : « Nom court » et « Demandée d'habitude » s'enregistrent seuls ; le Kbis
  décoché, une fiche neuve ne propose plus que « Demander Assurance ».

## Défauts trouvés au rejeu, corrigés

- La fenêtre de création importait le moteur d'import (code serveur) dans la page : la page ne se compilait
  pas. La ressemblance des noms est passée dans `vendor-create-similar.ts`, côté serveur.
- Depuis un poste, la ligne du budget se redessinait quand la fiche y était ajoutée, emportant la fenêtre avant
  son message de retour : l'envoi se suit désormais dans sa propre suite.
- Une fenêtre `.window` montée fermée (« Demander au prestataire ») restait affichée : règle « non ouverte,
  cachée » sur la fiche.
- La colonne de droite rangeait ses caractéristiques sur plusieurs colonnes à 1 280 px : un libellé, une valeur
  par rang.

## Ce qui reste

- Le signalement des doublons à la création réemploie la ressemblance des noms de l'import ; il passera à la
  fonction du 71d (PR #218) une fois fusionnée.
- Rejeu de SC-04 et SC-05 au 73g ; captures du centre d'aide au 73g.
