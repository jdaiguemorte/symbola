# ADR 0069 — Le contact dans le noyau du hub ; une reprise qui traverse trois schémas

- Statut : accepté (lot 36, décisions D1 à D12 validées par Julien le 15/11/2026)
- Date : 2026-11-15
- Complète : [0012](0012-base-unique-schemas-logiques-pour-le-mvp.md) (un schéma par module,
  pas de clé étrangère entre schémas), [0023](0023-rgpd-contrat-par-fiches-et-orchestration.md)
  (RGPD par fiches), [0036](0036-migrations-annulables.md) (migrations annulables),
  [0056](0056-purge-rgpd-automatique-avec-preavis.md) (purge avec préavis),
  [0068](0068-export-complet-contrat-export-v1.md) (format d'export).
- Exigences : CRM-03, DAT-12, UX-02, ARC-03 de `docs/CAHIER_DES_CHARGES.md` ; décision Q17 (a) ;
  spécification `docs/lots/lot-36-contacts.md`.

## Contexte

Le cahier des charges veut qu'une personne n'existe qu'une fois dans Symbola (CRM-03) et
qu'aucune information déjà connue ne soit redemandée (UX-02). Il place le contact dans le noyau
partagé du hub (ARC-03, § 10), où toute entrée nouvelle demande un ADR. Julien a tranché Q17 : une
table de contacts dans le hub.

Avant le lot 36, chaque évènement gardait ses clients et leurs coordonnées dans
`events.event_clients`. Un couple qui revenait pour un second évènement était ressaisi, et deux
évènements pouvaient porter la même adresse e-mail sous deux noms différents.

## Décision

1. **Le contact entre dans le noyau** : `hub.contacts`, sous RLS, avec les champs suivants.
   - Nature : personne, foyer ou entreprise. Les deux dernières prennent vie au lot 36b.
   - Identité : prénom et nom pour une personne, un nom pour les deux autres natures.
   - Coordonnées : e-mail, téléphone, adresse, code postal, ville, pays, et une adresse de
     facturation.
   - Une marque d'essai, l'auteur de la ligne et ses dates.

   Les notes de l'équipe vivent dans `hub.contact_notes`. Elles sont datées, portent leur auteur,
   et seul l'auteur retire la sienne.
2. **Une adresse e-mail n'appartient qu'à un contact de l'organisation** (DAT-12). L'adresse est
   rangée en minuscules, sans espaces, et protégée par un index unique partiel. Un contact peut ne
   pas avoir d'e-mail.

   Une adresse déjà connue, saisie à la création d'un évènement, reprend le contact qui la porte.
   Ailleurs, elle est refusée avec un lien vers ce contact.
3. **Les modules ne gardent que l'identifiant du contact**, sans clé étrangère entre schémas
   (avenant de l'ADR 0012). Ils lisent le contact par le `service.ts` du hub, par lot pour les
   listes.
   - `events.event_clients` devient le lien entre l'évènement, le contact et sa position.
     L'identifiant de contact vide est un client retiré par le RGPD, affiché « [anonymisé] ».
   - `events.event_links` et `quotes.quote_signers` reçoivent l'identifiant du contact.
4. **Les copies figées restent** (D5). Elles se préremplissent depuis le contact, mais modifier le
   contact ne les change pas :
   - signataires d'un devis et acheteurs d'une facture, parce qu'une pièce émise et une preuve de
     signature sont immuables (DAT-04) ;
   - nom et adresse d'envoi d'un lien personnel : ils disent à qui le lien a été envoyé.

   Une adresse de facturation corrigée à l'envoi en signature est gardée sur la fiche si la case,
   cochée par défaut, le reste (D8).
5. **Une seule migration, `0135_lot36a_contacts`, traverse les schémas `hub`, `events` et
   `quotes`** (D6). C'est une exception écrite à la règle « une migration ne touche que le schéma
   de son module » (DAT-09, ADR 0036).

   La migration fait la reprise dans une seule transaction :
   - un contact par client ;
   - deux clients d'une organisation qui partagent une adresse e-mail deviennent un seul contact,
     sauf s'ils sont clients du même évènement : seul le premier garde alors l'adresse ;
   - pour chaque champ, la valeur la plus récente est gardée ;
   - les clients déjà anonymisés ne deviennent pas des contacts ;
   - les liens et les signataires pointent ensuite vers le contact, puis les colonnes de
     coordonnées quittent `event_clients`.

   Son annulation (`drizzle-rollback/0135_lot36a_contacts.sql`) remet les colonnes, remplies
   depuis les contacts, puis retire les tables. Une reprise atomique ne laisse jamais de clients à
   moitié repris, et le déploiement reste une seule étape, application arrêtée.
6. **RGPD** (ADR 0023, ADR 0056) :
   - le hub trouve, exporte et anonymise les fiches `contact` et leurs notes ;
   - le module Évènements trouve ses clients par les contacts que le hub lui désigne ;
   - l'effacement d'un client détache le lien ; le contact n'est anonymisé que s'il n'est plus
     client d'aucun évènement ;
   - un contact sans évènement suit la règle des prospects : trois ans après sa dernière
     modification, avec préavis (D9) ;
   - un essai guidé crée des contacts d'essai, hors des listes, supprimés à la fin de l'essai.
7. **Le format d'export `symbola.export/v1` change sur place** (D10) :
   - les entités `hub/contacts` et `hub/contact_notes` s'ajoutent ;
   - `events/event_clients` perd ses coordonnées ;
   - `events/event_links` et `quotes/quote_signers` gagnent l'identifiant du contact.

   La règle de version de l'ADR 0068 protège des archives livrées, et aucune n'a encore quitté une
   machine de développement (gel des déploiements).

## Conséquences

- **Écart assumé avec CRM-03 : les prestataires** (D12). Le carnet de prestataires reste dans son
  module, avec ses champs, ses filtres, sa carte et ses fichiers. Une personne à la fois cliente
  et prestataire existe donc deux fois. Relier une fiche du carnet à un contact entreprise viendra
  plus tard.
- **La fusion de deux contacts** (deux fiches sans e-mail pour la même personne) n'existe pas
  encore ; elle viendra avec CRM-07.
- **Le déploiement de 0135 demande l'arrêt de l'application** : une image antérieure au lot 36
  lit les colonnes retirées. Le retour arrière passe par l'annulation de 0135 avant de relancer
  l'ancienne image (`docs/runbooks/deploiement.md`).
- **Le module Évènements dépend du hub pour afficher ses clients.** Il le faisait déjà pour
  l'organisation ; une liste d'évènements fait une lecture de plus, par lot.
- **Une table nouvelle du noyau** suit les règles des tables métier : RLS, journal des
  suppressions, registre RGPD, export, tests d'isolation et d'accès Admin.
