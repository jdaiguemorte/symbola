# Recette du lot 66c — la signature et la marque des e-mails (HUB-18, MSG-01 ; D5, D6)

Rejouée en local le 22/11/2026 sur la base `symbola_lot66c` (copie du jeu de recette, migrations
jusqu'à 0209), Mailpit et Garage du socle de dev. Données fictives : « Atelier Lumière », Camille
Morel (maquettes M19 et M20 de `docs/maquette/Envois-et-marque.html`). ADR 0113.

## Les e-mails rendus

Chaque e-mail est composé par l'app (`composeOrganizationEmail`, vraie base), puis photographié en
680 px et en 375 px ; la photo de la signature, jointe en ligne dans l'e-mail (`cid:`), est remise
dans la page pour la capture.

| Capture | Ce qu'elle montre |
|---|---|
| [1 — réglages de départ](lot-66c/1-depart-sans-signature-680.png) ([375 px](lot-66c/1-depart-sans-signature-375.png)) | Police sans empattement, libellé de départ « Ouvrir mon espace », pied avec le code postal et la ville, **sans « Envoyé avec Symbola »** (D6), aucune signature (envoi sans personne désignée). |
| [2 — marque et signature](lot-66c/2-marque-et-signature-680.png) ([375 px](lot-66c/2-marque-et-signature-375.png)) | Police avec empattement, bouton « Voir votre espace » écrit dans le modèle, **signature de Camille** (photo ronde, fonction et organisation, téléphone et site, Instagram et Pinterest), ligne libre « Wedding planner à Lyon depuis 2015 » en pied. Expéditeur affiché : « Camille — Atelier Lumière ». |
| [3 — invitation des invités](lot-66c/3-invitation-police-elegante-680.png) ([375 px](lot-66c/3-invitation-police-elegante-375.png)) | Modèle `guest_invitation` réécrit (désormais modifiable), bouton « Je réponds », police élégante, signature de la titulaire (envoi automatique). |
| [4 — avis de Symbola à l'équipe](lot-66c/4-avis-equipe-marque-symbola-680.png) ([375 px](lot-66c/4-avis-equipe-marque-symbola-375.png)) | Une alerte à l'équipe : un e-mail de Symbola, qui garde « Envoyé avec Symbola » et ne porte pas de signature. |

Version texte de l'e-mail 2, telle que Mailpit la reçoit :

```text
De : Camille — Atelier Lumière

Bonjour Léa,

Votre espace est prêt : vous y retrouverez le programme, les documents et nos échanges.

Voir votre espace
https://symbola.test/lien/abc

À très vite pour la dégustation !

Camille Morel
Wedding planner · Atelier Lumière
06 12 34 56 78 · atelier-lumiere.test
Instagram : https://instagram.com/atelierlumiere
Pinterest : https://pinterest.com/atelierlumiere

--
Atelier Lumière
12 rue des Lilas, 69003 Lyon
contact@atelier-lumiere.test · 04 78 00 00 00
https://atelier-lumiere.test
Wedding planner à Lyon depuis 2015
```

## Les écrans

| Critère (spécification § 3 « 66c ») | Preuve |
|---|---|
| Mon compte › Ma signature : nom affiché, fonction, téléphone, site, quatre liens, photo contrôlée comme le logo, aperçu en direct | `e2e/hub-18-msg-01-signature-et-marque.spec.ts` (ordinateur et 375 px, axe-core) ; `email-branding.integration.test.ts` (photo refusée si ce n'est ni PNG ni JPEG) |
| L'e-mail porte la signature de la personne qui envoie ; un envoi automatique, celle de la titulaire (ou de la personne choisie) | `email-branding.integration.test.ts`, « MSG-01 — Les e-mails de la planner portent sa marque » |
| Un membre ne modifie que sa signature | `email-branding.integration.test.ts` (abus) ; `rollback.integration.test.ts` (politique restrictive de la base, rôle applicatif) |
| Champs personnels au registre RGPD, effacés avec le compte | `privacy.registry.yaml` ; `email-branding.integration.test.ts` (RGP-05) ; retrait d'un accès (`app/parametres/equipe/actions.ts`) |
| Messages préparés : « Ajouter ma signature » en texte | `app/ui/prepare-email-dialog.tsx` ; `email-branding.integration.test.ts` (texte préparé sans signature, signature de la personne connectée) |
| « Envoyé avec Symbola » retiré des e-mails de la planner ; gardé sur ceux de Symbola | `packages/mail/src/layout.test.ts` ; `email-branding.integration.test.ts` (D6) ; `emails.integration.test.ts` |
| Libellé du bouton de chaque modèle ; plus aucun « Ouvrir Symbola » dans un e-mail de la planner | `email-branding.integration.test.ts` ; parcours e2e (essai reçu dans Mailpit) |
| Pied : code postal, ville, ligne libre | captures 1 à 3 ; `email-branding.integration.test.ts` |
| Police : quatre familles, repli système | `packages/mail/src/layout.test.ts` ; capture 3 |
| Nom affiché de l'expéditeur, adresse sur le domaine de Symbola | `email-branding.integration.test.ts` ; parcours e2e |
| Modèles des invités modifiables | `email-branding.integration.test.ts` ; capture 3 |

## Ce qui reste

- Rejeu de Julien sur le staging (SC-02, proposition envoyée à la marque de la planner), après le
  déploiement de la migration 0209.
- Rendu dans les messageries réelles (Gmail, Outlook, Apple Mail) : à regarder sur le staging avec un
  envoi d'essai ; Mailpit ne montre que le HTML reçu.
