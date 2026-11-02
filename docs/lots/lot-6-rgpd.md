# Lot 6 — RGPD et recette

Une PR par story (`lot-6-rgpd-0x-<nom>`), tests d'abord à partir des critères ci-dessous
(`describe('RGPD-0x — ...')`), tests d'isolation obligatoires pour chaque nouvelle table et
chaque route. Commits en français (Conventional Commits), confirmation de Julien avant chaque
`git push`. Ordre de construction : **RGPD-01, RGPD-04, RGPD-02, RGPD-03, RGPD-05** (le suivi des
demandes vient avant l'export et l'oubli, qui s'y rattachent), puis la recette sur le staging.

Au MVP, c'est la **titulaire du compte** qui exerce les droits du module (rôle `owner`) ; le
rôle DPO arrive en V2. Un collaborateur (`member`) n'a aucun accès au module ; l'Admin n'a
jamais accès aux données des organisations (CLAUDE.md §5). RGPD-06 (registre vérifié en CI) est
en place depuis le lot 0.

## Décisions prises avec Julien avant de coder (02/11/2026)

1. **Export et oubli portent sur des fiches sélectionnées**, jamais sur « tout ce qui contient
   le terme » : la recherche liste les fiches trouvées, groupées par module ; la titulaire coche
   celles qui concernent la personne (homonymes). Le contrat `privacy/v1` est révisé en ce sens
   (ADR 0023) : il n'avait encore aucun appelant.
2. **Dernier contact d'un prospect** (règle « 3 ans après le dernier contact venant de lui ») :
   la **dernière activité de la fiche**, soit la date la plus récente parmi la création de
   l'événement, sa dernière modification et son dernier changement de statut. Prudent : jamais
   plus tôt que le vrai dernier contact. Chaque purge reste validée ligne par ligne (RGPD-05).
3. **Dernière connexion des comptes** : enregistrée à chaque connexion réussie (nouvelle
   colonne, déclarée au registre) ; les comptes existants partent de leur date de création.
4. **Durées de conservation et seuil d'alerte** : valeurs du cahier des charges (§ 6), en
   réglages de l'organisation chargés depuis un modèle de départ (CLAUDE.md §2.5) et modifiables
   par la titulaire, **à faire valider par un juriste avant l'ouverture SaaS** :
   - prospect sans suite : 3 ans après la dernière activité, puis anonymisation ;
   - client (mariés) : 3 ans après la fin de la relation (événement réalisé ou dernier
     encaissement), puis anonymisation ;
   - factures, avoirs, devis signés : 10 ans, puis anonymisation (jamais supprimés avant,
     ADR 0010) ;
   - compte d'accès des mariés inactif : 2 ans sans connexion, puis suppression du compte ;
   - alerte d'échéance d'une demande : 7 jours avant l'échéance légale.

## Frontières de module (ADR 0011, 0023)

- **Contrat révisé `privacy/v1`** (`packages/privacy`) : chaque module recherche une personne
  dans ses propres données et renvoie des **fiches** (module, nature, identifiant opaque,
  libellé, champs personnels trouvés) ; l'export, l'aperçu de l'oubli, l'oubli et la liste des
  personnes à purger reçoivent des **fiches désignées**. Chaque module déclare par fiche son
  sort à l'oubli : supprimée, anonymisée ou conservée (motif légal, date de fin).
- **Orchestration par le hub** (CLAUDE.md §4 : orchestrateur RGPD dans le module hub ; appels aux
  modules dans `apps/symbola/lib/privacy/`, comme l'import) : un module qui échoue ou ne répond
  pas dans le délai rend le résultat **incomplet**, jamais « aucune donnée » (RGPD-01).
- **Données d'essai** (ADR 0008) : jamais trouvées, exportées ni purgées.
- **Champs libres importés** (`imported_fields`, lot 5) et lignes d'un import en cours
  (`hub.imports.rows`) : cherchés, exportés et effacés comme les autres champs personnels (ils
  peuvent contenir un e-mail ou un téléphone).

## Stories et critères d'acceptation (PRD §8, précisés)

### RGPD-01 — Recherche transverse

- Quand la titulaire cherche une personne par e-mail, téléphone ou nom, alors le hub interroge
  chaque module souscrit et affiche toutes ses données, groupées par module : fiches
  (événements, clients, accès des mariés), tâches, programme (intervenants, notes), budgets
  (postes, prestataires), devis (signataires), factures et avoirs (acheteurs), champs libres
  importés, imports en cours.
- Étant donné un module qui ne répond pas (erreur ou délai dépassé), alors le résultat
  l'indique clairement comme incomplet, jamais comme « aucune donnée ».
- La recherche ne porte que sur l'organisation de la titulaire (test d'isolation obligatoire) ;
  un collaborateur ou l'Admin n'y a pas accès.
- *Réalisé (RGPD-01)* : contrat révisé (`find` sur des termes, `related` sur des événements),
  correspondance commune dans `packages/privacy` (sans accents ni casse ; nom : chaque mot doit
  apparaître, y compris réparti entre prénom et nom ; téléphone sur ses chiffres, +33 ramené à 0,
  y compris au milieu d'une note). Les modules lisent leurs champs personnels déclarés puis les
  comparent (volumes d'une planner ; ILIKE ne sait pas ignorer les accents sans extension).
  Implémenté par events, budget (rien à chercher, données liées seulement), quotes (signataires,
  acheteurs des factures et avoirs, lignes de devis, champs importés du catalogue) et le hub
  (comptes des mariés, lignes d'un import en cours, valeurs gardées pour annuler un import).
  Orchestrateur `apps/symbola/lib/privacy/search.ts`, délai de 10 s par module. Écran `/rgpd`
  (titulaire seulement), termes transmis par une action serveur, jamais par l'URL.

### RGPD-04 — Suivi des demandes

- Chaque demande a : type (accès, rectification, oubli, portabilité, opposition), date de
  réception, personne concernée (libellé saisi par la titulaire), échéance légale (un mois),
  statut (ouverte, prolongée, close).
- Étant donné une échéance à moins de 7 jours, alors la demande apparaît en alerte dans le
  tableau de bord du hub.
- Quand elle prolonge une demande complexe, alors le motif est obligatoire et l'échéance passe à
  trois mois au total depuis la réception.
- Dates testées avec une horloge simulée (fin de mois, 31 janvier → fin février, passage à
  l'heure d'été).
- *Réalisé (RGPD-04)* : tables `hub.privacy_requests` et `hub.privacy_settings` (RLS, migrations
  0050/0051) ; règles d'échéance pures dans `packages/privacy` (mois calendaires, jour manquant
  ramené au dernier jour du mois, jour de Paris) ; une seule prolongation (trois mois au total
  depuis la réception, motif obligatoire) ; date de réception jamais dans le futur. Réglages
  chargés du modèle de départ `packages/starter-templates/src/privacy-settings.json` à la première
  lecture. Écrans `/rgpd/demandes` et `/rgpd/reglages`, alerte au tableau de bord (titulaire).

### RGPD-02 — Export (droits d'accès et de portabilité)

- Quand elle lance l'export des fiches sélectionnées, alors elle obtient un PDF lisible et une
  archive ZIP (JSON et CSV par module) réutilisable.
- Les notes internes de la planner font partie de l'export : un avertissement le rappelle avant
  l'envoi.
- L'archive se télécharge par un lien temporaire (stockage privé, lien signé à durée limitée).
- *Réalisé (RGPD-02)* : sur `/rgpd`, la titulaire coche les fiches de la personne dans le
  résultat de la recherche (rien n'est coché d'office : homonymes), peut rattacher l'export à
  une demande d'accès ou de portabilité en cours, et doit cocher l'avertissement sur les notes
  internes. La recherche est relancée côté serveur (`apps/symbola/lib/privacy/export.ts`) :
  une fiche cochée qui n'est plus trouvée, ou un module qui ne répond pas, bloque l'export.
  Sortie : PDF lisible (`app/rgpd/export-pdf.tsx`, libellés dans la langue de la titulaire) et
  archive ZIP écrite sans dépendance (`packages/privacy/src/archive.ts` : `donnees.json`, un CSV
  par module, le PDF). Fichiers dans le stockage privé, table `hub.privacy_exports` (RLS,
  migrations 0052/0053, aucune donnée personnelle : identifiants et nombre de fiches), lien
  signé de 5 minutes demandé au clic, liste « Exports récents ». Durée de conservation des
  fichiers réglée par l'Admin (`privacy_export_retention_days`, 7 jours par défaut), purge
  horaire des fichiers expirés (la trace reste). Les pièces jointes du budget (devis
  prestataires) n'y figurent que par leurs métadonnées.

### RGPD-03 — Demande d'oubli

- Quand elle traite une demande d'oubli, alors l'aperçu classe chaque donnée : supprimée,
  anonymisée ou conservée ; chaque donnée conservée indique son motif légal et sa date de fin
  (ex. facture : 10 ans).
- Quand elle valide, alors chaque module exécute sa part et renvoie un accusé ; la demande n'est
  close que quand tous ont répondu.
- Alors une preuve horodatée est générée (PDF), avec un modèle de réponse à envoyer à la
  personne (données traduisibles, jamais en dur).
- Après anonymisation, les statistiques (source, statut, motif de refus, montants) restent
  justes ; nom, e-mail, téléphone et notes libres sont introuvables, y compris par la recherche
  transverse (test automatisé).
- *Décisions de Julien (02/11/2026, avant de coder)* : devis signé conservé comme preuve du
  contrat **5 ans** après la signature (nouveau réglage `signed_quote_retention_months`, modèle de
  départ, à valider par un juriste) ; compte d'accès d'un marié **supprimé** (registre corrigé) ;
  date du mariage **ramenée au 1er du mois**, lieu effacé.
- *Réalisé (RGPD-03)* : contrat `privacy/v1` complété (`planErasure`, `erase`, idempotent) ;
  chaque module classe les fiches désignées :
  - events : client et événement anonymisés (source, statut, motif de perte en catégorie gardés ;
    note libre, champs importés, lieu effacés ; fil d'activité des mariés supprimé), nom du
    prestataire d'un poste anonymisé, tâches, lignes de programme, intervenants et accès des
    mariés supprimés, historique des statuts gardé ;
  - budget : montants gardés, devis prestataire joint supprimé (fichier compris) ;
  - quotes : factures et avoirs **conservés** (obligation comptable, 10 ans réglables), devis
    signé **conservé** (preuve du contrat), devis non signé : signataires et descriptions
    anonymisés, champs importés du catalogue effacés ;
  - hub : compte du marié supprimé (sessions comprises), import en cours abandonné et anonymisé,
    valeurs d'annulation d'un import effacées.

  Orchestration `apps/symbola/lib/privacy/erasure.ts` : aperçu recalculé côté serveur (recherche
  relancée), rattaché à une demande d'oubli en cours, accusé de chaque module tracé dans
  `hub.privacy_erasures` (RLS, migrations 0054/0055) ; la demande se clôt quand tous ont
  répondu, sinon elle reste ouverte et les modules en échec se relancent depuis la trace.
  Preuve horodatée en PDF rendue à la demande (`/rgpd/oublis/<id>/preuve`) et modèle de réponse
  (`packages/starter-templates/src/privacy-erasure-response.json`, FR/EN). Une donnée conservée
  par la loi reste trouvable par la recherche (droit d'accès) ; tout le reste est introuvable
  (testé).

### RGPD-05 — Purge mensuelle

- Chaque mois, le module liste les personnes dont la durée de conservation est échue, selon les
  règles ci-dessus.
- Quand elle valide la liste, alors la purge s'exécute ; elle peut exclure une ligne, avec un
  motif obligatoire. Rien n'est purgé sans validation.
- Règles de calcul testées avec dates simulées (cas limites : la veille et le jour même de
  l'échéance).
- *Décisions de Julien (02/11/2026)* : factures, avoirs et devis signés anonymisés à la fin de
  leur conservation **dès le MVP** (ADR 0024) ; fin de la relation client = la plus tardive entre
  la date de l'événement et le dernier encaissement ; une ligne exclue revient chaque mois.
- *Réalisé (RGPD-05)* : règles pures (`packages/privacy/src/retention.ts`), dernière connexion
  enregistrée (`hub.users.last_login_at`, registre), liste du jour calculée à la demande
  (`apps/symbola/lib/privacy/purge.ts`) : prospects sans suite (prospect, devis envoyé, perdu),
  clients (confirmé, réalisé), comptes de mariés inactifs, factures et avoirs, devis signés.
  Écran `/rgpd/purge` (exclusion avec motif obligatoire, confirmation, motif précédent
  rappelé), historique et détail avec accusés et relance, rappel au tableau de bord tant que
  la liste du mois n'est pas validée. Trace `hub.privacy_purges` (RLS, migrations 0056/0057).
  Exception au verrou des factures limitée à la copie de l'acheteur, dans une transaction qui
  la déclare (ADR 0024). Limite connue : pas d'avertissement au marié avant la suppression de
  son compte inactif.

## Recette (après RGPD-05)

Parcours de recette sur le staging avec la planner (import réel de Wedding Plan, puis chaque
module), checklist dans `docs/runbooks/recette-mvp.md`, puis bascule en production : **actions de
Julien** (CLAUDE.md §8).

*Checklist rédigée* : [`docs/runbooks/recette-mvp.md`](../runbooks/recette-mvp.md) — préparation du
staging, parcours par module (ordinateur et téléphone), critères de bascule, bascule et suivi.
