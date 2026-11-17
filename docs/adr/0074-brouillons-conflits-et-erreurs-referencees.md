# ADR 0074 — Brouillons repris sur tout appareil, enregistrement automatique sans écrasement, erreurs référencées

- Statut : accepté (lot 39, décisions D7 à D10 validées par Julien le 16/11/2026)
- Date : 2026-11-17
- Complète : [0011](0011-monolithe-modulaire-pour-le-mvp.md) (modules et `service.ts`),
  [0073](0073-suppression-logique-et-corbeille.md) (corbeille et purge horaire),
  [0064](0064-jour-j-hors-ligne.md) (copie du jour J sur l'appareil).
- Exigences : UX-09, NFR-16 et UX-10 de `docs/CAHIER_DES_CHARGES.md` ; spécification
  `docs/lots/lot-39-saisie-sure.md` (partie 39b) ; scénario SC-01 étape 7.

## Contexte

Une saisie se perdait si l'onglet se fermait ou si le réseau tombait ; deux personnes qui
modifiaient la même fiche s'écrasaient sans le savoir ; une erreur du serveur montrait la page
d'erreur de Next.js et vidait le formulaire. UX-09 veut un enregistrement automatique, un brouillon
restauré après fermeture et un conflit signalé, jamais écrasé en silence ; NFR-16 ni page blanche,
ni message technique, la saisie gardée et une référence retrouvable dans les journaux ; SC-01 que
Camille ferme l'onglet, rouvre sur son téléphone et retrouve tout.

## Décision

### Brouillons côté serveur (D7)

1. Une table `hub.form_drafts` (migration 0148) garde, par organisation, personne et formulaire
   (« event-first », « contact-note:<id> »…), le contenu en cours d'un formulaire : des textes, bornés
   (60 champs, 60 Ko). Table technique (ni auteur ni journal : chaque pause de frappe la réécrit) ; la
   base garantit l'organisation (RLS), l'app la personne (celle de la session).
2. Le composant `DraftKeeper`, posé dans un formulaire, envoie la saisie à chaque pause de frappe,
   propose de reprendre un brouillon retrouvé (« Brouillon du 17 novembre à 10:12 retrouvé »), remet
   le texte après un refus, et s'efface avec le brouillon quand le formulaire est enregistré (l'action
   l'efface aussi côté serveur). Les champs cachés, mots de passe et fichiers ne sont jamais gardés.
3. Un brouillon est une donnée de la personne : déclaré au registre (contenu libre), trouvé et effacé
   par une demande RGPD, exclu de l'export complet (temporaire), purgé 30 jours après la dernière
   frappe par la tâche horaire de la corbeille.

### Enregistrement automatique sans écrasement (D7, D8)

4. Une fiche existante s'enregistre toute seule (`AutoSaveForm`), à la pause de frappe ou en quittant
   un champ, par un appel direct à l'action (pas l'action du formulaire : React viderait les champs
   pendant la frappe). Chaque envoi porte la version de la fiche (date de dernière modification) et
   les valeurs de départ.
5. Si la fiche a changé entre-temps, le serveur fusionne champ par champ (`lib/autosave.ts`) : un champ
   non touché prend la valeur enregistrée, un champ touché d'un seul côté garde la sienne, un champ
   changé des deux côtés différemment est un conflit. Rien n'est écrit ; l'écran montre les deux
   valeurs et l'auteur, et la personne choisit.

### Erreurs référencées et coupure réseau (D9, D10)

6. Une référence courte (huit caractères de Crockford, « 7KQ2-M9XD ») est tirée du condensé que Next.js
   attache à l'erreur : la page d'erreur (`app/error.tsx`, `app/global-error.tsx`) l'affiche, et
   `onRequestError` (`instrumentation.ts`) la note au journal du serveur avec la route et le nom de
   l'erreur, jamais son message (SEC-20).
7. Une action de formulaire qui échoue sans raison prévue rend au formulaire un message avec sa
   référence (`lib/action-errors.ts`) au lieu de casser la page ; la saisie reste.
8. Sans réseau, un bandeau l'annonce ; un envoi n'a pas lieu (la saisie reste, gardée sur l'appareil)
   et part au retour de la connexion. Le reste de l'app ne travaille pas hors ligne (seul le jour J,
   ADR 0064).

## Conséquences

- Le service de suivi des erreurs (Q27, NFR-27) reste au lot 40 : il reprendra la même référence.
- Les brouillons sont posés sur les formulaires de création des parcours P0 (évènement, contact,
  note, ligne de devis), le prestataire et les modèles de messages ; l'enregistrement automatique sur
  les fiches contact et évènement. Les autres formulaires les reçoivent au fil des lots : un composant
  à poser, une ligne à ajouter à l'action.
- Une copie de la saisie peut rester dans le navigateur tant qu'elle n'a pas pu partir ; elle
  s'efface quand le brouillon est enregistré ou effacé (registre).

## Avenant du 17/11/2026 — Squelettes d'écran sans `loading.tsx` (lot 39c, UX-15)

La spécification du lot prévoyait des `loading.tsx` (squelettes rendus par Next.js). Avec
Next 15.5, une limite de chargement placée au-dessus d'une page bloque la navigation qui suit une
action serveur terminée par `redirect()` : le formulaire reste « en cours » et la page visée ne
s'affiche jamais (création d'un évènement, essai guidé, corbeille… ; constaté sur tout le parcours
bout en bout, qui repasse sans le fichier). Le routeur réutilise la réponse de l'action comme
préchargement partiel et attend une suite qui ne vient pas.

Décision : aucun `loading.tsx`. Le squelette naît dans le cadre de l'app
(`app/ui/navigation-skeleton.tsx`) : au clic sur un lien interne vers un autre écran
(`lib/navigation-target.ts`), si l'écran visé tarde plus de 80 ms, un squelette (titre, lignes,
blocs) prend la place de l'écran courant, annoncé aux lecteurs d'écran ; il s'efface quand l'adresse
change, ou au bout de dix secondes. Les envois de formulaire gardent leur bouton « en cours ».

À revoir quand Next.js corrige ce comportement : revenir aux `loading.tsx` par écran, et retirer le
composant.
