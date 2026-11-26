# Le Design System de Symbola (lot 68, phase 6)

Date : 26/11/2026, par Claude Code. Phase 6 du lot 68, présentée à la **porte 4**. Elle suit les six
volets de maquettes tranchés les 25 et 26/11/2026 (notes [07](07-maquettes-transverse-taches.md) à
[12](12-maquettes-parametres.md)). Cette note dit ce qui est livré (§ 1), ce qui change par rapport au
`DESIGN.md` d'avant (§ 2), qu'aucune fonction majeure ne disparaît (§ 3), comment contrôler les autres
écrans (§ 4), ce qui attend le futur trio de couleurs (§ 5) et les points à trancher par Julien (§ 6).
Aucun écran, code, composant de `packages/ui` ni fichier de traduction de l'app n'est modifié : la
réalisation viendra dans des lots à part (phase 7, hors de cette note).

## 1. Les livrables

| Livrable | Emplacement | Contenu |
| --- | --- | --- |
| Le Design System | [`DESIGN.md`](../../../DESIGN.md), réécrit | Jetons inchangés ; couleurs par rôle (répartition A) ; 22 règles de forme ; composants et leurs états ; motifs de parcours ; lexique (objets, rôles, verbes) |
| La page de référence | [`docs/maquette/lot-68/34-design-system-reference.html`](../../maquette/lot-68/34-design-system-reference.html), ajoutée au [sommaire](../../maquette/lot-68/index.html) | Quatorze rubriques, chaque composant et ses états en 1 440 et en 375 px, avec ce qui le fonde et ce qu'il faut vérifier |
| Cette note | `docs/audits/2026-11-ux-parcours/13-design-system.md` | Changements, liste de contrôle des autres écrans, trio, points S1 à S15 |
| La décision | [`docs/adr/0116-design-system.md`](../../adr/0116-design-system.md) | Le Design System et sa place par rapport à l'ADR 0057 |

**Méthode.** Lu : `CLAUDE.md`, la spécification du lot 68, `DESIGN.md` et l'ADR 0057, la synthèse
(§ 6 à 8), les décisions de la porte 2, les six notes de maquettes et leurs choix (M1 à M13, R1 à
R18, A1 à A7, E1 à E9, V1 à V14, B1 à B17, G1 à G16), les feuilles de style des 33 pages de maquettes,
la spécification du lot 70 (§ 9, A15), et, pour les règles qui en dépendent, quelques fichiers de
l'app (`globals.css`, `design-tokens.test.ts`, `brand-colors.test.ts`, les libellés des rôles dans
`fr.json`). Règle appliquée : quand une maquette récente contredit une règle plus ancienne, la
maquette l'emporte (décision de Julien du 26/11/2026), à condition qu'aucune fonction majeure ne
disparaisse (§ 3).

**Les jetons ne bougent pas.** L'en-tête de `DESIGN.md` garde au caractère près les couleurs, la
typographie, les rayons, les espacements et l'ombre : `design-tokens.test.ts` et
`brand-colors.test.ts` lisent les mêmes valeurs (vérifié en relisant l'en-tête comme le fait le test).
Seule la liste `components` s'allonge de nouveaux composants, tous écrits avec les jetons existants, et
`status-pending` passe de l'ambre au neutre.

## 2. Ce qui change par rapport au `DESIGN.md` d'avant

| Sujet | Avant (`DESIGN.md` du lot 63) | Maintenant | Fondement |
| --- | --- | --- | --- |
| Rôle de la couleur d'action | « Boutons principaux, liens, élément actif, avancement » ; `primary-soft` pour les éléments actifs et les confirmations | Action, liens, entrée active du menu, onglet ouvert, focus, case et interrupteur. Plus jamais l'avancement, « fait », « enregistré », une bascule active ni un bandeau | Porte 2 § 6 ; page 5 ; M8 ; C-83 |
| Ambre (`attention`) | « Ce qui attend quelqu'un. Décision du client en attente, échéance proche » | « À vérifier » et « À compléter » seulement ; l'attente d'un tiers et « bientôt » deviennent neutres avec icône | Porte 2 § 6 ; volet 2 ; M10 |
| Rouge (`critical`) | « Retard ou bloqué » | Vrai retard, pièce expirée, erreur, danger ; jamais répété à chaque ligne, jamais « À trouver » | C-34 ; V9, V12 |
| `status-pending` | Ambre | Neutre ; `status-check` (ambre) et `status-neutral` s'ajoutent | Porte 2 § 6 |
| Bascule et filtre actifs | Non écrit (l'app : vert pâle à 1,16:1) | Encre pleine, texte blanc, partout | M8 ; C-83 |
| Titre d'un objet dans une liste | Non écrit | Encre souligné de gris, la seule cible de la ligne | C-83, C-38 ; D3 |
| Messages | Confirmation ou information en `primary-soft` | Information : neutre bordé ; confirmation d'une action : le message de retour sombre ; « À vérifier » et « Erreur » inchangés | A15 ; M5 |
| Message de retour | Non écrit (trois bandeaux dans l'app) | Un composant : bas gauche, un à la fois, encre, « Annuler » en `night-accent`, barre de temps, 10 ou 5 secondes ; échec clair bordé de rouge | M5, M6 ; C-09 |
| Danger | Bouton de danger (lot 62) | Trois niveaux, renoncement nommé, case à cocher au niveau 3 ; entrée de danger en dernier dans le menu | C-08 ; M6 ; P-17 |
| Fenêtre longue | « Enregistrement à chaque rubrique » (ADR 0107) | Un seul « Enregistrer », toujours visible, « Fermer sans enregistrer ? » ; la fenêtre d'un objet en est la forme type | M1 ; D7 (voir S9) |
| Panneau latéral | Ouvert par la roue « Réglages » | Ouvert par la section « Réglages » du menu « ⋯ » ; la roue quitte les en-têtes | G14 ; C-11 |
| Menu « ⋯ » | Non écrit | Composant : ordre, phrases, section « Réglages », danger en dernier ; panneau du bas sur téléphone | D10 ; P-10 ; G14 |
| Ligne de liste | « Actions de ligne » (lot 62) | Ligne type : une cible, une action rapide, un menu ; ses formes (« Tâches », fiche, « Aujourd'hui », téléphone) ; lignes d'un prestataire et d'un poste | D3, D10 ; M4 ; A3, A4 ; V1, V12 |
| Barres | Non écrit | Barre du haut fixe, barre du bas du téléphone, barre d'enregistrement, barre de sélection | C-12 ; D4 ; D7, G8 ; M2 |
| En-tête d'un objet, onglets, frise | Non écrit | En-tête en 200 px ; onglet ouvert souligné et compté ; frise en lecture, bouton d'étape, lignes d'état | P-09 ; E1 à E4 |
| États d'un écran | « États vides » cités comme acquis | Gabarit de l'état vide ; trois textes vides ; « Repris », « À compléter », provenance ; « non renseigné » | P-02, P-05, P-06 ; B9 ; R7, R9 |
| Visite guidée | Automatique, « Passer la visite » | Proposée par une ligne (sauf l'accueil), croix « Fermer la visite » à chaque bulle | D2 ; B10 à B12 |
| Assistant de démarrage | « Passer cette étape » et « Finir plus tard » | Un seul « Continuer », « Je ne sais pas encore » ; « L'essentiel » garde ses deux boutons | B1, B5 ; volet 5 § 3 bis |
| Aide de l'écran | Non écrit | Panneau de 420 px rangé à droite, questions qui s'ouvrent, recherche intégrée | B14 ; C-05 |
| Menu latéral | « Ne liste que les apps souscrites » | Modules souscrits, puis « Paramètres » et « Aide » tenus en bas ; lignes resserrées sous 640 px | G11 ; C-82 |
| Téléphone | Action principale en bas, cinq onglets au plus | Barre du bas nommée (D4), contenu avant filtres, aucun défilement de côté, panneau du bas | D4 ; P-20 ; C-81 |
| Cibles | 44 px sur téléphone, 56 en Jour J | 44 px aux deux tailles (voir S1) | P-20 |
| Lexique | Absent | Objets, rôles, verbes, mots retirés ; nourrit `lexique.test.ts` (lot 70g) | P-15 ; C-85 à C-90 |
| Règles de forme | « Do's and Don'ts » | 22 règles, chacune avec son fondement ; « Do's and Don'ts » complété | D10 ; P-01 à P-22 |

**Gardé tel quel** : les jetons ; les règles du lot 61 (liste de réglages, formulaire en ligne, valeur à
copier), du lot 62 (formulaire en grille, liste éditable, actions de ligne, bouton de danger, rubriques
d'un écran long), du lot 63 (champ obligatoire, barre de filtres, fenêtre et panneau dans leur principe,
bouton à menu, glisser-déposer, zone de dépôt) et du lot 63f (visite, assistant, panneau du tutoriel),
complétées là où une maquette les précise ; le mode Jour J.

## 3. Aucune fonction majeure ne disparaît

Chaque volet a fait son inventaire écran par écran (§ 3 bis des notes 09 à 12). Au niveau des
composants, ce que le Design System retire ou déplace, et où la fonction reste :

| Ce qui part | Où la fonction reste |
| --- | --- |
| La roue « Réglages » des en-têtes | La section « Réglages » du menu « ⋯ » de l'écran, et le même panneau (G14) |
| « Supprimer » visible sur chaque ligne | Le menu « ⋯ » de la ligne et de la fenêtre, avec « Annuler » et la Corbeille (niveau 1) |
| « Ouvrir » et « Modifier » sur chaque ligne | Le titre de la ligne ouvre l'objet ; « Modifier » est dans la fenêtre ou le menu |
| La case « Fait » et le rond | « Fait » et « Rouvrir », nommés (C-35, M11) |
| L'enregistrement par champ de la fenêtre d'une tâche | Un « Enregistrer » ; le brouillon (`DraftKeeper`, ADR 0074) garde la saisie si l'onglet se ferme |
| « Passer » dans l'assistant de démarrage | « Je ne sais pas encore » ; « L'essentiel » garde « Passer cette étape » et « Finir plus tard » |
| « Passer la visite » | La croix « Fermer la visite », à chaque bulle |
| Les visites automatiques (sauf l'accueil) | La ligne « Découvrir cet écran » et « Revoir la visite » sous le « ? » |
| « Tous les modules » et « Tutoriels » au menu latéral | « Abonnement et modules », le menu du compte ; « Aide » (G11) |
| Filtres, vues, exports et charge sur un écran vide | Ils reviennent avec le premier objet ; les commandes de l'en-tête sont au menu « ⋯ » (B9) |
| Les statuts en ambre et en vert | Les mêmes statuts, avec leur mot et leur icône, en neutre |

## 4. La liste de contrôle des autres écrans

Les écrans des modules budget, devis, invités, rendez-vous, portail, Jour J, plans de salle et pipeline
n'ont pas été dessinés au lot 68 (hors périmètre, sauf leurs points d'entrée). Quand un lot les reprend,
il passe chaque écran au crible ci-dessous : d'abord la liste générale, puis les points propres au
module. Une case non tenue devient un écart à corriger ou à justifier dans la spécification du lot.

### 4.1 Pour chaque écran

À mesurer à **1 440 px, à 911 × 512 (portable à 150 %) et à 375 px**, dans les états vide, rempli et
repris quand ils diffèrent. « Outil » : vérifiable par un script ou un test (voir S14) ; « œil » : à
regarder.

| # | Contrôle | Comment | Règle |
| --- | --- | --- | --- |
| 1 | Un seul bouton plein, et c'est la tâche de l'écran (jamais un tutoriel, une bascule, « Importer ») | Outil : compter les boutons pleins visibles | Règle 1 ; P-08 |
| 2 | Trois zones d'action au plus à 1 440 px, deux à 375 px ; sinon, justifier | Œil | Règle 2 ; D10 |
| 3 | L'en-tête d'un objet tient en 200 px : retour, nom, faits, statut dit une fois, une action, « ⋯ » | Outil : mesurer | Règle 3 ; P-09 |
| 4 | Chaque ligne de liste : une cible (le nom), une action rapide nommée, un menu « ⋯ » ; aucune case hors sélection ; rien de rouge répété | Œil, et outil pour les boutons rouges | Règle 4 ; P-10 |
| 5 | L'objet a une seule fenêtre, la même de partout ; son nom est un lien dans les deux sens | Œil | Règle 5 ; P-11 |
| 6 | Fermer rend l'écran d'origine, à la même ligne ; « ← son nom » | Parcours Playwright | Règle 6 ; P-12 |
| 7 | Chaque action a son message de retour, au même endroit ; « Annuler » quand elle se défait | Parcours Playwright | Règle 8 ; P-16 |
| 8 | Chaque geste de danger est au bon niveau, nomme l'objet, dit la conséquence, propose « Garder … » | Œil | Règle 7 ; P-17 |
| 9 | Champs obligatoires marqués « * » ; aucune bulle du navigateur ; erreur sous le champ ; résumé à partir de deux | `required-mark.test.ts` ; parcours en erreur | Règles 9, 10 ; P-18 |
| 10 | Aucun bouton grisé sans raison | Outil : `disabled` sans texte d'explication | Règle 8 ; M13 |
| 11 | Valeur absente : « non renseigné » ; rien en retard à sa création ni à sa reprise | Œil, sur le jeu fictif repris | Règle 11 ; P-01, P-02 |
| 12 | Chaque compteur se recompte à l'écran (« N sur M ») ; annonce et bilan disent les mêmes nombres | Œil | Règle 12 ; P-07 |
| 13 | Trois textes vides distincts ; l'état vide suit le gabarit et porte la seule action | Œil | Règle 13 ; B9 |
| 14 | Aucune réponse cochée d'avance sur un fait | Œil | Règle 14 ; M13 |
| 15 | Un état se lit sans la couleur ; la couleur d'action ne porte ni statut, ni coche, ni avancement, ni bandeau | axe-core ; capture en niveaux de gris | Règle 17 ; P-21 |
| 16 | Toute cible fait 44 px au moins (56 en Jour J) | Outil | S1 ; P-20 |
| 17 | À 375 px et à 911 × 512 : aucun défilement de côté, aucune superposition ; la liste avant ses filtres ; un tableau devient des cartes | Outil | Règle 16 ; P-20 |
| 18 | Les mots du lexique : `lexique.test.ts` passe sans nouvelle exception | Test | Règle 22 ; P-15 |
| 19 | Le « ? » ouvre l'aide de l'écran ; une visite, s'il y en a une, est proposée et non imposée | Œil | Règle 15 ; D2 |
| 20 | Aucune valeur hors jeton (couleur, taille, rayon, ombre, espacement) | `design-tokens.test.ts` | ADR 0057 |
| 21 | Aucun bouton de relance automatique ni de libre-service pour le client | Œil, à la spécification | Règle 20 ; M3 |
| 22 | Un bouton qui agit au-delà de l'écran dit sa portée | Œil | Règle 18 ; P-22 |

### 4.2 Points propres à chaque module

Ce qui suit vient de la lecture des maquettes, des constats qui touchent ces modules et des noms des
écrans dans l'app ; les écrans eux-mêmes n'ont pas été audités. Chaque point est à vérifier à l'écran
au lot de réalisation.

**Budget** (onglet « Budget et prestataires », écran du budget, réglages des postes)

- La ligne d'un poste (V12) : poste, prestataire et pièces dans la première cellule, l'état en mots,
  une action rapide selon le cas, Prévu, Réel (et l'écart), Réglé (et le reste), Prochaine échéance,
  un menu « ⋯ » (« Ouvrir le poste », « Voir l'échéancier », « Documents du poste », « Supprimer le
  poste… »). « Engagé » quitte la ligne ; « À trouver » n'est pas rouge.
- Sur téléphone, une carte par poste, quatre montants libellés (V13, C-78).
- Les totaux en tête : cinq nombres en mots ; « 6 postes retenus sur 9 » (C-86).
- Une valeur absente se dit « non renseigné », hors du total (P-02, C-55) ; le total d'un fichier
  repris va en tête, « à répartir ».
- La liste éditable des postes a une barre d'enregistrement qui dit le nombre de lignes modifiées.
- L'alerte de dépassement de l'enveloppe : un bandeau « À vérifier : » au-dessus des totaux, pas un
  rouge (ce n'est pas un retard).
- La fenêtre du poste (ADR 0111), non redessinée : à aligner sur la fenêtre longue (un « Enregistrer »,
  voir S9) et sur « Relancer… » (V14).
- La simulation, le détail HT et les exports passent au menu « ⋯ » de l'onglet.

**Devis et factures** (devis, factures, avoirs, encaissements, catalogue, modèles, exports comptables,
e-reporting)

- La ligne d'un devis ou d'une facture : le numéro et le client en cible ; l'état en mots (« Envoyé le
  12 nov. », « Signé le … », « Échéance dépassée de 5 jours » en rouge seulement là) ; une action rapide
  selon l'état (« Envoyer… », « Relancer… », « Noter un encaissement… ») ; le reste au menu.
- Symbola prépare, la planner envoie (ADR 0110) : « Relancer… » prépare le message, il ne l'envoie pas.
- **Émettre une facture** ne se défait pas au sens de la numérotation : fenêtre de niveau 2 qui le dit
  (« Elle ne pourra plus être modifiée ; une correction passe par un avoir ») (voir S15).
- Un prérequis manquant (fiche de l'entreprise, mentions) est l'action de l'état vide : « Compléter
  votre fiche entreprise » ouvre « L'essentiel » (B9) ; les mentions manquantes d'un devis sont un
  bandeau « À vérifier : » qui mène au champ.
- L'éditeur d'un devis est un formulaire à champs liés : barre d'enregistrement ; lignes du devis en
  liste éditable.
- Montants en chiffres tabulaires, espace fine des milliers, « € » après une espace insécable ;
  aucun « 0,00 € » pour une valeur absente.
- Sur téléphone : le devis se lit en cartes (lignes, totaux) ; l'édition peut rester un geste
  d'ordinateur si l'écran le dit (« Modifier sur un ordinateur »), jamais un tableau coupé.

**Invités** (onglet « Invités », plan de table, page de réponse des invités)

- La liste : filtres nommés (réponse, table, régime, côté), « 86 réponses sur 120 », sélection en lot
  avec la barre du volet 1.
- La réponse d'un invité est un état neutre avec mot et icône (« Vient », « Ne vient pas », « Pas
  encore répondu ») : pas de vert pour « Vient », pas de rouge pour « Ne vient pas ».
- Aucune relance automatique des invités ajoutée (règle 20).
- Un import de liste passe par « Reprendre et importer » ; les invités repris portent « Repris ».
- La page de réponse des invités (tiers sans compte) : typographie `reading` (18 px), une question par
  bloc, un seul bouton plein, erreurs sous le champ, rien de coché d'avance, cibles de 44 px au moins.

**Rendez-vous** (agenda, disponibilités, page de réservation des tiers)

- Bascule « Liste · Calendrier » en encre (M8) ; filtres nommés ; « Nouveau rendez-vous » seul bouton
  plein.
- Le vocabulaire : « Temps bloqué autour de l'évènement » au lieu de « Plage occupée » (C-90).
- Annuler ou déplacer un rendez-vous pris par un tiers : niveau 2 (il touche un tiers), qui dit qui
  est prévenu.
- La page de réservation des tiers : un créneau à choisir, un seul bouton, confirmation par le
  message de retour et par une page de fin qui redit le créneau ; 375 px d'abord.

**Portail** (l'espace du client par lien personnel : devis, contrat, décisions, budget, documents,
invités, factures)

- Le client n'a pas de compte et ne pilote rien (règle 20) : aucune fonction de libre-service ajoutée ;
  il lit, répond, signe ce que la planner lui a partagé.
- Une action principale par écran (« Signer le devis », « Répondre à la question ») ; le reste en
  secondaire.
- Les mots du client : « vous » pour lui ; la planner par son nom ; jamais le vocabulaire interne
  (« poste » peut rester s'il est expliqué, « comparaison » se dit « propositions »). À trancher au lot
  du portail avec le lexique.
- Chaque partie partagée porte « Partagé » côté planner ; côté client, rien ne montre ce qui ne l'est
  pas.
- Erreurs sous le champ, message de retour, téléphone d'abord, cibles de 44 px.

**Jour J** (écran du terrain, thème de nuit)

- Jetons de nuit seulement ; contraste de 7:1 sur l'écran principal ; cibles de 56 px (`field-action`).
- Le message de retour et les fenêtres sur fond de nuit : voir S12.
- Les mots du programme : « moment », « Ponctuel », « Fin non renseignée » (R12, R15, D5) ; les
  journées « Veille », « Jour J », « Lendemain » (R11).
- Une action à la fois, à une main ; le danger (supprimer un moment) au niveau 1 avec « Annuler ».
- Hors ligne (lots 29 et 30) : un état « Hors ligne · vos changements partiront au retour du réseau »
  en bandeau d'information, jamais en rouge tant que rien n'est perdu.

**Plans de salle** (éditeur, bibliothèque, lien partagé)

- Le glisser-déposer est toujours doublé d'un bouton (« Déplacer vers… », « Placer à la table… »).
- L'éditeur est un geste d'ordinateur : sur téléphone, le plan se lit (zoom, liste des tables) et
  l'écran dit « Modifier sur un ordinateur » au lieu de couper l'éditeur.
- Une barre d'enregistrement si le plan s'enregistre d'un bouton ; sinon « ✓ Enregistré » à côté du
  plan après chaque geste, avec « Annuler » dans le message de retour.
- Supprimer un plan partagé : niveau 2 (le lien du tiers cesse de marcher).
- Un seul bouton plein dans la barre d'outils ; les outils en bascules (encre pour l'outil actif).

**Pipeline** (la vue « Colonnes » des demandes)

- La vue est une option de la bascule « Liste · Colonnes · Calendrier », en encre (volet 3).
- Une carte de demande suit la ligne allégée : le nom (cible), la date, la prochaine chose à faire en
  mots, une action rapide, un menu « ⋯ ».
- Passer une demande d'une colonne à l'autre : glisser, doublé de « Déplacer vers… » ; une étape qui
  touche des tiers (« Le contrat est signé… ») ouvre sa question, comme la frise (E2).
- Les colonnes portent les mots de la frise (« Une demande en cours », « Signé, en préparation ») et
  leur compte.
- Sur téléphone : pas de colonnes côte à côte qui défilent de côté ; une liste groupée par étape.

## 5. Ce qui attend le trio bleu, orange et crème

Les valeurs ne sont pas connues ; aucune n'est écrite. Ce qui est déjà décidé est dans `DESIGN.md`
(« La future marque : rôles, sans valeurs »). Ce qui attendra les valeurs :

| Ce qui attend | Pourquoi | Ce qui est prêt |
| --- | --- | --- |
| Remplacer `primary`, `primary-strong`, `primary-soft` par le bleu | La nuance des boutons et des liens doit passer 4,5:1 avec un texte blanc et sur le crème | Le rôle : action et liens, rien d'autre ; la liste des endroits (§ 2) |
| Remplacer `ground` par le crème | Le bord des champs (`line-strong`) et des cartes (`line`) est à recalculer sur lui ; l'information se lit par son bord | Le rôle : fond de page et bandeau d'information, jamais fond d'alerte (S5) |
| Placer l'orange | Logo, illustrations, écrans vides seulement ; pas de texte orange sur clair | Le rôle ; les écrans vides qui l'accueilleront (gabarit de l'état vide) |
| Recalculer l'ambre de « À vérifier » à côté de l'orange | Les deux ne doivent pas se confondre (S11) | Chaque état garde son mot et son icône |
| L'accent du message de retour | `night-accent` peut rester (S10) ; s'il suit le bleu, recalculer sur l'encre | 9,7:1 aujourd'hui |
| Mettre à jour `design-tokens.test.ts`, `brand-colors.ts`, le manifeste et les icônes de l'app installée | Mêmes jetons, nouvelles valeurs | Les tests comparent déjà `DESIGN.md` au thème |
| Régénérer les captures du centre d'aide | Elles montrent les couleurs | La commande existe (`help:captures`) |
| Une version de la page de référence aux couleurs du trio | Pour la valider d'un coup d'œil | La page n'emploie que des variables : changer les valeurs du `:root` suffit |

## 6. Les points à trancher par Julien (S1 à S15)

Chaque point a une recommandation. Sauf avis contraire, `DESIGN.md` et la page de référence appliquent
déjà la recommandation.

| # | Question | Ce qui la pose | Recommandation | L'autre voie |
| --- | --- | --- | --- | --- |
| S1 | Les cibles de 44 px valent-elles aussi à l'ordinateur ? | Les maquettes ont, à l'ordinateur, un « Fait » de 36 px, des boutons de bascule de 36 à 38 px et un bouton de message de retour de 40 px ; `DESIGN.md` ne demandait 44 px que sur téléphone | **Oui, 44 px partout** : une seule règle à tester, et la ligne de 60 px les accueille sans grandir. La page de référence les applique | 36 px permis pour l'action rapide d'une ligne et les bascules à l'ordinateur (WCAG 2.2 demande 24 px) |
| S2 | Les barres collées en bas (enregistrement, sélection) ont-elles une ombre ? | Les maquettes leur donnent une ombre vers le haut, qui n'est pas un jeton ; le seul jeton d'ombre (`float`) porte vers le bas, et `design-tokens.test.ts` refuse toute autre ombre | **Pas d'ombre** : le bord haut de 2 px en encre suffit à les détacher | Ajouter un jeton `float-up` à `DESIGN.md` et au thème (un changement de jetons, donc une décision) |
| S3 | Que deviennent les valeurs des maquettes hors des jetons ? | Tailles de 26, 20, 19 et 18 px pour des titres ; gris `#F7FAF9` et `#FAFBFC` ; voile des fenêtres à 45 % (l'app : 35 %) ; fenêtre courte de 560 à 720 px (l'app : 512 px) | **Le jeton le plus proche** : `title` (22 px) pour l'en-tête d'un objet et la barre du téléphone, `heading` (17 px) pour l'état vide et la bulle ; `ground` pour les gris ; le voile de l'app (35 %) ; fenêtre courte de 560 px au plus | Ajouter des jetons de taille (un changement de jetons) |
| S4 | L'entrée active du menu latéral suit-elle la règle des bascules (encre) ? | M8 vaut pour les bascules et les filtres ; le fond `primary-soft` de l'entrée active ne contraste qu'à 1,16:1 avec le blanc | **Non** : garder fond `primary-soft`, texte `primary` en gras et `aria-current` ; le gras et la couleur du texte (5,3:1 sur ce fond) disent l'état. C'est ce que montrent toutes les maquettes | L'entrée active en encre pleine, comme une bascule |
| S5 | Le bandeau d'information | Il quitte le fond de la couleur d'action (A15) ; avec le crème en fond de page, un fond `ground` ne se verra plus | **Aujourd'hui** : `ground` bordé de `line`, icône « i ». **Avec le trio** : fond `surface` bordé, sur la page crème | Le crème en fond du bandeau, avec un bord plus marqué |
| S6 | L'étape en cours : encre ou couleur d'action ? | La frise (volet 3) la marque en encre ; l'assistant d'import (volet 2) en couleur d'action | **En encre partout** : une étape est un état, pas une action | La couleur d'action dans les assistants, l'encre dans la frise |
| S7 | Les mots des rôles | L'app écrit « titulaire », « Titulaire », « Propriétaire » pour le même rôle, et « collaborateur », « Membre », « Planner » pour l'autre | **titulaire, collaborateur (collaboratrice), comptable** ; « Vous » et le prénom ailleurs ; « Exploitation » pour l'équipe de Symbola | « Propriétaire » et « Membre », plus courants dans les logiciels |
| S8 | L'entrée de danger d'un menu « ⋯ » est-elle rouge ? | Trois maquettes la mettent en rouge (« Supprimer la tâche », « Annuler l'évènement… »), une autre non (« Supprimer… » au budget) | **Rouge, en dernier, après un filet**, seule de sa couleur : elle n'est pas répétée à chaque ligne | Encre comme les autres, la séparation suffisant |
| S9 | Un seul « Enregistrer » pour toutes les fenêtres longues ? | M1 (fenêtre d'une tâche) et D7 (« Modifier les informations ») le décident ; l'ADR 0107 disait « enregistrement à chaque rubrique » ; la fenêtre du poste (ADR 0111) n'est pas redessinée | **Oui, pour toutes**, la fenêtre du poste comprise quand son lot vient ; l'ADR de M1 (paquet 70c) amende l'ADR 0107 en ce sens. Nom du composant : « fenêtre d'un objet » (« panneau » reste au panneau latéral, au panneau d'aide et au panneau du bas) | Un « Enregistrer » par rubrique dans les fenêtres à rubriques |
| S10 | L'accent du message de retour quand le bleu arrivera | Le bouton « Annuler » emploie `night-accent`, l'accent du Jour J | **Garder `night-accent`** : il dit « action sur fond sombre » dans les deux usages ; recalculer s'il change | Le bleu clair de la marque, s'il passe 4,5:1 sur l'encre |
| S11 | L'ambre garde-t-il « À vérifier » et « À compléter » ? | La répartition A retire l'ambre des listes ; les maquettes du volet 2 le gardent pour ces deux bandeaux | **Oui** : c'est la seule teinte qui dit « à vous de regarder » ; la recalculer à côté de l'orange | Tout en neutre, « À vérifier : » ne tenant qu'au mot et à l'icône |
| S12 | Le message de retour et les fenêtres en mode Jour J | Sur le fond `night`, un message en encre ne se détache pas | **Fond `night-surface`, bord `night-line`**, texte `night-ink`, bouton `night-accent` ; cibles de 56 px | Garder le message clair (fond `surface`) sur le fond de nuit |
| S13 | « famille » de prestataires | La page 5 proposait « catégorie » ; le volet 4 garde « familles » puis « métiers » (V4) ; le lot 70g tient « famille » en exception à retirer | **Garder « famille »** (la maquette récente) et le sortir de la liste des mots à retirer | « catégorie », comme proposé au volet 1 |
| S14 | Contrôler le Design System par des tests | La liste du § 4.1 a des contrôles mesurables | **Un utilitaire Playwright** dans `packages/testing` (un bouton plein, cibles de 44 px, aucun défilement de côté à 375 et 911 px, aucun `disabled` muet), appelé par les parcours de chaque lot de réalisation | Contrôle à l'œil, au rejeu |
| S15 | Émettre une facture : quel niveau de danger ? | Une facture émise est immuable (DAT-04) ; elle ne se défait que par un avoir | **Niveau 2** : une fenêtre qui dit « Elle ne pourra plus être modifiée ; une correction passe par un avoir », « Garder le brouillon » à gauche | Niveau 3, avec la case à cocher |

## 7. La page de référence, vérifiée

Ouverte dans le navigateur de l'app (Chromium), aux deux tailles, après chaque correction :

- **À 1 440 px** : aucun défilement de côté de la page ; dans les 49 cadres (ordinateur et téléphone),
  aucune commande de moins de 44 px de haut ou de large et aucun élément qui sort de son cadre.
- **À 375 px** : aucun défilement de côté de la page ; les cadres de téléphone font 375 px ; aucune
  commande de moins de 44 px ; aucun élément ne sort de son cadre (seule la barre d'onglets du
  téléphone défile de côté, dans sa barre, comme le veut E3). Les cadres d'ordinateur défilent dans
  leur propre boîte.
- **Couleurs** : les dix-neuf valeurs du fichier sont des jetons de `DESIGN.md` (relevé par script).
- Corrigé après le premier contrôle : les boutons des bascules (38 px), la croix des filtres posés
  (36 px), l'interrupteur (26 px), le lien de téléphone et le lien d'évènement de la fenêtre, le titre
  d'une tâche sur téléphone, et les cadres de téléphone coupés à 343 px sur un écran de 375 px.
- Non vérifié : la page n'est pas passée à axe-core (pas d'outil dans ce dépôt pour une page
  statique) ; les polices sont celles du système quand Inter et Space Grotesk ne sont pas installées.

La page est produite par un petit générateur hors du dépôt ; les pages 1 à 33 ne sont pas touchées ;
le sommaire gagne une ligne.

## 8. Limites

- Le Design System est tiré des maquettes et de leurs notes, pas d'un nouvel essai par le panel (non
  demandé). Les règles des volets 2 à 6 ont été retenues par défaut, sans rejeu.
- La liste de contrôle des autres modules (§ 4.2) part des maquettes et des constats, pas d'un relevé
  de leurs écrans.
- Les valeurs du trio, les noms définitifs des rôles (S7) et les quinze points du § 6 attendent
  Julien.
- Le plan des lots de réalisation (phase 7) n'est pas dans cette note.
