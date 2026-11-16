# ADR 0071 — Le programme diffusé par versions, et le relevé mensuel du stockage

- Statut : accepté (lot 37, décisions D1 à D13 validées par Julien le 16/11/2026)
- Date : 2026-11-16
- Complète : [0011](0011-monolithe-modulaire-pour-le-mvp.md) (modules et `service.ts`),
  [0029](0029-assistance-admin-et-statistiques-d-usage.md) (statistiques de l'Admin, sans donnée
  métier), [0053](0053-acces-des-tiers-par-lien-personnel.md) (tiers par lien personnel),
  [0070](0070-espace-documents-et-liens-de-partage.md) (espace documents, aperçu).
- Exigences : CHR-07, DAT-14, DOC-12 de `docs/CAHIER_DES_CHARGES.md` ; spécification
  `docs/lots/lot-37-documents.md` (partie 37b).

## Contexte

Jusqu'au lot 37a, le programme du jour J se lisait en direct : le client et le prestataire voyaient
chaque modification de la planner dès qu'elle était enregistrée, brouillon compris. Le PDF
« prestataires » était le même pour tous, notes internes comprises, sans numéro de version. CHR-07
veut une diffusion par destinataire, par lien et en PDF, en versions numérotées ; DAT-14 veut que
le programme diffusé garde ses versions.

Rien ne mesurait le stockage d'une organisation : `core.usage_counters` ne compte que les requêtes.
DOC-12 veut un relevé mensuel par nature, dès le pilote, pour le calcul des quotas (DOC-06, P1).

## Décision

### Le programme diffusé (CHR-07, DAT-14 ; D8 à D11)

1. **« Diffuser » fige une version** (D8). `events.program_versions` garde, pour chaque diffusion,
   le numéro (1, 2…), la date, l'auteur et une copie figée des séquences, sans note interne.
   - Un verrou sur l'évènement donne deux numéros à deux diffusions simultanées.
   - Une diffusion est refusée si le programme est vide ou identique à la dernière version : un
     double clic ne fait qu'une version, et une note interne seule ne fait pas de nouvelle version.
   - Une version ne se modifie pas : le rôle de l'app n'a pas de droit `UPDATE` sur la table.
2. **Les tiers lisent la dernière version diffusée**, jamais le programme en cours (D8, D10).
   - Le client (portail) lit toute la version, sans note interne, et la télécharge en PDF numéroté.
   - Le prestataire (son espace) lit ses séquences en entier, sans autre intervenant (lot 26b), et
     le déroulé du jour en titres et horaires seulement (D9). Son PDF montre la même chose ; la
     colonne des intervenants y devient « votre poste ».
   - Avant toute diffusion, ils lisent « pas encore diffusé ».
3. **La fiche dit ce qui a changé** depuis la dernière diffusion (séquences ajoutées, modifiées,
   retirées) ; la liste des versions reste, chacune consultable et imprimable (aperçu du PDF).
4. **Prévenir** (D11). Chaque lien personnel retient la dernière version vue
   (`event_links.program_version_seen`). Une version plus récente est signalée une fois sur la
   page du destinataire ; jamais à sa première visite, jamais depuis l'aperçu « vu par ». L'e-mail
   viendra avec les modèles d'e-mails du lot 38.
5. **Une décision sur le programme** (POR-03) fige désormais la version que le client approuve ;
   elle est signalée « changée » quand une version plus récente est diffusée, pas quand la planner
   modifie son brouillon. La décision ne se demande qu'une fois une version diffusée.
6. **Le PDF de l'équipe** garde les notes internes : il s'appelle désormais « équipe », non plus
   « prestataires », puisque les prestataires reçoivent leur version diffusée (CHR-07 : un
   prestataire ne voit pas les notes internes).

### Le relevé mensuel du stockage (DOC-12 ; D12, D13)

7. **Quatre natures** : originaux légaux (factures et avoirs émis), documents signés (devis et
   contrats signés, certificats, dossiers de preuve), dépôts (documents de l'évènement et toutes
   leurs versions, pièces des tâches et du budget, devis des candidats, fichiers du carnet) et
   images (logo, et tout fichier déposé dont le type est une image). Les exports, temporaires, et
   les fichiers des essais guidés ne comptent pas.
8. **Chaque module rend sa part** par son `service.ts` : des sommes par nature et par évènement,
   jamais un nom de fichier. `lib/storage-snapshots.ts` additionne, écarte les évènements d'essai
   et confie le relevé au hub (`hub.storage_snapshots`), un par organisation, par mois et par
   nature, en ajout seul.
9. **Quand** : un traitement de fond horaire prend le relevé du mois civil de Paris à son premier
   passage du mois, le premier à minuit, ou au redémarrage si le serveur était arrêté. Il ne le
   reprend jamais deux fois. Le premier relevé est pris dans l'heure qui suit la mise en service.
10. **Les tailles** (D13) : le relevé lit les tailles en base, sans parcourir le stockage. Les
    documents signés, les certificats, les dossiers de preuve et le logo enregistrent désormais
    leur taille à l'écriture ; pour l'existant, le premier relevé la lit une fois au stockage
    (`HEAD`, sans télécharger) et la garde. Un fichier absent du stockage n'est pas compté et
    est signalé au journal par l'identifiant de sa ligne.
11. **Qui le voit** (D12) : la titulaire, dans Paramètres › Stockage (relevé du mois par nature,
    historique) ; l'Admin, le dernier total par organisation dans la console (des nombres
    seulement, SEC-09, ADR 0029).

## Conséquences

- Migrations 0138 (`events` : versions, dernière version vue), 0139 (`hub` : relevés, taille du
  logo), 0140 (`quotes` : tailles des documents signés et des dossiers de preuve) ; une par schéma
  (DAT-09), chacune avec son annulation, compatibles avec l'image du lot 37a.
- **Reprise** : le programme existant de chaque évènement devient sa version 1, datée de sa
  dernière modification, sans auteur (« reprise »), et ses liens l'ont déjà vue. Personne ne
  perd le programme au déploiement, et rien n'est signalé comme nouveau.
- Les versions entrent dans l'export complet et dans le registre RGPD (responsables et
  intervenants libres recopiés) ; trouvées par la recherche RGPD, supprimées à l'oubli. Le relevé
  du stockage, donnée d'exploitation, n'est pas exporté.
- Le relevé alimentera le calcul des quotas (DOC-06) ; aucun blocage n'existe encore.
- Une organisation dont le relevé échoue est reprise au passage suivant, sans bloquer les autres.
