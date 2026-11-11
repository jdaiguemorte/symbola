# Rejeu SC-S2 à SC-S6 — Abus sur les comptes, les liens, les fichiers et les envois, lot 24b

- Date : 11/11/2026, en local, par Claude Code : app compilée, base neuve `symbola_lot24`.
- SC-S2 rejoué sur le jeu fictif (`pnpm --filter @symbola/app seed:recette`) ; SC-S2 à SC-S6
  rejoués aussi par la suite d'abus `e2e/sec-36-suite-abus.spec.ts` (ordinateur et 375 px,
  axe-core sur les écrans touchés). SC-S1 : voir `SC-S1.md`.

| Scénario | Ce qui est rejoué | Résultat |
| --- | --- | --- |
| SC-S2 | Hugo (collaborateur de Maison Belkacem) a une session ouverte ; Nadia, titulaire, lui retire l'accès (Paramètres › Équipe, confirmation) ; Hugo rejoue `/events`, puis se reconnecte | Session refusée à la requête suivante (moins d'une seconde) ; reconnexion refusée (« Identifiants invalides. ») ; journal : « Accès d'un collaborateur retiré » et « Connexion refusée · accès retiré » |
| SC-S3 | Lien d'un prestataire hors de sa portée | **À venir** : les liens personnels des prestataires arrivent au lot 26 ; le test est écrit et marqué « à venir » |
| SC-S4 | Lien de marié expiré, puis marié connecté qui ouvre l'espace d'un autre événement | Refus dès l'ouverture du lien, « Demandez une nouvelle invitation à votre planner », aucun formulaire ni nom ; l'autre événement répond « introuvable » (404), rien de révélé |
| SC-S5 | Fichier de test antivirus, puis fichier au type falsifié, déposés sur une fiche prestataire | Refus et message clair (« Format non supporté : PDF ou image uniquement. ») ; aucun fichier gardé. L'analyse antivirale elle-même est prouvée par `packages/files` (SOC-08) |
| SC-S6 | Demandes de lien en rafale pour un compte, puis invitation d'un marié alors que l'organisation a envoyé ses 100 e-mails de l'heure | Limitation de débit (« Réessayez dans 60 minutes ») ; envoi refusé (« Plafond d'envois atteint ») ; bandeau d'alerte à l'accueil et ligne au journal |

Faute de formulaire de contact public, SC-S6 passe par le formulaire « Mot de passe oublié » ; le
piège à robots et la limitation de débit s'appliqueront au formulaire de contact quand il existera.

Résultat : **SC-S2, S4, S5 et S6 passés, sans blocage ; SC-S3 au lot 26.**
