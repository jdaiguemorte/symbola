# ADR 0015 — Garage remplace MinIO pour le stockage objet

- Statut : accepté
- Date : 2026-10-26

## Contexte

CLAUDE.md (et le cahier des charges) prévoyaient MinIO comme stockage objet
compatible S3 auto-hébergé. Au lot 0 (SOC-08), l'image Docker `minio/minio`
s'est révélée retirée de Docker Hub et de quay.io (`401 UNAUTHORIZED` /
« object not found » sur les deux), suite à un changement de distribution
de MinIO Inc. en 2025. Aucun compte ni jeton d'accès n'est disponible pour
contourner cette restriction, et en construire une image depuis les
sources aurait ajouté un temps de build et une dépendance au dépôt source
de MinIO à chaque déploiement.

## Décision

Garage (<https://garagehq.deuxfleurs.fr>, Deuxfleurs, Apache-2.0) remplace
MinIO comme stockage objet compatible S3 auto-hébergé. Image Docker
officielle `dxflrs/garage`, toujours publique sur Docker Hub. API S3
compatible avec le SDK déjà retenu (`@aws-sdk/client-s3` +
`@aws-sdk/s3-request-presigner`) : aucun changement côté code applicatif
au-delà du nom des variables d'environnement (`MINIO_*` → `S3_*`,
génériques plutôt que liées à un produit précis, pour faciliter un futur
changement de fournisseur).

Mode mono-nœud (`--single-node --default-bucket`) pour le dev et le
socle du MVP (un seul VPS, pas de réplication nécessaire à ce stade).

## Conséquences

Même modèle de sécurité que prévu (stockage privé, liens signés à durée
limitée) : aucune perte de fonctionnalité pour SOC-08. `CLAUDE.md` est mis
à jour (ligne « Fichiers » du tableau de stack). Les secrets internes du
cluster Garage (rpc_secret, jetons admin/metrics) ne protègent qu'un
cluster mono-nœud sans exposition réseau externe ; des valeurs de
développement fixes suffisent et sont documentées comme telles dans
`infra/compose/garage.toml` — SOC-09/SOC-12 généreront des valeurs
propres à la production via le runbook de déploiement, jamais committées.
