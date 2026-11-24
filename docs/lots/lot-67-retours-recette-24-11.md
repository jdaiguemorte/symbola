# Lot 67 — Retours de la recette du 24/11/2026 (staging, version 38b47b3)

**Statut** : plan validé par Julien le 24/11, précisions du même jour intégrées (R03, R06, R07, R09) ;
spécification validée par Julien le 24/11. Faits : 67a, 67b, 67c et 67e (parcours Playwright à voir en CI ;
l'écran de 67e n'a pas été regardé dans un navigateur en local). À faire : 67d.

Source : le compte rendu de recette de la planner pilote du 24/11/2026 (20 minutes sur le staging,
11 retours R01 à R11, captures à l'appui). Le compte rendu n'est pas versé au dépôt (captures de
données de recette) ; ce document en reprend les constats.

Branche : `lot-67-retours-recette-24-11`, une seule pull request vers `main`.

## Décisions du 24/11

| Sujet | Décision |
|---|---|
| R03, cause | Confirmée par Julien : le poste (« Ligne du budget ») n'est écrit qu'une fois dans le fichier, les lignes du dessous le laissent vide ; l'import doit le reporter. |
| R07, besoin | La planner veut reprendre, depuis un PDF, les **prestataires retenus d'un évènement**, pour ne pas les ressaisir. Ce n'est pas l'import du carnet. Paquet 67e, cadré sur le PDF fourni par Julien le 24/11. |
| R09, clients | Les clients sont reconnus par leur **rôle seul** (« Marié », « Mariée »…), pas par leur prénom. |
| R06, « À trouver » et « Engagé » | Pas un défaut d'affichage : l'évènement de la recette est un évènement fini repris par import, dont les prestataires n'ont pas pu être rattachés. 67e y répond. |
| 67e, forme | Décision de Julien du 24/11 : un **aperçu dans l'onglet** « Budget et prestataires », sur le modèle de l'import du programme PDF (lot 63b), sans assistant ni journal d'import. Pas d'annulation en un geste : on corrige par « Ne plus retenir » sur le poste et en supprimant la fiche créée. Aucune migration. |
| Programme sur deux jours | L'évènement de la recette dure deux jours : tout commence la veille, le mariage civil est le samedi. La veille ne doit pas s'appeler « Jour J », et les PDF doivent séparer les jours. |

## Paquets

Ordre : 67a (import, bloquant pour la reprise d'un budget), puis 67e (il s'appuie sur l'import
corrigé), puis 67b, 67c et 67d, indépendants.

Aucune migration n'est prévue pour 67a à 67d ; 67e : à vérifier. Si l'une s'avère nécessaire, elle est annoncée avant
d'être écrite.

---

### 67a — Import : budget et rapprochements (R03, R04 ; sans migration)

**HUB-14, BUD-01 — Le poste se reporte sur les lignes du dessous (R03)**
(`packages/import-engine/src/rows.ts`, `packages/import-engine/src/xlsx.ts`,
`packages/contracts/src/import/fields.ts`)

- **Étant donné** un fichier de budget où le poste n'est écrit que sur la première ligne de chaque
  groupe, **quand** on l'importe, **alors** une ligne sans poste mais avec un montant ou un libellé
  reprend le poste de la ligne précédente. Les 20 lignes du fichier de la recette sont importables.
- Une cellule fusionnée d'Excel se lit comme sa première cellule suivie de cellules vides : le report
  la couvre, pour le poste seulement. Les fusions ne sont pas recopiées ailleurs (un montant
  fusionné sur trois lignes serait compté trois fois).
- Le report ne vaut que pour les champs déclarés « à reporter » dans la définition du type d'import
  (ici `slotLabel` du budget). Aucun autre type ne change de comportement.
- Une ligne entièrement vide ne reprend rien et reste ignorée. La première ligne sans poste reste
  rejetée.
- L'écran des lignes dit quelles lignes ont repris le poste du dessus (« poste repris de la
  ligne 3 »), pour que la planner puisse vérifier.
- Le motif d'un rejet nomme la colonne du fichier à remplir : « Ligne 4 : la colonne « Poste » est
  vide (champ obligatoire « Ligne du budget ») ».
- Tests : unitaires du moteur (report, fusion, ligne vide, première ligne) ; un test d'intégration
  avec un fichier à la forme de celui de la recette.

**HUB-14 — Un rapprochement non décidé ne passe pas pour décidé (R04)**
(`apps/symbola/lib/import/wizard.ts`, `apps/symbola/app/import/[importId]/rapprochements/`,
`apps/symbola/app/import/[importId]/confirmation/page.tsx`)

- **Étant donné** des rapprochements proposés sans décision, **quand** la planner clique
  « Continuer », **alors** elle reste sur l'écran, qui dit combien attendent et place le premier
  sous ses yeux. Deux gestes en lot : « Tout rapprocher » et « Tout créer comme nouvelles lignes ».
- L'étape « Doublons » n'est « terminée » que sans rapprochement en attente. Son résumé dit
  « 5 à décider » ; il ne les compte plus parmi les « nouveaux ».
- « Décider plus tard » reste possible pour quitter l'import et y revenir ; il ne permet pas de
  passer à la confirmation.
- Sur la confirmation, chaque blocage porte le bouton qui le lève : « Décider les 5 rapprochements »
  ouvre l'écran filtré sur eux. Même règle pour les colonnes non décidées.
- Tests : règles de `wizard.ts` ; parcours Playwright (ordinateur et 375 px) de l'import bloqué puis
  débloqué.

### 67b — Tâches (R01, R02 ; sans migration)

**HUB-08, CHR-03 — Un compteur dit ce qu'il compte (R01)**
(`apps/symbola/lib/today/parts.ts`, `apps/symbola/app/accueil/today-view.tsx`,
`apps/symbola/app/app-shell.tsx`, `apps/symbola/app/taches/page.tsx`)

- Sur « Aujourd'hui », la partie des tâches s'intitule « Tâches en retard ou à faire sous 14 jours
  (4) » ; le nombre de jours vient de l'horizon de l'accueil, pas du texte.
- Son lien dit où mène la suite : « Voir toutes les tâches ». Le total n'y figure pas : le compter
  demanderait de lire toutes les tâches à chaque affichage de l'accueil (NFR-02, ADR 0115).
- La pastille « en retard » du menu et le résumé de la page Tâches comptent aussi les tâches hors
  évènement. Les trois nombres (accueil, menu, page) sont cohérents entre eux.
- Tests : unitaires des parties ; intégration avec une tâche d'évènement et une tâche hors évènement
  en retard (pastille à 2) ; horloge simulée à la limite des 14 jours.

**CHR-10 — Modifier une tâche hors évènement (R02)**
(`apps/symbola/modules/events/service.ts` et `repository.ts`,
`apps/symbola/app/taches/standalone-actions.ts`, `apps/symbola/app/taches/page.tsx`)

- **Étant donné** une tâche hors évènement, **quand** la planner clique « Modifier », **alors** une
  fenêtre permet de changer l'intitulé, l'échéance et la répétition, avec le même motif que la
  fenêtre d'une tâche d'évènement.
- Changer la répétition d'une tâche ne touche pas les occurrences déjà faites.
- Tests : service ; isolation (l'organisation A ne modifie pas une tâche de B, une Planner sans
  droit non plus) ; Playwright avec axe-core sur la fenêtre.

### 67c — Devis et budget (R05, R08, R06 ; sans migration)

**HUB-07, FAC-01 — Un devis pour un nouveau prospect (R05)**
(`apps/symbola/app/creation-rapide/quick-create.tsx` et `actions.ts`)

- « Créer › Devis » demande d'abord pour qui : « Un évènement existant » ou « Un nouveau prospect ».
- « Un nouveau prospect » demande ce que demande « Créer › Prospect » (prénom, type d'évènement,
  source, date facultative), crée le prospect, puis le devis en brouillon, et ouvre le devis.
- Si la création du devis échoue, le prospect reste, et le message le dit avec un lien vers lui.
- La page Devis n'a pas de bouton « Nouveau devis » propre : la création passe par « Créer ».
- Tests : action (les deux chemins, l'échec du devis) ; Playwright en ordinateur et en 375 px.

**UX-08 — Le bouton d'un écran vide fait quelque chose (R08)**
(`apps/symbola/app/devis/modeles/page.tsx`, `apps/symbola/app/parametres/messages/page.tsx`,
`apps/symbola/app/ui/empty-state.tsx`)

- Sur « Modèles de devis » vide, le bouton principal est « Ajouter le modèle de départ » ; un lien
  « Partir d'un devis existant » mène aux devis. Plus de bouton « Créer un modèle » vers une ancre.
- Sur « Modèles de messages » vide : « Ajouter les modèles de départ », et « Écrire mon propre
  modèle », qui mène au formulaire plus bas.
- Un test de convention : aucun écran vide n'a pour action une ancre de sa page, hors cas nommés
  avec leur raison (la zone de dépôt des documents).

**BUD-02 — Les totaux du budget en haut (R06)**
(`apps/symbola/app/events/[id]/page.tsx`, `apps/symbola/app/events/[id]/budget-vendors-table.tsx`)

- Sous le titre « Budget et prestataires », une rangée de tuiles : Prévu, Réel, Écart, Réglé, Reste
  à payer, avec « dont engagé ». Motif des tuiles de `DESIGN.md`, sur deux colonnes en 375 px.
- Le pied du tableau garde ses totaux.

### 67d — Programme du jour J (R09, R10, R11 ; sans migration)

**CHR-06 — Des chevauchements qui méritent d'être lus (R09)**
(`apps/symbola/modules/events/program.ts`, `apps/symbola/app/events/[id]/page.tsx`)

- Pas d'avertissement pour les clients de l'évènement : ils sont de toutes les séquences. Un
  intervenant libre est reconnu comme client par son rôle seul, lu dans le profil d'import
  (`clientRoles` : « Marié », « Mariée »… ; « Marié - Valentin » est un client). Le prénom ne
  compte pas.
- Pas d'avertissement quand une séquence est entièrement contenue dans l'autre (« Soirée » et
  « Ouverture de bal »).
- Pas d'avertissement entre deux séquences de jours différents.
- Les avertissements restants sont regroupés par intervenant : « Photographe : Préparatifs Mélanie
  et Habillage Valentin, en même temps ».
- Tests unitaires : les douze cas de la capture n'en laissent qu'un, celui du photographe.

**CHR-07, EVT-04 — Un programme sur plusieurs jours (décision du 24/11)**
(`apps/symbola/modules/events/program-import.ts`, `apps/symbola/modules/events/repository.ts`,
`apps/symbola/app/events/[id]/programme/program-pdf-model.ts`)

- Un jour créé par l'import pour une date autre que celle de l'évènement ne s'appelle plus
  « Jour J » : « Veille » pour la veille, « Lendemain » pour le lendemain, sinon la date seule. Le
  nom reste modifiable.
- Les jours déjà créés à tort sous le nom « Jour J » ne sont pas renommés d'office : l'écran propose
  de les renommer.
- Les deux PDF séparent les jours par un titre (« Veille — vendredi 4 décembre 2026 »), dans l'ordre
  des dates.

**CHR-07 — PDF « mariés » lisible (R10)**
(`apps/symbola/app/events/[id]/programme/program-pdf.tsx`, `program-pdf-model.ts`)

- L'horaire tient sur une ligne (« 07:00 – 11:00 »), la durée dessous en gris (« 4 h ») ; rien ne
  déborde sur l'intitulé.
- Une séquence sans durée n'affiche que son heure, sans « · 0 min ».
- Test du modèle ; contrôle du rendu sur le programme de la recette (aucun texte hors de sa
  colonne).

**CHR-07 — PDF « équipe » lisible (R11)**

- Quatre colonnes (heure, séquence, lieu, intervenants) ; la note passe sous la séquence, sur toute
  la largeur, avec ses retours à la ligne.
- Une séquence plus haute qu'une page se coupe entre deux pages, l'en-tête des colonnes répété.
- Les deux PDF régénérés sont joints à la pull request pour relecture.

### 67e — Reprendre d'un PDF les prestataires retenus d'un évènement (R07 ; fait, sans migration)

**HUB-14, PRE-02, BUD-04** — besoin (décision du 24/11) : depuis l'évènement, déposer le PDF qui
liste ses prestataires retenus ; Symbola retrouve ou crée chaque fiche du carnet et la retient sur
le bon poste, sans ressaisie.

Le PDF fourni (« Export des Prestataires », une page) vient du même logiciel que les fiches
d'évènement et le programme déjà repris (même pied de page « Mis à jour le … »). Il contient :
- en tête, la date de l'évènement et les noms des deux clients ;
- un tableau de six colonnes : Type de prestataire, Nom, Contact, E-mail, Téléphone, Instagram ;
- 17 lignes, sans montant ; des cellules vides ; deux fois le même type (« Fleuriste ») ; une ligne
  qui est la planner elle-même (« Wedding Planner »).

Le PDF porte des données personnelles réelles : il n'entre pas dans le dépôt. Le test s'écrit sur
un PDF fictif de même forme, fabriqué pour l'occasion.

Critères :
- **Entrée** : l'onglet « Budget et prestataires » porte « Reprendre les prestataires retenus
  (PDF) » (`?reprendre=1` l'ouvre). L'import central n'est pas concerné.
- **Reconnaissance** : par les intitulés du profil du logiciel (`import-profiles.json`, données de
  `packages/starter-templates`), lus par `packages/import-engine/src/pdf.ts` (ADR 0034). Les
  colonnes se reconstruisent par la position du texte ; une cellule vide reste vide, sans décaler
  la ligne. Aucune nouvelle dépendance.
- **Évènement** : la date et les clients de l'en-tête sont comparés à l'évènement ouvert ; s'ils
  diffèrent, l'écran le dit et demande confirmation avant d'aller plus loin.
- **Carnet** : la fiche au même nom est proposée (aux accents près) ; sinon une fiche est créée. La
  planner choisit une autre fiche si besoin. Une fiche existante n'est pas modifiée. Le contact se lit « Prénom NOM » ; plusieurs numéros, les
  entités HTML et l'Instagram se nettoient comme dans l'export Excel (`vendors-export.ts`).
- **Type** : une fiche créée prend le métier du carnet au même libellé ou synonyme ; sinon elle
  reste « à classer ». Aucun métier n'est créé ici (l'import du carnet garde cette étape).
- **Poste** : chaque prestataire est proposé sur la ligne du budget de son métier ; la planner
  corrige ou choisit « Nouvelle ligne ». Un mot voisin ne suffit pas (« Photobooth » ne va pas sur
  « Photographe »). Deux prestataires d'un même métier sans ligne partagent la ligne créée. Un
  prestataire déjà retenu sur une ligne le reste : la reprise ajoute, elle ne remplace pas.
- **Retenir** : à la confirmation, chaque prestataire est retenu sur son poste, comme par le geste
  « Retenir » de la fenêtre du poste (ADR 0111). Les montants de la ligne ne changent pas.
- **Planner** : la ligne dont le rôle est celui de la planner (`plannerRoles` du profil) est
  écartée, et l'aperçu le dit.
- **Rejeu** : relancée sur le même fichier, la reprise n'écrit rien de plus (fiches retrouvées,
  prestataires déjà retenus).
- **Pas d'annulation en un geste** (décision du 24/11) : « Ne plus retenir » sur le poste, et
  suppression de la fiche créée dans le carnet.
- **Effet attendu sur R06** : après la reprise, les lignes du budget de l'évènement fini portent
  leur prestataire ; « À trouver » ne reste que sur les postes vraiment vides.

Tests : lecture du PDF fictif (colonnes, cellules vides, ligne de la planner) ; intégration de la
reprise et de son annulation ; isolation (un évènement d'une autre organisation n'est jamais
reconnu ni proposé) ; Playwright du parcours en ordinateur et en 375 px.

En attendant, dans 67a : l'écran d'import dit quels PDF sont lus (fiches d'évènement, programme) et
où. « Prestataires » a déjà sa tuile au-dessus de « Un autre fichier » : rien à ajouter à la liste.

---

## ADR à écrire

- Aucun pour 67a à 67d, sauf si le report d'une valeur à l'import s'étend à d'autres types.
- Aucun pour 67e non plus : la reprise réemploie le modèle de l'import du programme (ADR 0091) et
  le geste « Retenir » (ADR 0111), sans nouveau type d'import.

## Tests et rejeu

- Tests d'abord. Chaque `describe` porte l'identifiant de l'exigence, chaque critère est un `it`.
- Tests d'isolation pour toute nouvelle action (67b, 67c).
- Playwright en ordinateur et en 375 px, avec axe-core sur chaque nouvelle fenêtre.
- Textes en français et en anglais ; aide des écrans touchés mise à jour (Import, Tâches,
  Aujourd'hui, Programme).
- Rejeu des scénarios concernés du § 17 sur le jeu fictif, écrit dans `docs/recette/`.
- `docs/gap.csv` mis à jour pour les exigences touchées.

## Ambiguïtés

- Les identifiants d'exigence cités sont ceux des fichiers touchés ; ils sont à recouper avec le
  cahier des charges au début de chaque paquet.
- 67e : « Lieu » et « Salle de réception » sont deux types du PDF pour un seul poste « Lieu de
  réception » ; la planner tranche à l'étape des postes, rien n'est fusionné d'office.

## Hors périmètre

- La lecture d'un tableau PDF quelconque pour le carnet de prestataires.
- Le tableau unique des tâches (évènement et hors évènement dans la même liste).
