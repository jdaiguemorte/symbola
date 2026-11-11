# ADR 0051 — Sauvegarde externe chez Hetzner (Storage Box) ; fichiers sur le VPS pendant le pilote

- Statut : accepté (décisions de Julien du 11/11/2026, spécification du lot 22 validée)
- Date : 2026-11-11
- Précise : [0015](0015-garage-remplace-minio-stockage-objet.md) (Garage, stockage d'objets sur le
  VPS) et [0016](0016-isolation-reseau-staging-production.md) (un dépôt et un mot de passe par
  environnement). Remplace la partie « dépôts restic sur le VPS » de `docs/runbooks/restauration.md`.
- Exigences : NFR-10 à NFR-14, NFR-30, NFR-31 et ARC-11 de `docs/CAHIER_DES_CHARGES.md`.
- Décisions de Julien du 11/11/2026 : Q14 b, Q15 et C2 (`docs/QUESTIONS.md`), lot 22
  (`docs/lots/lot-22-sauvegarde-externe.md`).

## Contexte

La sauvegarde nocturne (restic, chiffrée) écrit aujourd'hui dans `/srv/backups/restic/<env>`, sur
le disque du VPS. C'est le VPS lui-même qui lance la rétention (`forget --prune`).

Une panne du disque, une erreur ou un rançongiciel emporterait donc ensemble la base, les fichiers
et les sauvegardes. Un attaquant qui prendrait la main sur le VPS pourrait effacer tout
l'historique.

Le nouveau cahier des charges exige :

- une sauvegarde hors du VPS, chez un autre fournisseur, dès la première donnée réelle (NFR-10) ;
- 12 mensuelles, et un historique que le serveur ne peut pas effacer (NFR-13) ;
- des fichiers et des sauvegardes séparés du serveur applicatif (NFR-31).

Il n'y a pas encore de données réelles en production. Julien veut un fournisseur européen, bon
marché dans la durée.

## Décision

1. **Destination** : une Storage Box Hetzner BX11 (1 To), à Helsinki. Hetzner est un autre
   fournisseur que celui du VPS, et la Finlande est un autre pays : un incident chez Contabo ou
   dans une région n'atteint pas les sauvegardes. Le prix catalogue est de 3,20 € HT par mois, et
   le trafic est illimité selon la documentation de Hetzner.
2. **Un sous-compte par environnement** (production, staging). Chacun est enfermé dans son
   dossier, avec sa clé SSH et son mot de passe restic. Le VPS ne connaît que ces sous-comptes.
   Le mot de passe du compte principal et l'accès à la console Hetzner, protégée par double
   authentification, restent hors du VPS : ils sont dans le gestionnaire de mots de passe de
   Julien et sur sa clé de sécurité.
3. **Transport** : restic, avec son interface SFTP, sur le port 23. L'empreinte du serveur est
   épinglée (`StrictHostKeyChecking yes`) : jamais d'acceptation automatique. La clé, la
   configuration SSH et le mot de passe restic sont montés en lecture seule dans le conteneur
   restic.
4. **Historique hors d'atteinte** : Hetzner prend chaque jour, à 05:00 UTC (6 h ou 7 h à Paris, après les sauvegardes de 2 h 30 et 3 h 30), une copie instantanée de
   toute la Storage Box et en garde dix. Ces copies sont en lecture seule et ne se suppriment que
   depuis la console. Si le VPS est compromis et efface son dépôt, on recopie le dépôt depuis la
   copie de la veille. La recopie se fait avec le compte principal, depuis le poste de Julien. Un
   script prouve depuis le VPS que la suppression d'une copie échoue (NFR-13).
5. **Rétention restic** : 7 quotidiennes, 4 hebdomadaires, 12 mensuelles. Un contrôle de
   structure chaque nuit, et une relecture de 10 % des données le dimanche.
6. **Fichiers de Garage** : ils restent sur le disque du VPS pendant le pilote (décision Q14 b) et
   entrent dans chaque sauvegarde distante. La perte maximale reste de 24 heures (NFR-11). On
   basculera vers un stockage d'objets externe au palier 2, quand la disponibilité visée l'exigera
   (NFR-06).
7. **Preuves** :
   - une restauration chronométrée du staging depuis le dépôt distant, à la mise en service ;
   - un exercice « dépôt effacé », pour prouver que l'historique survit ;
   - le test mensuel sur un serveur vierge commence après le pilote (décision Q15).

## Alternatives écartées

- **Stockage d'objets avec verrouillage (Scaleway, en France)** : la protection est la plus
  forte, et le coût de quelques centimes par mois pour nos volumes. Mais restic s'accorde mal au
  verrouillage : il faut garder les versions des fichiers, et la restauration après attaque est
  plus délicate. On le garde en recours si la protection des copies Hetzner ne se prouve pas.
- **Stockage d'objets de Contabo** : il sait verrouiller les fichiers, mais c'est le fournisseur du
  VPS, ce que NFR-10 interdit.
- **Serveur restic en ajout seul (rest-server) chez un autre hébergeur** : un second serveur à
  maintenir, pour une protection comparable.
- **Garder aussi les dépôts locaux** : des restaurations plus rapides, mais deux chemins à
  maintenir sans gain de sécurité. Le choix est laissé à Julien dans la spécification du lot 22
  (décision 1).

## Conséquences

- **Coût** : 3,84 € TTC par mois. Les copies instantanées sont gratuites mais prennent de la place
  sur le To.
- **Sous-traitant** : Hetzner devient un sous-traitant ultérieur, à inscrire dans la liste publique
  et datée (RGP-13). Les données y sont chiffrées par restic avant l'envoi, et Hetzner ne peut pas
  les lire.
- **Fenêtre de protection** : dix jours. Une attaque découverte au-delà ne peut plus compter sur
  les copies Hetzner. Les alertes (échec de sauvegarde, disque) visent à la découvrir bien avant.
- **Restaurer prend plus de temps** : les données traversent le réseau. Le temps est mesuré lors
  du premier test et consigné (NFR-11 : moins de quatre heures).
- **Changer de fournisseur** ne touche que la configuration SSH et l'adresse du dépôt : les
  scripts acceptent aussi un dossier local, ce qui sert aux tests.
- **Bascule du palier 2** : Garage sera remplacé par un stockage d'objets externe. Cet ADR sera
  alors complété ou remplacé.
