# ADR 0021 — Signature en ligne : adaptateur DocuSeal, webhook et base dédiée

- Statut : accepté
- Date : 2026-10-27
- Complète : [0006](0006-signature-docuseal-derriere-interface.md)

## Contexte

DEV-02 fait signer les devis en ligne. ADR 0006 a retenu DocuSeal auto-hébergé derrière une
interface `SignatureProvider`, avec un faux fournisseur pour les tests et l'essai guidé. Trois
points restaient ouverts dans la spécification du lot 4 (tranchés avec Julien le 27/10/2026) :

1. **Où saisir l'e-mail et l'adresse de facturation des signataires**, que
   `events.event_clients` ne porte pas.
2. **L'authentification du webhook** : le PRD demande que tout appel non authentifié
   valablement soit rejeté et journalisé. DocuSeal envoie un **en-tête secret** configurable
   (clé et valeur choisies dans ses réglages de webhook) ; une signature HMAC du corps
   (`X-Docuseal-Signature`) existe selon l'édition, sans certitude qu'elle soit disponible dans
   l'édition auto-hébergée gratuite.
3. **La base de DocuSeal**, qui ne doit jamais être le schéma d'un module Symbola (CLAUDE.md §5).

## Décision

1. **Signataires saisis sur le devis** (module Devis, table `quotes.quote_signers`) au moment
   de l'envoi en signature : nom, e-mail, adresse de facturation, copiés et figés avec la
   version envoyée, pré-remplis depuis les accès mariés (EVT-06) quand ils existent. Déclarés
   dans `privacy.registry.yaml`.
2. **Interface `SignatureProvider`** (`apps/symbola/modules/quotes/signature/`) : créer une
   demande à partir du PDF du devis (une zone de signature par signataire), relire une
   demande, télécharger le document signé et le certificat de preuve, authentifier un appel
   webhook. Deux implémentations :
   - **DocuSeal** (`docuseal.ts`) : API REST appelée avec `fetch` (aucun SDK, aucune nouvelle
     dépendance), en-tête `X-Auth-Token`, `POST /submissions/pdf` avec `send_email: false` —
     **c'est Symbola qui envoie à chaque signataire son lien** (cahier des charges, §
     « Signature »), `GET /submissions/{id}` pour relire l'état ;
   - **faux fournisseur** (`fake.ts`) : en mémoire, sans réseau, pour les tests, le
     développement local et l'essai guidé (un devis d'essai n'utilise **jamais** DocuSeal et
     n'envoie aucun e-mail à un tiers).

   Une même suite de tests s'exécute contre les deux implémentations ; l'adaptateur DocuSeal
   y est testé contre un serveur HTTP simulé qui reproduit les réponses de l'API.
3. **Webhook `/api/webhooks/signature` : secret partagé puis relecture par l'API.**
   - L'en-tête secret (nom et valeur dans `DOCUSEAL_WEBHOOK_HEADER` / `DOCUSEAL_WEBHOOK_SECRET`)
     est comparé **en temps constant** (`timingSafeEqual`). Absent ou faux : réponse 401,
     **journalisation** (motif, sans donnée personnelle ni corps de requête), aucun effet.
   - Un appel authentifié n'est **jamais cru sur parole** : seul l'identifiant de la
     soumission est lu dans le corps, puis l'état (signataires signés, refus, documents) est
     **relu par l'API DocuSeal** avant toute écriture. Un appel forgé par quelqu'un qui aurait
     volé le secret ne peut donc déclencher qu'une relecture de l'état réel.
   - L'identifiant externe de chaque signataire transmis à DocuSeal est
     `<organization_id>.<signer_id>` : le webhook fixe ainsi le contexte RLS de la bonne
     organisation sans requête transversale, puis vérifie que la soumission relue correspond
     bien à la demande enregistrée dans cette organisation.
   - **Idempotence** : l'état relu est appliqué par différence (un signataire déjà signé, une
     demande déjà terminée ne changent plus) ; rejouer le même appel ne fait rien de plus et
     ne republie pas `quotes.quote.signed`. Chaque appel accepté est tracé dans
     `quotes.signature_webhook_log` (organisation, demande, type, résultat).
   - Le HMAC de DocuSeal pourra s'ajouter en plus du secret, sans changer le module, si
     l'édition déployée le fournit (à vérifier par Julien au déploiement).
4. **Devis signé** (dernier signataire) : dans une même transaction, devis « Signé », demande
   terminée, clés des documents archivés (stockage privé `@symbola/files`, lien signé
   temporaire) et publication de `quotes.quote.signed` (outbox, schéma versionné dans
   `packages/contracts`) ; puis l'événement passe à « Confirmé » par
   `eventsService.changeEventStatus` (le worker continu n'étant pas câblé, cet appel direct
   fait foi ; l'auteur du changement est la planner qui a créé le devis), et la planner reçoit
   un e-mail. Un refus d'un signataire passe le devis à « Refusé ».
5. **Base de DocuSeal** : une base `docuseal` et un rôle `docuseal` dédiés **sur le serveur
   PostgreSQL de l'environnement** (jamais un schéma Symbola, aucun accès du rôle `symbola_app`),
   ajoutée à la sauvegarde restic nocturne (`infra/backup/backup.sh`, second `pg_dump`) et à la
   restauration.
6. **Image figée** : `docuseal/docuseal:3.3.2` (publiée le 12/10/2026), dans les composes de
   dev et d'environnement. La page publique de signature (sous-domaine, bloc Caddy, DNS), la
   création du compte administrateur DocuSeal, de la clé d'API et du webhook restent des
   **actions de Julien** sur le VPS (CLAUDE.md §8), décrites dans le runbook de déploiement.
7. **Choix du fournisseur** par `SIGNATURE_PROVIDER` (`fake` par défaut en dev et en test,
   **`docuseal` obligatoire en production**, refus au démarrage sinon).

## Conséquences

- Passer à Documenso ou Yousign = un nouvel adaptateur qui passe la même suite de tests ; le
  module Devis ne change pas.
- Le secret du webhook et la clé d'API sont deux secrets d'environnement de plus, validés au
  démarrage (`packages/env`).
- Chaque appel webhook coûte une requête API à DocuSeal : négligeable au volume d'un
  pilote.
- Le faux fournisseur garde son état en mémoire : un redémarrage du serveur de dev oublie les
  demandes en cours (acceptable hors production, où il est interdit).
- La page de signature porte la marque DocuSeal tant que l'édition Pro n'est pas prise
  (ADR 0006).
