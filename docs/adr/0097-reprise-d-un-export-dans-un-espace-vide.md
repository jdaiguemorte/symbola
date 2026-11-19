# ADR 0097 — Reprise d'un export Symbola dans un espace vide : écriture générique, une transaction, chaîne des pièces prolongée

- Statut : accepté (lot 35b ; décisions D6 et D7 de Julien, D7 tranchée le 18/11/2026 après l'avis
  de l'expert-comptable, Q37)
- Date : 2026-11-19
- Complète : [0068](0068-export-complet-contrat-export-v1.md) (contrat export/v1, format),
  [0061](0061-pieces-inalterables.md) (pièces inaltérables, chaîne FAC-14),
  [0035](0035-traitements-de-fond-suivis-des-imports.md) (traitements de fond).
- Exigences : HUB-13 (critère : l'export se réimporte dans un espace vide, test automatisé) ;
  spécification `docs/lots/lot-35-export.md`, parties D et E.

## Contexte

Le lot 35a livre l'export complet au format `symbola.export/v1` (ADR 0068). Le critère de HUB-13
demande que cet export se reprenne dans un espace vide, et qu'un test automatisé le prouve. Les
données tiennent dans plus d'une centaine d'entités de sept modules, reliées par leurs
identifiants, y compris d'un module à l'autre (sans clé étrangère entre schémas, ADR 0012). Les
factures, avoirs, encaissements et originaux sont inaltérables et enchaînés par empreintes
(FAC-14, ADR 0061) ; la chaîne inclut leurs identifiants.

## Décision

1. **Le contrat export/v1 porte aussi la reprise.** Chaque module reprend ses entités par son
   `service.ts` (`register<Module>ImportIds`, `import<Module>Data`), avec les mêmes déclarations
   que l'export (`@symbola/db/export`). L'écriture est générique (`@symbola/db/import`) ; une
   entité qui ne se reprend pas le dit (`importSkip`, avec son motif), une ligne qui doit être
   adaptée a sa transformation (`importTransform`). L'orchestration vit dans `apps/symbola/lib/export`.
2. **De nouveaux identifiants, une table de correspondance commune.** Chaque ligne reprise reçoit
   un nouvel identifiant, tiré avant toute écriture. Toute valeur égale à un ancien identifiant est
   remplacée, où qu'elle soit (colonne, liste, document JSON, clé d'un document JSON) : les liens
   entre modules suivent. L'organisation d'origine devient celle qui reprend. Les comptes cités
   sont ceux de l'équipe qui reprend (même adresse), sinon gardés s'ils existent dans cette
   instance, sinon remplacés par la Propriétaire qui reprend.
   - **Écart avec la spécification** : la table de correspondance n'est pas une table de la base,
     effacée à la fin ; elle ne vit qu'en mémoire, le temps de la transaction. Rien n'est donc à
     effacer, et elle ne peut pas fuiter.
3. **Une seule transaction.** Toute la reprise s'écrit dans une transaction de l'organisation
   (RLS), module par module dans l'ordre de leurs dépendances. Les réglages de départ et les essais
   de l'espace vide sont d'abord retirés (ils sont remplacés par ceux de l'archive). Un échec annule
   tout : l'espace reste tel qu'il était. Les fichiers déjà rangés sont effacés.
4. **Fidélité.** Les lignes sont écrites par le système : `core.stamp_row` garde les dates et les
   auteurs d'origine (un auteur nul reste nul). Le test de réversibilité compare deux exports à
   l'identique, identifiants mis à part.
5. **Contrôles avant d'écrire** : archive lisible (lecteur ZIP en flux, sans dépendance, CRC et
   tailles contrôlés) ; format et version connus ; empreinte SHA-256 de chaque entrée et de chaque
   fichier ; chaque entité conforme à son schéma (un champ inconnu est ignoré : un champ facultatif
   ajouté garde la v1 ; une entité inconnue est signalée au bilan, pas reprise) ; espace vide ;
   chaque fichier contrôlé comme tout envoi (type par le contenu, antivirus).
6. **Pièces comptables (D7).**
   - Factures, avoirs, encaissements, reçus et originaux sont repris en pièces inaltérables, avec
     leur numéro, leur original et leurs séries : la numérotation continue après le dernier numéro
     repris.
   - **Même SIREN** : la reprise est refusée si l'espace et l'archive connaissent tous deux un
     SIREN, et qu'ils diffèrent. D7 ne dit pas ce qu'il advient des pièces d'une autre entreprise :
     la question est posée (Q40).
   - **Chaîne vérifiée** : rangs continus, liens, empreintes recalculées par la base
     (`quotes.ledger_hash`), contenu de chaque écriture comparé à sa pièce dans l'archive (les
     instants de l'archive étant à la milliseconde, ils sont comparés à la milliseconde ; un
     original est comparé par l'empreinte de son fichier). Une pièce sans écriture, ou une écriture
     sans pièce : refus.
   - **Chaîne prolongée** : une table `quotes.ledger_anchors` (migration 0185) garde la dernière
     empreinte de la chaîne reprise. La première écriture de l'espace pointe sur elle au lieu de 64
     zéros, et `quotes.verify_ledger` part d'elle. Les pièces reprises s'y enchaînent de nouveau,
     dans l'ordre de la chaîne d'origine, marquées « reprise » (`is_backfill`). La chaîne obtenue
     est vérifiée avant la fin de la transaction. Une archive dont la chaîne était elle-même
     ancrée exporte son ancre (`quotes/ledger_anchors`, entité ajoutée à la v1), et la vérification
     part de cette ancre.
7. **Ce qui n'est pas repris** (bilan, motif par entité) : l'organisation elle-même (l'espace
   garde son nom ; il reçoit le SIRET de l'archive s'il n'en a pas), ses abonnements, son équipe
   (à inviter), son journal d'activité (il repart de zéro), la trace des exports RGPD (fichiers
   effacés), les liens personnels (à recréer : leurs jetons ne sortent jamais), les agendas
   extérieurs (adresse secrète chiffrée par Symbola). Une signature en cours se relance : son lien
   chez le fournisseur n'est pas exporté. La référence d'une signature chez le fournisseur garde sa
   valeur, suivie de `#` et du nouvel identifiant : unique, elle ne reçoit plus les notifications
   du fournisseur.
8. **Où, par qui** : Paramètres, « Reprendre un export » (`/parametres/reprise`), Propriétaire
   seulement, dans un espace vide (aucun évènement, contact, prestataire, devis, facture, budget,
   rendez-vous ni invité réels). L'archive est déposée par une route dédiée aux fichiers (512 Mio
   au plus, limite technique), rangée dans le stockage privé, reprise en arrière-plan
   (`hub.organization_imports`, migration 0184), puis effacée, réussie ou non. Demande, fin et
   échec vont au journal.

## Conséquences

- Le test de réversibilité (`organization-import.integration.test.ts`) exporte le jeu fictif
  (ORG-01, complété de pièces), le reprend dans un espace vide, le réexporte : chaque entité reprise
  est identique, identifiants mis à part, et chaque fichier garde son empreinte. Une migration qui
  ajoute une table exportée doit donc aussi la reprendre (ou dire pourquoi).
- Un refus a un motif sans valeur de l'archive (entité ou chemin seulement).
- Deux migrations (0184, hub ; 0185, quotes), annulables. Annuler 0185 après une reprise ferait
  signaler la chaîne de l'espace (`broken_link`) : n'annuler qu'avant toute reprise réelle.
- Limites assumées : la route lit l'archive en mémoire (512 Mio) ; une archive plus lourde se
  reprend en écrivant à Symbola. Deux membres d'origine inconnus de l'instance deviennent tous deux
  la Propriétaire : une table qui n'admet qu'une ligne par compte (équipe d'un évènement) peut alors
  refuser la reprise, sans rien écrire.
