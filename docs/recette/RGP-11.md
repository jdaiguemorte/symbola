# Rejeu RGP-11 — fermeture d'un espace et suppression au 30e jour

Aucun scénario du cahier des charges (§ 17) ne joue la fermeture : le rejeu ferme l'atelier de
Camille (SU-01, ORG-01), chargé du jeu fictif, comme prévu par la spécification du lot 35
(`docs/lots/lot-35-export.md`, Tests).

## Lot 35c — fermer, rouvrir, supprimer, rejouer

- Date : 19/11/2026, en local, par Claude Code.
- Environnement : base neuve `symbola_lot35c` (bootstrap puis migrations jusqu'à 0187), Garage et
  Mailpit du socle de dev.
- Méthode : le test d'intégration `lib/closure/organization-closure.integration.test.ts` charge le
  jeu fictif (sous de nouveaux identifiants), complète l'atelier de Camille de pièces comptables et
  d'un document, puis joue la fermeture à l'horloge simulée ; le temps qui passe (30 jours) est
  simulé par le rôle d'administration, comme le ferait une restauration. Un second atelier complet
  sert de témoin. Le parcours e2e `rgp-11-fermeture` rejoue les écrans (ordinateur et 375 px,
  axe-core).

| Étape | Ce qui se passe | Résultat |
| --- | --- | --- |
| 1 | Une Planner, une Propriétaire d'un autre espace, une session sans double authentification, un nom faux | Refusés ; rien ne change |
| 2 | Camille ferme l'espace | Suppression fixée au 30e jour à minuit (Paris) ; trace écrite ; e-mail de fermeture |
| 3 | Pendant la fermeture | Lien personnel du jeu refusé ; e-mail refusé ; l'espace sort des traitements de fond |
| 4 | Camille rouvre | Lien et e-mails de nouveau acceptés ; trace « rouverte » |
| 5 | Nouvelle fermeture : préavis | Rien avant le 23e jour à minuit ; le préavis part une fois |
| 6 | La veille ; l'horloge de l'app en avance | Rien n'est effacé ; la base refuse ; une fermeture antidatée et une pièce effacée à la main aussi |
| 7 | Le jour même | Toutes les tables de tous les schémas vides pour l'espace ; documents effacés ; comptes de l'équipe effacés ; trace complète, sans donnée personnelle ; l'atelier témoin intact |
| 8 | Restauration d'une sauvegarde d'avant la fermeture, puis rejeu | L'espace revenu est effacé de nouveau ; un espace jamais supprimé n'est pas touché |

Résultat : **passe sans blocage** (intégration). Le parcours e2e : voir le bilan du lot 35c dans
`docs/lots/lot-35-export.md`.
