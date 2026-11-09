# Lot 18 — Retours de la recette du lot 17

**Statut** : fait sur la branche `lot-18-retours-recette` (HUB-22, HUB-23, HUB-24, PRE-16,
RGPD-07, AIDE-13). Maquette et décisions A à G validées par Julien le 09/11/2026 ; choix
d'architecture dans l'[ADR 0047](../adr/0047-dossier-rgpd-et-documents-dans-l-accompagnement.md).
Reste : recette sur le staging (migration 0082 au déploiement).

## Contexte

Retours de Julien du 09/11/2026, en recette du lot 17 sur le staging :

- « Lorsque je clique sur plus d'options, ça grossit mes menus. »
- « Je ne comprends pas à quoi correspond le trajet estimé et comment ce menu fonctionne. »
- « Les onglets de menus associés à la RGPD semblent intégrés dans une sorte de file ou un
  tunnel […] cette rubrique mérite d'être ajustée pour faciliter le traitement des demandes de ce
  type et éviter qu'elles deviennent un casse-tête opérationnel en plus d'être réglementaire. »
- « Personnaliser sa facture et ses devis devrait faire l'objet d'un tutoriel ou de
  l'onboarding : c'est structurant dans la manière d'utiliser la plateforme. »
- « L'alerte qui reste sticky en bas pour le suivi des tutoriels ne devrait apparaître que dans
  l'onglet tutoriel. »
- « Quand je clique sur encaissements, ça met en surbrillance les 2 menus encaissements et devis
  et factures. »

## HUB-22 — Un seul lien du menu principal allumé

- **Étant donné** l'écran Encaissements (`/devis/encaissements`), **alors** seul
  « Encaissements » est marqué comme page courante, pas « Devis et factures ».
- **Étant donné** un devis, une facture ou un avoir, **alors** « Devis et factures » reste
  allumé ; un écran de réglage allume « Paramètres », pas le module.

## HUB-23 — Pastille « Reprendre » sur l'onglet Tutoriels seulement

- **Étant donné** un tutoriel en cours, **quand** la planner navigue dans l'app, **alors** la
  pastille « Reprendre : … » n'apparaît que sur l'onglet Tutoriels. L'invitation à un tutoriel
  à la première visite de son écran (AIDE-06) ne change pas.

## HUB-24 — « Plus d'options » sans déformer la barre d'outils

- **Quand** elle ouvre « Plus d'options » (Événements), **alors** seul le panneau apparaît : les
  boutons voisins gardent leur taille. Cause : le style de carte des blocs dépliants ouverts
  s'appliquait aussi à ce bloc.

## PRE-16 — Estimation des trajets expliquée

- **Quand** elle ouvre Paramètres › Prestataires et données › Estimation des trajets (ancien
  « Trajets »), **alors** l'écran dit où l'estimation apparaît (recherche « autour d'un lieu »
  dans le carnet, fiche, export) et comment elle se calcule (vol d'oiseau × détour, vitesse
  moyenne), avec les valeurs par défaut.
- **Quand** elle modifie le coefficient ou la vitesse, **alors** un exemple (prestataire à 40 km à
  vol d'oiseau) se recalcule aussitôt.

## Décisions de la maquette (09/11/2026)

- **A** : quatre onglets — Demandes, Rechercher une personne, Purge mensuelle, Réglages.
- **B** : un export ou un effacement part toujours d'une demande ; la recherche seule sert à
  consulter et propose de créer la demande.
- **C** : clôture seulement si l'action est faite et la réponse marquée « envoyée ».
- **D** : compteur des demandes en alerte au menu.
- **E** : étape facultative « Vos documents » (logo et couleur), 4ᵉ de l'assistant (7 étapes).
- **F** : tutoriel « Personnaliser vos devis et factures » sur l'écran Documents.
- **G** : ce tutoriel est conseillé ensuite, y compris aux organisations déjà démarrées.

## RGPD-07 — Une demande, un dossier suivi de bout en bout

- **Quand** la titulaire ouvre Données personnelles, **alors** elle voit la liste des demandes
  (type, personne, échéance avec pastille, avancement) et peut en enregistrer une ; les onglets
  mènent à la recherche, à la purge et aux réglages.
- **Quand** elle enregistre une demande, **alors** son dossier s'ouvre sur l'étape « Données
  retrouvées », avec la recherche déjà remplie avec la personne.
- **Étant donné** une demande d'accès ou de portabilité, **quand** elle exporte les fiches
  cochées, **alors** l'export est rangé à l'étape « Action » du dossier et l'étape suivante est
  la réponse.
- **Étant donné** une demande d'oubli, **quand** l'effacement est terminé, **alors** la
  demande reste ouverte jusqu'à la réponse ; la preuve et le modèle de réponse sont à l'étape
  « Réponse ».
- **Étant donné** une rectification ou une opposition, **alors** elle la marque faite à la
  main, puis la réponse (modèle de départ prêt à copier).
- **Quand** elle veut clôturer, **alors** c'est refusé tant que l'action n'est pas faite ou
  que la réponse n'est pas marquée envoyée ; le dossier dit ce qui manque.
- **Étant donné** une demande en alerte, **alors** un compteur l'indique sur Paramètres et
  Données personnelles.
- **Quand** elle consulte seulement (onglet Rechercher), **alors** aucun export ni effacement
  n'est possible ; un formulaire propose de créer la demande pour cette personne.
- Isolation : une organisation ne lit, ne fait avancer ni ne clôt le dossier d'une autre.

Tests : `modules/hub/privacy-cases.test.ts`, `privacy-cases.integration.test.ts`, parcours
`rgpd-01` à `rgpd-04`.

## AIDE-13 — Personnaliser ses devis et factures dans l'accompagnement

- **Quand** une nouvelle organisation suit l'assistant de démarrage, **alors** l'étape 4
  « Vos documents » propose le logo et la couleur ; « Plus tard » la saute ; l'assistant
  compte 7 étapes.
- **Étant donné** une organisation déjà avancée dans l'assistant, **alors** sa progression
  est décalée d'un rang (migration 0082) : elle ne revient pas en arrière.
- **Quand** elle ouvre les tutoriels, **alors** « Personnaliser vos devis et factures » est
  conseillé ensuite.

Tests : `lib/help/journey.test.ts`, chaîne d'annulation (`rollback.integration.test.ts`),
parcours `lot-12-demarrage` et `lot-13-tutoriels`.

## Suite à prévoir

- Anonymiser `person_label` d'une demande close en fin de conservation (purge mensuelle),
  comme prévu au registre (ADR 0047, « Conséquences »).
