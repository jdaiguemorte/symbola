# ADR 0053 — Accès des tiers par lien personnel

- Statut : accepté (décision Q4 a de Julien du 11/11/2026) ; mise en œuvre au lot 26
- Date : 2026-11-11
- Remplace : [0020](0020-acces-maries-par-evenement.md) (compte client par personne), qui reste
  en vigueur jusqu'au lot 26.
- Exigences : UX-11, POR-01, POR-10, SEC-14, SEC-15, SEC-17, RGP-03, DOC-04 de
  `docs/CAHIER_DES_CHARGES.md`.

## Contexte

Aujourd'hui, un marié reçoit une invitation, crée un compte (`hub.users`, rôle `client`) et
accède à son événement (ADR 0020). Le nouveau cahier des charges veut l'inverse pour les tiers :
le client, le prestataire et l'invité agissent par lien personnel, sans mot de passe ni
inscription (UX-11). Il n'y a pas de données réelles en production (Q15) : aucun compte client
n'est à reprendre.

## Décision

1. **Les tiers n'ont pas de compte.** Client, prestataire et invité reçoivent un lien personnel.
   Les professionnels (planner et son équipe) gardent un compte.
2. **Jeton** (SEC-14) : aléatoire, 128 bits au moins, stocké haché (comme les sessions), lié à un
   contact, un évènement et des droits explicites, révocable. Un jeton est refusé sur un autre
   évènement. Le format `<organisation>.<secret>` de l'ADR 0020 est gardé : l'organisation, non
   secrète, permet la recherche sous RLS ; seul le haché du secret est stocké.
3. **Expiration réglable** (SEC-15). Par défaut : 30 jours après l'évènement pour le client,
   7 jours après pour un prestataire, à la clôture des réponses pour un invité. Un lien expiré
   propose d'en demander un nouveau et ne révèle rien, pas même un nom de fichier (DOC-04).
4. **Code à usage unique** envoyé par e-mail : en option à l'ouverture (POR-01), obligatoire
   avant une action sensible. La liste des actions sensibles est fixée au lot 26.
5. **Le jeton quitte l'adresse** dès l'ouverture (SEC-17) : il est échangé contre un cookie de
   session limité à ce lien, puis la page est rechargée sans jeton. Pages exclues de
   l'indexation, `Referrer-Policy: no-referrer`, jeton jamais écrit dans les journaux.
6. **Rien n'est partagé par défaut** (POR-10) : le planner partage objet par objet, ou par règle.
7. **Plusieurs interlocuteurs** par évènement, aux droits distincts : les deux mariés, un parent
   payeur, un commanditaire (POR-01).
8. **Information des personnes** (RGP-03) sur chaque page publique, au nom du planner.
9. **Reprise** : les comptes `client` et la table `events.event_client_accesses` sont retirés au
   lot 26, par une migration réversible (ADR 0036). Le staging n'a que des données fictives.

## Conséquences

- Aucun mot de passe pour les tiers ; un lien perdu se redemande.
- Le lien devient un secret : envoi, expiration, révocation et journalisation sont à soigner
  (lots 26 et 23).
- Les écrans des mariés sont refaits sur ce modèle au lot 27 (portail client).
