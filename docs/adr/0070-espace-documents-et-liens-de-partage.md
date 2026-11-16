# ADR 0070 — L'espace documents d'un évènement, l'aperçu sans cadre et les liens de partage

- Statut : accepté (lot 37, décisions D1 à D13 validées par Julien le 16/11/2026)
- Date : 2026-11-16
- Complète : [0011](0011-monolithe-modulaire-pour-le-mvp.md) (modules et `service.ts`),
  [0027](0027-telechargements-servis-par-l-app.md) (fichiers servis par l'app),
  [0053](0053-acces-des-tiers-par-lien-personnel.md) (tiers par lien personnel),
  [0061](0061-pieces-inalterables.md) (originaux légaux), [0064](0064-jour-j-hors-ligne.md)
  (documents embarqués du jour J).
- Exigences : DOC-01, DOC-04, DOC-07, POR-04, POR-10 de `docs/CAHIER_DES_CHARGES.md` ;
  spécification `docs/lots/lot-37-documents.md` (partie 37a).

## Contexte

Avant le lot 37, l'onglet « Documents » d'une fiche était une liste plate de fichiers déposés
(lot 29b). Les autres fichiers de l'évènement vivaient ailleurs : devis, contrats, factures, pièces
des tâches et du budget, devis des prestataires consultés. Rien ne se partageait avec les clients
ni les prestataires, et rien ne s'affichait sans téléchargement.

L'app refuse d'être encadrée : `X-Frame-Options: DENY` et `frame-ancestors 'none'`, avec
`object-src 'none'`. Ces en-têtes sont une règle du dépôt (CLAUDE.md § 5) et ne s'affaiblissent pas
pour un aperçu.

## Décision

1. **Un seul espace par évènement** (D2). L'onglet réunit :
   - les documents déposés par l'équipe, rangés dans des dossiers d'un seul niveau
     (`events.event_document_folders`, D3) ; un document sans dossier est dans « Divers » ;
   - en lecture, les pièces des modules, dans leurs dossiers fixes : devis et documents signés,
     factures et avoirs, pièces des tâches, pièces du budget, devis des prestataires consultés.
     Chaque module les fournit par son `service.ts` et reste seul à les gérer
     (`app/events/[id]/document-sources.ts`). Un module non souscrit n'en montre aucune.
2. **Des versions** (D4). `events.event_document_versions` garde chaque fichier déposé, numéroté.
   La dernière version est recopiée sur `event_documents` : c'est elle que l'aperçu, le partage, le
   portail et le jour J lisent, sans requête de plus. Supprimer un document supprime les fichiers
   de toutes ses versions.
3. **L'aperçu sans cadre** (D5). Un PDF ou une image (seuls types acceptés à l'envoi, vérifiés par
   le contenu) s'ouvre dans un nouvel onglet du navigateur. La route du fichier le sert « à
   afficher » (`Content-Disposition: inline`) quand l'adresse demande `?apercu=1`, après les mêmes
   contrôles de droits qu'un téléchargement (ADR 0027). Il n'y a ni `iframe`, ni `object`, ni
   conversion en images : les en-têtes de sécurité restent entiers et aucune dépendance n'entre.
4. **Le devis en cours n'est jamais stocké en PDF** (DOC-07). Son aperçu est le PDF lui-même,
   rendu à la demande depuis les données de sa version, par la même route que son téléchargement.
   Les originaux légaux (factures, avoirs, documents signés) s'affichent tels qu'émis (DOC-08,
   ADR 0061), jamais reconstruits.
5. **Le partage avec les tiers** (D6, POR-10). Rien n'est partagé par défaut.
   - Un document déposé se partage à la main avec les clients de l'évènement, avec ses
     prestataires, ou les deux (`shared_with_clients`, `shared_with_vendors`).
   - Le service relit le lien personnel à chaque lecture : un lien client voit les documents
     partagés avec les clients de son évènement, un lien prestataire ceux partagés avec les
     prestataires. Un document non partagé répond comme un document absent.
   - Les factures et avoirs émis pour l'évènement figurent d'office au portail de ses clients : ils
     leur sont adressés. Le module devis ne sert l'original que s'il est d'un devis de l'évènement
     du lien.
6. **Le lien de partage à durée limitée** (D7, DOC-04). Il sert une personne qui n'a pas de lien
   personnel (un traiteur pas encore retenu, un régisseur).
   - Un lien vaut pour un seul document, de 1 à 30 jours, jusqu'à l'instant exact de son échéance,
     et se révoque.
   - Il reprend la sécurité des liens personnels (ADR 0053). Le jeton (organisation et 256 bits
     aléatoires) n'est gardé que haché. Il suit « # » dans l'adresse (`/partage#<jeton>`) : la page
     le lit, l'efface de l'adresse, puis l'envoie en POST. Le débit est limité par adresse IP et
     par organisation.
   - Un lien inconnu, expiré ou révoqué reçoit la même réponse, sans nom de fichier ni
     d'évènement.
   - La page montre d'abord l'intitulé du document, sans rien compter. L'ouverture, c'est le
     fichier servi : elle est comptée sur le lien et portée au fil d'activité de l'évènement
     (`document_link_opened`).
   - La page est servie sans référent : son formulaire part avec « Origin: null », et la route
     accepte l'envoi quand le navigateur le déclare du même site (`Sec-Fetch-Site`).

## Conséquences

- Migration 0137 (schéma `events` seulement) : trois tables, trois colonnes, une valeur du fil
  d'activité. La reprise met chaque fichier existant en version 1, dans « Divers », non partagé.
  L'annulation est refusée tant qu'une ouverture de lien est au fil d'activité.
- Les nouvelles tables entrent dans l'export complet (la v1 tient) et dans le registre RGPD. Un
  nom de dossier est trouvé par la recherche RGPD. L'oubli d'un document emporte ses versions, ses
  liens et leurs ouvertures au fil.
- Un aperçu ouvre un nouvel onglet au lieu de s'afficher dans la page. C'est le prix des en-têtes
  qui interdisent l'encadrement ; sur téléphone, c'est aussi le geste attendu.
- Le partage par règle (« tous les plans aux prestataires ») n'existe pas ; POR-10 l'autorise, il
  viendra si l'usage le demande.
