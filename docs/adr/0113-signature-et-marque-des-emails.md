# ADR 0113 — La signature de chaque membre et la marque de la planner dans ses e-mails

- Statut : accepté (décisions D5 et D6 de Julien du 22/11/2026, spécification
  `docs/lots/lot-66-envois-et-marque.md`, § 2 et § 3 « 66c » ; maquettes M19 et M20 de
  `docs/maquette/Envois-et-marque.html`).
- Date : 2026-11-22
- Complète : [0072](0072-emails-a-l-image-de-l-organisation.md) (e-mails à l'image de
  l'organisation), [0102](0102-messagerie-adresse-d-expedition-et-journal-des-envois.md) (adresse
  d'expédition), [0110](0110-messages-de-la-relation-prepares-pour-la-planner.md) (messages préparés).
- Exigences : HUB-18, MSG-01 ; paquet 66c.

## Contexte

Depuis le lot 38a, un e-mail de la planner à ses tiers porte son logo, la couleur de ses documents et
ses coordonnées (ADR 0072). Il restait générique : pas de signature, « Envoyé avec Symbola » en pied,
des libellés de bouton imposés (« Ouvrir mon espace », « Ouvrir Symbola »), une police fixe, le seul
nom de l'organisation comme expéditeur, ni code postal ni ville. Julien (22/11) : « les signatures
doivent être assez personnalisables pour ne pas faire un envoi générique de Symbola : la planner a sa
propre marque » ; « que l'expéditeur soit Symbola avec une personnalisation basique ne me choque pas ».

## Décision

1. **Une signature par membre, sur un modèle commun** (D5 a). `hub.member_signatures` (migration
   0209) : nom affiché, fonction, téléphone, site, quatre liens au plus (nom et adresse), photo
   facultative. Chacun la remplit dans **Mon compte › Ma signature**, avec un aperçu en direct composé
   par la même fonction que l'e-mail (`packages/mail/src/signature.ts`). L'organisation choisit les
   éléments affichés (photo, fonction, nom de l'organisation, téléphone, site, liens) dans
   **Paramètres › Modèles d'e-mails › Marque et signature** (`hub.email_branding`). Pas de choix de
   disposition : photo ronde à gauche, nom, deux lignes, liens (une seule mise en page, celle de
   l'ADR 0072 enrichie).
2. **Qui signe.** La personne de la session qui fait le geste (l'auteur des écritures, ADR 0060) ;
   pour un envoi que personne ne déclenche (automatisme, tiers par son lien), la personne choisie dans
   le réglage, sinon la titulaire. Une personne retirée de l'équipe, ou un Comptable, ne signe pas.
   Une personne sans signature (ou sans nom affiché) n'en met aucune : jamais celle d'une autre.
3. **Chacun n'écrit que sa signature**, garanti par l'app (la personne est celle de la session) et par
   la base : politique restrictive sur l'insertion et la modification, lue dans `app.actor_kind` et
   `app.actor_id`. La signature part avec l'accès du membre (retrait par la titulaire), photo comprise.
4. **La photo est contrôlée comme le logo** : PNG ou JPEG lus dans le contenu, 1 Mo au plus,
   antivirus, stockage privé. Servie dans l'app à la personne seule (`/profil/signature/photo`),
   jointe en ligne (`cid:signature@symbola`) aux e-mails qu'elle signe ; comptée avec les images dans
   le relevé de stockage. Une photo remplacée est retirée du stockage (un e-mail parti a la sienne).
5. **« Envoyé avec Symbola » retiré de tous les e-mails de la planner** (D6 a : toutes les offres sont
   payantes). Les e-mails de Symbola gardent sa marque : ceux à texte fixe (`sendSymbolaEmail` : codes,
   invitation, compte) et les avis de Symbola à l'équipe faits de modèles (`TEAM_NOTICE_KINDS` :
   transfert de propriété, nouvel appareil, changement d'identité, récapitulatif, alerte, nouvelle
   demande de contact), qui ne portent pas de signature.
6. **Le libellé du bouton se modifie avec le texte du modèle** (`hub.email_templates.button_label`,
   60 caractères, une ligne ; vide : celui de départ des fichiers de traduction). Le bouton « Ouvrir
   Symbola » ne reste que sur les avis à l'équipe ; chaque e-mail de la planner peut dire « Voir votre
   espace », « Découvrir votre proposition »…
7. **Le pied** reprend l'adresse avec le code postal et la ville (`organization_profiles`, lot 41),
   puis une **ligne libre** facultative (200 caractères).
8. **La police** : quatre familles que les messageries affichent (sans empattement, avec empattement,
   élégante, arrondie), chacune terminée par une police système (`MAIL_FONT_STACKS`,
   `packages/mail/src/layout.ts`). Aucune police téléchargée : une messagerie ne les charge pas.
9. **Le nom affiché de l'expéditeur** est réglable (« Camille — Atelier Lumière ») ; l'adresse reste
   sur le domaine de Symbola (ADR 0102) et les réponses vont à l'adresse de contact. L'envoi depuis le
   domaine de la planner (MSG-04) reste hors du lot.
10. **Messages préparés** (ADR 0110) : le texte préparé reste sans signature ; la fenêtre « Préparer
    l'e-mail » propose « Ajouter ma signature », décochée au départ (la messagerie de la planner a
    souvent la sienne), qui ajoute sa signature en texte à la fin du message.
11. **Les modèles des invités** (`guest_invitation`, `guest_reminder`) deviennent modifiables
    (groupe « Invités », proposé quand les modules Évènements et Invités sont souscrits).

## Conséquences

- Réglages de la marque : titulaire seulement ; une collaboratrice les lit. Valeurs de départ en
  données (`packages/starter-templates/src/email-branding.json` : police, éléments, noms de liens
  proposés en FR et EN).
- Registre RGPD : les champs de `member_signatures` (nom affiché, fonction, téléphone, site, liens,
  photo, compte) et de `email_branding` (nom affiché de l'expéditeur, personne des envois
  automatiques). Export complet : la marque est exportée et reprise (sans la personne des envois
  automatiques) ; les signatures sortent avec l'équipe et, comme elle, ne sont pas reprises.
- Annulation de 0209 refusée tant qu'un réglage, une signature ou un libellé existe.
- Ce qu'un e-mail a déjà emporté (signature, photo) reste dans la messagerie du destinataire.
