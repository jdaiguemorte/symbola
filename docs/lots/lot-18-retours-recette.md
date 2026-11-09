# Lot 18 — Retours de la recette du lot 17

**Statut** : corrections HUB-22, HUB-23, HUB-24 et PRE-16 faites sur la branche
`lot-18-retours-recette`. Parcours RGPD (RGPD-07) et documents dans l'accompagnement (AIDE-13) :
maquette à valider par Julien avant tout code.

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

## À valider sur maquette

- **RGPD-07 — Une demande, un dossier suivi de bout en bout** : enregistrer, retrouver les
  données (recherche pré-remplie), exporter ou effacer, répondre (modèle et preuve), clôturer ;
  échéance légale toujours visible. Purge et réglages restent à part.
- **AIDE-13 — Personnaliser ses devis et factures dans l'accompagnement** : un tutoriel dédié et
  une étape facultative de l'assistant de démarrage (logo, couleur).
