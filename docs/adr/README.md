# Décisions d'architecture (ADR)

Un fichier par décision structurante, numéroté. Pour changer une décision : nouvel ADR qui remplace l'ancien (statut « remplacé par … »), jamais de réécriture silencieuse.

- [0001 — Monorepo pnpm + Turborepo](0001-monorepo-pnpm-turborepo.md)
- [0002 — TypeScript et une app Next.js par module](0002-typescript-nextjs-par-app.md) — *remplacé par 0011 pour le MVP*
- [0003 — PostgreSQL : une base par app et Row-Level Security](0003-postgresql-une-base-par-app-rls.md) — *remplacé par 0012 pour le MVP*
- [0004 — Identité : Zitadel (OIDC)](0004-identite-zitadel-oidc.md) — *remplacé par 0013 pour le MVP*
- [0005 — Bus d'événements : NATS JetStream](0005-bus-evenements-nats.md) — *remplacé par 0014 pour le MVP*
- [0006 — Signature électronique : DocuSeal derrière une interface](0006-signature-docuseal-derriere-interface.md)
- [0007 — Aucune donnée métier codée en dur](0007-aucune-donnee-metier-en-dur.md)
- [0008 — Données de démonstration isolées et éphémères](0008-donnees-demo-isolees.md)
- [0009 — Déploiement : Docker Compose et Traefik](0009-deploiement-docker-compose-traefik.md) — *reverse-proxy remplacé par 0018*
- [0010 — Facturation conforme](0010-facturation-conforme.md)
- [0011 — Une seule app Next.js, modules internes](0011-monolithe-modulaire-pour-le-mvp.md)
- [0012 — Une seule base PostgreSQL, schémas logiques par module](0012-base-unique-schemas-logiques-pour-le-mvp.md)
- [0013 — Authentification maison derrière `packages/auth`](0013-auth-maison-pour-le-mvp.md)
- [0014 — Table d'événements internes, pas de bus séparé](0014-evenements-internes-pour-le-mvp.md)
- [0015 — Garage remplace MinIO pour le stockage objet](0015-garage-remplace-minio-stockage-objet.md)
- [0016 — Isolation réseau staging ↔ production sur le VPS unique](0016-isolation-reseau-staging-production.md)
- [0017 — Empreinte carbone numérique (brique transverse)](0017-empreinte-carbone-numerique.md)
- [0018 — Caddy partagé remplace Traefik comme reverse-proxy](0018-caddy-remplace-traefik-proxy-partage.md)
- [0019 — Génération des PDF avec @react-pdf/renderer](0019-generation-pdf-react-pdf.md)
- [0020 — Accès des mariés : rôle client et accès par événement](0020-acces-maries-par-evenement.md)
- [0021 — Signature en ligne : adaptateur DocuSeal, webhook et base dédiée](0021-signature-docuseal-webhook-et-base.md)
- [0022 — Import : lecteur `.xlsx` sans dépendance et orchestration par le hub](0022-import-lecteur-xlsx-et-orchestration.md)
- [0023 — RGPD : contrat `privacy/v1` révisé (fiches désignées) et orchestration par le hub](0023-rgpd-contrat-par-fiches-et-orchestration.md)
- [0024 — RGPD : purge mensuelle et fin de conservation des factures](0024-rgpd-purge-mensuelle-et-fin-de-conservation-des-factures.md)
- [0025 — Charte graphique et socle visuel (Tailwind CSS, structure d'écran)](0025-charte-graphique-et-socle-visuel.md)
- [0026 — Signature en ligne : Documenso remplace DocuSeal](0026-signature-documenso.md)
- [0027 — Téléchargements de fichiers privés servis par l'app](0027-telechargements-servis-par-l-app.md)
- [0028 — QR code d'activation de la double authentification (`qrcode`)](0028-qr-code-double-authentification.md)
- [0029 — Assistance de l'Admin, mot de passe oublié et statistiques d'usage](0029-assistance-admin-et-statistiques-d-usage.md)
- [0030 — Une aide qui forme et une recherche globale](0030-aide-qui-forme-et-recherche-globale.md)
- [0031 — Prestataires consultés, carnet de prestataires et carte](0031-prestataires-carnet-et-carte.md)
- [0032 — « Budget » remplace les postes prestataires](0032-budget-remplace-les-postes.md)
- [0033 — Refonte UX : panneaux latéraux, aide par repères, captures réelles](0033-refonte-ux-panneaux-et-aide-par-reperes.md)
