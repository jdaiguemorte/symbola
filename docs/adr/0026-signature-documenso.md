# ADR 0026 — Signature en ligne : Documenso remplace DocuSeal

- Statut : accepté
- Date : 2026-11-03
- Remplace : [0021](0021-signature-docuseal-webhook-et-base.md)
- Amende : [0006](0006-signature-docuseal-derriere-interface.md) (le principe d'une interface `SignatureProvider` reste)

## Contexte

L'ADR 0021 branchait DocuSeal auto-hébergé (édition libre) par `POST /api/submissions/pdf` :
envoyer le PDF du devis et récupérer un lien de signature par signataire. Au premier essai réel
sur le staging (03/11/2026), cet appel a répondu `404`. Vérification dans le code source de
DocuSeal 3.3.2 et de sa branche principale : l'édition libre ne sait créer une soumission qu'à
partir d'un **modèle** préparé dans son interface ; la création à partir d'un PDF (et celle d'un
modèle à partir d'un PDF) n'existe que dans son service en ligne et son édition payante. Or chaque
devis est un PDF différent. L'ADR 0021 avait tenu cet appel pour acquis sans le vérifier sur un
serveur réel : c'est l'erreur que corrige cette décision.

Options examinées avec Julien :

1. **DocuSeal Pro** : aucun changement de code, mais un abonnement, et un tarif auto-hébergé à
   confirmer.
2. **Modifier DocuSeal** (AGPL v3 avec obligation de garder la mention DocuSeal) : autorisé, mais il
   faudrait écrire et maintenir en Ruby la fonction manquante, construire notre image et la
   reporter à chaque mise à jour, sécurité comprise.
3. **Un modèle DocuSeal fixe « Bon pour accord »** : le marié ne signe pas le devis lui-même.
4. **Une signature maison** : exclue (CLAUDE.md § 2.6, valeur probante).
5. **Documenso** auto-hébergé (AGPL v3), déjà cité au cahier des charges.

## Décision

**Documenso**, édition libre, image `documenso/documenso` épinglée (2.21.1), derrière l'interface
`SignatureProvider` inchangée (`modules/quotes/signature/documenso.ts`). Vérifié avant d'écrire
l'adaptateur sur un Documenso réel lancé en local, puis avec l'adaptateur lui-même et un vrai PDF
de devis produit par Symbola :

1. **API v2** (`/api/v2`, en-tête `Authorization: <clé d'API>`), sans SDK :
   - `POST /envelope/create` (multipart : `payload` JSON + `files` = le PDF). Documenso place une
     zone de signature sur chaque balise `{{SIGNATURE, r1}}`, `{{SIGNATURE, r2}}`… du PDF (le PDF
     de devis porte ces balises en blanc dans les cadres « Signataire 1 », « Signataire 2 ») et
     efface la balise. La zone prend la taille du texte de la balise : l'adaptateur l'agrandit
     (`POST /envelope/field/update-many`, au moins 25 % × 5 % de la page).
   - `POST /envelope/distribute` avec `distributionMethod: "NONE"` : Documenso n'envoie **aucun**
     e-mail aux mariés et renvoie le lien de signature de chacun ; Symbola envoie lui-même les liens
     (inchangé depuis l'ADR 0021).
   - `GET /envelope/{id}` pour relire l'état ; `GET /envelope/item/{id}/download?version=signed`
     (PDF scellé, signature PAdES intégrée) et `GET /envelope/{id}/certificate/download`
     (certificat de signature) pour l'archivage.
2. **Correspondance des signataires** : Documenso ne garde pas d'identifiant par destinataire.
   L'identifiant externe de l'enveloppe porte l'organisation puis, dans l'ordre, l'identifiant de
   chaque signataire (`<org>.<signataire1>.<signataire2>`, 255 caractères au plus) ; l'ordre de
   signature des destinataires (1, 2…) suit celui des signataires.
3. **Webhook** : en-tête `X-Documenso-Secret` (nom fixé par Documenso) comparé en temps constant au
   secret partagé ; le corps n'est jamais cru, il donne seulement l'enveloppe à relire (`envelopeId`)
   et l'organisation (identifiant externe). Documenso refuse d'appeler une adresse privée : l'URL est
   l'adresse publique `https://<app>/api/webhooks/signature`.
4. **Rattrapage** : toutes les 10 minutes, Symbola relit chez Documenso les demandes encore en
   attente de chaque organisation (`reconcilePendingSignatures`, `lib/signature-reconciliation.ts`).
   Un webhook perdu ne laisse donc jamais un devis signé en « envoyé » ; rien n'est journalisé quand
   rien ne change.
5. **Base dédiée, fichiers compris** : rôle et base `documenso` créés par le bootstrap (comme pour
   DocuSeal, sans droit pour `symbola_app`) ; ses fichiers restent dans cette base (transport
   « database »), donc rien dans Garage et aucun volume. La sauvegarde nocturne dumpe cette base.
6. **Certificat de scellement** : PKCS#12 généré une fois par Julien (`openssl`), passé en base64
   dans `DOCUMENSO_SIGNING_CERT_BASE64` avec sa phrase secrète, et gardé dans le gestionnaire de
   mots de passe. Certificat auto-signé : signature électronique simple, comme avec DocuSeal ; un
   certificat reconnu (signature avancée) reste possible plus tard sans changer l'adaptateur.
7. **Durcissement** : inscriptions publiques fermées par défaut (ouvertes le temps de créer le
   compte administrateur), télémétrie coupée, aucun port hôte (Caddy sert la page de signature par
   l'alias `symbola-documenso-<environnement>`), profil compose `signature`.

## Conséquences

- Le module Devis, ses écrans, le webhook, l'archivage et le faux fournisseur ne changent pas ; la
  suite de contrat `provider-contract.test.ts` tourne contre le faux fournisseur et contre
  l'adaptateur Documenso (serveur simulé reproduisant les réponses relevées sur un vrai Documenso,
  y compris les positions renvoyées en texte).
- Mise en service sur le VPS : `docs/runbooks/deploiement.md` § Signature. DocuSeal (conteneur,
  base `docuseal`, volume) est arrêté puis supprimé par Julien une fois Documenso validé.
- La page de signature porte la marque Documenso et le nom de l'équipe Documenso (renommée
  « Symbola ») ; afficher le nom de chaque wedding planner demanderait une équipe Documenso par
  organisation, plus tard si besoin.
- Les PDF de devis déjà envoyés en signature avec l'ancienne balise DocuSeal n'ont jamais pu être
  signés (appel en 404) : aucune donnée à migrer.
