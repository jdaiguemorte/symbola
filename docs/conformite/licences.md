# Inventaire des licences (JUR-18)

Généré par `pnpm --filter @symbola/tools-licences inventaire` (lot 40a, ADR 0075) depuis
`pnpm licenses list`, `tools/licences/autorisees.json` et `tools/licences/services.json` : ne pas
le modifier à la main. Le contrôle de la CI (`tools/licences/licences.test.mjs`) refuse une licence
inconnue, une licence à copyleft sans ligne justifiée, et un service sans ligne.

Ce document décrit des faits : la licence de chaque composant et la façon dont Symbola l'emploie.
Il ne tranche aucun point juridique ; les questions pour l'avocat sont à la fin.

## Bibliothèques

366 paquets installés, dont 350 dans les dépendances de l'app livrée (« production ») ; les autres
servent à construire et à tester (« développement »). Les paquets propres à une plateforme
(macOS, Linux) comptent pour un.

| Licence | Type | Production | Développement |
| --- | --- | ---: | ---: |
| MIT | permissive | 242 | 12 |
| Apache-2.0 | permissive | 52 | 1 |
| ISC | permissive | 29 | 0 |
| BSD-2-Clause | permissive | 8 | 0 |
| BSD-3-Clause | permissive | 7 | 1 |
| MPL-2.0 | copyleft | 2 | 2 |
| BlueOak-1.0.0 | permissive | 2 | 0 |
| (MIT OR Apache-2.0) | permissive | 1 | 0 |
| 0BSD | permissive | 1 | 0 |
| Apache-2.0 AND MIT | permissive | 1 | 0 |
| CC-BY-4.0 | permissive | 1 | 0 |
| LGPL-3.0-or-later | copyleft | 1 | 0 |
| MIT-0 | permissive | 1 | 0 |
| Python-2.0 | permissive | 1 | 0 |
| Unlicense | permissive | 1 | 0 |

### Licences à copyleft, et leur usage

| Paquet | Licence | Portée | Usage |
| --- | --- | --- | --- |
| `@axe-core/playwright` | MPL-2.0 | développement | Tests d'accessibilité des parcours de bout en bout (axe-core), employé sans modification ; outil de test, jamais livré avec l'app. |
| `axe-core` | MPL-2.0 | développement | Moteur des tests d'accessibilité, employé sans modification ; outil de test, jamais livré avec l'app. |
| `@img/sharp-libvips-<plateforme>` | LGPL-3.0-or-later | production | Bibliothèque native de traitement d'images (libvips), chargée par sharp pour l'optimisation des images de Next.js ; employée sans modification, telle que publiée. |
| `lightningcss` | MPL-2.0 | production | Transformation du CSS (Tailwind CSS) à la construction de l'app, employée sans modification. |
| `lightningcss-<plateforme>` | MPL-2.0 | production | Binaire natif de lightningcss pour la plateforme de construction, employé sans modification. |

## Services (images Docker)

Images du Compose de production et du socle, et des scripts d'exploitation. Toutes sont
employées telles que publiées.

| Image | Licence | Usage |
| --- | --- | --- |
| `clamav/clamav` | GPL-2.0-only | Antivirus des fichiers déposés : service séparé, appelé par son protocole réseau, sans modification. |
| `documenso/documenso` | AGPL-3.0-only | Signature électronique (ADR 0026) : service séparé, appelé par son API, sans modification. |
| `dxflrs/garage` | AGPL-3.0-only | Stockage des fichiers compatible S3 (ADR 0015, 0051) : service séparé, appelé par son API, sans modification. |
| `louislam/uptime-kuma` | MIT | Sonde de disponibilité, sans modification. |
| `node` | MIT | Image Node.js des scripts d'exploitation (migrations, jeu fictif), sans modification ; elle embarque des paquets Debian sous leurs propres licences. |
| `postgres` | PostgreSQL | Base de données, sans modification. |
| `restic/restic` | BSD-2-Clause | Sauvegardes chiffrées (ADR 0051), sans modification. |
| `svhd/logto` | MPL-2.0 | Fournisseur d'identité (lot 33, ADR 0067) : service séparé, appelé par son API, sans modification. |
| `traefik` | MIT | Proxy d'entrée du socle partagé du VPS, sans modification. |

## Points à faire valider par l'avocat

- **`clamav/clamav`** (GPL-2.0-only) : Service en ligne : obligations éventuelles de la GPL-2.0 pour un service séparé, non modifié et non distribué.
- **`documenso/documenso`** (AGPL-3.0-only) : Réponse 10 de l'avocat : obtenir de l'éditeur une confirmation écrite de cet usage, ou prévoir l'édition Business (démarche à suivre par Julien).
- **`dxflrs/garage`** (AGPL-3.0-only) : Même question que pour Documenso : AGPL-3.0 dans un service en ligne, sans modification, appelé par son API.
- **`svhd/logto`** (MPL-2.0) : La réponse 10 de l'avocat conseillait un fournisseur sous licence Apache ou MIT ; Logto, retenu au lot 33 (ADR 0067), est sous MPL-2.0 : à confirmer.
- **Code de Symbola** : aucun fichier de licence n'accompagne le dépôt public ; le choix revient à
  Julien.
