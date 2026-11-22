# Lot 65 — Retours de la recette staging du 22/11/2026 (version 69186b1)

**Statut** : spécification validée par Julien le 22/11. Faits : 65a, 65e, 65b, 65c (branche
`lot-65-retours-staging`). En cours : 65d. À part : 65f, le menu latéral réductible (demande du 22/11,
session dédiée).

Sources :
- l'analyse `docs/audits/2026-11-22-recette-staging.md` ;
- la note des e-mails `docs/audits/2026-11-22-emails-planner.md`, avec les décisions du 22/11 ;
- les maquettes validées `docs/maquette/Recette-staging-22-11.html` (M14 à M16), avec la retouche de
  M15.

## Décisions du 22/11

| Sujet | Décision |
|---|---|
| Prestataires d'un poste | M14 : « Comparer » ou « Retenir », jamais d'office ; fenêtre du poste en cinq rubriques ; changer d'avis sans supprimer la ligne. |
| Aujourd'hui | M15 : 7 lignes au plus, découpées par nature (relances, tâches, paiements, décisions), chaque partie avec son lien ; calendrier pleine largeur, feuilletable. |
| Relance d'un prestataire | M16 : « Noter une relance » (comment, date, note, rappel) ; message type à copier ; rien n'est envoyé ni ouvert d'office. |
| E-mails | Par défaut, Symbola n'envoie que : accès, signature et exemplaire signé, rendez-vous en ligne, sécurité, avis à l'équipe. Tout le reste est préparé, puis envoyé de la messagerie de la planner. **Révisé le 22/11** : l'envoi par Symbola reste en **option** par organisation (pièces jointes, relances automatiques). Revient en partie sur Q18 révisée et l'ADR 0102. |
| Reprise des types combinés | À corriger avant la production ; sans gêne sur le staging. |

## Paquets

Ordre :
1. **65e** d'abord, petit et bloquant pour la production ;
2. **65b** et **65c** ensuite, indépendants l'un de l'autre ;
3. **65d** en dernier, car il touche les envois de tous les modules.

---

### 65a — Défauts visuels (fait, sans migration)

- **UX-13** : dans un formulaire en grille, les champs d'une rangée sont alignés ; un libellé
  `field-fit` ne déborde plus sur la colonne voisine.
- **UX-13** : dans le panneau des réglages, l'aide est un bloc repliable en tête du panneau. Elle
  n'ouvre plus de second panneau.
- **HUB-08** : sur « Aujourd'hui », le message qui suit une action passe sous l'élément.
- Reste à faire : un parcours Playwright qui vérifie l'alignement des champs (mêmes `top` dans une
  rangée) et l'absence de second panneau d'aide.

### 65e — Reprise des types combinés : rattachement trompeur (sans migration)

**PRE-01, HUB-20** (`modules/vendors/type-split.ts`, `typeForKey`) :
- **Étant donné** un type « Maquillage » rattaché à tort au métier de départ « Coiffure »,
  **quand** on planifie la reprise de « Coiffeur(se) - Maquilleur(se) », **alors** la coiffure va
  dans un type de coiffure (existant ou créé) et le maquillage dans « Maquillage ». Les deux métiers
  ne tombent jamais dans un même type.
- Règle : on ne suit pas le rattachement d'un type quand son libellé est le synonyme d'un autre
  métier.
- Si les métiers d'un type combiné aboutissent quand même au même type, le plan le signale au lieu
  d'appliquer.
- Test unitaire avec ce cas. Le rapport du staging doit ensuite montrer « Coiffure » + « Maquillage »
  pour Recette Symbola.

### 65b — Choisir et comparer les prestataires d'un poste (M14 ; migration : à vérifier)

**PRE-02, BUD-04, BUD-05, UX-03** :
- « + Ajouter un prestataire » propose **« Comparer »** et **« Retenir »** pour chaque fiche. La
  liste montre tout le carnet du métier sans rien taper, avec « Voir tout le carnet ».
- Chaque ligne du tableau dit où en est le choix : « Retenu », « N en comparaison », « À trouver ».
  « Ouvrir », ou un clic sur la ligne, ouvre la **fenêtre du poste**. Le bloc en bas de page
  disparaît.
- La fenêtre du poste a cinq rubriques : **Prestataires** (comparaison côte à côte), Montants,
  Échéancier, Documents, Réglages du poste. On passe de l'une à l'autre avec « Poste précédent » et
  « Poste suivant ». Elle suit l'ADR 0107 et prend une page entière sur téléphone.
- La comparaison montre, par prestataire : où on en est, le devis (montant et PDF), la disponibilité,
  « Déjà travaillé ensemble », la dernière relance et une note.
- Actions : « Retenir », « Écarter », puis, une fois un prestataire retenu, « Changer de
  prestataire » et « Ne plus retenir ». Retenir au-delà du seuil d'alerte du budget demande toujours
  une confirmation (BUD-02).
- **Données** : les statuts des prestataires envisagés existent depuis le lot 28a. Ne plus retenir
  ramène au statut « devis reçu », ou « contacté » sans devis. **Fait sans migration** : « Changer de
  prestataire » et « Ne plus retenir » reprennent le changement de retenu du lot 47 (D6), qui libère
  l'engagé du budget.
- Rejeu de **SC-04** et **SC-05** (trois fleuristes, un choix).

### 65c — Aujourd'hui (M15, sans migration)

**HUB-08, UX-01** :
- « À traiter en premier » tient en **7 lignes au plus**, triées par priorité puis par délai. Elles
  sont réparties en parties : Relances à faire, Tâches, Paiements, Décisions et signatures.
- Chaque partie a son nombre et son lien :
  - Relances à faire → la page des relances, ou l'évènement concerné ;
  - Tâches → « Tâches » ;
  - Paiements → « Encaissements » ;
  - Décisions et signatures → l'évènement concerné.
- Une partie vide n'apparaît pas.
- Le **calendrier** passe sous la liste, sur toute la largeur. Il reprend le composant du calendrier
  des évènements (Mois, Semaine, Liste ; « ‹ », « Aujourd'hui », « › »). Ses données sont celles du
  lot 63d : évènements, rendez-vous, tâches par catégorie, échéances.
- Sur un écran de 1 366 × 768, le calendrier commence dans la partie visible sans défiler. Un
  parcours le vérifie.
- Rejeu de **SC-03** (lundi matin).

### 65d — Relances notées et e-mails préparés par la planner (migration : oui)

**Relance d'un prestataire (M16 ; PRE-02, HUB-08)**
- « Relancer » devient **« Noter une relance »**, partout où il existe : Aujourd'hui, fenêtre du
  poste, consultation.
- Une fenêtre demande : comment (téléphone, e-mail, SMS, de vive voix), la date (aujourd'hui par
  défaut), une note facultative et le délai du rappel. Le message type se déplie, à copier.
- L'élément quitte « Aujourd'hui » jusqu'au rappel, puis revient s'il n'est pas réglé.
- Il affiche « Relancé le … par … ».

**Le réglage « Qui envoie les messages de la relation » (MSG-01, HUB-20 ; décision révisée du 22/11)**
- Dans Paramètres › E-mails, par organisation :
  - « Je les envoie de ma messagerie » (**par défaut**) ;
  - « Symbola les envoie pour moi » : le fonctionnement actuel, avec les pièces jointes et les
    relances automatiques.
- Le réglage ne touche que les 17 modèles de la relation. Les modèles techniques partent toujours de
  Symbola.
- Changer de réglage ne perd rien. Les automatismes gardent leurs propres réglages (lot 53) ; seule
  leur sortie change : un envoi, ou un élément « À envoyer ».

**« Préparer l'e-mail » (MSG-01, ADR à écrire), quand la planner envoie elle-même**
- Les 17 modèles de la relation sont **préparés**, et plus envoyés par Symbola. Ils sont listés au
  § 1 de la note des e-mails, avec `task_reminder`.
- Une fenêtre montre le message prérempli et modifiable : destinataire, objet, texte, avec les liens
  personnels de l'espace du client ou du prestataire déjà insérés.
- Trois actions :
  - **« Ouvrir dans ma messagerie »**, par un lien `mailto:` ;
  - **« Copier le message »** ;
  - **« J'ai envoyé »**, qui note l'envoi (date, destinataire, modèle) au journal de l'évènement.
- Pas de pièce jointe : on donne le lien de l'espace, ou « Télécharger le PDF » à côté.
- Les **automatismes** du lot 53 (échéances, expiration d'une proposition, relances des prospects et
  des prestataires, rappel des tâches du client) n'envoient plus rien. Ils déposent un élément
  « À envoyer » dans la partie « Relances » d'« Aujourd'hui ».
- Symbola continue d'envoyer lui-même les 18 modèles techniques : accès, signature, rendez-vous en
  ligne, sécurité, avis.
- La liste des modèles techniques est **fermée, en données**. Un test vérifie qu'en mode « Je les
  envoie de ma messagerie », aucun modèle de la relation ne part de Symbola.
- En mode « Symbola les envoie pour moi », rien ne change par rapport au fonctionnement actuel. Un
  test le vérifie sur un envoi avec pièce jointe et sur une relance automatique.

**Données** (schéma `events` pour les relances, `hub` pour les envois préparés et le réglage) :
- le réglage de l'organisation (qui envoie) ;
- les colonnes de la relance : moyen, note, date du rappel ;
- un journal des messages préparés et déclarés envoyés ;
- l'état « à envoyer » des automatismes.

Migrations à partir de **0204** (65b n'en a pas eu besoin), réversibles, avec des tests d'isolation.

**Écarts avec le cahier des charges**, à inscrire dans un ADR et dans la question **Q45** de
`docs/QUESTIONS.md` :
- **FAC-09** prévoit des « relances d'impayés réglables », **HUB-28** des automatismes « échéance →
  relance ». Par défaut, ils deviennent des relances **préparées**. Avec l'option, ils restent
  envoyés.
- **MSG-01** et l'ADR 0102 : par défaut, la messagerie de Symbola ne sert plus aux messages de la
  relation. L'option la garde.

Rejeu de **SC-02** (de la demande à l'acompte), qui fait partir des messages.

---

## ADR à écrire

- **0110** : par défaut, les e-mails de la relation sont préparés par Symbola et envoyés par la
  planner ; l'envoi par Symbola reste en option, par organisation. Précise l'ADR 0102 et la décision
  Q18 révisée ; s'écarte de FAC-09 et HUB-28 dans le mode par défaut.
- **0111** (si 65b en a besoin) : la fenêtre du poste remplace le détail en bas de page ; comparer
  avant de retenir.

## Tests et rejeu

- Tests d'abord. Chaque `describe` porte l'identifiant de l'exigence, chaque critère est un `it`.
- Tests d'isolation pour toute nouvelle table ou route.
- Horloge simulée pour le rappel d'une relance : la veille, le jour même, le lendemain.
- Playwright en ordinateur et en 375 px, avec axe-core sur chaque nouvelle fenêtre.
- Rejeu de SC-02, SC-03, SC-04 et SC-05, écrit dans `docs/recette/`.

## Hors périmètre

- La vérification des autres modules par Julien, qu'il fera dans un second temps.
- L'envoi d'un message depuis Symbola avec la boîte de la planner (connexion Gmail ou Outlook) :
  écarté le 22/11. L'option « Symbola les envoie pour moi » garde l'adresse de l'ADR 0102.
