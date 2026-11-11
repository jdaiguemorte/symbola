# Sous-traitants et destinataires des données — Symbola

**Liste datée du 11/11/2026** (lot 25, RGP-13). À tenir à jour à chaque nouveau fournisseur, et
à publier sur le site de Symbola (lot 57). Règle : hébergement et sous-traitants dans l'Union
européenne par défaut ; tout transfert hors de l'Union est listé, encadré et justifié.

La colonne « Vérifié » dit d'où vient l'information. « À vérifier » : à confirmer par Julien sur
la documentation ou le contrat du fournisseur avant la première donnée réelle.

## Sous-traitants qui traitent des données des organisations clientes

| Fournisseur | Rôle | Données personnelles concernées | Lieu | Garantie | Vérifié |
| --- | --- | --- | --- | --- | --- |
| Contabo GmbH (Allemagne) | Serveur unique : application, base, fichiers, staging | Toutes les données des organisations (clients, prestataires, documents) | Luxembourg | Union européenne ; contrat de sous-traitance du fournisseur | Lieu : ancien cahier des charges. Contrat : à vérifier |
| Hetzner Online GmbH (Allemagne) | Sauvegardes nocturnes (ADR 0051) | Les mêmes, **chiffrées avant l'envoi** par restic : le mot de passe reste chez l'éditeur, Hetzner ne peut pas les lire | Helsinki (Finlande) | Union européenne ; contrat de sous-traitance du fournisseur | Lieu : choisi le 11/11/2026. Contrat : à vérifier |
| IONOS SE (Allemagne) | Envoi des e-mails (SMTP) | Adresse du destinataire, contenu des e-mails (invitations, codes, notifications) | À vérifier | Union européenne attendue ; contrat de sous-traitance du fournisseur | À vérifier |
| IGN, Géoplateforme (France) | Géocodage des adresses (`data.geopf.fr`, ADR 0031) | Adresses saisies dans le carnet de prestataires | France | Service public français | Adresse du service : `apps/symbola/modules/vendors/geocoder.ts` |

## Outils de l'éditeur, sans donnée des organisations clientes

| Fournisseur | Rôle | Données | Lieu | Remarque |
| --- | --- | --- | --- | --- |
| GitHub (Microsoft) | Code source, intégration continue, images Docker | Aucune donnée de client : les tests tournent sur des données fictives | États-Unis | Hors Union européenne, justifié par l'absence de donnée de client |
| Let's Encrypt (ISRG) | Certificats HTTPS | Noms de domaine | États-Unis | Aucune donnée personnelle |
| ntfy.sh | Alertes d'exploitation sur le téléphone de l'éditeur (lot 22) | Nom de la sonde et état (« DOWN », « Disque / à 85 % ») | À vérifier | Aucune donnée personnelle par construction |
| Bureau d'enregistrement de `symbola.fr` | Nom de domaine | Données de l'éditeur seulement | À compléter | — |

## Briques hébergées sur le serveur de Symbola (pas de sous-traitant)

PostgreSQL, Garage (fichiers), ClamAV (antivirus : seules ses bases de signatures sont
téléchargées, aucun fichier n'est envoyé), Documenso (signature, ADR 0026), Uptime Kuma, Caddy,
fond de carte servi par l'app (ADR 0031).

## À venir

Chaque choix ajoutera une ligne, avec son ADR : service d'e-mail capable d'envoyer depuis le
domaine du planner (Q18, lots 38 et 55), fournisseur d'identité, hébergé sur le serveur (ADR 0052,
lot 33), prestataire de paiement (Q21, lot 43), plateforme agréée de facturation électronique
(lot 42), suivi des erreurs (Q27, lot 40).
