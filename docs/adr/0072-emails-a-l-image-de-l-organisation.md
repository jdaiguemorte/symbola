# ADR 0072 — Les e-mails à l'image de l'organisation, des modèles à variables et le garde-fou d'envoi groupé

- Statut : accepté (lot 38, décisions D1 à D12 validées par Julien le 16/11/2026)
- Date : 2026-11-16
- Complète : [0011](0011-monolithe-modulaire-pour-le-mvp.md) (modules et `service.ts`),
  [0046](0046-documents-a-son-image.md) (couleur des documents),
  [0053](0053-acces-des-tiers-par-lien-personnel.md) (tiers par lien personnel),
  [0071](0071-programme-diffuse-et-releve-de-stockage.md) (programme diffusé par versions).
- Exigences : MSG-01, MSG-02, HUB-18 (e-mails) de `docs/CAHIER_DES_CHARGES.md` ; spécification
  `docs/lots/lot-38-emails.md` (partie 38a). La partie 38b (modèles de messages, flux de
  calendrier) complétera cet ADR.

## Contexte

Les e-mails que Symbola envoyait au nom de la planner étaient du texte brut, écrit en dur dans les
services, signé « L'équipe Symbola ». Rien ne disait qu'ils venaient de son entreprise ; elle ne
pouvait ni les relire, ni les adapter, ni s'en envoyer un essai. Un envoi à plusieurs signataires
partait sans écran de contrôle. MSG-01 veut des e-mails à variables, aux couleurs de
l'organisation, avec aperçu et envoi test, et aucun e-mail avec une variable vide ; MSG-02 veut le
nombre et la liste des destinataires, et une confirmation explicite ; HUB-18 veut le logo, les
couleurs et la signature de l'organisation.

## Décision

### Le service d'e-mail (D2)

1. **Le service actuel reste**, derrière `packages/mail` (SMTP : Mailpit en dev, IONOS en
   production). Aucun sous-traitant nouveau. Le nom de l'organisation est le nom affiché de
   l'expéditeur ; l'adresse reste celle de Symbola (`SMTP_FROM`) ; les réponses vont à son
   adresse de contact (à défaut, celle de la titulaire). L'envoi depuis le domaine de la planner
   et le choix d'un service à plusieurs domaines restent au lot 55 (MSG-04, Q18).

### Des modèles à variables (MSG-01 ; D3, D5, D6)

2. **Dix e-mails deviennent des modèles de l'organisation** (D3) : liens du client et du
   prestataire (créés, renouvelés), rappel des tâches, demandes de signature (devis, contrat),
   commande d'abord, exemplaire signé, nouvelle version du programme.
   - `hub.email_templates` garde, sous RLS, les seuls modèles réécrits (nature, langue, objet,
     texte) ; un modèle absent vaut son texte de départ, un fichier de données traduisible
     (`packages/starter-templates/src/email-templates.json`). « Revenir au texte de départ »
     supprime la ligne.
   - Chaque modèle existe en français et en anglais (D6) ; la langue du destinataire choisit
     (celle de son lien, celle du signataire).
3. **Des variables fixes par modèle** (D5), écrites en français ou en anglais (`{{prénom}}`,
   `{{first_name}}`…). Une variable inconnue, ou étrangère au modèle, est refusée à
   l'enregistrement ; une variable indispensable (le lien d'un e-mail de lien ou de signature,
   les tâches d'un rappel, la version du programme) ne peut pas manquer.
4. **Aucun e-mail avec une variable vide** : le rendu nomme chaque variable employée sans valeur,
   et l'e-mail ne part pas (`EmailVariableMissingError`, avant la réservation dans le plafond
   d'envois).
   - Un geste qu'on ne défait pas (créer ou renouveler un lien, demander une signature) vérifie
     d'abord que son e-mail pourra partir : le lien n'est pas créé, la demande n'est pas
     enregistrée, et la planner lit quelle variable manque.
   - Un envoi automatique (rappel des tâches) arrêté est porté au journal
     (`hub.mail.variable_missing`, sans adresse) et signalé dans « Aujourd'hui » pendant 24 heures,
     avec le chemin vers le modèle.
5. **Les autres e-mails gardent un texte de Symbola** : code d'un lien, demande de nouveau lien,
   devis signé, export prêt, invitation dans l'équipe, lien de connexion, e-mails de la console.
   Leurs textes quittent les services pour les fichiers de traduction ; ils prennent la même mise
   en page, à l'image de Symbola.

### À l'image de l'organisation (MSG-01, HUB-18 ; D4, D7)

6. **Un e-mail HTML et sa version texte** (D4), écrits par `packages/mail/src/layout.ts` :
   tableaux et styles en ligne, tout texte échappé, seules les adresses http(s) deviennent des
   liens. En tête, le logo de l'organisation, joint à l'e-mail en ligne (`cid:`, sans adresse
   publique), ou son nom ; la couleur de ses documents (ADR 0046, graphite si aucune) pour le
   bandeau et le bouton ; en pied, ses coordonnées (nom, adresse, e-mail, téléphone, site) et
   « Envoyé avec Symbola ». Un paragraphe fait du seul lien devient un bouton (« Ouvrir mon
   espace », « Signer en ligne »).
7. **Aperçu et essai** (D7) : l'écran du modèle (Paramètres › Modèles d'e-mails) montre l'e-mail
   tel qu'il partira, avec des données fictives ; le logo y est servi par l'app. « M'envoyer un
   essai » l'envoie à la personne connectée seulement, marqué « Essai », compté dans le plafond
   d'envois ; jamais à une adresse saisie.

### Le garde-fou d'envoi groupé (MSG-02 ; D8)

8. **Un écran commun** (`app/recipients-guard.tsx`) pour tout envoi décidé par l'équipe vers
   plus d'une personne : le nombre, la liste (nom et adresse), un bouton « Envoyer à N
   personnes ».
9. **Le serveur décide** : le service calcule la liste des destinataires et son empreinte
   (SHA-256 des adresses en minuscules, triées, et des noms). Sans empreinte, ou avec celle d'une
   autre liste (une personne ajoutée, retirée ou remplacée depuis l'écran), il refuse
   (`RecipientsNotConfirmedError`) et renvoie la nouvelle liste à revoir. L'action vérifie avant
   tout geste qu'on ne défait pas (l'envoi d'un brouillon fige sa version). Un envoi à une seule
   personne n'a pas d'écran ; les envois automatiques vont à une personne à la fois.
10. **Envois concernés** : demande de signature d'un devis (avec ou sans contrat), d'un contrat
    seul, e-mail d'une version du programme ; au 38b, un message depuis un modèle à plusieurs
    destinataires.

### Prévenir d'une nouvelle version du programme (D9 ; D11 du lot 37)

11. **« Prévenir par e-mail »** après une diffusion, proposé et non automatique : la dernière
    version part aux liens actifs des clients qui ont la rubrique Programme et à ceux des
    prestataires dont le poste existe, par le garde-fou.
    - Chacun reçoit son programme en PDF, dans sa langue : la version des clients, ou la vue de son
      poste pour un prestataire (ses séquences en entier, le déroulé en titres et horaires) ; ni
      note interne, ni séquence détaillée d'un autre.
    - Le lien personnel ne se renvoie pas : Symbola n'en garde que l'empreinte (ADR 0053) ;
      l'e-mail invite à ouvrir l'espace avec le lien déjà reçu.
    - La version ne part qu'une fois : elle est réservée avant le premier envoi (un double clic
      n'envoie rien de plus), puis note la date et le nombre d'e-mails partis
      (`program_versions.notified_at`, `notified_count`, seules colonnes que le rôle de l'app peut
      modifier ; le contenu reste figé). Si aucun e-mail n'a pu partir, la réservation est levée ;
      un plafond atteint en cours d'envoi arrête l'envoi et la planner lit combien n'ont pas
      pu partir.

## Conséquences

- Migrations 0141 (`events` : date et nombre d'envoi d'une version, droit `UPDATE` sur ces deux
  colonnes seulement) et 0142 (`hub` : `email_templates`), une par schéma (DAT-09), chacune avec
  son annulation.
- Les modèles réécrits entrent dans l'export complet (`email_templates`, format v1) ; la date et
  le nombre d'envoi d'une version aussi. Le texte d'un modèle est celui de l'entreprise, pas une
  donnée d'un tiers : il n'entre pas dans le registre RGPD.
- Aucun sous-traitant ne change (`docs/conformite/sous-traitants.md` inchangé).
- Les tests qui demandent une signature à plusieurs signataires confirment la liste comme
  l'écran le ferait (`lib/test-fixtures/recipients.ts`) ; le contrôle du service reste entier.
- Le journal d'activité nomme le rappel arrêté (« E-mail automatique non envoyé : variable du
  modèle sans valeur »), sans adresse.
