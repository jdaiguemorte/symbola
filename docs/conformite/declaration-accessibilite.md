# Déclaration d'accessibilité du portail des mariés — brouillon

> **Brouillon, non publié.** Rédigé au lot 40c (JUR-17, NFR-17 ; décision D19, ADR 0078) sur le
> modèle public de déclaration d'accessibilité, à la suite de la réponse 9 de l'avocat (déclaration
> volontaire pour les écrans du couple). **À faire relire par l'avocat avant publication**
> (`fiche-avocat.md`, question 13). Les passages entre crochets restent à compléter : contact,
> voies de recours, analyse d'exemption. La page publique `/accessibilite` sera construite à partir
> du texte relu.

## Déclaration d'accessibilité

[Nom de l'éditeur] s'engage à rendre accessibles les écrans que Symbola destine aux particuliers,
quelle que soit l'obligation qui s'applique à sa taille. Cette déclaration est volontaire.

Elle s'applique au **portail des mariés** : les pages qu'un couple ouvre par le lien personnel
reçu de sa wedding planner (accueil, tâches, budget, programme, documents, messages, paiements).
Elle ne couvre pas les écrans de travail des wedding planners.

## État de conformité

Le portail des mariés est **partiellement conforme** aux règles WCAG 2.2, niveau AA : aucun audit
complet n'a encore été mené par un tiers, et les non-conformités connues sont listées plus bas.

## Résultats des tests

À chaque version de Symbola :

- un contrôle automatisé (axe-core, critères WCAG 2.0, 2.1 et 2.2 de niveaux A et AA) passe sur
  chaque écran du portail, en taille ordinateur, à 375 px et à 360 px de large, et à 200 % de zoom ;
- un parcours au clavier seul vérifie que chaque élément s'atteint et montre son focus ;
- les parcours des mariés sont joués sous Chrome, Firefox et Safari (moteur WebKit) ;
- le réglage « réduire les animations » du système coupe transitions et animations.

À chaque version qui touche le portail, une personne le parcourt au lecteur d'écran (VoiceOver sur
iPhone et sur Mac), selon une liste de contrôle de dix points.

Résultat au [date de la relecture] : [aucune non-conformité relevée par les contrôles automatisés,
le parcours au clavier et la revue au lecteur d'écran : à confirmer à la publication].

## Contenus non accessibles

### Non-conformités connues

- [Aucune à ce jour : à mettre à jour à chaque revue.]

### Contenus non soumis à l'obligation d'accessibilité

- Les documents déposés par la wedding planner ou par un prestataire (devis signés, contrats,
  photos) sont fournis tels quels ; leur accessibilité dépend de leur auteur.

[Dérogation pour charge disproportionnée : aucune revendiquée. Analyse d'exemption : à rédiger par
l'avocat.]

## Établissement de cette déclaration

Cette déclaration a été établie le [date de publication].

- Technologies utilisées : HTML, CSS, JavaScript.
- Environnement de test : Chrome, Firefox et Safari (WebKit) récents ; Safari sur iPhone avec
  VoiceOver ; Safari sur Mac avec VoiceOver.
- Outils : axe-core, Playwright.
- Pages vérifiées : accueil du portail, tâches, budget, programme, documents, messages, paiements.

## Retour d'information et contact

Si vous ne parvenez pas à accéder à un contenu ou à un service du portail, vous pouvez écrire à
[adresse de contact de l'éditeur, à fournir par Julien] pour être orienté vers une autre façon d'y
accéder ou obtenir le contenu sous une autre forme. Votre wedding planner peut aussi vous
transmettre l'information.

## Voies de recours

[À rédiger par l'avocat : recours ouverts à une personne qui ne reçoit pas de réponse satisfaisante,
selon le régime applicable à l'éditeur.]
