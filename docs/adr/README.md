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
