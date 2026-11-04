# ADR 0028 — QR code d'activation de la double authentification (`qrcode`)

- Statut : accepté
- Date : 2026-11-04

## Contexte

L'activation de la double authentification (écran `/mfa` de la planner et de l'Admin, espace
sécurité des mariés) n'affichait que le lien `otpauth://…` en texte. Sur le staging (04/11/2026),
Julien a relevé l'absence de QR code : c'est pourtant le geste attendu (scanner avec l'application
d'authentification du téléphone), et recopier un lien long à la main est source d'erreurs.

Générer un QR code demande un encodeur (Reed-Solomon, masques, versions) : en écrire un serait
long et risqué. Aucune brique de la stack (CLAUDE.md § 3) ne le fait.

## Décision

Ajout de **`qrcode` 1.5.4** (MIT, sans dépendance native, la plus utilisée de l'écosystème Node),
dans `apps/symbola` seulement, après accord de Julien :

- le QR code est calculé **côté serveur** (`lib/totp-qr.ts`, `QRCode.create`) : le lien, qui porte
  la clé secrète, ne part vers aucun service externe ;
- la matrice devient un tracé SVG rendu par React (`app/totp-setup.tsx`) : aucun HTML injecté,
  aucune image `data:`, la CSP ne change pas ; `role="img"` et un libellé traduit pour les lecteurs
  d'écran ;
- en repli, la clé secrète est affichée par groupes de 4 caractères (saisie à la main), et le lien
  complet reste disponible dans un bloc dépliable.

## Conséquences

- Une dépendance de plus à suivre (Renovate, OSV-Scanner) ; version épinglée.
- Le paquet `qrcode` n'est importé que côté serveur : rien n'est ajouté au code envoyé au
  navigateur (le composant d'affichage n'importe que des types).
- Tests : unitaires (`lib/totp-qr.test.ts` : un carré par module sombre, clé groupée), parcours
  e2e `auth-flow` et `evt-06` (QR code visible, axe-core).
