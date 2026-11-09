# ADR 0047 — Une demande RGPD, un dossier ; les documents dans l'accompagnement

- Statut : accepté
- Date : 2026-11-09
- Précise : les lots 9 et 12 (RGPD-01 à RGPD-05 : recherche, export, oubli, suivi des demandes,
  purge), [0039](0039-aide-un-seul-bouton-et-tiroir.md) (aide), l'assistant de démarrage
  (HUB-13) et [0046](0046-documents-a-son-image.md) (devis et factures à son image)
- Décisions de Julien du 09/11/2026 : maquette et décisions A à G du lot 18
  (`docs/lots/lot-18-retours-recette.md`), « Oui, je valide ».

## Contexte

En recette du lot 17, Julien a trouvé la rubrique RGPD « dans une sorte de file ou un
tunnel » : il est « tombé par hasard » sur le traitement d'une demande d'oubli. La rubrique
doit « faciliter le traitement des demandes de ce type et éviter qu'elles deviennent un
casse-tête opérationnel en plus d'être réglementaire ».

Jusqu'ici, la demande (RGPD-04), la recherche (RGPD-01), l'export (RGPD-02) et l'oubli
(RGPD-03) étaient quatre écrans chaînés. Un export pouvait partir sans demande ; la fin d'un
effacement clôturait la demande sans que la réponse à la personne soit envoyée ; rien ne disait
où en était une demande.

Julien a aussi demandé que la personnalisation des devis et factures (lot 17) passe par
« un tutoriel ou l'onboarding : c'est structurant ».

## Décision

### Le dossier d'une demande (RGPD-07)

- **Onglets** (décision A) : Demandes (`/rgpd`), Rechercher une personne (`/rgpd/recherche`),
  Purge mensuelle, Réglages. `/rgpd/demandes` redirige vers `/rgpd`.
- **Cinq étapes** pour chaque demande (`/rgpd/demandes/<id>`) : 1 enregistrée, 2 données
  retrouvées (recherche déjà remplie avec la personne), 3 action, 4 réponse à la personne,
  5 clôture. L'échéance légale reste en tête ; un journal date chaque jalon.
- **L'action dépend du type de demande** :
  - oubli : effacement (RGPD-03) ;
  - accès et portabilité : export (RGPD-02) ;
  - rectification et opposition : faites à la main dans l'app, puis marquées faites.
- **L'état des étapes se déduit des traces existantes** (exécution d'oubli, exports rattachés,
  dates de la demande), par une fonction pure testée (`caseSteps`). Il n'y a pas de colonne
  « étape » à tenir à jour.
- **Un export ou un effacement part toujours d'une demande** (décision B). La recherche seule
  sert à consulter et propose de créer la demande. L'export exige désormais un `requestId`.
- **Clôture** (décision C) : seulement quand l'action est faite et que la réponse est marquée
  « envoyée ». La fin d'un effacement ne clôt plus la demande. Le serveur refuse aussi une
  réponse marquée envoyée avant l'action (`action_missing`), et une clôture sans réponse
  (`response_missing`).
- **Modèles de réponse** : celui de l'oubli reste construit avec la preuve d'effacement
  (données conservées et motif légal). Les autres types ont un modèle de départ traduisible
  (`packages/starter-templates/src/privacy-request-responses.json`, CLAUDE.md §2.5), à relire
  par la titulaire et à faire valider par un juriste avant l'ouverture SaaS. Un bouton copie
  l'objet et le texte : Symbola n'envoie pas l'e-mail.
- **L'étape affichée est toujours dans l'adresse** (`?etape=`). Sans étape, la page redirige
  vers l'étape en cours. Une action qui recharge la page (export, prolongation) ne fait donc
  pas sauter le dossier à une autre étape.
- **Compteur au menu** (décision D) : le nombre de demandes en alerte (échéance proche ou
  dépassée) s'affiche, pour la titulaire, sur Paramètres et Données personnelles. Il est
  masqué aux lecteurs d'écran, qui ont déjà l'alerte du tableau de bord.

### Données

Migration 0082 (annulable) : `hub.privacy_requests.action_done_at` et `response_sent_at`
(`timestamptz`, nulles). Aucune nouvelle table : l'effacement et les exports étaient déjà
rattachés à la demande. Les dossiers vivent dans le module hub
(`modules/hub/privacy-cases.ts`), exposés par `service.ts`, sous RLS.

### Les documents dans l'accompagnement (AIDE-13)

- **Assistant de démarrage** (décision E) : une étape facultative « Vos documents » (logo et
  couleur) en 4ᵉ position. L'assistant passe à 7 étapes ; « Plus tard » la saute. La même
  migration 0082 décale d'un rang la progression enregistrée des organisations déjà à
  l'étape 4 ou au-delà (`setup_step + 1`), pour qu'aucune ne revienne en arrière ni ne saute
  une étape.
- **Tutoriel** (décision F) : « Personnaliser vos devis et factures », 4 minutes, sur l'écran
  Documents (`/devis/parametres/documents`).
- **Conseillé ensuite** (décision G) : ce tutoriel passe en tête du parcours d'activité, y
  compris pour les organisations qui ont déjà fini l'assistant.

## Conséquences

- Annuler 0082 (`docs/runbooks/restauration.md`, § 4 bis) supprime les dates d'action et de
  réponse saisies depuis. Cela rend aussi son rang d'avant à la progression de l'assistant
  (`setup_step - 1` à partir de 5).
- Une demande close garde le nom ou la description de la personne (`person_label`) comme
  preuve de traitement pendant la prescription (référentiel CNIL, cahier des charges § 6). Les
  données des modules, elles, sont effacées ou anonymisées. **Manque connu** : le remplacement
  de `person_label` par « [anonymisé] » en fin de conservation, prévu au registre, n'est pas
  encore fait par la purge mensuelle. À traiter en suite du lot 18. D'ici là, mieux vaut ne
  saisir que le nom de la personne, sans e-mail ni téléphone.
- Les captures d'aide des écrans RGPD et du démarrage sont à régénérer
  (`pnpm --filter @symbola/app help:captures`).
- Hors périmètre : envoi de la réponse par Symbola, pièces jointes reçues de la personne,
  vérification d'identité outillée.
