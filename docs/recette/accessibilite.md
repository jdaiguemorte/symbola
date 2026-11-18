# Revue d'accessibilité des parcours P0 (NFR-17, UX-14, JUR-17)

Lot 40c (décision D19, ADR 0078). À refaire à chaque version qui touche un écran des parcours P0 ou
le portail ; chaque revue s'ajoute en tête, la plus récente d'abord.

## Revue du 17/11/2026 — lot 40c (Claude Code)

- **Où** : en local, app compilée (`next build`, `next start`), base de test `symbola_lot24`, atelier
  du lot 40c (mariage confirmé d'Inès et Sacha, huit tâches, budget, lien des mariés).
- **Comment** :
  - l'arbre d'accessibilité de chaque écran (rôles, noms, titres, régions), relevé par Playwright
    (`ariaSnapshot`) et relu ;
  - les quarante premiers arrêts au clavier de chaque écran : nom, focus visible, taille ;
  - axe-core en WCAG 2.0, 2.1 et 2.2, niveaux A et AA, dans tous les parcours de bout en bout
    (`e2e/axe.ts`), à 1 280, 640 (zoom à 200 %), 375 et 360 px ;
  - les parcours au clavier de `e2e/nfr-17-clavier.spec.ts` (lien d'évitement, focus visible,
    Échap, PAR-03 et PAR-06 au clavier, « moins de mouvement »).

### Écrans revus

| Écran | Titre de niveau 1 | Niveaux de titres | Contrôles sans nom | Focus visible | Ordre du clavier |
| --- | --- | --- | --- | --- | --- |
| Aujourd'hui | 1 | sans saut | aucun | 32 arrêts sur 32 | menu, puis l'écran |
| Tâches | 1 | sans saut | aucun | 40 sur 40 | menu, filtres, tableau |
| Synthèse de l'évènement | 1 | sans saut | aucun | 40 sur 40 | menu, en-tête, onglets, contenu |
| Rétroplanning | 1 | sans saut | aucun | 40 sur 40 | idem |
| Budget | 1 | sans saut | aucun | 29 sur 29 | menu, chiffres, tableau |
| Devis | 1 | sans saut | aucun | 27 sur 27 | menu, filtres, liste |
| Contacts | 1 | sans saut | aucun | 23 sur 23 | menu, recherche, liste |
| Jour J | 1 | sans saut | aucun | 16 sur 16 | retour, aide, « Maintenant », contacts |
| Portail des mariés | 1 | sans saut | aucun | 11 sur 11 | aide, actions, sommaire |

Chaque écran a ses repères : menu principal (`navigation`), contenu (`main`), régions nommées par
leur titre ; le portail a un bandeau (`banner`) et son contenu. Aucune image sans nom.

### Constats et corrections

- **Lien d'évitement absent** (2.4.1) : ajouté, « Aller au contenu », premier arrêt du clavier ;
  il mène au contenu sans traverser le menu (test).
- **Animations** (2.3.3) : « réduire les animations » du système coupe désormais transitions et
  animations (test).
- **Budget à 200 % de zoom** (1.4.10) : la page défilait de côté ; deux textes réservés aux lecteurs
  d'écran sortaient du cadre défilant du tableau. Corrigé (le tableau défile seul, dans son cadre).
- **Historique des versions d'un devis** (2.5.8) : résumé de 19 px de haut, lien du PDF collé
  dessous. Corrigé : deux cibles de 44 px.
- **Agenda, menu d'une date ouvert** (2.5.8) : le menu recouvre des dates voisines. Exception
  « équivalent » : chaque date se rejoint en refermant le menu (Échap, clic ailleurs). Le parcours
  contrôle la page menus fermés, puis le menu ouvert seul.
- **Fiche d'un évènement** : l'erreur d'hydratation (formulaire dans un paragraphe) reconstruisait
  l'écran à l'ouverture, ce qui pouvait déplacer le focus ; corrigée.

### Points relevés, conformes, à garder en vue

- Des liens de moins de 24 px de haut : noms de tâches et d'évènements dans les tableaux et les
  listes (19 à 21 px), « La compléter », « ← Tous les événements », « Modèles de rétroplanning ».
  Ce sont des liens dans du texte ou assez espacés (exceptions « en ligne » et « espacement » de
  2.5.8, vérifiées par axe-core).
- « Reporter l'évènement… » et « Annuler l'évènement… » : boutons d'aspect lien de 18 px de haut,
  conformes par l'espacement. Les passer à 24 px serait plus confortable sur un écran tactile.
- Portail : chaque mois du rétroplanning est une région nommée ; utile au rotor de VoiceOver, à
  confirmer à l'écoute (liste de contrôle, point 10).

### Navigateurs et appareils

- Parcours des scénarios sous Chromium, Firefox et WebKit, à 360 et 1 920 px, SC-10 à 150 % : voir
  le bilan du lot 40c. Firefox a révélé une copie du jour J bloquée (corrigée) ; WebKit, des cookies
  refusés sur le banc d'essai en HTTP (corrigé, ADR 0078).
- **Safari d'un iPhone simulé** : Xcode n'est pas installé sur le poste, donc pas de simulateur iOS.
  SC-03 et le portail ont été rejoués sous WebKit en émulation iPhone 13 (390 px, écran tactile) :
  quatre parcours sur quatre réussis.
- **À vérifier sur un vrai iPhone** : sous WebKit, Playwright ne voit pas l'ouverture d'un document
  embarqué du jour J en mode avion ; le parcours vérifie que la pièce est gardée sur l'appareil,
  pas que Safari l'affiche.

### Lecteur d'écran

À passer par Julien selon `docs/recette/voiceover-portail.md` ; consigner ici la date, l'appareil,
la version et le résultat.

| Date | Appareil | Version | Résultat | Par |
| --- | --- | --- | --- | --- |
| | | | | Julien |
