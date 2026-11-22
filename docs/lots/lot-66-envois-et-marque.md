# Lot 66 — Les envois et la marque de la planner

**Statut** : spécification **validée par Julien le 22/11/2026** (D1 à D6). Maquettes M17 à M20 dans
`docs/maquette/Envois-et-marque.html`.

**Origine** : demandes de Julien du 22/11/2026, après la recette staging (lot 65) :
- « la planner doit pouvoir adapter les modèles et choisir plus finement les paramètres d'envoi, par
  exemple le rappel du jour J qui ne part que la veille ou le matin à 7 h 00 » ;
- « les signatures des e-mails doivent être assez personnalisables pour ne pas faire un envoi
  générique de Symbola : la planner a sa propre marque et sa propre identité visuelle » ;
- « que l'expéditeur soit Symbola avec une personnalisation basique ne me choque pas. Mais le reste
  est plus gênant. »

**Dépend du lot 65** (réglage « qui envoie », messages préparés : lot 65d2, ADR 0110). La branche part
de `lot-65-retours-staging` ; la PR vise main une fois le lot 65 fusionné.

## 1. Ce qui existe (inventaire du 22/11)

| Sujet | Aujourd'hui |
|---|---|
| Textes des modèles | Objet et texte de chaque modèle, FR et EN, aperçu, envoi d'essai, retour au texte de départ (Paramètres › Modèles d'e-mails). **Les deux modèles des invités** (`guest_invitation`, `guest_reminder`) **ne sont pas modifiables**. |
| Délais | Réglables en jours : rappel au payeur (1 à 60 j), relance avant expiration d'une proposition, relances d'impayés (J+3, J+10, J+20), relances des invités (par évènement), rappels de rendez-vous (24 h ou 24 h et 2 h), feuille de route J-30 et J-7 (cases à cocher). |
| Heure d'envoi | **Non réglable**, sauf le récapitulatif du matin (heure par personne). Les autres partent au premier passage horaire entre 9 h et 19 h, **entre 9 h et 9 h 59 selon l'heure de démarrage du serveur**. Les relances automatiques de prospects **n'ont aucune plage horaire** : elles peuvent partir la nuit. |
| Rappel du jour J | **Aucun.** Le dernier envoi aux prestataires est la feuille de route à J-7 ; rien la veille ni le matin, ni aux mariés, ni à l'équipe. |
| Marque | Logo en tête, couleur des documents (bandeau, bouton, liens), coordonnées en pied (sans code postal ni ville), réponses à l'adresse de contact. |
| Encore générique | **Pas de signature** (nom, fonction, téléphone, réseaux) ; **« Envoyé avec Symbola »** toujours en pied ; **libellés des boutons imposés** (« Ouvrir Symbola »…) ; police et mise en page fixes ; nom d'expéditeur = nom de l'organisation. |

## 2. Décisions (réponses de Julien du 22/11 ; recommandation : a)

| Décision | Réponse |
|---|---|
| D1 — Heure d'envoi | **Une heure par automatisme** (a). |
| D2 — Rappel du jour J : qui le reçoit | **Des cibles à cocher, par défaut la planner elle-même** : seule « Vous (la planner) » est cochée au départ ; prestataires retenus, équipe du jour et mariés se cochent au besoin. |
| D3 — Quand | **La veille ou le matin même, une heure par cible** (a, validé le 22/11). |
| D4 — Qui l'envoie | **Symbola, toujours** (a, validé le 22/11). |
| D5 — Signature | **Une par membre, sur un modèle commun de l'organisation** (a, validé le 22/11). |
| D6 — « Envoyé avec Symbola » | **Retiré de tous les e-mails de la planner** (a) : toutes les offres sont payantes, et le domaine de Symbola reste présent sur les e-mails techniques. |

Détail des options :

- **D1 — Heure d'envoi.** (a) une heure **par automatisme**, préremplie par une heure par défaut de
  l'organisation (9 h 00), modifiable ; (b) une seule heure pour toute l'organisation.
- **D2 — Rappel du jour J : qui le reçoit.** Cibles à cocher : **la planner** (cochée au départ),
  prestataires retenus, équipe du jour (membres et renforts), mariés (décochés au départ).
- **D3 — Rappel du jour J : quand.** (a) pour chaque destinataire, **« la veille à » une heure** (18 h 00
  au départ) **ou « le matin même à »** une heure (7 h 00 au départ) ; (b) la veille seulement.
- **D4 — Rappel du jour J : qui l'envoie.** (a) **Symbola, toujours**, comme le programme décalé du jour
  J (Q45) : la veille au soir ou le matin, la planner n'est pas devant son ordinateur ; (b) selon le
  réglage « qui envoie » (préparé par défaut).
- **D5 — Signature.** (a) **une signature par membre de l'équipe** (nom, fonction, téléphone, site,
  liens vers les réseaux, petite photo facultative), sur un modèle commun de l'organisation ;
  l'e-mail porte la signature de la personne qui envoie, ou celle de la titulaire pour un envoi
  automatique ; (b) une seule signature pour l'organisation.
- **D6 — « Envoyé avec Symbola ».** (a) **retiré de tous les e-mails** de la planner ; (b) gardé dans la
  formule de base, retiré dans les formules supérieures ; (c) gardé. **Choix commercial : à Julien.**

## 3. Paquets

### 66a — L'heure d'envoi (HUB-28, CHR-05 ; D1 ; M17)

- Paramètres › Automatisations : chaque automatisme qui envoie un e-mail montre « Envoi à » une heure
  (pas de 15 minutes), préremplie par **« Heure d'envoi par défaut »** de l'organisation (9 h 00).
  Les automatismes concernés : rappel au payeur, relance avant expiration, relances d'impayés, RIB du
  8e jour, rappel des tâches du client, relances des invités, feuille de route, relance du brief,
  relances de prospects, rappel du jour J (66b).
- L'heure s'entend **dans le fuseau de l'évènement** (Europe/Paris pour un envoi sans évènement).
- Les envois partent **à l'heure exacte** (à 5 minutes près), et plus au premier passage horaire : le
  planificateur passe toutes les 5 minutes et envoie ce qui est dû depuis le dernier passage. Un envoi
  manqué (serveur arrêté) part au passage suivant, le jour même ; jamais en double (clé
  d'idempotence actuelle).
- **Correctif** : les relances automatiques de prospects suivent la même heure ; plus aucun envoi la
  nuit.
- Les rappels de rendez-vous gardent leur délai relatif (24 h, 2 h avant) : pas d'heure fixe.
- **Données** : l'heure de chaque automatisme (colonne `send_time` de `hub.automations`, nulle =
  l'heure par défaut) et l'heure par défaut de l'organisation (nouvelle table de réglages du hub).
  Migration à partir de **0206**, réversible, schéma hub seulement.

### 66b — Le rappel du jour J (JRJ-01, HUB-28, HUB-24 ; D2, D3, D4 ; M18)

- Nouvel automatisme **« Rappel du jour J »**, dans Paramètres › Automatisations, avec des cibles à
  cocher (D2) :
  | Cible | Au départ | Contenu |
  |---|---|---|
  | **Vous (la planner)** | **Cochée, la veille à 18 h 00** | Programme du lendemain, contacts du jour, liste de ce qui reste ouvert (contrats non signés, échéances), lien du mode jour J |
  | Prestataires retenus | Décochée (la veille à 18 h 00 si cochée) | Horaires de leur poste, lieu, contact sur place, lien de leur espace (programme à jour, feuille de route) |
  | Équipe du jour (membres et renforts) | Décochée (le matin à 7 h 00 si cochée) | Programme du jour, lien du mode jour J |
  | Mariés (« clients » selon le vocabulaire, HUB-24) | Décochée (la veille à 19 h 00 si cochée) | Mot de la planner, lien de leur espace |
- Chaque ligne : activer, « la veille à » ou « le matin même à » une heure, modèle à adapter (lien vers
  Paramètres › Modèles d'e-mails). Quatre nouveaux modèles, FR et EN, avec variables (heure d'arrivée,
  lieu, contact sur place, lien).
- Sur la fiche d'un évènement (rubrique Jour J), le rappel peut être **coupé pour cet évènement** ou
  son heure changée.
- Ne part pas pour un évènement annulé, reporté, d'essai, ou dont la date est inconnue ; ne part
  qu'une fois par destinataire et par évènement ; un prestataire sans lien d'espace reçoit le message
  sans lien.
- **Envoyé par Symbola** (D4 a), comme le programme décalé du jour J : modèles rangés côté
  techniques dans `email-senders.json`.
- Journal des envois (MSG-05) et fil d'activité de l'évènement.

### 66c — La signature et la marque des e-mails (HUB-18, MSG-01 ; D5, D6 ; M19, M20)

- **Signature** (D5 a) : Paramètres › E-mails › **Signature**. Un modèle commun de l'organisation
  (disposition, éléments affichés) ; chaque membre remplit la sienne dans « Mon compte » : nom
  affiché, fonction, téléphone, site, jusqu'à quatre liens (Instagram, Facebook, Pinterest, LinkedIn,
  site de mariage…), photo facultative (contrôlée comme le logo). Aperçu en direct.
- L'e-mail porte la signature de la personne qui l'envoie ; un envoi automatique porte celle de la
  titulaire (ou d'une personne choisie dans le réglage). Les **messages préparés** (lot 65d) reprennent
  la signature **en texte**, à la fin du message, si la planner coche « Ajouter ma signature » (sa
  messagerie a souvent déjà la sienne).
- **Boutons** : le libellé du bouton de chaque modèle se modifie avec le texte (« Voir votre
  espace », « Découvrir votre proposition »…) ; plus aucun « Ouvrir Symbola » dans un e-mail de la
  planner.
- **Pied** : code postal et ville ajoutés ; une ligne libre facultative (« Wedding planner à Lyon
  depuis 2015 », mentions légales courtes).
- **Police** : au choix parmi quatre familles compatibles avec les messageries (sans empattement,
  avec empattement, élégante, arrondie), appliquée aux titres et au texte ; repli sur une police
  système.
- **« Envoyé avec Symbola »** : **retiré de tous les e-mails de la planner** (D6). Les e-mails propres à
  Symbola (compte, sécurité, codes de connexion) gardent la marque de Symbola.
- **Expéditeur** : inchangé (adresse sur le domaine de Symbola, ADR 0102) ; le **nom affiché**
  devient réglable (« Camille — Atelier Lumière » au lieu du seul nom de l'organisation). L'envoi
  depuis le domaine de la planner (MSG-04) reste hors du lot.
- **Modèles des invités** : `guest_invitation` et `guest_reminder` deviennent modifiables (Paramètres
  › Modèles d'e-mails, groupe Invités).
- **Données** : `hub.email_branding` (police, ligne libre, nom affiché),
  `hub.member_signatures` (par membre ; champs personnels au registre RGPD, effacés avec le compte).
  Libellé du bouton dans les modèles existants (colonne ajoutée). Migrations à la suite de 66a.

## 4. Hors périmètre

- Envoi depuis le domaine de la planner (MSG-04, réglage SPF/DKIM) : écarté (Julien, 22/11).
- Éditeur visuel libre d'e-mail (blocs, images dans le texte) : non ; la mise en page reste celle de
  l'ADR 0072, enrichie de la signature et de la police.
- SMS (MSG-06).

## 5. ADR et questions

- **ADR 0112** : heure d'envoi par automatisme et planificateur à l'heure exacte.
- **ADR 0113** : signature et marque des e-mails (complète l'ADR 0072 ; D5, D6).
- Le rappel du jour J envoyé par Symbola (D4) complète l'exception de l'ADR 0110.
- **Q46** dans `docs/QUESTIONS.md` : D1 à D6, réponses de Julien (D1, D2, D6 le 22/11).

## 6. Tests et rejeu

- Tests d'abord ; `describe` à l'identifiant (HUB-28, JRJ-01, HUB-18, MSG-01), un `it` par critère.
- **Horloge simulée** : envoi à 6 h 59 (non), 7 h 00 (oui), passage suivant (pas de doublon) ; la
  veille à 18 h 00 ; passage à l'heure d'été et d'hiver (l'heure locale reste 7 h 00) ; évènement dans
  un autre fuseau ; serveur arrêté de 6 h à 8 h (part à 8 h, le jour même).
- Tests d'isolation pour les nouvelles tables et routes ; un membre ne modifie que sa signature.
- Rendu des e-mails : signature, police, pied, sans « Envoyé avec Symbola » selon D6 ; captures dans
  la PR.
- Playwright en ordinateur et en 375 px, axe-core sur les écrans de réglage.
- Rejeu : SC-08 (jour J : rappel de la veille et du matin), SC-02 (proposition envoyée à la marque de
  la planner).
