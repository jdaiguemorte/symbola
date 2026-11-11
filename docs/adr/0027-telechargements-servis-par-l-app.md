# ADR 0027 — Téléchargements de fichiers privés servis par l'app

- Statut : accepté
- Date : 2026-11-04
- Amende : [0015](0015-garage-remplace-minio-stockage-objet.md) (le stockage Garage, privé, reste inchangé)

## Contexte

Jusqu'ici, ouvrir un fichier privé (document signé et certificat de preuve d'un devis, devis
prestataire joint au budget, export RGPD) redirigeait le navigateur vers un **lien signé à
durée limitée** produit par le client S3 de l'app. Ce lien porte l'adresse que l'app utilise
pour joindre Garage, c'est-à-dire son nom sur le réseau Docker de l'environnement
(`garage:3900`). Au premier essai réel sur le staging (04/11/2026), le navigateur ne pouvait
donc pas l'ouvrir (« serveur introuvable »). Les tests ne l'avaient pas vu : en CI et en local,
app, navigateur et Garage tournent sur la même machine (`localhost:3900`).

Options examinées avec Julien :

1. **Exposer Garage** sur un sous-domaine public (DNS, bloc Caddy, adresse publique pour
   signer les liens) : garde les liens signés, mais rend l'API S3 de Garage joignable depuis
   Internet.
2. **Servir le fichier par l'app** : la route déjà protégée lit le fichier dans Garage et le
   transmet elle-même.

## Décision

**Option 2.** Les routes de téléchargement (`/devis/<id>/signature/<signed|certificate>`,
`/budget/<événement>/devis/<id>`, `/rgpd/exports/<id>/<pdf|archive>`) gardent tous leurs
contrôles (session, organisation, rôle, module souscrit, RLS), puis répondent directement avec le
fichier (`lib/file-response.ts`) :

- `Content-Disposition: attachment` avec un nom de fichier lisible (`D-2026-0001-signe.pdf`,
  `export-rgpd-<id>.zip`…), comme les autres PDF de l'app ;
- `Cache-Control: private, no-store` et `X-Content-Type-Options: nosniff` ;
- type déclaré : celui vérifié par le contenu à l'envoi (devis joint), ou fixé par le module
  (PDF, ZIP).

Les services exposent `getSignatureDocument`, `getBudgetLineAttachmentFile` et
`getPrivacyExportFile` (type `FileDownload` dans `packages/contracts`) à la place des anciennes
fonctions qui rendaient une URL ; un fichier absent du stockage donne la même erreur « introuvable »
qu'une ligne absente (404). `packages/files` lit l'objet (`readPrivateObject`) ;
`getSignedDownloadUrl` ne sert plus qu'au module témoin `hello` du lot 0.

## Conséquences

- Garage n'est joignable que depuis le réseau Docker de l'environnement : aucun DNS, aucun
  bloc Caddy, aucune variable d'adresse publique.
- Le principe « lien signé temporaire » (CLAUDE.md § 3 et § 5) devient « téléchargement par
  l'app, après contrôle des droits » : un lien n'est jamais valable hors session, même quelques
  minutes.
- Le fichier transite par la mémoire de l'app : acceptable pour les tailles en jeu (devis joint
  20 Mo au plus, PDF signés et exports de quelques Mo). Une diffusion en flux reste possible plus
  tard sans changer les routes.
- Tests : les tests d'intégration lisent le fichier par la porte d'entrée du module ; les
  parcours e2e vérifient une réponse `200` directe (aucune redirection), son type et son nom.

## Avenant du 11/11/2026 — Liens de fichiers (lot 25, ARC-11 et DOC-04)

ARC-11 demande des fichiers servis par liens signés de quinze minutes au plus. Ici, aucun lien
vers le stockage n'existe : chaque téléchargement passe par l'app, qui contrôle les droits à
chaque demande. C'est au moins aussi strict ; ARC-11 reste « Divergent » sur la forme, justifié
par cet ADR. Le stockage des fichiers reste sur le VPS pendant le pilote
([ADR 0051](0051-sauvegarde-externe-hetzner.md), § 6). Le partage par lien à durée limitée pour
les tiers (DOC-04 : un lien expiré ne révèle rien, pas même le nom du fichier) passera par les
liens personnels de l'[ADR 0053](0053-acces-des-tiers-par-lien-personnel.md) (lots 26 et 37).
