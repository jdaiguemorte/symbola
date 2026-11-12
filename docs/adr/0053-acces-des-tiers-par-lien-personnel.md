# ADR 0053 — Accès des tiers par lien personnel

- Statut : accepté (décision Q4 a de Julien du 11/11/2026) ; mis en œuvre au lot 26a (client),
  au lot 26b (prestataire, code à usage unique)
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

## Avenant du lot 26a (12/11/2026)

Décisions du lot 26 validées par Julien le 12/11/2026 (« Oui, comme recommandé »), spécification
`docs/lots/lot-26-liens-personnels.md`.

- **Ouverture par le fragment** (D2) : le lien envoyé est `/lien#<organisation>.<secret>`. Le
  jeton n'est jamais transmis au serveur ni au proxy ; la page le retire de l'adresse et de
  l'historique de l'onglet, puis l'échange (POST) contre une session de lien. Le serveur ne garde
  que le haché SHA-256 du secret (256 bits).
- **Droits** (D3) : rubriques du portail cochées par lien (rétroplanning, programme, options de
  prestataires, budget, devis à signer), budget entier ou par catégories choisies ; deux profils
  de départ (« Marié(e) », « Payeur ») dans `packages/starter-templates/src/link-profiles.json`.
  Une rubrique fermée est refusée par le service, pas seulement masquée.
- **Expiration calculée** (D4) : date choisie, sinon date de l'événement plus 30 jours (client) ou
  7 jours (prestataire), jusqu'à minuit à Paris ; sans date, 180 jours après la création
  (`link-expiry.json`). Un événement perdu ou d'essai n'ouvre aucun lien.
- **Nouveau lien** (D5) : la demande, depuis un lien expiré, est notée sur le lien (fiche,
  « Aujourd'hui ») et la planner reçoit un e-mail ; rien n'est envoyé au demandeur. Renouveler un
  lien expiré le prolonge du délai de son public à partir du jour même.
- **Session de lien** (D7) : cookie `symbola_lien` (HttpOnly, SameSite=Lax, Secure en production),
  30 jours sans visite, jamais au-delà du lien ; coupée quand le lien est retiré ou renouvelé.
- **Comptes des mariés** (D8) : comptes `client`, sessions et invitations supprimés ; la valeur
  `client` quitte le type `hub.role` (migrations 0111 et 0112, annulables sans les données).
- **Remise** (D10) : e-mail, plus « Copier le lien » affiché une seule fois.
- **Journal** : `actor_kind = 'link'` (migration 0110) ; `events.link.created`, `updated`,
  `renewed`, `revoked`, `renewal_requested` et `opened`, sans jeton ni donnée personnelle.
- **Information** (RGP-03) : mention au nom de l'organisation sur chaque page du portail, texte de
  départ à faire relire (`link-privacy-notice.json`), modifiable dans les réglages RGPD.
- **Actions sensibles** (SEC-16, P1, lot 43) : signer, payer, voir le budget détaillé. Le code à
  usage unique avant ces actions arrive avec SEC-16 ; au 26b, le code est seulement proposé en
  option à l'ouverture (POR-01, décision D6).
