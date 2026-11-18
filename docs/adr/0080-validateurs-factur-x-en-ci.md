# ADR 0080 — Validateurs veraPDF et Mustang en CI, jamais dans l'app

- Statut : accepté (lot 41, décision D4 validée par Julien le 18/11/2026)
- Date : 2026-11-18
- Complète : [0079](0079-factur-x-pdfa3-sans-dependance.md).
- Exigences : FAC-10 ; spécification `docs/lots/lot-41-facturx-conformite.md` (D4) ; SEC-30 à
  SEC-36 (chaîne de contrôle).

## Contexte

Sans validateur de référence, rien ne prouve qu'une plateforme agréée acceptera nos fichiers : nos
propres tests ne contrôlent que ce que nous savons vérifier.

## Décision

1. Un job de CI « Factur-X » produit un fichier de chaque cas (acompte, solde avec acomptes
   déduits, avoirs partiel et total, franchise et assujetti à plusieurs taux, particulier et
   professionnel, essai guidé, arrhes en règlement ; en français et en anglais) à partir de
   données fictives (`apps/symbola/lib/test-fixtures/facturx-cases.ts`,
   `pnpm --filter @symbola/app facturx:samples`), rendus comme à l'émission.
2. **veraPDF 1.30.4** (logiciel libre de la PDF Association), image Docker figée par empreinte :
   chaque fichier doit être PDF/A-3 B.
3. **Mustang 2.26.0** (Apache 2.0, Maven Central), archive vérifiée par son empreinte SHA-256 et
   lancée par Java 21 sur le runner : chaque fichier doit être déclaré valide (PDF/A, schéma XSD et
   règles EN 16931 du profil). Les avertissements (spécification française du flux 2 : adresses
   électroniques de l'annuaire, notes obligatoires entre professionnels sur une facture à un
   particulier) ne font pas échouer le job ; les erreurs, si.
4. Les deux outils ne tournent **qu'en CI et au rejeu local** (Docker), jamais dans l'app ni en
   production ; ils n'entrent pas dans l'image et ne voient que des données fictives.

## Conséquences

- Le job ajoute quelques minutes à la CI ; il s'exécute en parallèle des autres.
- Monter de version un validateur = changer l'empreinte dans `.github/workflows/ci.yml` et
  `docs/conformite/licences.md`, après un rejeu local.
- Le rejeu local suit `docs/recette/SC-11.md` (mêmes commandes Docker).
