# Lot 12 — Un démarrage sans page blanche, une fiche événement plus claire

Retours de la recette du 05/11/2026 par la wedding planner pilote (avec captures). Constat
principal : **elle n'a pas su par où commencer**. Les paramètres arrivent vides (« Aucun poste par
défaut pour l'instant »), le vocabulaire (« postes ») n'est pas expliqué, la configuration est
longue, et elle ne voit pas toujours que ce qu'elle saisit est enregistré. Les imports depuis l'outil actuel
font l'objet du lot 14 (reporté après la refonte UX du lot 13).

## Décisions de Julien (05/11/2026)

- **Pré-paramétrer selon le métier, laisser tout modifiable.** Une wedding planner démarre avec
  les postes d'un mariage, ses sources, ses motifs de perte, son rétroplanning, son programme du
  jour J, sa répartition de budget et ses types de prestataires ; une agence événementielle avec
  des valeurs adaptées (avec des éléments communs). Ces valeurs viennent de fichiers de modèles
  de départ par métier (`packages/starter-templates`), jamais du code (CLAUDE.md § 2.5).
- **Assistant de démarrage bloquant, pré-rempli** : tant qu'il n'est pas terminé, les menus
  métier sont verrouillés.
- **On abandonne « postes » et on garde « Budget »** (05/11, après maquettes) : ni « postes » ni
  « postes de dépenses » ne parlent à la planner, et elle ne les retrouvait que dans la
  « répartition budgétaire », qu'elle ne fait pas avant le budget. Les lignes (lieu, traiteur,
  photographe…) deviennent les **lignes du budget** de l'événement, présentes dès sa création,
  sans simulation préalable ; la répartition devient une aide facultative pour proposer des
  montants prévus. Voir EVT-17.
- **Programme du jour J : une icône par prestataire concerné**, pour voir d'un coup d'œil qui
  intervient.
- Découpage : lot 12 (ce document), puis lot 14 (imports depuis l'outil actuel, reporté après la refonte UX du lot 13 : prestataires en Excel,
  fiches événements en PDF avec `pdfjs-dist`, dépendance acceptée).

## ONB-03 — Assistant de démarrage pré-rempli (refonte d'ONB-01)

- **Quand** une titulaire se connecte pour la première fois, **alors** l'assistant s'ouvre et
  les menus métier sont verrouillés (un message dit pourquoi et mène à l'étape en cours).
- Étape 1 « Votre activité » : métier (wedding planner, agence événementielle, autre métier de
  l'événementiel) et langue. **Quand** elle valide, **alors** les listes et modèles de départ
  de ce métier sont chargés **d'office** (ils ne l'étaient qu'à la demande).
- Étapes suivantes, chacune déjà remplie, à relire et ajuster puis « Valider et continuer » :
  2 entreprise (nom, SIREN, adresse, logo, forme juridique) ; 3 TVA et mentions ;
  4 lignes du budget d'un événement ; 5 sources de prospects et motifs de perte ; 6 modèles
  (rétroplanning, programme, répartition du budget) — aperçu, modifiables plus tard.
- Chaque étape affiche « Enregistré » après validation ; « Retour » ne perd rien ; on peut
  quitter et reprendre à la même étape.
- **Quand** l'assistant est terminé, **alors** les menus se déverrouillent et l'accueil propose
  la suite (créer un premier événement, importer depuis l'outil actuel).
- Une organisation existante qui n'a pas de postes par défaut reçoit l'assistant à sa prochaine
  connexion, avec les listes déjà présentes gardées.

## ONB-04 — Paramètres plus compréhensibles

- Chaque liste explique à quoi elle sert, avec un exemple (« Lignes du budget : lieu, traiteur,
  photographe… Chaque nouvel événement les reçoit »).
- Toute saisie dans les paramètres donne un retour visible (« Ajouté », « Enregistré »).
- Depuis un écran qui renvoie aux paramètres (ex. budget sans modèle de répartition), le lien
  mène directement au bon réglage et le retour ramène à l'écran d'origine **sans perte** de ce
  qui était saisi (saisie gardée ou proposition faite sur place : « Créer un modèle à partir
  de la répartition de départ »).

## EVT-17 — Un seul onglet « Budget » (les « postes » disparaissent)

- La fiche événement n'a plus d'onglet « Postes prestataires » : l'onglet **Budget** liste les
  lignes (lieu, traiteur…) avec, pour chacune, prestataire (retenu ou consultés), statut, prévu,
  réel et écart. Les prestataires consultés, devis et notes (lot 11) s'ouvrent depuis la ligne.
- **Quand** un événement est créé, **alors** il reçoit les lignes par défaut de l'organisation,
  prévu vide : le budget existe sans simulation.
- La répartition (modèle en pourcentages) reste disponible : « Proposer des montants prévus »
  remplit les prévus vides à partir d'un total et d'un modèle (pré-rempli au démarrage).
- Partout dans l'outil (paramètres, aide, tutoriels, espace clients, exports), « poste » devient
  « ligne du budget » ou disparaît ; « Postes par défaut » devient « Lignes du budget par défaut ».
- Les données et contrats existants ne changent pas de nature (une ligne du budget est l'ancien
  poste, ADR 0032 à écrire) ; aucune donnée existante n'est perdue.

## EVT-12 — Statut de l'événement en boutons

- Les statuts (prospect, devis envoyé, confirmé, réalisé, perdu) s'affichent comme des étapes
  cliquables façon Kanban ; l'étape courante est mise en évidence ; « perdu » demande le motif.

## EVT-13 — Rétroplanning seulement pour un événement confirmé

- **Étant donné** un prospect, **alors** aucune tâche du rétroplanning n'est créée.
- **Quand** il passe en « Confirmé » (devis validé), **alors** l'app propose d'appliquer le modèle
  de rétroplanning (appliqué d'un clic, modèle choisi pré-sélectionné).

## EVT-14 — Programme du jour J lisible

- Une ligne par moment : heure, intitulé, lieu, puis **une icône par prestataire concerné**
  (appareil photo, caméra, musique, fleur, couverts…, avec son nom en infobulle et pour les
  lecteurs d'écran) ; boutons « Modifier » et « Supprimer » discrets à droite.
- L'icône d'une ligne du budget se choisit dans une liste d'icônes (pré-réglée par les modèles de
  départ) ; une ligne sans icône garde ses initiales.

## EVT-15 — Lieux enregistrés une fois

- Un carnet d'adresses des lieux de l'événement (lieu de réception, cérémonie, préparatifs…) :
  saisie une fois, puis choisie dans le programme et sur la fiche.
- Un lieu de réception du carnet de prestataires est proposé d'office (type « Lieu »).

## HUB-13 — Agenda cliquable

- **Quand** elle clique une date de l'agenda, **alors** une fenêtre propose « Créer un
  prospect » ou « Créer un événement » à cette date.

## EVT-16 — RIB d'un prestataire partagé aux clients

- Sur un prestataire retenu ou montré aux clients, une case « Partager le RIB » rend le RIB de la
  fiche téléchargeable dans l'espace clients de cet événement (seulement celui-ci).

## AIDE-09 — Aide plus claire

- La visite d'accueil ne mélange plus « à faire » et « à découvrir » : l'assistant porte les
  tâches de paramétrage, la visite ne fait que montrer.
- La barre d'aide dit ce qu'elle compte (« Tutoriels : 0 sur 10 ») et chaque élément est un lien ;
  une visite déjà faite compte dans « prise en main ».
- Textes revus (ex. « elle fouille tout Symbola » → « elle cherche dans toutes vos données »).

## Renumérotation des identifiants

Les lots 10 et 11 avaient réutilisé des identifiants déjà pris dans le cahier des charges (stories
V2). Ils sont renumérotés partout (docs, ADR, code, tests) ; le cahier des charges est inchangé.

| Avant | Après | Story |
| --- | --- | --- |
| HUB-05 (lot 10) | HUB-11 | Suivi de la prise en main dans l'Administration |
| HUB-06 (lot 11) | HUB-12 | Paramètres en pastilles |
| EVT-08 (lot 11) | EVT-10 | Plusieurs prestataires consultés |
| EVT-09 (lot 11) | EVT-11 | Notes et options montrées aux clients |

## Tests

- Intégration : chargement des modèles de départ par métier, verrouillage tant que l'assistant
  n'est pas fini, reprise d'étape, aucune tâche pour un prospect puis application à la
  confirmation, lieux de l'événement, RIB partagé seulement à l'événement concerné.
- e2e (ordinateur et 375 px, axe-core) : premier démarrage complet d'une wedding planner et
  d'une agence ; statut en boutons ; programme ; agenda cliquable.
