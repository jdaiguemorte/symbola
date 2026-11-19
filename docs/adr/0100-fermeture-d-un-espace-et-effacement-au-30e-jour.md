# ADR 0100 — Fermeture d'un espace : 30 jours d'export, effacement contrôlé par la base, trace rejouable

- Statut : accepté (lot 35c ; décision D8 de Julien du 18/11/2026 : tout effacer au 30e jour, export
  jusqu'au dernier jour ; sauvegardes à 35 jours, Q35 et ADR 0092)
- Date : 2026-11-19
- Complète : [0068](0068-export-complet-contrat-export-v1.md) (export complet),
  [0061](0061-pieces-inalterables.md) (pièces inaltérables),
  [0092](0092-sauvegardes-35-jours-option-un-an.md) (sauvegardes),
  [0098](0098-reprise-d-un-export-dans-un-espace-vide.md) (reprise).
- Exigences : RGP-11 (réversibilité, suppression dans les 30 jours suivant la résiliation ; la
  suppression couvre les sauvegardes à l'issue de leur cycle) ; spécification
  `docs/lots/lot-35-export.md`, partie F.

## Contexte

Rien ne fermait un espace. RGP-11 demande la suppression du compte et de ses données dans les 30
jours suivant la résiliation. D8 (a) : Symbola, sous-traitant, efface tout au 30e jour, et l'export
reste proposé jusqu'au dernier jour ; rien ne survit, sauf une trace sans donnée personnelle. Les
pièces comptables et le journal d'audit sont inaltérables par construction (déclencheurs) ; le rôle
applicatif n'a pas le droit de supprimer certaines tables (registre RGPD, chaîne des pièces). Une
restauration de sauvegarde peut faire revenir un espace supprimé (DPO, réponse 2).

## Décision

1. **Fermer** : Paramètres, « Fermer l'espace » (`/parametres/fermeture`). La Propriétaire seule,
   dans une session ouverte avec la double authentification, écrit le nom de l'espace (UX-07).
   L'écran rappelle l'export, dit ce qui se passe et donne la date de suppression.
2. **Calendrier, à l'heure de Paris** : fermé le jour J, l'espace est supprimé à minuit au début du
   jour J + 30 ; le préavis part à minuit du jour J + 23. Les minuits suivent les changements
   d'heure (`closure-schedule.ts`, testé la veille, le jour même et aux deux changements d'heure).
3. **Pendant les 30 jours**, l'espace ne sert plus qu'à exporter et à rouvrir :
   - les gardes d'écran (`requirePlanner`, `requireOwner`, lecture comptable) renvoient à la page de
     fermeture ; seules cette page et l'export l'acceptent ;
   - les liens des tiers (client, payeur, prestataire, renfort, partage de document, brochure,
     invités, rendez-vous, page de réservation, formulaire de contact, flux d'agenda) répondent
     comme un lien inconnu ;
   - aucun e-mail ne part (la file refuse, sauf les e-mails de la fermeture, clés `closure:`) ; les
     traitements de fond l'ignorent (`listOrganizations` écarte les espaces fermés ; export,
     reprise, file des e-mails et fermetures utilisent `listOrganizationsIncludingClosed`) ;
   - rouvrir, avant la date, rétablit tout (liens compris).
4. **Effacement contrôlé par la base** (migration 0186) :
   - `core.organization_erasable(org)` n'est vrai que pour un espace fermé dont la date de
     suppression est passée, **à l'horloge de la base** ;
   - `core.erase_organization_schema(org, schéma)` (SECURITY DEFINER) efface toutes les lignes de
     l'espace dans les tables du schéma qui ont `organization_id`, tables en ajout seul comprises,
     sans journaliser chaque ligne ; `core.erase_organization_identity` efface ensuite
     l'organisation, puis les comptes de son équipe qui n'ont plus aucune adhésion (avec tout ce qui
     les cite), et rend leurs sujets chez le fournisseur d'identité ;
   - les déclencheurs d'inaltérabilité (factures, avoirs, reçus, encaissements, originaux, chaîne,
     ancre, journal d'audit) ne cèdent qu'à cette condition (0186, 0187) ;
   - le rôle applicatif ne peut ni antidater une fermeture, ni avancer une date de suppression
     (déclencheur), et une suppression à moins de 29 jours est refusée (contrainte).
   Un défaut de l'app (horloge fausse, appel prématuré) ne peut donc rien effacer avant l'heure.
5. **Par la porte de chaque module** : `erase<Module>Data(tx, org)`, appelé par l'orchestrateur
   (`lib/closure`) dans une seule transaction, le hub en dernier. Les fichiers (clés portées par les
   lignes, préfixes propres à l'espace dans le stockage) sont effacés après la transaction ; un
   passage interrompu les reprend. Les comptes sont effacés chez le fournisseur d'identité.
6. **Trace** (`hub.organization_closures`) : identifiant de l'organisation, dates (fermeture,
   suppression prévue, réouverture, effacement, fichiers, rejeu) et nombres. Sans RLS (l'espace
   n'existe plus quand elle sert), sans suppression pour le rôle applicatif. L'Exploitation la lit
   (`/exploitation/fermetures`).
7. **Rejeu après une restauration** : `closures:export` écrit la trace dans un fichier avant la
   restauration ; `closures:replay` la rejoue après : chaque espace que la trace dit supprimé et
   qui existe de nouveau est refermé à ses dates (rôle d'administration), puis effacé comme au
   30e jour. Un espace restauré encore fermé est effacé par le passage horaire. Runbook de
   restauration, § 4.

## Conséquences

- Délai maximal d'effacement : 30 jours, plus le cycle des sauvegardes (35 jours, ADR 0092), soit
  65 jours après la fermeture ; écrit dans la fiche de la DPO et dit à l'écran.
- La clause de réversibilité de l'accord de sous-traitance sera écrite à la création de la
  société (D8) ; la durée de la trace y sera fixée.
- Tout nouveau déclencheur d'inaltérabilité doit céder à `core.organization_erasable`, et toute
  nouvelle table d'un module porter `organization_id` (déjà la règle) : sinon l'effacement la
  manque (le test d'intégration vérifie chaque table de chaque schéma).
- La facture de clôture et la résiliation commerciale restent au lot du paiement (hors périmètre).
